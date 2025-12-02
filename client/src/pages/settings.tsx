import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  User,
  CreditCard,
  Shield,
  BarChart3,
  Bell,
  Check,
  Sparkles,
  Loader2,
  ExternalLink,
  FileText,
  Phone,
  Clock,
  AlertCircle,
  Download,
  Calendar,
} from "lucide-react";
import type { Subscription, UsageMetric, Invoice, CallLog } from "@shared/schema";
import { PricingCalculator } from "@/components/pricing-calculator";

interface BillingUsage {
  currentPeriodUsage: number;
  usageLimit: number;
  percentUsed: number;
  periodStart: string;
  periodEnd: string;
}

interface StripeConfig {
  publishableKey: string;
  hasStripeConnection: boolean;
}

type SettingsTab = "preferences" | "billing" | "security" | "usage" | "notifications";

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  isPopular?: boolean;
  features: string[];
  limits: {
    minutes: string;
    agents: string;
    phoneNumbers: string;
    integrations: string;
  };
}

const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    price: "$49",
    period: "/month",
    description: "Perfect for small restaurants testing voice AI",
    features: [
      "500 call minutes included",
      "1 AI agent",
      "1 phone number",
      "Basic integrations",
      "Email support",
    ],
    limits: {
      minutes: "500",
      agents: "1",
      phoneNumbers: "1",
      integrations: "Basic",
    },
  },
  {
    name: "Professional",
    price: "$199",
    period: "/month",
    description: "Ideal for single-location restaurants",
    isPopular: true,
    features: [
      "2,000 call minutes included",
      "3 AI agents",
      "3 phone numbers",
      "All integrations (POS, Reservations)",
      "Advanced analytics",
      "Priority email support",
    ],
    limits: {
      minutes: "2,000",
      agents: "3",
      phoneNumbers: "3",
      integrations: "All",
    },
  },
  {
    name: "Business",
    price: "$499",
    period: "/month",
    description: "For multi-location restaurants",
    features: [
      "10,000 call minutes included",
      "Unlimited AI agents",
      "10 phone numbers",
      "All integrations + custom workflows",
      "Advanced analytics + exports",
      "Priority support",
      "Custom voice training",
    ],
    limits: {
      minutes: "10,000",
      agents: "Unlimited",
      phoneNumbers: "10",
      integrations: "All + Custom",
    },
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For restaurant groups and chains",
    features: [
      "Custom call minutes",
      "Unlimited everything",
      "White-label options",
      "Dedicated account manager",
      "Custom integrations",
      "SLA guarantee",
      "24/7 phone support",
    ],
    limits: {
      minutes: "Custom",
      agents: "Unlimited",
      phoneNumbers: "Unlimited",
      integrations: "Custom",
    },
  },
];

const costStructure = [
  { feature: "Call Minutes Included", starter: "500", pro: "2,000", business: "10,000", enterprise: "Custom" },
  { feature: "Extra Minute Cost", starter: "$0.15", pro: "$0.12", business: "$0.10", enterprise: "Custom" },
  { feature: "Concurrent Calls", starter: "2", pro: "5", business: "20", enterprise: "Unlimited" },
  { feature: "AI Agents", starter: "1", pro: "3", business: "Unlimited", enterprise: "Unlimited" },
  { feature: "Phone Numbers", starter: "1", pro: "3", business: "10", enterprise: "Unlimited" },
  { feature: "Transcription", starter: true, pro: true, business: true, enterprise: true },
  { feature: "LLM Agent", starter: true, pro: true, business: true, enterprise: true },
  { feature: "Multi-language", starter: false, pro: true, business: true, enterprise: true },
  { feature: "Rescheduling", starter: false, pro: true, business: true, enterprise: true },
  { feature: "Batch Campaigns", starter: false, pro: false, business: true, enterprise: true },
  { feature: "White Label Platform", starter: false, pro: false, business: false, enterprise: true },
  { feature: "Custom Workflow Runs", starter: "5,000", pro: "42,000", business: "100,000", enterprise: "Custom" },
  { feature: "POS Integrations", starter: false, pro: true, business: true, enterprise: true },
  { feature: "Real-Time Booking", starter: false, pro: true, business: true, enterprise: true },
  { feature: "Call Transfer", starter: false, pro: true, business: true, enterprise: true },
  { feature: "Information Extractor", starter: false, pro: true, business: true, enterprise: true },
  { feature: "Custom Actions", starter: false, pro: false, business: true, enterprise: true },
  { feature: "HIPAA Compliance", starter: false, pro: false, business: false, enterprise: true },
  { feature: "SOC2 Security", starter: false, pro: false, business: true, enterprise: true },
  { feature: "GDPR", starter: true, pro: true, business: true, enterprise: true },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("billing");
  const { toast } = useToast();

  // Check URL params for checkout result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get('checkout');
    if (checkoutResult === 'success') {
      toast({
        title: "Subscription activated",
        description: "Your subscription has been activated successfully.",
      });
      window.history.replaceState({}, '', '/settings');
      queryClient.invalidateQueries({ queryKey: ['/api/subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/usage'] });
    } else if (checkoutResult === 'canceled') {
      toast({
        title: "Checkout canceled",
        description: "You can subscribe anytime from this page.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/settings');
    }
  }, [toast]);

  // Fetch subscription data
  const { data: subscription, isLoading: loadingSubscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  // Fetch usage metrics
  const { data: usageMetrics } = useQuery<UsageMetric>({
    queryKey: ["/api/usage-metrics"],
    enabled: !!subscription,
  });

  // Fetch live billing usage
  const { data: billingUsage, isLoading: loadingBillingUsage } = useQuery<BillingUsage>({
    queryKey: ["/api/billing/usage"],
  });

  // Fetch invoices
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery<Invoice[]>({
    queryKey: ["/api/billing/invoices"],
  });

  // Fetch call logs
  const { data: callLogs = [], isLoading: loadingCallLogs } = useQuery<CallLog[]>({
    queryKey: ["/api/billing/call-logs"],
  });

  // Fetch Stripe config
  const { data: stripeConfig } = useQuery<StripeConfig>({
    queryKey: ["/api/billing/stripe-config"],
  });

  // Create checkout session mutation
  const createCheckoutSession = useMutation({
    mutationFn: async ({ planType }: { planType: string }) => {
      return await apiRequest<{ sessionId: string; url: string }>(
        'POST',
        '/api/billing/create-checkout-session',
        { planType }
      );
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  // Create portal session mutation
  const createPortalSession = useMutation({
    mutationFn: async () => {
      return await apiRequest<{ url: string }>(
        'POST',
        '/api/billing/create-portal-session',
        {}
      );
    },
    onSuccess: (data) => {
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to access billing portal",
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (planType: string) => {
    if (planType === 'Enterprise') {
      toast({
        title: "Contact us",
        description: "Please contact our sales team for Enterprise pricing.",
      });
      return;
    }
    createCheckoutSession.mutate({ planType: planType.toLowerCase() });
  };

  const handleManageBilling = () => {
    createPortalSession.mutate();
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return 'N/A';
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return '$0.00';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const menuItems = [
    { id: "preferences" as SettingsTab, label: "Preferences", icon: User },
    { id: "billing" as SettingsTab, label: "Plan & Billing", icon: CreditCard },
    { id: "security" as SettingsTab, label: "Security", icon: Shield },
    { id: "usage" as SettingsTab, label: "Usage", icon: BarChart3 },
    { id: "notifications" as SettingsTab, label: "Notifications", icon: Bell },
  ];

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* Mobile: Wrapped Tabs */}
      <div className="md:hidden border-b bg-muted/30">
        <div className="flex flex-wrap gap-2 p-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                activeTab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "hover-elevate text-foreground bg-background"
              }`}
              data-testid={`settings-tab-${item.id}`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Sidebar Navigation */}
      <div className="hidden md:block w-64 border-r bg-muted/30 p-6 space-y-1">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
              activeTab === item.id
                ? "bg-primary text-primary-foreground"
                : "hover-elevate text-foreground"
            }`}
            data-testid={`settings-tab-${item.id}`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "billing" && (
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-semibold font-serif mb-2">Plan & Billing</h1>
              <p className="text-muted-foreground">
                Manage your subscription, usage, and billing information
              </p>
            </div>

            {/* Current Plan Card */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap space-y-0 pb-4">
                <div>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Your active subscription details</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {subscription?.stripeCustomerId && (
                    <Button 
                      variant="outline" 
                      onClick={handleManageBilling}
                      disabled={createPortalSession.isPending}
                      data-testid="button-manage-billing"
                    >
                      {createPortalSession.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4 mr-2" />
                      )}
                      Manage Billing
                    </Button>
                  )}
                  <Button variant="outline" data-testid="button-add-payment-method">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSubscription ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : subscription ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Current Plan</div>
                      <div className="font-semibold text-lg capitalize">
                        {subscription.planType}
                      </div>
                      <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                        {subscription.status}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Minutes This Period</div>
                      <div className="font-semibold">
                        {billingUsage ? Math.round(billingUsage.currentPeriodUsage) : usageMetrics?.minutesUsed || '0'} / {subscription.minutesLimit || '0'}
                      </div>
                      <Progress
                        value={billingUsage?.percentUsed || (
                          subscription.minutesLimit && parseInt(subscription.minutesLimit) > 0
                            ? ((parseInt(usageMetrics?.minutesUsed || '0')) /
                                parseInt(subscription.minutesLimit)) *
                              100
                            : 0
                        )}
                        className="mt-2"
                      />
                      {billingUsage?.percentUsed && billingUsage.percentUsed > 80 && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                          <AlertCircle className="h-3 w-3" />
                          Approaching limit
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Agents</div>
                      <div className="font-semibold">
                        {usageMetrics?.activeAgents || '0'} / {subscription.agentsLimit || '0'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Concurrent Calls</div>
                      <div className="font-semibold">{subscription.concurrentCallsLimit || '0'} calls</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Phone Numbers</div>
                      <div className="font-semibold">
                        {usageMetrics?.activePhoneNumbers || '0'} / {subscription.phoneNumbersLimit || '0'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No subscription found. Choose a plan below to get started.
                  </div>
                )}
                
                {/* Billing Period Info */}
                {billingUsage && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Billing period: {formatDate(billingUsage.periodStart)} - {formatDate(billingUsage.periodEnd)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Call Activity */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Recent Call Activity
                  </CardTitle>
                  <CardDescription>Your latest billable calls</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCallLogs ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : callLogs.length > 0 ? (
                  <div className="space-y-3">
                    {callLogs.slice(0, 5).map((call) => (
                      <div key={call.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${call.direction === 'inbound' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                            <Phone className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} Call
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {call.fromNumber || 'Unknown'} → {call.toNumber || 'Unknown'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {call.durationMinutes || Math.ceil((parseInt(call.duration || '0')) / 60)} min
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(call.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {callLogs.length > 5 && (
                      <div className="text-center">
                        <Button variant="ghost" size="sm" onClick={() => setActiveTab('usage')}>
                          View all {callLogs.length} calls
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No call activity yet</p>
                    <p className="text-sm">Your call history will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Invoice History */}
            <Card className="mb-8">
              <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice History
                  </CardTitle>
                  <CardDescription>Your billing history and invoices</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {loadingInvoices ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : invoices.length > 0 ? (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10 text-primary">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              Invoice #{invoice.stripeInvoiceId?.slice(-8) || invoice.id.slice(-8)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(invoice.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(invoice.amountDue)}</div>
                            <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'open' ? 'secondary' : 'destructive'} className="text-xs">
                              {invoice.status}
                            </Badge>
                          </div>
                          {invoice.hostedInvoiceUrl && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => window.open(invoice.hostedInvoiceUrl!, '_blank')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No invoices yet</p>
                    <p className="text-sm">Your invoices will appear here once you subscribe</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pricing Calculator */}
            <div className="mb-8">
              <PricingCalculator />
            </div>

            {/* Pricing Tiers */}
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-6">Discover More Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {pricingTiers.map((tier) => (
                  <Card
                    key={tier.name}
                    className={`relative ${tier.isPopular ? "border-primary" : ""}`}
                  >
                    {tier.isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{tier.name}</CardTitle>
                      <div className="mt-2">
                        <span className="text-3xl font-bold">{tier.price}</span>
                        <span className="text-muted-foreground">{tier.period}</span>
                      </div>
                      <CardDescription className="mt-2">{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        className="w-full"
                        variant={tier.isPopular ? "default" : "outline"}
                        onClick={() => handleSubscribe(tier.name)}
                        disabled={createCheckoutSession.isPending || (subscription?.planType?.toLowerCase() === tier.name.toLowerCase())}
                        data-testid={`button-subscribe-${tier.name.toLowerCase()}`}
                      >
                        {createCheckoutSession.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        {subscription?.planType?.toLowerCase() === tier.name.toLowerCase() 
                          ? "Current Plan" 
                          : tier.name === "Enterprise" 
                            ? "Contact Us" 
                            : "Subscribe"}
                      </Button>
                      <Separator />
                      <ul className="space-y-2.5">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Cost Structure Table */}
            <div>
              <h2 className="text-2xl font-semibold mb-6">Costs Structure</h2>
              <div className="overflow-x-auto rounded-3xl border border-card-border bg-card shadow-md">
                <table className="w-full min-w-max">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-4 font-medium text-sm">Feature</th>
                          <th className="text-center p-4 font-medium text-sm">Starter</th>
                          <th className="text-center p-4 font-medium text-sm">Professional</th>
                          <th className="text-center p-4 font-medium text-sm">Business</th>
                          <th className="text-center p-4 font-medium text-sm">Enterprise</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costStructure.map((row, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="p-4 text-sm font-medium">{row.feature}</td>
                            <td className="p-4 text-sm text-center">
                              {typeof row.starter === "boolean" ? (
                                row.starter ? (
                                  <Check className="h-4 w-4 text-primary mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              ) : (
                                row.starter
                              )}
                            </td>
                            <td className="p-4 text-sm text-center">
                              {typeof row.pro === "boolean" ? (
                                row.pro ? (
                                  <Check className="h-4 w-4 text-primary mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              ) : (
                                row.pro
                              )}
                            </td>
                            <td className="p-4 text-sm text-center">
                              {typeof row.business === "boolean" ? (
                                row.business ? (
                                  <Check className="h-4 w-4 text-primary mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              ) : (
                                row.business
                              )}
                            </td>
                            <td className="p-4 text-sm text-center">
                              {typeof row.enterprise === "boolean" ? (
                                row.enterprise ? (
                                  <Check className="h-4 w-4 text-primary mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )
                              ) : (
                                row.enterprise
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "preferences" && (
          <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold font-serif mb-6">Preferences</h1>
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                  <p className="text-muted-foreground">
                    User profile settings, workspace preferences, and customization options
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "security" && (
          <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold font-serif mb-6">Security</h1>
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Password management, two-factor authentication, and API keys
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold font-serif mb-6">Usage</h1>
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Detailed usage analytics, call history, and resource consumption
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "notifications" && (
          <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-semibold font-serif mb-6">Notifications</h1>
            <Card>
              <CardContent className="pt-12 pb-12">
                <div className="text-center">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Email preferences, alerts, and notification settings
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
