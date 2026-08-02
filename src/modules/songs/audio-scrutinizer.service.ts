import axios from 'axios';
import { env } from '../../config/env';
import { SpotifyService } from '../../services/spotify.service';
import { EssentiaService, EssentiaAudioFeatures } from '../../services/essentia.service';
import { AudioDSPService, DSPAnalysisResult } from '../../services/audio-dsp.service';
import { prisma } from '../../config/prisma';

export interface ScrutinizedAudioResult {
  microSubgenres: string[];
  moodVibe?: string;
  estimatedBpm?: number;
  energyLevel?: number;
  referenceArtists: string[];
  targetCuratorNotes?: string;
  spotifyAudioFeatures?: any;
  essentiaFeatures?: EssentiaAudioFeatures;
}

export class AudioScrutinizerService {
  /**
   * DeepSeek A&R Engine: Ingests Audio DSP & Essentia MIR features to generate exact micro-subgenres, mood/vibe, and reference artists
   */
  static async analyzeTrackWithDeepSeek(
    songTitle: string,
    artistName: string,
    genre: string,
    userSubgenres: string[],
    essentiaData?: EssentiaAudioFeatures,
    dspData?: DSPAnalysisResult
  ): Promise<ScrutinizedAudioResult | null> {
    const deepseekKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      console.warn('⚠️ [AudioScrutinizer] DEEPSEEK_API_KEY is missing in server/.env');
      return null;
    }

    const bpmStr = essentiaData?.bpm
      ? `${essentiaData.bpm} BPM`
      : dspData?.exactBpm
      ? `${dspData.exactBpm} BPM`
      : 'Unmeasured';

    const keyStr = essentiaData?.key || 'Unspecified';
    const danceability = essentiaData?.danceability !== undefined
      ? essentiaData.danceability
      : 'Unmeasured';

    const energy = essentiaData?.energy !== undefined
      ? `${Math.round(essentiaData.energy * 10)}/10`
      : dspData?.energyLevel !== undefined
      ? `${dspData.energyLevel}/10`
      : 'Unmeasured';

    const loudness = essentiaData?.loudnessDb !== undefined
      ? `${essentiaData.loudnessDb} dB`
      : dspData?.rmsLoudnessDb !== undefined
      ? `${dspData.rmsLoudnessDb} dB`
      : 'Unmeasured';

    try {
      console.log(`🧠 [DeepSeek A&R Engine] Analyzing Track "${songTitle}" by ${artistName} (${genre})...`);

      const prompt = `You are a world-class music A&R, audio engineer, and global playlist promotion strategist.
Analyze this track using exact audio DSP & MIR signal data:

TRACK INFO:
- Song Title: "${songTitle}"
- Artist Name: "${artistName}"
- Declared Genre: "${genre}"
- Subgenres: "${userSubgenres.join(', ') || genre}"

AUDIO DSP MEASUREMENTS:
- Exact Measured BPM: ${bpmStr}
- Musical Key & Scale: "${keyStr}"
- Danceability: ${danceability}
- Energy Level: ${energy}
- Loudness: ${loudness}

CRITICAL TASK:
1. Micro-Subgenres: Identify 2-4 highly specific micro-subgenres for this track.
2. Mood & Vibe: Emotional tone and aesthetic of this track.
3. Similar Reference Artists: List 3-5 mainstream and indie artists that this track's sound and style ACTUALLY MATCH globally.
4. Target Curator Notes: Concise pitch recommendation for playlist curators, radio DJs, and blogs.

Return a valid JSON object matching EXACTLY this structure:
{
  "microSubgenres": ["subgenre1", "subgenre2"],
  "moodVibe": "Descriptive mood and vibe string",
  "referenceArtists": ["Artist1", "Artist2", "Artist3"],
  "targetCuratorNotes": "Detailed target curator recommendations..."
}`;

      const res = await axios.post(
        'https://api.deepseek.com/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: 'You are an expert music A&R engine. Return strictly valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
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
      );

      const content = res.data?.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        console.log(`✅ [DeepSeek A&R Engine] Analysis Completed Successfully for "${songTitle}"!`);
        return {
          microSubgenres: Array.isArray(parsed.microSubgenres) ? parsed.microSubgenres : [genre],
          moodVibe: parsed.moodVibe || undefined,
          estimatedBpm: essentiaData?.bpm ? Math.round(essentiaData.bpm) : dspData?.exactBpm ? Math.round(dspData.exactBpm) : undefined,
          energyLevel: essentiaData?.energy !== undefined ? Math.round(essentiaData.energy * 10) : dspData?.energyLevel !== undefined ? dspData.energyLevel : undefined,
          referenceArtists: Array.isArray(parsed.referenceArtists) ? parsed.referenceArtists : [],
          targetCuratorNotes: parsed.targetCuratorNotes || undefined,
          essentiaFeatures: essentiaData,
        };
      }
    } catch (err: any) {
      const errorDetails = err.response?.data?.error || err.message;
      console.warn(`[DeepSeek API Error]:`, typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails);
    }

    return null;
  }

  /**
   * Full Scrutinizer Workflow combining Layer 0 (Node Audio DSP & Essentia.js MIR Engine), Layer 1 (DeepSeek A&R Engine), & Layer 2 (Spotify API)
   */
  static async scrutinizeSong(songId: string, audioBuffer?: Buffer): Promise<void> {
    try {
      const song = await prisma.song.findUnique({
        where: { id: songId },
        include: { artist: true },
      });

      if (!song) return;

      console.log(`\n================================================================================`);
      console.log(`🔍 [Ondel Scrutinizer Engine] Starting Track Analysis for "${song.title}"...`);
      console.log(`================================================================================`);

      // 1. Layer 0: Perform Node AudioDSP & Essentia.js MIR Analysis if buffer provided
      let essentiaResult: EssentiaAudioFeatures | undefined = undefined;
      let dspResult: DSPAnalysisResult | undefined = undefined;

      if (audioBuffer) {
        dspResult = await AudioDSPService.analyzeAudioBuffer(audioBuffer);
        essentiaResult = await EssentiaService.analyzeAudioBuffer(audioBuffer, song.genre);
      }

      // 2. Layer 1: DeepSeek AI A&R Engine Analysis
      const aiResult = await this.analyzeTrackWithDeepSeek(
        song.title,
        song.artist?.name || 'Artist',
        song.genre,
        song.subgenres || [],
        essentiaResult,
        dspResult
      );

      // 3. Layer 2: Spotify Audio Features API Integration (if Spotify URL attached)
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

      // Combine reference artists strictly from DeepSeek AI analysis, song model, and Spotify API
      const combinedReferenceArtists = Array.from(
        new Set([
          ...(song.similarArtists || []),
          ...(aiResult?.referenceArtists || []),
          ...spotifyRelatedArtists,
        ])
      ).filter(Boolean);

      const combinedSubgenres = Array.from(
        new Set([
          ...(song.subgenres || []),
          ...(aiResult?.microSubgenres || []),
        ])
      ).filter(Boolean);

      // Final BPM & Energy calculation (Spotify DSP > Essentia MIR > Node DSP > AI)
      const finalBpm = spotifyAudioFeatures?.tempo
        ? Math.round(spotifyAudioFeatures.tempo)
        : essentiaResult?.bpm
        ? Math.round(essentiaResult.bpm)
        : dspResult?.exactBpm
        ? Math.round(dspResult.exactBpm)
        : aiResult?.estimatedBpm || undefined;

      const finalEnergy = spotifyAudioFeatures?.energy
        ? Math.round(spotifyAudioFeatures.energy * 10)
        : essentiaResult?.energy !== undefined
        ? Math.round(essentiaResult.energy * 10)
        : dspResult?.energyLevel !== undefined
        ? dspResult.energyLevel
        : aiResult?.energyLevel || undefined;

      const musicalKey = essentiaResult?.key || undefined;
      const vibe = aiResult?.moodVibe || song.soundVibe || undefined;
      const curatorNotes = aiResult?.targetCuratorNotes || undefined;

      // Save scrutinized analysis into Song metadata and database fields
      const updatedMetadata = {
        ...existingMetadata,
        scrutinizedAt: new Date().toISOString(),
        moodVibe: vibe || null,
        estimatedBpm: finalBpm || null,
        energyLevel: finalEnergy || null,
        musicalKey: musicalKey || null,
        danceability: spotifyAudioFeatures?.danceability || essentiaResult?.danceability || null,
        valence: spotifyAudioFeatures?.valence || null,
        targetCuratorNotes: curatorNotes || null,
        essentiaFeatures: essentiaResult || null,
        spotifyAudioFeatures,
      };

      await prisma.song.update({
        where: { id: songId },
        data: {
          subgenres: combinedSubgenres,
          similarArtists: combinedReferenceArtists,
          soundVibe: vibe || null,
          metadata: updatedMetadata,
        },
      });

      // Output comprehensive server console analysis card
      console.log(`\n================================================================================`);
      console.log(`✅ [Ondel Scrutinizer Engine] AUDIO DSP & AI TRACK ANALYSIS COMPLETE`);
      console.log(`================================================================================`);
      console.log(`📌 Track Title        : "${song.title}"`);
      console.log(`👤 Artist Name        : ${song.artist?.name || 'Unknown Artist'}`);
      console.log(`🎸 Declared Genre     : ${song.genre}`);
      console.log(`🎹 Musical Key        : ${musicalKey || 'Unmeasured'}`);
      console.log(`🔥 Micro-Subgenres    : ${combinedSubgenres.length > 0 ? combinedSubgenres.join(', ') : 'None'}`);
      console.log(`⚡ Energy Level       : ${finalEnergy !== undefined ? `${finalEnergy} / 10` : 'Unmeasured'}`);
      console.log(`💃 Danceability       : ${essentiaResult?.danceability ? `${essentiaResult.danceability} / 1.0` : 'Unmeasured'}`);
      console.log(`🥁 Measured Tempo     : ${finalBpm ? `${finalBpm} BPM` : 'Unmeasured'} [Method: ${dspResult?.exactBpm ? 'NODE_DSP' : 'ESSENTIA'}]`);
      console.log(`✨ Mood & Vibe        : ${vibe || 'Unmeasured'}`);
      console.log(`🎤 Real Reference Artists: ${combinedReferenceArtists.length > 0 ? combinedReferenceArtists.join(', ') : 'None Extracted Yet'}`);
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`🎯 GLOBAL PLAYLISTER MATCHING INSIGHTS:`);
      console.log(`  • Ideal Curators   : ${curatorNotes || `Target ${song.genre} playlist curators & radio DJs`}`);
      console.log(`  • Target Audiences : Fans of ${combinedReferenceArtists.length > 0 ? combinedReferenceArtists.slice(0, 3).join(', ') : song.genre}`);
      console.log(`================================================================================\n`);
    } catch (err: any) {
      console.error(`[AudioScrutinizer Error] for song ${songId}:`, err.message);
    }
  }
}
