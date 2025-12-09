# WhatsApp Integration Setup

Simple setup to handle WhatsApp text messages and voice notes using Gemini AI.

## Quick Start

### 1. Install Dependencies

```bash
npm install express
```

### 2. Environment Variables

Create `.env` file:

```bash
API_KEY=your_gemini_api_key
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
PHONE_NUMBER_ID=your_phone_number_id
WEBHOOK_VERIFY_TOKEN=your_verify_token
PORT=3000
```

### 3. Run Server

```bash
node whatsapp-server.js
```

### 4. Setup WhatsApp Webhook

1. Go to Meta Developer Console
2. Configure Webhook URL: `https://your-domain.com/webhook`
3. Set Verify Token (same as `WEBHOOK_VERIFY_TOKEN`)
4. Subscribe to `messages` webhook

## Usage

### Handle Text Message

```typescript
import { WhatsAppHandler } from './whatsapp';

const handler = new WhatsAppHandler(process.env.API_KEY);

const payload = {
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: "919876543210",
          id: "msg_123",
          type: "text",
          text: { body: "मुझे सरसों के बारे में बताएं" }
        }]
      }
    }]
  }]
};

const processed = await handler.handleIncomingMessage(payload);
const response = handler.generateResponse(processed[0]);

console.log(response.text.body);
```

### Handle Voice Message

```typescript
const payload = {
  object: "whatsapp_business_account",
  entry: [{
    changes: [{
      value: {
        messages: [{
          from: "919876543210",
          id: "voice_123",
          type: "voice",
          voice: {
            id: "MEDIA_ID",
            mime_type: "audio/ogg; codecs=opus"
          }
        }]
      }
    }]
  }]
};

const audioBuffer = await fetchMediaFromWhatsApp("MEDIA_ID");
const audioBuffers = new Map();
audioBuffers.set("voice_123", audioBuffer);

const processed = await handler.handleIncomingMessage(payload, audioBuffers);

console.log("Transcription:", processed[0].transcription);
console.log("Language:", processed[0].detectedLanguage);
console.log("Intent:", processed[0].extractedIntent);
```

### Fetch Media from WhatsApp

```typescript
async function fetchMediaFromWhatsApp(mediaId: string): Promise<Buffer> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  
  const urlResponse = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    { headers: { Authorization: `Bearer ${token}` }}
  );
  
  const { url } = await urlResponse.json();
  
  const mediaResponse = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const arrayBuffer = await mediaResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
```

### Send Response

```typescript
async function sendResponse(response: WhatsAppResponse) {
  const phoneId = process.env.PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  
  await fetch(
    `https://graph.facebook.com/v18.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(response)
    }
  );
}
```

## Features

- **Text Messages**: Auto-detects language (Hindi, Odia, English, etc.)
- **Voice Notes**: Transcribes using Gemini Live API
- **Intent Detection**: Identifies farming queries (pest control, fertilizer, weather, etc.)
- **Multi-language**: Responds in detected language

## API Reference

### WhatsAppHandler

```typescript
const handler = new WhatsAppHandler(apiKey?, responseCriteria?);
```

**Methods:**

- `handleIncomingMessage(payload, audioBuffers?)` - Process webhook payload
- `generateResponse(processedMessage, criteria?)` - Generate response
- `batchProcessMessages(payloads, audioBuffersMap?)` - Process multiple
- `getMessageStats(messages)` - Get processing stats

### VoiceProcessor

```typescript
const processor = new VoiceProcessor(apiKey?);
```

**Methods:**

- `processVoiceMessage(message, audioBuffer)` - Transcribe voice
- `transcribeAndRespond(audioBuffer, mimeType?)` - Transcribe + generate audio response
- `generateAudioResponse(text, language?)` - Text to speech
- `validateAudioBuffer(buffer)` - Validate audio
- `cleanTranscription(text)` - Clean up text

### MessageParser

```typescript
const parser = new MessageParser();
```

**Methods:**

- `parseWebhookPayload(payload)` - Parse webhook
- `parseMessage(message)` - Parse single message
- `validateMessage(message)` - Validate structure
- `filterMessagesByType(messages, type)` - Filter by type

## Response Criteria

```typescript
const criteria = {
  language: "auto",
  maxResponseLength: 1600,
  includeContext: true,
  responseFormat: "conversational", // "brief" | "detailed" | "conversational"
  topics: []
};

const handler = new WhatsAppHandler(apiKey, criteria);
```

## Intent Detection

Automatically detects:
- `pest_control` - Pest, insect, disease queries
- `fertilizer` - Fertilizer recommendations
- `weather` - Weather information
- `seed_variety` - Seed selection
- `market_price` - Market prices
- `planting` - Planting advice
- `harvest` - Harvesting tips
- `irrigation` - Water management
- `mustard`, `groundnut`, `sunflower` - Crop-specific

## Testing Locally

Use ngrok for local testing:

```bash
ngrok http 3000
```

Use the ngrok URL as your webhook URL in Meta Developer Console.

## Production Deployment

1. Deploy to cloud (Heroku, Railway, Vercel, etc.)
2. Set environment variables
3. Update webhook URL in Meta Console
4. Enable webhook subscriptions for `messages`

## Example Express Server

See `whatsapp-server.js` for complete example.

## Troubleshooting

**Voice messages not processing:**
- Check audio buffer is fetched correctly
- Verify Gemini API key
- Ensure audio format is supported (OGG/Opus)

**Wrong language detected:**
- Check if text contains proper Unicode characters
- Force language in ResponseCriteria

**Webhook not receiving messages:**
- Verify webhook URL is publicly accessible
- Check verify token matches
- Ensure subscribed to `messages` events