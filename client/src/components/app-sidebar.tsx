import { 
  BookOpen, 
  LayoutTemplate, 
  Settings, 
  LogOut,
  BarChart3,
  Zap,
  Users,
  Phone,
  Plug2,
  FileText,
  MessageSquare,
  X
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

  // Calculate usage percentage
  const minutesUsed = parseInt(usageMetrics?.minutesUsed || '0');
  const minutesLimit = parseInt(subscription?.minutesLimit || '0');
  const usagePercentage = minutesLimit > 0 ? Math.round((minutesUsed / minutesLimit) * 100) : 0;
  const { toggleSidebar, isMobile } = useSidebar();

  return (
    <Sidebar collapsible="offcanvas" className="border-r-0">
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center gap-3 px-4 py-6">
            <img 
              src={orderlyLogo} 
              alt="Orderly AI" 
              className="h-10 w-10 rounded-xl object-cover shadow-sm"
              data-testid="img-logo-sidebar"
            />
            <div className="flex flex-col flex-1">
              <span className="text-lg font-bold tracking-tight">Orderly AI</span>
              <span className="text-xs text-muted-foreground font-medium">Voice Agent Platform</span>
            </div>
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
            <div className="flex items-center gap-3">
              {/* Circular Progress */}
              <div className="relative h-12 w-12 flex-shrink-0">
                <svg className="transform -rotate-90 h-12 w-12">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-blue-200 dark:text-blue-900"
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - usagePercentage / 100)}`}
                    className="text-blue-600 dark:text-blue-400 transition-all duration-300"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300" data-testid="usage-percentage">
                    {usagePercentage}%
                  </span>
                </div>
              </div>

              {/* Usage Info */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold capitalize text-blue-900 dark:text-blue-100" data-testid="plan-name">
                  {subscription?.planType || 'Loading...'}
                </span>
                <span className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80" data-testid="usage-text">
                  {minutesUsed} / {minutesLimit} MIN
                </span>
              </div>
            </div>
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
    </Sidebar>
  );
}
