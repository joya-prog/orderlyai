export const DEFAULT_TRIAL_CREDIT_CENTS = 1000;

// Base infrastructure rate applied to every call, per minute
export const PLATFORM_BASE_RATE_CENTS_PER_MIN = 16;

export const MODEL_BASE_RATES_CENTS_PER_MIN: Record<string, number> = {
  'gpt-4o-mini':        6,   // was 22
  'gpt-4o':            11,   // was 27
  'claude-3.5-sonnet': 12,   // was 28
  'claude-3-haiku':     6,   // was 22
  'gpt-4-turbo':       11,   // was 27
  'gpt-3.5-turbo':      2,   // was 18
  'gpt-5-nano':         6,   // was 22
  'gpt-4.1-mini':      11,   // was 27
  'gpt-4.1':           22,   // was 38
  'claude-3.5-haiku':  12,   // was 28
  'claude-sonnet':     26,   // was 42
};

export const VOICE_PROVIDER_SURCHARGES_CENTS_PER_MIN: Record<string, number> = {
  'elevenlabs': 7,
  'openai': 3,
  'cartesia': 2,
  'deepgram': 1,
  'playht': 5,
};

export function calculateCallCostCents(
  durationSeconds: number,
  aiModel: string,
  voiceProvider: string,
): number {
  const modelRate = MODEL_BASE_RATES_CENTS_PER_MIN[aiModel] ?? 6;
  const voiceSurcharge = VOICE_PROVIDER_SURCHARGES_CENTS_PER_MIN[voiceProvider] ?? 7;
  const totalRatePerMin = PLATFORM_BASE_RATE_CENTS_PER_MIN + modelRate + voiceSurcharge;
  return Math.ceil((durationSeconds / 60) * totalRatePerMin);
}

export function formatCreditDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
