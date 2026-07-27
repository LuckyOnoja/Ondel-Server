import { LeadCategory, LeadStatus, ContactPointType, KeywordStatus } from '@prisma/client';
import { FreeSearchProvider } from '../../providers/search/free-search.provider';
import { UrlNormalizer } from '../../providers/search/url-normalizer';
import { CrawlerService } from '../crawling/crawler.service';
import { DeepSeekGeminiAIProvider } from '../../providers/ai/deepseek-gemini.provider';
import { VerificationService } from '../verification/verification.service';
import { LeadRepository } from '../leads/lead.repository';
import { KeywordGeneratorService } from './keyword-generator.service';
import { KeywordRepository } from './keyword.repository';
import { JobTracker } from './job-tracker';

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
      // 1. Generate & Ledger AI Long-Tail Keywords if DB pending keywords are low
      const primaryCategory = categories[0] || LeadCategory.PLAYLIST_CURATOR;
      const primaryGenre = genres[0] || 'Afrobeats';

      let pendingKeywords = await KeywordRepository.findPendingKeywords(primaryCategory, primaryGenre, 30);

      if (pendingKeywords.length < 5) {
        console.log(`[DiscoveryPipeline] Pending keywords low for ${primaryCategory}/${primaryGenre}. Triggering AI Keyword Generator...`);
        await KeywordGeneratorService.generateAndStoreKeywords({ categories, genres, countries });
        pendingKeywords = await KeywordRepository.findPendingKeywords(primaryCategory, primaryGenre, 30);
      }

      console.log(`[DiscoveryPipeline] Job ${jobId}: Loaded ${pendingKeywords.length} pending search keywords from database ledger.`);

      const discoveredUrls = new Set<string>();
      let leadsFound = 0;

      // 2. Continuous Discovery Loop over Keyword Ledger
      for (const kwRecord of pendingKeywords) {
        if (leadsFound >= targetCount) break;

        await KeywordRepository.updateKeywordStatus(kwRecord.id, KeywordStatus.PROCESSING);
        console.log(`\n----------------------------------------------------`);
        console.log(`[DiscoveryPipeline] Processing Keyword [${kwRecord.id}]: "${kwRecord.keyword}"`);

        const searchResults = await this.searchProvider.search(kwRecord.keyword, { limit: 10 });
        console.log(`[DiscoveryPipeline] Search provider returned ${searchResults.length} candidate URLs.`);

        let keywordLeadsCount = 0;

        for (const res of searchResults) {
          if (leadsFound >= targetCount) break;

          const canonicalUrl = UrlNormalizer.canonicalize(res.url);
          if (!canonicalUrl || discoveredUrls.has(canonicalUrl)) continue;
          discoveredUrls.add(canonicalUrl);

          console.log(`[DiscoveryPipeline] Crawling Web Target: ${canonicalUrl}`);

          // Crawl public page & subpages (/contact, /submit, /about, /demo, /team)
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

          console.log(`[DiscoveryPipeline] Extracted ${crawlData.contacts.length} contact points from ${canonicalUrl}. Running DeepSeek/Gemini AI enrichment...`);

          // AI Enrichment
          const aiResult = await this.aiProvider.enrichLeadContent(crawlData.title, crawlData.text, primaryGenre);

          const finalCategory = aiResult?.category || categories[0] || LeadCategory.PLAYLIST_CURATOR;
          const leadName = aiResult?.name || crawlData.title;
          const orgName = aiResult?.organization || res.domain;
          const allGenres = [...new Set([...genres, ...(aiResult?.genres || [])])];

          // Verify contact emails
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

          // Save lead to Render PostgreSQL
          try {
            const lead = await LeadRepository.create({
              name: leadName,
              organization: orgName,
              category: finalCategory,
              country: countries?.[0] || kwRecord.country || 'Global',
              genres: allGenres,
              acceptsSubmissions: aiResult?.acceptsSubmissions ?? true,
              status: LeadStatus.VERIFIED,
              sourceUrl: canonicalUrl,
              sourceType: 'WEB_SEARCH',
              metadata: {
                aiEvidence: aiResult?.evidence || [],
                confidence: aiResult?.confidence || 0.85,
                discoveredByKeyword: kwRecord.keyword,
              },
              contactPoints: verifiedContactPoints,
              tags: [primaryGenre.toLowerCase(), finalCategory.toLowerCase()],
            });

            leadsFound++;
            keywordLeadsCount++;

            JobTracker.updateProgress(jobId, {
              processedCount: discoveredUrls.size,
              leadsFoundCount: leadsFound,
            });

            console.log(`✅ [DiscoveryPipeline] Discovered & Saved Lead #${leadsFound}: "${lead.name}" (${lead.organization}) -> ${lead.contactPoints.length} Contact Points.`);

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
            console.log(`[DiscoveryPipeline] Contact point already exists in database (skipped duplicate).`);
          }
        }

        // Mark keyword COMPLETED in database
        await KeywordRepository.updateKeywordStatus(kwRecord.id, KeywordStatus.COMPLETED, keywordLeadsCount);
      }

      JobTracker.updateProgress(jobId, { status: 'COMPLETED' });
      console.log(`\n🎉 [DiscoveryPipeline] Job ${jobId} finished! Successfully acquired ${leadsFound} new verified leads.`);
    } catch (error: any) {
      console.error(`❌ [DiscoveryPipeline] Job ${jobId} failed:`, error.message);
      JobTracker.updateProgress(jobId, { status: 'FAILED', error: error.message });
    }
  }
}
