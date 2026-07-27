"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const crawl_policy_1 = require("./crawl-policy");
const contact_extractor_1 = require("./contact-extractor");
const url_normalizer_1 = require("../../providers/search/url-normalizer");
class CrawlerService {
    static USER_AGENT = 'MusicLeadDiscoveryBot/1.0 (+https://ondel.io)';
    static async crawlPage(url, crawlSubpages = true) {
        if (!crawl_policy_1.CrawlPolicy.shouldCrawl(url)) {
            return null;
        }
        try {
            const response = await axios_1.default.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': this.USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
            });
            const contentType = String(response.headers['content-type'] || '');
            if (!contentType.includes('text/html')) {
                return null;
            }
            const $ = cheerio.load(response.data);
            const title = $('title').text().trim() || $('h1').first().text().trim();
            // Remove script/style tags for clean body text extraction
            $('script, style, noscript, svg, nav, footer').remove();
            const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
            // Extract all href links
            const links = [];
            $('a[href]').each((_, el) => {
                const href = $(el).attr('href');
                if (href) {
                    try {
                        const absoluteUrl = new URL(href, url).toString();
                        links.push(absoluteUrl);
                    }
                    catch {
                        // Invalid URL string ignored
                    }
                }
            });
            // Extract primary contacts from main page
            const contacts = contact_extractor_1.ContactExtractor.extractContacts(bodyText, url, links);
            const secondaryPagesCrawled = [];
            // Discover subpages (/contact, /submit, /about, /demo, /team)
            if (crawlSubpages) {
                const targetSubpagePatterns = ['/contact', '/submit', '/demo', '/about', '/team', '/submission'];
                const domain = url_normalizer_1.UrlNormalizer.getDomain(url);
                const subpageUrls = links.filter((link) => {
                    const linkDomain = url_normalizer_1.UrlNormalizer.getDomain(link);
                    if (linkDomain !== domain)
                        return false;
                    const lower = link.toLowerCase();
                    return targetSubpagePatterns.some((pattern) => lower.includes(pattern));
                });
                // Limit subpage crawl to top 3 relevant subpages
                const uniqueSubpages = [...new Set(subpageUrls)].slice(0, 3);
                for (const subUrl of uniqueSubpages) {
                    if (crawl_policy_1.CrawlPolicy.shouldCrawl(subUrl)) {
                        try {
                            const subRes = await axios_1.default.get(subUrl, {
                                timeout: 8000,
                                headers: { 'User-Agent': this.USER_AGENT },
                            });
                            const subContentType = String(subRes.headers['content-type'] || '');
                            if (subContentType.includes('text/html')) {
                                const $sub = cheerio.load(subRes.data);
                                $sub('script, style, noscript, svg, nav, footer').remove();
                                const subText = $sub('body').text().replace(/\s+/g, ' ').trim();
                                const subLinks = [];
                                $sub('a[href]').each((_, el) => {
                                    const href = $sub(el).attr('href');
                                    if (href) {
                                        try {
                                            subLinks.push(new URL(href, subUrl).toString());
                                        }
                                        catch { }
                                    }
                                });
                                const subContacts = contact_extractor_1.ContactExtractor.extractContacts(subText, subUrl, subLinks);
                                contacts.push(...subContacts);
                                secondaryPagesCrawled.push(subUrl);
                            }
                        }
                        catch {
                            // Subpage fetch error ignored safely
                        }
                    }
                }
            }
            // Deduplicate contact items by type and value
            const uniqueContactsMap = new Map();
            for (const c of contacts) {
                const key = `${c.type}:${c.value.toLowerCase()}`;
                if (!uniqueContactsMap.has(key)) {
                    uniqueContactsMap.set(key, c);
                }
            }
            return {
                url,
                title,
                text: bodyText.slice(0, 5000), // Keep first 5k characters for AI analysis
                contacts: Array.from(uniqueContactsMap.values()),
                secondaryPagesCrawled,
            };
        }
        catch (error) {
            console.warn(`[CrawlerService] Failed to crawl ${url}:`, error.message);
            return null;
        }
    }
}
exports.CrawlerService = CrawlerService;
