import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Agents from "@/pages/agents";
import AgentEditor from "@/pages/agent-editor";
import Templates from "@/pages/templates";
import KnowledgeBase from "@/pages/knowledge-base";
import Workflows from "@/pages/workflows";
import TestCenter from "@/pages/test-center";
import Analytics from "@/pages/analytics";
import Actions from "@/pages/actions";
import Contacts from "@/pages/contacts";
import PhoneNumbers from "@/pages/phone-numbers";
import Integrations from "@/pages/integrations";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Agents} />
          <Route path="/agents" component={Agents} />
          <Route path="/agents/:id" component={AgentEditor} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/knowledge-base" component={KnowledgeBase} />
          <Route path="/actions" component={Actions} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/test-center" component={TestCenter} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/phone-numbers" component={PhoneNumbers} />
          <Route path="/integrations" component={Integrations} />
          <Route path="/logs" component={Logs} />
          <Route path="/settings" component={Settings} />
          <Route path="/templates" component={Templates} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Router />
        <Toaster />
      </>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <header className="flex h-16 items-center justify-between px-6 border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
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
