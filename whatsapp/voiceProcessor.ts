import { ParsedMessage, MessageType, VoiceNoteMetadata } from "./types";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { MODEL_NAME, SYSTEM_INSTRUCTION } from "../constants";
import { decodeAudio } from "../utils/audioUtils";

export class VoiceProcessor {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.API_KEY || "";
  }

  public async processVoiceMessage(
    message: ParsedMessage,
    audioBuffer?: Buffer,
  ): Promise<{
    transcription: string;
    language?: string;
    duration?: number;
    confidence?: number;
  }> {
    if (!this.isVoiceOrAudioMessage(message)) {
      throw new Error("Message is not a voice or audio message");
    }

    if (!audioBuffer) {
      throw new Error("Audio buffer is required for transcription");
    }

    const startTime = Date.now();

    try {
      const result = await this.transcribeAudio(
        audioBuffer,
        message.metadata?.mimeType || "audio/ogg",
      );

      return {
        transcription: result.transcription,
        language: result.language,
        duration: this.estimateDurationFromSize(audioBuffer.length),
        confidence: 0.95,
      };
    } catch (error) {
      console.error("Error processing voice message:", error);
      throw new Error(
        `Voice processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async transcribeAudio(
    audioBuffer: Buffer,
    mimeType: string,
  ): Promise<{ transcription: string; language?: string }> {
    if (!this.apiKey) {
      throw new Error("API key is required");
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    let transcription = "";
    let detectedLanguage = "";

    return new Promise(async (resolve, reject) => {
      try {
        const session = await ai.live.connect({
          model: MODEL_NAME,
          callbacks: {
            onopen: async () => {
              const base64Audio = audioBuffer.toString("base64");
              session.sendRealtimeInput({
                media: {
                  data: base64Audio,
                  mimeType: mimeType,
                },
              });
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.modelTurn?.parts) {
                for (const part of message.serverContent.modelTurn.parts) {
                  if (part.text) {
                    transcription += part.text;
                  }
                }
              }

              if (message.serverContent?.turnComplete) {
                if (transcription) {
                  detectedLanguage = this.detectLanguage(transcription);
                }

                session.close?.();

                resolve({
                  transcription: transcription.trim(),
                  language: detectedLanguage,
                });
              }
            },
            onerror: (error) => {
              console.error("Gemini transcription error:", error);
              session.close?.();
              reject(error);
            },
            onclose: () => {
              if (!transcription) {
                reject(new Error("No transcription received"));
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async transcribeAndRespond(
    audioBuffer: Buffer,
    mimeType: string = "audio/ogg",
  ): Promise<{
    transcription: string;
    responseAudio: Buffer;
    language?: string;
  }> {
    if (!this.apiKey) {
      throw new Error("API key is required");
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    let transcription = "";
    let responseAudioChunks: Uint8Array[] = [];
    let detectedLanguage = "";

    return new Promise(async (resolve, reject) => {
      try {
        const session = await ai.live.connect({
          model: MODEL_NAME,
          callbacks: {
            onopen: async () => {
              const base64Audio = audioBuffer.toString("base64");
              session.sendRealtimeInput({
                media: {
                  data: base64Audio,
                  mimeType: mimeType,
                },
              });
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.modelTurn?.parts) {
                for (const part of message.serverContent.modelTurn.parts) {
                  if (part.text) {
                    transcription += part.text;
                  }
                  if (part.inlineData?.data) {
                    const audioData = decodeAudio(part.inlineData.data);
                    responseAudioChunks.push(audioData);
                  }
                }
              }

              if (message.serverContent?.turnComplete) {
                if (transcription) {
                  detectedLanguage = this.detectLanguage(transcription);
                }

                const combinedAudio =
                  this.combineAudioChunks(responseAudioChunks);

                session.close?.();

                resolve({
                  transcription: transcription.trim(),
                  responseAudio: Buffer.from(combinedAudio),
                  language: detectedLanguage,
                });
              }
            },
            onerror: (error) => {
              console.error("Gemini Live error:", error);
              session.close?.();
              reject(error);
            },
            onclose: () => {
              if (!transcription && responseAudioChunks.length === 0) {
                reject(new Error("Session closed without response"));
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async generateAudioResponse(
    text: string,
    language?: string,
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error("API key is required");
    }

    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    let responseAudioChunks: Uint8Array[] = [];

    return new Promise(async (resolve, reject) => {
      try {
        const session = await ai.live.connect({
          model: MODEL_NAME,
          callbacks: {
            onopen: () => {
              session.sendRealtimeInput({ text: text });
            },
            onmessage: async (message: LiveServerMessage) => {
              const audioData =
                message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData) {
                responseAudioChunks.push(decodeAudio(audioData));
              }

              if (message.serverContent?.turnComplete) {
                const combinedAudio =
                  this.combineAudioChunks(responseAudioChunks);
                session.close?.();
                resolve(Buffer.from(combinedAudio));
              }
            },
            onerror: (error) => {
              console.error("Audio generation error:", error);
              session.close?.();
              reject(error);
            },
            onclose: () => {
              if (responseAudioChunks.length === 0) {
                reject(new Error("No audio generated"));
              }
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
            },
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private combineAudioChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined;
  }

  public extractAudioMetadata(audioBuffer: Buffer): VoiceNoteMetadata {
    const size = audioBuffer.length;
    const estimatedDuration = this.estimateDurationFromSize(size);

    return {
      duration: estimatedDuration,
      sampleRate: 16000,
      channels: 1,
      codec: "opus",
    };
  }

  private estimateDurationFromSize(sizeInBytes: number): number {
    const bytesPerSecond = 2048;
    return sizeInBytes / bytesPerSecond;
  }

  private isVoiceOrAudioMessage(message: ParsedMessage): boolean {
    return (
      message.type === MessageType.VOICE || message.type === MessageType.AUDIO
    );
  }

  public validateAudioBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length === 0) {
      return false;
    }
    if (buffer.length < 1024) {
      return false;
    }
    if (buffer.length > 16 * 1024 * 1024) {
      return false;
    }
    return true;
  }

  public cleanTranscription(text: string): string {
    let cleaned = text.trim().replace(/\s+/g, " ");

    const fillerWords = ["um", "uh", "er", "ah", "like"];
    const fillerPattern = new RegExp(`\\b(${fillerWords.join("|")})\\b`, "gi");
    cleaned = cleaned.replace(fillerPattern, "");

    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  public detectLanguage(text: string): string {
    if (/[\u0900-\u097F]/.test(text)) {
      return "hi";
    }
    if (/[\u0B00-\u0B7F]/.test(text)) {
      return "or";
    }
    if (/[\u0980-\u09FF]/.test(text)) {
      return "bn";
    }
    if (/[\u0C00-\u0C7F]/.test(text)) {
      return "te";
    }
    if (/[\u0B80-\u0BFF]/.test(text)) {
      return "ta";
    }
    return "en";
  }

  public splitAudioIntoChunks(
    audioBuffer: Buffer,
    chunkSizeInBytes: number = 1024 * 1024,
  ): Buffer[] {
    const chunks: Buffer[] = [];
    let offset = 0;

    while (offset < audioBuffer.length) {
      const chunk = audioBuffer.slice(offset, offset + chunkSizeInBytes);
      chunks.push(chunk);
      offset += chunkSizeInBytes;
    }

    return chunks;
  }

  public calculateAudioQuality(
    audioBuffer: Buffer,
    metadata: VoiceNoteMetadata,
  ): number {
    let score = 100;

    if (metadata.sampleRate && metadata.sampleRate < 16000) {
      score -= 20;
    }

    if (metadata.duration < 1) {
      score -= 30;
    } else if (metadata.duration > 120) {
      score -= 10;
    }

    const bitrate = (audioBuffer.length * 8) / metadata.duration / 1000;
    if (bitrate < 32) {
      score -= 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  public generateAudioFingerprint(audioBuffer: Buffer): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(audioBuffer).digest("hex");
  }

  public async batchProcessVoiceMessages(
    messages: ParsedMessage[],
    audioBuffers: Map<string, Buffer>,
  ): Promise<Map<string, { transcription: string; language?: string }>> {
    const results = new Map<
      string,
      { transcription: string; language?: string }
    >();

    for (const message of messages) {
      if (!this.isVoiceOrAudioMessage(message)) {
        continue;
      }

      const audioBuffer = audioBuffers.get(message.messageId);
      if (!audioBuffer) {
        console.warn(`No audio buffer found for message ${message.messageId}`);
        continue;
      }

      try {
        const result = await this.processVoiceMessage(message, audioBuffer);
        results.set(message.messageId, {
          transcription: result.transcription,
          language: result.language,
        });
      } catch (error) {
        console.error(`Failed to process message ${message.messageId}:`, error);
      }
    }

    return results;
  }
}

export const voiceProcessor = new VoiceProcessor();
