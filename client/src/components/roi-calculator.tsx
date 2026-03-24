import { useState, useMemo, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, PhoneOff, Clock, Users, DollarSign, Zap } from "lucide-react";
import { useLocation } from "wouter";
import {
  MODEL_BASE_RATES_CENTS_PER_MIN,
  VOICE_PROVIDER_SURCHARGES_CENTS_PER_MIN,
  calculateCallCostCents,
} from "@shared/pricing";

// Derive tiers from shared/pricing.ts so AI cost always matches actual billing
const COST_TIERS = [
  {
    id: "standard",
    label: "Standard",
    aiModel: "gpt-5-nano",
    voiceProvider: "deepgram",
    get centsPerMin() {
      return (
        (MODEL_BASE_RATES_CENTS_PER_MIN[this.aiModel] ?? 22) +
        (VOICE_PROVIDER_SURCHARGES_CENTS_PER_MIN[this.voiceProvider] ?? 1)
      );
    },
    description: "GPT-5 nano + Deepgram",
  },
  {
    id: "premium",
    label: "Premium",
    aiModel: "gpt-4.1-mini",
    voiceProvider: "elevenlabs",
    get centsPerMin() {
      return (
        (MODEL_BASE_RATES_CENTS_PER_MIN[this.aiModel] ?? 27) +
        (VOICE_PROVIDER_SURCHARGES_CENTS_PER_MIN[this.voiceProvider] ?? 7)
      );
    },
    description: "GPT-4.1 mini + ElevenLabs",
  },
];

function useAnimatedNumber(target: number, duration = 350) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<{ from: number; start: number } | null>(null);

  useEffect(() => {
    const from = display;
    const startTime = performance.now();
    startRef.current = { from, start: startTime };

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

function formatDollar(n: number, decimals = 0) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  return `$${n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function formatNumber(n: number) {
  return Math.round(n).toLocaleString();
}

interface ROICalculatorProps {
  variant?: "default" | "compact";
  onSignupClick?: () => void;
}

export function ROICalculator({ variant = "default", onSignupClick }: ROICalculatorProps) {
  const [, navigate] = useLocation();

  // Inputs
  const [callsPerDay, setCallsPerDay] = useState(75);
  const [missedPct, setMissedPct] = useState(30);
  const [avgOrderValue, setAvgOrderValue] = useState(45);
  const [avgDuration, setAvgDuration] = useState(4);
  const [locations, setLocations] = useState(1);
  const [staffRate, setStaffRate] = useState(18);
  const [tier, setTier] = useState("standard");

  const tierObj = COST_TIERS.find((t) => t.id === tier) ?? COST_TIERS[0];
  const costPerMin = tierObj.centsPerMin / 100;

  const calc = useMemo(() => {
    const t = COST_TIERS.find((x) => x.id === tier) ?? COST_TIERS[0];
    const totalCallsPerMonth = callsPerDay * 30 * locations;
    const missedCallsPerMonth = Math.round(totalCallsPerMonth * (missedPct / 100));
    const revenueRecovered = missedCallsPerMonth * avgOrderValue;

    // Staff labor saved: 0.03 hrs overhead per call freed up (per spec)
    const laborSaved = totalCallsPerMonth * 0.03 * staffRate;

    // AI cost: use calculateCallCostCents from shared/pricing for accuracy
    // calculateCallCostCents takes durationSeconds per call; multiply by total calls for monthly cost
    const totalMinutesPerMonth = totalCallsPerMonth * avgDuration;
    const aiCostCents = calculateCallCostCents(avgDuration * 60, t.aiModel, t.voiceProvider) * totalCallsPerMonth;
    const aiCost = aiCostCents / 100;
    const netMonthlyGain = revenueRecovered + laborSaved - aiCost;
    const roiPct = aiCost > 0 ? (netMonthlyGain / aiCost) * 100 : 0;
    const annualGain = netMonthlyGain * 12;
    const paybackDays = netMonthlyGain > 0 ? Math.ceil((aiCost / netMonthlyGain) * 30) : 0;
    const costPerCall = aiCost / totalCallsPerMonth;

    return {
      totalCallsPerMonth,
      missedCallsPerMonth,
      revenueRecovered,
      laborSaved,
      aiCost,
      netMonthlyGain,
      roiPct,
      annualGain,
      paybackDays,
      costPerCall,
      totalMinutesPerMonth,
    };
  }, [callsPerDay, missedPct, avgOrderValue, avgDuration, locations, staffRate, tier]);

  const handleCTA = () => {
    if (onSignupClick) {
      onSignupClick();
    } else {
      navigate("/");
    }
  };

  // Animated numbers for key result values (must be before any early return)
  const animNetMonthly = useAnimatedNumber(calc.netMonthlyGain);
  const animRevenue = useAnimatedNumber(calc.revenueRecovered);
  const animLabor = useAnimatedNumber(calc.laborSaved);
  const animAiCost = useAnimatedNumber(calc.aiCost);
  const animAnnual = useAnimatedNumber(calc.annualGain);
  const animRoi = useAnimatedNumber(calc.roiPct);

  // ────────────────────────────────────────────────────────────
  // COMPACT variant — dark gradient background (auth page)
  // ────────────────────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <div className="space-y-4">
        {/* Key sliders */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium text-white/80">Calls / day</label>
              <span className="text-base font-bold text-white" data-testid="roi-compact-calls">{callsPerDay}</span>
            </div>
            <Slider value={[callsPerDay]} onValueChange={(v) => setCallsPerDay(v[0])} min={10} max={200} step={5}
              className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_.bg-primary]:bg-white/70"
              data-testid="roi-compact-slider-calls" />
            <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>10</span><span>200</span></div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium text-white/80">% Missed</label>
              <span className="text-base font-bold text-white" data-testid="roi-compact-missed">{missedPct}%</span>
            </div>
            <Slider value={[missedPct]} onValueChange={(v) => setMissedPct(v[0])} min={5} max={80} step={5}
              className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_.bg-primary]:bg-white/70"
              data-testid="roi-compact-slider-missed" />
            <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>5%</span><span>80%</span></div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium text-white/80">Avg order $</label>
              <span className="text-base font-bold text-white" data-testid="roi-compact-order">${avgOrderValue}</span>
            </div>
            <Slider value={[avgOrderValue]} onValueChange={(v) => setAvgOrderValue(v[0])} min={15} max={150} step={5}
              className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_.bg-primary]:bg-white/70"
              data-testid="roi-compact-slider-order" />
            <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>$15</span><span>$150</span></div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium text-white/80">Locations</label>
              <span className="text-base font-bold text-white" data-testid="roi-compact-locations">{locations}</span>
            </div>
            <Slider value={[locations]} onValueChange={(v) => setLocations(v[0])} min={1} max={25} step={1}
              className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_.bg-primary]:bg-white/70"
              data-testid="roi-compact-slider-locations" />
            <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>1</span><span>25</span></div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium text-white/80">Avg call (min)</label>
              <span className="text-base font-bold text-white" data-testid="roi-compact-duration">{avgDuration}</span>
            </div>
            <Slider value={[avgDuration]} onValueChange={(v) => setAvgDuration(v[0])} min={1} max={15} step={1}
              className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_.bg-primary]:bg-white/70"
              data-testid="roi-compact-slider-duration" />
            <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>1</span><span>15</span></div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="text-xs font-medium text-white/80">Staff rate ($/hr)</label>
              <span className="text-base font-bold text-white" data-testid="roi-compact-staff">${staffRate}</span>
            </div>
            <Slider value={[staffRate]} onValueChange={(v) => setStaffRate(v[0])} min={12} max={40} step={1}
              className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white [&_.bg-primary]:bg-white/70"
              data-testid="roi-compact-slider-staff" />
            <div className="flex justify-between text-[10px] text-white/40 mt-1"><span>$12</span><span>$40</span></div>
          </div>
        </div>

        {/* Results card */}
        <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Revenue Recovered</div>
              <div className="text-lg font-bold text-emerald-300" data-testid="roi-compact-recovered">
                {formatDollar(animRevenue)}/mo
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Orderly AI Cost</div>
              <div className="text-lg font-bold text-white/80" data-testid="roi-compact-cost">
                {formatDollar(animAiCost)}/mo
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 pt-3 flex items-end justify-between gap-2">
            <div>
              <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">Net Monthly Gain</div>
              <div className="text-2xl font-bold text-white" data-testid="roi-compact-net">
                {formatDollar(animNetMonthly)}/mo
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/50 uppercase tracking-wide mb-0.5">ROI</div>
              <div className="text-xl font-bold text-emerald-300" data-testid="roi-compact-roi-pct">
                {formatNumber(animRoi)}%
              </div>
            </div>
          </div>
        </div>

        <p className="text-white/35 text-[10px] text-center">
          Based on {formatNumber(calc.missedCallsPerMonth)} missed calls/mo recovered at ${avgOrderValue} avg order value.
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // DEFAULT variant — full two-panel layout
  // ────────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
      {/* ── Left panel: Inputs ── */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Your Restaurant</h3>
          <div className="space-y-6">

            {/* Calls per day */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium">Calls per day <span className="text-xs text-muted-foreground">(per location)</span></label>
                <span className="text-2xl font-bold text-foreground" data-testid="roi-calls-value">{callsPerDay}</span>
              </div>
              <Slider value={[callsPerDay]} onValueChange={(v) => setCallsPerDay(v[0])} min={10} max={200} step={5}
                data-testid="roi-slider-calls" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>10/day</span>
                <span className="text-muted-foreground/60">Industry avg: 75/day</span>
                <span>200/day</span>
              </div>
            </div>

            {/* Missed % */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium">Calls missed / unanswered</label>
                <span className="text-2xl font-bold text-foreground" data-testid="roi-missed-value">{missedPct}%</span>
              </div>
              <Slider value={[missedPct]} onValueChange={(v) => setMissedPct(v[0])} min={5} max={80} step={5}
                data-testid="roi-slider-missed" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>5%</span>
                <span className="text-muted-foreground/60">Industry avg: 30% during peaks</span>
                <span>80%</span>
              </div>
            </div>

            {/* Avg order value */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium">Average order / booking value</label>
                <span className="text-2xl font-bold text-foreground" data-testid="roi-order-value">${avgOrderValue}</span>
              </div>
              <Slider value={[avgOrderValue]} onValueChange={(v) => setAvgOrderValue(v[0])} min={15} max={150} step={5}
                data-testid="roi-slider-order" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>$15</span>
                <span>$150</span>
              </div>
            </div>

            {/* Avg call duration */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium">Average call duration</label>
                <span className="text-2xl font-bold text-foreground" data-testid="roi-duration-value">{avgDuration} min</span>
              </div>
              <Slider value={[avgDuration]} onValueChange={(v) => setAvgDuration(v[0])} min={1} max={10} step={0.5}
                data-testid="roi-slider-duration" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>1 min</span>
                <span>10 min</span>
              </div>
            </div>

            {/* Locations */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium">Number of locations</label>
                <span className="text-2xl font-bold text-foreground" data-testid="roi-locations-value">{locations}</span>
              </div>
              <Slider value={[locations]} onValueChange={(v) => setLocations(v[0])} min={1} max={25} step={1}
                data-testid="roi-slider-locations" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>1</span>
                <span>25</span>
              </div>
            </div>

            {/* Staff rate */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <label className="text-sm font-medium">Staff hourly rate</label>
                <span className="text-2xl font-bold text-foreground" data-testid="roi-staff-value">${staffRate}/hr</span>
              </div>
              <Slider value={[staffRate]} onValueChange={(v) => setStaffRate(v[0])} min={12} max={35} step={1}
                data-testid="roi-slider-staff" />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>$12/hr</span>
                <span>$35/hr</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI tier */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">AI Tier</h3>
          <div className="space-y-2">
            {COST_TIERS.map((t) => (
              <div
                key={t.id}
                onClick={() => setTier(t.id)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  tier === t.id ? "border-primary bg-primary/5" : "border-border hover-elevate"
                }`}
                data-testid={`roi-tier-${t.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    tier === t.id ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {tier === t.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.label}</span>
                      {t.id === "standard" && <Badge variant="secondary" className="text-xs">Recommended</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                </div>
                <span className="font-semibold text-sm">${(t.centsPerMin / 100).toFixed(2)}/min</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel: Results ── */}
      <div className="lg:col-span-3 space-y-4">
        {/* Big ROI headline */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-6 text-primary-foreground">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="text-sm font-medium text-primary-foreground/70 uppercase tracking-wide mb-1">Net Monthly Gain</div>
              <div className="text-5xl font-bold" data-testid="roi-net-gain">
                {formatDollar(animNetMonthly)}
              </div>
              <div className="text-primary-foreground/70 text-sm mt-1">per month across {locations} location{locations > 1 ? "s" : ""}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-primary-foreground/70 uppercase tracking-wide mb-1">ROI</div>
              <div className="text-4xl font-bold text-yellow-300" data-testid="roi-pct">
                {formatNumber(animRoi)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-xs text-primary-foreground/60 mb-1">Annual Gain</div>
              <div className="text-xl font-bold" data-testid="roi-annual">{formatDollar(animAnnual)}</div>
            </div>
            <div className="rounded-xl bg-white/10 p-3">
              <div className="text-xs text-primary-foreground/60 mb-1">Payback Period</div>
              <div className="text-xl font-bold" data-testid="roi-payback">
                {calc.paybackDays <= 1 ? "< 1 day" : `${calc.paybackDays} days`}
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Revenue recovered */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Revenue Recovered</span>
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="roi-revenue-recovered">
              {formatDollar(animRevenue)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatNumber(calc.missedCallsPerMonth)} missed calls × ${avgOrderValue} avg
            </div>
          </div>

          {/* Labor saved */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Labor Saved</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="roi-labor-saved">
              {formatDollar(animLabor)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatNumber(calc.totalCallsPerMonth * 0.03)} hrs freed @ ${staffRate}/hr
            </div>
          </div>

          {/* Orderly cost */}
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Orderly AI Cost</span>
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="roi-ai-cost">
              {formatDollar(animAiCost)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatNumber(calc.totalMinutesPerMonth).toLocaleString()} min × ${costPerMin.toFixed(2)}/min
            </div>
          </div>
        </div>

        {/* Per-unit stats */}
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Per-Unit Breakdown</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Cost per call</div>
              <div className="font-semibold text-sm" data-testid="roi-cost-per-call">{formatDollar(calc.costPerCall, 2)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Cost per location/mo</div>
              <div className="font-semibold text-sm" data-testid="roi-cost-per-location">
                {formatDollar(calc.aiCost / locations)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Total calls/mo</div>
              <div className="font-semibold text-sm" data-testid="roi-total-calls">
                {formatNumber(calc.totalCallsPerMonth)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Calls recovered/mo</div>
              <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400" data-testid="roi-calls-recovered">
                {formatNumber(calc.missedCallsPerMonth)}
              </div>
            </div>
          </div>
        </div>

        {/* Industry benchmarks */}
        <div className="rounded-xl border border-dashed bg-muted/10 p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Industry Benchmarks</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: PhoneOff, label: "Calls missed during peak", value: "30%", color: "text-rose-500" },
              { icon: Users, label: "Avg calls per location/day", value: "75", color: "text-amber-500" },
              { icon: DollarSign, label: "Revenue lost per location/yr", value: "$100k+", color: "text-emerald-600" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className={`h-5 w-5 flex-shrink-0 ${color}`} />
                <div>
                  <div className={`font-bold text-sm ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full text-base font-semibold"
          onClick={handleCTA}
          data-testid="roi-cta-button"
        >
          Start Free — Get $10 Trial Credit
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          No subscription required. Pay only for what you use. Results are estimates based on your inputs.
        </p>
      </div>
    </div>
  );
}
