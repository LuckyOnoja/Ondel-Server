import { prisma } from '../../config/prisma';
import { CreateCampaignDTO } from './campaign.types';
import { CreditService } from '../credits/credit.service';
import { MatchingService } from '../matching/matching.service';
import { OutreachService } from '../outreach/outreach.service';
import { CampaignStatus, CampaignTargetStatus } from '@prisma/client';

export class CampaignService {
  static async createCampaign(dto: CreateCampaignDTO) {
    const { userId, songId, goal, targetCategories, targetGenres, targetCountries, budgetCredits } = dto;

    // 1. Reserve user credit budget
    await CreditService.reserveCredits(userId, budgetCredits, songId);

    // 2. Find matching verified leads
    const matchResult = await MatchingService.matchLeadsForCampaign({
      categories: targetCategories,
      genres: targetGenres,
      countries: targetCountries,
      limit: budgetCredits,
    });

    if (matchResult.leads.length === 0) {
      throw new Error('No matching verified leads found for campaign criteria. Credits reserved for future discovery.');
    }

    // 3. Create Campaign and CampaignTarget records
    const campaign = await prisma.campaign.create({
      data: {
        userId,
        songId,
        goal,
        targetCategories,
        targetGenres,
        targetCountries: targetCountries || [],
        status: CampaignStatus.RESERVED,
        budgetCredits,
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
      const emailContact = target.lead.contactPoints.find((cp) => cp.type === 'EMAIL');
      if (emailContact) {
        const sentSuccess = await OutreachService.sendPersonalizedPitch({
          targetId: target.id,
          recipientEmail: emailContact.value,
          recipientName: target.lead.name || undefined,
          organization: target.lead.organization || undefined,
          artistName: campaign.song.artist.name,
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
        }
      }
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: CampaignStatus.COMPLETED,
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
}
