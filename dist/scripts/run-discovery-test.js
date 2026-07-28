"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discovery_pipeline_service_1 = require("../modules/discovery/discovery-pipeline.service");
const job_tracker_1 = require("../modules/discovery/job-tracker");
const client_1 = require("@prisma/client");
const prisma_1 = require("../config/prisma");
async function main() {
    const targetCount = parseInt(process.env.TARGET_COUNT || '10', 10);
    const jobId = `job_${Date.now()}`;
    const similarArtists = process.env.SIMILAR_ARTISTS
        ? process.env.SIMILAR_ARTISTS.split(',').map((s) => s.trim())
        : undefined;
    const soundVibe = process.env.SOUND_VIBE || undefined;
    const country = process.env.COUNTRY || 'Nigeria';
    console.log(`============== STARTING CONTINUOUS DISCOVERY ENGINE (Target: ${targetCount} Leads) ==============`);
    console.log(`[Target Profile] Country: ${country} | Genre: Afrobeats | Similar Artists: ${similarArtists ? similarArtists.join(', ') : 'Random/General Discovery'} | Vibe: ${soundVibe || 'General'}`);
    job_tracker_1.JobTracker.createJob(jobId, {
        categories: [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.RADIO_DJ, client_1.LeadCategory.MUSIC_BLOG],
        genres: ['Afrobeats'],
        countries: [country],
        targetCount,
    });
    console.log(`[Test Script] Initialized Discovery Job ID: ${jobId}`);
    await discovery_pipeline_service_1.DiscoveryPipelineService.runPipeline({
        jobId,
        categories: [client_1.LeadCategory.PLAYLIST_CURATOR, client_1.LeadCategory.RADIO_DJ, client_1.LeadCategory.MUSIC_BLOG],
        genres: ['Afrobeats'],
        similarArtists,
        soundVibe,
        countries: [country],
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
    console.log('\n============== DISCOVERED LEADS IN DATABASE ==============');
    console.dir(createdLeads, { depth: null });
    await prisma_1.prisma.$disconnect();
}
main().catch((err) => {
    console.error('Fatal Discovery Error:', err);
    process.exit(1);
});
