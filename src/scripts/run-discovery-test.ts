import { DiscoveryPipelineService } from '../modules/discovery/discovery-pipeline.service';
import { JobTracker } from '../modules/discovery/job-tracker';
import { LeadCategory } from '@prisma/client';
import { prisma } from '../config/prisma';

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

  JobTracker.createJob(jobId, {
    categories: [LeadCategory.PLAYLIST_CURATOR, LeadCategory.RADIO_DJ, LeadCategory.MUSIC_BLOG],
    genres: ['Afrobeats'],
    countries: [country],
    targetCount,
  });

  console.log(`[Test Script] Initialized Discovery Job ID: ${jobId}`);

  await DiscoveryPipelineService.runPipeline({
    jobId,
    categories: [LeadCategory.PLAYLIST_CURATOR, LeadCategory.RADIO_DJ, LeadCategory.MUSIC_BLOG],
    genres: ['Afrobeats'],
    similarArtists,
    soundVibe,
    countries: [country],
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

  console.log('\n============== DISCOVERED LEADS IN DATABASE ==============');
  console.dir(createdLeads, { depth: null });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal Discovery Error:', err);
  process.exit(1);
});
