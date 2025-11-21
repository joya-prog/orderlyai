import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Clock, CheckCircle2, Bot, DollarSign, TrendingUp } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Mock data for demonstration - will be replaced with real API data when call logging is implemented
const keyMetrics = {
  totalCalls: 1247,
  avgDuration: 342, // seconds
  successRate: 94.2,
  activeAgents: 8,
  ordersPlaced: 156,
  revenue: 12847.50
};

const callVolumeData = [
  { date: "Mon", calls: 145, successful: 138 },
  { date: "Tue", calls: 178, successful: 165 },
  { date: "Wed", calls: 192, successful: 184 },
  { date: "Thu", calls: 156, successful: 148 },
  { date: "Fri", calls: 201, successful: 189 },
  { date: "Sat", calls: 188, successful: 175 },
  { date: "Sun", calls: 187, successful: 178 }
];

const agentPerformanceData = [
  { name: "Restaurant Agent", calls: 342, orders: 45, revenue: 3245 },
  { name: "Reservation Agent", calls: 289, orders: 0, revenue: 0 },
  { name: "Support Agent", calls: 256, orders: 12, revenue: 890 },
  { name: "Catering Agent", calls: 178, orders: 67, revenue: 5678 },
  { name: "Delivery Agent", calls: 182, orders: 32, revenue: 3034 }
];

const callOutcomeData = [
  { name: "Successful", value: 1174, color: "#10b981" },
  { name: "Voicemail", value: 43, color: "#f59e0b" },
  { name: "Busy", value: 18, color: "#ef4444" },
  { name: "No Answer", value: 12, color: "#6b7280" }
];

const revenueOverTimeData = [
  { month: "Jan", revenue: 8450 },
  { month: "Feb", revenue: 9230 },
  { month: "Mar", revenue: 10150 },
  { month: "Apr", revenue: 11340 },
  { month: "May", revenue: 12847 }
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="page-analytics">
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track agent performance, call metrics, and revenue analytics
          </p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card data-testid="card-metric-total-calls">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-calls">{keyMetrics.totalCalls.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">+12%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-avg-duration">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Call Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-avg-duration">{formatDuration(keyMetrics.avgDuration)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">-8%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-success-rate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-success-rate">{keyMetrics.successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">+2.1%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-active-agents">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-active-agents">{keyMetrics.activeAgents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently deployed
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-orders-placed">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders Placed</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-orders-placed">{keyMetrics.ordersPlaced}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">+18%</span> from last month
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-metric-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-revenue">{formatCurrency(keyMetrics.revenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600 dark:text-green-400">+23%</span> from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Call Volume Over Time */}
          <Card data-testid="card-chart-call-volume">
            <CardHeader>
              <CardTitle>Call Volume</CardTitle>
              <p className="text-sm text-muted-foreground">Daily call volume and success rate</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={callVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" name="Total Calls" strokeWidth={2} />
                  <Line type="monotone" dataKey="successful" stroke="#10b981" name="Successful" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Call Outcomes */}
          <Card data-testid="card-chart-call-outcomes">
            <CardHeader>
              <CardTitle>Call Outcomes</CardTitle>
              <p className="text-sm text-muted-foreground">Distribution of call results</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={callOutcomeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {callOutcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Agent Performance */}
          <Card data-testid="card-chart-agent-performance">
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <p className="text-sm text-muted-foreground">Total calls handled by each agent</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={agentPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" fill="hsl(var(--primary))" name="Calls" />
                  <Bar dataKey="orders" fill="#10b981" name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue Over Time */}
          <Card data-testid="card-chart-revenue">
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <p className="text-sm text-muted-foreground">Monthly revenue from POS orders</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
