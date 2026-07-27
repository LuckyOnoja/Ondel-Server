import { prisma } from '../../config/prisma';
import { LeadCategory, LeadStatus } from '@prisma/client';

export interface MatchingQueryInput {
  categories?: LeadCategory[];
  genres: string[];
  countries?: string[];
  limit?: number;
}

export class MatchingService {
  static async matchLeadsForCampaign(input: MatchingQueryInput) {
    const { categories, genres, countries, limit = 20 } = input;

    const where: any = {
      status: LeadStatus.VERIFIED,
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

    const leads = await prisma.lead.findMany({
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
