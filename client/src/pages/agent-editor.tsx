import { useEffect, useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, InsertAgent, KnowledgeBase, InsertKnowledgeBase } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, Plus, Trash2, MessageSquare, Workflow } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertAgentSchema, insertKnowledgeBaseSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";
import { FlowBuilder } from "@/components/flow-builder";
import type { Node, Edge } from '@xyflow/react';

export default function AgentEditor() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isNew = id === "new";
  const [activeTab, setActiveTab] = useState("config");

  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: isAuthenticated && !isNew,
  });

  const { data: knowledgeItems = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", id, "knowledge"],
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
              {isNew ? "Configure your new voice agent" : "Manage agent configuration and behavior"}
            </p>
          </div>
        </div>
        <Button
          onClick={form.handleSubmit((data) => saveMutation.mutate(data))}
          disabled={saveMutation.isPending}
          data-testid="button-save-agent"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Agent"}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="config" data-testid="tab-config">Configuration</TabsTrigger>
          <TabsTrigger value="flow" disabled={isNew} data-testid="tab-flow">
            <Workflow className="h-4 w-4 mr-2" />
            Flow Builder
          </TabsTrigger>
          <TabsTrigger value="knowledge" disabled={isNew} data-testid="tab-knowledge">
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="test" disabled={isNew} data-testid="tab-test">
            Test Agent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
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

        <TabsContent value="flow">
          <FlowBuilderTab 
            agentId={id!} 
            flowNodes={flowNodesData} 
            flowConnections={flowConnectionsData} 
          />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseTab agentId={id!} knowledgeItems={knowledgeItems} />
        </TabsContent>

        <TabsContent value="test">
          <TestAgentTab agentId={id!} agent={agent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KnowledgeBaseTab({
  agentId,
  knowledgeItems,
}: {
  agentId: string;
  knowledgeItems: KnowledgeBase[];
}) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm<z.infer<typeof insertKnowledgeBaseSchema>>({
    resolver: zodResolver(insertKnowledgeBaseSchema),
    defaultValues: {
      agentId,
      category: "faq",
      question: "",
      answer: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertKnowledgeBaseSchema>) => {
      await apiRequest("POST", `/api/agents/${agentId}/knowledge`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "knowledge"] });
      toast({
        title: "Success",
        description: "Knowledge item added",
      });
      form.reset({ agentId, category: "faq", question: "", answer: "" });
      setIsAdding(false);
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
        description: "Failed to add knowledge item",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "knowledge"] });
      toast({
        title: "Success",
        description: "Knowledge item deleted",
      });
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
        description: "Failed to delete knowledge item",
        variant: "destructive",
      });
    },
  });

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      menu: "Menu",
      hours: "Hours",
      policies: "Policies",
      faq: "FAQ",
      custom: "Custom",
    };
    return labels[category] || category;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Knowledge Base</CardTitle>
              <CardDescription>
                Add information the agent can reference during conversations
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAdding(true)}
              disabled={isAdding}
              data-testid="button-add-knowledge"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isAdding && (
            <Card className="mb-6 border-primary">
              <CardContent className="pt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => addMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-knowledge-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="menu">Menu</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="policies">Policies</SelectItem>
                              <SelectItem value="faq">FAQ</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="question"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Question</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., What are your hours?"
                              {...field}
                              data-testid="input-knowledge-question"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="answer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Answer</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="The agent's response..."
                              className="min-h-24"
                              {...field}
                              data-testid="textarea-knowledge-answer"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={addMutation.isPending}
                        data-testid="button-save-knowledge"
                      >
                        {addMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAdding(false);
                          form.reset({ agentId, category: "faq", question: "", answer: "" });
                        }}
                        data-testid="button-cancel-knowledge"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {knowledgeItems.length === 0 && !isAdding ? (
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No knowledge items yet</h3>
              <p className="text-muted-foreground mb-4">
                Add FAQs, menu items, and policies to help your agent answer questions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledgeItems.map((item) => (
                <Card key={item.id} data-testid={`knowledge-item-${item.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium px-2 py-1 rounded-md bg-muted">
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                        <CardTitle className="text-base">{item.question}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`button-delete-knowledge-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {item.answer}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TestAgentTab({ agentId, agent }: { agentId: string; agent?: Agent }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");

  const testMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/test`, {
        message: userMessage,
        history: messages,
      });
      return response;
    },
    onSuccess: (data: { response: string }) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
      setInput("");
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
        description: "Failed to get response from agent",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    testMutation.mutate(input);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Your Agent</CardTitle>
        <CardDescription>
          Have a conversation with your agent to test its responses
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border rounded-md p-4 min-h-[400px] max-h-[500px] overflow-y-auto bg-muted/30">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation to test your agent</p>
                  <p className="text-sm mt-2">
                    The agent will use the greeting, personality, and knowledge you've configured
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border"
                      }`}
                      data-testid={`message-${msg.role}-${i}`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {testMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-card border rounded-lg px-4 py-2">
                      <p className="text-sm text-muted-foreground">Thinking...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              disabled={testMutation.isPending}
              data-testid="input-test-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || testMutation.isPending}
              data-testid="button-send-message"
            >
              Send
            </Button>
          </div>

          {messages.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setMessages([])}
              data-testid="button-clear-conversation"
            >
              Clear Conversation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FlowBuilderTab({
  agentId,
  flowNodes,
  flowConnections,
}: {
  agentId: string;
  flowNodes: any[];
  flowConnections: any[];
}) {
  const { toast } = useToast();

  // Memoize converted data to prevent unnecessary re-renders and preserve in-progress edits
  const initialNodes = useMemo(() => {
    return flowNodes.map((node) => ({
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
  }, [flowNodes]);

  const initialEdges = useMemo(() => {
    return flowConnections.map((conn) => ({
      id: conn.id,
      source: conn.sourceNodeId,
      target: conn.targetNodeId,
      label: conn.label,
    }));
  }, [flowConnections]);

  const saveFlowMutation = useMutation({
    mutationFn: async ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      // Convert ReactFlow format back to database format
      // CRITICAL: Preserve node IDs to maintain edge connections
      const dbNodes = nodes.map((node) => ({
        id: node.id, // Preserve ID for edge references
        agentId,
        type: node.data.type,
        label: node.data.label,
        content: node.data.content || '',
        position: node.position,
        config: node.data.config || {},
      }));

      const dbEdges = edges.map((edge) => ({
        agentId,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        label: edge.label || '',
      }));

      // Save nodes
      await apiRequest("POST", `/api/agents/${agentId}/flow-nodes/bulk`, { nodes: dbNodes });
      
      // Save connections
      await apiRequest("POST", `/api/agents/${agentId}/flow-connections/bulk`, { connections: dbEdges });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "flow-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", agentId, "flow-connections"] });
      toast({
        title: "Success",
        description: "Flow saved successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to save flow",
        variant: "destructive",
      });
    },
  });

  const handleSave = (nodes: Node[], edges: Edge[]) => {
    saveFlowMutation.mutate({ nodes, edges });
  };

  return (
    <div data-testid="flow-builder-tab">
      <FlowBuilder 
        agentId={agentId} 
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        onSave={handleSave}
      />
    </div>
  );
}
