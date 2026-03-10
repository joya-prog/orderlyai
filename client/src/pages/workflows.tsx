import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Workflow, HelpCircle } from "lucide-react";
import { FlowBuilder } from "@/components/flow-builder";
import { useWorkflowTour } from "@/components/onboarding-tour";
import type { Node, Edge } from '@xyflow/react';

export default function WorkflowsPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const { startWorkflowTour } = useWorkflowTour();

  useEffect(() => {
    if (!localStorage.getItem("workflowTourSeen")) {
      const timer = setTimeout(() => {
        startWorkflowTour();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [startWorkflowTour]);

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    enabled: isAuthenticated,
  });

  const { data: flowNodesData = [] } = useQuery<any[]>({
    queryKey: ["/api/agents", selectedAgentId, "flow-nodes"],
    enabled: isAuthenticated && !!selectedAgentId,
  });

  const { data: flowConnectionsData = [] } = useQuery<any[]>({
    queryKey: ["/api/agents", selectedAgentId, "flow-connections"],
    enabled: isAuthenticated && !!selectedAgentId,
  });

  const initialNodes = useMemo(() => {
    return flowNodesData.map((node) => {
      const config = node.config || {};
      return {
        id: node.id,
        type: 'custom',
        position: node.position || { x: 0, y: 0 },
        data: {
          type: node.type,
          label: node.label,
          content: node.content,
          config: node.config,
          agentId: node.agentId,
          transitions: config.transitions || [],
          contentMode: config.contentMode || 'prompt',
        },
      };
    });
  }, [flowNodesData]);

  const initialEdges = useMemo(() => {
    return flowConnectionsData.map((conn) => ({
      id: conn.id,
      source: conn.sourceNodeId,
      target: conn.targetNodeId,
      sourceHandle: conn.sourceHandle || undefined,
      label: conn.label,
    }));
  }, [flowConnectionsData]);

  const saveFlowMutation = useMutation({
    mutationFn: async ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const dbNodes = nodes.map((node) => {
        const existingConfig = (node.data.config || {}) as Record<string, any>;
        const transitions = node.data.transitions ?? existingConfig.transitions ?? [];
        const contentMode = node.data.contentMode ?? existingConfig.contentMode ?? 'prompt';
        return {
          id: node.id,
          agentId: selectedAgentId,
          type: node.data.type,
          label: node.data.label,
          content: node.data.content || '',
          position: node.position,
          config: {
            ...existingConfig,
            transitions,
            contentMode,
          },
        };
      });

      const dbEdges = edges.map((edge) => ({
        agentId: selectedAgentId,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        label: edge.label || '',
      }));

      await apiRequest("POST", `/api/agents/${selectedAgentId}/flow-nodes/bulk`, { nodes: dbNodes });
      await apiRequest("POST", `/api/agents/${selectedAgentId}/flow-connections/bulk`, { connections: dbEdges });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "flow-nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgentId, "flow-connections"] });
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

  if (authLoading || agentsLoading) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-8" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-semibold font-serif mb-6">Workflows</h1>
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Workflow className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
              <p className="text-muted-foreground">
                Create an agent first before building workflows
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedAgentId && agents.length > 0) {
    setSelectedAgentId(agents[0].id);
    return null;
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold font-serif">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Design conversation flows for your agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={startWorkflowTour}
            data-testid="button-workflow-tour"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            How it works
          </Button>
          <div className="w-56">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger data-testid="select-agent">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <FlowBuilder 
        agentId={selectedAgentId} 
        initialNodes={initialNodes}
        initialEdges={initialEdges}
        onSave={handleSave}
      />
    </div>
  );
}
