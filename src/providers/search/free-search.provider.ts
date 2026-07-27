import axios from 'axios';
import * as cheerio from 'cheerio';
import dns from 'dns';
import { promisify } from 'util';
import { SearchProvider, SearchResult, SearchOptions } from './search.interface';
import { UrlNormalizer } from './url-normalizer';
import { env } from '../../config/env';

const lookupDns = promisify(dns.lookup);

export class FreeSearchProvider implements SearchProvider {
  name = 'FreeSearchProvider';

  private static USER_AGENTS = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  ];

  private getRandomUserAgent(): string {
    return FreeSearchProvider.USER_AGENTS[Math.floor(Math.random() * FreeSearchProvider.USER_AGENTS.length)];
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const limit = options?.limit || 10;

    // 1. Try AI-assisted discovery of REAL websites
    let results = await this.searchWithAI(query, limit);

    // 2. Fallback to Bing HTML Search
    if (results.length === 0) {
      results = await this.searchBingHTML(query, limit);
    }

    return results;
  }

  private async searchWithAI(query: string, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

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
    if (env.DEEPSEEK_API_KEY) {
      try {
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          {
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          },
          {
            headers: {
              Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
        rawContent = response.data?.choices?.[0]?.message?.content || '';
      } catch (err: any) {
        console.warn('[FreeSearchProvider AI DeepSeek] Error:', err.message);
      }
    }

    if (!rawContent && env.GEMINI_API_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          },
          { timeout: 10000 }
        );
        rawContent = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err: any) {
        console.warn('[FreeSearchProvider AI Gemini] Error:', err.message);
      }
    }

    if (rawContent) {
      try {
        const parsed = JSON.parse(rawContent);
        if (Array.isArray(parsed.results)) {
          for (const item of parsed.results) {
            const canonical = UrlNormalizer.canonicalize(item.url);
            if (canonical && UrlNormalizer.isCrawlableDomain(canonical)) {
              const domain = UrlNormalizer.getDomain(canonical);
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
      } catch (parseErr) {
        console.warn('[FreeSearchProvider JSON Parse Error]');
      }
    }

    return results;
  }

  private async domainExists(domain: string): Promise<boolean> {
    try {
      await lookupDns(domain);
      return true;
    } catch {
      return false;
    }
  }

  private async searchBingHTML(query: string, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    try {
      const response = await axios.get(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 8000,
      });

      const $ = cheerio.load(response.data);

      $('.b_algo').each((_: number, element: any) => {
        if (results.length >= limit) return;

        const titleEl = $(element).find('h2 a');
        const snippetEl = $(element).find('.b_caption p');

        const title = titleEl.text().trim();
        const rawUrl = titleEl.attr('href');
        const snippet = snippetEl.text().trim();

        if (title && rawUrl) {
          const canonical = UrlNormalizer.canonicalize(rawUrl);
          if (canonical && UrlNormalizer.isCrawlableDomain(canonical)) {
            results.push({
              title,
              url: canonical,
              snippet,
              domain: UrlNormalizer.getDomain(canonical) || undefined,
            });
          }
        }
      });
    } catch (error: any) {
      console.warn(`[FreeSearchProvider Bing] Error:`, error.message);
    }
    return results;
  }
}
