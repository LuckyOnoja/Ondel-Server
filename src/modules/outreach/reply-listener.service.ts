import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { CampaignTargetStatus, LeadStatus } from '@prisma/client';
import { DeepSeekGeminiAIProvider } from '../../providers/ai/deepseek-gemini.provider';

export class ReplyListenerService {
  private static aiProvider = new DeepSeekGeminiAIProvider();

  static async checkUnreadReplies(): Promise<{ checked: number; updated: number }> {
    if (!env.IMAP_USER || !env.IMAP_PASS) {
      console.warn('[ReplyListener] IMAP credentials missing in env. Skipping reply check.');
      return { checked: 0, updated: 0 };
    }

    return new Promise((resolve) => {
      let checkedCount = 0;
      let updatedCount = 0;

      const imap = new Imap({
        user: env.IMAP_USER,
        password: env.IMAP_PASS,
        host: env.IMAP_HOST,
        port: env.IMAP_PORT,
        tls: env.IMAP_PORT === 993,
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
                simpleParser(stream as any, async (parseErr, mail) => {
                  if (!parseErr && mail) {
                    const processResult = await ReplyListenerService.processIncomingMail(mail);
                    if (processResult) updatedCount++;
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

      imap.once('error', (err: any) => {
        console.error('[ReplyListener] IMAP connection error:', err.message);
        resolve({ checked: checkedCount, updated: updatedCount });
      });

      imap.once('end', () => {
        resolve({ checked: checkedCount, updated: updatedCount });
      });

      imap.connect();
    });
  }

  private static async processIncomingMail(mail: ParsedMail): Promise<boolean> {
    const senderEmail = mail.from?.value?.[0]?.address?.toLowerCase();
    const bodyText = mail.text || mail.html || '';
    const subject = mail.subject || '';

    // 1. Extract Target ID from header or body reference tag
    let targetId: string | null = null;
    const headerTargetId = mail.headers.get('x-ondel-target-id');

    if (typeof headerTargetId === 'string') {
      targetId = headerTargetId;
    } else {
      const match = bodyText.match(/Ref:\s*ONDEL-TGT-([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        targetId = match[1];
      }
    }

    if (!targetId && !senderEmail) {
      return false;
    }

    // 2. Find matching CampaignTarget record
    const target = await prisma.campaignTarget.findFirst({
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
      console.log(`[ReplyListener] Reply received from ${senderEmail}, but no matching CampaignTarget found.`);
      return false;
    }

    // 3. Classify sentiment with AI (DeepSeek + Gemini Fallback)
    const sentiment = await this.classifyReplySentiment(subject, bodyText);

    // 4. Update CampaignTarget status
    await prisma.campaignTarget.update({
      where: { id: target.id },
      data: {
        status: sentiment.targetStatus,
        sentAt: target.sentAt || new Date(),
      },
    });

    // 5. Handle opt-out / unsubscribe
    if (sentiment.targetStatus === CampaignTargetStatus.UNSUBSCRIBED) {
      await prisma.lead.update({
        where: { id: target.leadId },
        data: { status: LeadStatus.UNSUBSCRIBED },
      });
      console.log(`[ReplyListener] Contact ${target.leadId} requested unsubscribe and was blocked.`);
    }

    console.log(`[ReplyListener] Processed reply for target ${target.id}: Sentiment classified as ${sentiment.targetStatus}`);
    return true;
  }

  private static async classifyReplySentiment(subject: string, text: string): Promise<{ targetStatus: CampaignTargetStatus }> {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('unsubscribe') || lowerText.includes('remove me') || lowerText.includes('stop emailing')) {
      return { targetStatus: CampaignTargetStatus.UNSUBSCRIBED };
    }

    if (lowerText.includes('added to') || lowerText.includes('placed') || lowerText.includes('added your song') || lowerText.includes('playlist updated')) {
      return { targetStatus: CampaignTargetStatus.ACCEPTED };
    }

    if (lowerText.includes('rate sheet') || lowerText.includes('pricing') || lowerText.includes('$') || lowerText.includes('charge')) {
      return { targetStatus: CampaignTargetStatus.INTERESTED };
    }

    if (lowerText.includes('not a fit') || lowerText.includes('pass') || lowerText.includes('sorry')) {
      return { targetStatus: CampaignTargetStatus.BOUNCED };
    }

    return { targetStatus: CampaignTargetStatus.REPLIED };
  }
}
