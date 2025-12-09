import { Blob } from '@google/genai';

/**
 * Encodes ArrayBuffer to base64 string
 */
export function encodeAudio(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes base64 string to raw bytes
 */
export function decodeAudio(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts raw byte array to AudioBuffer for playback
 * Handles converting 16-bit PCM to Float32 for the AudioContext
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 [-32768, 32767] to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Creates a blob from Float32Array for Gemini API
 * Downsamples/Converts standard Web Audio (float 32) to PCM Int16
 */
export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to [-1, 1] before converting to PCM16 to prevent wrapping artifacts
    const sample = Math.max(-1, Math.min(1, data[i]));
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
  }
  
  return {
    data: encodeAudio(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

/**
 * Creates a silent audio blob of specified duration
 * Used to flush the VAD (Voice Activity Detection) on the server
 */
export function createSilentAudio(sampleRate: number = 16000, durationSec: number = 0.5): Blob {
    const length = sampleRate * durationSec;
    const int16 = new Int16Array(length); // Default is 0 (silence)
    
    return {
        data: encodeAudio(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000'
    };
}
