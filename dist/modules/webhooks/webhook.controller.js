"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
const deepseek_gemini_provider_1 = require("../../providers/ai/deepseek-gemini.provider");
class WebhookController {
    static aiProvider = new deepseek_gemini_provider_1.DeepSeekGeminiAIProvider();
    static async handleZohoEmailWebhook(req, res) {
        try {
            console.log('[Zoho Webhook] Received incoming email payload:', JSON.stringify(req.body, null, 2));
            const payload = req.body || {};
            const sender = payload.fromAddress || payload.sender || payload.from || payload.user_id || '';
            const subject = payload.subject || '';
            const content = payload.content || payload.summary || payload.htmlContent || payload.textContent || payload.body || payload.message || '';
            const headers = payload.headers || {};
            // 1. Extract Target ID from reference tag or custom headers
            let targetId = null;
            if (typeof headers['x-ondel-target-id'] === 'string') {
                targetId = headers['x-ondel-target-id'];
            }
            else if (typeof payload['x-ondel-target-id'] === 'string') {
                targetId = payload['x-ondel-target-id'];
            }
            else {
                const match = String(content).match(/Ref:\s*ONDEL-TGT-([a-zA-Z0-9_-]+)/i);
                if (match && match[1]) {
                    targetId = match[1];
                }
            }
            const senderEmail = String(sender).toLowerCase().trim();
            // 2. Find matching CampaignTarget record
            const target = await prisma_1.prisma.campaignTarget.findFirst({
                where: targetId
                    ? { id: targetId }
                    : {
                        lead: {
                            contactPoints: {
                                some: { value: senderEmail },
                            },
                        },
                    },
                include: { lead: true, campaign: true },
            });
            if (!target) {
                console.warn(`[Zoho Webhook] No matching CampaignTarget found for sender: ${senderEmail}, TargetId: ${targetId}`);
                res.status(200).json({ success: true, message: 'Webhook received but no matching target found' });
                return;
            }
            // 3. Classify reply sentiment via AI (DeepSeek + Gemini Fallback)
            const sentiment = await WebhookController.classifyReplySentiment(subject, String(content));
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
                console.log(`[Zoho Webhook] Contact ${target.leadId} unsubscribed and updated in database.`);
            }
            console.log(`[Zoho Webhook] Updated target ${target.id} status to ${sentiment.targetStatus}`);
            res.status(200).json({ success: true, data: { targetId: target.id, status: sentiment.targetStatus } });
        }
        catch (error) {
            console.error('[Zoho Webhook Error]:', error.message);
            res.status(200).json({ success: false, error: error.message });
        }
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
exports.WebhookController = WebhookController;
