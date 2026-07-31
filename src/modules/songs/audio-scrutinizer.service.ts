import axios from 'axios';
import { env } from '../../config/env';
import { SpotifyService } from '../../services/spotify.service';
import { prisma } from '../../config/prisma';

export interface ScrutinizedAudioResult {
  microSubgenres: string[];
  moodVibe: string;
  estimatedBpm: number;
  energyLevel: number;
  referenceArtists: string[];
  targetCuratorNotes: string;
  spotifyAudioFeatures?: any;
}

export class AudioScrutinizerService {
  /**
   * Layer 1: Gemini 1.5 Multimodal Audio Listener
   * Direct audio analysis from raw audio buffer
   */
  static async analyzeAudioBufferWithGemini(audioBuffer: Buffer, genre: string): Promise<ScrutinizedAudioResult | null> {
    if (!env.GEMINI_API_KEY) {
      console.warn('[AudioScrutinizer] GEMINI_API_KEY missing, skipping raw audio AI listening');
      return null;
    }

    try {
      const base64Audio = audioBuffer.toString('base64');
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

      const prompt = `You are a world-class music A&R and audio engineer specializing in global genres including Afrobeats, Amapiano, Hip Hop, Pop, R&B, Electronic, and Dancehall.
Analyze this audio track (Primary declared genre: "${genre}").
Scrutinize and extract:
1. Micro-Subgenres: Specific, sub-genre tags (e.g., Amapiano fusion, Street Hop, Afro-Pop, Melodic Trap).
2. Mood & Vibe: Emotional tone (e.g., High-energy club banger, Late-night chill, Melancholic, Summer anthem).
3. Estimated BPM (tempo) and Energy level (integer 1-10).
4. Similar Reference Artists: Top 3-5 mainstream and indie artists this track sounds like.
5. Target Curator Notes: Summary of ideal curator profiles (e.g., UK Afro-fusion DJs, Spotify official Amapiano curators, Commercial Radio DJs).

Return a valid JSON object matching EXACTLY this structure:
{
  "microSubgenres": ["subgenre1", "subgenre2"],
  "moodVibe": "Descriptive mood and vibe string",
  "estimatedBpm": 115,
  "energyLevel": 8,
  "referenceArtists": ["Artist1", "Artist2", "Artist3"],
  "targetCuratorNotes": "Curator target recommendations..."
}`;

      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mp3',
                  data: base64Audio,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      };

      const response = await axios.post(geminiUrl, payload, { timeout: 30000 });
      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (content) {
        const parsed = JSON.parse(content);
        return {
          microSubgenres: Array.isArray(parsed.microSubgenres) ? parsed.microSubgenres : [genre],
          moodVibe: parsed.moodVibe || 'Energetic',
          estimatedBpm: typeof parsed.estimatedBpm === 'number' ? parsed.estimatedBpm : 120,
          energyLevel: typeof parsed.energyLevel === 'number' ? parsed.energyLevel : 7,
          referenceArtists: Array.isArray(parsed.referenceArtists) ? parsed.referenceArtists : [],
          targetCuratorNotes: parsed.targetCuratorNotes || '',
        };
      }
    } catch (err: any) {
      console.warn('[AudioScrutinizer Gemini] Error analyzing audio buffer:', err.message);
    }

    return null;
  }

  /**
   * Full Scrutinizer Workflow combining Layer 1 (Gemini Audio) & Layer 2 (Spotify Web API)
   */
  static async scrutinizeSong(songId: string, audioBuffer?: Buffer): Promise<void> {
    try {
      const song = await prisma.song.findUnique({
        where: { id: songId },
        include: { artist: true },
      });

      if (!song) return;

      console.log(`[AudioScrutinizer] Beginning AI Scrutinization for Song "${song.title}" (${song.genre})...`);

      // 1. Layer 1: Multimodal Audio Analysis with Gemini if audioBuffer provided
      let audioResult: ScrutinizedAudioResult | null = null;
      if (audioBuffer) {
        audioResult = await this.analyzeAudioBufferWithGemini(audioBuffer, song.genre);
      }

      // 2. Layer 2: Spotify Audio Features API Integration
      const existingMetadata: any = song.metadata || {};
      const spotifyUrl = existingMetadata.spotifyUrl;
      let spotifyAudioFeatures = null;
      let spotifyRelatedArtists: string[] = [];

      if (spotifyUrl) {
        spotifyAudioFeatures = await SpotifyService.getAudioFeatures(spotifyUrl);
      }

      if (song.artist?.name) {
        spotifyRelatedArtists = await SpotifyService.getRelatedArtistsByName(song.artist.name);
      }

      // Combine reference artists from AI analysis, song model, and Spotify
      const combinedReferenceArtists = Array.from(
        new Set([
          ...(song.similarArtists || []),
          ...(audioResult?.referenceArtists || []),
          ...spotifyRelatedArtists,
        ])
      );

      const combinedSubgenres = Array.from(
        new Set([
          ...(song.subgenres || []),
          ...(audioResult?.microSubgenres || []),
        ])
      );

      // Save scrutinized analysis into Song metadata and fields
      const updatedMetadata = {
        ...existingMetadata,
        scrutinizedAt: new Date().toISOString(),
        moodVibe: audioResult?.moodVibe || song.soundVibe || `${song.genre} Vibe`,
        estimatedBpm: spotifyAudioFeatures?.tempo ? Math.round(spotifyAudioFeatures.tempo) : audioResult?.estimatedBpm || 120,
        energyLevel: spotifyAudioFeatures?.energy ? Math.round(spotifyAudioFeatures.energy * 10) : audioResult?.energyLevel || 7,
        danceability: spotifyAudioFeatures?.danceability || null,
        valence: spotifyAudioFeatures?.valence || null,
        targetCuratorNotes: audioResult?.targetCuratorNotes || '',
        spotifyAudioFeatures,
      };

      await prisma.song.update({
        where: { id: songId },
        data: {
          subgenres: combinedSubgenres,
          similarArtists: combinedReferenceArtists,
          soundVibe: updatedMetadata.moodVibe,
          metadata: updatedMetadata,
        },
      });

      console.log(`✅ [AudioScrutinizer] Song "${song.title}" scrutinized successfully! Subgenres: ${combinedSubgenres.join(', ')} | Similar Artists: ${combinedReferenceArtists.join(', ')}`);
    } catch (err: any) {
      console.error(`[AudioScrutinizer Error] for song ${songId}:`, err.message);
    }
  }
}
