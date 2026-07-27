import { Request, Response } from 'express';
import { z } from 'zod';
import { LeadCategory } from '@prisma/client';
import { JobTracker } from './job-tracker';
import { DiscoveryPipelineService } from './discovery-pipeline.service';

const CreateDiscoveryJobSchema = z.object({
  categories: z.array(z.nativeEnum(LeadCategory)).min(1),
  genres: z.array(z.string()).min(1),
  countries: z.array(z.string()).optional(),
  targetCount: z.number().int().positive().optional().default(10),
});

export class DiscoveryController {
  static async createJob(req: Request, res: Response): Promise<void> {
    try {
      const validated = CreateDiscoveryJobSchema.parse(req.body);
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const job = JobTracker.createJob(jobId, validated);

      // Launch async discovery background execution
      DiscoveryPipelineService.runPipeline({
        jobId,
        categories: validated.categories,
        genres: validated.genres,
        countries: validated.countries,
        targetCount: validated.targetCount,
      }).catch((err) => console.error('[Async Discovery Execution Error]:', err));

      res.status(202).json({
        success: true,
        message: 'Discovery job queued successfully',
        data: {
          jobId: job.id,
          status: job.status,
          targetCount: job.targetCount,
        },
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const job = JobTracker.getJob(id);

      if (!job) {
        res.status(404).json({ success: false, error: `Discovery job ${id} not found` });
        return;
      }

      res.status(200).json({ success: true, data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
