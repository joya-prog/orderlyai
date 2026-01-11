import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, CalendarDays, MoreHorizontal, Zap, Target } from "lucide-react";
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import type { AnalyticsEvent } from "@shared/schema";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function formatNumber(num: number): string {
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
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
    case "7days": startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
    case "30days": startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); break;
    case "90days": startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); break;
    case "12months": startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); break;
    case "alltime": startDate = new Date("2020-01-01"); break;
  }
  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}

const CHART_COLORS = {
  primary: 'hsl(217 91% 60%)', accent: 'hsl(168 76% 42%)', purple: 'hsl(280 65% 60%)',
  amber: 'hsl(43 96% 56%)', green: 'hsl(142 76% 36%)', pink: 'hsl(330 80% 60%)', blue: 'hsl(217 91% 60%)',
};

const PIE_COLORS = ['hsl(217 91% 60%)', 'hsl(168 76% 42%)', 'hsl(280 65% 60%)', 'hsl(43 96% 56%)'];

type ChartType = 'calls' | 'revenue' | 'orders' | 'peakhours' | 'conversion';

interface ExpandedCardData { title: string; type: ChartType; }

function MiniSparkline({ data, color, height = 16 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return <div style={{ height }} className="bg-muted/30 rounded" />;
  const chartData = data.map((value, index) => ({ value, index }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}><Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} /></LineChart>
    </ResponsiveContainer>
  );
}

function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const percentage = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{formatNumber(value)}</span></div>
      <div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} /></div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  const [expandedCard, setExpandedCard] = useState<ExpandedCardData | null>(null);
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
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  }, []);

  const { data: comparisonEvents, isLoading: comparisonLoading } = useQuery<AnalyticsEvent[]>({
    queryKey: [`/api/analytics/events?startDate=${comparisonDateRange.startDate}&endDate=${comparisonDateRange.endDate}`],
  });

  const isLoading = overviewLoading || eventsLoading;
  const hasData = events && events.length > 0;

  const processedData = useMemo(() => {
    if (!events || events.length === 0) {
      return { callVolumeData: [], revenueData: [], hourlyData: [], eventTypeData: [], peakDay: 'N/A', conversionRate: 0, avgOrderValue: 0, totalRevenue: 0, sparklineData: { calls: [], revenue: [], orders: [] } };
    }

    const dailyMap = new Map<string, { calls: number; revenue: number; orders: number; timestamp: number }>();
    const hourlyMap = new Map<number, number>();
    const dayMap = new Map<string, number>();
    const eventTypeMap = new Map<string, number>();
    let totalRevenue = 0, orderCount = 0;

    for (let i = 0; i < 24; i++) hourlyMap.set(i, 0);

    events.forEach((event) => {
      if (!event.createdAt) return;
      const dateObj = new Date(event.createdAt);
      const date = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const hour = dateObj.getHours();
      const existing = dailyMap.get(date) || { calls: 0, revenue: 0, orders: 0, timestamp: dateObj.getTime() };
      existing.calls += 1;
      if (event.eventType === 'order_placed' && event.metadata) {
        const amount = typeof (event.metadata as any).amount === 'number' ? (event.metadata as any).amount : parseFloat((event.metadata as any).amount) || 0;
        existing.revenue += amount; existing.orders += 1; totalRevenue += amount; orderCount++;
      }
      dailyMap.set(date, existing);
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      dayMap.set(dayName, (dayMap.get(dayName) || 0) + 1);
      eventTypeMap.set(event.eventType, (eventTypeMap.get(event.eventType) || 0) + 1);
    });

    const callVolumeData = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })).sort((a, b) => a.timestamp - b.timestamp).slice(-14);
    const hourlyData = Array.from(hourlyMap.entries()).map(([hour, count]) => ({ hour: hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`, count, rawHour: hour })).sort((a, b) => a.rawHour - b.rawHour);
    const peakDay = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const eventTypeData = Array.from(eventTypeMap.entries()).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value })).sort((a, b) => b.value - a.value).slice(0, 4);
    const callsStarted = eventTypeMap.get('call_started') || 0;
    const ordersPlaced = eventTypeMap.get('order_placed') || 0;
    const conversionRate = callsStarted > 0 ? (ordersPlaced / callsStarted) * 100 : 0;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    return {
      callVolumeData,
      revenueData: callVolumeData.map(d => ({ date: d.date, revenue: d.revenue })),
      hourlyData, eventTypeData, peakDay, conversionRate, avgOrderValue, totalRevenue,
      sparklineData: { calls: callVolumeData.map(d => d.calls), revenue: callVolumeData.map(d => d.revenue), orders: callVolumeData.map(d => d.orders) },
    };
  }, [events]);

  const previousPeriodChange = useMemo(() => {
    if (!comparisonEvents || comparisonEvents.length === 0) return { calls: 0, revenue: 0, orders: 0 };
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    let currentCalls = 0, prevCalls = 0, currentRevenue = 0, prevRevenue = 0, currentOrders = 0, prevOrders = 0;
    comparisonEvents.forEach(event => {
      if (!event.createdAt) return;
      const eventDate = new Date(event.createdAt);
      const isOrder = event.eventType === 'order_placed';
      const amount = isOrder && event.metadata ? (typeof (event.metadata as any).amount === 'number' ? (event.metadata as any).amount : parseFloat((event.metadata as any).amount) || 0) : 0;
      if (eventDate >= thirtyDaysAgo) { currentCalls++; if (isOrder) { currentRevenue += amount; currentOrders++; } }
      else if (eventDate >= sixtyDaysAgo) { prevCalls++; if (isOrder) { prevRevenue += amount; prevOrders++; } }
    });
    const calcChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
    return { calls: calcChange(currentCalls, prevCalls), revenue: calcChange(currentRevenue, prevRevenue), orders: calcChange(currentOrders, prevOrders) };
  }, [comparisonEvents]);

  const renderExpandedChart = () => {
    if (!expandedCard) return null;
    if (isLoading) return <div className="h-[400px] flex items-center justify-center"><Skeleton className="h-full w-full" /></div>;
    const noDataFallback = <div className="h-[400px] flex items-center justify-center text-muted-foreground">No data available</div>;
    switch (expandedCard.type) {
      case 'calls':
        if (!hasData || processedData.callVolumeData.length === 0) return noDataFallback;
        return (<ResponsiveContainer width="100%" height={400}><AreaChart data={processedData.callVolumeData}><defs><linearGradient id="ecg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.4}/><stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.05}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} /><Area type="monotone" dataKey="calls" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#ecg)" /></AreaChart></ResponsiveContainer>);
      case 'revenue':
        if (!hasData || processedData.revenueData.length === 0) return noDataFallback;
        return (<ResponsiveContainer width="100%" height={400}><AreaChart data={processedData.revenueData}><defs><linearGradient id="erg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.4}/><stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0.05}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} /><Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.green} strokeWidth={2} fill="url(#erg)" /></AreaChart></ResponsiveContainer>);
      case 'orders':
        if (!hasData || processedData.callVolumeData.length === 0) return noDataFallback;
        return (<ResponsiveContainer width="100%" height={400}><BarChart data={processedData.callVolumeData} barCategoryGap="15%"><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} /><Bar dataKey="orders" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} barSize={28} /></BarChart></ResponsiveContainer>);
      case 'peakhours':
        if (!hasData || processedData.hourlyData.length === 0) return noDataFallback;
        return (<ResponsiveContainer width="100%" height={400}><BarChart data={processedData.hourlyData} barCategoryGap="10%"><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} /><XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} /><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} /><Bar dataKey="count" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} barSize={22} /></BarChart></ResponsiveContainer>);
      case 'conversion':
        if (!hasData || processedData.eventTypeData.length === 0) return noDataFallback;
        return (<ResponsiveContainer width="100%" height={400}><PieChart><Pie data={processedData.eventTypeData} cx="50%" cy="50%" innerRadius={80} outerRadius={140} paddingAngle={3} dataKey="value">{processedData.eventTypeData.map((_, i) => (<Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}</Pie><Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} /></PieChart></ResponsiveContainer>);
      default: return noDataFallback;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col" data-testid="page-analytics">
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between flex-shrink-0 border-b">
        <h1 className="text-xl font-bold" data-testid="text-page-title">Analytics Overview</h1>
        <Select value={datePreset} onValueChange={(v: DateRangePreset) => setDatePreset(v)}>
          <SelectTrigger className="w-32 h-9 text-sm" data-testid="select-date-range">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /><SelectValue /></div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">7 days</SelectItem>
            <SelectItem value="30days">30 days</SelectItem>
            <SelectItem value="90days">90 days</SelectItem>
            <SelectItem value="12months">12 months</SelectItem>
            <SelectItem value="alltime">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Flex-based layout - no fixed heights, uses flex-grow */}
      <div className="flex-1 p-4 flex flex-col gap-4 min-h-0 overflow-hidden">
        {/* Top section: 2 equal rows */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Row 1 */}
          <div className="flex-1 flex gap-4 min-h-0">
            <Card className="flex-[2] cursor-pointer hover-elevate flex flex-col overflow-hidden" onClick={() => setExpandedCard({ title: 'Call Volume', type: 'calls' })} data-testid="card-metric-calls">
              <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between flex-shrink-0 mb-3">
                  <h3 className="text-base font-semibold">Call Activity</h3>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-6 mb-4 flex-shrink-0">
                  {isLoading ? <><Skeleton className="h-12 w-20" /><Skeleton className="h-12 w-20" /><Skeleton className="h-12 w-20" /><Skeleton className="h-12 w-24" /></> : (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Calls</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-total-calls">{formatNumber(overview?.totalCalls ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Orders</p>
                        <p className="text-2xl font-bold text-teal-600" data-testid="text-total-orders">{formatNumber(overview?.totalOrders ?? 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Reservations</p>
                        <p className="text-2xl font-bold text-purple-600" data-testid="text-reservations">{overview?.totalReservations ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Duration</p>
                        <p className="text-2xl font-bold text-amber-600" data-testid="text-avg-duration">{formatDuration(overview?.avgDuration ?? 0)}</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex-1 min-h-0">
                  {isLoading ? <Skeleton className="h-full w-full" /> : hasData && processedData.callVolumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.callVolumeData} barGap={4} barCategoryGap="15%">
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={30} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="calls" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="orders" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 cursor-pointer hover-elevate flex flex-col overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20" onClick={() => setExpandedCard({ title: 'Revenue', type: 'revenue' })} data-testid="card-metric-revenue">
              <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between flex-shrink-0 mb-3">
                  <h3 className="text-base font-semibold">Revenue</h3>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
                {isLoading ? <Skeleton className="h-10 w-24 mb-3" /> : (
                  <div className="mb-4 flex-shrink-0">
                    <p className="text-3xl font-bold text-green-700 dark:text-green-400" data-testid="text-revenue">${(processedData.totalRevenue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {comparisonLoading ? <Skeleton className="h-5 w-16" /> : (
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${previousPeriodChange.revenue >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {previousPeriodChange.revenue >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          <span>{Math.abs(previousPeriodChange.revenue).toFixed(0)}%</span>
                        </div>
                      )}
                      {comparisonLoading ? <Skeleton className="h-4 w-12" /> : <span className="text-xs text-muted-foreground">vs last period</span>}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  {isLoading ? <Skeleton className="h-full w-full" /> : hasData && processedData.revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.revenueData}>
                        <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.4}/><stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0.05}/></linearGradient></defs>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis hide />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'Revenue']} />
                        <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.green} strokeWidth={2} fill="url(#revGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2 */}
          <div className="flex-1 flex gap-4 min-h-0">
            <Card className="flex-[2] cursor-pointer hover-elevate flex flex-col overflow-hidden" onClick={() => setExpandedCard({ title: 'Orders', type: 'orders' })} data-testid="card-metric-orders-trend">
              <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between flex-shrink-0 mb-3">
                  <h3 className="text-base font-semibold">Revenue Trend</h3>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-h-0">
                  {isLoading ? <Skeleton className="h-full w-full" /> : hasData && processedData.revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={processedData.revenueData}>
                        <defs><linearGradient id="rag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART_COLORS.green} stopOpacity={0.4}/><stop offset="100%" stopColor={CHART_COLORS.green} stopOpacity={0.05}/></linearGradient></defs>
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={40} tickFormatter={(v) => `$${v}`} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => [`$${v.toFixed(0)}`, 'Revenue']} />
                        <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.green} strokeWidth={2} fill="url(#rag)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="flex-1 cursor-pointer hover-elevate flex flex-col overflow-hidden" onClick={() => setExpandedCard({ title: 'Peak Hours', type: 'peakhours' })} data-testid="card-metric-duration">
              <CardContent className="p-5 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between flex-shrink-0 mb-3">
                  <h3 className="text-base font-semibold">Peak Hours</h3>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
                {isLoading ? <Skeleton className="h-6 w-20 mb-3" /> : (
                  <div className="mb-3 flex-shrink-0">
                    <div className="inline-block px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-md text-sm font-medium">
                      Peak Day: {processedData.peakDay}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  {isLoading ? <Skeleton className="h-full w-full" /> : hasData && processedData.hourlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedData.hourlyData} barCategoryGap="15%">
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} interval={3} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={25} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="count" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data available</div>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom summary row - auto height based on content */}
        <div className="flex gap-4 flex-shrink-0">
          <Card className="flex-[7] cursor-pointer hover-elevate overflow-hidden" onClick={() => setExpandedCard({ title: 'Transactions', type: 'orders' })} data-testid="card-metric-orders">
            <CardContent className="px-5 py-4 flex items-center gap-6">
              {isLoading ? <Skeleton className="h-12 w-24" /> : (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Transactions</p>
                  <p className="text-2xl font-bold">{formatNumber((overview?.totalOrders ?? 0) + (overview?.totalReservations ?? 0))}</p>
                </div>
              )}
              {isLoading || comparisonLoading ? <Skeleton className="h-10 w-16" /> : (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">vs last</p>
                  <p className={`text-lg font-bold ${previousPeriodChange.orders >= 0 ? 'text-green-600' : 'text-red-600'}`}>{previousPeriodChange.orders >= 0 ? '+' : ''}{previousPeriodChange.orders.toFixed(0)}%</p>
                </div>
              )}
              {isLoading ? <Skeleton className="h-8 w-24" /> : (
                <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span>Peak:</span>
                  <span className="font-semibold text-foreground">{processedData.peakDay}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="flex-[5] cursor-pointer hover-elevate overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20" onClick={() => setExpandedCard({ title: 'Insights', type: 'conversion' })} data-testid="card-metric-insights">
            <CardContent className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span className="text-base font-semibold">Insights</span>
              </div>
              {isLoading ? <Skeleton className="h-12 w-20" /> : (
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{processedData.conversionRate.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">Conversion</p>
                </div>
              )}
              {isLoading ? <Skeleton className="h-10 w-20" /> : (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg Order</p>
                  <p className="text-lg font-bold">{formatCurrency(processedData.avgOrderValue)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!expandedCard} onOpenChange={(o) => !o && setExpandedCard(null)}>
        <DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{expandedCard?.title}</DialogTitle></DialogHeader><div className="py-4">{renderExpandedChart()}</div></DialogContent>
      </Dialog>
    </div>
  );
}
