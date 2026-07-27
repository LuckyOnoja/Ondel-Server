"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryController = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const job_tracker_1 = require("./job-tracker");
const discovery_pipeline_service_1 = require("./discovery-pipeline.service");
const CreateDiscoveryJobSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.nativeEnum(client_1.LeadCategory)).min(1),
    genres: zod_1.z.array(zod_1.z.string()).min(1),
    countries: zod_1.z.array(zod_1.z.string()).optional(),
    targetCount: zod_1.z.number().int().positive().optional().default(10),
});
class DiscoveryController {
    static async createJob(req, res) {
        try {
            const validated = CreateDiscoveryJobSchema.parse(req.body);
            const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const job = job_tracker_1.JobTracker.createJob(jobId, validated);
            // Launch async discovery background execution
            discovery_pipeline_service_1.DiscoveryPipelineService.runPipeline({
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
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async getJobStatus(req, res) {
        try {
            const id = String(req.params.id);
            const job = job_tracker_1.JobTracker.getJob(id);
            if (!job) {
                res.status(404).json({ success: false, error: `Discovery job ${id} not found` });
                return;
            }
            res.status(200).json({ success: true, data: job });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}
exports.DiscoveryController = DiscoveryController;
