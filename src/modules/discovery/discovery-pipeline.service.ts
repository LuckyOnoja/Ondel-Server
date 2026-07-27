import { LeadCategory, LeadStatus, ContactPointType } from '@prisma/client';
import { QueryBuilder } from '../../providers/search/query-builder';
import { FreeSearchProvider } from '../../providers/search/free-search.provider';
import { UrlNormalizer } from '../../providers/search/url-normalizer';
import { CrawlerService } from '../crawling/crawler.service';
import { DeepSeekGeminiAIProvider } from '../../providers/ai/deepseek-gemini.provider';
import { VerificationService } from '../verification/verification.service';
import { LeadRepository } from '../leads/lead.repository';
import { JobTracker } from './job-tracker';
import { prisma } from '../../config/prisma';

export interface DiscoveryOptions {
  jobId: string;
  categories: LeadCategory[];
  genres: string[];
  countries?: string[];
  targetCount: number;
}

export class DiscoveryPipelineService {
  private static searchProvider = new FreeSearchProvider();
  private static aiProvider = new DeepSeekGeminiAIProvider();

  static async runPipeline(options: DiscoveryOptions): Promise<void> {
    const { jobId, categories, genres, countries, targetCount } = options;
    JobTracker.updateProgress(jobId, { status: 'RUNNING' });

    try {
      // 1. Generate search queries
      const queries = QueryBuilder.generateQueries({ categories, genres, countries });
      console.log(`[DiscoveryPipeline] Job ${jobId}: Generated ${queries.length} search queries.`);

      const discoveredUrls = new Set<string>();
      let leadsFound = 0;

      for (const query of queries) {
        if (leadsFound >= targetCount) break;

        console.log(`[DiscoveryPipeline] Query: "${query}" -> Fetching search results...`);
        const searchResults = await this.searchProvider.search(query, { limit: 10 });
        console.log(`[DiscoveryPipeline] Found ${searchResults.length} search result URLs.`);

        for (const res of searchResults) {
          if (leadsFound >= targetCount) break;

          const canonicalUrl = UrlNormalizer.canonicalize(res.url);
          if (!canonicalUrl || discoveredUrls.has(canonicalUrl)) continue;
          discoveredUrls.add(canonicalUrl);

          console.log(`[DiscoveryPipeline] Crawling URL (${discoveredUrls.size}): ${canonicalUrl}`);
          // 2. Crawl public page & subpages
          const crawlData = await CrawlerService.crawlPage(canonicalUrl);
          if (!crawlData) {
            console.log(`[DiscoveryPipeline] Could not crawl ${canonicalUrl}`);
            continue;
          }

          if (crawlData.contacts.length === 0) {
            crawlData.contacts.push({
              type: ContactPointType.WEBSITE,
              value: canonicalUrl,
              isPublic: true,
            });
          }

          console.log(`[DiscoveryPipeline] Extracted ${crawlData.contacts.length} contact points from ${canonicalUrl}. Running AI enrichment...`);

          // 3. AI Enrichment (DeepSeek + Gemini fallback)
          const primaryGenre = genres[0] || 'Music';
          const aiResult = await this.aiProvider.enrichLeadContent(crawlData.title, crawlData.text, primaryGenre);

          const finalCategory = aiResult?.category || categories[0] || LeadCategory.PLAYLIST_CURATOR;
          const leadName = aiResult?.name || crawlData.title;
          const orgName = aiResult?.organization || res.domain;
          const allGenres = [...new Set([...genres, ...(aiResult?.genres || [])])];

          // 4. Verify contact emails
          const verifiedContactPoints = [];
          for (const cp of crawlData.contacts) {
            let isVerified = false;
            let verificationDetails = null;

            if (cp.type === ContactPointType.EMAIL) {
              const vRes = await VerificationService.verifyEmail(cp.value);
              isVerified = vRes.isVerified;
              verificationDetails = vRes;
            }

            verifiedContactPoints.push({
              type: cp.type,
              value: cp.value,
              isPublic: cp.isPublic,
              isVerified,
              verification: verificationDetails,
            });
          }

          // 5. Store lead with deduplicated contact points
          try {
            const lead = await LeadRepository.create({
              name: leadName,
              organization: orgName,
              category: finalCategory,
              country: countries?.[0],
              genres: allGenres,
              acceptsSubmissions: aiResult?.acceptsSubmissions ?? true,
              status: LeadStatus.VERIFIED,
              sourceUrl: canonicalUrl,
              sourceType: 'WEB_SEARCH',
              metadata: {
                aiEvidence: aiResult?.evidence || [],
                confidence: aiResult?.confidence || 0.8,
                discoveredByQuery: query,
              },
              contactPoints: verifiedContactPoints,
              tags: [primaryGenre.toLowerCase(), finalCategory.toLowerCase()],
            });

            leadsFound++;
            JobTracker.updateProgress(jobId, {
              processedCount: discoveredUrls.size,
              leadsFoundCount: leadsFound,
            });

            const currentJob = JobTracker.getJob(jobId);
            if (currentJob) {
              currentJob.discoveredLeads.push({
                id: lead.id,
                name: lead.name || undefined,
                organization: lead.organization || undefined,
                category: lead.category,
                contactsCount: lead.contactPoints.length,
              });
            }
          } catch (dbErr: any) {
            // Safe fallback if contact unique constraint hit (existing lead)
            console.log(`[DiscoveryPipeline] Contact already exists or duplicate:`, dbErr.message);
          }
        }
      }

      JobTracker.updateProgress(jobId, { status: 'COMPLETED' });
      console.log(`[DiscoveryPipeline] Job ${jobId} finished. Found ${leadsFound} leads.`);
    } catch (error: any) {
      console.error(`[DiscoveryPipeline] Job ${jobId} failed:`, error.message);
      JobTracker.updateProgress(jobId, { status: 'FAILED', error: error.message });
    }
  }
}
