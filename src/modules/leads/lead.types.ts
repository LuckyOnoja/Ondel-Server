import { z } from 'zod';
import { LeadCategory, LeadStatus, ContactPointType } from '@prisma/client';

export const CreateContactPointSchema = z.object({
  type: z.nativeEnum(ContactPointType),
  value: z.string().min(1),
  isPublic: z.boolean().optional().default(true),
  isVerified: z.boolean().optional(),
  verification: z.any().optional(),
});

export const CreateLeadSchema = z.object({
  name: z.string().optional(),
  organization: z.string().optional(),
  category: z.nativeEnum(LeadCategory),
  country: z.string().optional(),
  city: z.string().optional(),
  genres: z.array(z.string()).optional().default([]),
  acceptsSubmissions: z.boolean().optional().default(false),
  status: z.nativeEnum(LeadStatus).optional().default(LeadStatus.DISCOVERED),
  sourceUrl: z.string().url().optional(),
  sourceType: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  contactPoints: z.array(CreateContactPointSchema).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
});

export const QueryLeadSchema = z.object({
  category: z.nativeEnum(LeadCategory).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  country: z.string().optional(),
  genre: z.string().optional(),
  search: z.string().optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
});

export type CreateLeadDTO = z.infer<typeof CreateLeadSchema>;
export type QueryLeadDTO = z.infer<typeof QueryLeadSchema>;
