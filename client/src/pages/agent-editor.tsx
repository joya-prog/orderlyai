import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, InsertAgent } from "@shared/schema";
import type { Node, Edge } from '@xyflow/react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Settings, Workflow } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertAgentSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";
import { FlowBuilder } from "@/components/flow-builder";

export default function AgentEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isNew = id === "new";
  const [activeTab, setActiveTab] = useState("settings");

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: isAuthenticated && !isNew,
  });

  const { data: flowNodesData = [] } = useQuery<any[]>({
    queryKey: ["/api/agents", id, "flow-nodes"],
    enabled: isAuthenticated && !isNew,
  });

  const { data: flowConnectionsData = [] } = useQuery<any[]>({
    queryKey: ["/api/agents", id, "flow-connections"],
    enabled: isAuthenticated && !isNew,
  });

  const initialNodes = useMemo(() => {
    return flowNodesData.map((node) => ({
      id: node.id,
      type: 'custom',
      position: node.position || { x: 0, y: 0 },
      data: {
        type: node.type,
        label: node.label,
        content: node.content,
        config: node.config,
        agentId: node.agentId,
      },
    }));
  }, [flowNodesData]);

  const initialEdges = useMemo(() => {
    return flowConnectionsData.map((conn) => ({
      id: conn.id,
      source: conn.sourceNodeId,
      target: conn.targetNodeId,
      label: conn.label,
    }));
  }, [flowConnectionsData]);

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

  const form = useForm<z.infer<typeof insertAgentSchema>>({
    resolver: zodResolver(insertAgentSchema),
    defaultValues: {
      userId: user?.id || "",
      name: "",
      description: "",
      industry: "casual_dining",
      status: "draft",
      greetingMessage: "Hello! Thanks for calling. How can I help you today?",
      personality: "Friendly, professional, and helpful",
      systemPrompt: "You are a helpful AI assistant for a restaurant. Help customers with reservations, menu questions, and general inquiries.",
    },
  });

  useEffect(() => {
    if (agent && !isNew) {
      form.reset({
        userId: agent.userId,
        name: agent.name,
        description: agent.description || "",
        industry: agent.industry,
        status: agent.status,
        greetingMessage: agent.greetingMessage,
        personality: agent.personality,
        systemPrompt: agent.systemPrompt,
      });
    }
  }, [agent, isNew, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertAgentSchema>) => {
      if (isNew) {
        return await apiRequest("POST", "/api/agents", { ...data, userId: user?.id });
      } else {
        return await apiRequest("PATCH", `/api/agents/${id}`, data);
      }
    },
    onSuccess: (data: Agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: isNew ? "Agent created successfully" : "Agent updated successfully",
      });
      if (isNew) {
        navigate(`/agents/${data.id}`);
      }
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
        description: "Failed to save agent",
        variant: "destructive",
      });
    },
  });

  const saveFlowMutation = useMutation({
    mutationFn: async ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const dbNodes = nodes.map((node) => ({
        id: node.id,
        agentId: id,
        type: node.data.type,
        label: node.data.label,
        content: node.data.content || '',
        position: node.position,
        config: node.data.config || {},
      }));

      const dbEdges = edges.map((edge) => ({
        agentId: id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        label: edge.label || '',
      }));

      await apiRequest("POST", `/api/agents/${id}/flow-nodes/bulk`, { nodes: dbNodes });
      await apiRequest("POST", `/api/agents/${id}/flow-connections/bulk`, { connections: dbEdges });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "flow-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "flow-connections"] });
      toast({
        title: "Success",
        description: "Workflow saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to save workflow",
        variant: "destructive",
      });
    },
  });

  const handleSaveFlow = useCallback((nodes: Node[], edges: Edge[]) => {
    saveFlowMutation.mutate({ nodes, edges });
  }, [saveFlowMutation]);

  if (!isNew && (authLoading || isLoading)) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/agents")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold font-serif">
              {isNew ? "Create Agent" : agent?.name || "Edit Agent"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeTab === "settings" ? "Configure your AI voice agent settings" : "Design conversation flows for your agent"}
            </p>
          </div>
        </div>
        {activeTab === "settings" && (
          <Button
            onClick={form.handleSubmit((data) => saveMutation.mutate(data))}
            disabled={saveMutation.isPending}
            data-testid="button-save-agent"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Agent"}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger 
            value="workflow" 
            className="gap-2" 
            disabled={isNew}
            data-testid="tab-workflow"
          >
            <Workflow className="h-4 w-4" />
            Workflow
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration</CardTitle>
              <CardDescription>
                Define your agent's identity, personality, and behavior
              </CardDescription>
            </CardHeader>
            <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Bella's Bistro Reservations"
                        {...field}
                        data-testid="input-agent-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief description of this agent's purpose"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-agent-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Industry Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-industry">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fine_dining">Fine Dining</SelectItem>
                        <SelectItem value="casual_dining">Casual Dining</SelectItem>
                        <SelectItem value="catering">Catering</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="testing">Testing</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Set to "Active" when ready to deploy
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="greetingMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Greeting Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What the agent says when answering the phone"
                        className="min-h-20"
                        {...field}
                        data-testid="textarea-greeting"
                      />
                    </FormControl>
                    <FormDescription>
                      This is the first thing customers hear when calling
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personality</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Warm, professional, and attentive"
                        {...field}
                        data-testid="input-personality"
                      />
                    </FormControl>
                    <FormDescription>
                      Describe how the agent should communicate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Instructions for the AI agent..."
                        className="min-h-32 font-mono text-sm"
                        {...field}
                        data-testid="textarea-system-prompt"
                      />
                    </FormControl>
                    <FormDescription>
                      Detailed instructions that guide the agent's behavior
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflow">
          {!isNew && id && (
            <FlowBuilder 
              agentId={id} 
              initialNodes={initialNodes}
              initialEdges={initialEdges}
              onSave={handleSaveFlow}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
