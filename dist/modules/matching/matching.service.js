"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingService = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class MatchingService {
    static async matchLeadsForCampaign(input) {
        const { categories, genres, countries, limit = 20 } = input;
        const where = {
            status: client_1.LeadStatus.VERIFIED,
            acceptsSubmissions: true,
        };
        if (categories && categories.length > 0) {
            where.category = { in: categories };
        }
        if (countries && countries.length > 0) {
            where.country = { in: countries };
        }
        if (genres && genres.length > 0) {
            where.genres = { hasSome: genres };
        }
        const leads = await prisma_1.prisma.lead.findMany({
            where,
            take: limit,
            orderBy: [
                { relevanceScore: 'desc' },
                { createdAt: 'desc' },
            ],
            include: {
                contactPoints: {
                    where: { isVerified: true },
                },
                sources: true,
                tags: true,
            },
        });
        return {
            totalMatches: leads.length,
            leads: leads.map((lead) => ({
                id: lead.id,
                name: lead.name,
                organization: lead.organization,
                category: lead.category,
                country: lead.country,
                genres: lead.genres,
                verifiedContacts: lead.contactPoints,
                relevanceScore: lead.relevanceScore || 0.85,
            })),
        };
    }
}
exports.MatchingService = MatchingService;
