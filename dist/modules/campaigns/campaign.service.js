"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignService = void 0;
const prisma_1 = require("../../config/prisma");
const credit_service_1 = require("../credits/credit.service");
const matching_service_1 = require("../matching/matching.service");
const outreach_service_1 = require("../outreach/outreach.service");
const client_1 = require("@prisma/client");
class CampaignService {
    static async createCampaign(dto) {
        const { userId, songId, goal, targetCategories, targetGenres, targetCountries, budgetCredits } = dto;
        // 1. Reserve user credit budget
        await credit_service_1.CreditService.reserveCredits(userId, budgetCredits, songId);
        // 2. Find matching verified leads
        const matchResult = await matching_service_1.MatchingService.matchLeadsForCampaign({
            categories: targetCategories,
            genres: targetGenres,
            countries: targetCountries,
            limit: budgetCredits,
        });
        if (matchResult.leads.length === 0) {
            throw new Error('No matching verified leads found for campaign criteria. Credits reserved for future discovery.');
        }
        // 3. Create Campaign and CampaignTarget records
        const campaign = await prisma_1.prisma.campaign.create({
            data: {
                userId,
                songId,
                goal,
                targetCategories,
                targetGenres,
                targetCountries: targetCountries || [],
                status: client_1.CampaignStatus.RESERVED,
                budgetCredits,
                consumedCredits: 0,
                targets: {
                    create: matchResult.leads.map((lead) => ({
                        leadId: lead.id,
                        status: client_1.CampaignTargetStatus.RESERVED,
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
    static async launchCampaign(campaignId) {
        const campaign = await prisma_1.prisma.campaign.findUnique({
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
        await prisma_1.prisma.campaign.update({
            where: { id: campaignId },
            data: { status: client_1.CampaignStatus.ACTIVE },
        });
        let emailsSent = 0;
        for (const target of campaign.targets) {
            const emailContact = target.lead.contactPoints.find((cp) => cp.type === 'EMAIL');
            if (emailContact) {
                const sentSuccess = await outreach_service_1.OutreachService.sendPersonalizedPitch({
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
                    await prisma_1.prisma.campaignTarget.update({
                        where: { id: target.id },
                        data: {
                            status: client_1.CampaignTargetStatus.SENT,
                            sentAt: new Date(),
                            creditsConsumed: 1,
                        },
                    });
                }
            }
        }
        await prisma_1.prisma.campaign.update({
            where: { id: campaignId },
            data: {
                status: client_1.CampaignStatus.COMPLETED,
                consumedCredits: emailsSent,
            },
        });
        return { campaignId, totalTargets: campaign.targets.length, emailsSent };
    }
    static async getCampaign(campaignId) {
        const campaign = await prisma_1.prisma.campaign.findUnique({
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
exports.CampaignService = CampaignService;
