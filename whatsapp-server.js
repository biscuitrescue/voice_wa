const express = require('express');
const { WhatsAppHandler } = require('./whatsapp/index');

const app = express();
app.use(express.json());

const handler = new WhatsAppHandler(process.env.API_KEY);

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    res.sendStatus(200);

    const payload = req.body;

    if (!payload.entry?.[0]?.changes?.[0]?.value?.messages) {
      return;
    }

    const messages = payload.entry[0].changes[0].value.messages;
    const audioBuffers = new Map();

    for (const msg of messages) {
      if (msg.type === 'voice' || msg.type === 'audio') {
        const mediaId = msg.voice?.id || msg.audio?.id;
        if (mediaId) {
          try {
            const buffer = await fetchWhatsAppMedia(mediaId);
            audioBuffers.set(msg.id, buffer);
          } catch (error) {
            console.error('Failed to fetch media:', error);
          }
        }
      }
    }

    const processed = await handler.handleIncomingMessage(payload, audioBuffers);

    for (const msg of processed) {
      const response = handler.generateResponse(msg);
      await sendWhatsAppMessage(response);
    }
  } catch (error) {
    console.error('Webhook error:', error);
  }
});

async function fetchWhatsAppMedia(mediaId) {
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const mediaUrlResponse = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    }
  );

  const data = await mediaUrlResponse.json();

  const mediaResponse = await fetch(data.url, {
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
  });

  const arrayBuffer = await mediaResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function sendWhatsAppMessage(response) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

  const result = await fetch(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    }
  );

  const data = await result.json();
  console.log('Message sent:', data);
  return data;
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`WhatsApp webhook server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
});
