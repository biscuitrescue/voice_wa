export { WhatsAppHandler, whatsappHandler } from "./whatsappHandler";
export { MessageParser, messageParser } from "./messageParser";
export { VoiceProcessor, voiceProcessor } from "./voiceProcessor";

export type {
  WhatsAppMessage,
  WhatsAppTextMessage,
  WhatsAppVoiceMessage,
  WhatsAppAudioMessage,
  WhatsAppWebhookPayload,
  WhatsAppContact,
  ParsedMessage,
  ProcessedMessage,
  WhatsAppResponse,
  ResponseCriteria,
  VoiceNoteMetadata,
} from "./types";

export { MessageType, MessageStatus } from "./types";

export default WhatsAppHandler;
