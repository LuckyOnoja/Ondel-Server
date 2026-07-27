import axios from 'axios';
import * as cheerio from 'cheerio';
import { CrawlPolicy } from './crawl-policy';
import { ContactExtractor, ExtractedContact } from './contact-extractor';
import { UrlNormalizer } from '../../providers/search/url-normalizer';

export interface CrawlResult {
  url: string;
  title: string;
  text: string;
  contacts: ExtractedContact[];
  secondaryPagesCrawled: string[];
}

export class CrawlerService {
  private static USER_AGENT = 'MusicLeadDiscoveryBot/1.0 (+https://ondel.io)';

  static async crawlPage(url: string, crawlSubpages = true): Promise<CrawlResult | null> {
    if (!CrawlPolicy.shouldCrawl(url)) {
      return null;
    }

    let targetUrl = url;
    let response;

    try {
      response = await axios.get(targetUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
    } catch (err) {
      // Fallback to root domain if specific path fails (e.g., 404 on /submit)
      try {
        const rootUrl = new URL(url).origin;
        if (rootUrl !== url) {
          targetUrl = rootUrl;
          response = await axios.get(targetUrl, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
        } else {
          return null;
        }
      } catch {
        return null;
      }
    }

    try {
      const contentType = String(response?.headers['content-type'] || '');
      if (!contentType.includes('text/html')) {
        return null;
      }

      const $ = cheerio.load(response.data);
      const title = $('title').text().trim() || $('h1').first().text().trim();

      // Remove script/style tags for clean body text extraction
      $('script, style, noscript, svg, nav, footer').remove();
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

      // Extract all href links
      const links: string[] = [];
      $('a[href]').each((_: number, el: any) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, url).toString();
            links.push(absoluteUrl);
          } catch {
            // Invalid URL string ignored
          }
        }
      });

      // Extract primary contacts from main page
      const contacts = ContactExtractor.extractContacts(bodyText, url, links);
      const secondaryPagesCrawled: string[] = [];

      // Discover subpages (/contact, /submit, /about, /demo, /team)
      if (crawlSubpages) {
        const targetSubpagePatterns = ['/contact', '/submit', '/demo', '/about', '/team', '/submission'];
        const domain = UrlNormalizer.getDomain(url);

        const subpageUrls = links.filter((link) => {
          const linkDomain = UrlNormalizer.getDomain(link);
          if (linkDomain !== domain) return false;
          const lower = link.toLowerCase();
          return targetSubpagePatterns.some((pattern) => lower.includes(pattern));
        });

        // Limit subpage crawl to top 3 relevant subpages
        const uniqueSubpages = [...new Set(subpageUrls)].slice(0, 3);

        for (const subUrl of uniqueSubpages) {
          if (CrawlPolicy.shouldCrawl(subUrl)) {
            try {
              const subRes = await axios.get(subUrl, {
                timeout: 8000,
                headers: { 'User-Agent': this.USER_AGENT },
              });

              const subContentType = String(subRes.headers['content-type'] || '');
              if (subContentType.includes('text/html')) {
                const $sub = cheerio.load(subRes.data);
                $sub('script, style, noscript, svg, nav, footer').remove();
                const subText = $sub('body').text().replace(/\s+/g, ' ').trim();

                const subLinks: string[] = [];
                $sub('a[href]').each((_: number, el: any) => {
                  const href = $sub(el).attr('href');
                  if (href) {
                    try {
                      subLinks.push(new URL(href, subUrl).toString());
                    } catch {}
                  }
                });

                const subContacts = ContactExtractor.extractContacts(subText, subUrl, subLinks);
                contacts.push(...subContacts);
                secondaryPagesCrawled.push(subUrl);
              }
            } catch {
              // Subpage fetch error ignored safely
            }
          }
        }
      }

      // Deduplicate contact items by type and value
      const uniqueContactsMap = new Map<string, ExtractedContact>();
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
    } catch (error: any) {
      console.warn(`[CrawlerService] Failed to crawl ${url}:`, error.message);
      return null;
    }
  }
}
