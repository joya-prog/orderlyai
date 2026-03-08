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
import { useAuth } from "@/hooks/useAuth";
import { StripePaymentDialog } from "@/components/stripe-payment-dialog";
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

  // Fetch subscription and usage data
  const { data: subscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: usageMetrics } = useQuery<UsageMetric>({
    queryKey: ["/api/usage-metrics"],
    enabled: !!subscription,
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const minutesUsed = parseInt(usageMetrics?.minutesUsed || '0');
  const { toggleSidebar, isMobile } = useSidebar();

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
              <div className="flex flex-col gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold capitalize text-blue-900 dark:text-blue-100" data-testid="plan-name">
                    {subscription?.planType || 'Free Trial'}
                  </span>
                  <span className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80" data-testid="usage-text">
                    {minutesUsed} min used
                  </span>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setPaymentDialogOpen(true)}
                  data-testid="button-add-payment-sidebar"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Add Payment
                </Button>
              </div>
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
            <a
              href="mailto:hello@getorderly.io"
              className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm text-muted-foreground hover-elevate"
              data-testid="link-ask-for-help"
            >
              <LifeBuoy className="h-4 w-4 flex-shrink-0" />
              <span>Ask for help</span>
            </a>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <StripePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </Sidebar>
  );
}
