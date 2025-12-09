import { MessageParser } from "./messageParser";
import { VoiceProcessor } from "./voiceProcessor";
import {
  WhatsAppWebhookPayload,
  ParsedMessage,
  ProcessedMessage,
  MessageType,
  MessageStatus,
  ResponseCriteria,
  WhatsAppResponse,
} from "./types";

export class WhatsAppHandler {
  private messageParser: MessageParser;
  private voiceProcessor: VoiceProcessor;
  private responseCriteria: ResponseCriteria;

  constructor(apiKey?: string, responseCriteria?: ResponseCriteria) {
    this.messageParser = new MessageParser();
    this.voiceProcessor = new VoiceProcessor(apiKey);
    this.responseCriteria = responseCriteria || this.getDefaultCriteria();
  }

  public async handleIncomingMessage(
    payload: WhatsAppWebhookPayload,
    audioBuffers?: Map<string, Buffer>
  ): Promise<ProcessedMessage[]> {
    const startTime = Date.now();

    try {
      const parsedMessages = this.messageParser.parseWebhookPayload(payload);

      if (parsedMessages.length === 0) {
        return [];
      }

      const processedMessages: ProcessedMessage[] = [];

      for (const message of parsedMessages) {
        try {
          const processed = await this.processMessage(message, audioBuffers);
          processedMessages.push(processed);
        } catch (error) {
          processedMessages.push({
            originalMessage: message,
            status: MessageStatus.FAILED,
            processingTime: Date.now() - startTime,
          });
        }
      }

      return processedMessages;
    } catch (error) {
      console.error("Error handling incoming message:", error);
      throw error;
    }
  }

  private async processMessage(
    message: ParsedMessage,
    audioBuffers?: Map<string, Buffer>
  ): Promise<ProcessedMessage> {
    const startTime = Date.now();

    let processedMessage: ProcessedMessage = {
      originalMessage: message,
      status: MessageStatus.PROCESSING,
      processingTime: 0,
    };

    try {
      if (message.type === MessageType.TEXT) {
        processedMessage = await this.processTextMessage(message);
      } else if (
        message.type === MessageType.VOICE ||
        message.type === MessageType.AUDIO
      ) {
        const audioBuffer = audioBuffers?.get(message.messageId);
        if (!audioBuffer) {
          throw new Error("Audio buffer not found for voice message");
        }
        processedMessage = await this.processVoiceMessage(message, audioBuffer);
      }

      processedMessage.status = MessageStatus.COMPLETED;
      processedMessage.processingTime = Date.now() - startTime;

      return processedMessage;
    } catch (error) {
      return {
        ...processedMessage,
        status: MessageStatus.FAILED,
        processingTime: Date.now() - startTime,
      };
    }
  }

  private async processTextMessage(
    message: ParsedMessage
  ): Promise<ProcessedMessage> {
    const textContent = message.content as string;
    const detectedLanguage = this.detectLanguageFromText(textContent);
    const extractedIntent = this.extractIntent(textContent);

    return {
      originalMessage: message,
      detectedLanguage,
      extractedIntent,
      status: MessageStatus.PROCESSING,
      processingTime: 0,
    };
  }

  private async processVoiceMessage(
    message: ParsedMessage,
    audioBuffer: Buffer
  ): Promise<ProcessedMessage> {
    if (!this.voiceProcessor.validateAudioBuffer(audioBuffer)) {
      throw new Error("Invalid audio buffer");
    }

    const transcriptionResult = await this.voiceProcessor.processVoiceMessage(
      message,
      audioBuffer
    );

    const cleanedTranscription = this.voiceProcessor.cleanTranscription(
      transcriptionResult.transcription
    );

    const detectedLanguage =
      transcriptionResult.language ||
      this.voiceProcessor.detectLanguage(cleanedTranscription);

    const extractedIntent = this.extractIntent(cleanedTranscription);

    return {
      originalMessage: message,
      transcription: cleanedTranscription,
      detectedLanguage,
      extractedIntent,
      status: MessageStatus.PROCESSING,
      processingTime: 0,
    };
  }

  private detectLanguageFromText(text: string): string {
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

  private extractIntent(text: string): string {
    const lowerText = text.toLowerCase();

    if (this.matchesKeywords(lowerText, ["pest", "insect", "disease", "कीट", "रोग"])) {
      return "pest_control";
    }
    if (this.matchesKeywords(lowerText, ["fertilizer", "fertiliser", "खाद", "उर्वरक"])) {
      return "fertilizer";
    }
    if (this.matchesKeywords(lowerText, ["weather", "rain", "मौसम", "बारिश", "ପାଗ"])) {
      return "weather";
    }
    if (this.matchesKeywords(lowerText, ["seed", "बीज", "variety", "किस्म"])) {
      return "seed_variety";
    }
    if (this.matchesKeywords(lowerText, ["price", "market", "मूल्य", "बाजार", "ମୂଲ୍ୟ"])) {
      return "market_price";
    }
    if (this.matchesKeywords(lowerText, ["plant", "sow", "बुवाई", "रोपण", "ରୋପଣ"])) {
      return "planting";
    }
    if (this.matchesKeywords(lowerText, ["harvest", "कटाई", "फसल", "ଅମଳ"])) {
      return "harvest";
    }
    if (this.matchesKeywords(lowerText, ["water", "irrigation", "पानी", "सिंचाई", "ଜଳସେଚନ"])) {
      return "irrigation";
    }
    if (this.matchesKeywords(lowerText, ["mustard", "सरसों", "ରାଇ"])) {
      return "mustard";
    }
    if (this.matchesKeywords(lowerText, ["groundnut", "peanut", "मूंगफली", "ବାଦାମ"])) {
      return "groundnut";
    }
    if (this.matchesKeywords(lowerText, ["sunflower", "सूरजमुखी", "ସୂର୍ଯ୍ୟମୁଖୀ"])) {
      return "sunflower";
    }

    return "general_query";
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  public generateResponse(
    processedMessage: ProcessedMessage,
    criteria?: ResponseCriteria
  ): WhatsAppResponse {
    const responseCriteria = criteria || this.responseCriteria;

    const messageContent =
      processedMessage.transcription ||
      (processedMessage.originalMessage.content as string);

    const responseText = this.buildResponseText(
      processedMessage,
      messageContent,
      responseCriteria
    );

    return {
      to: processedMessage.originalMessage.from,
      type: "text",
      text: {
        body: responseText,
      },
    };
  }

  private buildResponseText(
    processedMessage: ProcessedMessage,
    messageContent: string,
    criteria: ResponseCriteria
  ): string {
    const intent = processedMessage.extractedIntent || "general_query";
    const language = processedMessage.detectedLanguage || "en";

    let response = this.getIntentBasedResponse(intent, language, messageContent);

    if (criteria.responseFormat === "brief") {
      response = this.shortenResponse(response, criteria.maxResponseLength || 160);
    } else if (criteria.responseFormat === "detailed") {
      response = this.expandResponse(response, intent);
    }

    if (criteria.includeContext) {
      response += this.addContextualInfo(intent, language);
    }

    if (criteria.maxResponseLength && response.length > criteria.maxResponseLength) {
      response = response.substring(0, criteria.maxResponseLength - 3) + "...";
    }

    return response;
  }

  private getIntentBasedResponse(
    intent: string,
    language: string,
    originalMessage: string
  ): string {
    const responses: Record<string, Record<string, string>> = {
      pest_control: {
        en: "For effective pest control, I recommend integrated pest management. Could you specify which crop and pest you're dealing with?",
        hi: "प्रभावी कीट नियंत्रण के लिए, मैं एकीकृत कीट प्रबंधन की सलाह देता हूं। कृपया बताएं कि आप किस फसल और कीट से निपट रहे हैं?",
        or: "ପ୍ରଭାବଶାଳୀ କୀଟ ନିୟନ୍ତ୍ରଣ ପାଇଁ, ମୁଁ ସମନ୍ୱିତ କୀଟ ପରିଚାଳନା ପରାମର୍ଶ ଦେଉଛି। ଆପଣ କେଉଁ ଫସଲ ଏବଂ କୀଟ ସହିତ କାର୍ଯ୍ୟ କରୁଛନ୍ତି?",
      },
      fertilizer: {
        en: "Fertilizer recommendations depend on soil type and crop. Have you done a soil test recently?",
        hi: "उर्वरक की सिफारिशें मिट्टी के प्रकार और फसल पर निर्भर करती हैं। क्या आपने हाल ही में मिट्टी की जांच की है?",
        or: "ସାର ସୁପାରିଶ ମାଟି ପ୍ରକାର ଏବଂ ଫସଲ ଉପରେ ନିର୍ଭର କରେ। ଆପଣ ସମ୍ପ୍ରତି ମାଟି ପରୀକ୍ଷା କରିଛନ୍ତି କି?",
      },
      weather: {
        en: "I can help with weather information. Which area and time period are you interested in?",
        hi: "मैं मौसम की जानकारी में मदद कर सकता हूं। आप किस क्षेत्र और समय अवधि में रुचि रखते हैं?",
        or: "ମୁଁ ପାଗ ସୂଚନା ସହିତ ସାହାଯ୍ୟ କରିପାରିବି। ଆପଣ କେଉଁ ଅଞ୍ଚଳ ଏବଂ ସମୟ ଅବଧିରେ ଆଗ୍ରହୀ?",
      },
      market_price: {
        en: "I can provide market price information. Which crop are you interested in?",
        hi: "मैं बाजार मूल्य की जानकारी प्रदान कर सकता हूं। आप किस फसल में रुचि रखते हैं?",
        or: "ମୁଁ ବଜାର ମୂଲ୍ୟ ସୂଚନା ପ୍ରଦାନ କରିପାରିବି। ଆପଣ କେଉଁ ଫସଲରେ ଆଗ୍ରହୀ?",
      },
      general_query: {
        en: "Hello! I'm Kisan Sathi, your agricultural advisor. How can I help you today with your farming needs?",
        hi: "नमस्ते! मैं किसान साथी हूं, आपका कृषि सलाहकार। मैं आज आपकी खेती की जरूरतों में कैसे मदद कर सकता हूं?",
        or: "ନମସ୍କାର! ମୁଁ କିସାନ ସାଥୀ, ଆପଣଙ୍କର କୃଷି ପରାମର୍ଶଦାତା। ମୁଁ ଆଜି ଆପଣଙ୍କର କୃଷି ଆବଶ୍ୟକତା ସହିତ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?",
      },
    };

    const intentResponses = responses[intent] || responses.general_query;
    return intentResponses[language] || intentResponses["en"];
  }

  private shortenResponse(response: string, maxLength: number): string {
    if (response.length <= maxLength) {
      return response;
    }
    return response.substring(0, maxLength - 3) + "...";
  }

  private expandResponse(response: string, intent: string): string {
    return response + "\n\nWould you like more specific information about this topic?";
  }

  private addContextualInfo(intent: string, language: string): string {
    const contextInfo: Record<string, string> = {
      en: "\n\nFor personalized advice, please provide your location and crop details.",
      hi: "\n\nव्यक्तिगत सलाह के लिए, कृपया अपना स्थान और फसल विवरण प्रदान करें।",
      or: "\n\nବ୍ୟକ୍ତିଗତ ପରାମର୍ଶ ପାଇଁ, ଦୟାକରି ଆପଣଙ୍କର ସ୍ଥାନ ଏବଂ ଫସଲ ବିବରଣୀ ପ୍ରଦାନ କରନ୍ତୁ।",
    };

    return contextInfo[language] || contextInfo["en"];
  }

  private getDefaultCriteria(): ResponseCriteria {
    return {
      language: "auto",
      maxResponseLength: 1600,
      includeContext: true,
      responseFormat: "conversational",
      topics: [],
    };
  }

  public async batchProcessMessages(
    payloads: WhatsAppWebhookPayload[],
    audioBuffersMap?: Map<string, Map<string, Buffer>>
  ): Promise<ProcessedMessage[]> {
    const allProcessedMessages: ProcessedMessage[] = [];

    for (const payload of payloads) {
      const audioBuffers = audioBuffersMap?.get(payload.entry[0]?.id);
      const processed = await this.handleIncomingMessage(payload, audioBuffers);
      allProcessedMessages.push(...processed);
    }

    return allProcessedMessages;
  }

  public updateResponseCriteria(criteria: Partial<ResponseCriteria>): void {
    this.responseCriteria = {
      ...this.responseCriteria,
      ...criteria,
    };
  }

  public getMessageStats(messages: ProcessedMessage[]): {
    total: number;
    byType: Record<MessageType, number>;
    byStatus: Record<MessageStatus, number>;
    byLanguage: Record<string, number>;
    averageProcessingTime: number;
  } {
    const stats = {
      total: messages.length,
      byType: {} as Record<MessageType, number>,
      byStatus: {} as Record<MessageStatus, number>,
      byLanguage: {} as Record<string, number>,
      averageProcessingTime: 0,
    };

    let totalProcessingTime = 0;

    for (const message of messages) {
      const type = message.originalMessage.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      stats.byStatus[message.status] = (stats.byStatus[message.status] || 0) + 1;

      if (message.detectedLanguage) {
        stats.byLanguage[message.detectedLanguage] =
          (stats.byLanguage[message.detectedLanguage] || 0) + 1;
      }

      totalProcessingTime += message.processingTime;
    }

    stats.averageProcessingTime =
      messages.length > 0 ? totalProcessingTime / messages.length : 0;

    return stats;
  }
}

export const whatsappHandler = new WhatsAppHandler();
