import { useState } from "react";
import { 
  BookOpen, 
  LayoutTemplate, 
  Settings, 
  LogOut,
  BarChart3,
  Users,
  Phone,
  Plug2,
  FileText,
  MessageSquare,
  X,
  CreditCard,
  CheckCircle2,
  Clock,
  ShieldCheck,
  LifeBuoy,
  AlertTriangle,
  ChevronRight,
  Wallet,
  Map,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { useAuth } from "@/hooks/useAuth";
import { StripePaymentDialog } from "@/components/stripe-payment-dialog";
import { HelpChat, useUnreadSupportCount } from "@/components/help-chat";
import { useOnboardingTour } from "@/components/onboarding-tour";
import orderlyLogo from "@assets/WXdQJT24YKxTTzIwCPlW3AJf4Y_1763761787840.avif";
import type { Subscription, UsageMetric } from "@shared/schema";

const mainItems = [
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Agents",
    url: "/agents",
    icon: MessageSquare,
  },
  {
    title: "Knowledge Base",
    url: "/knowledge-base",
    icon: BookOpen,
  },
  {
    title: "Contacts",
    url: "/contacts",
    icon: Users,
  },
  {
    title: "Phone Numbers",
    url: "/phone-numbers",
    icon: Phone,
  },
  {
    title: "Integrations",
    url: "/integrations",
    icon: Plug2,
  },
  {
    title: "Logs",
    url: "/logs",
    icon: FileText,
  },
  {
    title: "Templates",
    url: "/templates",
    icon: LayoutTemplate,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

function MiniUsageGraph({ minutesUsed }: { minutesUsed: number }) {
  const points = [0, 0.15, 0.3, 0.25, 0.5, 0.45, 0.7, 0.65, 0.85, 1.0];
  const scaledPoints = points.map(p => Math.round(p * minutesUsed));

  const width = 180;
  const height = 32;
  const padding = 2;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  const maxVal = Math.max(...scaledPoints, 1);

  const linePoints = scaledPoints.map((val, i) => {
    const x = padding + (i / (scaledPoints.length - 1)) * graphWidth;
    const y = padding + graphHeight - (val / maxVal) * graphHeight;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`;

  return (
    <div className="w-full" data-testid="usage-mini-graph">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-5" preserveAspectRatio="none">
        <defs>
          <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polygon
          points={areaPoints}
          fill="url(#usageFill)"
          className="text-blue-500 dark:text-blue-400"
        />
        <polyline
          points={linePoints}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-500 dark:text-blue-400"
        />
      </svg>
    </div>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [helpChatOpen, setHelpChatOpen] = useState(false);
  const unreadCount = useUnreadSupportCount();
  const { startTour } = useOnboardingTour();

  // Fetch subscription and usage data
  const { data: subscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: usageMetrics } = useQuery<UsageMetric>({
    queryKey: ["/api/usage-metrics"],
    enabled: !!subscription,
  });

  const { data: creditBalance } = useQuery<{ creditGrantedCents: number; balanceCents: number; hasCredit: boolean }>({
    queryKey: ["/api/billing/credit-balance"],
    refetchInterval: 60_000,
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const minutesUsed = parseInt(usageMetrics?.minutesUsed || '0');
  const { toggleSidebar, isMobile } = useSidebar();

  const creditRemaining = creditBalance?.balanceCents ?? 1000;
  const creditGranted = creditBalance?.creditGrantedCents ?? 1000;
  const creditUsedPct = creditGranted > 0 ? Math.min(100, ((creditGranted - creditRemaining) / creditGranted) * 100) : 0;
  const creditRemainingDollars = (creditRemaining / 100).toFixed(2);
  const creditGrantedDollars = (creditGranted / 100).toFixed(2);
  const isLowCredit = creditRemaining > 0 && creditRemaining <= 200;
  const isExhausted = creditRemaining <= 0;

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-3 px-4 py-6">
            <a 
              href="https://getorderly.io/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity cursor-pointer"
              data-testid="link-logo-home"
            >
              <img 
                src={orderlyLogo} 
                alt="Orderly AI" 
                className="h-10 w-10 rounded-xl object-cover shadow-sm"
                data-testid="img-logo-sidebar"
              />
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight">Orderly AI</span>
                <span className="text-xs text-muted-foreground font-medium">Voice Agent Platform</span>
              </div>
            </a>
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
                data-testid="button-close-sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === 'admin' && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/admin/restaurants")}
                    data-testid="nav-admin-restaurants"
                  >
                    <Link href="/admin/restaurants">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Restaurants</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin/signups"}
                    data-testid="nav-admin-signups"
                  >
                    <Link href="/admin/signups">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Signups</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin/support"}
                    data-testid="nav-admin-support"
                  >
                    <Link href="/admin/support">
                      <LifeBuoy className="h-4 w-4" />
                      <span>Support</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Usage Indicator */}
        <SidebarGroup className="mt-auto">
          <div className="mx-3 px-3 py-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30" data-testid="usage-indicator">
            {subscription?.stripeSubscriptionId ? (
              <Link href="/billing">
                <div className="flex flex-col gap-1 cursor-pointer hover-elevate rounded-xl p-1 -m-1 transition-colors" data-testid="link-billing-usage">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-100" data-testid="plan-name">
                        Pay As You Go
                      </span>
                    </div>
                    <span className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80" data-testid="usage-text">
                      {minutesUsed} min
                    </span>
                  </div>
                  <MiniUsageGraph minutesUsed={minutesUsed} />
                </div>
              </Link>
            ) : (
              <HoverCard openDelay={150} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div
                    className="flex items-center justify-between gap-2 cursor-default hover-elevate rounded-xl p-1 -m-1"
                    data-testid="credit-widget-trigger"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Wallet className={`h-4 w-4 flex-shrink-0 ${isExhausted ? "text-amber-500" : isLowCredit ? "text-amber-500" : "text-blue-600 dark:text-blue-400"}`} />
                      <span
                        className={`text-xs font-bold truncate ${isExhausted ? "text-amber-700 dark:text-amber-400" : "text-blue-900 dark:text-blue-100"}`}
                        data-testid="credit-remaining-text"
                      >
                        {isExhausted ? "Credit exhausted" : `$${creditRemainingDollars} remaining`}
                      </span>
                    </div>
                    <ChevronRight className="h-3 w-3 flex-shrink-0 text-blue-400/60 dark:text-blue-500/60" />
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="right"
                  align="end"
                  sideOffset={12}
                  className="w-72 p-0 overflow-hidden"
                  data-testid="credit-widget-popover"
                >
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/60 dark:to-blue-900/30 px-4 pt-4 pb-3 border-b border-blue-100 dark:border-blue-800/50">
                    <p className="text-xs font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400 mb-1">Trial Credit</p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="credit-amount-large">
                      ${creditRemainingDollars}
                    </p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
                      of ${creditGrantedDollars} trial credit
                    </p>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">Used</span>
                        <span className="text-xs font-medium text-foreground">{Math.round(creditUsedPct)}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isExhausted ? "bg-amber-500" : isLowCredit ? "bg-amber-400" : "bg-blue-500"}`}
                          style={{ width: `${creditUsedPct}%` }}
                          data-testid="credit-progress-bar"
                        />
                      </div>
                    </div>
                    {isExhausted ? (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">Your credit has been used up. Add a payment method to continue.</p>
                      </div>
                    ) : isLowCredit ? (
                      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">Credit running low. Add a payment method before it runs out.</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Use this credit to test your voice agent.</p>
                    )}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={() => setPaymentDialogOpen(true)}
                        data-testid="button-add-payment-popover"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Add Payment Method
                      </Button>
                      <Link href="/billing">
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" data-testid="link-billing-details">
                          View billing details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            )}
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-2 py-3">
              <Avatar className="h-9 w-9 ring-2 ring-border/50">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                  {getInitials(user?.firstName, user?.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold truncate">
                  {user?.firstName && user?.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user?.email || "User"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.location.href = "/api/logout"}
                data-testid="button-logout"
                className="h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="flex items-center gap-1 px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 justify-start gap-2 text-muted-foreground relative"
                onClick={() => setHelpChatOpen(true)}
                data-testid="button-ask-for-help"
              >
                <LifeBuoy className="h-4 w-4 flex-shrink-0" />
                <span>Ask for help</span>
                {unreadCount > 0 && (
                  <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold" data-testid="badge-help-unread">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground flex-shrink-0"
                onClick={() => startTour()}
                title="Take the tour"
                data-testid="button-take-tour"
              >
                <Map className="h-4 w-4" />
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <StripePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
      <HelpChat open={helpChatOpen} onOpenChange={setHelpChatOpen} />
    </Sidebar>
  );
}
