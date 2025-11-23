import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

// Pricing data structure
interface PricingOption {
  id: string;
  label: string;
  costPerMinute: number;
}

const LLM_MODELS: PricingOption[] = [
  { id: "gpt-5", label: "GPT 5", costPerMinute: 0.080 },
  { id: "gpt-5-mini", label: "GPT 5mini", costPerMinute: 0.040 },
  { id: "gpt-5-nano", label: "GPT 5 nano", costPerMinute: 0.020 },
  { id: "gpt-4.1", label: "GPT 4.1", costPerMinute: 0.070 },
  { id: "gpt-4.1-mini", label: "GPT 4.1 mini", costPerMinute: 0.035 },
  { id: "gpt-4o", label: "GPT 4o", costPerMinute: 0.050 },
  { id: "gpt-4o-mini", label: "GPT 4o mini", costPerMinute: 0.025 },
  { id: "gpt-4.1-nano", label: "GPT 4.1 nano", costPerMinute: 0.015 },
  { id: "claude-3.7-sonnet", label: "Claude 3.7 sonnet", costPerMinute: 0.060 },
  { id: "claude-3.5-haiku", label: "Claude 3.5 haiku", costPerMinute: 0.030 },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", costPerMinute: 0.045 },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", costPerMinute: 0.022 },
  { id: "custom", label: "Custom LLM", costPerMinute: 0.000 },
];

const VOICE_ENGINES: PricingOption[] = [
  { id: "elevenlabs-cartesia", label: "Elevenlabs/Cartesia Voices", costPerMinute: 0.070 },
  { id: "openai", label: "OpenAI Voices", costPerMinute: 0.045 },
];

const TELEPHONY_PROVIDERS: PricingOption[] = [
  { id: "custom", label: "Custom Telephony", costPerMinute: 0.000 },
  { id: "retell", label: "Retell Twilio/Telnyx", costPerMinute: 0.012 },
];

export function PricingCalculator() {
  const [minutes, setMinutes] = useState(3000); // Default to 100 calls/month @ 30 min each
  const [selectedLLM, setSelectedLLM] = useState("claude-3.7-sonnet");
  const [selectedVoice, setSelectedVoice] = useState("elevenlabs-cartesia");
  const [selectedTelephony, setSelectedTelephony] = useState("custom");
  const [avgCallDuration, setAvgCallDuration] = useState(30); // Average call duration in minutes

  // Find selected options
  const llmOption = LLM_MODELS.find((m) => m.id === selectedLLM) || LLM_MODELS[0];
  const voiceOption = VOICE_ENGINES.find((v) => v.id === selectedVoice) || VOICE_ENGINES[0];
  const telephonyOption = TELEPHONY_PROVIDERS.find((t) => t.id === selectedTelephony) || TELEPHONY_PROVIDERS[0];

  // Calculate costs
  const llmCost = llmOption.costPerMinute;
  const voiceCost = voiceOption.costPerMinute;
  const telephonyCost = telephonyOption.costPerMinute;
  const costPerMinute = llmCost + voiceCost + telephonyCost;
  const totalMonthlyCost = costPerMinute * minutes;

  // Calculate call metrics
  const totalCallsPerMonth = Math.round(minutes / avgCallDuration);
  const callsPerDay = Math.round(totalCallsPerMonth / 30);
  const costPerCall = costPerMinute * avgCallDuration;
  const dailyCost = (totalMonthlyCost / 30);

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardHeader>
        <CardTitle>Pricing Calculator</CardTitle>
        <CardDescription>
          Estimate your monthly costs based on usage and provider selection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Controls */}
          <div className="lg:col-span-2 space-y-8">
            {/* Minutes Slider */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-sm font-medium">
                  How many minutes of calls do you have per month?
                </label>
                <span className="text-3xl font-bold" data-testid="minutes-value">
                  {minutes.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[minutes]}
                onValueChange={(value) => setMinutes(value[0])}
                min={900}
                max={15000}
                step={100}
                className="mb-2"
                data-testid="slider-minutes"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>900 min (~30 calls/day)</span>
                <span className="text-center">
                  {totalCallsPerMonth.toLocaleString()} calls/month (~{callsPerDay} calls/day)
                </span>
                <span>15,000 min (~500 calls/day)</span>
              </div>
            </div>

            {/* Average Call Duration Slider */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-sm font-medium">
                  Average call duration (minutes)
                </label>
                <span className="text-2xl font-bold" data-testid="avg-duration-value">
                  {avgCallDuration} min
                </span>
              </div>
              <Slider
                value={[avgCallDuration]}
                onValueChange={(value) => setAvgCallDuration(value[0])}
                min={5}
                max={60}
                step={5}
                className="mb-2"
                data-testid="slider-avg-duration"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 min (quick inquiries)</span>
                <span>60 min (complex orders)</span>
              </div>
            </div>

            {/* LLM Agent Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">LLM Agent</label>
              <div className="flex flex-wrap gap-2">
                {LLM_MODELS.map((model) => (
                  <Badge
                    key={model.id}
                    variant={selectedLLM === model.id ? "default" : "outline"}
                    className="cursor-pointer hover-elevate px-3 py-1.5 text-xs"
                    onClick={() => setSelectedLLM(model.id)}
                    data-testid={`llm-${model.id}`}
                  >
                    {model.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Voice Engine Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Voice Engine</label>
              <div className="flex flex-wrap gap-2">
                {VOICE_ENGINES.map((engine) => (
                  <Badge
                    key={engine.id}
                    variant={selectedVoice === engine.id ? "default" : "outline"}
                    className="cursor-pointer hover-elevate px-3 py-1.5 text-xs"
                    onClick={() => setSelectedVoice(engine.id)}
                    data-testid={`voice-${engine.id}`}
                  >
                    {engine.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Telephony Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">Telephony</label>
              <div className="flex flex-wrap gap-2">
                {TELEPHONY_PROVIDERS.map((provider) => (
                  <Badge
                    key={provider.id}
                    variant={selectedTelephony === provider.id ? "default" : "outline"}
                    className="cursor-pointer hover-elevate px-3 py-1.5 text-xs"
                    onClick={() => setSelectedTelephony(provider.id)}
                    data-testid={`telephony-${provider.id}`}
                  >
                    {provider.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Cost Breakdown */}
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Cost Per Minute</div>
                <div className="text-2xl font-bold" data-testid="cost-per-minute">
                  ${costPerMinute.toFixed(3)}
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">• LLM Cost</span>
                  <span className="font-medium" data-testid="llm-cost">
                    ${llmCost.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">• Voice Engine Cost</span>
                  <span className="font-medium" data-testid="voice-cost">
                    ${voiceCost.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">• Telephony Cost</span>
                  <span className="font-medium" data-testid="telephony-cost">
                    ${telephonyCost.toFixed(3)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-1">Total Monthly Cost</div>
                <div className="text-4xl font-bold text-primary" data-testid="total-cost">
                  ${totalMonthlyCost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {minutes.toLocaleString()} minutes × ${costPerMinute.toFixed(3)}/min
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Quick Stats
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span>Cost per call ({avgCallDuration} min avg)</span>
                  <span className="font-medium" data-testid="cost-per-call">
                    ${costPerCall.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Daily cost (~{callsPerDay} calls/day)</span>
                  <span className="font-medium" data-testid="daily-cost">
                    ${dailyCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Monthly calls</span>
                  <span className="font-medium" data-testid="monthly-calls">
                    {totalCallsPerMonth.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
