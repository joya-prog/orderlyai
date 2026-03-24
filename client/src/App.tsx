import { Switch, Route, useLocation, Redirect } from "wouter";
import { useEffect, useRef } from "react";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { OnboardingTour } from "@/components/onboarding-tour";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import NotFound from "@/pages/not-found";
import Auth from "@/pages/auth";
import Onboarding from "@/pages/onboarding";
import Agents from "@/pages/agents";
import AgentEditor from "@/pages/agent-editor";
import Templates from "@/pages/templates";
import KnowledgeBase from "@/pages/knowledge-base";
import TestCenter from "@/pages/test-center";
import Analytics from "@/pages/analytics";
import Contacts from "@/pages/contacts";
import PhoneNumbers from "@/pages/phone-numbers";
import Integrations from "@/pages/integrations";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import Billing from "@/pages/billing";
import AdminSignups from "@/pages/admin-signups";
import AdminRestaurants from "@/pages/admin/restaurants";
import AdminRestaurantDetail from "@/pages/admin/restaurant-detail";
import AdminSupport from "@/pages/admin/support";
import ROIPage from "@/pages/roi";

function ImpersonationBanner() {
  const { data: adminSession } = useQuery<{ isImpersonating: boolean; originalAdminId: string | null }>({
    queryKey: ["/api/admin/session"],
    refetchInterval: 0,
  });
  const { user } = useAuth();

  const stopMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/impersonate/stop"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      window.location.href = "/admin/restaurants";
    },
  });

  if (!adminSession?.isImpersonating) return null;

  return (
    <div className="sticky top-0 z-[9999] bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium" data-testid="banner-impersonation">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 flex-shrink-0" />
        <span>Viewing as <strong>{user?.restaurantName || user?.email}</strong> — Admin mode</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-800 text-amber-950 bg-amber-400"
        onClick={() => stopMutation.mutate()}
        data-testid="button-stop-impersonation"
      >
        Return to Admin
      </Button>
    </div>
  );
}

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  // Show auth page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/roi" component={ROIPage} />
        <Route path="/" component={Auth} />
        <Route path="/auth" component={Auth} />
        <Route component={Auth} />
      </Switch>
    );
  }

  // Show onboarding for authenticated users who haven't completed setup
  if (!user?.onboardingCompleted) {
    return (
      <Switch>
        <Route path="/" component={Onboarding} />
        <Route component={Onboarding} />
      </Switch>
    );
  }

  // Main app for fully onboarded users
  return (
    <Switch>
      <Route path="/roi" component={ROIPage} />
      <Route path="/" component={Agents} />
      <Route path="/agents" component={Agents} />
      <Route path="/agents/:id" component={AgentEditor} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/test-center" component={TestCenter} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/phone-numbers" component={PhoneNumbers} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/logs" component={Logs} />
      <Route path="/settings" component={Settings} />
      <Route path="/billing" component={Billing} />
      <Route path="/templates" component={Templates} />
      <Route path="/admin/signups" component={AdminSignups} />
      <Route path="/admin">
        {user?.role === "admin" ? <Redirect to="/admin/restaurants" /> : <Redirect to="/" />}
      </Route>
      <Route path="/admin/restaurants" component={
        user?.role === "admin" ? AdminRestaurants : () => <Redirect to="/" />
      } />
      <Route path="/admin/restaurants/:id" component={
        user?.role === "admin" ? AdminRestaurantDetail : () => <Redirect to="/" />
      } />
      <Route path="/admin/support" component={
        user?.role === "admin" ? AdminSupport : () => <Redirect to="/" />
      } />
      <Route component={NotFound} />
    </Switch>
  );
}

function SidebarResponsiveWrapper() {
  const { user } = useAuth();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { setOpen } = useSidebar();
  const prevLocation = useRef<string | null>(null);
  const [location] = useLocation();
  const tourShouldAutoStart = !!(user && user.onboardingCompleted && !(user as any).tourCompleted);
  
  // Check if we're on the agent editor page (should auto-collapse sidebar)
  const isAgentEditorPage = location.startsWith('/agents/') && location !== '/agents';

  // Only auto-collapse/expand when navigating between pages, not on every render
  useEffect(() => {
    const prevIsAgentEditor = prevLocation.current?.startsWith('/agents/') && prevLocation.current !== '/agents';
    
    // When navigating TO agent editor from another page, collapse on desktop
    if (isAgentEditorPage && !prevIsAgentEditor && isDesktop) {
      setOpen(false);
    }
    // When navigating AWAY from agent editor, expand on desktop
    else if (!isAgentEditorPage && prevIsAgentEditor && isDesktop) {
      setOpen(true);
    }
    
    prevLocation.current = location;
  }, [location, isDesktop, setOpen, isAgentEditorPage]);

  return (
    <div className="flex h-screen w-full">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <ImpersonationBanner />
        {/* Hide main header on agent editor pages - agent editor has its own header with these controls */}
        {!isAgentEditorPage && (
          <header className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9" />
            <ThemeToggle />
          </header>
        )}
        <main className="flex-1 overflow-auto relative">
          <Router />
        </main>
      </div>
      <OnboardingTour autoStart={tourShouldAutoStart} />
    </div>
  );
}

function AppContent() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Detect if we're on desktop (>= 768px) using media query
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  // Show landing/onboarding without sidebar for unauthenticated users or users who haven't completed onboarding
  if (isLoading || !isAuthenticated || !user?.onboardingCompleted) {
    return (
      <>
        <Router />
        <Toaster />
      </>
    );
  }

  // Show full app with sidebar for authenticated, onboarded users
  return (
    <SidebarProvider style={sidebarStyle} defaultOpen={isDesktop}>
      <SidebarResponsiveWrapper />
      <Toaster />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
