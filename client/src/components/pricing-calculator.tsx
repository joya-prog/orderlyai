import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Base subscription: $149/month per location
const BASE_MONTHLY_FEE_PER_LOCATION = 149;

interface AITier {
  id: string;
  label: string;
  costPerMinute: number;
  description: string;
  whyPriced: string;
  isDefault?: boolean;
}

// Simplified all-in pricing tiers (LLM + Voice combined)
const AI_TIERS: AITier[] = [
  { 
    id: "gpt-5-nano", 
    label: "GPT-5 nano", 
    costPerMinute: 0.29,
    description: "Best speed/cost balance for orders & reservations",
    whyPriced: "Fast, efficient model optimized for restaurant workflows. Includes premium voice synthesis.",
    isDefault: true,
  },
  { 
    id: "gpt-4.1-mini", 
    label: "GPT-4.1 mini", 
    costPerMinute: 0.34,
    description: "Better reasoning for complex menus",
    whyPriced: "Enhanced reasoning for detailed menu modifications, dietary restrictions, and multi-item orders.",
  },
  { 
    id: "claude-3.5-haiku", 
    label: "Claude 3.5 Haiku", 
    costPerMinute: 0.35,
    description: "Natural tone, great for hospitality",
    whyPriced: "Warm, conversational style that feels more human. Perfect for upscale dining experiences.",
  },
  { 
    id: "gpt-4.1", 
    label: "GPT-4.1", 
    costPerMinute: 0.45,
    description: "Enterprise accuracy & upsell logic",
    whyPriced: "Advanced reasoning for complex scenarios, upselling, and handling edge cases with high accuracy.",
  },
  { 
    id: "claude-sonnet", 
    label: "Claude Sonnet", 
    costPerMinute: 0.49,
    description: "Enterprise accuracy & premium voice",
    whyPriced: "Top-tier intelligence for fine dining, complex reservations, and VIP guest handling.",
  },
];

export function PricingCalculator() {
  // Restaurant-focused inputs
  const [callsPerDay, setCallsPerDay] = useState(50);
  const [avgCallDuration, setAvgCallDuration] = useState(5);
  const [locations, setLocations] = useState(1);
  
  const [selectedTier, setSelectedTier] = useState("gpt-5-nano");

  // Find selected tier
  const tierOption = AI_TIERS.find((t) => t.id === selectedTier) || AI_TIERS[0];
  const costPerMinute = tierOption.costPerMinute;
  
  // Per-location calculations
  const dailyMinutes = callsPerDay * avgCallDuration;
  const monthlyMinutesPerLocation = dailyMinutes * 30;
  const monthlyUsageCostPerLocation = costPerMinute * monthlyMinutesPerLocation;
  const monthlyCostPerLocation = BASE_MONTHLY_FEE_PER_LOCATION + monthlyUsageCostPerLocation;
  
  // Total calculations (across all locations)
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
          Estimate your monthly costs based on call volume and AI tier
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Controls */}
          <div className="lg:col-span-2 space-y-6 md:space-y-8">
            {/* Calls Per Day Slider */}
            <div>
              <div className="flex items-baseline justify-between gap-2 mb-4">
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
              <div className="flex items-baseline justify-between gap-2 mb-4">
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
              <div className="flex items-baseline justify-between gap-2 mb-4">
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

            {/* AI Tier Selection */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <label className="text-sm font-medium">AI Tier</label>
                <span className="text-xs text-muted-foreground">(includes voice)</span>
              </div>
              <div className="space-y-2">
                {AI_TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTier === tier.id 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover-elevate"
                    }`}
                    onClick={() => setSelectedTier(tier.id)}
                    data-testid={`tier-${tier.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedTier === tier.id ? "border-primary" : "border-muted-foreground"
                      }`}>
                        {selectedTier === tier.id && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{tier.label}</span>
                          {tier.isDefault && (
                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{tier.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">${tier.costPerMinute.toFixed(2)}/min</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="text-xs font-medium mb-1">Why it's priced this way:</p>
                          <p className="text-xs">{tier.whyPriced}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
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
                <div className="text-sm text-muted-foreground mb-1">All-in Usage Rate</div>
                <div className="text-2xl font-bold" data-testid="cost-per-minute">
                  ${costPerMinute.toFixed(2)}/min
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tierOption.label} (AI + Voice included)
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
