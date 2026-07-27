import { prisma } from '../../config/prisma';
import { CreateLeadDTO, QueryLeadDTO } from './lead.types';
import { Prisma } from '@prisma/client';

export class LeadRepository {
  static async create(data: CreateLeadDTO) {
    const { contactPoints, tags, ...leadData } = data;

    // 1. Deduplicate contact points against DB
    const newContactPoints = [];
    for (const cp of contactPoints) {
      const normalized = cp.value.trim().toLowerCase();
      const existing = await prisma.contactPoint.findUnique({
        where: {
          type_normalized: {
            type: cp.type,
            normalized,
          },
        },
      });

      if (!existing) {
        newContactPoints.push({
          type: cp.type,
          value: cp.value,
          normalized,
          isPublic: cp.isPublic,
          isVerified: cp.isVerified || false,
          verification: cp.verification || undefined,
        });
      }
    }

    // If all contact points already exist in DB, skip creating duplicate lead
    if (newContactPoints.length === 0) {
      throw new Error('DUPLICATE_CONTACT_POINTS');
    }

    return prisma.lead.create({
      data: {
        ...leadData,
        contactPoints: {
          create: newContactPoints,
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

  static async findById(id: string) {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        contactPoints: true,
        sources: true,
        tags: true,
      },
    });
  }

  static async findMany(query: QueryLeadDTO) {
    const { category, status, country, genre, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = {};

    if (category) where.category = category;
    if (status) where.status = status;
    if (country) where.country = { contains: country, mode: 'insensitive' };
    if (genre) where.genres = { has: genre };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
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

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
