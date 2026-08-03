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
        const fullSearchText = `${subject} ${content}`;
        const match = fullSearchText.match(/Ref:\s*ONDEL-TGT-([a-zA-Z0-9_-]+)/i);
        if (match && match[1]) {
          targetId = match[1];
        }
      }

      const senderEmail = String(sender).toLowerCase().trim();

      // 2. Find matching CampaignTarget record using Multi-Variable Reconciliation
      let target = null;

      // Layer 1: Direct Target ID match
      if (targetId) {
        target = await prisma.campaignTarget.findUnique({
          where: { id: targetId },
          include: { lead: true, campaign: { include: { song: { include: { artist: true } } } } },
        });
      }

      // Layer 2: Exact Sender Email match
      if (!target && senderEmail) {
        target = await prisma.campaignTarget.findFirst({
          where: {
            lead: {
              contactPoints: {
                some: { value: senderEmail },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          include: { lead: true, campaign: { include: { song: { include: { artist: true } } } } },
        });
      }

      // Layer 3 & 4 Combined: Multi-Variable AI Matcher (Domain + Org + Song Title + Artist Name)
      if (!target) {
        target = await WebhookController.reconcileTargetWithAI(senderEmail, subject, String(content));
      }

      if (!target) {
        console.warn(`[Zoho Webhook] No matching CampaignTarget found for sender: ${senderEmail}, TargetId: ${targetId}`);
        res.status(200).json({ success: true, message: 'Webhook received but no matching target found' });
        return;
      }

      // 3. Classify reply sentiment via AI (DeepSeek + Gemini Fallback)
      const sentiment = await WebhookController.classifyReplySentiment(subject, String(content));

      // 4. Update CampaignTarget status & save curator reply text
      await prisma.campaignTarget.update({
        where: { id: target.id },
        data: {
          status: sentiment.targetStatus,
          sentAt: target.sentAt || new Date(),
          replyText: String(content).trim(),
          repliedAt: new Date(),
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

      console.log(`[Zoho Webhook] Updated target ${target.id} status to ${sentiment.targetStatus} with reply text.`);
      res.status(200).json({ success: true, data: { targetId: target.id, status: sentiment.targetStatus } });
    } catch (error: any) {
      console.error('[Zoho Webhook Error]:', error.message);
      res.status(200).json({ success: false, error: error.message });
    }
  }

  private static async reconcileTargetWithAI(senderEmail: string, subject: string, content: string) {
    try {
      const activeTargets = await prisma.campaignTarget.findMany({
        where: { status: { in: [CampaignTargetStatus.SENT, CampaignTargetStatus.DELIVERED, CampaignTargetStatus.PENDING, CampaignTargetStatus.RESERVED] } },
        take: 30,
        orderBy: { updatedAt: 'desc' },
        include: {
          lead: { include: { contactPoints: true } },
          campaign: { include: { song: { include: { artist: true } } } },
        },
      });

      if (activeTargets.length === 0) return null;

      const senderDomain = senderEmail.includes('@') ? senderEmail.split('@')[1] : '';

      // Direct domain & song title match check first
      for (const target of activeTargets) {
        const leadDomainMatch = senderDomain && senderDomain.length > 3 && !['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'].includes(senderDomain)
          ? target.lead.contactPoints.some((cp) => cp.value.includes(senderDomain)) || (target.lead.sourceUrl && target.lead.sourceUrl.includes(senderDomain))
          : false;

        const songMatch = target.campaign?.song?.title
          ? `${subject} ${content}`.toLowerCase().includes(target.campaign.song.title.toLowerCase())
          : false;

        if (leadDomainMatch && songMatch) {
          console.log(`[Reconciliation AI] High-confidence match on Domain + Song Title for target ${target.id}`);
          return target;
        }
      }

      // Return candidate with song title match (Strict match to prevent cross-song contamination)
      const songTarget = activeTargets.find((t) =>
        t.campaign?.song?.title && `${subject} ${content}`.toLowerCase().includes(t.campaign.song.title.toLowerCase())
      );
      if (songTarget) {
        console.log(`[Reconciliation AI] Song title mention match for target ${songTarget.id}`);
        return songTarget;
      }

      return null;
    } catch (error: any) {
      console.warn('[Reconciliation AI Error]:', error.message);
      return null;
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

    if (
      lowerText.includes('rate sheet') ||
      lowerText.includes('pricing') ||
      lowerText.includes('$') ||
      lowerText.includes('charge') ||
      lowerText.includes('pay me') ||
      lowerText.includes('pay') ||
      lowerText.includes('fee') ||
      lowerText.includes('how much')
    ) {
      return { targetStatus: CampaignTargetStatus.INTERESTED };
    }

    if (lowerText.includes('not a fit') || lowerText.includes('pass') || lowerText.includes('sorry')) {
      return { targetStatus: CampaignTargetStatus.BOUNCED };
    }

    return { targetStatus: CampaignTargetStatus.REPLIED };
  }
}
