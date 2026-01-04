import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Bot, Edit, Trash2 } from "lucide-react";
import { Link } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreateAgentDialog } from "@/components/create-agent-dialog";

export default function Agents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: isAuthenticated,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });
      setDeleteAgentId(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete agent",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  if (authLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border-teal-200 dark:border-teal-500/30";
      case "testing":
        return "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border-blue-200 dark:border-blue-500/30";
      case "paused":
        return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border-amber-200 dark:border-amber-500/30";
      default:
        return "bg-slate-50 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300 border-slate-200 dark:border-slate-500/30";
    }
  };

  const getIndustryLabel = (industry: string) => {
    const labels: Record<string, string> = {
      fine_dining: "Fine Dining",
      casual_dining: "Casual Dining",
      catering: "Catering",
      hotel: "Hotel",
    };
    return labels[industry] || industry;
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="flex-1 p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Voice Agents</h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Manage your AI voice agents for reservations and customer service
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateDialog(true)} 
            data-testid="button-create-agent" 
            className="shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>

      {!agents || agents.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10 mb-6">
              <Bot className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-3">No agents yet</h3>
            <p className="text-muted-foreground text-center mb-8 max-w-md text-sm">
              Create your first voice agent or start from a template to handle calls for your restaurant
            </p>
            <Button 
              onClick={() => setShowCreateDialog(true)} 
              data-testid="button-create-first-agent" 
              className="shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id} className="hover-elevate transition-all duration-300 shadow-md hover:shadow-lg" data-testid={`card-agent-${agent.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="truncate font-semibold text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1.5 text-xs uppercase tracking-wide">
                      {getIndustryLabel(agent.industry)}
                    </CardDescription>
                  </div>
                  <Badge className={`${getStatusColor(agent.status)} border font-medium`}>
                    {agent.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {agent.description || agent.greetingMessage}
                </p>
              </CardContent>
              <CardFooter className="flex gap-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="flex-1"
                  data-testid={`button-edit-${agent.id}`}
                >
                  <Link href={`/agents/${agent.id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDeleteAgentId(agent.id)}
                  data-testid={`button-delete-${agent.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteAgentId} onOpenChange={() => setDeleteAgentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this agent? This action cannot be undone.
              All flows, knowledge base items, and test conversations will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAgentId && deleteMutation.mutate(deleteAgentId)}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateAgentDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog} 
      />
      </div>
    </div>
  );
}
