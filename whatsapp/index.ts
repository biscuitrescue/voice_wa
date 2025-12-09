

WhatsApp Integration Module
 *
This module provides comprehensive WhatsApp message handling including:
- Text message parsing
- Voice note transcription
- Multi-language support
- Intent detection
- Response generation
 


export { WhatsAppHandler, whatsappHandler } from './whatsappHandler';


export { MessageParser, messageParser } from './messageParser';


export { VoiceProcessor, voiceProcessor } from './voiceProcessor';


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
} from './types';


export {
  MessageType,
  MessageStatus,
} from './types';


export {
  handleTextMessageExample,
  handleVoiceMessageExample,
  handleWithCustomCriteriaExample,
  batchProcessingExample,
  individualComponentsExample,
  expressWebhookExample,
  runAllExamples,
} from './example';



Quick start example:
 *
```typescript
import { WhatsAppHandler } from './whatsapp';
 *
const handler = new WhatsAppHandler();
const processed = await handler.handleIncomingMessage(webhookPayload);
const response = handler.generateResponse(processed[0]);
```
 

export default WhatsAppHandler;
