import { z } from 'zod';
import { LeadCategory, CampaignType } from '@prisma/client';

export const CreateCampaignSchema = z.object({
  userId: z.string().min(1),
  songId: z.string().min(1),
  type: z.nativeEnum(CampaignType).optional().default(CampaignType.GENERAL),
  goal: z.string().optional().default('Playlist Pitching & Radio Outreach'),
  
  // Fields for GENERAL campaign:
  targetCategories: z.array(z.nativeEnum(LeadCategory)).optional(),
  targetGenres: z.array(z.string()).optional(),
  targetCountries: z.array(z.string()).optional(),
  budgetCredits: z.number().int().positive().optional(),

  // Fields for TARGETED / Single-Playlister campaign:
  targetLeadIds: z.array(z.string()).optional(),

  // Flag to launch immediately after creation
  autoLaunch: z.boolean().optional().default(false),
});

export type CreateCampaignDTO = z.infer<typeof CreateCampaignSchema>;
