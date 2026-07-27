"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discovery_pipeline_service_1 = require("../modules/discovery/discovery-pipeline.service");
const job_tracker_1 = require("../modules/discovery/job-tracker");
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
async function main() {
    console.log('============== STARTING CONTINUOUS AI KEYWORD LEAD DISCOVERY (Target: 10 Leads) ==============');
    const targetCount = parseInt(process.env.TARGET_COUNT || '10', 10);
    const jobId = `job_${Date.now()}`;
    job_tracker_1.JobTracker.createJob(jobId, {
        categories: [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.RADIO_DJ, client_1.LeadCategory.MUSIC_BLOG],
        genres: ['Afrobeats'],
        countries: ['Nigeria'],
        targetCount,
    });
    console.log(`[Test Script] Initialized Continuous Job ID: ${jobId}`);
    await discovery_pipeline_service_1.DiscoveryPipelineService.runPipeline({
        jobId,
        categories: [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.RADIO_DJ, client_1.LeadCategory.MUSIC_BLOG],
        genres: ['Afrobeats'],
        countries: ['Nigeria'],
        targetCount,
    });
    const finalJob = job_tracker_1.JobTracker.getJob(jobId);
    console.log('\n============== CONTINUOUS DISCOVERY SUMMARY ==============');
    console.log(`Status: ${finalJob?.status}`);
    console.log(`Total Candidate URLs Crawled: ${finalJob?.processedCount}`);
    console.log(`Total Leads Created & Saved to Render PostgreSQL: ${finalJob?.leadsFoundCount}`);
    // Fetch the created leads from PostgreSQL database
    const createdLeads = await prisma_1.prisma.lead.findMany({
        take: targetCount,
        orderBy: { createdAt: 'desc' },
        include: {
            contactPoints: true,
            tags: true,
        },
    });
    console.log('\n============== DISCOVERED NIGERIAN LEADS IN DATABASE ==============');
    console.dir(createdLeads, { depth: null });
    await prisma_1.prisma.$disconnect();
}
main().catch((err) => {
    console.error('Fatal Discovery Error:', err);
    process.exit(1);
});
