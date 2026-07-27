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
exports.FreeSearchProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const dns_1 = __importDefault(require("dns"));
const util_1 = require("util");
const url_normalizer_1 = require("./url-normalizer");
const env_1 = require("../../config/env");
const lookupDns = (0, util_1.promisify)(dns_1.default.lookup);
class FreeSearchProvider {
    name = 'FreeSearchProvider';
    static USER_AGENTS = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];
    getRandomUserAgent() {
        return FreeSearchProvider.USER_AGENTS[Math.floor(Math.random() * FreeSearchProvider.USER_AGENTS.length)];
    }
    async search(query, options) {
        const limit = options?.limit || 10;
        // 1. Try AI-assisted discovery of REAL websites
        let results = await this.searchWithAI(query, limit);
        // 2. Fallback to Bing HTML Search
        if (results.length === 0) {
            results = await this.searchBingHTML(query, limit);
        }
        return results;
    }
    async searchWithAI(query, limit) {
        const results = [];
        const prompt = `You are a real-world music industry intelligence discovery bot. Return a list of ${limit} REAL, FAMOUS, CURRENTLY ACTIVE public websites, music blogs, radio stations, playlist platforms, or record labels relevant to: "${query}".
Examples of real music sites: "grmdaily.com", "notjustok.com", "linkuptv.com", "mixtapemadness.com", "submithub.com", "groover.co", "capitalxtra.com", "nativemag.com", "jaguda.com", "soundcity.tv".

Do NOT invent fake domain names. Only return real, registered website submission/contact URLs.

Return a valid JSON object matching EXACTLY this structure:
{
  "results": [
    {
      "title": "Real Website Title",
      "url": "https://realdomain.com/contact",
      "snippet": "Description"
    }
  ]
}`;
        // Call DeepSeek / Gemini AI
        let rawContent = '';
        if (env_1.env.DEEPSEEK_API_KEY) {
            try {
                const response = await axios_1.default.post('https://api.deepseek.com/v1/chat/completions', {
                    model: 'deepseek-chat',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                    temperature: 0.1,
                }, {
                    headers: {
                        Authorization: `Bearer ${env_1.env.DEEPSEEK_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 10000,
                });
                rawContent = response.data?.choices?.[0]?.message?.content || '';
            }
            catch (err) {
                console.warn('[FreeSearchProvider AI DeepSeek] Error:', err.message);
            }
        }
        if (!rawContent && env_1.env.GEMINI_API_KEY) {
            try {
                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env_1.env.GEMINI_API_KEY}`;
                const response = await axios_1.default.post(geminiUrl, {
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json' },
                }, { timeout: 10000 });
                rawContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            }
            catch (err) {
                console.warn('[FreeSearchProvider AI Gemini] Error:', err.message);
            }
        }
        if (rawContent) {
            try {
                const parsed = JSON.parse(rawContent);
                if (Array.isArray(parsed.results)) {
                    for (const item of parsed.results) {
                        const canonical = url_normalizer_1.UrlNormalizer.canonicalize(item.url);
                        if (canonical && url_normalizer_1.UrlNormalizer.isCrawlableDomain(canonical)) {
                            const domain = url_normalizer_1.UrlNormalizer.getDomain(canonical);
                            if (domain && (await this.domainExists(domain))) {
                                results.push({
                                    title: item.title || domain,
                                    url: canonical,
                                    snippet: item.snippet || '',
                                    domain,
                                });
                            }
                        }
                    }
                }
            }
            catch (parseErr) {
                console.warn('[FreeSearchProvider JSON Parse Error]');
            }
        }
        return results;
    }
    async domainExists(domain) {
        try {
            await lookupDns(domain);
            return true;
        }
        catch {
            return false;
        }
    }
    async searchBingHTML(query, limit) {
        const results = [];
        try {
            const response = await axios_1.default.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout: 8000,
            });
            const $ = cheerio.load(response.data);
            $('.b_algo').each((_, element) => {
                if (results.length >= limit)
                    return;
                const titleEl = $(element).find('h2 a');
                const snippetEl = $(element).find('.b_caption p');
                const title = titleEl.text().trim();
                const rawUrl = titleEl.attr('href');
                const snippet = snippetEl.text().trim();
                if (title && rawUrl) {
                    const canonical = url_normalizer_1.UrlNormalizer.canonicalize(rawUrl);
                    if (canonical && url_normalizer_1.UrlNormalizer.isCrawlableDomain(canonical)) {
                        results.push({
                            title,
                            url: canonical,
                            snippet,
                            domain: url_normalizer_1.UrlNormalizer.getDomain(canonical) || undefined,
                        });
                    }
                }
            });
        }
        catch (error) {
            console.warn(`[FreeSearchProvider Bing] Error:`, error.message);
        }
        return results;
    }
}
exports.FreeSearchProvider = FreeSearchProvider;
