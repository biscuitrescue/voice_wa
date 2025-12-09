import { WhatsAppHandler } from "./index";
import { WhatsAppWebhookPayload, MessageType } from "./types";

const handler = new WhatsAppHandler(process.env.API_KEY);

async function handleTextMessage() {
  const payload: WhatsAppWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "919876543210",
                phone_number_id: "PHONE_NUMBER_ID",
              },
              messages: [
                {
                  from: "919876543210",
                  id: "msg_123",
                  timestamp: "1640000000",
                  type: MessageType.TEXT,
                  text: {
                    body: "मुझे सरसों की फसल के बारे में बताएं",
                  },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const processed = await handler.handleIncomingMessage(payload);
  const response = handler.generateResponse(processed[0]);

  console.log("Transcription:", processed[0].transcription);
  console.log("Language:", processed[0].detectedLanguage);
  console.log("Intent:", processed[0].extractedIntent);
  console.log("Response:", response.text?.body);
}

async function handleVoiceMessage() {
  const payload: WhatsAppWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "BUSINESS_ACCOUNT_ID",
        changes: [
          {
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "919876543210",
                phone_number_id: "PHONE_NUMBER_ID",
              },
              messages: [
                {
                  from: "919123456789",
                  id: "voice_msg_456",
                  timestamp: "1640000100",
                  type: MessageType.VOICE,
                  voice: {
                    id: "VOICE_MEDIA_ID",
                    mime_type: "audio/ogg; codecs=opus",
                    sha256: "abc123",
                  },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };

  const audioBuffer = await fetchWhatsAppMedia("VOICE_MEDIA_ID");

  const audioBuffers = new Map<string, Buffer>();
  audioBuffers.set("voice_msg_456", audioBuffer);

  const processed = await handler.handleIncomingMessage(payload, audioBuffers);
  const response = handler.generateResponse(processed[0]);

  console.log("Transcription:", processed[0].transcription);
  console.log("Language:", processed[0].detectedLanguage);
  console.log("Intent:", processed[0].extractedIntent);
  console.log("Response:", response.text?.body);
}

async function fetchWhatsAppMedia(mediaId: string): Promise<Buffer> {
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const mediaUrlResponse = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    }
  );

  const { url } = await mediaUrlResponse.json();

  const mediaResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  const arrayBuffer = await mediaResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function sendWhatsAppResponse(response: any) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  await fetch(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
    }
  );
}

async function webhookHandler(req: any, res: any) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
    return;
  }

  if (req.method === "POST") {
    res.sendStatus(200);

    const payload = req.body;

    const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages || [];

    const audioBuffers = new Map<string, Buffer>();
    for (const msg of messages) {
      if (msg.type === MessageType.VOICE || msg.type === MessageType.AUDIO) {
        const mediaId = msg.voice?.id || msg.audio?.id;
        if (mediaId) {
          const buffer = await fetchWhatsAppMedia(mediaId);
          audioBuffers.set(msg.id, buffer);
        }
      }
    }

    const processed = await handler.handleIncomingMessage(payload, audioBuffers);

    for (const msg of processed) {
      const response = handler.generateResponse(msg);
      await sendWhatsAppResponse(response);
    }
  }
}

export { handleTextMessage, handleVoiceMessage, webhookHandler };
