import { prisma } from '../../config/prisma';
import { LeadCategory, KeywordStatus } from '@prisma/client';

export interface CreateKeywordInput {
  keyword: string;
  category: LeadCategory;
  genre: string;
  country?: string;
}

export class KeywordRepository {
  static async upsertKeywords(inputs: CreateKeywordInput[]) {
    let createdCount = 0;

    for (const input of inputs) {
      const normalizedKeyword = input.keyword.trim().toLowerCase();

      try {
        await prisma.discoveryKeyword.upsert({
          where: { keyword: normalizedKeyword },
          update: {},
          create: {
            keyword: normalizedKeyword,
            category: input.category,
            genre: input.genre,
            country: input.country,
            status: KeywordStatus.PENDING,
          },
        });
        createdCount++;
      } catch {
        // Keyword already exists in database
      }
    }

    return createdCount;
  }

  static async findPendingKeywords(category: LeadCategory, genre: string, limit = 20) {
    return prisma.discoveryKeyword.findMany({
      where: {
        category,
        genre: { equals: genre, mode: 'insensitive' },
        status: KeywordStatus.PENDING,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  static async updateKeywordStatus(id: string, status: KeywordStatus, leadsFound = 0) {
    return prisma.discoveryKeyword.update({
      where: { id },
      data: {
        status,
        leadsFound: { increment: leadsFound },
        lastUsedAt: new Date(),
      },
    });
  }
}
