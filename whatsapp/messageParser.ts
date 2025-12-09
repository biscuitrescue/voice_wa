import {
  WhatsAppMessage,
  WhatsAppWebhookPayload,
  ParsedMessage,
  MessageType,
  ProcessedMessage,
  MessageStatus,
} from "./types";

export class MessageParser {
  public parseWebhookPayload(payload: WhatsAppWebhookPayload): ParsedMessage[] {
    const parsedMessages: ParsedMessage[] = [];

    if (!payload.entry || payload.entry.length === 0) {
      return parsedMessages;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const messages = change.value.messages;

        if (!messages || messages.length === 0) {
          continue;
        }

        for (const message of messages) {
          try {
            const parsed = this.parseMessage(message);
            if (parsed) {
              parsedMessages.push(parsed);
            }
          } catch (error) {
            console.error(`Failed to parse message ${message.id}:`, error);
          }
        }
      }
    }

    return parsedMessages;
  }

  public parseMessage(message: WhatsAppMessage): ParsedMessage | null {
    const baseMessage = {
      messageId: message.id,
      from: message.from,
      timestamp: new Date(parseInt(message.timestamp) * 1000),
    };

    switch (message.type) {
      case MessageType.TEXT:
        return this.parseTextMessage(message, baseMessage);

      case MessageType.VOICE:
        return this.parseVoiceMessage(message, baseMessage);

      case MessageType.AUDIO:
        return this.parseAudioMessage(message, baseMessage);

      default:
        console.warn(`Unsupported message type: ${message.type}`);
        return null;
    }
  }

  private parseTextMessage(
    message: WhatsAppMessage,
    baseMessage: Partial<ParsedMessage>,
  ): ParsedMessage {
    if (!message.text || !message.text.body) {
      throw new Error("Text message missing body content");
    }

    return {
      ...baseMessage,
      type: MessageType.TEXT,
      content: message.text.body,
    } as ParsedMessage;
  }

  private parseVoiceMessage(
    message: WhatsAppMessage,
    baseMessage: Partial<ParsedMessage>,
  ): ParsedMessage {
    if (!message.voice) {
      throw new Error("Voice message missing voice data");
    }

    return {
      ...baseMessage,
      type: MessageType.VOICE,
      content: "",
      metadata: {
        mediaId: message.voice.id,
        mimeType: message.voice.mime_type,
        sha256: message.voice.sha256,
      },
    } as ParsedMessage;
  }

  private parseAudioMessage(
    message: WhatsAppMessage,
    baseMessage: Partial<ParsedMessage>,
  ): ParsedMessage {
    if (!message.audio) {
      throw new Error("Audio message missing audio data");
    }

    return {
      ...baseMessage,
      type: MessageType.AUDIO,
      content: "",
      metadata: {
        mediaId: message.audio.id,
        mimeType: message.audio.mime_type,
        sha256: message.audio.sha256,
      },
    } as ParsedMessage;
  }

  public extractTextContent(message: ParsedMessage): string {
    if (message.type === MessageType.TEXT) {
      return message.content as string;
    }
    return "";
  }

  public isVoiceMessage(message: ParsedMessage): boolean {
    return (
      message.type === MessageType.VOICE || message.type === MessageType.AUDIO
    );
  }

  public validateMessage(message: WhatsAppMessage): boolean {
    if (!message.id || !message.from || !message.timestamp || !message.type) {
      return false;
    }

    switch (message.type) {
      case MessageType.TEXT:
        return !!(message.text && message.text.body);

      case MessageType.VOICE:
        return !!(message.voice && message.voice.id);

      case MessageType.AUDIO:
        return !!(message.audio && message.audio.id);

      default:
        return false;
    }
  }

  public createProcessedMessage(
    parsedMessage: ParsedMessage,
    additionalData: Partial<ProcessedMessage> = {},
  ): ProcessedMessage {
    return {
      originalMessage: parsedMessage,
      status: MessageStatus.PENDING,
      processingTime: 0,
      ...additionalData,
    };
  }

  public normalizePhoneNumber(phone: string): string {
    let normalized = phone.replace(/\D/g, "");
    normalized = normalized.replace(/^0+/, "");
    return normalized;
  }

  public extractMetadata(message: ParsedMessage): Record<string, any> {
    return {
      messageId: message.messageId,
      from: message.from,
      timestamp: message.timestamp.toISOString(),
      type: message.type,
      hasMetadata: !!message.metadata,
      metadataKeys: message.metadata ? Object.keys(message.metadata) : [],
    };
  }

  public batchParseMessages(messages: WhatsAppMessage[]): ParsedMessage[] {
    const parsed: ParsedMessage[] = [];

    for (const message of messages) {
      try {
        const parsedMessage = this.parseMessage(message);
        if (parsedMessage) {
          parsed.push(parsedMessage);
        }
      } catch (error) {
        console.error(`Error parsing message ${message.id}:`, error);
      }
    }

    return parsed;
  }

  public filterMessagesByType(
    messages: ParsedMessage[],
    type: MessageType,
  ): ParsedMessage[] {
    return messages.filter((msg) => msg.type === type);
  }

  public getMessagesInTimeRange(
    messages: ParsedMessage[],
    startTime: Date,
    endTime: Date,
  ): ParsedMessage[] {
    return messages.filter(
      (msg) => msg.timestamp >= startTime && msg.timestamp <= endTime,
    );
  }
}

export const messageParser = new MessageParser();
