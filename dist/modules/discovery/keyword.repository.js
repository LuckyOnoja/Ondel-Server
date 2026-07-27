"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class KeywordRepository {
    static async upsertKeywords(inputs) {
        let createdCount = 0;
        for (const input of inputs) {
            const normalizedKeyword = input.keyword.trim().toLowerCase();
            try {
                await prisma_1.prisma.discoveryKeyword.upsert({
                    where: { keyword: normalizedKeyword },
                    update: {},
                    create: {
                        keyword: normalizedKeyword,
                        category: input.category,
                        genre: input.genre,
                        country: input.country,
                        status: client_1.KeywordStatus.PENDING,
                    },
                });
                createdCount++;
            }
            catch {
                // Keyword already exists in database
            }
        }
        return createdCount;
    }
    static async findPendingKeywords(category, genre, limit = 20) {
        return prisma_1.prisma.discoveryKeyword.findMany({
            where: {
                category,
                genre: { equals: genre, mode: 'insensitive' },
                status: client_1.KeywordStatus.PENDING,
            },
            take: limit,
            orderBy: { createdAt: 'asc' },
        });
    }
    static async updateKeywordStatus(id, status, leadsFound = 0) {
        return prisma_1.prisma.discoveryKeyword.update({
            where: { id },
            data: {
                status,
                leadsFound: { increment: leadsFound },
                lastUsedAt: new Date(),
            },
        });
    }
}
exports.KeywordRepository = KeywordRepository;
