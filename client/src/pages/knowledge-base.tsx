import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KnowledgeBase, InsertKnowledgeBase, Agent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Trash2, 
  BookOpen, 
  Edit, 
  Download, 
  Upload, 
  Bot,
  FileText,
  Clock,
  HelpCircle,
  Utensils,
  Tag,
  MoreVertical,
  Search,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertKnowledgeBaseSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

const CATEGORIES = [
  { value: "menu", label: "Menu", icon: Utensils, color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300" },
  { value: "hours", label: "Hours", icon: Clock, color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" },
  { value: "policies", label: "Policies", icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300" },
  { value: "faq", label: "FAQ", icon: HelpCircle, color: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" },
  { value: "custom", label: "Custom", icon: Tag, color: "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300" },
];

export default function KnowledgePage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBase | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: isAuthenticated,
  });

  // Fetch ALL knowledge items for per-agent counts
  const { data: allKnowledgeItems = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge"],
    enabled: isAuthenticated,
  });

  // Calculate per-agent counts
  const agentKnowledgeCounts = agents.reduce((acc, agent) => {
    acc[agent.id] = allKnowledgeItems.filter(item => item.agentId === agent.id).length;
    return acc;
  }, {} as Record<string, number>);

  // Auto-select first agent
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // Fetch knowledge items for selected agent only
  const { data: knowledgeItems = [], isLoading: knowledgeLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", selectedAgentId, "knowledge"],
    queryFn: async () => {
      if (!selectedAgentId) return [];
      const res = await fetch(`/api/agents/${selectedAgentId}/knowledge`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch knowledge');
      return res.json();
    },
    enabled: isAuthenticated && !!selectedAgentId,
  });

  // Filter items by category and search
  const filteredItems = knowledgeItems.filter((item) => {
    const categoryMatch = selectedCategory === "all" || item.category === selectedCategory;
    const searchMatch = !searchQuery || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return categoryMatch && searchMatch;
  });

  // Stats
  const stats = {
    total: knowledgeItems.length,
    byCategory: CATEGORIES.reduce((acc, cat) => {
      acc[cat.value] = knowledgeItems.filter(i => i.category === cat.value).length;
      return acc;
    }, {} as Record<string, number>),
  };

  const form = useForm<z.infer<typeof insertKnowledgeBaseSchema>>({
    resolver: zodResolver(insertKnowledgeBaseSchema),
    defaultValues: {
      agentId: selectedAgentId || "",
      category: "faq",
      question: "",
      answer: "",
    },
  });

  // Update form when agent changes
  useEffect(() => {
    if (selectedAgentId) {
      form.setValue("agentId", selectedAgentId);
    }
  }, [selectedAgentId, form]);

  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertKnowledgeBaseSchema>) => {
      if (!selectedAgentId) throw new Error("No agent selected");
      await apiRequest("POST", `/api/agents/${selectedAgentId}/knowledge`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Knowledge Added",
        description: "Your agent will now use this information in conversations.",
      });
      form.reset({ agentId: selectedAgentId || "", category: "faq", question: "", answer: "" });
      setIsAdding(false);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add knowledge item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertKnowledgeBase> }) => {
      await apiRequest("PATCH", `/api/knowledge/${id}`, data);
    },
    onSuccess: () => {
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "knowledge"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Knowledge Updated",
        description: "Changes saved successfully.",
      });
      setEditingItem(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update knowledge item.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/knowledge/${id}`);
    },
    onSuccess: () => {
      if (selectedAgentId) {
        queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "knowledge"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Knowledge Removed",
        description: "The item has been deleted.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete knowledge item.",
        variant: "destructive",
      });
    },
  });

  const handleExport = () => {
    const dataStr = JSON.stringify(knowledgeItems, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedAgent?.name || 'knowledge'}-base-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Export Complete",
      description: `Exported ${knowledgeItems.length} items for ${selectedAgent?.name}.`,
    });
  };

  const importMutation = useMutation({
    mutationFn: async (items: Array<{ category: string; question: string; answer: string }>) => {
      if (!selectedAgentId) throw new Error("No agent selected");
      // Add agentId to each item
      const itemsWithAgent = items.map(item => ({ ...item, agentId: selectedAgentId }));
      await apiRequest("POST", "/api/knowledge/bulk-import", { items: itemsWithAgent });
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "knowledge"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Import Complete",
        description: `Imported ${items.length} items to ${selectedAgent?.name}.`,
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import knowledge items.",
        variant: "destructive",
      });
    },
  });

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const items = JSON.parse(e.target?.result as string) as Array<{
          category: string;
          question: string;
          answer: string;
        }>;

        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("Invalid import file format");
        }

        importMutation.mutate(items);
      } catch {
        toast({
          title: "Invalid File",
          description: "Please upload a valid JSON file with knowledge items.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[4];
  };

  if (authLoading || agentsLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[400px] lg:col-span-3" />
        </div>
      </div>
    );
  }

  // No agents state
  if (agents.length === 0) {
    return (
      <div className="p-8 max-w-4xl mx-auto" data-testid="page-knowledge-base">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-page-title">
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Train your AI agents with custom information
          </p>
        </div>

        <Card className="shadow-md border-dashed">
          <CardContent className="py-16">
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bot className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Create Your First Agent</h3>
              <p className="text-muted-foreground mb-6">
                Before adding knowledge, you'll need to create an AI agent. Each agent can have its own 
                customized knowledge base for handling specific topics.
              </p>
              <Button size="lg" onClick={() => window.location.href = "/agents"} data-testid="button-create-agent">
                <Plus className="h-4 w-4 mr-2" />
                Create Agent
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="page-knowledge-base">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-page-title">
          Knowledge Base
        </h1>
        <p className="text-muted-foreground">
          Train your AI agents with FAQs, menu items, policies, and more
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Agent Selection */}
        <div className="space-y-4">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Select Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group ${
                    selectedAgentId === agent.id
                      ? "bg-primary text-primary-foreground"
                      : "hover-elevate"
                  }`}
                  data-testid={`button-select-agent-${agent.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedAgentId === agent.id 
                        ? "bg-primary-foreground/20" 
                        : "bg-primary/10"
                    }`}>
                      <Bot className={`h-4 w-4 ${selectedAgentId === agent.id ? "" : "text-primary"}`} />
                    </div>
                    <div className="truncate">
                      <div className="font-medium truncate">{agent.name}</div>
                      <div className={`text-xs truncate ${
                        selectedAgentId === agent.id ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        {agentKnowledgeCounts[agent.id] || 0} items
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 ${
                    selectedAgentId === agent.id ? "opacity-100" : "opacity-0 group-hover:opacity-50"
                  }`} />
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Category Stats */}
          {selectedAgentId && (
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Knowledge Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <Separator />
                {CATEGORIES.map((cat) => {
                  const count = stats.byCategory[cat.value] || 0;
                  const Icon = cat.icon;
                  return (
                    <div key={cat.value} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">{cat.label}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {selectedAgentId && (
            <>
              {/* Toolbar */}
              <Card className="shadow-md">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search questions or answers..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                        data-testid="input-search-knowledge"
                      />
                    </div>

                    {/* Category Filter */}
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[150px]" data-testid="select-filter-category">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-more-actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={handleExport} 
                          disabled={knowledgeItems.length === 0}
                          data-testid="button-export-knowledge"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <label className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-2" />
                            Import JSON
                            <input
                              type="file"
                              accept=".json"
                              className="hidden"
                              onChange={handleImport}
                              disabled={importMutation.isPending}
                            />
                          </label>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      onClick={() => setIsAdding(true)}
                      disabled={isAdding}
                      data-testid="button-add-knowledge"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Knowledge
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Add Knowledge Form */}
              {isAdding && (
                <Card className="shadow-md border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Add Knowledge Item
                    </CardTitle>
                    <CardDescription>
                      This information will be available to {selectedAgent?.name} during conversations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                                  {CATEGORIES.map((cat) => {
                                    const Icon = cat.icon;
                                    return (
                                      <SelectItem key={cat.value} value={cat.value}>
                                        <div className="flex items-center gap-2">
                                          <Icon className="h-4 w-4" />
                                          {cat.label}
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
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
                              <FormLabel>Question / Topic</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., What are your hours of operation?"
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
                              <FormLabel>Answer / Information</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Provide the information your agent should use when answering this question..."
                                  className="min-h-[120px]"
                                  {...field}
                                  data-testid="textarea-knowledge-answer"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-2 pt-2">
                          <Button
                            type="submit"
                            disabled={addMutation.isPending}
                            data-testid="button-save-knowledge"
                          >
                            {addMutation.isPending ? "Saving..." : "Save Knowledge"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsAdding(false);
                              form.reset({ agentId: selectedAgentId || "", category: "faq", question: "", answer: "" });
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

              {/* Knowledge Items List */}
              {knowledgeLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : filteredItems.length === 0 ? (
                <Card className="shadow-md border-dashed">
                  <CardContent className="py-16">
                    <div className="text-center max-w-md mx-auto">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="h-8 w-8 text-primary" />
                      </div>
                      {knowledgeItems.length === 0 ? (
                        <>
                          <h3 className="text-lg font-semibold mb-2">No Knowledge Yet</h3>
                          <p className="text-muted-foreground mb-6">
                            Start building {selectedAgent?.name}'s knowledge base. Add FAQs, menu items, 
                            business hours, and policies to help your agent answer customer questions.
                          </p>
                          <Button onClick={() => setIsAdding(true)} data-testid="button-add-first-knowledge">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Your First Item
                          </Button>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
                          <p className="text-muted-foreground">
                            No knowledge items match your search or filter criteria.
                          </p>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map((item) => {
                    const catInfo = getCategoryInfo(item.category);
                    const Icon = catInfo.icon;
                    return (
                      <Card 
                        key={item.id} 
                        className="shadow-sm hover-elevate transition-all"
                        data-testid={`knowledge-item-${item.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${catInfo.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
                                      {catInfo.label}
                                    </Badge>
                                  </div>
                                  <h4 className="font-medium text-base mb-2">{item.question}</h4>
                                  <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                                    {item.answer}
                                  </p>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="flex-shrink-0"
                                      data-testid={`button-knowledge-menu-${item.id}`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem 
                                      onClick={() => setEditingItem(item)}
                                      data-testid={`button-edit-knowledge-${item.id}`}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => deleteMutation.mutate(item.id)}
                                      className="text-destructive focus:text-destructive"
                                      data-testid={`button-delete-knowledge-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      {editingItem && (
        <EditKnowledgeDialog
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(data) => {
            editMutation.mutate({
              id: editingItem.id,
              data,
            });
          }}
          isPending={editMutation.isPending}
        />
      )}
    </div>
  );
}

function EditKnowledgeDialog({
  item,
  onClose,
  onSave,
  isPending,
}: {
  item: KnowledgeBase;
  onClose: () => void;
  onSave: (data: Partial<InsertKnowledgeBase>) => void;
  isPending: boolean;
}) {
  const editForm = useForm<z.infer<typeof insertKnowledgeBaseSchema>>({
    resolver: zodResolver(insertKnowledgeBaseSchema),
    defaultValues: {
      agentId: item.agentId,
      category: item.category,
      question: item.question,
      answer: item.answer,
    },
  });

  return (
    <Dialog open={true} onOpenChange={(open) => !isPending && !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Knowledge Item
          </DialogTitle>
          <DialogDescription>
            Update the question and answer for this knowledge entry
          </DialogDescription>
        </DialogHeader>
        <Form {...editForm}>
          <form
            onSubmit={editForm.handleSubmit((data) => onSave(data))}
            className="space-y-4"
          >
            <FormField
              control={editForm.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-knowledge-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((cat) => {
                        const Icon = cat.icon;
                        return (
                          <SelectItem key={cat.value} value={cat.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {cat.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question / Topic</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., What are your hours?"
                      {...field}
                      data-testid="input-edit-knowledge-question"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={editForm.control}
              name="answer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Answer / Information</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="The agent's response..."
                      className="min-h-[120px]"
                      {...field}
                      data-testid="textarea-edit-knowledge-answer"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-update-knowledge"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                data-testid="button-cancel-edit-knowledge"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
