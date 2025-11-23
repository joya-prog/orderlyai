import { Readable } from "stream";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  description?: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
  samples?: Array<{
    sample_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    hash: string;
  }>;
}

export async function getElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error: any) {
    console.error("ElevenLabs API error:", error);
    throw new Error("Failed to fetch ElevenLabs voices");
  }
}

export async function previewElevenLabsVoice(voiceId: string, text: string): Promise<Buffer> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error: any) {
    console.error("ElevenLabs preview error:", error);
    throw new Error("Failed to generate voice preview");
  }
}

export async function synthesizeElevenLabsSpeech(
  voiceId: string,
  text: string,
  options: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
  } = {}
): Promise<Readable> {
  if (!ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs API key not configured");
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          style: options.style ?? 0.0,
          use_speaker_boost: options.speakerBoost ?? true,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body from ElevenLabs API");
    }

    return Readable.fromWeb(response.body as any);
  } catch (error: any) {
    console.error("ElevenLabs synthesis error:", error);
    throw new Error("Failed to synthesize speech with ElevenLabs");
  }
}
