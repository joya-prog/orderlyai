export const DEFAULT_TRIAL_CREDIT_CENTS = 1000;

export const MODEL_BASE_RATES_CENTS_PER_MIN: Record<string, number> = {
  'gpt-4o-mini': 22,
  'gpt-4o': 27,
  'claude-3.5-sonnet': 28,
  'claude-3-haiku': 22,
  'gpt-4-turbo': 27,
  'gpt-3.5-turbo': 18,
  'gpt-5-nano': 22,
  'gpt-4.1-mini': 27,
  'gpt-4.1': 38,
  'claude-3.5-haiku': 28,
  'claude-sonnet': 42,
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
  const modelRate = MODEL_BASE_RATES_CENTS_PER_MIN[aiModel] ?? 22;
  const voiceSurcharge = VOICE_PROVIDER_SURCHARGES_CENTS_PER_MIN[voiceProvider] ?? 7;
  const totalRatePerMin = modelRate + voiceSurcharge;
  return Math.ceil((durationSeconds / 60) * totalRatePerMin);
}

export function formatCreditDisplay(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
