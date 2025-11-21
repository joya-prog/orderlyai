import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, BookOpen, Filter, Edit, Download, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertKnowledgeBaseSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";

export default function KnowledgePage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeBase | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: isAuthenticated,
  });

  const { data: knowledgeItems = [], isLoading } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge"],
    enabled: isAuthenticated,
  });

  const filteredItems = knowledgeItems.filter((item) => {
    const agentMatch = selectedAgent === "all" || item.agentId === selectedAgent;
    const categoryMatch = selectedCategory === "all" || item.category === selectedCategory;
    return agentMatch && categoryMatch;
  });

  const form = useForm<z.infer<typeof insertKnowledgeBaseSchema>>({
    resolver: zodResolver(insertKnowledgeBaseSchema),
    defaultValues: {
      agentId: agents[0]?.id || "",
      category: "faq",
      question: "",
      answer: "",
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertKnowledgeBaseSchema>) => {
      await apiRequest("POST", `/api/knowledge`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Success",
        description: "Knowledge item added",
      });
      form.reset({ agentId: agents[0]?.id || "", category: "faq", question: "", answer: "" });
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

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertKnowledgeBase>;
    }) => {
      await apiRequest("PATCH", `/api/knowledge/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Success",
        description: "Knowledge item updated",
      });
      setEditingItem(null);
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
        description: "Failed to update knowledge item",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
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

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredItems, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `knowledge-base-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Success",
      description: `Exported ${filteredItems.length} knowledge items`,
    });
  };

  const importMutation = useMutation({
    mutationFn: async (items: Array<{
      agentId: string;
      category: string;
      question: string;
      answer: string;
    }>) => {
      await apiRequest("POST", "/api/knowledge/bulk-import", { items });
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge"] });
      toast({
        title: "Success",
        description: `Imported ${items.length} knowledge items`,
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
        description: error.message || "Failed to import knowledge items",
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
          agentId: string;
          category: string;
          question: string;
          answer: string;
        }>;

        if (!Array.isArray(items) || items.length === 0) {
          throw new Error("Invalid import file format");
        }

        importMutation.mutate(items);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to parse import file",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

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

  if (authLoading || isLoading || agentsLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold font-serif">Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">
          Manage information that agents can reference during conversations
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger data-testid="select-filter-agent">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger data-testid="select-filter-category">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="menu">Menu</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="policies">Policies</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleExport}
          variant="outline"
          disabled={filteredItems.length === 0}
          data-testid="button-export-knowledge"
        >
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
        <label>
          <Button
            variant="outline"
            disabled={agents.length === 0 || importMutation.isPending}
            data-testid="button-import-knowledge"
            asChild
          >
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {importMutation.isPending ? "Importing..." : "Import"}
            </span>
          </Button>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
            disabled={importMutation.isPending}
          />
        </label>
        <Button
          onClick={() => setIsAdding(true)}
          disabled={isAdding || agents.length === 0}
          data-testid="button-add-knowledge"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {isAdding && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle>Add Knowledge Item</CardTitle>
            <CardDescription>
              Create a new knowledge entry for your agent
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
                  name="agentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-knowledge-agent">
                            <SelectValue placeholder="Select agent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      form.reset({ agentId: agents[0]?.id || "", category: "faq", question: "", answer: "" });
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

      {agents.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
              <p className="text-muted-foreground mb-4">
                Create an agent first before adding knowledge base items
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 && !isAdding ? (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No knowledge items yet</h3>
              <p className="text-muted-foreground mb-4">
                Add FAQs, menu items, and policies to help your agents answer questions
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((item) => {
            const agent = agents.find((a) => a.id === item.agentId);
            return (
              <Card key={item.id} data-testid={`knowledge-item-${item.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-1 rounded-xl bg-muted">
                          {getCategoryLabel(item.category)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {agent?.name || "Unknown Agent"}
                        </span>
                      </div>
                      <CardTitle className="text-base">{item.question}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingItem(item)}
                        data-testid={`button-edit-knowledge-${item.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(item.id)}
                        data-testid={`button-delete-knowledge-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {item.answer}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      {editingItem && (
        <EditKnowledgeDialog
          item={editingItem}
          agents={agents}
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
  agents,
  onClose,
  onSave,
  isPending,
}: {
  item: KnowledgeBase;
  agents: Agent[];
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
          <DialogTitle>Edit Knowledge Item</DialogTitle>
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
              name="agentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-knowledge-agent">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
              control={editForm.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Question</FormLabel>
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
                  <FormLabel>Answer</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="The agent's response..."
                      className="min-h-24"
                      {...field}
                      data-testid="textarea-edit-knowledge-answer"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-edit-knowledge"
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
