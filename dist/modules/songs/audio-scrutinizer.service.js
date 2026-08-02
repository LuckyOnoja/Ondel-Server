"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioScrutinizerService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../../config/env");
const spotify_service_1 = require("../../services/spotify.service");
const essentia_service_1 = require("../../services/essentia.service");
const audio_dsp_service_1 = require("../../services/audio-dsp.service");
const prisma_1 = require("../../config/prisma");
class AudioScrutinizerService {
    /**
     * DeepSeek A&R Engine: Ingests Audio DSP & Essentia MIR features to generate exact micro-subgenres, mood/vibe, and reference artists
     */
    static async analyzeTrackWithDeepSeek(songTitle, artistName, genre, userSubgenres, essentiaData, dspData) {
        const deepseekKey = env_1.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
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
            const res = await axios_1.default.post('https://api.deepseek.com/chat/completions', {
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
            }, {
                headers: {
                    Authorization: `Bearer ${deepseekKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 25000,
            });
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
        }
        catch (err) {
            const errorDetails = err.response?.data?.error || err.message;
            console.warn(`[DeepSeek API Error]:`, typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails);
        }
        return null;
    }
    /**
     * Full Scrutinizer Workflow combining Layer 0 (Node Audio DSP & Essentia.js MIR Engine), Layer 1 (DeepSeek A&R Engine), & Layer 2 (Spotify API)
     */
    static async scrutinizeSong(songId, audioBuffer) {
        try {
            const song = await prisma_1.prisma.song.findUnique({
                where: { id: songId },
                include: { artist: true },
            });
            if (!song)
                return;
            console.log(`\n================================================================================`);
            console.log(`🔍 [Ondel Scrutinizer Engine] Starting Track Analysis for "${song.title}"...`);
            console.log(`================================================================================`);
            // If audioBuffer was not passed in memory, fetch it from song.audioUrl if available
            let targetBuffer = audioBuffer;
            if (!targetBuffer && song.audioUrl) {
                try {
                    console.log(`📥 [AudioScrutinizer] Fetching audio buffer from URL for "${song.title}"...`);
                    const response = await axios_1.default.get(song.audioUrl, { responseType: 'arraybuffer', timeout: 20000 });
                    targetBuffer = Buffer.from(response.data);
                }
                catch (fetchErr) {
                    console.warn(`⚠️ [AudioScrutinizer] Could not fetch audio buffer from URL: ${fetchErr.message}`);
                }
            }
            // 1. Layer 0: Perform Node AudioDSP & Essentia.js MIR Analysis if buffer provided
            let essentiaResult = undefined;
            let dspResult = undefined;
            if (targetBuffer) {
                dspResult = await audio_dsp_service_1.AudioDSPService.analyzeAudioBuffer(targetBuffer);
                essentiaResult = await essentia_service_1.EssentiaService.analyzeAudioBuffer(targetBuffer, song.genre);
            }
            // 2. Layer 1: DeepSeek AI A&R Engine Analysis
            const aiResult = await this.analyzeTrackWithDeepSeek(song.title, song.artist?.name || 'Artist', song.genre, song.subgenres || [], essentiaResult, dspResult);
            // 3. Layer 2: Spotify Audio Features API Integration (if Spotify URL attached)
            const existingMetadata = song.metadata || {};
            const spotifyUrl = existingMetadata.spotifyUrl;
            let spotifyAudioFeatures = null;
            let spotifyRelatedArtists = [];
            if (spotifyUrl) {
                spotifyAudioFeatures = await spotify_service_1.SpotifyService.getAudioFeatures(spotifyUrl);
            }
            if (song.artist?.name) {
                spotifyRelatedArtists = await spotify_service_1.SpotifyService.getRelatedArtistsByName(song.artist.name);
            }
            // Combine reference artists strictly from DeepSeek AI analysis, song model, and Spotify API
            const combinedReferenceArtists = Array.from(new Set([
                ...(song.similarArtists || []),
                ...(aiResult?.referenceArtists || []),
                ...spotifyRelatedArtists,
            ])).filter(Boolean);
            const combinedSubgenres = Array.from(new Set([
                ...(song.subgenres || []),
                ...(aiResult?.microSubgenres || []),
            ])).filter(Boolean);
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
            await prisma_1.prisma.song.update({
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
        }
        catch (err) {
            console.error(`[AudioScrutinizer Error] for song ${songId}:`, err.message);
        }
    }
}
exports.AudioScrutinizerService = AudioScrutinizerService;
