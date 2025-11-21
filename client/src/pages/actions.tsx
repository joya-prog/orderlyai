import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, Play, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Action, Agent } from "@shared/schema";

const actionFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  agentId: z.string().nullable(),
  type: z.enum(["webhook", "api_call", "database_query"]),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  endpoint: z.string().url("Must be a valid URL"),
  headers: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional(),
  bodyTemplate: z.string().optional(),
});

type ActionFormValues = z.infer<typeof actionFormSchema>;

export default function ActionsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [deletingAction, setDeletingAction] = useState<Action | null>(null);
  const [testingAction, setTestingAction] = useState<Action | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; status?: number; statusText?: string; data?: any; error?: string } | null>(null);
  const [headerFields, setHeaderFields] = useState<Array<{ key: string; value: string }>>([{ key: "", value: "" }]);
  const { toast } = useToast();

  const { data: actions = [], isLoading: actionsLoading } = useQuery<Action[]>({
    queryKey: ["/api/actions"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const form = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      name: "",
      description: "",
      agentId: null,
      type: "webhook",
      method: "POST",
      endpoint: "",
      headers: [],
      bodyTemplate: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: ActionFormValues) => 
      apiRequest("/api/actions", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      setIsCreateDialogOpen(false);
      form.reset();
      setHeaderFields([{ key: "", value: "" }]);
      toast({
        title: "Action created",
        description: "The action has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ActionFormValues }) =>
      apiRequest(`/api/actions/${id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      setEditingAction(null);
      form.reset();
      setHeaderFields([{ key: "", value: "" }]);
      toast({
        title: "Action updated",
        description: "The action has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/actions/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actions"] });
      setDeletingAction(null);
      toast({
        title: "Action deleted",
        description: "The action has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const testActionMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/actions/${id}/test`, "POST"),
    onSuccess: (response: any) => {
      // Flatten the response structure for easier rendering
      setTestResult({ 
        success: true, 
        status: response.status,
        statusText: response.statusText,
        data: response.data 
      });
      toast({
        title: "Action executed successfully",
        description: "Check the test results below.",
      });
    },
    onError: (error: Error) => {
      setTestResult({ success: false, error: error.message });
      toast({
        variant: "destructive",
        title: "Action execution failed",
        description: error.message,
      });
    },
  });

  const handleOpenCreate = () => {
    form.reset({
      name: "",
      description: "",
      agentId: null,
      type: "webhook",
      method: "POST",
      endpoint: "",
      headers: [],
      bodyTemplate: "",
    });
    setHeaderFields([{ key: "", value: "" }]);
    setIsCreateDialogOpen(true);
  };

  const handleOpenEdit = (action: Action) => {
    setEditingAction(action);
    const parsedHeaders = action.headers ? JSON.parse(JSON.stringify(action.headers)) : [];
    setHeaderFields(parsedHeaders.length > 0 ? parsedHeaders : [{ key: "", value: "" }]);
    form.reset({
      name: action.name,
      description: action.description || "",
      agentId: action.agentId,
      type: action.type as "webhook" | "api_call" | "database_query",
      method: action.method as "GET" | "POST" | "PUT" | "DELETE",
      endpoint: action.endpoint,
      headers: parsedHeaders,
      bodyTemplate: action.bodyTemplate || "",
    });
  };

  const handleSubmit = (values: ActionFormValues) => {
    const filteredHeaders = headerFields.filter(h => h.key && h.value);
    const data = { ...values, headers: filteredHeaders };

    if (editingAction) {
      updateMutation.mutate({ id: editingAction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const addHeaderField = () => {
    setHeaderFields([...headerFields, { key: "", value: "" }]);
  };

  const removeHeaderField = (index: number) => {
    setHeaderFields(headerFields.filter((_, i) => i !== index));
  };

  const updateHeaderField = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headerFields];
    newHeaders[index][field] = value;
    setHeaderFields(newHeaders);
    form.setValue('headers', newHeaders);
  };

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case "GET": return "secondary";
      case "POST": return "default";
      case "PUT": return "outline";
      case "DELETE": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="page-actions">
      <div className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Actions</h1>
            <p className="text-muted-foreground mt-1">
              Create custom API actions and webhooks that your agents can trigger
            </p>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-create-action">
            <Plus className="h-4 w-4 mr-2" />
            Create Action
          </Button>
        </div>

        {/* Actions Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Actions</CardTitle>
            <CardDescription>
              {actions.length} action{actions.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {actionsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading actions...</div>
            ) : actions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-actions">
                No actions yet. Create your first action to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((action) => {
                    const assignedAgent = agents.find(a => a.id === action.agentId);
                    return (
                      <TableRow key={action.id} data-testid={`row-action-${action.id}`}>
                        <TableCell className="font-medium">{action.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{action.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getMethodBadgeVariant(action.method)}>
                            {action.method}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={action.endpoint}>
                          {action.endpoint}
                        </TableCell>
                        <TableCell>
                          {assignedAgent ? (
                            <span className="text-sm">{assignedAgent.name}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setTestingAction(action);
                                setTestResult(null);
                                testActionMutation.mutate(action.id);
                              }}
                              data-testid={`button-test-${action.id}`}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEdit(action)}
                              data-testid={`button-edit-${action.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeletingAction(action)}
                              data-testid={`button-delete-${action.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || editingAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingAction(null);
            form.reset();
            setHeaderFields([{ key: "", value: "" }]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-action-form">
          <DialogHeader>
            <DialogTitle>{editingAction ? "Edit Action" : "Create Action"}</DialogTitle>
            <DialogDescription>
              Configure an API action or webhook that your agents can trigger during conversations.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Send confirmation email" {...field} data-testid="input-name" />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Sends a confirmation email to the customer after booking" 
                        {...field}
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="api_call">API Call</SelectItem>
                          <SelectItem value="database_query">Database Query</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HTTP Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-method">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="endpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://api.example.com/webhooks/confirmation" 
                        {...field}
                        data-testid="input-endpoint"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Agent (Optional)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "unassigned" ? null : value)} value={field.value || "unassigned"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-agent">
                          <SelectValue placeholder="Select agent" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign this action to a specific agent or leave unassigned for global use
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel>Headers (Optional)</FormLabel>
                <div className="space-y-2 mt-2">
                  {headerFields.map((header, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Key (e.g., Authorization)"
                        value={header.key}
                        onChange={(e) => updateHeaderField(index, 'key', e.target.value)}
                        data-testid={`input-header-key-${index}`}
                      />
                      <Input
                        placeholder="Value (e.g., Bearer token)"
                        value={header.value}
                        onChange={(e) => updateHeaderField(index, 'value', e.target.value)}
                        data-testid={`input-header-value-${index}`}
                      />
                      {headerFields.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeHeaderField(index)}
                          data-testid={`button-remove-header-${index}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHeaderField}
                    data-testid="button-add-header"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Header
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="bodyTemplate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Request Body Template (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='{"customer": "{{customer_name}}", "booking_id": "{{booking_id}}"}'
                        {...field}
                        rows={4}
                        data-testid="input-body-template"
                      />
                    </FormControl>
                    <FormDescription>
                      Use template variables like {"{{variable}}"} that will be replaced at runtime
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingAction(null);
                    form.reset();
                    setHeaderFields([{ key: "", value: "" }]);
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {editingAction ? "Update" : "Create"} Action
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingAction !== null} onOpenChange={() => setDeletingAction(null)}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle>Delete Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingAction?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAction(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingAction && deleteMutation.mutate(deletingAction.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Result Dialog */}
      <Dialog open={testingAction !== null} onOpenChange={() => {
        setTestingAction(null);
        setTestResult(null);
      }}>
        <DialogContent className="max-w-2xl" data-testid="dialog-test-result">
          <DialogHeader>
            <DialogTitle>Test Results: {testingAction?.name}</DialogTitle>
            <DialogDescription>
              Action execution {testActionMutation.isPending ? "in progress..." : "complete"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {testActionMutation.isPending && (
              <div className="text-center py-8 text-muted-foreground">
                Executing action...
              </div>
            )}
            {testResult && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? "Success" : "Failed"}
                  </Badge>
                  {testResult.success && testResult.status && (
                    <Badge variant="outline">
                      {testResult.status} {testResult.statusText}
                    </Badge>
                  )}
                </div>
                {testResult.success ? (
                  <div>
                    <p className="text-sm font-medium mb-2">Response Data:</p>
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-sm">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="bg-destructive/10 text-destructive p-4 rounded-md">
                    <p className="font-semibold">Error:</p>
                    <p>{testResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setTestingAction(null);
              setTestResult(null);
            }} data-testid="button-close-test">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
