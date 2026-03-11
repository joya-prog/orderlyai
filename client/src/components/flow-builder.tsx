import { useCallback, useState, useEffect, useRef, DragEvent, useMemo, memo } from 'react';
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
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, 
  Calendar, 
  ShoppingCart, 
  Users, 
  Phone, 
  CheckCircle,
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
  ArrowRight,
  Plus,
  Trash2,
  Mic,
  PhoneCall,
  PhoneOff,
  Hash,
  Keyboard,
  Repeat,
  Clock,
  Sparkles,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

// ============================================================================
// NODE TYPE DEFINITIONS - Retell AI Style Categories
// ============================================================================

// Color definitions for node badges
const nodeColors = {
  green: { bg: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', hex: '#10b981' },
  blue: { bg: 'bg-blue-500', light: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', hex: '#3b82f6' },
  orange: { bg: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', hex: '#f59e0b' },
  purple: { bg: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', hex: '#8b5cf6' },
  red: { bg: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', hex: '#f43f5e' },
  cyan: { bg: 'bg-cyan-500', light: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', hex: '#06b6d4' },
  gray: { bg: 'bg-gray-500', light: 'bg-gray-50 dark:bg-gray-950/30', border: 'border-gray-200 dark:border-gray-800', hex: '#6b7280' },
  indigo: { bg: 'bg-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', hex: '#6366f1' },
  pink: { bg: 'bg-pink-500', light: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-200 dark:border-pink-800', hex: '#ec4899' },
  teal: { bg: 'bg-teal-500', light: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-200 dark:border-teal-800', hex: '#14b8a6' },
};

// Transition type definition
interface Transition {
  id: string;
  label: string;
  color?: string;
  condition?: string;
}

// Node category definition
interface NodeCategory {
  id: string;
  label: string;
  description: string;
  nodes: NodeTypeConfig[];
}

interface NodeTypeConfig {
  type: string;
  label: string;
  subtitle: string;
  icon: any;
  color: keyof typeof nodeColors;
  defaultTransitions: Transition[];
  configFields?: ConfigField[];
}

interface ConfigField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

// Node categories organized like Retell AI
const nodeCategories: NodeCategory[] = [
  {
    id: 'conversation',
    label: 'Conversation',
    description: 'AI responses and prompts',
    nodes: [
      {
        type: 'greeting',
        label: 'Start',
        subtitle: 'Begin conversation',
        icon: Play,
        color: 'green',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
        configFields: [
          { id: 'prompt', label: 'Opening Message', type: 'textarea', placeholder: 'Hello! Thank you for calling...' },
        ],
      },
      {
        type: 'response',
        label: 'Response',
        subtitle: 'AI speaks to caller',
        icon: MessageCircle,
        color: 'blue',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
        configFields: [
          { id: 'prompt', label: 'Response Prompt', type: 'textarea', placeholder: 'What should the AI say?' },
        ],
      },
      {
        type: 'collectInfo',
        label: 'Collect Input',
        subtitle: 'Gather caller info',
        icon: Mic,
        color: 'cyan',
        defaultTransitions: [
          { id: 'collected', label: 'Info Collected', color: 'emerald' },
          { id: 'failed', label: 'Failed', color: 'rose' },
        ],
        configFields: [
          { id: 'prompt', label: 'Collection Prompt', type: 'textarea', placeholder: 'May I have your name please?' },
          { id: 'variableName', label: 'Save to Variable', type: 'text', placeholder: 'customer_name' },
        ],
      },
      {
        type: 'keypadInput',
        label: 'Keypad Input',
        subtitle: 'DTMF digits',
        icon: Keyboard,
        color: 'indigo',
        defaultTransitions: [
          { id: 'received', label: 'Input Received', color: 'emerald' },
          { id: 'timeout', label: 'Timeout', color: 'rose' },
        ],
        configFields: [
          { id: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Please enter your 4-digit code...' },
          { id: 'digits', label: 'Expected Digits', type: 'number', placeholder: '4' },
        ],
      },
    ],
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Restaurant-specific actions',
    nodes: [
      {
        type: 'checkAvailability',
        label: 'Check Availability',
        subtitle: 'Table lookup',
        icon: Calendar,
        color: 'green',
        defaultTransitions: [
          { id: 'available', label: 'Available', color: 'emerald' },
          { id: 'unavailable', label: 'Unavailable', color: 'rose' },
        ],
        configFields: [
          { id: 'prompt', label: 'Checking Message', type: 'textarea', placeholder: 'Let me check availability for you...' },
        ],
      },
      {
        type: 'bookTable',
        label: 'Book Reservation',
        subtitle: 'Confirm booking',
        icon: CheckCircle,
        color: 'blue',
        defaultTransitions: [
          { id: 'confirmed', label: 'Confirmed', color: 'emerald' },
          { id: 'failed', label: 'Failed', color: 'rose' },
        ],
        configFields: [
          { id: 'confirmationPrompt', label: 'Confirmation Message', type: 'textarea', placeholder: 'Your reservation is confirmed for...' },
        ],
      },
      {
        type: 'takeOrder',
        label: 'Take Order',
        subtitle: 'Menu selection',
        icon: ShoppingCart,
        color: 'orange',
        defaultTransitions: [
          { id: 'orderComplete', label: 'Order Complete', color: 'emerald' },
          { id: 'addMore', label: 'Add More Items', color: 'blue' },
        ],
        configFields: [
          { id: 'prompt', label: 'Order Prompt', type: 'textarea', placeholder: 'What would you like to order?' },
        ],
      },
      {
        type: 'dietaryRestrictions',
        label: 'Dietary Info',
        subtitle: 'Allergies & preferences',
        icon: Users,
        color: 'teal',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
        configFields: [
          { id: 'prompt', label: 'Dietary Prompt', type: 'textarea', placeholder: 'Do you have any dietary restrictions or allergies?' },
        ],
      },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    description: 'Branching and conditions',
    nodes: [
      {
        type: 'condition',
        label: 'Condition',
        subtitle: 'Branch logic',
        icon: GitBranch,
        color: 'purple',
        defaultTransitions: [
          { id: 'yes', label: 'Yes / True', color: 'emerald' },
          { id: 'no', label: 'No / False', color: 'rose' },
        ],
        configFields: [
          { id: 'condition', label: 'Condition', type: 'textarea', placeholder: 'if customer wants to make a reservation' },
        ],
      },
      {
        type: 'wait',
        label: 'Wait',
        subtitle: 'Pause briefly',
        icon: Clock,
        color: 'gray',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
        configFields: [
          { id: 'duration', label: 'Wait Duration (seconds)', type: 'number', placeholder: '2' },
        ],
      },
      {
        type: 'repeat',
        label: 'Loop Back',
        subtitle: 'Return to node',
        icon: Repeat,
        color: 'indigo',
        defaultTransitions: [{ id: 'next', label: 'Loop', color: 'blue' }],
      },
    ],
  },
  {
    id: 'telephony',
    label: 'Telephony',
    description: 'Call handling',
    nodes: [
      {
        type: 'transfer',
        label: 'Transfer Call',
        subtitle: 'Connect to staff',
        icon: PhoneCall,
        color: 'pink',
        defaultTransitions: [
          { id: 'transferred', label: 'Transferred', color: 'emerald' },
          { id: 'failed', label: 'Failed', color: 'rose' },
        ],
        configFields: [
          { id: 'transferMessage', label: 'Transfer Message', type: 'textarea', placeholder: 'Please hold while I connect you...' },
          { id: 'phoneNumber', label: 'Transfer To', type: 'text', placeholder: '+1 (555) 123-4567' },
        ],
      },
      {
        type: 'pressDigit',
        label: 'Press Digit',
        subtitle: 'Navigate IVR',
        icon: Hash,
        color: 'cyan',
        defaultTransitions: [{ id: 'next', label: 'Digit Pressed', color: 'emerald' }],
        configFields: [
          { id: 'digit', label: 'Digit to Press', type: 'text', placeholder: '1' },
        ],
      },
      {
        type: 'end',
        label: 'End Call',
        subtitle: 'Hang up',
        icon: PhoneOff,
        color: 'red',
        defaultTransitions: [],
        configFields: [
          { id: 'closingMessage', label: 'Closing Message', type: 'textarea', placeholder: 'Thank you for calling. Goodbye!' },
        ],
      },
    ],
  },
];

// Flatten all node types for easy lookup
const allNodeTypes = nodeCategories.flatMap(cat => cat.nodes);

// Get node config by type
function getNodeConfig(type: string): NodeTypeConfig | undefined {
  return allNodeTypes.find(n => n.type === type);
}

// Transition color mapping
const transitionColors: Record<string, { bg: string; text: string; handle: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', handle: '!bg-emerald-500' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', handle: '!bg-rose-500' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', handle: '!bg-blue-500' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', handle: '!bg-amber-500' },
};

// ============================================================================
// CUSTOM NODE COMPONENT - Retell AI Conversation Style
// ============================================================================

const CustomNode = memo(function CustomNode({ data, selected, id }: { data: any; selected?: boolean; id: string }) {
  // Derive contentMode directly from data - no local state duplication
  const contentMode = data.contentMode || 'prompt';
  const nodeConfig = getNodeConfig(data.type);
  const isStartNode = data.type === 'greeting';
  const isEndNode = data.type === 'end';
  
  // Get transitions from data or use defaults
  const transitions: Transition[] = data.transitions || nodeConfig?.defaultTransitions || [];
  
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) {
      data.onDelete(id);
    }
  }, [data.onDelete, id]);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    if (data.onUpdate) {
      data.onUpdate(id, { [fieldId]: value });
    }
  }, [data.onUpdate, id]);

  const handleContentModeChange = useCallback((mode: 'prompt' | 'static') => {
    if (data.onUpdate) {
      data.onUpdate(id, { contentMode: mode });
    }
  }, [data.onUpdate, id]);

  const handleTransitionConditionChange = useCallback((transitionId: string, newCondition: string) => {
    const currentTransitions = data.transitions || nodeConfig?.defaultTransitions || [];
    const updated = currentTransitions.map((tr: Transition) =>
      tr.id === transitionId ? { ...tr, condition: newCondition, label: newCondition || 'Describe the transition condition' } : tr
    );
    if (data.onUpdate) {
      data.onUpdate(id, { transitions: updated });
    }
  }, [data.onUpdate, data.transitions, nodeConfig?.defaultTransitions, id]);

  const handleAddTransition = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTransitions = data.transitions || nodeConfig?.defaultTransitions || [];
    const newTransition: Transition = {
      id: `t-${Date.now()}`,
      label: 'Describe the transition condition',
      condition: '',
      color: 'emerald',
    };
    const updated = [...currentTransitions, newTransition];
    if (data.onUpdate) {
      data.onUpdate(id, { transitions: updated });
    }
  }, [data.onUpdate, data.transitions, nodeConfig?.defaultTransitions, id]);

  const handleRemoveTransition = useCallback((e: React.MouseEvent, transitionId: string) => {
    e.stopPropagation();
    const currentTransitions = data.transitions || nodeConfig?.defaultTransitions || [];
    const updated = currentTransitions.filter((tr: Transition) => tr.id !== transitionId);
    if (data.onUpdate) {
      data.onUpdate(id, { transitions: updated });
    }
  }, [data.onUpdate, data.transitions, nodeConfig?.defaultTransitions, id]);
  
  return (
    <div className="group relative">
      {/* Left Handle - Entry point (not for start node) */}
      {!isStartNode && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-3 !h-3 !bg-white !border-2 !border-gray-300 dark:!border-gray-600 !-left-1.5 !rounded-full"
          id={`${id}-target`}
          isConnectable={true}
        />
      )}
      
      {/* Node Card */}
      <div 
        className={`
          w-[340px] rounded-xl transition-all duration-200
          ${selected 
            ? 'bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-gray-900 border-2 border-indigo-400 dark:border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' 
            : 'bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/20 dark:to-gray-900 border border-rose-100 dark:border-rose-900/30 shadow-sm hover:shadow-md'
          }
        `}
        data-testid={`flow-node-${data.type}`}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-rose-400 dark:text-rose-500" />
            {selected ? (
              <Input
                value={data.label || 'Conversation'}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="h-6 text-sm font-medium bg-transparent border-none p-0 focus-visible:ring-0 w-32 nodrag"
                placeholder="Conversation"
                data-testid="input-node-label"
              />
            ) : (
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {data.label || 'Conversation'}
              </span>
            )}
            {selected && (
              <span className="text-rose-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {selected && !isStartNode && (
              <button
                onClick={handleDelete}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                data-testid="button-delete-node"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {selected && (
              <button className="text-gray-400 hover:text-gray-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="6" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="18" r="2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content Mode Tabs - Only when selected */}
        {selected && (
          <div className="px-4 pb-2">
            <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
              <button
                onClick={(e) => { e.stopPropagation(); handleContentModeChange('prompt'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  contentMode === 'prompt' 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                data-testid="button-mode-prompt"
              >
                Prompt
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleContentModeChange('static'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  contentMode === 'static' 
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
                data-testid="button-mode-static"
              >
                Static Sentence
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="px-4 pb-3">
          <Textarea
            value={data.content || ''}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={contentMode === 'prompt' 
              ? (nodeConfig?.configFields?.[0]?.placeholder || "Enter AI prompt instructions...") 
              : "Enter the exact sentence to say..."
            }
            className={`min-h-[80px] resize-none text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg nodrag ${
              selected ? '' : 'pointer-events-none'
            }`}
            data-testid="input-node-content"
          />
        </div>
        
        {/* Transitions Section */}
        {!isEndNode && (
          <div className="border-t border-gray-100 dark:border-gray-800">
            {/* Transition Header */}
            <div className="px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span className="text-xs font-medium">Transition</span>
              </div>
              <button
                onClick={handleAddTransition}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                data-testid="button-add-transition"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            {/* Transition Items */}
            <div className="px-4 pb-3 space-y-2">
              {transitions.map((t, index) => (
                <div key={t.id} className="relative flex items-center gap-2 group/transition">
                  <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="19" cy="12" r="1" />
                      <circle cx="5" cy="12" r="1" />
                    </svg>
                    <Input
                      value={t.condition || ''}
                      onChange={(e) => handleTransitionConditionChange(t.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Describe the transition condition"
                      className="h-5 text-xs flex-1 bg-transparent border-none focus-visible:ring-0 p-0 text-gray-600 dark:text-gray-300 placeholder:text-gray-400 nodrag"
                      data-testid={`input-transition-${t.id}`}
                    />
                    {transitions.length > 1 && (
                      <button
                        onClick={(e) => handleRemoveTransition(e, t.id)}
                        className="opacity-0 group-hover/transition:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                        data-testid={`button-remove-transition-${t.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  
                  {/* Right Handle for this transition */}
                  <Handle 
                    type="source" 
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-white !border-2 !border-gray-300 dark:!border-gray-600 !rounded-full !relative !right-0 !top-0 !transform-none"
                    id={`${id}-${t.id}`}
                    isConnectable={true}
                    style={{ position: 'relative', right: 'auto', top: 'auto', transform: 'none' }}
                  />
                </div>
              ))}
              
              {/* Add first transition prompt if none exist */}
              {transitions.length === 0 && (
                <button
                  onClick={handleAddTransition}
                  className="w-full px-3 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 transition-colors"
                  data-testid="button-add-first-transition"
                >
                  + Add transition condition
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

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

// ============================================================================
// MAIN FLOW BUILDER COMPONENT
// ============================================================================

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('conversation');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  
  // Undo/Redo history
  const [history, setHistory] = useState<HistoryEntry[]>([cloneState(initialNodes, initialEdges)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const skipHistoryRef = useRef(false);

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

  // Debounced history push - only commit to history after changes settle
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingHistoryRef = useRef<{ nodes: Node[], edges: Edge[] } | null>(null);

  // Track changes for undo/redo with debouncing (800ms)
  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    
    const lastEntry = history[historyIndex];
    if (!lastEntry) return;
    
    // Only track structural changes (add/remove nodes/edges), not data changes
    const nodesChanged = nodes.length !== lastEntry.nodes.length || 
      JSON.stringify(nodes.map(n => n.id)) !== JSON.stringify(lastEntry.nodes.map(n => n.id));
    const edgesChanged = edges.length !== lastEntry.edges.length ||
      JSON.stringify(edges.map(e => e.id)) !== JSON.stringify(lastEntry.edges.map(e => e.id));
    
    if (nodesChanged || edgesChanged) {
      // Clear pending timeout and immediately push structural changes
      if (historyTimeoutRef.current) {
        clearTimeout(historyTimeoutRef.current);
        historyTimeoutRef.current = null;
      }
      
      const newEntry = cloneState(nodes, edges);
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(newEntry);
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        return newHistory;
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
  }, [nodes.length, edges.length]);

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
    (params: Connection) => {
      // Extract transition label from source node's transitions
      // sourceHandle format is "${nodeId}-${transitionId}"
      let edgeLabel = '';
      
      if (params.sourceHandle && params.source) {
        const sourceNode = nodes.find(n => n.id === params.source);
        const transitions = sourceNode?.data?.transitions as Array<{ id: string; condition?: string; label?: string }> | undefined;
        if (transitions && Array.isArray(transitions)) {
          // Parse transition ID by stripping the nodeId prefix
          // Format: "${nodeId}-${transitionId}" - strip "${nodeId}-" to get transitionId
          const prefix = `${params.source}-`;
          if (params.sourceHandle.startsWith(prefix)) {
            const transitionId = params.sourceHandle.slice(prefix.length);
            const transition = transitions.find(t => t.id === transitionId);
            if (transition) {
              edgeLabel = transition.condition || transition.label || '';
            }
          }
        }
      }
      
      setEdges((eds) => addEdge({ ...params, label: edgeLabel }, eds));
    },
    [setEdges, nodes],
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

  // Update and delete node functions
  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...newData } }
          : node
      )
    );
    
    // If transitions were updated, sync edge labels for any edges coming from this node
    if (newData.transitions && Array.isArray(newData.transitions)) {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.source === nodeId && edge.sourceHandle) {
            // Parse transition ID by stripping the nodeId prefix
            // Format: "${nodeId}-${transitionId}" - strip "${nodeId}-" to get transitionId
            const prefix = `${nodeId}-`;
            if (edge.sourceHandle.startsWith(prefix)) {
              const transitionId = edge.sourceHandle.slice(prefix.length);
              const transition = newData.transitions.find(
                (t: { id: string; condition?: string; label?: string }) => t.id === transitionId
              );
              if (transition) {
                const newLabel = transition.condition || transition.label || '';
                if (edge.label !== newLabel) {
                  return { ...edge, label: newLabel };
                }
              }
            }
          }
          return edge;
        })
      );
    }
  }, [setNodes, setEdges]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  }, [setNodes, setEdges, selectedNodeId]);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const nodeConfig = getNodeConfig(type);
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
          transitions: nodeConfig.defaultTransitions,
          agentId,
          onUpdate: updateNodeData,
          onDelete: deleteNode,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [agentId, screenToFlowPosition, setNodes, updateNodeData, deleteNode],
  );

  const handleSave = useCallback(async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave(nodes, edges);
        setLastSaved(new Date());
      } finally {
        setIsSaving(false);
      }
    }
  }, [nodes, edges, onSave]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  // Filter nodes based on search - keep all categories but filter their nodes
  const filteredCategories = nodeCategories.map(cat => ({
    ...cat,
    nodes: searchQuery.trim() 
      ? cat.nodes.filter(node =>
          node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : cat.nodes,
  }));

  // Inject callbacks into nodes
  useEffect(() => {
    const needsUpdate = nodes.some(n => typeof n.data.onUpdate !== 'function');
    if (needsUpdate) {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            onUpdate: updateNodeData,
            onDelete: deleteNode,
          },
        }))
      );
    }
  }, [nodes.length, setNodes, updateNodeData, deleteNode]);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-3" data-testid="flow-builder">
      {/* Left Panel - Node Library */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3" data-testid="node-library-panel">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              Node Library
            </CardTitle>
          </CardHeader>
          
          {/* Search */}
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-widgets"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-3 grid grid-cols-4 h-8">
              {nodeCategories.map((cat) => (
                <TabsTrigger 
                  key={cat.id} 
                  value={cat.id} 
                  className="text-[10px] px-1"
                  data-testid={`tab-${cat.id}`}
                >
                  {cat.label.slice(0, 4)}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <ScrollArea className="flex-1 px-3 pb-3 pt-2">
              {filteredCategories.map((category) => (
                <TabsContent key={category.id} value={category.id} className="mt-0 space-y-2">
                  {category.nodes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No nodes match your search</p>
                  ) : (
                    category.nodes.map((nodeType) => {
                      const Icon = nodeType.icon;
                      const colors = nodeColors[nodeType.color];
                      return (
                        <div
                          key={nodeType.type}
                          draggable
                          onDragStart={(event) => onDragStart(event, nodeType.type)}
                          className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 
                            hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 
                            dark:hover:border-gray-700 cursor-grab active:cursor-grabbing transition-all duration-150
                            hover:shadow-sm"
                          data-testid={`draggable-node-${nodeType.type}`}
                        >
                          <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center shadow-sm flex-shrink-0`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                              {nodeType.label}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                              {nodeType.subtitle}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        </Card>
      </div>

      {/* Center - Flow Canvas */}
      <div ref={reactFlowWrapper} className="flex-1 relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Gradient Background Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/20 to-slate-100 dark:from-gray-950 dark:via-indigo-950/10 dark:to-gray-900" />
        
        <ReactFlow
          nodes={nodes.map(n => ({ ...n, selected: n.id === selectedNodeId }))}
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
              className="h-7 w-7"
              onClick={handleUndo}
              disabled={!canUndo}
              data-testid="button-undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={handleRedo}
              disabled={!canRedo}
              data-testid="button-redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => zoomOut()}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => zoomIn()}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => fitView()}
              data-testid="button-fit-view"
            >
              <Maximize className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <Button 
              onClick={handleSave} 
              size="sm"
              className="h-7 gap-1.5 text-xs"
              disabled={isSaving}
              data-testid="button-save-flow"
            >
              {isSaving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              Save
            </Button>
          </Panel>

          {/* Save Status */}
          {lastSaved && (
            <Panel position="top-right" className="flex items-center gap-1.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Saved {lastSaved.toLocaleTimeString()}
            </Panel>
          )}

          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1} 
            color="#cbd5e1"
            className="dark:opacity-20"
          />
          
          {/* MiniMap */}
          <MiniMap 
            nodeColor={(node) => {
              const nodeConfig = getNodeConfig(node.data?.type as string);
              return nodeConfig ? nodeColors[nodeConfig.color].hex : '#6b7280';
            }}
            maskColor="rgba(0, 0, 0, 0.08)"
            className="!bg-white/90 dark:!bg-gray-900/90 !rounded-lg !border !border-gray-200 dark:!border-gray-700 !shadow-sm"
            style={{ width: 120, height: 80 }}
            pannable
            zoomable
          />
        </ReactFlow>
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
