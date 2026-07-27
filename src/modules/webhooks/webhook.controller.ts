import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { CampaignTargetStatus, LeadStatus } from '@prisma/client';
import { DeepSeekGeminiAIProvider } from '../../providers/ai/deepseek-gemini.provider';

export class WebhookController {
  private static aiProvider = new DeepSeekGeminiAIProvider();

  static async handleZohoEmailWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('\n====================================================');
      console.log('📩 [ZOHO WEBHOOK EVENT RECEIVED]');
      console.log('Timestamp:', new Date().toISOString());
      console.log('Method:', req.method);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Query Params:', JSON.stringify(req.query, null, 2));
      console.log('Body Payload:', JSON.stringify(req.body, null, 2));
      console.log('====================================================\n');

      const payload = req.body || {};
      const sender = payload.fromAddress || payload.sender || payload.from || payload.user_id || '';
      const subject = payload.subject || '';
      const content = payload.content || payload.summary || payload.htmlContent || payload.textContent || payload.body || payload.message || '';
      const headers = payload.headers || {};

      // 1. Extract Target ID from reference tag or custom headers
      let targetId: string | null = null;

      if (typeof headers['x-ondel-target-id'] === 'string') {
        targetId = headers['x-ondel-target-id'];
      } else if (typeof payload['x-ondel-target-id'] === 'string') {
        targetId = payload['x-ondel-target-id'];
      } else {
        const match = String(content).match(/Ref:\s*ONDEL-TGT-([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          targetId = match[1];
        }
      }

      const senderEmail = String(sender).toLowerCase().trim();

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
        console.warn(`[Zoho Webhook] No matching CampaignTarget found for sender: ${senderEmail}, TargetId: ${targetId}`);
        res.status(200).json({ success: true, message: 'Webhook received but no matching target found' });
        return;
      }

      // 3. Classify reply sentiment via AI (DeepSeek + Gemini Fallback)
      const sentiment = await WebhookController.classifyReplySentiment(subject, String(content));

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
        console.log(`[Zoho Webhook] Contact ${target.leadId} unsubscribed and updated in database.`);
      }

      console.log(`[Zoho Webhook] Updated target ${target.id} status to ${sentiment.targetStatus}`);
      res.status(200).json({ success: true, data: { targetId: target.id, status: sentiment.targetStatus } });
    } catch (error: any) {
      console.error('[Zoho Webhook Error]:', error.message);
      res.status(200).json({ success: false, error: error.message });
    }
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
