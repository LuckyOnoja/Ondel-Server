"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplyListenerService = void 0;
const imap_1 = __importDefault(require("imap"));
const mailparser_1 = require("mailparser");
const env_1 = require("../../config/env");
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
const deepseek_gemini_provider_1 = require("../../providers/ai/deepseek-gemini.provider");
class ReplyListenerService {
    static aiProvider = new deepseek_gemini_provider_1.DeepSeekGeminiAIProvider();
    static async checkUnreadReplies() {
        if (!env_1.env.IMAP_USER || !env_1.env.IMAP_PASS) {
            console.warn('[ReplyListener] IMAP credentials missing in env. Skipping reply check.');
            return { checked: 0, updated: 0 };
        }
        return new Promise((resolve) => {
            let checkedCount = 0;
            let updatedCount = 0;
            const imap = new imap_1.default({
                user: env_1.env.IMAP_USER,
                password: env_1.env.IMAP_PASS,
                host: env_1.env.IMAP_HOST,
                port: env_1.env.IMAP_PORT,
                tls: env_1.env.IMAP_PORT === 993,
                tlsOptions: { rejectUnauthorized: false },
            });
            imap.once('ready', () => {
                imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        console.error('[ReplyListener] Open INBOX error:', err.message);
                        imap.end();
                        return resolve({ checked: 0, updated: 0 });
                    }
                    // Search for UNSEEN (unread) messages
                    imap.search(['UNSEEN'], (searchErr, results) => {
                        if (searchErr || !results || results.length === 0) {
                            imap.end();
                            return resolve({ checked: 0, updated: 0 });
                        }
                        checkedCount = results.length;
                        const fetcher = imap.fetch(results, { bodies: '', markSeen: true });
                        fetcher.on('message', (msg) => {
                            msg.on('body', (stream) => {
                                (0, mailparser_1.simpleParser)(stream, async (parseErr, mail) => {
                                    if (!parseErr && mail) {
                                        const processResult = await ReplyListenerService.processIncomingMail(mail);
                                        if (processResult)
                                            updatedCount++;
                                    }
                                });
                            });
                        });
                        fetcher.once('end', () => {
                            imap.end();
                        });
                    });
                });
            });
            imap.once('error', (err) => {
                console.error('[ReplyListener] IMAP connection error:', err.message);
                resolve({ checked: checkedCount, updated: updatedCount });
            });
            imap.once('end', () => {
                resolve({ checked: checkedCount, updated: updatedCount });
            });
            imap.connect();
        });
    }
    static async processIncomingMail(mail) {
        const senderEmail = mail.from?.value?.[0]?.address?.toLowerCase();
        const bodyText = mail.text || mail.html || '';
        const subject = mail.subject || '';
        // 1. Extract Target ID from header or body reference tag
        const candidateTargetIds = [];
        const headerTargetId = mail.headers.get('x-ondel-target-id');
        if (typeof headerTargetId === 'string' && headerTargetId.trim()) {
            candidateTargetIds.push(headerTargetId.trim());
        }
        const matches = Array.from(bodyText.matchAll(/Ref:\s*ONDEL-TGT-([a-zA-Z0-9_-]+)/gi));
        for (const m of matches) {
            if (m[1] && !candidateTargetIds.includes(m[1])) {
                candidateTargetIds.push(m[1]);
            }
        }
        let target = null;
        // Try candidate target IDs, prioritizing ones that are SENT/DELIVERED/PENDING
        for (const tid of candidateTargetIds) {
            const candidate = await prisma_1.prisma.campaignTarget.findUnique({
                where: { id: tid },
                include: { lead: true, campaign: { include: { song: { include: { artist: true } } } } },
            });
            if (candidate) {
                if ([client_1.CampaignTargetStatus.SENT, client_1.CampaignTargetStatus.DELIVERED, client_1.CampaignTargetStatus.PENDING].includes(candidate.status)) {
                    target = candidate;
                    break;
                }
                else if (!target) {
                    target = candidate;
                }
            }
        }
        // If still no target found (or if target found is already REPLIED), search by senderEmail for active SENT targets
        if ((!target || ['REPLIED', 'ACCEPTED', 'INTERESTED', 'UNSUBSCRIBED', 'BOUNCED'].includes(target.status)) && senderEmail) {
            const activeTarget = await prisma_1.prisma.campaignTarget.findFirst({
                where: {
                    status: { in: [client_1.CampaignTargetStatus.SENT, client_1.CampaignTargetStatus.DELIVERED, client_1.CampaignTargetStatus.PENDING] },
                    lead: {
                        contactPoints: {
                            some: { value: senderEmail },
                        },
                    },
                },
                orderBy: { sentAt: 'desc' },
                include: { lead: true, campaign: { include: { song: { include: { artist: true } } } } },
            });
            if (activeTarget) {
                target = activeTarget;
            }
        }
        if (!target) {
            console.log(`[ReplyListener] Reply received from ${senderEmail}, but no matching CampaignTarget found.`);
            return false;
        }
        // 3. Classify sentiment with AI (DeepSeek + Gemini Fallback)
        const sentiment = await this.classifyReplySentiment(subject, bodyText);
        // 4. Update CampaignTarget status
        await prisma_1.prisma.campaignTarget.update({
            where: { id: target.id },
            data: {
                status: sentiment.targetStatus,
                sentAt: target.sentAt || new Date(),
            },
        });
        // 5. Handle opt-out / unsubscribe
        if (sentiment.targetStatus === client_1.CampaignTargetStatus.UNSUBSCRIBED) {
            await prisma_1.prisma.lead.update({
                where: { id: target.leadId },
                data: { status: client_1.LeadStatus.UNSUBSCRIBED },
            });
            console.log(`[ReplyListener] Contact ${target.leadId} requested unsubscribe and was blocked.`);
        }
        console.log(`[ReplyListener] Processed reply for target ${target.id}: Sentiment classified as ${sentiment.targetStatus}`);
        return true;
    }
    static async classifyReplySentiment(subject, text) {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('unsubscribe') || lowerText.includes('remove me') || lowerText.includes('stop emailing')) {
            return { targetStatus: client_1.CampaignTargetStatus.UNSUBSCRIBED };
        }
        if (lowerText.includes('added to') || lowerText.includes('placed') || lowerText.includes('added your song') || lowerText.includes('playlist updated')) {
            return { targetStatus: client_1.CampaignTargetStatus.ACCEPTED };
        }
        if (lowerText.includes('rate sheet') || lowerText.includes('pricing') || lowerText.includes('$') || lowerText.includes('charge')) {
            return { targetStatus: client_1.CampaignTargetStatus.INTERESTED };
        }
        if (lowerText.includes('not a fit') || lowerText.includes('pass') || lowerText.includes('sorry')) {
            return { targetStatus: client_1.CampaignTargetStatus.BOUNCED };
        }
        return { targetStatus: client_1.CampaignTargetStatus.REPLIED };
    }
}
exports.ReplyListenerService = ReplyListenerService;
