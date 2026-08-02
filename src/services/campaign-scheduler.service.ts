import { prisma } from '../config/prisma';
import { CampaignStatus, CampaignTargetStatus } from '@prisma/client';
import { OutreachService } from '../modules/outreach/outreach.service';

/**
 * Ondel Campaign Execution & Round-Robin Batch Scheduler Engine
 * 
 * Manages high-concurrency outreach by processing active campaigns in fair
 * Round-Robin micro-batches (50-100 leads per batch) spread across selected
 * campaign duration windows (24h to 7 days).
 */
export class CampaignSchedulerService {
  private static isRunning = false;
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static readonly BATCH_SIZE_PER_CAMPAIGN = 50; // 50 leads per round-robin turn

  /**
   * Starts the background round-robin campaign processing loop
   */
  static startScheduler(intervalMs = 30000) {
    if (this.intervalTimer) return;
    
    console.log('⚡ [CampaignScheduler] Round-Robin Campaign Execution Engine Started.');
    this.intervalTimer = setInterval(() => {
      this.processRoundRobinBatch().catch((err) => {
        console.error('[CampaignScheduler] Execution error:', err.message);
      });
    }, intervalMs);
  }

  /**
   * Stops the background scheduler
   */
  static stopScheduler() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Processes active campaigns in fair round-robin micro-batches
   */
  static async processRoundRobinBatch(): Promise<{ processedBatches: number; totalPitchesSent: number }> {
    if (this.isRunning) return { processedBatches: 0, totalPitchesSent: 0 };
    this.isRunning = true;

    let processedBatches = 0;
    let totalPitchesSent = 0;

    try {
      // 1. Fetch all ACTIVE or RESERVED campaigns requiring outreach
      const activeCampaigns = await prisma.campaign.findMany({
        where: {
          status: { in: [CampaignStatus.ACTIVE, CampaignStatus.RESERVED] },
        },
        include: {
          song: { include: { artist: true } },
          targets: {
            where: { status: CampaignTargetStatus.RESERVED },
            include: { lead: { include: { contactPoints: true } } },
            take: this.BATCH_SIZE_PER_CAMPAIGN,
          },
        },
        orderBy: { updatedAt: 'asc' }, // Round-robin fairness: process least recently updated first
      });

      if (activeCampaigns.length === 0) {
        this.isRunning = false;
        return { processedBatches: 0, totalPitchesSent: 0 };
      }

      console.log(`\n================================================================================`);
      console.log(`🔄 [Round-Robin Scheduler] Processing micro-batches for ${activeCampaigns.length} active campaign(s)...`);
      console.log(`================================================================================`);

      // 2. Iterate through each campaign in round-robin sequence
      for (const campaign of activeCampaigns) {
        const pendingTargets = campaign.targets;

        if (!pendingTargets || pendingTargets.length === 0) {
          // Check if all targets are completed
          const remainingCount = await prisma.campaignTarget.count({
            where: { campaignId: campaign.id, status: CampaignTargetStatus.RESERVED },
          });

          if (remainingCount === 0) {
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { status: CampaignStatus.COMPLETED },
            });
            console.log(`🎉 [Round-Robin Scheduler] Campaign "${campaign.song.title}" Marked COMPLETED!`);
          }
          continue;
        }

        console.log(`🚀 [Batch Execution] Pitching ${pendingTargets.length} target(s) for "${campaign.song.title}" (${campaign.song.artist?.name})...`);

        // Update campaign status to ACTIVE if it was RESERVED
        if (campaign.status === CampaignStatus.RESERVED) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { status: CampaignStatus.ACTIVE },
          });
        }

        let campaignSuccessCount = 0;

        // Process up to 50 targets for this campaign's turn
        for (const target of pendingTargets) {
          const emailPoint = target.lead.contactPoints?.find((cp) => cp.type === 'EMAIL');
          const recipientEmail = emailPoint?.value || `${target.lead.id.toLowerCase()}@curator.ondel.io`;

          try {
            const success = await OutreachService.sendPersonalizedPitch({
              targetId: target.id,
              recipientEmail,
              recipientName: target.lead.name || 'Music Curator',
              organization: target.lead.organization || 'Playlist Team',
              artistName: campaign.song.artist?.name || 'Artist',
              songTitle: campaign.song.title,
              genre: campaign.song.genre,
              epkUrl: campaign.song.epkUrl || undefined,
              audioUrl: campaign.song.audioUrl || undefined,
            });

            const newStatus = success ? CampaignTargetStatus.SENT : CampaignTargetStatus.BOUNCED;

            await prisma.campaignTarget.update({
              where: { id: target.id },
              data: {
                status: newStatus,
                sentAt: new Date(),
                creditsConsumed: success ? 1 : 0,
              },
            });

            if (success) {
              campaignSuccessCount++;
              totalPitchesSent++;
            }
          } catch (err: any) {
            console.warn(`⚠️ [Batch Execution] Pitch failed for target ${target.id}:`, err.message);
          }
        }

        // Update consumed credits for campaign & timestamp for round-robin rotation
        if (campaignSuccessCount > 0) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: {
              consumedCredits: { increment: campaignSuccessCount },
              updatedAt: new Date(), // Pushes campaign to back of round-robin line
            },
          });
        }

        processedBatches++;
      }
    } catch (err: any) {
      console.error('[Round-Robin Scheduler] Processing error:', err.message);
    } finally {
      this.isRunning = false;
    }

    return { processedBatches, totalPitchesSent };
  }
}
