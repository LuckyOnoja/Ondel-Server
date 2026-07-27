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
const url_normalizer_1 = require("./url-normalizer");
class FreeSearchProvider {
    name = 'FreeSearchProvider';
    async search(query, options) {
        const results = [];
        const limit = options?.limit || 10;
        try {
            // Use DuckDuckGo HTML endpoint for free, keyless web search
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await axios_1.default.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data);
            $('.result').each((_, element) => {
                if (results.length >= limit)
                    return;
                const titleEl = $(element).find('.result__title a');
                const snippetEl = $(element).find('.result__snippet');
                const title = titleEl.text().trim();
                const rawUrl = titleEl.attr('href');
                const snippet = snippetEl.text().trim();
                if (title && rawUrl) {
                    // DuckDuckGo redirects wrapped in /l/?uddg=...
                    let finalUrl = rawUrl;
                    if (rawUrl.includes('uddg=')) {
                        const match = rawUrl.match(/uddg=([^&]+)/);
                        if (match && match[1]) {
                            finalUrl = decodeURIComponent(match[1]);
                        }
                    }
                    const canonical = url_normalizer_1.UrlNormalizer.canonicalize(finalUrl);
                    if (canonical && url_normalizer_1.UrlNormalizer.isCrawlableDomain(canonical)) {
                        const domain = url_normalizer_1.UrlNormalizer.getDomain(canonical) || undefined;
                        results.push({
                            title,
                            url: canonical,
                            snippet,
                            domain,
                        });
                    }
                }
            });
        }
        catch (error) {
            console.warn(`[FreeSearchProvider] Search failed for query "${query}":`, error.message);
        }
        return results;
    }
}
exports.FreeSearchProvider = FreeSearchProvider;
