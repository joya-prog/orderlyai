import { useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeChange,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageCircle, 
  Calendar, 
  ShoppingCart, 
  Users, 
  Phone, 
  CheckCircle, 
  XCircle,
  Plus,
  Settings
} from 'lucide-react';

// Restaurant-specific node types
const restaurantNodeTypes = [
  { type: 'greeting', label: 'Greeting', icon: MessageCircle, color: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700' },
  { type: 'checkAvailability', label: 'Check Availability', icon: Calendar, color: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700' },
  { type: 'bookTable', label: 'Book Reservation', icon: CheckCircle, color: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700' },
  { type: 'takeOrder', label: 'Take Order', icon: ShoppingCart, color: 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' },
  { type: 'dietaryRestrictions', label: 'Dietary Restrictions', icon: Users, color: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' },
  { type: 'collectInfo', label: 'Collect Info', icon: MessageCircle, color: 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700' },
  { type: 'condition', label: 'Conditional', icon: MessageCircle, color: 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700' },
  { type: 'transfer', label: 'Transfer to Staff', icon: Phone, color: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700' },
  { type: 'end', label: 'End Call', icon: XCircle, color: 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-700' },
];

// Custom node component
function CustomNode({ data, selected, id }: { data: any; selected?: boolean; id: string }) {
  const nodeConfig = restaurantNodeTypes.find(t => t.type === data.type);
  const Icon = nodeConfig?.icon || MessageCircle;
  
  return (
    <div>
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-primary w-3 h-3"
        id={`${id}-target`}
        isConnectable={true}
      />
      <Card 
        className={`min-w-[200px] ${nodeConfig?.color || ''} border-2 ${selected ? 'ring-2 ring-primary' : ''}`} 
        data-testid={`flow-node-${data.type}`}
      >
        <CardHeader className="p-3 space-y-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">{data.label}</CardTitle>
          </div>
        </CardHeader>
        {data.content && (
          <CardContent className="p-3 pt-0">
            <p className="text-xs text-muted-foreground line-clamp-2">{data.content}</p>
          </CardContent>
        )}
      </Card>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-primary w-3 h-3"
        id={`${id}-source`}
        isConnectable={true}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

interface FlowBuilderProps {
  agentId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

export function FlowBuilder({ agentId, initialNodes = [], initialEdges = [], onSave }: FlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Derive selected node from canonical nodes array (single source of truth)
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || null : null;

  // Sync with incoming props only when data from server changes (not on every render)
  // Using JSON.stringify for deep comparison to detect actual data changes
  const [lastSyncedNodesKey, setLastSyncedNodesKey] = useState('');
  const [lastSyncedEdgesKey, setLastSyncedEdgesKey] = useState('');

  useEffect(() => {
    const key = JSON.stringify(initialNodes);
    if (key !== lastSyncedNodesKey) {
      setNodes(initialNodes);
      setLastSyncedNodesKey(key);
    }
  }, [initialNodes, lastSyncedNodesKey, setNodes]);

  useEffect(() => {
    const key = JSON.stringify(initialEdges);
    if (key !== lastSyncedEdgesKey) {
      setEdges(initialEdges);
      setLastSyncedEdgesKey(key);
    }
  }, [initialEdges, lastSyncedEdgesKey, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const addNode = useCallback((type: string) => {
    const nodeConfig = restaurantNodeTypes.find(t => t.type === type);
    if (!nodeConfig) return;

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: 'custom',
      position: { x: Math.random() * 500, y: Math.random() * 500 },
      data: { 
        type, 
        label: nodeConfig.label,
        content: '',
        agentId 
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  }, [agentId, setNodes]);

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    // Update node data - ReactFlow's setNodes properly handles data-only updates
    // Position/selection changes go through onNodesChange, data changes go directly through setNodes
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(nodes, edges);
    }
  }, [nodes, edges, onSave]);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4" data-testid="flow-builder">
      {/* Node Palette */}
      <Card className="w-64 flex-shrink-0 overflow-auto">
        <CardHeader>
          <CardTitle className="text-base">Node Palette</CardTitle>
          <CardDescription>Click to add nodes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {restaurantNodeTypes.map((nodeType) => {
            const Icon = nodeType.icon;
            return (
              <Button
                key={nodeType.type}
                variant="outline"
                className="w-full justify-start gap-2 hover-elevate"
                onClick={() => addNode(nodeType.type)}
                data-testid={`button-add-${nodeType.type}`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm">{nodeType.label}</span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Flow Canvas */}
      <div className="flex-1 relative rounded-lg border bg-background h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
          data-testid="flow-canvas"
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>

        {/* Save Button */}
        <div className="absolute top-4 right-4 z-10">
          <Button onClick={handleSave} data-testid="button-save-flow">
            Save Flow
          </Button>
        </div>
      </div>

      {/* Node Property Editor */}
      {selectedNode && (
        <Card className="w-80 flex-shrink-0 overflow-auto" data-testid="node-properties-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Node Properties
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNodeId(null)}
                data-testid="button-close-properties"
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Node Type</Label>
              <p className="text-sm font-medium">{String(selectedNode.data.label)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="node-content">Content</Label>
              <Textarea
                id="node-content"
                placeholder="Enter node content or instructions..."
                value={String(selectedNode.data.content || '')}
                onChange={(e) =>
                  updateNodeData(selectedNode.id, { content: e.target.value })
                }
                className="min-h-32"
                data-testid="input-node-content"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
