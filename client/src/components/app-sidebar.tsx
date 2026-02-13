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

        {/* Usage Indicator */}
        <SidebarGroup className="mt-auto">
          <div className="mx-3 px-4 py-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30" data-testid="usage-indicator">
            {subscription?.stripeSubscriptionId ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="text-sm font-bold text-blue-900 dark:text-blue-100" data-testid="plan-name">
                    Pay As You Go
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500/70 dark:text-blue-400/70 flex-shrink-0" />
                  <span className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80" data-testid="usage-text">
                    {minutesUsed} min used this period
                  </span>
                </div>
              </div>
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
        </SidebarMenu>
      </SidebarFooter>

      <StripePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
      />
    </Sidebar>
  );
}
