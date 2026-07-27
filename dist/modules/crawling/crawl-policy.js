"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlPolicy = void 0;
const url_normalizer_1 = require("../../providers/search/url-normalizer");
class CrawlPolicy {
    static domainLastCrawlMap = new Map();
    static MIN_DOMAIN_INTERVAL_MS = 2000; // 2s rate-limit per domain
    static shouldCrawl(url) {
        if (!url_normalizer_1.UrlNormalizer.isCrawlableDomain(url)) {
            return false;
        }
        const domain = url_normalizer_1.UrlNormalizer.getDomain(url);
        if (!domain)
            return false;
        const lastCrawl = this.domainLastCrawlMap.get(domain) || 0;
        const now = Date.now();
        if (now - lastCrawl < this.MIN_DOMAIN_INTERVAL_MS) {
            return false;
        }
        this.domainLastCrawlMap.set(domain, now);
        return true;
    }
}
exports.CrawlPolicy = CrawlPolicy;
