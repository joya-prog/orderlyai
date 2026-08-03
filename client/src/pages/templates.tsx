import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Template } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutTemplate, Check } from "lucide-react";
import { useLocation } from "wouter";

export default function Templates() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: isAuthenticated,
  });

  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await apiRequest("POST", "/api/templates/use", { templateId });
      return response;
    },
    onSuccess: (data: { agentId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: "Agent created from template",
      });
      navigate(`/agents/${data.agentId}`);
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
        title: "Failed to create agent",
        description: error?.message || "An error occurred. Please try again.",
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
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  const getIndustryLabel = (industry: string) => {
    const labels: Record<string, string> = {
      fine_dining: "Fine Dining",
      casual_dining: "Casual Dining",
      catering: "Catering",
      hotel: "Hotel",
    };
    return labels[industry] || industry;
  };

  const getIndustryColor = (industry: string) => {
    const colors: Record<string, string> = {
      fine_dining: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
      casual_dining: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
      catering: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      hotel: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    };
    return colors[industry] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold font-serif">Agent Templates</h1>
        <p className="text-muted-foreground mt-2">
          Start with pre-configured templates for common restaurant and hospitality scenarios
        </p>
      </div>

      {!templates || templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <LayoutTemplate className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No templates available</h3>
            <p className="text-muted-foreground text-center">
              Templates will be added soon to help you get started faster
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover-elevate flex flex-col" data-testid={`template-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <Badge className={getIndustryColor(template.industry)}>
                    {getIndustryLabel(template.industry)}
                  </Badge>
                </div>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {template.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Greeting</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.greetingMessage}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Personality</h4>
                    <p className="text-sm text-muted-foreground">
                      {template.personality}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => useTemplateMutation.mutate(template.id)}
                  disabled={useTemplateMutation.isPending}
                  data-testid={`button-use-template-${template.id}`}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Use Template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
