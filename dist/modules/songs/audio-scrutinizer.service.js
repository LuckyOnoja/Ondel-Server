"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioScrutinizerService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../../config/env");
const spotify_service_1 = require("../../services/spotify.service");
const audio_dsp_service_1 = require("../../services/audio-dsp.service");
const prisma_1 = require("../../config/prisma");
class AudioScrutinizerService {
    /**
     * DeepSeek A&R Engine: Analyzes track metadata and DSP signal measurements to generate exact micro-subgenres, mood/vibe, and reference artists
     */
    static async analyzeTrackWithDeepSeek(songTitle, artistName, genre, userSubgenres, dspSignal) {
        const deepseekKey = env_1.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!deepseekKey) {
            console.warn('⚠️ [AudioScrutinizer] DEEPSEEK_API_KEY is missing in server/.env');
            return null;
        }
        const bpm = dspSignal?.exactBpm || 118;
        const energy = dspSignal?.energyLevel || 7;
        const loudness = dspSignal?.rmsLoudnessDb || -10;
        const dynamics = dspSignal?.dynamicRange || 'Balanced Dynamics';
        try {
            console.log(`🧠 [DeepSeek A&R Engine] Analyzing Track "${songTitle}" by ${artistName} (${genre}, ${bpm} BPM)...`);
            const prompt = `You are a world-class music A&R, audio engineer, and playlist promotion strategist.
Analyze this track:
- Song Title: "${songTitle}"
- Artist Name: "${artistName}"
- Primary Genre: "${genre}"
- User Declared Subgenres: "${userSubgenres.join(', ') || genre}"

EXACT MATHEMATICAL AUDIO DSP SIGNAL MEASUREMENTS:
- Measured Tempo (BPM): ${bpm} BPM
- RMS Energy Level: ${energy} / 10
- RMS Loudness: ${loudness} dB
- Dynamic Range: ${dynamics}

CRITICAL TASK:
1. Micro-Subgenres: Identify 2-4 highly specific micro-subgenres (e.g. Amapiano Fusion, Street Hop, Afro-R&B, Melodic Trap, Alternative Pop).
2. Mood & Vibe: Emotional tone and aesthetic based on tempo (${bpm} BPM) and energy (${energy}/10).
3. Similar Reference Artists: List 3-5 mainstream and indie artists that this track's sound and vibe ACTUALLY MATCH. Do not give generic default lists. Tailor specifically to the title, genre, and subgenre style!
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
                    moodVibe: parsed.moodVibe || `${genre} Vibe`,
                    estimatedBpm: bpm,
                    energyLevel: energy,
                    referenceArtists: Array.isArray(parsed.referenceArtists) ? parsed.referenceArtists : [],
                    targetCuratorNotes: parsed.targetCuratorNotes || `Target ${genre} playlist curators and radio DJs.`,
                    dspAnalysis: dspSignal,
                };
            }
        }
        catch (err) {
            const errorDetails = err.response?.data?.error || err.message;
            console.warn(`[DeepSeek API Error]:`, typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails);
        }
        return null;
    }
    static getFallbackArtistsForGenre(genre, title) {
        const norm = (genre + ' ' + (title || '')).toLowerCase();
        const hash = (title || 'track').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        if (norm.includes('amapiano')) {
            const clusters = [
                ['Uncle Waffles', 'Kabza De Small', 'DJ Maphorisa', 'Felo Le Tee'],
                ['Musa Keys', 'Tyler ICU', 'Young Stunna', 'Vigro Deep'],
                ['Asake', 'Seyi Vibez', 'Shallipoppi', 'Kizz Daniel'],
            ];
            return clusters[hash % clusters.length];
        }
        if (norm.includes('afro')) {
            const clusters = [
                ['Asake', 'Burna Boy', 'Rema', 'Shallipoppi'],
                ['Wizkid', 'Davido', 'Omah Lay', 'Fireboy DML'],
                ['Ayra Starr', 'Tems', 'Victony', 'Rugged'],
                ['Seyi Vibez', 'BNXN', 'Lojay', 'Kizz Daniel'],
            ];
            return clusters[hash % clusters.length];
        }
        if (norm.includes('hip hop') || norm.includes('rap') || norm.includes('drill')) {
            const clusters = [
                ['Drake', 'Travis Scott', '21 Savage', 'Future'],
                ['Kendrick Lamar', 'J. Cole', 'Baby Keem', 'Pusha T'],
                ['Central Cee', 'Stormzy', 'Dave', 'Skepta'],
            ];
            return clusters[hash % clusters.length];
        }
        if (norm.includes('pop') || norm.includes('indie')) {
            const clusters = [
                ['Dua Lipa', 'The Weeknd', 'Harry Styles', 'Doja Cat'],
                ['Billie Eilish', 'Olivia Rodrigo', 'Tame Impala', 'Lorde'],
                ['Sabrina Carpenter', 'Chappell Roan', 'Gracie Abrams', 'Troye Sivan'],
            ];
            return clusters[hash % clusters.length];
        }
        if (norm.includes('r&b') || norm.includes('soul')) {
            const clusters = [
                ['SZA', 'Giveon', 'Daniel Caesar', 'H.E.R.'],
                ['Summer Walker', 'Brent Faiyaz', 'Lucky Daye', 'Kehlani'],
                ['Frank Ocean', 'Steve Lacy', 'Jhené Aiko', 'Syd'],
            ];
            return clusters[hash % clusters.length];
        }
        return ['Burna Boy', 'Wizkid', 'Rema', 'Asake'];
    }
    /**
     * Full Scrutinizer Workflow combining Layer 0 (DSP Engine), Layer 1 (DeepSeek A&R Engine), & Layer 2 (Spotify API)
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
            console.log(`🔍 [Ondel Scrutinizer Engine] Starting Track & Audio Analysis for "${song.title}"...`);
            console.log(`================================================================================`);
            // 1. Layer 0: Perform Deterministic Audio DSP Signal Processing
            let dspResult = undefined;
            if (audioBuffer) {
                dspResult = await audio_dsp_service_1.AudioDSPService.analyzeAudioBuffer(audioBuffer);
                console.log(`⚡ [Audio DSP Processor] Measured Tempo: ${dspResult.exactBpm} BPM | RMS Loudness: ${dspResult.rmsLoudnessDb} dB | Method: ${dspResult.detectionMethod}`);
            }
            // 2. Layer 1: DeepSeek AI A&R Engine Analysis (Replaces Gemini API)
            const aiResult = await this.analyzeTrackWithDeepSeek(song.title, song.artist?.name || 'Artist', song.genre, song.subgenres || [], dspResult);
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
            // Combine reference artists from DeepSeek AI analysis, song model, and Spotify
            const combinedReferenceArtists = Array.from(new Set([
                ...(song.similarArtists || []),
                ...(aiResult?.referenceArtists || []),
                ...spotifyRelatedArtists,
            ])).filter(Boolean);
            const combinedSubgenres = Array.from(new Set([
                ...(song.subgenres || []),
                ...(aiResult?.microSubgenres || []),
            ])).filter(Boolean);
            // Final BPM & Energy calculation: Spotify DSP > Audio DSP Processor > AI Fallback
            const finalBpm = spotifyAudioFeatures?.tempo
                ? Math.round(spotifyAudioFeatures.tempo)
                : dspResult?.exactBpm || aiResult?.estimatedBpm || 118;
            const finalEnergy = spotifyAudioFeatures?.energy
                ? Math.round(spotifyAudioFeatures.energy * 10)
                : dspResult?.energyLevel || aiResult?.energyLevel || 7;
            const vibe = aiResult?.moodVibe || song.soundVibe || `${song.genre} Vibe`;
            // Fallback similar reference artists if none returned
            if (combinedReferenceArtists.length === 0) {
                combinedReferenceArtists.push(...this.getFallbackArtistsForGenre(song.genre, song.title));
            }
            const curatorNotes = aiResult?.targetCuratorNotes || `Target ${song.genre} & ${combinedSubgenres.join(', ') || song.genre} official playlist curators, radio DJs, and music blogs.`;
            // Save scrutinized analysis into Song metadata and database fields
            const updatedMetadata = {
                ...existingMetadata,
                scrutinizedAt: new Date().toISOString(),
                moodVibe: vibe,
                estimatedBpm: finalBpm,
                energyLevel: finalEnergy,
                danceability: spotifyAudioFeatures?.danceability || null,
                valence: spotifyAudioFeatures?.valence || null,
                targetCuratorNotes: curatorNotes,
                dspAnalysis: dspResult || null,
                spotifyAudioFeatures,
            };
            await prisma_1.prisma.song.update({
                where: { id: songId },
                data: {
                    subgenres: combinedSubgenres,
                    similarArtists: combinedReferenceArtists,
                    soundVibe: vibe,
                    metadata: updatedMetadata,
                },
            });
            // Output comprehensive server console analysis card
            console.log(`\n================================================================================`);
            console.log(`✅ [Ondel Scrutinizer Engine] AUDIO & TRACK ANALYSIS COMPLETE`);
            console.log(`================================================================================`);
            console.log(`📌 Track Title        : "${song.title}"`);
            console.log(`👤 Artist Name        : ${song.artist?.name || 'Unknown Artist'}`);
            console.log(`🎸 Primary Genre      : ${song.genre}`);
            console.log(`🔥 Micro-Subgenres    : ${combinedSubgenres.length > 0 ? combinedSubgenres.join(', ') : 'Afro-Pop / Urban Fusion'}`);
            console.log(`⚡ Energy Level       : ${finalEnergy} / 10 ${dspResult ? `(RMS: ${dspResult.rmsLoudnessDb} dB)` : ''}`);
            console.log(`🥁 Measured Tempo     : ${finalBpm} BPM ${dspResult ? `[Method: ${dspResult.detectionMethod}]` : ''}`);
            console.log(`✨ Mood & Vibe        : ${vibe}`);
            console.log(`🎤 DeepSeek Sounds Like: ${combinedReferenceArtists.join(', ')}`);
            console.log(`--------------------------------------------------------------------------------`);
            console.log(`🎯 PLAYLISTER MATCHING INSIGHTS & RECOMMENDATIONS:`);
            console.log(`  • Ideal Curators   : ${curatorNotes}`);
            console.log(`  • Target Audiences : Fans of ${combinedReferenceArtists.slice(0, 3).join(', ')}`);
            console.log(`  • Pitch Campaign   : Recommend 1-on-1 Targeted Outreach & Auto-Matched Campaign`);
            console.log(`================================================================================\n`);
        }
        catch (err) {
            console.error(`[AudioScrutinizer Error] for song ${songId}:`, err.message);
        }
    }
}
exports.AudioScrutinizerService = AudioScrutinizerService;
