import { DiscoveryPipelineService } from '../modules/discovery/discovery-pipeline.service';
import { JobTracker } from '../modules/discovery/job-tracker';
import { LeadCategory } from '@prisma/client';
import { prisma } from '../config/prisma';

async function main() {
  console.log('============== STARTING CONTINUOUS AI KEYWORD LEAD DISCOVERY (Target: 10 Leads) ==============');

  const targetCount = parseInt(process.env.TARGET_COUNT || '10', 10);
  const jobId = `job_${Date.now()}`;

  JobTracker.createJob(jobId, {
    categories: [LeadCategory.PLAYLIST_CURATOR, LeadCategory.RADIO_DJ, LeadCategory.MUSIC_BLOG],
    genres: ['Afrobeats'],
    countries: ['Nigeria'],
    targetCount,
  });

  console.log(`[Test Script] Initialized Continuous Job ID: ${jobId}`);

  await DiscoveryPipelineService.runPipeline({
    jobId,
    categories: [LeadCategory.PLAYLIST_CURATOR, LeadCategory.RADIO_DJ, LeadCategory.MUSIC_BLOG],
    genres: ['Afrobeats'],
    countries: ['Nigeria'],
    targetCount,
  });

  const finalJob = JobTracker.getJob(jobId);
  console.log('\n============== CONTINUOUS DISCOVERY SUMMARY ==============');
  console.log(`Status: ${finalJob?.status}`);
  console.log(`Total Candidate URLs Crawled: ${finalJob?.processedCount}`);
  console.log(`Total Leads Created & Saved to Render PostgreSQL: ${finalJob?.leadsFoundCount}`);

  // Fetch the created leads from PostgreSQL database
  const createdLeads = await prisma.lead.findMany({
    take: targetCount,
    orderBy: { createdAt: 'desc' },
    include: {
      contactPoints: true,
      tags: true,
    },
  });

  console.log('\n============== DISCOVERED NIGERIAN LEADS IN DATABASE ==============');
  console.dir(createdLeads, { depth: null });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal Discovery Error:', err);
  process.exit(1);
});
