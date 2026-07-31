import { Request, Response } from 'express';
import { MatchingService } from './matching.service';
import { z } from 'zod';
import { LeadCategory } from '@prisma/client';

const MatchSearchSchema = z.object({
  categories: z.array(z.nativeEnum(LeadCategory)).optional(),
  genres: z.array(z.string()).min(1),
  countries: z.array(z.string()).optional(),
  limit: z.number().optional().default(20),
});

export class MatchingController {
  static async searchMatches(req: Request, res: Response): Promise<void> {
    try {
      const validated = MatchSearchSchema.parse(req.body);
      const results = await MatchingService.matchLeadsForCampaign(validated);
      res.status(200).json({ success: true, data: results });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async getMatchesForSong(req: Request, res: Response): Promise<void> {
    try {
      const songId = String(req.params.songId);
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
      const results = await MatchingService.matchLeadsForSong(songId, limit);
      res.status(200).json({ success: true, data: results });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }
}
