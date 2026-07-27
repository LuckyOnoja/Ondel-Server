"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiscoveryPipelineService = void 0;
const client_1 = require("@prisma/client");
const query_builder_1 = require("../../providers/search/query-builder");
const free_search_provider_1 = require("../../providers/search/free-search.provider");
const url_normalizer_1 = require("../../providers/search/url-normalizer");
const crawler_service_1 = require("../crawling/crawler.service");
const deepseek_gemini_provider_1 = require("../../providers/ai/deepseek-gemini.provider");
const verification_service_1 = require("../verification/verification.service");
const lead_repository_1 = require("../leads/lead.repository");
const job_tracker_1 = require("./job-tracker");
class DiscoveryPipelineService {
    static searchProvider = new free_search_provider_1.FreeSearchProvider();
    static aiProvider = new deepseek_gemini_provider_1.DeepSeekGeminiAIProvider();
    static async runPipeline(options) {
        const { jobId, categories, genres, countries, targetCount } = options;
        job_tracker_1.JobTracker.updateProgress(jobId, { status: 'RUNNING' });
        try {
            // 1. Generate search queries
            const queries = query_builder_1.QueryBuilder.generateQueries({ categories, genres, countries });
            console.log(`[DiscoveryPipeline] Job ${jobId}: Generated ${queries.length} search queries.`);
            const discoveredUrls = new Set();
            let leadsFound = 0;
            for (const query of queries) {
                if (leadsFound >= targetCount)
                    break;
                console.log(`[DiscoveryPipeline] Query: "${query}" -> Fetching search results...`);
                const searchResults = await this.searchProvider.search(query, { limit: 10 });
                console.log(`[DiscoveryPipeline] Found ${searchResults.length} search result URLs.`);
                for (const res of searchResults) {
                    if (leadsFound >= targetCount)
                        break;
                    const canonicalUrl = url_normalizer_1.UrlNormalizer.canonicalize(res.url);
                    if (!canonicalUrl || discoveredUrls.has(canonicalUrl))
                        continue;
                    discoveredUrls.add(canonicalUrl);
                    console.log(`[DiscoveryPipeline] Crawling URL (${discoveredUrls.size}): ${canonicalUrl}`);
                    // 2. Crawl public page & subpages
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
                    console.log(`[DiscoveryPipeline] Extracted ${crawlData.contacts.length} contact points from ${canonicalUrl}. Running AI enrichment...`);
                    // 3. AI Enrichment (DeepSeek + Gemini fallback)
                    const primaryGenre = genres[0] || 'Music';
                    const aiResult = await this.aiProvider.enrichLeadContent(crawlData.title, crawlData.text, primaryGenre);
                    const finalCategory = aiResult?.category || categories[0] || client_1.LeadCategory.PLAYLIST_CURATOR;
                    const leadName = aiResult?.name || crawlData.title;
                    const orgName = aiResult?.organization || res.domain;
                    const allGenres = [...new Set([...genres, ...(aiResult?.genres || [])])];
                    // 4. Verify contact emails
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
                    // 5. Store lead with deduplicated contact points
                    try {
                        const lead = await lead_repository_1.LeadRepository.create({
                            name: leadName,
                            organization: orgName,
                            category: finalCategory,
                            country: countries?.[0],
                            genres: allGenres,
                            acceptsSubmissions: aiResult?.acceptsSubmissions ?? true,
                            status: client_1.LeadStatus.VERIFIED,
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
                        job_tracker_1.JobTracker.updateProgress(jobId, {
                            processedCount: discoveredUrls.size,
                            leadsFoundCount: leadsFound,
                        });
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
                        // Safe fallback if contact unique constraint hit (existing lead)
                        console.log(`[DiscoveryPipeline] Contact already exists or duplicate:`, dbErr.message);
                    }
                }
            }
            job_tracker_1.JobTracker.updateProgress(jobId, { status: 'COMPLETED' });
            console.log(`[DiscoveryPipeline] Job ${jobId} finished. Found ${leadsFound} leads.`);
        }
        catch (error) {
            console.error(`[DiscoveryPipeline] Job ${jobId} failed:`, error.message);
            job_tracker_1.JobTracker.updateProgress(jobId, { status: 'FAILED', error: error.message });
        }
    }
}
exports.DiscoveryPipelineService = DiscoveryPipelineService;
