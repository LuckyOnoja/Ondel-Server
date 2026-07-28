"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeywordGeneratorService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../../config/env");
const keyword_repository_1 = require("./keyword.repository");
class KeywordGeneratorService {
    static async generateAndStoreKeywords(options) {
        const { categories, genres, similarArtists, soundVibe, countries } = options;
        const countryStr = countries && countries.length > 0 ? countries.join(', ') : 'Global';
        let totalSaved = 0;
        for (const category of categories) {
            for (const genre of genres) {
                let prompt = '';
                if (similarArtists && similarArtists.length > 0) {
                    const artistRefStr = similarArtists.join(', ');
                    const vibeStr = soundVibe || genre;
                    prompt = `You are an expert music industry SEO analyst. Generate 30 highly specific, diverse long-tail web search queries used to discover:
- Category: "${category}"
- Genre: "${genre}"
- Sound Vibe / Style: "${vibeStr}"
- Reference Artists: "${artistRefStr}"
- Target Region: "${countryStr}"

Include specific variations for:
1. Spotify playlist submission pages for curators featuring artists like ${artistRefStr}.
2. Radio DJs, independent music blogs, and A&R contact forms accepting music in the style of ${artistRefStr}.
3. Direct submission portals (Google Forms, SubmitHub, Groover, contact emails).

Return a valid JSON object matching EXACTLY this structure:
{
  "keywords": [
    "long tail search query 1",
    "long tail search query 2"
  ]
}`;
                }
                else {
                    prompt = `You are an expert music industry SEO analyst. Generate 30 diverse, random, highly effective long-tail web search queries used to discover:
- Category: "${category}"
- Genre: "${genre}"
- Target Region: "${countryStr}"

Generate random variations across independent playlist curators, radio DJs, music blogs, music publications, submission forms, and contact pages. Do NOT hardcode specific artist names unless organically relevant.

Return a valid JSON object matching EXACTLY this structure:
{
  "keywords": [
    "long tail search query 1",
    "long tail search query 2"
  ]
}`;
                }
                let keywords = [];
                // 1. Try DeepSeek AI
                if (env_1.env.DEEPSEEK_API_KEY) {
                    try {
                        const response = await axios_1.default.post('https://api.deepseek.com/v1/chat/completions', {
                            model: 'deepseek-chat',
                            messages: [{ role: 'user', content: prompt }],
                            response_format: { type: 'json_object' },
                            temperature: 0.8,
                        }, {
                            headers: {
                                Authorization: `Bearer ${env_1.env.DEEPSEEK_API_KEY}`,
                                'Content-Type': 'application/json',
                            },
                            timeout: 10000,
                        });
                        const content = response.data?.choices?.[0]?.message?.content;
                        if (content) {
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed.keywords)) {
                                keywords = parsed.keywords;
                            }
                        }
                    }
                    catch (err) {
                        console.warn('[KeywordGenerator DeepSeek] Error:', err.message);
                    }
                }
                // 2. Fallback to Gemini AI
                if (keywords.length === 0 && env_1.env.GEMINI_API_KEY) {
                    try {
                        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env_1.env.GEMINI_API_KEY}`;
                        const response = await axios_1.default.post(geminiUrl, {
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { responseMimeType: 'application/json' },
                        }, { timeout: 10000 });
                        const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (content) {
                            const parsed = JSON.parse(content);
                            if (Array.isArray(parsed.keywords)) {
                                keywords = parsed.keywords;
                            }
                        }
                    }
                    catch (err) {
                        console.warn('[KeywordGenerator Gemini] Error:', err.message);
                    }
                }
                // 3. Fallback to general query builder if AI fails
                if (keywords.length === 0) {
                    keywords = [
                        `${genre} ${category.toLowerCase().replace('_', ' ')} submit music ${countryStr}`,
                        `${genre} playlist submission ${countryStr}`,
                        `independent ${genre} curator contact ${countryStr}`,
                        `${genre} radio DJ demo submission ${countryStr}`,
                        `${genre} music blog review track ${countryStr}`,
                    ];
                }
                // Save keywords to PostgreSQL keyword ledger
                const saved = await keyword_repository_1.KeywordRepository.upsertKeywords(keywords.map((kw) => ({
                    keyword: kw,
                    category,
                    genre,
                    country: countries?.[0],
                })));
                totalSaved += saved;
            }
        }
        console.log(`[KeywordGenerator] Generated and ledgered ${totalSaved} new keywords in database.`);
        return totalSaved;
    }
}
exports.KeywordGeneratorService = KeywordGeneratorService;
