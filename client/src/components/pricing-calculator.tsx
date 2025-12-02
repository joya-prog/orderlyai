import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

// Pricing data structure - CLIENT PRICING (with ~77% margin / 4x markup from wholesale)
// Base subscription: $149/month per location
// Voice rate: $0.29/minute
const BASE_MONTHLY_FEE_PER_LOCATION = 149;
const VOICE_RATE_PER_MINUTE = 0.29;

interface PricingOption {
  id: string;
  label: string;
  costPerMinute: number;
}

// LLM costs with 4x markup for 77% margin (wholesale × 4)
const LLM_MODELS: PricingOption[] = [
  { id: "gpt-5", label: "GPT 5", costPerMinute: 0.32 },           // $0.08 × 4
  { id: "gpt-5-mini", label: "GPT 5mini", costPerMinute: 0.16 },   // $0.04 × 4
  { id: "gpt-5-nano", label: "GPT 5 nano", costPerMinute: 0.08 },  // $0.02 × 4
  { id: "gpt-4.1", label: "GPT 4.1", costPerMinute: 0.28 },        // $0.07 × 4
  { id: "gpt-4.1-mini", label: "GPT 4.1 mini", costPerMinute: 0.14 }, // $0.035 × 4
  { id: "gpt-4o", label: "GPT 4o", costPerMinute: 0.20 },          // $0.05 × 4
  { id: "gpt-4o-mini", label: "GPT 4o mini", costPerMinute: 0.10 }, // $0.025 × 4
  { id: "gpt-4.1-nano", label: "GPT 4.1 nano", costPerMinute: 0.06 }, // $0.015 × 4
  { id: "claude-3.7-sonnet", label: "Claude 3.7 sonnet", costPerMinute: 0.24 }, // $0.06 × 4
  { id: "claude-3.5-haiku", label: "Claude 3.5 haiku", costPerMinute: 0.12 },   // $0.03 × 4
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", costPerMinute: 0.18 },   // $0.045 × 4
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", costPerMinute: 0.09 }, // $0.022 × 4
  { id: "custom", label: "Custom LLM", costPerMinute: 0.00 },
];

// Voice engine included in base voice rate
const VOICE_ENGINES: PricingOption[] = [
  { id: "elevenlabs-cartesia", label: "Elevenlabs/Cartesia Voices", costPerMinute: 0.00 },
  { id: "openai", label: "OpenAI Voices", costPerMinute: 0.00 },
];

const TELEPHONY_PROVIDERS: PricingOption[] = [
  { id: "custom", label: "Custom Telephony", costPerMinute: 0.00 },
];

export function PricingCalculator() {
  // Restaurant-focused inputs
  const [callsPerDay, setCallsPerDay] = useState(50); // Default: 50 calls/day
  const [avgCallDuration, setAvgCallDuration] = useState(5); // Default: 5 minutes per call
  const [locations, setLocations] = useState(1); // Default: 1 location
  
  const [selectedLLM, setSelectedLLM] = useState("claude-3.7-sonnet");
  const [selectedVoice, setSelectedVoice] = useState("elevenlabs-cartesia");
  const [selectedTelephony] = useState("custom"); // Fixed to custom

  // Find selected options
  const llmOption = LLM_MODELS.find((m) => m.id === selectedLLM) || LLM_MODELS[0];
  const voiceOption = VOICE_ENGINES.find((v) => v.id === selectedVoice) || VOICE_ENGINES[0];
  const telephonyOption = TELEPHONY_PROVIDERS.find((t) => t.id === selectedTelephony) || TELEPHONY_PROVIDERS[0];

  // Calculate costs per minute (LLM + voice rate)
  const llmCost = llmOption.costPerMinute;
  const voiceCost = VOICE_RATE_PER_MINUTE; // Fixed $0.29/minute voice rate
  const telephonyCost = telephonyOption.costPerMinute; // Usually $0 for custom
  const costPerMinute = llmCost + voiceCost + telephonyCost;
  
  // Per-location calculations
  const dailyMinutes = callsPerDay * avgCallDuration;
  const monthlyMinutesPerLocation = dailyMinutes * 30;
  const monthlyUsageCostPerLocation = costPerMinute * monthlyMinutesPerLocation;
  const monthlyCostPerLocation = BASE_MONTHLY_FEE_PER_LOCATION + monthlyUsageCostPerLocation;
  
  // Total calculations (across all locations)
  const totalMonthlyMinutes = monthlyMinutesPerLocation * locations;
  const totalBaseFee = BASE_MONTHLY_FEE_PER_LOCATION * locations;
  const totalUsageCost = monthlyUsageCostPerLocation * locations;
  const totalMonthlyCost = totalBaseFee + totalUsageCost;
  const totalCallsPerMonth = callsPerDay * 30 * locations;
  const costPerCall = costPerMinute * avgCallDuration;
  const dailyUsageCost = totalUsageCost / 30;
  const dailyBaseCost = totalBaseFee / 30;
  const dailyCost = dailyBaseCost + dailyUsageCost;

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardHeader>
        <CardTitle>Pricing Calculator</CardTitle>
        <CardDescription>
          Estimate your monthly costs based on usage and provider selection
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Controls */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            {/* Calls Per Day Slider */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-sm font-medium">
                  How many calls does your restaurant have per day?
                </label>
                <span className="text-3xl font-bold" data-testid="calls-per-day-value">
                  {callsPerDay}
                </span>
              </div>
              <Slider
                value={[callsPerDay]}
                onValueChange={(value) => setCallsPerDay(value[0])}
                min={30}
                max={400}
                step={10}
                className="mb-2"
                data-testid="slider-calls-per-day"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>30 calls/day</span>
                <span className="text-center">
                  {(callsPerDay * 30).toLocaleString()} calls/month per location
                </span>
                <span>400 calls/day</span>
              </div>
            </div>

            {/* Average Call Duration Slider */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-sm font-medium">
                  How long is the duration of each call?
                </label>
                <span className="text-2xl font-bold" data-testid="avg-duration-value">
                  {avgCallDuration} min
                </span>
              </div>
              <Slider
                value={[avgCallDuration]}
                onValueChange={(value) => setAvgCallDuration(value[0])}
                min={2.5}
                max={8}
                step={0.5}
                className="mb-2"
                data-testid="slider-avg-duration"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>2.5 min (quick inquiries)</span>
                <span>8 min (complex orders)</span>
              </div>
            </div>

            {/* Locations Slider */}
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <label className="text-sm font-medium">
                  How many locations do you have?
                </label>
                <span className="text-2xl font-bold" data-testid="locations-value">
                  {locations}
                </span>
              </div>
              <Slider
                value={[locations]}
                onValueChange={(value) => setLocations(value[0])}
                min={1}
                max={10}
                step={1}
                className="mb-2"
                data-testid="slider-locations"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 location</span>
                <span>10 locations</span>
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
          </div>

          {/* Right Column - Cost Breakdown */}
          <div className="space-y-6">
            {/* Per-Location Breakdown */}
            <div className="rounded-lg border bg-card p-6 space-y-4">
              {/* Base Subscription */}
              <div>
                <div className="text-sm text-muted-foreground mb-1">Base Subscription</div>
                <div className="text-2xl font-bold" data-testid="base-fee">
                  ${BASE_MONTHLY_FEE_PER_LOCATION}/month
                </div>
                <div className="text-xs text-muted-foreground">per location</div>
              </div>

              {/* Per Minute Rate */}
              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-1">Usage Rate</div>
                <div className="text-2xl font-bold" data-testid="cost-per-minute">
                  ${costPerMinute.toFixed(2)}/min
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Voice</span>
                  <span className="font-medium" data-testid="voice-cost">
                    ${voiceCost.toFixed(2)}/min
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">LLM ({llmOption.label})</span>
                  <span className="font-medium" data-testid="llm-cost">
                    ${llmCost.toFixed(2)}/min
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-1">Per Location (Monthly)</div>
                <div className="text-2xl font-bold text-primary" data-testid="per-location-cost">
                  ${monthlyCostPerLocation.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${BASE_MONTHLY_FEE_PER_LOCATION} base + {monthlyMinutesPerLocation.toLocaleString()} min × ${costPerMinute.toFixed(2)}
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm text-muted-foreground mb-1">
                  Total Monthly Cost {locations > 1 ? `(${locations} locations)` : ""}
                </div>
                <div className="text-4xl font-bold text-primary" data-testid="total-cost">
                  ${totalMonthlyCost.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ${totalBaseFee} base + ${totalUsageCost.toFixed(2)} usage
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
                  <span>Total daily cost (all locations)</span>
                  <span className="font-medium" data-testid="daily-cost">
                    ${dailyCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total monthly calls</span>
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
