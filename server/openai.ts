// Reference: javascript_openai blueprint
import OpenAI from "openai";
import { Readable } from "stream";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Default values for agents without custom configuration
const DEFAULT_SYSTEM_PROMPT = `You are a friendly and helpful AI assistant for a restaurant. Your job is to:
- Answer questions about the menu, hours, and services
- Help customers with reservations and orders
- Provide information about specials and promotions
- Be warm, professional, and conversational

Always be helpful and provide accurate information based on what you know.`;

const DEFAULT_PERSONALITY = "Warm, friendly, and professional. Speak naturally like a helpful restaurant host.";

const DEFAULT_GREETING = "Hello! Thank you for calling. How can I help you today?";

export async function generateAgentResponse(
  systemPrompt: string,
  greetingMessage: string,
  personality: string,
  knowledgeContext: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string
): Promise<string> {
  try {
    // Use defaults for empty or missing values
    const effectiveSystemPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    const effectivePersonality = personality?.trim() || DEFAULT_PERSONALITY;
    const effectiveGreeting = greetingMessage?.trim() || DEFAULT_GREETING;
    const effectiveKnowledge = knowledgeContext?.trim() || "No specific knowledge base configured yet.";
    
    const fullSystemPrompt = `${effectiveSystemPrompt}

PERSONALITY: ${effectivePersonality}

GREETING: When starting a conversation, use this greeting: "${effectiveGreeting}"

KNOWLEDGE BASE:
${effectiveKnowledge}

You are a helpful restaurant AI assistant. Use the knowledge base to answer questions accurately. Be conversational and helpful.`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Add conversation history
    if (conversationHistory.length === 0) {
      // First message - include greeting
      messages.push({ role: "assistant", content: effectiveGreeting });
    } else {
      conversationHistory.forEach((msg) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      max_completion_tokens: 500,
    });

    return response.choices[0].message.content || "I apologize, I couldn't generate a response.";
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your API key billing status or try again later.");
    }
    
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key. Please check your configuration.");
    }
    
    if (error?.status === 503 || error?.code === 'overloaded_error') {
      throw new Error("OpenAI service is temporarily overloaded. Please try again in a moment.");
    }
    
    throw new Error("Failed to generate agent response. Please try again.");
  }
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    const file = new File([audioBuffer], "audio.webm", { type: "audio/webm" });
    
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    return response.text;
  } catch (error: any) {
    console.error("OpenAI Whisper API error:", error);
    
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your API key billing status or try again later.");
    }
    
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key. Please check your configuration.");
    }
    
    throw new Error("Failed to transcribe audio. Please try again.");
  }
}

export interface VoiceConfig {
  provider: string;
  voiceId: string;
  speed?: string;
  volume?: string;
  model?: string;
}

export async function synthesizeSpeech(text: string, config?: VoiceConfig): Promise<Buffer> {
  try {
    const voiceId = config?.voiceId || "nova";
    const speed = config?.speed ? parseFloat(config.speed) : 1.0;
    
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voiceId as any,
      input: text,
      speed: Math.max(0.25, Math.min(4.0, speed)),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (error: any) {
    console.error("OpenAI TTS API error:", error);
    
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your API key billing status or try again later.");
    }
    
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key. Please check your configuration.");
    }
    
    throw new Error("Failed to synthesize speech. Please try again.");
  }
}

export interface Voice {
  id: string;
  name: string;
  provider: string;
  language: string;
  gender?: string;
  description?: string;
}

export async function listOpenAIVoices(): Promise<Voice[]> {
  return [
    { id: "alloy", name: "Alloy", provider: "openai", language: "en", gender: "neutral", description: "Neutral and balanced" },
    { id: "echo", name: "Echo", provider: "openai", language: "en", gender: "male", description: "Clear and articulate" },
    { id: "fable", name: "Fable", provider: "openai", language: "en", gender: "neutral", description: "Warm and expressive" },
    { id: "onyx", name: "Onyx", provider: "openai", language: "en", gender: "male", description: "Deep and authoritative" },
    { id: "nova", name: "Nova", provider: "openai", language: "en", gender: "female", description: "Friendly and engaging" },
    { id: "shimmer", name: "Shimmer", provider: "openai", language: "en", gender: "female", description: "Soft and pleasant" },
  ];
}
