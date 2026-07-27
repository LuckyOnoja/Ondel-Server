"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryPipelineService = void 0;
const client_1 = require("@prisma/client");
const free_search_provider_1 = require("../../providers/search/free-search.provider");
const url_normalizer_1 = require("../../providers/search/url-normalizer");
const crawler_service_1 = require("../crawling/crawler.service");
const deepseek_gemini_provider_1 = require("../../providers/ai/deepseek-gemini.provider");
const verification_service_1 = require("../verification/verification.service");
const lead_repository_1 = require("../leads/lead.repository");
const keyword_generator_service_1 = require("./keyword-generator.service");
const keyword_repository_1 = require("./keyword.repository");
const job_tracker_1 = require("./job-tracker");
class DiscoveryPipelineService {
    static searchProvider = new free_search_provider_1.FreeSearchProvider();
    static aiProvider = new deepseek_gemini_provider_1.DeepSeekGeminiAIProvider();
    static async runPipeline(options) {
        const { jobId, categories, genres, countries, targetCount } = options;
        job_tracker_1.JobTracker.updateProgress(jobId, { status: 'RUNNING' });
        try {
            // 1. Generate & Ledger AI Long-Tail Keywords if DB pending keywords are low
            const primaryCategory = categories[0] || client_1.LeadCategory.PLAYLIST_CURATOR;
            const primaryGenre = genres[0] || 'Afrobeats';
            let pendingKeywords = await keyword_repository_1.KeywordRepository.findPendingKeywords(primaryCategory, primaryGenre, 30);
            if (pendingKeywords.length < 5) {
                console.log(`[DiscoveryPipeline] Pending keywords low for ${primaryCategory}/${primaryGenre}. Triggering AI Keyword Generator...`);
                await keyword_generator_service_1.KeywordGeneratorService.generateAndStoreKeywords({ categories, genres, countries });
                pendingKeywords = await keyword_repository_1.KeywordRepository.findPendingKeywords(primaryCategory, primaryGenre, 30);
            }
            console.log(`[DiscoveryPipeline] Job ${jobId}: Loaded ${pendingKeywords.length} pending search keywords from database ledger.`);
            const discoveredUrls = new Set();
            let leadsFound = 0;
            // 2. Continuous Discovery Loop over Keyword Ledger
            for (const kwRecord of pendingKeywords) {
                if (leadsFound >= targetCount)
                    break;
                await keyword_repository_1.KeywordRepository.updateKeywordStatus(kwRecord.id, client_1.KeywordStatus.PROCESSING);
                console.log(`\n----------------------------------------------------`);
                console.log(`[DiscoveryPipeline] Processing Keyword [${kwRecord.id}]: "${kwRecord.keyword}"`);
                const searchResults = await this.searchProvider.search(kwRecord.keyword, { limit: 10 });
                console.log(`[DiscoveryPipeline] Search provider returned ${searchResults.length} candidate URLs.`);
                let keywordLeadsCount = 0;
                for (const res of searchResults) {
                    if (leadsFound >= targetCount)
                        break;
                    const canonicalUrl = url_normalizer_1.UrlNormalizer.canonicalize(res.url);
                    if (!canonicalUrl || discoveredUrls.has(canonicalUrl))
                        continue;
                    discoveredUrls.add(canonicalUrl);
                    console.log(`[DiscoveryPipeline] Crawling Web Target: ${canonicalUrl}`);
                    // Crawl public page & subpages (/contact, /submit, /about, /demo, /team)
                    const crawlData = await crawler_service_1.CrawlerService.crawlPage(canonicalUrl);
                    if (!crawlData) {
                        console.log(`[DiscoveryPipeline] Could not crawl ${canonicalUrl}`);
                        continue;
                    }
                    if (crawlData.contacts.length === 0) {
                        crawlData.contacts.push({
                            type: client_1.ContactPointType.WEBSITE,
                            value: canonicalUrl,
                            isPublic: true,
                        });
                    }
                    console.log(`[DiscoveryPipeline] Extracted ${crawlData.contacts.length} contact points from ${canonicalUrl}. Running DeepSeek/Gemini AI enrichment...`);
                    // AI Enrichment
                    const aiResult = await this.aiProvider.enrichLeadContent(crawlData.title, crawlData.text, primaryGenre);
                    const finalCategory = aiResult?.category || categories[0] || client_1.LeadCategory.PLAYLIST_CURATOR;
                    const leadName = aiResult?.name || crawlData.title;
                    const orgName = aiResult?.organization || res.domain;
                    const allGenres = [...new Set([...genres, ...(aiResult?.genres || [])])];
                    // Verify contact emails
                    const verifiedContactPoints = [];
                    for (const cp of crawlData.contacts) {
                        let isVerified = false;
                        let verificationDetails = null;
                        if (cp.type === client_1.ContactPointType.EMAIL) {
                            const vRes = await verification_service_1.VerificationService.verifyEmail(cp.value);
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
                        const lead = await lead_repository_1.LeadRepository.create({
                            name: leadName,
                            organization: orgName,
                            category: finalCategory,
                            country: countries?.[0] || kwRecord.country || 'Global',
                            genres: allGenres,
                            acceptsSubmissions: aiResult?.acceptsSubmissions ?? true,
                            status: client_1.LeadStatus.VERIFIED,
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
                        job_tracker_1.JobTracker.updateProgress(jobId, {
                            processedCount: discoveredUrls.size,
                            leadsFoundCount: leadsFound,
                        });
                        console.log(`✅ [DiscoveryPipeline] Discovered & Saved Lead #${leadsFound}: "${lead.name}" (${lead.organization}) -> ${lead.contactPoints.length} Contact Points.`);
                        const currentJob = job_tracker_1.JobTracker.getJob(jobId);
                        if (currentJob) {
                            currentJob.discoveredLeads.push({
                                id: lead.id,
                                name: lead.name || undefined,
                                organization: lead.organization || undefined,
                                category: lead.category,
                                contactsCount: lead.contactPoints.length,
                            });
                        }
                    }
                    catch (dbErr) {
                        console.log(`[DiscoveryPipeline] Contact point already exists in database (skipped duplicate).`);
                    }
                }
                // Mark keyword COMPLETED in database
                await keyword_repository_1.KeywordRepository.updateKeywordStatus(kwRecord.id, client_1.KeywordStatus.COMPLETED, keywordLeadsCount);
            }
            job_tracker_1.JobTracker.updateProgress(jobId, { status: 'COMPLETED' });
            console.log(`\n🎉 [DiscoveryPipeline] Job ${jobId} finished! Successfully acquired ${leadsFound} new verified leads.`);
        }
        catch (error) {
            console.error(`❌ [DiscoveryPipeline] Job ${jobId} failed:`, error.message);
            job_tracker_1.JobTracker.updateProgress(jobId, { status: 'FAILED', error: error.message });
        }
    }
}
exports.DiscoveryPipelineService = DiscoveryPipelineService;
