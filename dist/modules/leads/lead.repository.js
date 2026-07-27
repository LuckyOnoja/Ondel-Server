"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadRepository = void 0;
const prisma_1 = require("../../config/prisma");
class LeadRepository {
    static async create(data) {
        const { contactPoints, tags, ...leadData } = data;
        return prisma_1.prisma.lead.create({
            data: {
                ...leadData,
                contactPoints: {
                    create: contactPoints.map((cp) => ({
                        type: cp.type,
                        value: cp.value,
                        normalized: cp.value.trim().toLowerCase(),
                        isPublic: cp.isPublic,
                    })),
                },
                tags: {
                    create: tags.map((t) => ({ tag: t })),
                },
            },
            include: {
                contactPoints: true,
                sources: true,
                tags: true,
            },
        });
    }
    static async findById(id) {
        return prisma_1.prisma.lead.findUnique({
            where: { id },
            include: {
                contactPoints: true,
                sources: true,
                tags: true,
            },
        });
    }
    static async findMany(query) {
        const { category, status, country, genre, search, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;
        const where = {};
        if (category)
            where.category = category;
        if (status)
            where.status = status;
        if (country)
            where.country = { contains: country, mode: 'insensitive' };
        if (genre)
            where.genres = { has: genre };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { organization: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, leads] = await Promise.all([
            prisma_1.prisma.lead.count({ where }),
            prisma_1.prisma.lead.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    contactPoints: true,
                    sources: true,
                    tags: true,
                },
            }),
        ]);
        return { total, page, limit, totalPages: Math.ceil(total / limit), leads };
    }
    static async updateStatus(id, status) {
        return prisma_1.prisma.lead.update({
            where: { id },
            data: { status },
            include: { contactPoints: true, sources: true, tags: true },
        });
    }
}
exports.LeadRepository = LeadRepository;
