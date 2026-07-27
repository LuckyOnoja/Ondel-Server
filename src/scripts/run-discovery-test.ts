import { DiscoveryPipelineService } from '../modules/discovery/discovery-pipeline.service';
import { JobTracker } from '../modules/discovery/job-tracker';
import { LeadCategory } from '@prisma/client';
import { prisma } from '../config/prisma';

async function main() {
  console.log('============== STARTING LIVE LEAD DISCOVERY TEST (Target: 10 Leads) ==============');

  const jobId = `test_job_${Date.now()}`;
  JobTracker.createJob(jobId, {
    categories: [LeadCategory.PLAYLIST_CURATOR, LeadCategory.MUSIC_BLOG],
    genres: ['Afrobeats'],
    countries: ['United Kingdom'],
    targetCount: 10,
  });

  console.log(`[Test Script] Initialized Discovery Job ID: ${jobId}`);

  await DiscoveryPipelineService.runPipeline({
    jobId,
    categories: [LeadCategory.PLAYLIST_CURATOR, LeadCategory.MUSIC_BLOG],
    genres: ['Afrobeats'],
    countries: ['United Kingdom'],
    targetCount: 10,
  });

  const finalJob = JobTracker.getJob(jobId);
  console.log('\n============== DISCOVERY JOB SUMMARY ==============');
  console.log(`Status: ${finalJob?.status}`);
  console.log(`Total URLs Crawled/Processed: ${finalJob?.processedCount}`);
  console.log(`Total Leads Created in DB: ${finalJob?.leadsFoundCount}`);

  // Fetch the created leads from PostgreSQL database
  const createdLeads = await prisma.lead.findMany({
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

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal Discovery Test Error:', err);
  process.exit(1);
});
