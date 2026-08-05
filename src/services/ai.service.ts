import axios from 'axios'
import { env } from '../config/env.js'

export interface CampaignPlanEvent {
  offsetDays: number
  title: string
  category: 'Release' | 'Content' | 'Pitch' | 'Promo'
}

export class AIService {
  private static getAPIConfig() {
    const deepseekKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
    const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY
    return { deepseekKey, geminiKey }
  }

  static async generateReleasePlan(
    songTitle: string,
    artistName: string,
    genre: string,
    releaseDate: string
  ): Promise<{ rawPlanText: string; events: CampaignPlanEvent[] }> {
    const { deepseekKey, geminiKey } = this.getAPIConfig()

    const prompt = `You are a world-class music A&R, release planner, and promotion strategist.
Create a detailed, highly effective 4-week release plan / campaign strategy for this song:
- Song Title: "${songTitle}"
- Artist: "${artistName}"
- Genre: "${genre}"
- Release Date: "${releaseDate}" (This is the target Release Day).

We need a 4-week campaign:
- Week 1 (Days -14 to -8 before release): Build Curiosity
- Week 2 (Days -7 to -1 before release): Build Intent (Behind-the-scenes, playlist pitching, vert content, press assets)
- Release Week (Release Eve, Release Day [Day 0], and Days +1 to +3 after release): Maximize Launch
- Week 4 (Days +4 to +10 after release): Sustain Momentum (Acoustic version, UGC, producers interviews, milestones)

Task:
1. Return a human-readable text explanation detailing the plan week-by-week.
2. Return a structured list of key calendar events with their offsetDays relative to the Release Day (Release Day is 0, days before are negative, days after are positive) and category ("Release", "Content", "Pitch", "Promo").

Your output must be a valid JSON object matching EXACTLY this structure with no extra text or markdown formatting:
{
  "rawPlanText": "Week 1 - Build Curiosity\\nDay 1 (Day -14): cinematic teaser...\\nWeek 2 - Build Intent...",
  "events": [
    { "offsetDays": -14, "title": "Launch cinematic teaser on Reels/TikTok (Hook: 'I've been waiting to share this')", "category": "Promo" },
    { "offsetDays": -13, "title": "Publish studio clip showing emotion & recording process", "category": "Content" },
    { "offsetDays": -7, "title": "Submit song to Spotify Editorial Playlists & Pitch blogs", "category": "Pitch" },
    { "offsetDays": 0, "title": "Release Day Announcement: Announce release across all platforms", "category": "Release" }
  ]
}`

    // 1. Try DeepSeek
    if (deepseekKey) {
      try {
        const response = await axios.post(
          'https://api.deepseek.com/chat/completions',
          {
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'You are an expert music A&R planner. Return strictly valid JSON.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${deepseekKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 25000,
          }
        )

        const content = response.data?.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim())
          return {
            rawPlanText: parsed.rawPlanText || '',
            events: Array.isArray(parsed.events) ? parsed.events : []
          }
        }
      } catch (err: any) {
        console.warn('[AIService DeepSeek failed, falling back to Gemini]:', err.message)
      }
    }

    // 2. Try Gemini
    if (geminiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
        const response = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          },
          { timeout: 20000 }
        )

        const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (content) {
          const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim())
          return {
            rawPlanText: parsed.rawPlanText || '',
            events: Array.isArray(parsed.events) ? parsed.events : []
          }
        }
      } catch (err: any) {
        console.error('[AIService Gemini failed]:', err.message)
      }
    }

    // Fallback Mock Strategy if APIs are offline / keys missing
    return this.getMockPlan(songTitle, artistName, genre, releaseDate)
  }

  static async chatAboutSong(
    songTitle: string,
    artistName: string,
    releaseDate: string,
    chatHistory: { sender: string; text: string }[],
    newPrompt: string
  ): Promise<string> {
    const { deepseekKey, geminiKey } = this.getAPIConfig()

    const formattedHistory = chatHistory
      .map((msg) => `${msg.sender === 'user' ? 'Artist' : 'Ondel AI'}: ${msg.text}`)
      .join('\n')

    const prompt = `You are Ondel AI, a concise, high-efficiency music A&R assistant.

CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:
1. KEEP YOUR RESPONSES EXTREMELY CONCISE, DIRECT, AND TO THE POINT.
2. DO NOT write long essays, extensive multi-step guides, or multi-paragraph breakdown essays unless the artist explicitly requests a full guide.
3. Maximum response length: 2 to 4 short sentences total.
4. If the prompt is adjusting or replacing a calendar task (e.g. "Regarding task for Date..."):
   - FIRST LINE MUST BE THE NEW CONCISE TASK TITLE starting with "New Task: [Title]" (e.g. "New Task: Host 5-slide 'Blight Dictionary' IG Story series & fan poll").
   - Followed by 1-2 short sentences explaining why or how to execute it cleanly.

Context:
- Song: "${songTitle}" by ${artistName}
- Target Release Date: "${releaseDate}"

Conversation History:
${formattedHistory}

New Prompt from Artist: "${newPrompt}"

Return only the concise AI response text.`

    if (deepseekKey) {
      try {
        const response = await axios.post(
          'https://api.deepseek.com/chat/completions',
          {
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: 'You are Ondel AI, a strategic music marketing advisor.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${deepseekKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          }
        )

        const content = response.data?.choices?.[0]?.message?.content
        if (content) return content.trim()
      } catch (err: any) {
        console.warn('[AIService chat DeepSeek failed, falling back to Gemini]:', err.message)
      }
    }

    if (geminiKey) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`
        const response = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: prompt }] }]
          },
          { timeout: 15000 }
        )

        const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text
        if (content) return content.trim()
      } catch (err: any) {
        console.error('[AIService chat Gemini failed]:', err.message)
      }
    }

    return `I received your request regarding "${songTitle}". I recommend posting vertical content to Reels and TikTok three times a week, focusing on telling the emotional backstory of the song. You can adjust the task for this date to align with this approach!`
  }

  private static getMockPlan(
    songTitle: string,
    artistName: string,
    genre: string,
    releaseDate: string
  ): { rawPlanText: string; events: CampaignPlanEvent[] } {
    const rawPlanText = `Week 1 - Build Curiosity
Goal: Introduce the era without revealing the full song.
Day 1 (Day -14): Cinematic teaser on Reels/TikTok (Hook: "I've been waiting to share this").
Day 2 (Day -13): Studio clip showing the emotional recording process.
Day 3 (Day -12): Lyric graphic showcasing one memorable quote.
Day 4 (Day -11): Short story post explaining the song's inspiration.
Day 5 (Day -10): Chorus dance snippet sent to key creators.
Day 6 (Day -9): Moodboard carousel establishing visual identity.
Day 7 (Day -8): Story countdown with pre-save links.

Week 2 - Build Intent
Day 8 (Day -7): Submit pitching details to editorial playlist curators.
Day 9 (Day -6): Behind-the-scenes artwork reveal.
Day 10 (Day -5): Launch vertically captured acoustic preview.
Day 12 (Day -3): Pitch to key local DJs & radio curators.

Release Week
Day 14 (Day -1): Release Eve final link configurations and post schedules.
Day 15 (Day 0): RELEASE DAY announcement & vertical performance video launch.
Day 16 (Day +1): Share fan feedback screenshots and initial streaming numbers.
Day 17 (Day +2): Live lyric breakdown listening session with fans.

Week 4 - Sustain Momentum
Day 20 (Day +5): Publish vertical acoustic performance clip.
Day 22 (Day +7): Producer interview breakdown of track beats.
Day 24 (Day +9): Playlist milestone graphic sharing and fans thank-you notes.`

    const events: CampaignPlanEvent[] = [
      { offsetDays: -14, title: `Cinematic teaser for "${songTitle}" on Reels/TikTok (Hook: "I've been waiting to share this")`, category: 'Promo' },
      { offsetDays: -13, title: 'Studio clip showing the emotional recording process', category: 'Content' },
      { offsetDays: -12, title: 'Lyric graphic showcasing one memorable quote', category: 'Content' },
      { offsetDays: -10, title: 'Chorus dance snippet sent to creators', category: 'Promo' },
      { offsetDays: -7, title: 'Submit pitch details to Editorial Playlists & Pitch blogs', category: 'Pitch' },
      { offsetDays: -5, title: 'Acoustic preview video upload', category: 'Content' },
      { offsetDays: -3, title: 'Send tracking links to DJs & radio curators', category: 'Pitch' },
      { offsetDays: 0, title: `RELEASE DAY: Announce "${songTitle}" release across all platforms`, category: 'Release' },
      { offsetDays: 1, title: 'Share fan feedback screenshots & initial numbers', category: 'Content' },
      { offsetDays: 2, title: 'Live lyric breakdown listing session with fans', category: 'Promo' },
      { offsetDays: 5, title: 'Publish vertical acoustic performance clip', category: 'Content' },
      { offsetDays: 7, title: 'Producer interview breakdown of beats', category: 'Content' },
      { offsetDays: 9, title: 'Playlist milestone thank-you notes graphic', category: 'Promo' }
    ]

    return { rawPlanText, events }
  }
}
