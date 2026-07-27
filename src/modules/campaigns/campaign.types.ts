import { z } from 'zod';
import { LeadCategory } from '@prisma/client';

export const CreateCampaignSchema = z.object({
  userId: z.string().min(1),
  songId: z.string().min(1),
  goal: z.string().min(1),
  targetCategories: z.array(z.nativeEnum(LeadCategory)).min(1),
  targetGenres: z.array(z.string()).min(1),
  targetCountries: z.array(z.string()).optional(),
  budgetCredits: z.number().int().positive(),
});

export type CreateCampaignDTO = z.infer<typeof CreateCampaignSchema>;
