import { prisma } from '../../config/prisma';
import { CreateCampaignDTO } from './campaign.types';
import { CreditService } from '../credits/credit.service';
import { MatchingService } from '../matching/matching.service';
import { OutreachService } from '../outreach/outreach.service';
import { CampaignStatus, CampaignTargetStatus, CampaignType, LeadCategory } from '@prisma/client';

export class CampaignService {
  static async createCampaign(dto: CreateCampaignDTO) {
    const {
      userId,
      songId,
      type = CampaignType.GENERAL,
      goal = 'Playlist Pitching & Radio Outreach',
      targetCategories,
      targetGenres,
      targetCountries,
      budgetCredits,
      targetLeadIds,
      autoLaunch = false,
    } = dto;

    // Fetch the target song
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { artist: true },
    });

    if (!song) {
      throw new Error(`Song with ID ${songId} not found`);
    }

    let campaign;

    if (type === CampaignType.TARGETED) {
      // ===== TARGETED / SINGLE-PLAYLISTER CAMPAIGN =====
      if (!targetLeadIds || targetLeadIds.length === 0) {
        throw new Error('Targeted campaign requires at least one target lead ID (targetLeadIds)');
      }

      const cost = targetLeadIds.length; // 1 credit per targeted playlister

      // 1. Reserve exact credit budget (1 credit per playlister)
      await CreditService.reserveCredits(userId, cost, songId);

      // 2. Fetch leads by selected IDs
      const leads = await prisma.lead.findMany({
        where: { id: { in: targetLeadIds } },
      });

      if (leads.length === 0) {
        throw new Error('None of the specified target playlisters were found');
      }

      // 3. Create Targeted Campaign with targets
      campaign = await prisma.campaign.create({
        data: {
          userId,
          songId,
          type: CampaignType.TARGETED,
          goal,
          targetCategories: targetCategories || [LeadCategory.PLAYLIST_CURATOR, LeadCategory.RADIO_DJ],
          targetGenres: targetGenres || [song.genre],
          targetCountries: targetCountries || [],
          status: CampaignStatus.RESERVED,
          budgetCredits: cost,
          consumedCredits: 0,
          targets: {
            create: leads.map((lead) => ({
              leadId: lead.id,
              status: CampaignTargetStatus.RESERVED,
              creditsReserved: 1,
              creditsConsumed: 0,
            })),
          },
        },
        include: {
          targets: {
            include: { lead: { include: { contactPoints: true } } },
          },
          song: { include: { artist: true } },
        },
      });
    } else {
      // ===== GENERAL AUTO-MATCHED CAMPAIGN =====
      const totalBudget = budgetCredits || 10;
      const genresToUse = targetGenres && targetGenres.length > 0 ? targetGenres : [song.genre];

      // 1. Reserve credit budget
      await CreditService.reserveCredits(userId, totalBudget, songId);

      // 2. Find matching leads
      const matchResult = await MatchingService.matchLeadsForCampaign({
        categories: targetCategories,
        genres: genresToUse,
        countries: targetCountries,
        limit: totalBudget,
      });

      if (matchResult.leads.length === 0) {
        throw new Error('No matching verified leads found for criteria. Credits reserved for future discovery.');
      }

      // 3. Create General Campaign
      campaign = await prisma.campaign.create({
        data: {
          userId,
          songId,
          type: CampaignType.GENERAL,
          goal,
          targetCategories: targetCategories || [LeadCategory.PLAYLIST_CURATOR, LeadCategory.RADIO_DJ, LeadCategory.MUSIC_BLOG],
          targetGenres: genresToUse,
          targetCountries: targetCountries || [],
          status: CampaignStatus.RESERVED,
          budgetCredits: totalBudget,
          consumedCredits: 0,
          targets: {
            create: matchResult.leads.map((lead) => ({
              leadId: lead.id,
              status: CampaignTargetStatus.RESERVED,
              creditsReserved: 1,
              creditsConsumed: 0,
            })),
          },
        },
        include: {
          targets: {
            include: { lead: { include: { contactPoints: true } } },
          },
          song: { include: { artist: true } },
        },
      });
    }

    // 4. Auto launch outreach if requested
    if (autoLaunch) {
      const launchResult = await this.launchCampaign(campaign.id);
      return {
        ...campaign,
        launchResult,
      };
    }

    return campaign;
  }

  static async launchCampaign(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        targets: {
          include: { lead: { include: { contactPoints: true } } },
        },
        song: { include: { artist: true } },
      },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.ACTIVE },
    });

    let emailsSent = 0;

    for (const target of campaign.targets) {
      const emailContact = target.lead.contactPoints?.find((cp) => cp.type === 'EMAIL');
      const recipientEmail = emailContact?.value || (target.lead as any).email || 'luckyonojatbg@gmail.com';

      if (recipientEmail) {
        console.log(`🚀 [LaunchCampaign] Sending direct pitch for "${campaign.song.title}" to ${recipientEmail} (${target.lead.name})...`);
        const sentSuccess = await OutreachService.sendPersonalizedPitch({
          targetId: target.id,
          recipientEmail: recipientEmail,
          recipientName: target.lead.name || undefined,
          organization: target.lead.organization || undefined,
          artistName: campaign.song.artist?.name || 'Artist',
          songTitle: campaign.song.title,
          genre: campaign.song.genre,
          epkUrl: campaign.song.epkUrl || undefined,
          audioUrl: campaign.song.audioUrl || undefined,
        });

        if (sentSuccess) {
          emailsSent++;
          await prisma.campaignTarget.update({
            where: { id: target.id },
            data: {
              status: CampaignTargetStatus.SENT,
              sentAt: new Date(),
              creditsConsumed: 1,
            },
          });
        } else {
          await prisma.campaignTarget.update({
            where: { id: target.id },
            data: {
              status: CampaignTargetStatus.BOUNCED,
            },
          });
        }
      }
    }

    const allSent = campaign.targets.length > 0 && emailsSent === campaign.targets.length;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: allSent ? CampaignStatus.COMPLETED : CampaignStatus.ACTIVE,
        consumedCredits: emailsSent,
      },
    });

    return { campaignId, totalTargets: campaign.targets.length, emailsSent };
  }

  static async getCampaign(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        targets: {
          include: { lead: { include: { contactPoints: true } } },
        },
        song: { include: { artist: true } },
      },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    return campaign;
  }

  static async getUserCampaigns(userId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { userId },
      include: {
        song: { include: { artist: true } },
        targets: {
          include: { lead: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns;
  }
}
