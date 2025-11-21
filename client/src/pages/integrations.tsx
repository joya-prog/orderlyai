import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ShoppingCart, Coffee, Check, X, Loader2 } from "lucide-react";
import type { IntegrationConfig } from "@shared/schema";

export default function IntegrationsPage() {
  const { toast } = useToast();
  const [squarespaceDialogOpen, setSquarespaceDialogOpen] = useState(false);
  const [toastDialogOpen, setToastDialogOpen] = useState(false);

  const { data: integrations, isLoading } = useQuery<IntegrationConfig[]>({
    queryKey: ["/api/integrations"],
  });

  const createIntegrationMutation = useMutation({
    mutationFn: async (data: { service: string; name: string; credentials: any; config?: any; status?: string }) => {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create integration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration connected",
        description: "Your POS integration has been successfully connected.",
      });
      setSquarespaceDialogOpen(false);
      setToastDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Connection failed",
        description: "Failed to connect integration. Please check your credentials.",
        variant: "destructive",
      });
    },
  });

  const updateIntegrationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/integrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update integration");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast({
        title: "Integration updated",
        description: "Integration status has been updated.",
      });
    },
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

  const squarespaceIntegration = integrations?.find((i) => i.service === "squarespace");
  const toastIntegration = integrations?.find((i) => i.service === "toast");

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold font-serif mb-2">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your restaurant's POS system to enable orders and menu synchronization
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Squarespace Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <ShoppingCart className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Squarespace Commerce</CardTitle>
                  <CardDescription className="mt-1">
                    Sync products and process orders
                  </CardDescription>
                </div>
              </div>
              {squarespaceIntegration && (
                <Badge
                  variant={squarespaceIntegration.status === "active" ? "default" : "secondary"}
                  data-testid="badge-squarespace-status"
                >
                  {squarespaceIntegration.status === "active" ? (
                    <><Check className="h-3 w-3 mr-1" /> Active</>
                  ) : (
                    <><X className="h-3 w-3 mr-1" /> Inactive</>
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Squarespace store to enable product catalog synchronization and online ordering through your AI agents.
            </p>
            {squarespaceIntegration ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateIntegrationMutation.mutate({
                    id: squarespaceIntegration.id,
                    status: squarespaceIntegration.status === "active" ? "inactive" : "active"
                  })}
                  disabled={updateIntegrationMutation.isPending}
                  data-testid="button-toggle-squarespace"
                >
                  {squarespaceIntegration.status === "active" ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteIntegrationMutation.mutate(squarespaceIntegration.id)}
                  disabled={deleteIntegrationMutation.isPending}
                  data-testid="button-disconnect-squarespace"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setSquarespaceDialogOpen(true)}
                data-testid="button-connect-squarespace"
              >
                Connect Squarespace
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Toast POS Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                  <Coffee className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Toast POS</CardTitle>
                  <CardDescription className="mt-1">
                    Restaurant point-of-sale system
                  </CardDescription>
                </div>
              </div>
              {toastIntegration && (
                <Badge
                  variant={toastIntegration.status === "active" ? "default" : "secondary"}
                  data-testid="badge-toast-status"
                >
                  {toastIntegration.status === "active" ? (
                    <><Check className="h-3 w-3 mr-1" /> Active</>
                  ) : (
                    <><X className="h-3 w-3 mr-1" /> Inactive</>
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Integrate with Toast POS to sync your menu, manage orders, and track customer preferences across your restaurant operations.
            </p>
            {toastIntegration ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateIntegrationMutation.mutate({
                    id: toastIntegration.id,
                    status: toastIntegration.status === "active" ? "inactive" : "active"
                  })}
                  disabled={updateIntegrationMutation.isPending}
                  data-testid="button-toggle-toast"
                >
                  {toastIntegration.status === "active" ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteIntegrationMutation.mutate(toastIntegration.id)}
                  disabled={deleteIntegrationMutation.isPending}
                  data-testid="button-disconnect-toast"
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setToastDialogOpen(true)}
                data-testid="button-connect-toast"
              >
                Connect Toast POS
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Squarespace Connection Dialog */}
      <SquarespaceDialog
        open={squarespaceDialogOpen}
        onOpenChange={setSquarespaceDialogOpen}
        onConnect={(credentials) => {
          createIntegrationMutation.mutate({
            service: "squarespace",
            name: "Squarespace Commerce",
            credentials,
            config: {},
            status: "active",
          });
        }}
        isPending={createIntegrationMutation.isPending}
      />

      {/* Toast Connection Dialog */}
      <ToastDialog
        open={toastDialogOpen}
        onOpenChange={setToastDialogOpen}
        onConnect={(credentials) => {
          createIntegrationMutation.mutate({
            service: "toast",
            name: "Toast POS",
            credentials,
            config: {},
            status: "active",
          });
        }}
        isPending={createIntegrationMutation.isPending}
      />
    </div>
  );
}

function SquarespaceDialog({
  open,
  onOpenChange,
  onConnect,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (credentials: any) => void;
  isPending: boolean;
}) {
  const [apiKey, setApiKey] = useState("");

  const handleConnect = () => {
    onConnect({ apiKey });
    setApiKey("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-connect-squarespace">
        <DialogHeader>
          <DialogTitle>Connect Squarespace Commerce</DialogTitle>
          <DialogDescription>
            Enter your Squarespace API credentials to sync products and enable ordering.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="squarespace-api-key">API Key</Label>
            <Input
              id="squarespace-api-key"
              placeholder="Enter your Squarespace API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              data-testid="input-squarespace-api-key"
            />
            <p className="text-xs text-muted-foreground">
              Find your API key in Squarespace Settings → Developer → API Keys
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-squarespace"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!apiKey || isPending}
            data-testid="button-submit-squarespace"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToastDialog({
  open,
  onOpenChange,
  onConnect,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (credentials: any) => void;
  isPending: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const handleConnect = () => {
    onConnect({ clientId, clientSecret });
    setClientId("");
    setClientSecret("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-connect-toast">
        <DialogHeader>
          <DialogTitle>Connect Toast POS</DialogTitle>
          <DialogDescription>
            Enter your Toast POS API credentials to sync menu items and manage orders.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="toast-client-id">Client ID</Label>
            <Input
              id="toast-client-id"
              placeholder="Enter your Toast client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              data-testid="input-toast-client-id"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toast-client-secret">Client Secret</Label>
            <Input
              id="toast-client-secret"
              type="password"
              placeholder="Enter your Toast client secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              data-testid="input-toast-client-secret"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Get your credentials from Toast POS Developer Portal
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-toast"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!clientId || !clientSecret || isPending}
            data-testid="button-submit-toast"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
