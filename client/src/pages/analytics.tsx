import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Phone, Clock, DollarSign, Timer,
  Maximize2, PhoneCall, PhoneMissed, ChevronRight, BarChart2, Zap,
  CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadialBarChart, RadialBar,
} from "recharts";
import type { AnalyticsEvent, CallLog } from "@shared/schema";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface AnalyticsOverview {
  totalCalls: number;
  totalOrders: number;
  totalReservations: number;
  avgDuration: number;
  events: number;
}

interface UsageSummary {
  current: {
    totalMinutes: number;
    totalCostCents: number;
    callCount: number;
    avgDurationSeconds: number;
    dailyBreakdown: Array<{ date: string; minutes: number; costCents: number; callCount: number }>;
  };
  previous: {
    totalMinutes: number;
    totalCostCents: number;
    callCount: number;
    avgDurationSeconds: number;
  };
}

interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  restaurantName?: string;
}

type DateRangePreset = "7days" | "30days" | "90days" | "12months";
type ExpandType = "calls" | "revenue" | "peakhours" | "conversion" | "recentcalls";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds === 0) return "0m 0s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(Math.round(num));
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function getDateRange(preset: DateRangePreset): { startDate: string; endDate: string } {
  const end = new Date();
  let ms: number;
  switch (preset) {
    case "7days":    ms = 7 * 86400000; break;
    case "30days":   ms = 30 * 86400000; break;
    case "90days":   ms = 90 * 86400000; break;
    case "12months": ms = 365 * 86400000; break;
  }
  return {
    startDate: new Date(Date.now() - ms).toISOString(),
    endDate: end.toISOString(),
  };
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const TAGLINES = [
  "Here's how your AI agent is performing.",
  "Let's see what your callers were up to.",
  "Your performance summary is ready.",
  "Here's your latest call intelligence.",
  "Your voice AI insights at a glance.",
  "Let's see what happened on the phones.",
  "Here's your restaurant's AI activity report.",
];

function getDailyTagline(): string {
  const day = new Date().getDay();
  return TAGLINES[day % TAGLINES.length];
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  "7days": "7 days",
  "30days": "30 days",
  "90days": "90 days",
  "12months": "12 months",
};

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) {
    return <div className="h-8 bg-muted/20 rounded" />;
  }
  const chartData = data.map((value, index) => ({ value, index }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrendBadge({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
        up
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      }`}
      data-testid="badge-trend"
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 py-8 text-center">
      <div className="p-3 rounded-full bg-muted/40">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[200px]">{hint}</p>
    </div>
  );
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<DateRangePreset>("30days");
  const [expanded, setExpanded] = useState<{ type: ExpandType; title: string } | null>(null);

  const dateRange = useMemo(() => getDateRange(preset), [preset]);

  const { data: user } = useQuery<AuthUser>({ queryKey: ["/api/auth/user"] });

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: [`/api/analytics/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<AnalyticsEvent[]>({
    queryKey: [`/api/analytics/events?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const { data: usage, isLoading: usageLoading } = useQuery<UsageSummary>({
    queryKey: [`/api/analytics/usage-summary?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const { data: callLogs, isLoading: logsLoading } = useQuery<CallLog[]>({
    queryKey: ["/api/call-logs"],
  });

  const isLoading = overviewLoading || eventsLoading || usageLoading;

  // ── Processed event data ──
  const processed = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        callVolumeData: [] as Array<{ date: string; calls: number; orders: number; reservations: number }>,
        hourlyData: [] as Array<{ hour: string; count: number; rawHour: number }>,
        conversionRate: 0,
      };
    }

    const dailyMap = new Map<string, { calls: number; orders: number; reservations: number; ts: number }>();
    const hourlyMap = new Map<number, number>();
    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);

    let callsStarted = 0, ordersPlaced = 0;

    events.forEach((e) => {
      if (!e.createdAt) return;
      const d = new Date(e.createdAt);
      const dateKey = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const hour = d.getHours();

      const existing = dailyMap.get(dateKey) ?? { calls: 0, orders: 0, reservations: 0, ts: d.getTime() };
      existing.calls++;
      if (e.eventType === "order_placed") existing.orders++;
      if (e.eventType === "reservation_created") existing.reservations++;
      dailyMap.set(dateKey, existing);
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);

      if (e.eventType === "call_started") callsStarted++;
      if (e.eventType === "order_placed") ordersPlaced++;
    });

    const callVolumeData = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, calls: v.calls, orders: v.orders, reservations: v.reservations, ts: v.ts }))
      .sort((a, b) => a.ts - b.ts)
      .slice(-14)
      .map(({ ts: _ts, ...rest }) => rest);

    const hourlyData = Array.from(hourlyMap.entries())
      .map(([h, count]) => ({
        hour: h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`,
        count,
        rawHour: h,
      }))
      .sort((a, b) => a.rawHour - b.rawHour);

    const conversionRate = callsStarted > 0 ? (ordersPlaced / callsStarted) * 100 : 0;

    return { callVolumeData, hourlyData, conversionRate };
  }, [events]);

  // ── KPI sparklines from daily usage breakdown ──
  const sparklines = useMemo(() => {
    const breakdown = usage?.current?.dailyBreakdown ?? [];
    return {
      calls: breakdown.map((d) => d.callCount),
      minutes: breakdown.map((d) => d.minutes),
      cost: breakdown.map((d) => d.costCents / 100),
    };
  }, [usage]);

  // ── KPI trends ──
  const trends = useMemo(() => {
    if (!usage) return { calls: 0, minutes: 0, cost: 0, duration: 0 };
    const { current, previous } = usage;
    return {
      calls: calcTrend(current.callCount, previous.callCount),
      minutes: calcTrend(current.totalMinutes, previous.totalMinutes),
      cost: calcTrend(current.totalCostCents, previous.totalCostCents),
      duration: calcTrend(current.avgDurationSeconds, previous.avgDurationSeconds),
    };
  }, [usage]);

  // ── Duration sparklines from call volume data ──
  const durationSparkline = useMemo(() => {
    return processed.callVolumeData.map((d) => d.calls);
  }, [processed]);

  // ── Peak hours color scale ──
  const maxHourCount = useMemo(
    () => Math.max(...processed.hourlyData.map((d) => d.count), 1),
    [processed.hourlyData]
  );

  const getHourColor = (count: number) => {
    const ratio = count / maxHourCount;
    if (ratio < 0.25) return "hsl(217 91% 70%)";
    if (ratio < 0.5) return "hsl(199 89% 58%)";
    if (ratio < 0.75) return "hsl(43 96% 56%)";
    return "hsl(25 95% 53%)";
  };

  // ── Recent calls ──
  const recentCalls = useMemo(() => (callLogs ?? []).slice(0, 6), [callLogs]);

  // ── Donut/gauge for AI performance ──
  const gaugeData = useMemo(() => {
    const score = Math.min(Math.round(processed.conversionRate), 100);
    const color =
      score < 10 ? "hsl(0 84% 60%)" : score < 25 ? "hsl(43 96% 56%)" : "hsl(142 76% 36%)";
    return { score, color };
  }, [processed.conversionRate]);

  const performanceInsight = useMemo(() => {
    const { score } = gaugeData;
    if (score === 0) return "No orders recorded yet — calls are coming in.";
    if (score < 10) return `${score}% of calls result in an order.`;
    const n = Math.round(100 / score);
    return `Roughly 1 in ${n} calls results in an order.`;
  }, [gaugeData]);

  // ── Expand modal chart renderer ──
  function renderExpandedContent() {
    if (!expanded) return null;

    switch (expanded.type) {
      case "calls":
        if (!processed.callVolumeData.length)
          return <EmptyState icon={BarChart2} title="No call data yet" hint="Call activity will appear once your agent starts handling calls." />;
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processed.callVolumeData} barGap={4} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="calls" name="Calls" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="orders" name="Orders" fill="hsl(168 76% 42%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reservations" name="Reservations" fill="hsl(280 65% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "revenue": {
        const breakdown = usage?.current?.dailyBreakdown ?? [];
        if (!breakdown.length)
          return <EmptyState icon={DollarSign} title="No usage data yet" hint="Cost data will appear after your first call." />;
        const data = breakdown.map((d) => ({ date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }), cost: d.costCents / 100 }));
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="costGradEx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `$${v.toFixed(2)}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(3)}`, "Cost"]} />
              <Area type="monotone" dataKey="cost" stroke="hsl(142 76% 36%)" strokeWidth={2} fill="url(#costGradEx)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        );
      }

      case "peakhours":
        if (!processed.hourlyData.length)
          return <EmptyState icon={Clock} title="No hourly data yet" hint="Peak hours will appear once calls come in." />;
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={processed.hourlyData} barCategoryGap="10%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" name="Calls" radius={[4, 4, 0, 0]}>
                {processed.hourlyData.map((entry, i) => (
                  <Cell key={i} fill={getHourColor(entry.count)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "recentcalls":
        return (
          <div className="space-y-2">
            {callLogs && callLogs.length > 0 ? callLogs.slice(0, 20).map((log) => (
              <CallRow key={log.id} log={log} />
            )) : (
              <EmptyState icon={PhoneCall} title="No calls yet" hint="Recent calls will appear here after your agent handles its first call." />
            )}
          </div>
        );

      default:
        return null;
    }
  }

  const displayName = user?.restaurantName || user?.firstName || "there";

  return (
    <div className="flex flex-col h-full overflow-y-auto" data-testid="page-analytics">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-shrink-0 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-greeting">
            {getGreeting()}, {displayName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{getDailyTagline()}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border bg-muted/40 p-1 flex-shrink-0">
          {(["7days", "30days", "90days", "12months"] as DateRangePreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              data-testid={`button-preset-${p}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                preset === p
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6 flex flex-col gap-5">
        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Calls"
            icon={Phone}
            iconColor="text-blue-600"
            value={isLoading ? null : formatNumber(usage?.current?.callCount ?? overview?.totalCalls ?? 0)}
            trend={isLoading ? null : trends.calls}
            sparkData={sparklines.calls}
            sparkColor="hsl(217 91% 60%)"
            testId="card-kpi-calls"
          />
          <KpiCard
            label="Minutes Used"
            icon={Timer}
            iconColor="text-teal-600"
            value={isLoading ? null : `${formatNumber(usage?.current?.totalMinutes ?? 0)}m`}
            trend={isLoading ? null : trends.minutes}
            sparkData={sparklines.minutes}
            sparkColor="hsl(168 76% 42%)"
            testId="card-kpi-minutes"
          />
          <KpiCard
            label="Estimated Cost"
            icon={DollarSign}
            iconColor="text-green-600"
            value={isLoading ? null : formatCents(usage?.current?.totalCostCents ?? 0)}
            trend={isLoading ? null : trends.cost}
            sparkData={sparklines.cost}
            sparkColor="hsl(142 76% 36%)"
            testId="card-kpi-cost"
          />
          <KpiCard
            label="Avg Call Duration"
            icon={Clock}
            iconColor="text-amber-600"
            value={isLoading ? null : formatDuration(usage?.current?.avgDurationSeconds ?? overview?.avgDuration ?? 0)}
            trend={isLoading ? null : trends.duration}
            sparkData={durationSparkline}
            sparkColor="hsl(43 96% 56%)"
            testId="card-kpi-duration"
          />
        </div>

        {/* ── Call Volume Chart ── */}
        <Card data-testid="card-chart-calls">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
            <div>
              <CardTitle className="text-base font-semibold">Call Volume & Activity</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Daily calls, orders, and reservations</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {[
                  { color: "hsl(217 91% 60%)", label: "Calls" },
                  { color: "hsl(168 76% 42%)", label: "Orders" },
                  { color: "hsl(280 65% 60%)", label: "Reservations" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpanded({ type: "calls", title: "Call Volume & Activity" })}
                data-testid="button-expand-calls"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : processed.callVolumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processed.callVolumeData} barGap={3} barCategoryGap="18%">
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={28} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="calls" name="Calls" fill="hsl(217 91% 60%)" radius={[3, 3, 0, 0]} barSize={14} />
                    <Bar dataKey="orders" name="Orders" fill="hsl(168 76% 42%)" radius={[3, 3, 0, 0]} barSize={14} />
                    <Bar dataKey="reservations" name="Reservations" fill="hsl(280 65% 60%)" radius={[3, 3, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={BarChart2}
                  title="No activity yet"
                  hint="Call, order, and reservation data will appear here once your agent goes live."
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Revenue Trend + Peak Hours ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue / Cost Trend */}
          <Card data-testid="card-chart-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
              <div>
                <CardTitle className="text-base font-semibold">Cost Trend</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Daily AI usage cost</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpanded({ type: "revenue", title: "Cost Trend" })}
                data-testid="button-expand-revenue"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                {usageLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (usage?.current?.dailyBreakdown ?? []).length > 0 ? (() => {
                  const data = (usage!.current.dailyBreakdown).map((d) => ({
                    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    cost: d.costCents / 100,
                  }));
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data}>
                        <defs>
                          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false} hide />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`$${v.toFixed(3)}`, "Cost"]} />
                        <Area type="monotone" dataKey="cost" stroke="hsl(142 76% 36%)" strokeWidth={2} fill="url(#costGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })() : (
                  <EmptyState
                    icon={DollarSign}
                    title="No cost data yet"
                    hint="Usage costs will appear after your first call."
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Peak Call Hours */}
          <Card data-testid="card-chart-peakhours">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
              <div>
                <CardTitle className="text-base font-semibold">Peak Call Hours</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">When your callers reach out most</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpanded({ type: "peakhours", title: "Peak Call Hours" })}
                data-testid="button-expand-peakhours"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="h-44">
                {eventsLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : processed.hourlyData.some((d) => d.count > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={processed.hourlyData} barCategoryGap="12%">
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={3} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={24} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Calls"]} />
                      <Bar dataKey="count" name="Calls" radius={[3, 3, 0, 0]} barSize={14}>
                        {processed.hourlyData.map((entry, i) => (
                          <Cell key={i} fill={getHourColor(entry.count)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title="No hourly data yet"
                    hint="Peak hours will show once calls start coming in."
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── AI Performance Score + Recent Calls ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* AI Performance Donut */}
          <Card className="md:col-span-2" data-testid="card-ai-performance">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">AI Performance Score</CardTitle>
              <p className="text-xs text-muted-foreground">Call-to-order conversion rate</p>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-2">
              {eventsLoading ? (
                <Skeleton className="h-36 w-36 rounded-full" />
              ) : (
                <>
                  <div className="relative">
                    <ResponsiveContainer width={144} height={144}>
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        startAngle={90}
                        endAngle={-270}
                        data={[{ value: gaugeData.score, fill: gaugeData.color }]}
                      >
                        <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "hsl(var(--muted))" }} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-bold" style={{ color: gaugeData.color }} data-testid="text-conversion-rate">
                        {gaugeData.score}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">conversion</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-medium">Insight</span>
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[180px] text-center">{performanceInsight}</p>
                  </div>
                  <div className="flex gap-3 text-center">
                    <div>
                      <p className="text-base font-bold" data-testid="text-total-calls">{formatNumber(overview?.totalCalls ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">calls</p>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <p className="text-base font-bold" data-testid="text-total-orders">{formatNumber(overview?.totalOrders ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">orders</p>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <p className="text-base font-bold" data-testid="text-reservations">{formatNumber(overview?.totalReservations ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">reservations</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent Calls Mini-list */}
          <Card className="md:col-span-3" data-testid="card-recent-calls">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 flex-wrap">
              <div>
                <CardTitle className="text-base font-semibold">Recent Calls</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Latest activity from your agent</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpanded({ type: "recentcalls", title: "All Recent Calls" })}
                data-testid="button-expand-recentcalls"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : recentCalls.length > 0 ? (
                <>
                  <div className="space-y-1">
                    {recentCalls.map((log) => (
                      <CallRow key={log.id} log={log} />
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t">
                    <Link href="/calls">
                      <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-view-all-calls">
                        View all calls <ChevronRight className="h-3 w-3" />
                      </button>
                    </Link>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={PhoneCall}
                  title="No calls recorded yet"
                  hint="Your call history will appear here after your first live call."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Expand Modal ── */}
      <Dialog open={!!expanded} onOpenChange={(o) => !o && setExpanded(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{expanded?.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2">{renderExpandedContent()}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────

function KpiCard({
  label, icon: Icon, iconColor, value, trend, sparkData, sparkColor, testId,
}: {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  value: string | null;
  trend: number | null;
  sparkData: number[];
  sparkColor: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        {value === null ? (
          <Skeleton className="h-7 w-20 mb-2" />
        ) : (
          <p className="text-2xl font-bold tracking-tight mb-1" data-testid={`text-${testId}`}>{value}</p>
        )}
        <div className="flex items-center justify-between">
          {trend === null ? <Skeleton className="h-4 w-12" /> : <TrendBadge pct={trend} />}
          <span className="text-[10px] text-muted-foreground">vs prev</span>
        </div>
        <div className="mt-2">
          <MiniSparkline data={sparkData} color={sparkColor} />
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Call Row
// ─────────────────────────────────────────

function CallRow({ log }: { log: CallLog }) {
  const isCompleted = log.status === "completed";
  const dur = parseInt(log.durationSeconds ?? log.duration ?? "0", 10);
  const cost = log.costCents ? parseInt(log.costCents, 10) / 100 : null;
  const caller = log.fromNumber ?? log.callerName ?? "Unknown";

  return (
    <div className="flex items-center justify-between py-2 gap-3" data-testid={`row-call-${log.id}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`p-1.5 rounded-full flex-shrink-0 ${isCompleted ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
          {isCompleted
            ? <PhoneCall className="h-3 w-3 text-green-600 dark:text-green-400" />
            : <PhoneMissed className="h-3 w-3 text-red-600 dark:text-red-400" />
          }
        </div>
        <span className="text-sm font-medium truncate" data-testid={`text-caller-${log.id}`}>{caller}</span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{formatDuration(dur)}</span>
        <Badge
          variant={isCompleted ? "secondary" : "outline"}
          className="text-[10px] px-1.5 py-0"
          data-testid={`badge-status-${log.id}`}
        >
          {log.status}
        </Badge>
        {cost !== null && (
          <span className="text-xs text-muted-foreground">${cost.toFixed(3)}</span>
        )}
      </div>
    </div>
  );
}
