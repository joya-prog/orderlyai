import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ShoppingCart, Coffee, Check, Link2, Loader2, ExternalLink } from "lucide-react";
import type { IntegrationConfig } from "@shared/schema";
import { useLocation } from "wouter";

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [location] = useLocation();

  const { data: integrations, isLoading } = useQuery<IntegrationConfig[]>({
    queryKey: ["/api/integrations"],
  });

  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/integrations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete integration");
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration disconnected",
        description: "The integration has been removed.",
      });
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'square_connected') {
      toast({
        title: "Square POS connected!",
        description: "Your Square account has been successfully linked.",
      });
      window.history.replaceState({}, '', '/integrations');
    } else if (success === 'toast_connected') {
      toast({
        title: "Toast POS connected!",
        description: "Your Toast account has been successfully linked.",
      });
      window.history.replaceState({}, '', '/integrations');
    } else if (error) {
      toast({
        title: "Connection failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
      window.history.replaceState({}, '', '/integrations');
    }
  }, [toast]);

  const squareIntegration = integrations?.find((i) => i.service === "square");
  const toastIntegration = integrations?.find((i) => i.service === "toast");

  const handleSquareConnect = () => {
    window.location.href = '/api/integrations/square/oauth/init';
  };

  const handleToastConnect = () => {
    window.location.href = '/api/integrations/toast/oauth/init';
  };

  const handleDisconnect = (id: string) => {
    if (confirm('Are you sure you want to disconnect this integration?')) {
      deleteIntegrationMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl" data-testid="page-integrations">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold font-serif mb-2" data-testid="text-page-title">
          Integrations
        </h1>
        <p className="text-muted-foreground">
          Connect your restaurant's POS system to enable orders and menu synchronization
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Square POS Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <ShoppingCart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Square POS</CardTitle>
                  <CardDescription className="mt-1">
                    Sync products and process payments
                  </CardDescription>
                </div>
              </div>
              {squareIntegration && (
                <Badge
                  variant={squareIntegration.status === "active" ? "default" : "secondary"}
                  data-testid="badge-square-status"
                >
                  {squareIntegration.status === "active" ? (
                    <><Check className="h-3 w-3 mr-1" /> Connected</>
                  ) : (
                    "Inactive"
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Square account to sync menus, process orders, and access transaction data through your AI agents.
            </p>
            
            {squareIntegration ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Connected on {new Date(squareIntegration.createdAt!).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect(squareIntegration.id)}
                  disabled={deleteIntegrationMutation.isPending}
                  data-testid="button-square-disconnect"
                >
                  {deleteIntegrationMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disconnecting...</>
                  ) : (
                    "Disconnect"
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleSquareConnect}
                className="w-full"
                data-testid="button-square-connect"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect with Square
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Toast POS Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-accent/10">
                  <Coffee className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle>Toast POS</CardTitle>
                  <CardDescription className="mt-1">
                    Restaurant management and orders
                  </CardDescription>
                </div>
              </div>
              {toastIntegration && (
                <Badge
                  variant={toastIntegration.status === "active" ? "default" : "secondary"}
                  data-testid="badge-toast-status"
                >
                  {toastIntegration.status === "active" ? (
                    <><Check className="h-3 w-3 mr-1" /> Connected</>
                  ) : (
                    "Inactive"
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Toast account to enable seamless order management, menu updates, and real-time restaurant operations.
            </p>
            
            {toastIntegration ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Connected on {new Date(toastIntegration.createdAt!).toLocaleDateString()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect(toastIntegration.id)}
                  disabled={deleteIntegrationMutation.isPending}
                  data-testid="button-toast-disconnect"
                >
                  {deleteIntegrationMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Disconnecting...</>
                  ) : (
                    "Disconnect"
                  )}
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleToastConnect}
                className="w-full"
                data-testid="button-toast-connect"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect with Toast
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-medium mb-2">How OAuth Integration Works</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Click "Connect" to securely authenticate with your POS provider</li>
          <li>• You'll be redirected to the provider's login page</li>
          <li>• After authorization, your account will be automatically linked</li>
          <li>• Your credentials are never stored - we only keep secure access tokens</li>
          <li>• You can disconnect at any time from this page</li>
        </ul>
      </div>
    </div>
  );
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'missing_code':
      return 'Authorization code was not received from the provider.';
    case 'invalid_state':
      return 'Security validation failed. Please try connecting again.';
    case 'expired_state':
      return 'The connection request expired. Please try again.';
    case 'oauth_not_configured':
      return 'OAuth is not configured on the server. Please contact support.';
    case 'token_exchange_failed':
      return 'Failed to exchange authorization code for access token.';
    case 'callback_failed':
      return 'An error occurred during the OAuth callback process.';
    default:
      return 'An unknown error occurred. Please try again.';
  }
}
