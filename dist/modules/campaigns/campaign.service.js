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
        const { userId, songId, type = client_1.CampaignType.GENERAL, goal = 'Playlist Pitching & Radio Outreach', targetCategories, targetGenres, targetCountries, budgetCredits, targetLeadIds, autoLaunch = false, } = dto;
        // Fetch the target song
        const song = await prisma_1.prisma.song.findUnique({
            where: { id: songId },
            include: { artist: true },
        });
        if (!song) {
            throw new Error(`Song with ID ${songId} not found`);
        }
        let campaign;
        if (type === client_1.CampaignType.TARGETED) {
            // ===== TARGETED / SINGLE-PLAYLISTER CAMPAIGN =====
            if (!targetLeadIds || targetLeadIds.length === 0) {
                throw new Error('Targeted campaign requires at least one target lead ID (targetLeadIds)');
            }
            const cost = targetLeadIds.length; // 1 credit per targeted playlister
            // 1. Reserve exact credit budget (1 credit per playlister)
            await credit_service_1.CreditService.reserveCredits(userId, cost, songId);
            // 2. Fetch leads by selected IDs
            const leads = await prisma_1.prisma.lead.findMany({
                where: { id: { in: targetLeadIds } },
            });
            if (leads.length === 0) {
                throw new Error('None of the specified target playlisters were found');
            }
            // 3. Create Targeted Campaign with targets
            campaign = await prisma_1.prisma.campaign.create({
                data: {
                    userId,
                    songId,
                    type: client_1.CampaignType.TARGETED,
                    goal,
                    targetCategories: targetCategories || [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.RADIO_DJ],
                    targetGenres: targetGenres || [song.genre],
                    targetCountries: targetCountries || [],
                    status: client_1.CampaignStatus.RESERVED,
                    budgetCredits: cost,
                    consumedCredits: 0,
                    targets: {
                        create: leads.map((lead) => ({
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
        }
        else {
            // ===== GENERAL AUTO-MATCHED CAMPAIGN =====
            const totalBudget = budgetCredits || 10;
            const genresToUse = targetGenres && targetGenres.length > 0 ? targetGenres : [song.genre];
            // 1. Reserve credit budget
            await credit_service_1.CreditService.reserveCredits(userId, totalBudget, songId);
            // 2. Find matching leads
            const matchResult = await matching_service_1.MatchingService.matchLeadsForCampaign({
                categories: targetCategories,
                genres: genresToUse,
                countries: targetCountries,
                limit: totalBudget,
            });
            if (matchResult.leads.length === 0) {
                throw new Error('No matching verified leads found for criteria. Credits reserved for future discovery.');
            }
            // 3. Create General Campaign
            campaign = await prisma_1.prisma.campaign.create({
                data: {
                    userId,
                    songId,
                    type: client_1.CampaignType.GENERAL,
                    goal,
                    targetCategories: targetCategories || [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.RADIO_DJ, client_1.LeadCategory.MUSIC_BLOG],
                    targetGenres: genresToUse,
                    targetCountries: targetCountries || [],
                    status: client_1.CampaignStatus.RESERVED,
                    budgetCredits: totalBudget,
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
    static async getUserCampaigns(userId) {
        const campaigns = await prisma_1.prisma.campaign.findMany({
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
exports.CampaignService = CampaignService;
