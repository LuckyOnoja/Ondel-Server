"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discovery_pipeline_service_1 = require("../modules/discovery/discovery-pipeline.service");
const job_tracker_1 = require("../modules/discovery/job-tracker");
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
async function main() {
    console.log('============== STARTING LIVE LEAD DISCOVERY TEST (Target: 10 Leads) ==============');
    const jobId = `test_job_${Date.now()}`;
    job_tracker_1.JobTracker.createJob(jobId, {
        categories: [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.MUSIC_BLOG],
        genres: ['Afrobeats'],
        countries: ['United Kingdom'],
        targetCount: 10,
    });
    console.log(`[Test Script] Initialized Discovery Job ID: ${jobId}`);
    await discovery_pipeline_service_1.DiscoveryPipelineService.runPipeline({
        jobId,
        categories: [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.MUSIC_BLOG],
        genres: ['Afrobeats'],
        countries: ['United Kingdom'],
        targetCount: 10,
    });
    const finalJob = job_tracker_1.JobTracker.getJob(jobId);
    console.log('\n============== DISCOVERY JOB SUMMARY ==============');
    console.log(`Status: ${finalJob?.status}`);
    console.log(`Total URLs Crawled/Processed: ${finalJob?.processedCount}`);
    console.log(`Total Leads Created in DB: ${finalJob?.leadsFoundCount}`);
    // Fetch the created leads from PostgreSQL database
    const createdLeads = await prisma_1.prisma.lead.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
            contactPoints: true,
            sources: true,
            tags: true,
        },
    });
    console.log('\n============== DISCOVERED LEADS IN DATABASE ==============');
    console.dir(createdLeads, { depth: null });
    await prisma_1.prisma.$disconnect();
}
main().catch((err) => {
    console.error('Fatal Discovery Test Error:', err);
    process.exit(1);
});
