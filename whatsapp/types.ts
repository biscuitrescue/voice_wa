export enum MessageType {
  TEXT = "text",
  VOICE = "voice",
  IMAGE = "image",
  DOCUMENT = "document",
  AUDIO = "audio",
}

export enum MessageStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface WhatsAppContact {
  name: string;
  phone: string;
  wa_id?: string;
}

export interface WhatsAppTextMessage {
  type: MessageType.TEXT;
  text: {
    body: string;
  };
}

export interface WhatsAppVoiceMessage {
  type: MessageType.VOICE;
  voice: {
    id: string;
    mime_type: string;
    sha256: string;
    url?: string;
    buffer?: Buffer;
  };
}

export interface WhatsAppAudioMessage {
  type: MessageType.AUDIO;
  audio: {
    id: string;
    mime_type: string;
    sha256: string;
    url?: string;
    buffer?: Buffer;
  };
}

export interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  type: MessageType;
  text?: {
    body: string;
  };
  voice?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
        statuses?: any[];
      };
      field: string;
    }>;
  }>;
}

export interface ParsedMessage {
  messageId: string;
  from: string;
  timestamp: Date;
  type: MessageType;
  content: string | Buffer;
  metadata?: {
    mimeType?: string;
    sha256?: string;
    mediaId?: string;
    duration?: number;
  };
}

export interface ProcessedMessage {
  originalMessage: ParsedMessage;
  transcription?: string;
  detectedLanguage?: string;
  extractedIntent?: string;
  status: MessageStatus;
  processingTime: number;
}

export interface WhatsAppResponse {
  to: string;
  type: "text" | "audio";
  text?: {
    body: string;
  };
  audio?: {
    link: string;
  };
}

export interface ResponseCriteria {
  language?: string;
  maxResponseLength?: number;
  includeContext?: boolean;
  responseFormat?: "detailed" | "brief" | "conversational";
  topics?: string[];
}

export interface VoiceNoteMetadata {
  duration: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
}
