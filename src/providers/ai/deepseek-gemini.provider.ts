import axios from 'axios';
import { env } from '../../config/env';
import { AIProvider, AIEnrichmentResult } from './ai.interface';
import { LeadCategory } from '@prisma/client';

export class DeepSeekGeminiAIProvider implements AIProvider {
  name = 'DeepSeekGeminiAIProvider';

  private buildPrompt(title: string, text: string, targetGenre: string): string {
    return `You are a music industry intelligence analyst. Analyze the following webpage content and classify the music contact.
Target Genre Context: "${targetGenre}"
Page Title: "${title}"
Page Snippet Text:
"${text.slice(0, 3000)}"

Return a valid JSON object matching EXACTLY this structure with no surrounding markdown or explanation:
{
  "category": "PLAYLIST_CURATOR" | "RADIO_STATION" | "RADIO_DJ" | "RECORD_LABEL" | "A_AND_R" | "MUSIC_BLOG" | "MUSIC_PUBLICATION" | "YOUTUBE_CHANNEL" | "PODCAST" | "MUSIC_INFLUENCER" | "OTHER",
  "organization": "Organization Name or null",
  "name": "Person Name or null",
  "genres": ["Genre1", "Genre2"],
  "acceptsSubmissions": true | false,
  "confidence": 0.0 to 1.0,
  "evidence": ["Short quote 1 showing submissions or category"]
}`;
  }

  async enrichLeadContent(title: string, text: string, targetGenre: string): Promise<AIEnrichmentResult | null> {
    const prompt = this.buildPrompt(title, text, targetGenre);

    // 1. Try DeepSeek API
    if (env.DEEPSEEK_API_KEY) {
      try {
        const response = await axios.post(
          'https://api.deepseek.com/v1/chat/completions',
          {
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'You extract music industry contact data into structured JSON.' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
          },
          {
            headers: {
              Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 12000,
          }
        );

        const content = response.data?.choices?.[0]?.message?.content;
        if (content) {
          return this.parseResponse(content);
        }
      } catch (error: any) {
        console.warn('[DeepSeek Provider] Request failed, trying Gemini fallback:', error.message);
      }
    }

    // 2. Fallback to Gemini API
    if (env.GEMINI_API_KEY) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
        const response = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          },
          { timeout: 12000 }
        );

        const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          return this.parseResponse(content);
        }
      } catch (error: any) {
        console.warn('[Gemini Fallback Provider] Request failed:', error.message);
      }
    }

    return null;
  }

  private parseResponse(jsonStr: string): AIEnrichmentResult | null {
    try {
      const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        category: Object.values(LeadCategory).includes(parsed.category) ? parsed.category : LeadCategory.OTHER,
        organization: parsed.organization || undefined,
        name: parsed.name || undefined,
        genres: Array.isArray(parsed.genres) ? parsed.genres : [],
        acceptsSubmissions: Boolean(parsed.acceptsSubmissions),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      };
    } catch {
      return null;
    }
  }
}
