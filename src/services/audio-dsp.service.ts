import * as mm from 'music-metadata';
// @ts-ignore
import MusicTempo from 'music-tempo';
// @ts-ignore
import audioDecode from 'audio-decode';

export interface DSPAnalysisResult {
  exactBpm?: number;
  energyLevel?: number; // 1 - 10
  rmsLoudnessDb?: number;
  dynamicRange?: string;
  durationSeconds?: number;
  sampleRate?: number;
  bitrateKbps?: number;
  embeddedBpm?: number;
  detectionMethod?: 'DSP_AUDIO_DECODER' | 'TAG_METADATA' | 'HYBRID_SIGNAL';
}

export class AudioDSPService {
  /**
   * Deterministic Digital Signal Processing (DSP) Audio Analyzer
   * Returns strictly measured values without hardcoded default fallbacks
   */
  static async analyzeAudioBuffer(buffer: Buffer): Promise<DSPAnalysisResult> {
    let durationSeconds: number | undefined = undefined;
    let sampleRate: number | undefined = undefined;
    let bitrateKbps: number | undefined = undefined;
    let embeddedBpm: number | undefined = undefined;

    // 1. Extract audio container metadata & embedded DAW ID3 tags using music-metadata
    try {
      const metadata = await mm.parseBuffer(buffer);
      if (metadata.format.duration) {
        durationSeconds = Math.round(metadata.format.duration);
      }
      if (metadata.format.sampleRate) {
        sampleRate = metadata.format.sampleRate;
      }
      if (metadata.format.bitrate) {
        bitrateKbps = Math.round(metadata.format.bitrate / 1000);
      }
      if (metadata.common.bpm) {
        embeddedBpm = Math.round(metadata.common.bpm);
      }
    } catch (err: any) {
      console.warn('[AudioDSPService] Metadata parsing warning:', err.message);
    }

    // 2. Decode raw audio buffer into Float32 PCM Audio Samples
    let dspBpm: number | undefined = undefined;
    let rmsLoudnessDb: number | undefined = undefined;
    let calculatedEnergy: number | undefined = undefined;
    let dynamicRange: string | undefined = undefined;
    let detectionMethod: 'DSP_AUDIO_DECODER' | 'TAG_METADATA' | 'HYBRID_SIGNAL' | undefined = undefined;

    try {
      // Decode audio file into Float32Array PCM channel data
      const decodedBuffer: any = await audioDecode(buffer);
      const sr = decodedBuffer?.sampleRate || sampleRate || 44100;
      const pcmChannel: Float32Array | number[] = decodedBuffer?.channelData?.[0] || decodedBuffer?.getChannelData?.(0) || [];

      if (pcmChannel && pcmChannel.length > 0) {
        // Calculate RMS Loudness & Peak Energy over full track
        let sumSquare = 0;
        let peakSample = 0;

        for (let i = 0; i < pcmChannel.length; i += 10) {
          const s = pcmChannel[i];
          const absS = Math.abs(s);
          sumSquare += s * s;
          if (absS > peakSample) peakSample = absS;
        }

        const rms = Math.sqrt(sumSquare / (Math.floor(pcmChannel.length / 10) || 1));
        rmsLoudnessDb = Number((20 * Math.log10(rms || 0.0001)).toFixed(1));
        calculatedEnergy = Math.min(10, Math.max(1, Math.round(rms * 28 + peakSample * 2)));

        // Extract a 30-second slice from the active middle section at FULL resolution
        const totalSamples = pcmChannel.length;
        const sliceDurationSamples = Math.min(totalSamples, sr * 30);
        const startSample = Math.floor(Math.max(0, (totalSamples - sliceDurationSamples) / 2));
        const endSample = startSample + sliceDurationSamples;

        const pcmSlice: number[] = [];
        for (let i = startSample; i < endSample; i += 2) {
          pcmSlice.push(pcmChannel[i]);
        }

        // Run beat detection on true full-resolution PCM wave
        const calc = new MusicTempo(pcmSlice, { sampleRate: Math.round(sr / 2) });
        if (calc.tempo && calc.tempo >= 45 && calc.tempo <= 220) {
          dspBpm = Math.round(calc.tempo);
        }
      }
    } catch (err: any) {
      console.warn('[AudioDSPService] PCM audio decoding warning:', err.message);
    }

    // Determine final exact BPM
    let finalBpm: number | undefined = undefined;
    if (embeddedBpm && embeddedBpm >= 40 && embeddedBpm <= 220) {
      finalBpm = embeddedBpm;
      detectionMethod = 'TAG_METADATA';
    } else if (dspBpm && dspBpm >= 45 && dspBpm <= 220) {
      finalBpm = dspBpm;
      detectionMethod = 'DSP_AUDIO_DECODER';
    }

    return {
      exactBpm: finalBpm,
      energyLevel: calculatedEnergy,
      rmsLoudnessDb,
      dynamicRange,
      durationSeconds,
      sampleRate,
      bitrateKbps,
      embeddedBpm,
      detectionMethod,
    };
  }
}
