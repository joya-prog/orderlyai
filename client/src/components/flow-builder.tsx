import { useCallback, useState, useEffect, useRef, DragEvent } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, 
  Calendar, 
  ShoppingCart, 
  Users, 
  Phone, 
  CheckCircle, 
  XCircle,
  Settings,
  Search,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
  X,
  GitBranch,
  Play,
} from 'lucide-react';

// Color definitions for node badges - inspired by professional IVR builders
const nodeColors = {
  green: { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  blue: { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800' },
  orange: { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
  purple: { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800' },
  red: { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800' },
  gray: { bg: 'bg-gray-500', light: 'bg-gray-50 dark:bg-gray-950/30', border: 'border-gray-200 dark:border-gray-800' },
};

// Restaurant-specific node types with new color scheme
const restaurantNodeTypes = [
  { type: 'greeting', label: 'Greeting', subtitle: 'Welcome message', icon: Play, color: 'green' },
  { type: 'checkAvailability', label: 'Check Availability', subtitle: 'Table lookup', icon: Calendar, color: 'green' },
  { type: 'bookTable', label: 'Book Reservation', subtitle: 'Confirm booking', icon: CheckCircle, color: 'blue' },
  { type: 'takeOrder', label: 'Take Order', subtitle: 'Menu selection', icon: ShoppingCart, color: 'orange' },
  { type: 'dietaryRestrictions', label: 'Dietary Info', subtitle: 'Allergies & preferences', icon: Users, color: 'orange' },
  { type: 'collectInfo', label: 'Collect Info', subtitle: 'Guest details', icon: MessageCircle, color: 'cyan' },
  { type: 'condition', label: 'Conditional', subtitle: 'Branch logic', icon: GitBranch, color: 'purple' },
  { type: 'transfer', label: 'Transfer Call', subtitle: 'Connect to staff', icon: Phone, color: 'red' },
  { type: 'end', label: 'End Call', subtitle: 'Hang up', icon: XCircle, color: 'gray' },
];

// Professional node component matching inspiration images
function CustomNode({ data, selected, id }: { data: any; selected?: boolean; id: string }) {
  const nodeConfig = restaurantNodeTypes.find(t => t.type === data.type);
  const Icon = nodeConfig?.icon || MessageCircle;
  const colorKey = (nodeConfig?.color || 'gray') as keyof typeof nodeColors;
  const colors = nodeColors[colorKey];
  
  return (
    <div className="group">
      {/* Top Handle */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!w-2.5 !h-2.5 !bg-gray-300 dark:!bg-gray-600 !border-2 !border-white dark:!border-gray-800 !-top-1"
        id={`${id}-target`}
        isConnectable={true}
      />
      
      {/* Node Card */}
      <div 
        className={`
          min-w-[180px] max-w-[200px] bg-white dark:bg-gray-900 rounded-xl 
          shadow-sm hover:shadow-md transition-all duration-200
          border-2 ${selected ? 'border-blue-500 shadow-blue-100 dark:shadow-blue-900/20' : 'border-gray-100 dark:border-gray-800'}
        `}
        data-testid={`flow-node-${data.type}`}
      >
        <div className="p-3 flex items-start gap-3">
          {/* Colored Icon Badge */}
          <div className={`
            w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0 shadow-sm
          `}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          
          {/* Title and Subtitle */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {data.label}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {data.content || nodeConfig?.subtitle || 'No description'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Bottom Handle */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!w-2.5 !h-2.5 !bg-gray-300 dark:!bg-gray-600 !border-2 !border-white dark:!border-gray-800 !-bottom-1"
        id={`${id}-source`}
        isConnectable={true}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

// Custom edge style
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { 
    stroke: '#94a3b8', 
    strokeWidth: 2,
  },
  markerEnd: {
    type: 'arrowclosed' as const,
    color: '#94a3b8',
    width: 20,
    height: 20,
  },
};

interface FlowBuilderProps {
  agentId: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  onSave?: (nodes: Node[], edges: Edge[]) => void;
}

// History entry for undo/redo
interface HistoryEntry {
  nodes: Node[];
  edges: Edge[];
}

// Deep clone helper for history management
function cloneState(nodes: Node[], edges: Edge[]): HistoryEntry {
  return {
    nodes: nodes.map(n => ({ ...n, data: { ...n.data }, position: { ...n.position } })),
    edges: edges.map(e => ({ ...e })),
  };
}

function FlowBuilderInner({ agentId, initialNodes = [], initialEdges = [], onSave }: FlowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  
  // Undo/Redo history - use state for proper React integration
  const [history, setHistory] = useState<HistoryEntry[]>([cloneState(initialNodes, initialEdges)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const skipHistoryRef = useRef(false);
  
  // Derive selected node from canonical nodes array
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) || null : null;

  // Sync with incoming props
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

  // Derived state for undo/redo buttons
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Track changes for undo/redo
  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    
    // Only track significant changes (node count or edge count changed)
    const lastEntry = history[historyIndex];
    if (!lastEntry) return;
    
    const nodesChanged = nodes.length !== lastEntry.nodes.length || 
      JSON.stringify(nodes.map(n => n.id)) !== JSON.stringify(lastEntry.nodes.map(n => n.id));
    const edgesChanged = edges.length !== lastEntry.edges.length ||
      JSON.stringify(edges.map(e => e.id)) !== JSON.stringify(lastEntry.edges.map(e => e.id));
    
    if (nodesChanged || edgesChanged) {
      const newEntry = cloneState(nodes, edges);
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(newEntry);
        // Limit to 50 entries
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
  }, [nodes, edges, history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      skipHistoryRef.current = true;
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setNodes(state.nodes.map(n => ({ ...n, data: { ...n.data }, position: { ...n.position } })));
      setEdges(state.edges.map(e => ({ ...e })));
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      skipHistoryRef.current = true;
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setNodes(state.nodes.map(n => ({ ...n, data: { ...n.data }, position: { ...n.position } })));
      setEdges(state.edges.map(e => ({ ...e })));
      setHistoryIndex(newIndex);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const nodeConfig = restaurantNodeTypes.find(t => t.type === type);
      if (!nodeConfig) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type: 'custom',
        position,
        data: { 
          type, 
          label: nodeConfig.label,
          content: '',
          agentId 
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [agentId, screenToFlowPosition, setNodes],
  );

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
  }, [setNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(nodes, edges);
    }
  }, [nodes, edges, onSave]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Filter nodes based on search
  const filteredNodeTypes = restaurantNodeTypes.filter(node =>
    node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4" data-testid="flow-builder">
      {/* Flow Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 relative rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Gradient Background Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-gray-950 dark:via-blue-950/20 dark:to-gray-900" />
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          className="bg-transparent"
          data-testid="flow-canvas"
        >
          {/* Top Toolbar */}
          <Panel position="top-left" className="flex items-center gap-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleUndo}
              disabled={!canUndo}
              data-testid="button-undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleRedo}
              disabled={!canRedo}
              data-testid="button-redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => zoomOut()}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => zoomIn()}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => fitView()}
              data-testid="button-fit-view"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
            <Button 
              onClick={handleSave} 
              size="sm"
              className="h-8 gap-1.5"
              data-testid="button-save-flow"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </Panel>

          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1} 
            color="#cbd5e1"
            className="dark:opacity-30"
          />
          
          {/* MiniMap in bottom right */}
          <MiniMap 
            nodeColor={(node) => {
              const nodeConfig = restaurantNodeTypes.find(t => t.type === node.data?.type);
              const colorMap: Record<string, string> = {
                green: '#10b981',
                blue: '#3b82f6',
                orange: '#f59e0b',
                purple: '#8b5cf6',
                red: '#f43f5e',
                cyan: '#06b6d4',
                gray: '#6b7280',
              };
              return colorMap[nodeConfig?.color || 'gray'] || '#6b7280';
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-white/80 dark:!bg-gray-900/80 !rounded-lg !border !border-gray-200 dark:!border-gray-700 !shadow-sm"
            style={{ width: 140, height: 90 }}
            pannable
            zoomable
          />
        </ReactFlow>
      </div>

      {/* Right Side Panel - Widget Library & Properties */}
      <div className="flex flex-col gap-4 w-72 flex-shrink-0">
        {/* Widget Library */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3 flex-shrink-0">
            <CardTitle className="text-base font-semibold">Widget Library</CardTitle>
            <p className="text-xs text-muted-foreground">Drop widgets into the builder</p>
          </CardHeader>
          
          {/* Search */}
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search widgets"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
                data-testid="input-search-widgets"
              />
            </div>
          </div>

          {/* Widget Grid */}
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {filteredNodeTypes.map((nodeType) => {
                const Icon = nodeType.icon;
                const colorKey = nodeType.color as keyof typeof nodeColors;
                const colors = nodeColors[colorKey];
                return (
                  <div
                    key={nodeType.type}
                    draggable
                    onDragStart={(event) => onDragStart(event, nodeType.type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 
                      hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 
                      dark:hover:border-gray-700 cursor-grab active:cursor-grabbing transition-all duration-150
                      hover:shadow-sm"
                    data-testid={`draggable-node-${nodeType.type}`}
                  >
                    {/* Circular Icon */}
                    <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center shadow-sm`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    {/* Label */}
                    <span className="text-xs font-medium text-center text-gray-700 dark:text-gray-300 leading-tight">
                      {nodeType.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Node Property Editor */}
        {selectedNode && (
          <Card className="flex-shrink-0 max-h-80 overflow-auto" data-testid="node-properties-panel">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const nodeConfig = restaurantNodeTypes.find(t => t.type === selectedNode.data.type);
                    const Icon = nodeConfig?.icon || Settings;
                    const colorKey = (nodeConfig?.color || 'gray') as keyof typeof nodeColors;
                    const colors = nodeColors[colorKey];
                    return (
                      <div className={`w-6 h-6 rounded-md ${colors.bg} flex items-center justify-center`}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                    );
                  })()}
                  <CardTitle className="text-base">{String(selectedNode.data.label)}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedNodeId(null)}
                  data-testid="button-close-properties"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="node-content" className="text-xs font-medium">
                  Description / Instructions
                </Label>
                <Textarea
                  id="node-content"
                  placeholder="Enter what the AI should say or do at this step..."
                  value={String(selectedNode.data.content || '')}
                  onChange={(e) =>
                    updateNodeData(selectedNode.id, { content: e.target.value })
                  }
                  className="min-h-24 text-sm resize-none"
                  data-testid="input-node-content"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => deleteNode(selectedNode.id)}
                  data-testid="button-delete-node"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
