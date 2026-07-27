import axios from 'axios';
import { env } from '../../config/env';
import { LeadCategory } from '@prisma/client';
import { KeywordRepository } from './keyword.repository';

export interface KeywordGenerationOptions {
  categories: LeadCategory[];
  genres: string[];
  countries?: string[];
}

export class KeywordGeneratorService {
  static async generateAndStoreKeywords(options: KeywordGenerationOptions): Promise<number> {
    const { categories, genres, countries } = options;
    const countryStr = countries && countries.length > 0 ? countries.join(', ') : 'Global';

    let totalSaved = 0;

    for (const category of categories) {
      for (const genre of genres) {
        const prompt = `You are a music industry SEO and search intent analyst. Generate 30 highly specific, diverse long-tail search queries used to discover:
- Category: "${category}"
- Genre: "${genre}"
- Target Region: "${countryStr}"

Include variations for independent playlisters, submission portals, radio DJs, music blogs, contact pages, and submission forms.

Return a valid JSON object matching EXACTLY this structure:
{
  "keywords": [
    "long tail search query 1",
    "long tail search query 2"
  ]
}`;

        let keywords: string[] = [];

        // 1. Try DeepSeek AI
        if (env.DEEPSEEK_API_KEY) {
          try {
            const response = await axios.post(
              'https://api.deepseek.com/v1/chat/completions',
              {
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.7,
              },
              {
                headers: {
                  Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                timeout: 10000,
              }
            );

            const content = response.data?.choices?.[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed.keywords)) {
                keywords = parsed.keywords;
              }
            }
          } catch (err: any) {
            console.warn('[KeywordGenerator DeepSeek] Error:', err.message);
          }
        }

        // 2. Fallback to Gemini AI
        if (keywords.length === 0 && env.GEMINI_API_KEY) {
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

            const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed.keywords)) {
                keywords = parsed.keywords;
              }
            }
          } catch (err: any) {
            console.warn('[KeywordGenerator Gemini] Error:', err.message);
          }
        }

        // 3. Fallback to deterministic query builder if AI fails
        if (keywords.length === 0) {
          keywords = [
            `${genre} ${category.toLowerCase().replace('_', ' ')} submit music ${countryStr}`,
            `${genre} playlist submission ${countryStr}`,
            `independent ${genre} curator contact ${countryStr}`,
            `${genre} radio station demo submission ${countryStr}`,
            `${genre} music blog review track ${countryStr}`,
          ];
        }

        // Save keywords to PostgreSQL keyword ledger
        const saved = await KeywordRepository.upsertKeywords(
          keywords.map((kw) => ({
            keyword: kw,
            category,
            genre,
            country: countries?.[0],
          }))
        );

        totalSaved += saved;
      }
    }

    console.log(`[KeywordGenerator] Generated and ledgered ${totalSaved} new keywords in database.`);
    return totalSaved;
  }
}
