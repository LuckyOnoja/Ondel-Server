import axios from 'axios';
import * as cheerio from 'cheerio';
import { SearchProvider, SearchResult, SearchOptions } from './search.interface';
import { UrlNormalizer } from './url-normalizer';

export class FreeSearchProvider implements SearchProvider {
  name = 'FreeSearchProvider';

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const limit = options?.limit || 10;

    try {
      // Use DuckDuckGo HTML endpoint for free, keyless web search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      $('.result').each((_: number, element: any) => {
        if (results.length >= limit) return;

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

          const canonical = UrlNormalizer.canonicalize(finalUrl);
          if (canonical && UrlNormalizer.isCrawlableDomain(canonical)) {
            const domain = UrlNormalizer.getDomain(canonical) || undefined;
            results.push({
              title,
              url: canonical,
              snippet,
              domain,
            });
          }
        }
      });
    } catch (error: any) {
      console.warn(`[FreeSearchProvider] Search failed for query "${query}":`, error.message);
    }

    return results;
  }
}
