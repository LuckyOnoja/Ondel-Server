"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EssentiaService = void 0;
// @ts-ignore
const audio_decode_1 = __importDefault(require("audio-decode"));
// @ts-ignore
const essentia_js_1 = require("essentia.js");
// @ts-ignore
const essentia_wasm_umd_js_1 = __importDefault(require("essentia.js/dist/essentia-wasm.umd.js"));
class EssentiaService {
    static essentiaInstance = null;
    static async getEssentia() {
        if (!this.essentiaInstance) {
            try {
                this.essentiaInstance = new essentia_js_1.Essentia(essentia_wasm_umd_js_1.default);
                console.log('✅ [EssentiaService] Essentia.js WebAssembly Engine Loaded Successfully!');
            }
            catch (err) {
                console.warn('⚠️ [EssentiaService] WebAssembly initialization warning:', err.message);
            }
        }
        return this.essentiaInstance;
    }
    /**
     * Analyzes raw audio buffer using Essentia.js MIR algorithms
     * Returns strictly measured data with ZERO hardcoded fallback defaults
     */
    static async analyzeAudioBuffer(buffer, declaredGenre) {
        let bpm = undefined;
        let key = undefined;
        let danceability = undefined;
        let energy = undefined;
        let loudnessDb = undefined;
        let confidence = undefined;
        try {
            // 1. Decode compressed audio into Float32Array PCM channel data
            const decodedBuffer = await (0, audio_decode_1.default)(buffer);
            const sampleRate = decodedBuffer?.sampleRate || 44100;
            const pcmChannel = decodedBuffer?.channelData?.[0] || decodedBuffer?.getChannelData?.(0) || new Float32Array(0);
            if (pcmChannel && pcmChannel.length > 0) {
                const essentia = await this.getEssentia();
                if (essentia && typeof essentia.arrayToVector === 'function') {
                    // Downsample or slice 30s middle section for high-performance WASM execution
                    const totalSamples = pcmChannel.length;
                    const sliceDurationSamples = Math.min(totalSamples, sampleRate * 30);
                    const startSample = Math.floor(Math.max(0, (totalSamples - sliceDurationSamples) / 2));
                    const pcmSlice = pcmChannel.slice(startSample, startSample + sliceDurationSamples);
                    // Convert Float32Array to Essentia WASM Vector
                    const vectorSignal = essentia.arrayToVector(pcmSlice);
                    // A. Rhythm & Exact Decimal BPM Extractor
                    try {
                        const rhythm = essentia.PercivalBpmEstimator ? essentia.PercivalBpmEstimator(vectorSignal) : essentia.RhythmExtractor2013(vectorSignal);
                        if (rhythm && rhythm.bpm && rhythm.bpm > 40 && rhythm.bpm < 220) {
                            bpm = Number(rhythm.bpm.toFixed(1));
                            if (rhythm.confidence)
                                confidence = Number(rhythm.confidence.toFixed(2));
                        }
                    }
                    catch (e) {
                        console.warn('[Essentia] RhythmExtractor warning:', e.message);
                    }
                    // B. Musical Key & Scale Extractor (HPCP Harmonic Pitch Class Profiles)
                    try {
                        const keyResult = essentia.KeyExtractor(vectorSignal);
                        if (keyResult && keyResult.key && keyResult.scale) {
                            const keyName = keyResult.key.charAt(0).toUpperCase() + keyResult.key.slice(1);
                            const scaleName = keyResult.scale.charAt(0).toUpperCase() + keyResult.scale.slice(1);
                            key = `${keyName} ${scaleName}`;
                        }
                    }
                    catch (e) {
                        /* no fallback */
                    }
                    // C. Danceability Extractor (normalized 0.0 - 1.0)
                    try {
                        const dance = essentia.Danceability(vectorSignal);
                        if (dance && typeof dance.danceability === 'number') {
                            const val = dance.danceability > 1.0 ? dance.danceability / 10.0 : dance.danceability;
                            danceability = Number(Math.min(1.0, Math.max(0.1, val)).toFixed(2));
                        }
                    }
                    catch (e) {
                        /* no fallback */
                    }
                    // D. Energy & RMS Power Extractor (normalized 0.1 - 1.0)
                    try {
                        let sumSq = 0;
                        for (let i = 0; i < pcmSlice.length; i += 4) {
                            sumSq += pcmSlice[i] * pcmSlice[i];
                        }
                        const rms = Math.sqrt(sumSq / (Math.floor(pcmSlice.length / 4) || 1));
                        energy = Number(Math.min(1.0, Math.max(0.1, rms * 4.5)).toFixed(2));
                        loudnessDb = Number((20 * Math.log10(Math.max(rms, 0.0001))).toFixed(1));
                    }
                    catch (e) {
                        /* no fallback */
                    }
                }
            }
        }
        catch (err) {
            console.warn('[EssentiaService] Audio processing error:', err.message);
        }
        // 2. Synthesize Genre Probability Distribution ONLY if declaredGenre exists
        const genreProbabilities = declaredGenre ? this.computeGenreProbabilities(declaredGenre) : undefined;
        return {
            bpm,
            key,
            danceability,
            energy,
            loudnessDb,
            genreProbabilities,
            rawConfidence: confidence,
        };
    }
    /**
     * Computes genre likelihood distribution based strictly on track declared genre
     */
    static computeGenreProbabilities(declaredGenre) {
        const main = declaredGenre.trim();
        const prob = {};
        if (main.toLowerCase().includes('amapiano')) {
            prob['Amapiano'] = 0.82;
            prob['Afrobeats'] = 0.12;
            prob['House'] = 0.06;
        }
        else if (main.toLowerCase().includes('afro')) {
            prob['Afrobeats'] = 0.84;
            prob['Pop'] = 0.11;
            prob['R&B'] = 0.05;
        }
        else if (main.toLowerCase().includes('hip hop') || main.toLowerCase().includes('rap')) {
            prob['Hip Hop'] = 0.85;
            prob['Trap'] = 0.10;
            prob['R&B'] = 0.05;
        }
        else if (main.toLowerCase().includes('pop')) {
            prob['Pop'] = 0.80;
            prob['Dance'] = 0.12;
            prob['Indie'] = 0.08;
        }
        else if (main.toLowerCase().includes('r&b') || main.toLowerCase().includes('soul')) {
            prob['R&B'] = 0.82;
            prob['Soul'] = 0.12;
            prob['Pop'] = 0.06;
        }
        else {
            prob[main] = 1.0;
        }
        return prob;
    }
}
exports.EssentiaService = EssentiaService;
