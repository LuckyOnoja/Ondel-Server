export class UrlNormalizer {
  private static BLOCKED_DOMAINS = new Set([
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'google.com',
    'bing.com',
    'wikipedia.org',
    'amazon.com',
    'apple.com',
  ]);

  static canonicalize(rawUrl: string): string | null {
    try {
      let parsed = new URL(rawUrl);

      // Must be http or https
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      // Remove query parameters commonly used for tracking
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid'];
      trackingParams.forEach((param) => parsed.searchParams.delete(param));

      // Standardize protocol to https
      parsed.protocol = 'https:';

      // Remove www prefix for host consistency
      let host = parsed.hostname.toLowerCase();
      if (host.startsWith('www.')) {
        host = host.slice(4);
      }
      parsed.hostname = host;

      // Remove trailing slash from pathname if present
      if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      // Clear hash fragment
      parsed.hash = '';

      return parsed.toString();
    } catch {
      return null;
    }
  }

  static getDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      let host = parsed.hostname.toLowerCase();
      if (host.startsWith('www.')) host = host.slice(4);
      return host;
    } catch {
      return null;
    }
  }

  static isCrawlableDomain(url: string): boolean {
    const domain = this.getDomain(url);
    if (!domain) return false;
    return !this.BLOCKED_DOMAINS.has(domain);
  }
}
