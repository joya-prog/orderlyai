import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Clock, CheckCircle2, Bot, DollarSign, TrendingUp, Calendar, CalendarDays } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsEvent } from "@shared/schema";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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

function getPresetLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "7days": return "Last 7 days";
    case "30days": return "Last 30 days";
    case "90days": return "Last 90 days";
    case "12months": return "Last 12 months";
    case "alltime": return "All time";
  }
}

export default function AnalyticsPage() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30days");
  
  const dateRange = useMemo(() => getDateRangeFromPreset(datePreset), [datePreset]);

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: [`/api/analytics/overview?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const { data: events, isLoading: eventsLoading } = useQuery<AnalyticsEvent[]>({
    queryKey: [`/api/analytics/events?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  const callVolumeData = events && events.length > 0 ? processCallVolumeData(events) : [];
  const callOutcomeData = events && events.length > 0 ? processCallOutcomeData(events) : [];
  const agentPerformanceData = events && events.length > 0 ? processAgentPerformanceData(events) : [];
  const revenueData = events && events.length > 0 ? processRevenueData(events) : [];

  const isLoading = overviewLoading || eventsLoading;
  const hasData = events && events.length > 0;

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="page-analytics">
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track agent performance, call metrics, and revenue analytics
            </p>
          </div>
          <Select value={datePreset} onValueChange={(value: DateRangePreset) => setDatePreset(value)}>
            <SelectTrigger className="w-[200px]" data-testid="select-date-range">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
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

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card data-testid="card-metric-total-calls" className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
              <div className="p-2 rounded-2xl bg-primary/10">
                <Phone className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-total-calls">
                    {(overview?.totalCalls ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "Active tracking" : "No data yet"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-avg-duration" className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Call Duration</CardTitle>
              <div className="p-2 rounded-2xl bg-accent/10">
                <Clock className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-avg-duration">
                    {formatDuration(overview?.avgDuration ?? 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "Average conversation length" : "No calls recorded"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-success-rate" className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
              <div className="p-2 rounded-2xl bg-chart-3/10">
                <TrendingUp className="h-5 w-5 text-chart-3" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-success-rate">
                    {overview?.totalOrders ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "Orders placed via AI" : "No orders yet"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-active-agents" className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reservations</CardTitle>
              <div className="p-2 rounded-2xl bg-chart-4/10">
                <Bot className="h-5 w-5 text-chart-4" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-active-agents">
                    {overview?.totalReservations ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "Bookings made" : "No reservations"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-orders-placed" className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-orders-placed">
                    {overview?.events ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "Analytics events tracked" : "Start testing to see data"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-metric-revenue" className="hover-elevate transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Revenue</CardTitle>
              <div className="p-2 rounded-2xl bg-chart-3/10">
                <DollarSign className="h-5 w-5 text-chart-3" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold" data-testid="text-revenue">
                    {formatCurrency(calculateRevenue(events ?? []))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasData ? "From tracked orders" : "No revenue data"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {!hasData && !isLoading && (
          <Card>
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
                <p className="text-muted-foreground mb-4">
                  Start testing your agents to see analytics and insights
                </p>
                <Button>Test an Agent</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-chart-call-volume" className="hover-elevate transition-shadow">
                <CardHeader>
                  <CardTitle>Call Volume</CardTitle>
                  <p className="text-sm text-muted-foreground">Daily activity over time</p>
                </CardHeader>
                <CardContent>
                  {callVolumeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={callVolumeData}>
                        <defs>
                          <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="calls" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={3}
                          fill="url(#colorCalls)"
                          dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No call volume data
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-chart-call-outcomes" className="hover-elevate transition-shadow">
                <CardHeader>
                  <CardTitle>Event Types</CardTitle>
                  <p className="text-sm text-muted-foreground">Distribution of event types</p>
                </CardHeader>
                <CardContent>
                  {callOutcomeData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={callOutcomeData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {callOutcomeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No event distribution data
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card data-testid="card-chart-agent-performance" className="hover-elevate transition-shadow">
                <CardHeader>
                  <CardTitle>Agent Activity</CardTitle>
                  <p className="text-sm text-muted-foreground">Events by agent</p>
                </CardHeader>
                <CardContent>
                  {agentPerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={agentPerformanceData}>
                        <defs>
                          <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.6}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="events" fill="url(#colorBar)" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No agent performance data
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-chart-revenue" className="hover-elevate transition-shadow">
                <CardHeader>
                  <CardTitle>Revenue Trend</CardTitle>
                  <p className="text-sm text-muted-foreground">Order revenue over time</p>
                </CardHeader>
                <CardContent>
                  {revenueData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip 
                          formatter={(value) => formatCurrency(value as number)}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="revenue" 
                          stroke="hsl(var(--chart-3))" 
                          strokeWidth={3}
                          fill="url(#colorRevenue)"
                          dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                      No revenue trend data
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
      const date = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const existing = dailyMap.get(date) || { calls: 0, timestamp: dateObj.getTime() };
      dailyMap.set(date, { calls: existing.calls + 1, timestamp: existing.timestamp });
    }
  });

  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, calls: data.calls, timestamp: data.timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ date, calls }) => ({ date, calls }));
}

function processCallOutcomeData(events: AnalyticsEvent[]) {
  const typeMap = new Map<string, number>();
  const colors = ['#10b981', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6', '#ec4899'];
  
  events.forEach((event) => {
    typeMap.set(event.eventType, (typeMap.get(event.eventType) || 0) + 1);
  });

  return Array.from(typeMap.entries()).map(([name, value], index) => ({
    name,
    value,
    color: colors[index % colors.length],
  }));
}

function processAgentPerformanceData(events: AnalyticsEvent[]) {
  const agentMap = new Map<string, { name: string; events: number }>();
  
  events.forEach((event) => {
    const agentKey = event.agentId || 'unknown';
    const existing = agentMap.get(agentKey) || {
      name: event.agentId ? `Agent ${event.agentId.slice(0, 8)}` : 'General Events',
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
    .map(({ date, revenue }) => ({ date, revenue }));
}

function calculateRevenue(events: AnalyticsEvent[]): number {
  return events
    .filter((e) => e.eventType === 'order_placed' && e.metadata && typeof e.metadata === 'object')
    .reduce((sum, event) => {
      const rawAmount = (event.metadata as any).amount;
      const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount) || 0;
      return sum + amount;
    }, 0);
}
