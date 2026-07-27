import { UrlNormalizer } from '../../providers/search/url-normalizer';

export class CrawlPolicy {
  private static domainLastCrawlMap = new Map<string, number>();
  private static MIN_DOMAIN_INTERVAL_MS = 2000; // 2s rate-limit per domain

  static shouldCrawl(url: string): boolean {
    if (!UrlNormalizer.isCrawlableDomain(url)) {
      return false;
    }

    const domain = UrlNormalizer.getDomain(url);
    if (!domain) return false;

    const lastCrawl = this.domainLastCrawlMap.get(domain) || 0;
    const now = Date.now();

    if (now - lastCrawl < this.MIN_DOMAIN_INTERVAL_MS) {
      return false;
    }

    this.domainLastCrawlMap.set(domain, now);
    return true;
  }
}
