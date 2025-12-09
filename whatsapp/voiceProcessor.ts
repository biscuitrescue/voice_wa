import { ParsedMessage, MessageType, VoiceNoteMetadata } from "./types";

export class VoiceProcessor {
  private apiKey: string;
  private transcriptionEndpoint: string =
    "https://api.openai.com/v1/audio/transcriptions";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
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
      const transcription = await this.transcribeAudio(
        audioBuffer,
        message.metadata?.mimeType,
      );

      const processingTime = Date.now() - startTime;

      return {
        transcription: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        confidence: transcription.confidence,
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
    mimeType?: string,
  ): Promise<{
    text: string;
    language?: string;
    duration?: number;
    confidence?: number;
  }> {
    return this.mockTranscription(audioBuffer, mimeType);
  }

  private async mockTranscription(
    audioBuffer: Buffer,
    mimeType?: string,
  ): Promise<{
    text: string;
    language?: string;
    duration?: number;
    confidence?: number;
  }> {
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      text: "This is a mock transcription of the voice message. Replace this with actual transcription service.",
      language: "en",
      duration: 5.2,
      confidence: 0.95,
    };
  }

  public async transcribeWithWebSpeechAPI(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (
        !("webkitSpeechRecognition" in window) &&
        !("SpeechRecognition" in window)
      ) {
        reject(new Error("Speech recognition not supported in this browser"));
        return;
      }

      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      recognition.start();
    });
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

  public async convertAudioFormat(
    audioBuffer: Buffer,
    fromFormat: string,
    toFormat: string,
  ): Promise<Buffer> {
    console.warn("Audio conversion not implemented, returning original buffer");
    return audioBuffer;
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
