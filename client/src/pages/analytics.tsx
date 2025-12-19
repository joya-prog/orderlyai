import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Clock, CheckCircle2, Bot, DollarSign, TrendingUp, TrendingDown, Calendar, CalendarDays, ShoppingBag, Users, ChevronDown, ChevronUp, X } from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalyticsEvent } from "@shared/schema";

type ExpandedCard = "calls" | "orders" | null;

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatPercentage(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

interface AnalyticsOverview {
  totalCalls: number;
  totalOrders: number;
  totalReservations: number;
  avgDuration: number;
  events: number;
}

type DateRangePreset = "7days" | "30days" | "90days" | "12months" | "alltime";

function getDateRangeFromPreset(preset: DateRangePreset): { startDate: string; endDate: string } {
  const endDate = new Date();
  let startDate: Date;

  switch (preset) {
    case "7days":
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30days":
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90days":
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "12months":
      startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      break;
    case "alltime":
      startDate = new Date("2020-01-01");
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
}

interface RevenueComparison {
  currentPeriod: number;
  vsYesterday: number;
  vsLastWeek: number;
  vsLastMonth: number;
  allTime: number;
}

function calculateRevenueComparisons(
  selectedEvents: AnalyticsEvent[],
  comparisonEvents: AnalyticsEvent[]
): RevenueComparison {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const getAmount = (event: AnalyticsEvent): number => {
    const rawAmount = (event.metadata as any).amount;
    return typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount) || 0;
  };

  const filterOrderEvents = (events: AnalyticsEvent[]) => 
    events.filter((e) => e.eventType === 'order_placed' && e.metadata && typeof e.metadata === 'object');

  const selectedOrderEvents = filterOrderEvents(selectedEvents);
  const comparisonOrderEvents = filterOrderEvents(comparisonEvents);

  const getRevenueInRange = (events: AnalyticsEvent[], start: Date, end: Date): number => {
    return filterOrderEvents(events)
      .filter((e) => {
        if (!e.createdAt) return false;
        const eventDate = new Date(e.createdAt);
        return eventDate >= start && eventDate < end;
      })
      .reduce((sum, e) => sum + getAmount(e), 0);
  };

  const calcPercent = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const currentPeriodRevenue = selectedOrderEvents.reduce((sum, e) => sum + getAmount(e), 0);
  const allTimeRevenue = comparisonOrderEvents.reduce((sum, e) => sum + getAmount(e), 0);
  
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev7Days = new Date(last7Days.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prev30Days = new Date(last30Days.getTime() - 30 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dayBeforeYesterday = new Date(yesterday.getTime() - 24 * 60 * 60 * 1000);

  const yesterdayRevenue = getRevenueInRange(comparisonEvents, yesterday, today);
  const dayBeforeRevenue = getRevenueInRange(comparisonEvents, dayBeforeYesterday, yesterday);
  const last7DaysRevenue = getRevenueInRange(comparisonEvents, last7Days, now);
  const prev7DaysRevenue = getRevenueInRange(comparisonEvents, prev7Days, last7Days);
  const last30DaysRevenue = getRevenueInRange(comparisonEvents, last30Days, now);
  const prev30DaysRevenue = getRevenueInRange(comparisonEvents, prev30Days, last30Days);

  return {
    currentPeriod: currentPeriodRevenue,
    vsYesterday: calcPercent(yesterdayRevenue, dayBeforeRevenue),
    vsLastWeek: calcPercent(last7DaysRevenue, prev7DaysRevenue),
    vsLastMonth: calcPercent(last30DaysRevenue, prev30DaysRevenue),
    allTime: allTimeRevenue,
  };
}

const CHART_COLORS = {
  primary: 'hsl(217 91% 60%)',
  accent: 'hsl(168 76% 42%)',
  chart1: 'hsl(217 91% 60%)',
  chart2: 'hsl(168 76% 42%)', 
  chart3: 'hsl(84 85% 43%)',
  chart4: 'hsl(43 96% 56%)',
  chart5: 'hsl(280 65% 60%)',
  muted: 'hsl(var(--muted-foreground))',
  border: 'hsl(var(--border))',
  card: 'hsl(var(--card))',
};

const PIE_COLORS = ['hsl(217 91% 60%)', 'hsl(168 76% 42%)', 'hsl(84 85% 43%)', 'hsl(43 96% 56%)', 'hsl(280 65% 60%)', 'hsl(0 72% 51%)'];

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatter?: (value: any) => string;
}

function CustomTooltip({ active, payload, label, formatter }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="bg-card border border-border rounded-xl shadow-lg p-3 min-w-[120px]">
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  );
}

function PercentBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value >= 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${
        isPositive 
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {formatPercentage(value)}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [activeChartIndex, setActiveChartIndex] = useState<number | null>(null);
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);
  
  const dateRange = useMemo(() => getDateRangeFromPreset(datePreset), [datePreset]);

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: [`/api/analytics/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<AnalyticsEvent[]>({
    queryKey: [`/api/analytics/events?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const comparisonDateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, []);

  const { data: comparisonEvents } = useQuery<AnalyticsEvent[]>({
    queryKey: [`/api/analytics/events?startDate=${comparisonDateRange.startDate}&endDate=${comparisonDateRange.endDate}`],
  });

  const callVolumeData = events && events.length > 0 ? processCallVolumeData(events) : [];
  const callOutcomeData = events && events.length > 0 ? processCallOutcomeData(events) : [];
  const agentPerformanceData = events && events.length > 0 ? processAgentPerformanceData(events) : [];
  const revenueData = events && events.length > 0 ? processRevenueData(events) : [];
  const hourlyData = events && events.length > 0 ? processHourlyData(events) : [];
  const revenueComparison = (events && comparisonEvents) 
    ? calculateRevenueComparisons(events, comparisonEvents) 
    : null;

  const isLoading = overviewLoading || eventsLoading;
  const hasData = events && events.length > 0;

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="page-analytics">
      <div className="flex-1 p-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-sans" data-testid="text-page-title">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Real-time insights into your AI agent performance
            </p>
          </div>
          <Select value={datePreset} onValueChange={(value: DateRangePreset) => setDatePreset(value)}>
            <SelectTrigger className="w-[180px] h-11 bg-card shadow-sm" data-testid="select-date-range">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days" data-testid="option-7days">Last 7 days</SelectItem>
              <SelectItem value="30days" data-testid="option-30days">Last 30 days</SelectItem>
              <SelectItem value="90days" data-testid="option-90days">Last 90 days</SelectItem>
              <SelectItem value="12months" data-testid="option-12months">Last 12 months</SelectItem>
              <SelectItem value="alltime" data-testid="option-alltime">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics Cards - Top Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card 
            data-testid="card-metric-total-calls" 
            className={`hover-elevate transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg ${expandedCard === 'calls' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setExpandedCard(expandedCard === 'calls' ? null : 'calls')}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Calls</CardTitle>
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10">
                  <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                {hasData && (
                  <div className="text-muted-foreground">
                    {expandedCard === 'calls' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-4xl font-bold tracking-tight" data-testid="text-total-calls">
                    {(overview?.totalCalls ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasData ? "Click to view trends" : "No data yet"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            data-testid="card-metric-total-orders" 
            className={`hover-elevate transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg ${expandedCard === 'orders' ? 'ring-2 ring-teal-500' : ''}`}
            onClick={() => setExpandedCard(expandedCard === 'orders' ? null : 'orders')}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Orders</CardTitle>
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10">
                  <ShoppingBag className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                {hasData && (
                  <div className="text-muted-foreground">
                    {expandedCard === 'orders' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-4xl font-bold tracking-tight" data-testid="text-total-orders">
                    {overview?.totalOrders ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasData ? "Click to view trends" : "No orders yet"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-reservations" className="hover-elevate transition-all duration-300 shadow-md hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reservations</CardTitle>
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-500/10">
                <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-4xl font-bold tracking-tight" data-testid="text-reservations">
                    {overview?.totalReservations ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasData ? "Bookings made" : "No reservations"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-avg-duration" className="hover-elevate transition-all duration-300 shadow-md hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Duration</CardTitle>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <>
                  <div className="text-4xl font-bold tracking-tight" data-testid="text-avg-duration">
                    {formatDuration(overview?.avgDuration ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {hasData ? "Per conversation" : "No calls recorded"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expandable Detailed Charts */}
        <AnimatePresence>
          {expandedCard && hasData && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Card 
                data-testid={`card-expanded-${expandedCard}`}
                className="overflow-hidden border-2"
                style={{ 
                  borderColor: expandedCard === 'calls' ? 'hsl(var(--primary))' : '#22c55e'
                }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${expandedCard === 'calls' ? 'bg-primary/10' : 'bg-green-500/10'}`}>
                        {expandedCard === 'calls' ? (
                          <Phone className="h-5 w-5 text-primary" />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-xl">
                          {expandedCard === 'calls' ? 'Call Volume Details' : 'Order Volume Details'}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {expandedCard === 'calls' 
                            ? 'Interactive view of daily call activity' 
                            : 'Interactive view of daily order activity'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setExpandedCard(null)}
                      data-testid="button-close-expanded"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {expandedCard === 'calls' ? (
                    <div className="space-y-6">
                      {/* Calls Line Chart */}
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={callVolumeData}>
                            <defs>
                              <linearGradient id="callsLineGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
                                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} />
                            <XAxis 
                              dataKey="date" 
                              stroke={CHART_COLORS.muted} 
                              fontSize={12} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              stroke={CHART_COLORS.muted} 
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip 
                              content={({ active, payload, label }) => {
                                if (!active || !payload || !payload.length) return null;
                                return (
                                  <div className="bg-card border border-border rounded-xl shadow-lg p-4 min-w-[150px]">
                                    <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
                                    <p className="text-2xl font-bold text-primary">{payload[0].value} calls</p>
                                  </div>
                                );
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="calls" 
                              name="Calls"
                              stroke={CHART_COLORS.primary} 
                              strokeWidth={3}
                              dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ 
                                r: 8, 
                                fill: CHART_COLORS.primary,
                                stroke: '#fff',
                                strokeWidth: 3,
                                style: { filter: 'drop-shadow(0 0 8px hsl(var(--primary)))' }
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Calls Bar Chart */}
                      <div className="h-[200px]">
                        <p className="text-sm font-medium text-muted-foreground mb-3">Daily Breakdown</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={callVolumeData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} vertical={false} />
                            <XAxis 
                              dataKey="date" 
                              stroke={CHART_COLORS.muted} 
                              fontSize={11} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              stroke={CHART_COLORS.muted} 
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar 
                              dataKey="calls" 
                              name="Calls"
                              fill={CHART_COLORS.primary}
                              radius={[6, 6, 0, 0]}
                              maxBarSize={40}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Orders Line Chart */}
                      <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={processOrderVolumeData(events || [])}>
                            <defs>
                              <linearGradient id="ordersLineGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3}/>
                                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} />
                            <XAxis 
                              dataKey="date" 
                              stroke={CHART_COLORS.muted} 
                              fontSize={12} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              stroke={CHART_COLORS.muted} 
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip 
                              content={({ active, payload, label }) => {
                                if (!active || !payload || !payload.length) return null;
                                return (
                                  <div className="bg-card border border-border rounded-xl shadow-lg p-4 min-w-[150px]">
                                    <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
                                    <p className="text-2xl font-bold text-green-600">{payload[0].value} orders</p>
                                    {payload[1] && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        Revenue: {formatCurrency(payload[1].value as number)}
                                      </p>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="orders" 
                              name="Orders"
                              stroke="#22c55e" 
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#22c55e', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ 
                                r: 8, 
                                fill: '#22c55e',
                                stroke: '#fff',
                                strokeWidth: 3,
                                style: { filter: 'drop-shadow(0 0 8px #22c55e)' }
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Orders Bar Chart with Revenue */}
                      <div className="h-[200px]">
                        <p className="text-sm font-medium text-muted-foreground mb-3">Order Volume & Revenue</p>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={processOrderVolumeData(events || [])}>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} vertical={false} />
                            <XAxis 
                              dataKey="date" 
                              stroke={CHART_COLORS.muted} 
                              fontSize={11} 
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              yAxisId="left"
                              stroke={CHART_COLORS.muted} 
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              stroke={CHART_COLORS.muted} 
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) => `$${value}`}
                            />
                            <Tooltip 
                              content={({ active, payload, label }) => {
                                if (!active || !payload || !payload.length) return null;
                                return (
                                  <div className="bg-card border border-border rounded-xl shadow-lg p-3">
                                    <p className="text-sm font-medium">{label}</p>
                                    {payload.map((entry: any, index: number) => (
                                      <p key={index} className="text-sm" style={{ color: entry.color }}>
                                        {entry.name}: {entry.name === 'Revenue' ? formatCurrency(entry.value) : entry.value}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Bar 
                              yAxisId="left"
                              dataKey="orders" 
                              name="Orders"
                              fill="#22c55e"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={30}
                            />
                            <Bar 
                              yAxisId="right"
                              dataKey="revenue" 
                              name="Revenue"
                              fill={CHART_COLORS.chart2}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={30}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revenue Card - Full Width with Comparisons */}
        <Card data-testid="card-metric-revenue" className="hover-elevate transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-accent/10">
                  <DollarSign className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Revenue ({datePreset === 'alltime' ? 'All Time' : `Last ${datePreset.replace('days', ' Days').replace('months', ' Months')}`})
                  </CardTitle>
                  {isLoading ? (
                    <Skeleton className="h-10 w-32 mt-1" />
                  ) : (
                    <div className="text-4xl font-bold tracking-tight mt-1" data-testid="text-revenue">
                      {formatCurrency(revenueComparison?.currentPeriod ?? 0)}
                    </div>
                  )}
                </div>
              </div>
              {!isLoading && revenueComparison && hasData && revenueComparison.allTime !== revenueComparison.currentPeriod && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">All Time Total</p>
                  <p className="text-lg font-semibold">{formatCurrency(revenueComparison.allTime)}</p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex gap-4">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
              </div>
            ) : revenueComparison && hasData ? (
              <div className="flex flex-wrap gap-4 pt-2 border-t border-border/50">
                <div className="pt-3 flex flex-wrap gap-4">
                  <PercentBadge value={revenueComparison.vsYesterday} label="yesterday vs day before" />
                  <PercentBadge value={revenueComparison.vsLastWeek} label="last 7 days vs prior 7" />
                  <PercentBadge value={revenueComparison.vsLastMonth} label="last 30 days vs prior 30" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No revenue data available</p>
            )}
          </CardContent>
        </Card>

        {/* Charts Section */}
        {!hasData && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Analytics Data Yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  Start testing your AI agents or connect them to phone numbers to see real-time analytics
                </p>
                <Button>Test an Agent</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <>
            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Call Volume Area Chart */}
              <Card data-testid="card-chart-call-volume" className="hover-elevate transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Call Volume Trends</CardTitle>
                  <p className="text-sm text-muted-foreground">Daily call activity over time</p>
                </CardHeader>
                <CardContent className="pt-4">
                  {callVolumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={callVolumeData}>
                        <defs>
                          <linearGradient id="colorCallsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.4}/>
                            <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} />
                        <XAxis 
                          dataKey="date" 
                          stroke={CHART_COLORS.muted} 
                          fontSize={11} 
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke={CHART_COLORS.muted} 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="calls" 
                          name="Calls"
                          stroke={CHART_COLORS.primary} 
                          strokeWidth={2.5}
                          fill="url(#colorCallsGradient)"
                          dot={false}
                          activeDot={{ 
                            r: 6, 
                            fill: CHART_COLORS.primary,
                            stroke: '#fff',
                            strokeWidth: 2
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                      No call volume data
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Trend Chart */}
              <Card data-testid="card-chart-revenue-trend" className="hover-elevate transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Revenue Trend</CardTitle>
                  <p className="text-sm text-muted-foreground">Order revenue over time</p>
                </CardHeader>
                <CardContent className="pt-4">
                  {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="colorRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS.chart1} stopOpacity={0.4}/>
                            <stop offset="100%" stopColor={CHART_COLORS.chart1} stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} />
                        <XAxis 
                          dataKey="date" 
                          stroke={CHART_COLORS.muted} 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke={CHART_COLORS.muted} 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
                        <Area 
                          type="monotone" 
                          dataKey="revenue"
                          name="Revenue"
                          stroke={CHART_COLORS.chart1} 
                          strokeWidth={2.5}
                          fill="url(#colorRevenueGradient)"
                          dot={false}
                          activeDot={{ 
                            r: 6, 
                            fill: CHART_COLORS.chart1,
                            stroke: '#fff',
                            strokeWidth: 2
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                      No revenue trend data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Second Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Event Types Donut Chart */}
              <Card data-testid="card-chart-event-types" className="hover-elevate transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Event Breakdown</CardTitle>
                  <p className="text-sm text-muted-foreground">Distribution by type</p>
                </CardHeader>
                <CardContent className="pt-4">
                  {callOutcomeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={callOutcomeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          onMouseEnter={(_, index) => setActiveChartIndex(index)}
                          onMouseLeave={() => setActiveChartIndex(null)}
                        >
                          {callOutcomeData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                              opacity={activeChartIndex === null || activeChartIndex === index ? 1 : 0.5}
                              style={{ 
                                transition: 'opacity 0.2s ease-in-out',
                                cursor: 'pointer'
                              }}
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="bg-card border border-border rounded-xl shadow-lg p-3">
                                <p className="text-sm font-medium">{data.name}</p>
                                <p className="text-sm text-muted-foreground">{data.value} events</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      No event data
                    </div>
                  )}
                  {callOutcomeData.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {callOutcomeData.slice(0, 4).map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-1.5">
                          <div 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                          />
                          <span className="text-xs text-muted-foreground capitalize">
                            {entry.name.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hourly Activity Bar Chart */}
              <Card data-testid="card-chart-hourly" className="hover-elevate transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Peak Hours</CardTitle>
                  <p className="text-sm text-muted-foreground">Activity by hour of day</p>
                </CardHeader>
                <CardContent className="pt-4">
                  {hourlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} vertical={false} />
                        <XAxis 
                          dataKey="hour" 
                          stroke={CHART_COLORS.muted} 
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          stroke={CHART_COLORS.muted} 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="count" 
                          name="Events"
                          fill={CHART_COLORS.chart2}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      No hourly data
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agent Performance Bar Chart */}
              <Card data-testid="card-chart-agent-performance" className="hover-elevate transition-all duration-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Agent Activity</CardTitle>
                  <p className="text-sm text-muted-foreground">Events by agent</p>
                </CardHeader>
                <CardContent className="pt-4">
                  {agentPerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={agentPerformanceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} opacity={0.5} horizontal={false} />
                        <XAxis 
                          type="number"
                          stroke={CHART_COLORS.muted} 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis 
                          type="category"
                          dataKey="name" 
                          stroke={CHART_COLORS.muted} 
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          width={80}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="events"
                          name="Events"
                          fill={CHART_COLORS.chart3}
                          radius={[0, 4, 4, 0]}
                          maxBarSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                      No agent data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function processCallVolumeData(events: AnalyticsEvent[]) {
  const dailyMap = new Map<string, { calls: number; timestamp: number }>();
  
  events.forEach((event) => {
    if (event.createdAt) {
      const dateObj = new Date(event.createdAt);
      const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const existing = dailyMap.get(date) || { calls: 0, timestamp: dateObj.getTime() };
      dailyMap.set(date, { calls: existing.calls + 1, timestamp: existing.timestamp });
    }
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, calls: data.calls, timestamp: data.timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-14)
    .map(({ date, calls }) => ({ date, calls }));
}

function processCallOutcomeData(events: AnalyticsEvent[]) {
  const typeMap = new Map<string, number>();
  
  events.forEach((event) => {
    typeMap.set(event.eventType, (typeMap.get(event.eventType) || 0) + 1);
  });

  return Array.from(typeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function processAgentPerformanceData(events: AnalyticsEvent[]) {
  const agentMap = new Map<string, { name: string; events: number }>();
  
  events.forEach((event) => {
    const agentKey = event.agentId || 'unknown';
    const existing = agentMap.get(agentKey) || {
      name: event.agentId ? `Agent ${event.agentId.slice(0, 6)}` : 'General',
      events: 0
    };
    existing.events += 1;
    agentMap.set(agentKey, existing);
  });

  return Array.from(agentMap.values())
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);
}

function processRevenueData(events: AnalyticsEvent[]) {
  const dailyRevenue = new Map<string, { revenue: number; timestamp: number }>();
  
  events
    .filter((e) => e.eventType === 'order_placed' && e.metadata && typeof e.metadata === 'object' && e.createdAt)
    .forEach((event) => {
      const dateObj = new Date(event.createdAt!);
      const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const rawAmount = (event.metadata as any).amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount) || 0;
      const existing = dailyRevenue.get(date) || { revenue: 0, timestamp: dateObj.getTime() };
      dailyRevenue.set(date, { revenue: existing.revenue + amount, timestamp: existing.timestamp });
    });

  return Array.from(dailyRevenue.entries())
    .map(([date, data]) => ({ date, revenue: data.revenue, timestamp: data.timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-14)
    .map(({ date, revenue }) => ({ date, revenue }));
}

function processHourlyData(events: AnalyticsEvent[]) {
  const hourlyMap = new Map<number, number>();
  
  for (let i = 0; i < 24; i++) {
    hourlyMap.set(i, 0);
  }
  
  events.forEach((event) => {
    if (event.createdAt) {
      const hour = new Date(event.createdAt).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    }
  });

  return Array.from(hourlyMap.entries())
    .map(([hour, count]) => ({
      hour: hour === 0 ? '12am' : hour === 12 ? '12pm' : hour > 12 ? `${hour - 12}pm` : `${hour}am`,
      count,
      rawHour: hour
    }))
    .sort((a, b) => a.rawHour - b.rawHour)
    .map(({ hour, count }) => ({ hour, count }));
}

function processOrderVolumeData(events: AnalyticsEvent[]) {
  const dailyMap = new Map<string, { orders: number; revenue: number; timestamp: number }>();
  
  events
    .filter((e) => e.eventType === 'order_placed' && e.createdAt)
    .forEach((event) => {
      const dateObj = new Date(event.createdAt!);
      const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const rawAmount = event.metadata && typeof event.metadata === 'object' 
        ? (event.metadata as any).amount 
        : 0;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount) || 0;
      const existing = dailyMap.get(date) || { orders: 0, revenue: 0, timestamp: dateObj.getTime() };
      dailyMap.set(date, { 
        orders: existing.orders + 1, 
        revenue: existing.revenue + amount,
        timestamp: existing.timestamp 
      });
    });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, orders: data.orders, revenue: data.revenue, timestamp: data.timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-14)
    .map(({ date, orders, revenue }) => ({ date, orders, revenue }));
}
