import { useEffect, useState, useMemo, useCallback, useRef, DragEvent, memo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAgentEditorTour } from "@/components/onboarding-tour";
import type { Agent, KnowledgeBase } from "@shared/schema";
import { RetellWebClient } from "retell-client-js-sdk";
import type { Node, Edge, Connection, NodeTypes } from '@xyflow/react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ArrowLeft, 
  Save, 
  Settings, 
  Pencil,
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
  X,
  GitBranch,
  Play,
  Plus,
  Trash2,
  Mic,
  PhoneCall,
  PhoneOff,
  Hash,
  Keyboard,
  Repeat,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Volume2,
  Headphones,
  FileText,
  BarChart3,
  Languages,
  Send,
  MessageSquare,
  TestTube,
  MoreHorizontal,
  Share2,
  History,
  Upload,
  ArrowUpRight,
  Monitor,
  Minus,
  GripVertical,
  Maximize2,
  Check,
  AlertCircle,
  Info,
  HelpCircle,
} from "lucide-react";
import { VoiceSelector } from "@/components/voice-selector";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";

// ============================================================================
// NODE TYPE DEFINITIONS - Restaurant Industry Focused
// ============================================================================

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

interface Transition {
  id: string;
  label: string;
  color?: string;
  condition?: string;
}

interface NodeCategory {
  id: string;
  label: string;
  icon: any;
  nodes: NodeTypeConfig[];
}

interface NodeTypeConfig {
  type: string;
  label: string;
  subtitle: string;
  icon: any;
  color: keyof typeof nodeColors;
  defaultTransitions: Transition[];
}

// Restaurant-focused node categories matching Retell AI style
const nodeCategories: NodeCategory[] = [
  {
    id: 'conversation',
    label: 'Conversation',
    icon: MessageCircle,
    nodes: [
      {
        type: 'greeting',
        label: 'Welcome Node',
        subtitle: 'Start conversation',
        icon: Play,
        color: 'green',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
      },
      {
        type: 'response',
        label: 'Response',
        subtitle: 'AI speaks',
        icon: MessageCircle,
        color: 'blue',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
      },
      {
        type: 'collectInfo',
        label: 'Collect Input',
        subtitle: 'Gather info',
        icon: Mic,
        color: 'cyan',
        defaultTransitions: [
          { id: 'collected', label: 'Collected', color: 'emerald' },
          { id: 'failed', label: 'Failed', color: 'rose' },
        ],
      },
    ],
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    icon: ShoppingCart,
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
      },
      {
        type: 'takeOrder',
        label: 'Take Order',
        subtitle: 'Menu selection',
        icon: ShoppingCart,
        color: 'orange',
        defaultTransitions: [
          { id: 'orderComplete', label: 'Complete', color: 'emerald' },
          { id: 'addMore', label: 'Add More', color: 'blue' },
        ],
      },
      {
        type: 'menuInfo',
        label: 'Menu Info',
        subtitle: 'Describe items',
        icon: FileText,
        color: 'teal',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
      },
      {
        type: 'dietaryRestrictions',
        label: 'Dietary Info',
        subtitle: 'Allergies',
        icon: Users,
        color: 'purple',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
      },
    ],
  },
  {
    id: 'logic',
    label: 'Logic',
    icon: GitBranch,
    nodes: [
      {
        type: 'condition',
        label: 'Logic Split',
        subtitle: 'Branch logic',
        icon: GitBranch,
        color: 'purple',
        defaultTransitions: [
          { id: 'yes', label: 'Yes', color: 'emerald' },
          { id: 'no', label: 'No', color: 'rose' },
        ],
      },
      {
        type: 'wait',
        label: 'Wait',
        subtitle: 'Pause',
        icon: Clock,
        color: 'gray',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
      },
      {
        type: 'repeat',
        label: 'Loop Back',
        subtitle: 'Return',
        icon: Repeat,
        color: 'indigo',
        defaultTransitions: [{ id: 'next', label: 'Loop', color: 'blue' }],
      },
    ],
  },
  {
    id: 'telephony',
    label: 'Telephony',
    icon: Phone,
    nodes: [
      {
        type: 'transfer',
        label: 'Call Transfer',
        subtitle: 'Connect staff',
        icon: PhoneCall,
        color: 'pink',
        defaultTransitions: [
          { id: 'transferred', label: 'Done', color: 'emerald' },
          { id: 'failed', label: 'Failed', color: 'rose' },
        ],
      },
      {
        type: 'pressDigit',
        label: 'Press Digit',
        subtitle: 'DTMF',
        icon: Hash,
        color: 'cyan',
        defaultTransitions: [{ id: 'next', label: 'Pressed', color: 'emerald' }],
      },
      {
        type: 'sms',
        label: 'SMS',
        subtitle: 'Send text',
        icon: Send,
        color: 'blue',
        defaultTransitions: [{ id: 'next', label: 'Sent', color: 'emerald' }],
      },
      {
        type: 'end',
        label: 'Ending',
        subtitle: 'Hang up',
        icon: PhoneOff,
        color: 'red',
        defaultTransitions: [],
      },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: Plus,
    nodes: [
      {
        type: 'custom',
        label: 'Custom Node',
        subtitle: 'Build your own',
        icon: Plus,
        color: 'gray',
        defaultTransitions: [{ id: 'next', label: 'Continue', color: 'emerald' }],
      },
    ],
  },
];

const allNodeTypes = nodeCategories.flatMap(cat => cat.nodes);
function getNodeConfig(type: string): NodeTypeConfig | undefined {
  return allNodeTypes.find(n => n.type === type);
}

const transitionColors: Record<string, { bg: string; text: string; handle: string }> = {
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', handle: '!bg-emerald-500' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', handle: '!bg-rose-500' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', handle: '!bg-blue-500' },
};

// ============================================================================
// CUSTOM NODE COMPONENT - Retell AI Style
// ============================================================================

const CustomNode = memo(function CustomNode({ data, selected, id }: { data: any; selected?: boolean; id: string }) {
  const contentMode = data.contentMode || 'prompt';
  const nodeConfig = getNodeConfig(data.type);
  const isStartNode = data.type === 'greeting';
  const isEndNode = data.type === 'end';
  const transitions: Transition[] = data.transitions || nodeConfig?.defaultTransitions || [];
  
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onDelete) data.onDelete(id);
  }, [data.onDelete, id]);

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    if (data.onUpdate) data.onUpdate(id, { [fieldId]: value });
  }, [data.onUpdate, id]);

  const handleContentModeChange = useCallback((mode: 'prompt' | 'static') => {
    if (data.onUpdate) data.onUpdate(id, { contentMode: mode });
  }, [data.onUpdate, id]);

  const handleTransitionConditionChange = useCallback((transitionId: string, newCondition: string) => {
    const currentTransitions = data.transitions || nodeConfig?.defaultTransitions || [];
    const updated = currentTransitions.map((tr: Transition) =>
      tr.id === transitionId ? { ...tr, condition: newCondition, label: newCondition || 'Describe condition' } : tr
    );
    if (data.onUpdate) data.onUpdate(id, { transitions: updated });
  }, [data.onUpdate, data.transitions, nodeConfig?.defaultTransitions, id]);

  const handleAddTransition = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTransitions = data.transitions || nodeConfig?.defaultTransitions || [];
    const newTransition: Transition = { id: `t-${Date.now()}`, label: 'Describe condition', condition: '', color: 'emerald' };
    if (data.onUpdate) data.onUpdate(id, { transitions: [...currentTransitions, newTransition] });
  }, [data.onUpdate, data.transitions, nodeConfig?.defaultTransitions, id]);

  const handleRemoveTransition = useCallback((e: React.MouseEvent, transitionId: string) => {
    e.stopPropagation();
    const currentTransitions = data.transitions || nodeConfig?.defaultTransitions || [];
    if (data.onUpdate) data.onUpdate(id, { transitions: currentTransitions.filter((tr: Transition) => tr.id !== transitionId) });
  }, [data.onUpdate, data.transitions, nodeConfig?.defaultTransitions, id]);
  
  return (
    <div className="group relative">
      {!isStartNode && (
        <Handle 
          type="target" 
          position={Position.Left} 
          className="!w-3 !h-3 !bg-white !border-2 !border-gray-300 dark:!border-gray-600 !-left-1.5 !rounded-full"
          id={`${id}-target`}
          isConnectable={true}
        />
      )}
      
      <div 
        className={`w-[300px] rounded-xl transition-all duration-200 ${selected 
          ? 'bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-gray-900 border-2 border-indigo-400 dark:border-indigo-600 shadow-lg' 
          : 'bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/20 dark:to-gray-900 border border-rose-100 dark:border-rose-900/30 shadow-sm hover:shadow-md'
        }`}
        data-testid={`flow-node-${data.type}`}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-rose-400" />
            {selected ? (
              <Input
                value={data.label || nodeConfig?.label || 'Node'}
                onChange={(e) => handleFieldChange('label', e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="h-6 text-sm font-medium bg-transparent border-none p-0 focus-visible:ring-0 w-32 nodrag"
                data-testid="input-node-label"
              />
            ) : (
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {data.label || nodeConfig?.label || 'Node'}
              </span>
            )}
            {selected && <Pencil className="h-3 w-3 text-rose-400" />}
          </div>
          
          {selected && !isStartNode && (
            <button onClick={handleDelete} className="w-5 h-5 text-gray-400 hover:text-red-500" data-testid="button-delete-node">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {selected && (
          <div className="px-4 pb-2">
            <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg w-fit">
              <button
                onClick={(e) => { e.stopPropagation(); handleContentModeChange('prompt'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${contentMode === 'prompt' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}
              >
                Prompt
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleContentModeChange('static'); }}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${contentMode === 'static' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}
              >
                Static
              </button>
            </div>
          </div>
        )}

        <div className="px-4 pb-3">
          <Textarea
            value={data.content || ''}
            onChange={(e) => handleFieldChange('content', e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder={contentMode === 'prompt' ? "Enter AI prompt..." : "Enter exact sentence..."}
            className={`min-h-[60px] resize-none text-sm bg-white dark:bg-gray-800 border rounded-lg nodrag ${selected ? '' : 'pointer-events-none'}`}
            data-testid="input-node-content"
          />
        </div>
        
        {!isEndNode && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                Transition
              </span>
              {selected && transitions.length > 0 && (
                <button onClick={handleAddTransition} className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-0.5">
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>
            
            <div className="space-y-1.5 relative">
              {transitions.map((t) => {
                const colors = transitionColors[t.color || 'emerald'];
                return (
                  <div key={t.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${colors.bg} relative`}>
                    <ChevronRight className={`h-3 w-3 ${colors.text} flex-shrink-0`} />
                    {selected ? (
                      <Input
                        value={t.condition || t.label}
                        onChange={(e) => handleTransitionConditionChange(t.id, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 text-xs bg-transparent border-none p-0 focus-visible:ring-0 flex-1 nodrag"
                        placeholder="Describe condition"
                      />
                    ) : (
                      <span className={`text-xs ${colors.text} flex-1`}>{t.condition || t.label}</span>
                    )}
                    {selected && transitions.length > 1 && (
                      <button onClick={(e) => handleRemoveTransition(e, t.id)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    <Handle 
                      type="source" 
                      position={Position.Right}
                      className="!w-3 !h-3 !bg-white !border-2 !border-gray-300 !rounded-full !relative !right-0 !top-0 !transform-none"
                      id={`${id}-${t.id}`}
                      isConnectable={true}
                      style={{ position: 'relative', right: 'auto', top: 'auto', transform: 'none' }}
                    />
                  </div>
                );
              })}
              
              {transitions.length === 0 && (
                <button onClick={handleAddTransition} className="w-full px-3 py-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed">
                  + Add transition
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const nodeTypes: NodeTypes = { custom: CustomNode };

const defaultEdgeOptions = {
  type: 'smoothstep',
  style: { stroke: '#94a3b8', strokeWidth: 2 },
  markerEnd: { type: 'arrowclosed' as const, color: '#94a3b8', width: 20, height: 20 },
};

// ============================================================================
// SETTINGS PANEL SECTIONS
// ============================================================================

interface SettingsSectionProps {
  title: string;
  icon: any;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function SettingsSection({ title, icon: Icon, children, defaultOpen = false }: SettingsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b border-gray-100 dark:border-gray-800">
      <CollapsibleTrigger className="w-full flex items-center justify-between py-4 px-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-6 pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// MAIN AGENT EDITOR COMPONENT
// ============================================================================

interface HistoryEntry { nodes: Node[]; edges: Edge[]; }

function cloneState(nodes: Node[], edges: Edge[]): HistoryEntry {
  return {
    nodes: nodes.map(n => ({ ...n, data: { ...n.data }, position: { ...n.position } })),
    edges: edges.map(e => ({ ...e })),
  };
}

function buildDefaultPlaceholderFlow(agentId: string): { nodes: Node[]; edges: Edge[] } {
  const mkId = () => crypto.randomUUID();
  const y = 200;
  const spacing = 400;

  const ids = [mkId(), mkId(), mkId(), mkId(), mkId()];

  const nodes: Node[] = [
    {
      id: ids[0],
      type: 'custom',
      position: { x: 60, y },
      data: {
        agentId,
        type: 'greeting',
        label: 'Welcome Caller',
        content: "Thank you for calling! How can I help you today? I can assist with reservations, menu questions, hours, or anything else you need.",
        config: { contentMode: 'prompt', transitions: [{ id: 'continue', label: 'Continue', color: 'emerald' }] },
        transitions: [{ id: 'continue', label: 'Continue', color: 'emerald' }],
        contentMode: 'prompt',
      },
    },
    {
      id: ids[1],
      type: 'custom',
      position: { x: 60 + spacing, y },
      data: {
        agentId,
        type: 'response',
        label: 'Handle Request',
        content: "Listen carefully to the caller's request and respond helpfully. If they have a question about the menu, hours, or specials — answer it. If they need a reservation or want to place an order, guide them to the next step.",
        config: { contentMode: 'prompt', transitions: [{ id: 'needs_info', label: 'Needs Info', color: 'amber' }, { id: 'done', label: 'Done', color: 'emerald' }] },
        transitions: [{ id: 'needs_info', label: 'Needs Info', color: 'amber' }, { id: 'done', label: 'Done', color: 'emerald' }],
        contentMode: 'prompt',
      },
    },
    {
      id: ids[2],
      type: 'custom',
      position: { x: 60 + spacing * 2, y },
      data: {
        agentId,
        type: 'collectInfo',
        label: 'Collect Details',
        content: "Gather the caller's name, contact number, and any specific details required — such as party size, preferred date and time, or their order items.",
        config: { contentMode: 'prompt', variableName: 'caller_details', transitions: [{ id: 'collected', label: 'Details Collected', color: 'emerald' }, { id: 'retry', label: 'Retry', color: 'rose' }] },
        transitions: [{ id: 'collected', label: 'Details Collected', color: 'emerald' }, { id: 'retry', label: 'Retry', color: 'rose' }],
        contentMode: 'prompt',
      },
    },
    {
      id: ids[3],
      type: 'custom',
      position: { x: 60 + spacing * 3, y },
      data: {
        agentId,
        type: 'response',
        label: 'Confirm & Wrap Up',
        content: "Repeat the key details back to the caller to confirm everything is correct. Let them know what happens next — e.g. their reservation is booked, or their order is being prepared.",
        config: { contentMode: 'prompt', transitions: [{ id: 'confirmed', label: 'Confirmed', color: 'emerald' }] },
        transitions: [{ id: 'confirmed', label: 'Confirmed', color: 'emerald' }],
        contentMode: 'prompt',
      },
    },
    {
      id: ids[4],
      type: 'custom',
      position: { x: 60 + spacing * 4, y },
      data: {
        agentId,
        type: 'end',
        label: 'End Call',
        content: "Thank the caller warmly for getting in touch and wish them a great day. Let them know they can always call back if they need anything.",
        config: { contentMode: 'prompt', transitions: [] },
        transitions: [],
        contentMode: 'prompt',
      },
    },
  ];

  const edges: Edge[] = [
    { id: mkId(), source: ids[0], target: ids[1], sourceHandle: 'continue' },
    { id: mkId(), source: ids[1], target: ids[2], sourceHandle: 'needs_info' },
    { id: mkId(), source: ids[2], target: ids[3], sourceHandle: 'collected' },
    { id: mkId(), source: ids[3], target: ids[4], sourceHandle: 'confirmed' },
  ];

  return { nodes, edges };
}

function AgentEditorInner() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isNew = id === "new";
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { startAgentEditorTour } = useAgentEditorTour();
  const editorTourStartedRef = useRef(false);

  // Auto-start the agent editor tour once per user, after panels are rendered
  useEffect(() => {
    if (editorTourStartedRef.current) return;
    if (localStorage.getItem("agentEditorTourSeen")) return;
    editorTourStartedRef.current = true;
    const timer = setTimeout(() => {
      startAgentEditorTour();
    }, 1200);
    return () => clearTimeout(timer);
  }, [startAgentEditorTour]);

  // State
  const [activeTab, setActiveTab] = useState<"create" | "test">("create");
  const [agentName, setAgentName] = useState("New Agent");
  const [isEditingName, setIsEditingName] = useState(false);
  const [voiceSelectorOpen, setVoiceSelectorOpen] = useState(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState("Cimo");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedRef = useRef(false); // Track if initial data has loaded
  const isSavingRef = useRef(false); // Prevent concurrent saves
  const pendingSaveRef = useRef(false); // Track if there's a pending save request
  const isMountedRef = useRef(true); // Track component mount state
  const dataVersionRef = useRef(0); // Track data changes for debounce
  
  // Agent settings state
  const [language, setLanguage] = useState("en-US");
  const executionMode = "rigid";
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [backgroundSound, setBackgroundSound] = useState("none");
  const [responsiveness, setResponsiveness] = useState([1]);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState([0.6]);
  const [beginMessageDelay, setBeginMessageDelay] = useState([1000]);
  const [maxCallDuration, setMaxCallDuration] = useState([3600000]);
  const [inactivityTimeout, setInactivityTimeout] = useState([30000]);
  
  // Voice settings state
  const [voiceSpeed, setVoiceSpeed] = useState([1]);
  const [voiceTemperature, setVoiceTemperature] = useState([1]);
  const [voiceVolume, setVoiceVolume] = useState([1]);
  
  // Call configuration state
  const [repeatCustomerRecognition, setRepeatCustomerRecognition] = useState(true);
  const [voicemailDetection, setVoicemailDetection] = useState(false);
  const [warmTransferEnabled, setWarmTransferEnabled] = useState(false);
  const [warmTransferNumber, setWarmTransferNumber] = useState("");
  const [warmTransferMessage, setWarmTransferMessage] = useState("");
  
  // Hours of operation state
  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [hoursTimezone, setHoursTimezone] = useState("US/Pacific");
  const [hoursSchedule, setHoursSchedule] = useState<Record<string, { open: boolean; start: string; end: string }>>({
    monday: { open: true, start: '09:00', end: '22:00' },
    tuesday: { open: true, start: '09:00', end: '22:00' },
    wednesday: { open: true, start: '09:00', end: '22:00' },
    thursday: { open: true, start: '09:00', end: '22:00' },
    friday: { open: true, start: '09:00', end: '23:00' },
    saturday: { open: true, start: '10:00', end: '23:00' },
    sunday: { open: false, start: '10:00', end: '21:00' },
  });
  const [afterHoursMode, setAfterHoursMode] = useState("24_7");
  const [afterHoursMessage, setAfterHoursMessage] = useState("");
  
  // Track if greeting fetch is in progress to prevent duplicate requests
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);
  const greetingFetchedRef = useRef(false); // Tracks if greeting was already fetched for current agent
  
  // Test conversation state
  const [testMessages, setTestMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [testInput, setTestInput] = useState("");
  const [isTestLoading, setIsTestLoading] = useState(false);
  const [currentWorkflowNodeId, setCurrentWorkflowNodeId] = useState<string | null>(null);
  
  // Voice call state (using Retell Web SDK for real-time phone-quality calls)
  const [isInVoiceCall, setIsInVoiceCall] = useState(false);
  const [isVoiceCallConnecting, setIsVoiceCallConnecting] = useState(false);
  const [retellCallId, setRetellCallId] = useState<string | null>(null);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [voiceServiceDisabled, setVoiceServiceDisabled] = useState(false);
  const retellClientRef = useRef<RetellWebClient | null>(null);
  
  // Floating panel state - Settings panel (left)
  const [settingsPanelPos, setSettingsPanelPos] = useState({ x: 16, y: 16 });
  const [settingsPanelSize, setSettingsPanelSize] = useState({ width: 288, height: 0 }); // height 0 = auto
  const [settingsPanelMinimized, setSettingsPanelMinimized] = useState(false);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  
  // Floating panel state - Nodes panel (right)
  const [nodesPanelPos, setNodesPanelPos] = useState({ x: -1, y: 16 }); // -1 = right-aligned
  const [nodesPanelSize, setNodesPanelSize] = useState({ width: 256, height: 0 });
  const [nodesPanelMinimized, setNodesPanelMinimized] = useState(false);
  const nodesPanelRef = useRef<HTMLDivElement>(null);
  
  // Drag state - use refs for live tracking to avoid re-renders during drag
  const draggingPanelRef = useRef<'settings' | 'nodes' | null>(null);
  const resizingPanelRef = useRef<'settings' | 'nodes' | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panelX: 0, panelY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const rafRef = useRef<number | null>(null);
  
  // ReactFlow state - properly typed
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [voiceProvider, setVoiceProvider] = useState("elevenlabs");
  const [selectedVoiceId, setSelectedVoiceId] = useState("11labs-Adrian");
  const { screenToFlowPosition, zoomIn, zoomOut, fitView } = useReactFlow();
  
  // History for undo/redo - initialize with empty state
  const [history, setHistory] = useState<HistoryEntry[]>([{ nodes: [], edges: [] }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const skipHistoryRef = useRef(false);
  const placeholderFlowSetRef = useRef(false);
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Queries
  const { data: agent, isLoading } = useQuery<Agent>({
    queryKey: ["/api/agents", id],
    enabled: isAuthenticated && !isNew,
  });

  const { data: flowNodesData = [], isLoading: isLoadingFlowNodes } = useQuery<any[]>({
    queryKey: ["/api/agents", id, "flow-nodes"],
    enabled: isAuthenticated && !isNew,
  });

  const { data: flowConnectionsData = [], isLoading: isLoadingFlowConnections } = useQuery<any[]>({
    queryKey: ["/api/agents", id, "flow-connections"],
    enabled: isAuthenticated && !isNew,
  });

  const { data: knowledgeBases = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/agents", id, "knowledge"],
    enabled: isAuthenticated && !isNew,
  });
  
  // Fetch all knowledge bases for the dropdown
  const { data: allKnowledgeBases = [] } = useQuery<KnowledgeBase[]>({
    queryKey: ["/api/knowledge"],
    enabled: isAuthenticated,
  });
  
  // State for knowledge base popover
  const [kbPopoverOpen, setKbPopoverOpen] = useState(false);

  // Load agent data
  useEffect(() => {
    if (agent) {
      setAgentName(agent.name);
      setLanguage(agent.language || "en-US");
      setGlobalPrompt(agent.systemPrompt || "");
      setAiModel(agent.aiModel || "gpt-4o-mini");
      setSelectedVoiceName(agent.voiceName || "Cimo");
      setResponsiveness([(agent as any).responsiveness ? parseFloat((agent as any).responsiveness) : 1]);
      setInterruptionSensitivity([agent.interruptionSensitivity ? parseFloat(agent.interruptionSensitivity) : 0.6]);
      setBackgroundSound((agent as any).ambientSound || "none");
      // Voice settings
      setVoiceProvider(agent.voiceProvider || "elevenlabs");
      setSelectedVoiceId(agent.voiceId || "11labs-Adrian");
      setVoiceSpeed([parseFloat(agent.voiceSpeed || "1")]);
      setVoiceTemperature([parseFloat(agent.voiceTemperature || "1")]);
      setVoiceVolume([parseFloat(agent.voiceVolume || "1")]);
      // Call settings
      setBeginMessageDelay([parseInt(agent.beginMessageDelayMs || "1000")]);
      setMaxCallDuration([parseInt(agent.maxCallDurationMs || "3600000")]);
      setInactivityTimeout([parseInt(agent.inactivityTimeoutMs || "30000")]);
      setRepeatCustomerRecognition(agent.repeatCustomerRecognition !== false);
      setVoicemailDetection(agent.voicemailDetection || false);
      const warmEnabled = agent.warmTransferEnabled || false;
      setWarmTransferEnabled(warmEnabled);
      // Only populate warm transfer fields if enabled
      setWarmTransferNumber(warmEnabled ? (agent.warmTransferNumber || "") : "");
      setWarmTransferMessage(warmEnabled ? (agent.warmTransferMessage || "") : "");
      // Hours of operation
      const bh = agent.businessHours as any;
      if (bh && bh.enabled) {
        setHoursEnabled(true);
        if (bh.schedule) setHoursSchedule(bh.schedule);
      } else {
        setHoursEnabled(false);
      }
      setHoursTimezone(agent.timezone || "US/Pacific");
      setAfterHoursMode(agent.afterHoursMode || "24_7");
      setAfterHoursMessage(agent.afterHoursMessage || "");
    }
  }, [agent]);
  
  // Mark as loaded only after ALL initial data is loaded (agent + flow nodes + flow connections)
  useEffect(() => {
    // Only set hasLoaded after ALL initial data queries have completed
    const allQueriesComplete = !isLoading && !isLoadingFlowNodes && !isLoadingFlowConnections;
    if (!isNew && agent && allQueriesComplete) {
      // Wait a tick to ensure state has settled after loading
      const timer = setTimeout(() => {
        hasLoadedRef.current = true;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [agent, isLoading, isLoadingFlowNodes, isLoadingFlowConnections, isNew]);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  // Load flow nodes — show pre-built placeholder flow when canvas is empty
  useEffect(() => {
    if (flowNodesData.length > 0) {
      placeholderFlowSetRef.current = true; // real data loaded, mark as done
      const loadedNodes = flowNodesData.map((node) => {
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
      setNodes(loadedNodes);
      setHistory([cloneState(loadedNodes, [])]);
      setHistoryIndex(0);
    } else if (!isLoadingFlowNodes && !isNew && id) {
      // Canvas is empty — show a default starter flow, but only once
      if (placeholderFlowSetRef.current) return;
      placeholderFlowSetRef.current = true;
      const { nodes: defaultNodes, edges: defaultEdges } = buildDefaultPlaceholderFlow(id);
      setNodes(defaultNodes);
      setEdges(defaultEdges);
      setHistory([cloneState(defaultNodes, defaultEdges)]);
      setHistoryIndex(0);
      // Fit the viewport to show all default nodes after render
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowNodesData, isLoadingFlowNodes, isNew, id]);

  useEffect(() => {
    if (flowConnectionsData.length > 0) {
      const loadedEdges = flowConnectionsData.map((conn) => ({
        id: conn.id,
        source: conn.sourceNodeId,
        target: conn.targetNodeId,
        sourceHandle: conn.sourceHandle || undefined,
        label: conn.label,
      }));
      setEdges(loadedEdges);
    }
  }, [flowConnectionsData, setEdges]);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({ title: "Unauthorized", description: "Please log in.", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isNew) {
        return await apiRequest("POST", "/api/agents", { ...data, userId: user?.id });
      } else {
        return await apiRequest("PATCH", `/api/agents/${id}`, data);
      }
    },
    onSuccess: (data: Agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Success", description: "Agent saved successfully" });
      if (isNew) navigate(`/agents/${data.id}`);
      setLastSaved(new Date());
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", variant: "destructive" });
        return;
      }
      toast({ title: "Error", description: "Failed to save agent", variant: "destructive" });
    },
  });

  const saveFlowMutation = useMutation({
    mutationFn: async ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      const dbNodes = nodes.map((node) => {
        const existingConfig = (node.data.config || {}) as Record<string, any>;
        const transitions = node.data.transitions ?? existingConfig.transitions ?? [];
        const contentMode = node.data.contentMode ?? existingConfig.contentMode ?? 'prompt';
        return {
          id: node.id,
          agentId: id,
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
        agentId: id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        label: edge.label || '',
      }));
      await apiRequest("POST", `/api/agents/${id}/flow-nodes/bulk`, { nodes: dbNodes });
      await apiRequest("POST", `/api/agents/${id}/flow-connections/bulk`, { connections: dbEdges });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", id, "flow-nodes"] });
      setLastSaved(new Date());
    },
  });

  // Core save function (called by debounce or pending trigger)
  const executeSave = useCallback(async () => {
    if (isNew || !isMountedRef.current) return;
    
    isSavingRef.current = true;
    pendingSaveRef.current = false;
    setAutoSaveStatus('saving');
    
    try {
      // Save agent settings
      await apiRequest("PATCH", `/api/agents/${id}`, {
        name: agentName,
        language,
        systemPrompt: globalPrompt,
        aiModel,
        voiceName: selectedVoiceName,
        voiceProvider,
        voiceId: selectedVoiceId,
        voiceSpeed: voiceSpeed[0].toString(),
        voiceTemperature: voiceTemperature[0].toString(),
        voiceVolume: voiceVolume[0].toString(),
        responsiveness: responsiveness[0].toString(),
        interruptionSensitivity: interruptionSensitivity[0].toString(),
        ambientSound: backgroundSound,
        beginMessageDelayMs: beginMessageDelay[0].toString(),
        maxCallDurationMs: maxCallDuration[0].toString(),
        inactivityTimeoutMs: inactivityTimeout[0].toString(),
        repeatCustomerRecognition,
        voicemailDetection,
        warmTransferEnabled,
        warmTransferNumber: warmTransferEnabled ? warmTransferNumber : null,
        warmTransferMessage: warmTransferEnabled ? warmTransferMessage : null,
        timezone: hoursTimezone,
        businessHours: { enabled: hoursEnabled, schedule: hoursSchedule },
        afterHoursMode,
        afterHoursMessage: afterHoursMode === 'custom' ? afterHoursMessage : null,
      });
      
      // Save flow nodes and connections (include transitions and contentMode in config)
      const dbNodes = nodes.map((node) => {
        const existingConfig = (node.data.config || {}) as Record<string, any>;
        const transitions = node.data.transitions ?? existingConfig.transitions ?? [];
        const contentMode = node.data.contentMode ?? existingConfig.contentMode ?? 'prompt';
        return {
          id: node.id,
          agentId: id,
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
        agentId: id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        label: edge.label || '',
      }));
      await apiRequest("POST", `/api/agents/${id}/flow-nodes/bulk`, { nodes: dbNodes });
      await apiRequest("POST", `/api/agents/${id}/flow-connections/bulk`, { connections: dbEdges });
      
      if (!isMountedRef.current) return;
      
      setAutoSaveStatus('saved');
      setLastSaved(new Date());
      
      // Reset status after 2 seconds with cleanup
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setAutoSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Auto-save failed:', error);
      if (!isMountedRef.current) return;
      
      setAutoSaveStatus('error');
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      statusTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setAutoSaveStatus('idle');
      }, 3000);
    } finally {
      isSavingRef.current = false;
    }
  }, [id, isNew, agentName, language, globalPrompt, aiModel, selectedVoiceName, voiceProvider, selectedVoiceId, voiceSpeed, voiceTemperature, voiceVolume, responsiveness, interruptionSensitivity, backgroundSound, beginMessageDelay, maxCallDuration, inactivityTimeout, repeatCustomerRecognition, voicemailDetection, warmTransferEnabled, warmTransferNumber, warmTransferMessage, hoursEnabled, hoursTimezone, hoursSchedule, afterHoursMode, afterHoursMessage, nodes, edges]);
  
  // Debounced auto-save trigger that handles concurrency properly
  const triggerAutoSave = useCallback(() => {
    if (isNew || !hasLoadedRef.current) return;
    
    // If currently saving, mark as pending and let the save complete hook re-trigger
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    
    // Clear existing timer and set new one
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && hasLoadedRef.current) {
        executeSave();
      }
    }, 1500); // 1.5 second debounce
  }, [isNew, executeSave]);
  
  // Effect to re-trigger auto-save after a save completes if there were pending changes
  useEffect(() => {
    // When isSaving becomes false and there's a pending save, re-trigger
    if (!isSavingRef.current && pendingSaveRef.current && hasLoadedRef.current && !isNew) {
      pendingSaveRef.current = false;
      // Schedule with fresh state
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && hasLoadedRef.current) {
          executeSave();
        }
      }, 500); // Shorter delay for pending saves
    }
  }, [autoSaveStatus, isNew, executeSave]); // Triggered when autoSaveStatus changes (especially from 'saving' to 'saved')

  // Auto-save effect - triggers on any change with proper debounce
  useEffect(() => {
    if (!hasLoadedRef.current || isNew) return;
    
    // Use the debounced trigger which handles concurrency
    triggerAutoSave();
    
  }, [agentName, language, globalPrompt, aiModel, selectedVoiceName, voiceProvider, selectedVoiceId, voiceSpeed, voiceTemperature, voiceVolume, responsiveness, interruptionSensitivity, backgroundSound, beginMessageDelay, maxCallDuration, inactivityTimeout, repeatCustomerRecognition, voicemailDetection, warmTransferEnabled, warmTransferNumber, warmTransferMessage, hoursEnabled, hoursTimezone, hoursSchedule, afterHoursMode, afterHoursMessage, nodes, edges, triggerAutoSave, isNew]);

  // Handlers
  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node));
  }, [setNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [setNodes, setEdges, selectedNodeId]);

  const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  const onNodeClick = useCallback((_event: any, node: Node) => setSelectedNodeId(node.id), []);
  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);

  const onDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    if (!type) return;
    const nodeConfig = getNodeConfig(type);
    if (!nodeConfig) return;
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const newNode: Node = {
      id: crypto.randomUUID(),
      type: 'custom',
      position,
      data: { type, label: nodeConfig.label, content: '', transitions: nodeConfig.defaultTransitions, agentId: id, onUpdate: updateNodeData, onDelete: deleteNode },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [id, screenToFlowPosition, setNodes, updateNodeData, deleteNode]);

  const onDragStart = (event: DragEvent<HTMLDivElement>, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

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

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Include all required fields with sensible defaults for new agents
      const agentData: Record<string, any> = {
        name: agentName,
        language,
        systemPrompt: globalPrompt || "You are a helpful restaurant AI assistant. Help customers with reservations, orders, and inquiries.",
        aiModel,
        voiceName: selectedVoiceName,
        voiceProvider,
        voiceId: selectedVoiceId,
        voiceSpeed: voiceSpeed[0].toString(),
        voiceTemperature: voiceTemperature[0].toString(),
        voiceVolume: voiceVolume[0].toString(),
        responsiveness: responsiveness[0].toString(),
        interruptionSensitivity: interruptionSensitivity[0].toString(),
        ambientSound: backgroundSound,
        beginMessageDelayMs: beginMessageDelay[0].toString(),
        maxCallDurationMs: maxCallDuration[0].toString(),
        inactivityTimeoutMs: inactivityTimeout[0].toString(),
        repeatCustomerRecognition,
        voicemailDetection,
        warmTransferEnabled,
        warmTransferNumber: warmTransferEnabled ? warmTransferNumber : null,
        warmTransferMessage: warmTransferEnabled ? warmTransferMessage : null,
        timezone: hoursTimezone,
        businessHours: { enabled: hoursEnabled, schedule: hoursSchedule },
        afterHoursMode,
        afterHoursMessage: afterHoursMode === 'custom' ? afterHoursMessage : null,
      };
      
      // Add required fields with defaults for new agents
      if (isNew) {
        agentData.industry = "casual_dining";
        agentData.greetingMessage = "Hello! Thank you for calling. How can I help you today?";
        agentData.personality = "friendly";
      }
      
      const savedAgent = await saveMutation.mutateAsync(agentData);
      
      // Only save flow for existing agents (new agents need to redirect first)
      if (!isNew) {
        await saveFlowMutation.mutateAsync({ nodes, edges });
      }
    } finally {
      setIsSaving(false);
    }
  }, [agentName, language, globalPrompt, aiModel, selectedVoiceName, voiceProvider, selectedVoiceId, voiceSpeed, voiceTemperature, voiceVolume, responsiveness, interruptionSensitivity, backgroundSound, beginMessageDelay, maxCallDuration, inactivityTimeout, repeatCustomerRecognition, voicemailDetection, warmTransferEnabled, warmTransferNumber, warmTransferMessage, hoursEnabled, hoursTimezone, hoursSchedule, afterHoursMode, afterHoursMessage, nodes, edges, saveMutation, saveFlowMutation, isNew]);

  // Initialize chat when switching to test tab - fetch greeting once
  useEffect(() => {
    // Only fetch if: on test tab, no messages yet, not already loading, not already fetched, valid agent
    if (activeTab === "test" && testMessages.length === 0 && !isGreetingLoading && !greetingFetchedRef.current && !isNew && id) {
      greetingFetchedRef.current = true; // Mark as fetched immediately to prevent duplicate calls
      setIsGreetingLoading(true);
      
      apiRequest<{ greeting: string }>("POST", `/api/agents/${id}/start-chat`, {})
        .then(data => {
          if (data?.greeting) {
            setTestMessages([{ role: 'assistant', content: data.greeting }]);
          }
        })
        .catch(error => {
          console.error("Failed to load agent greeting:", error);
          greetingFetchedRef.current = false; // Allow retry on error
        })
        .finally(() => {
          setIsGreetingLoading(false);
        });
    }
  }, [activeTab, testMessages.length, isGreetingLoading, isNew, id]);

  // Reset chat when agent changes
  useEffect(() => {
    setTestMessages([]);
    setCurrentWorkflowNodeId(null); // Reset workflow state
    setIsGreetingLoading(false);
    greetingFetchedRef.current = false; // Reset ref when agent changes
  }, [id]);


  // Clear warm transfer fields when toggle is turned off
  const handleWarmTransferToggle = useCallback((enabled: boolean) => {
    setWarmTransferEnabled(enabled);
    if (!enabled) {
      setWarmTransferNumber("");
      setWarmTransferMessage("");
    }
  }, []);

  // Test conversation handler
  const handleSendTestMessage = useCallback(async () => {
    if (!testInput.trim() || isTestLoading) return;
    
    const userMessage = testInput.trim();
    setTestInput("");
    setTestMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTestLoading(true);
    
    try {
      const data = await apiRequest<{ response: string; currentNodeId: string | null }>("POST", `/api/agents/${id}/test`, {
        message: userMessage,
        history: testMessages,
        currentNodeId: currentWorkflowNodeId,
      });
      if (data?.response) {
        setTestMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        // Update workflow node ID for next message
        if (data.currentNodeId !== undefined) {
          setCurrentWorkflowNodeId(data.currentNodeId);
        }
      } else {
        toast({ title: "Error", description: "No response received", variant: "destructive" });
      }
    } catch (error) {
      console.error("Test message error:", error);
      toast({ title: "Error", description: "Failed to get response", variant: "destructive" });
    } finally {
      setIsTestLoading(false);
    }
  }, [testInput, testMessages, isTestLoading, id, currentWorkflowNodeId, toast]);

  // Voice call - start call using Retell Web SDK for real-time, phone-quality experience
  const startVoiceCall = useCallback(async () => {
    if (isNew || !id || !user) return;
    
    setIsVoiceCallConnecting(true);
    // Clear previous voice transcript when starting new call
    setVoiceTranscript([]);
    // Reset disabled state to allow fresh check
    setVoiceServiceDisabled(false);
    
    try {
      // Get web call access token from our API (auto-syncs agent to Retell if needed)
      const response = await apiRequest("POST", `/api/agents/${id}/web-call`);
      
      // Check for error response
      if (!response || typeof response !== 'object') {
        throw new Error("Invalid response from server");
      }
      
      const { callId, accessToken, message } = response as { callId?: string; accessToken?: string; message?: string };
      
      if (!accessToken || !callId) {
        throw new Error(message || "Voice service not available");
      }
      
      // Initialize Retell Web Client
      const retellClient = new RetellWebClient();
      
      // Set up event handlers for real-time transcript updates
      retellClient.on("call_started", () => {
        console.log('[RetellVoice] Call started');
        setIsInVoiceCall(true);
        setIsVoiceCallConnecting(false);
        setRetellCallId(callId);
        // Only store client after successful start
        retellClientRef.current = retellClient;
      });
      
      retellClient.on("call_ended", () => {
        console.log('[RetellVoice] Call ended');
        setIsInVoiceCall(false);
        setIsVoiceCallConnecting(false);
        setRetellCallId(null);
        setIsAgentSpeaking(false);
        retellClientRef.current = null;
      });
      
      retellClient.on("agent_start_talking", () => {
        setIsAgentSpeaking(true);
      });
      
      retellClient.on("agent_stop_talking", () => {
        setIsAgentSpeaking(false);
      });
      
      retellClient.on("update", (update: any) => {
        // Real-time transcript updates - use separate voice transcript state
        if (update.transcript && update.transcript.length > 0) {
          const transcriptEntries = update.transcript;
          
          // Update voice transcript (separate from text test messages)
          const newTranscript: Array<{role: 'user' | 'assistant', content: string}> = [];
          for (const entry of transcriptEntries) {
            if (entry.content) {
              newTranscript.push({
                role: entry.role === 'agent' ? 'assistant' : 'user',
                content: entry.content
              });
            }
          }
          
          if (newTranscript.length > 0) {
            setVoiceTranscript(newTranscript);
          }
        }
      });
      
      retellClient.on("error", (error: any) => {
        console.error('[RetellVoice] Error:', error);
        toast({ title: "Voice Call Error", description: error.message || "An error occurred during the call", variant: "destructive" });
        setIsInVoiceCall(false);
        setIsVoiceCallConnecting(false);
        retellClientRef.current = null;
      });
      
      // Start the call with the access token
      await retellClient.startCall({
        accessToken: accessToken,
        sampleRate: 24000, // Retell's recommended sample rate
      });
      
    } catch (error: any) {
      console.error('[RetellVoice] Error starting call:', error);
      setIsVoiceCallConnecting(false);
      retellClientRef.current = null;
      
      const errorMessage = error.message || '';
      
      // Check if this is a service disabled response (501 with disabled flag)
      let isServiceDisabled = false;
      if (errorMessage.startsWith('501:')) {
        try {
          const jsonPart = errorMessage.substring(errorMessage.indexOf(':') + 1).trim();
          const parsed = JSON.parse(jsonPart);
          isServiceDisabled = parsed.disabled === true;
        } catch {
          // Fallback to string matching if JSON parsing fails
          isServiceDisabled = errorMessage.includes('not currently available') || errorMessage.includes('disabled');
        }
      }
      
      if (errorMessage.includes('Microphone')) {
        toast({ title: "Microphone Access Required", description: "Please allow microphone access to use voice testing", variant: "destructive" });
      } else if (isServiceDisabled) {
        // Graceful degradation: set disabled state, no toast (inline notice shown instead)
        setVoiceServiceDisabled(true);
      } else {
        toast({ title: "Error", description: errorMessage || "Failed to start voice call", variant: "destructive" });
      }
    }
  }, [isNew, id, user, toast]);

  // Voice call - stop call
  const stopVoiceCall = useCallback(() => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
      retellClientRef.current = null;
    }
    
    setIsInVoiceCall(false);
    setIsVoiceCallConnecting(false);
    setRetellCallId(null);
    setIsAgentSpeaking(false);
  }, []);

  // Cleanup voice call on unmount
  useEffect(() => {
    return () => {
      stopVoiceCall();
    };
  }, [stopVoiceCall]);

  // Inject callbacks into nodes
  useEffect(() => {
    const needsUpdate = nodes.some(n => typeof n.data.onUpdate !== 'function');
    if (needsUpdate) {
      setNodes((nds) => nds.map((node) => ({ ...node, data: { ...node.data, onUpdate: updateNodeData, onDelete: deleteNode } })));
    }
  }, [nodes.length, setNodes, updateNodeData, deleteNode]);

  // Track history changes - push state when nodes/edges change
  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      return;
    }
    // Don't record on initial mount or when history hasn't been initialized yet
    if (nodes.length === 0 && edges.length === 0 && historyIndex === 0) return;
    
    const currentState = cloneState(nodes, edges);
    const lastState = history[historyIndex];
    
    // Only push if something actually changed
    const nodesChanged = JSON.stringify(currentState.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data }))) !== 
                        JSON.stringify(lastState?.nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })));
    const edgesChanged = JSON.stringify(currentState.edges) !== JSON.stringify(lastState?.edges);
    
    if (nodesChanged || edgesChanged) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [nodes, edges]);

  // Panel drag handlers - use direct DOM manipulation for performance
  const handlePanelDragStart = useCallback((panel: 'settings' | 'nodes', e: React.MouseEvent) => {
    e.preventDefault();
    draggingPanelRef.current = panel;
    const pos = panel === 'settings' ? settingsPanelPos : nodesPanelPos;
    dragStartRef.current = { x: e.clientX, y: e.clientY, panelX: pos.x, panelY: pos.y };
    
    const panelEl = panel === 'settings' ? settingsPanelRef.current : nodesPanelRef.current;
    if (panelEl) {
      panelEl.style.transition = 'none';
      panelEl.classList.add('cursor-grabbing', 'shadow-2xl');
    }
  }, [settingsPanelPos, nodesPanelPos]);

  const handlePanelResizeStart = useCallback((panel: 'settings' | 'nodes', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingPanelRef.current = panel;
    const size = panel === 'settings' ? settingsPanelSize : nodesPanelSize;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
    
    const panelEl = panel === 'settings' ? settingsPanelRef.current : nodesPanelRef.current;
    if (panelEl) {
      panelEl.style.transition = 'none';
    }
  }, [settingsPanelSize, nodesPanelSize]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      
      rafRef.current = requestAnimationFrame(() => {
        if (draggingPanelRef.current) {
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          const newX = Math.max(0, dragStartRef.current.panelX + dx);
          const newY = Math.max(0, dragStartRef.current.panelY + dy);
          
          const panelEl = draggingPanelRef.current === 'settings' 
            ? settingsPanelRef.current 
            : nodesPanelRef.current;
          
          if (panelEl) {
            panelEl.style.left = `${newX}px`;
            panelEl.style.top = `${newY}px`;
            panelEl.style.right = 'auto';
          }
        }
        
        if (resizingPanelRef.current) {
          const dx = e.clientX - resizeStartRef.current.x;
          const dy = e.clientY - resizeStartRef.current.y;
          const newWidth = Math.max(200, Math.min(500, resizeStartRef.current.width + dx));
          const newHeight = resizeStartRef.current.height + dy;
          
          const panelEl = resizingPanelRef.current === 'settings' 
            ? settingsPanelRef.current 
            : nodesPanelRef.current;
          
          if (panelEl) {
            panelEl.style.width = `${newWidth}px`;
            if (newHeight > 100) {
              panelEl.style.height = `${newHeight}px`;
            }
          }
        }
      });
    };

    const handleMouseUp = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      
      // Commit final position to state
      if (draggingPanelRef.current) {
        const panelEl = draggingPanelRef.current === 'settings' 
          ? settingsPanelRef.current 
          : nodesPanelRef.current;
        
        if (panelEl) {
          const left = parseInt(panelEl.style.left) || 0;
          const top = parseInt(panelEl.style.top) || 0;
          
          if (draggingPanelRef.current === 'settings') {
            setSettingsPanelPos({ x: left, y: top });
          } else {
            setNodesPanelPos({ x: left, y: top });
          }
          
          panelEl.style.transition = '';
          panelEl.classList.remove('cursor-grabbing', 'shadow-2xl');
        }
      }
      
      // Commit final size to state
      if (resizingPanelRef.current) {
        const panelEl = resizingPanelRef.current === 'settings' 
          ? settingsPanelRef.current 
          : nodesPanelRef.current;
        
        if (panelEl) {
          const width = parseInt(panelEl.style.width) || 200;
          const height = parseInt(panelEl.style.height) || 0;
          
          if (resizingPanelRef.current === 'settings') {
            setSettingsPanelSize({ width, height: height > 100 ? height : 0 });
          } else {
            setNodesPanelSize({ width, height: height > 100 ? height : 0 });
          }
          
          panelEl.style.transition = '';
        }
      }
      
      draggingPanelRef.current = null;
      resizingPanelRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Filter nodes
  const filteredCategories = nodeCategories.map(cat => ({
    ...cat,
    nodes: searchQuery.trim() ? cat.nodes.filter(node => node.label.toLowerCase().includes(searchQuery.toLowerCase()) || node.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) : cat.nodes,
  }));

  if (authLoading || isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background overflow-hidden" data-testid="agent-editor">
      {/* Header Bar */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="flex items-center gap-4">
          <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9" />
          
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                className="h-8 w-48 text-base font-medium"
                autoFocus
                data-testid="input-agent-name"
              />
            ) : (
              <button onClick={() => setIsEditingName(true)} className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded">
                <span className="text-base font-medium">{agentName}</span>
                <Pencil className="h-3.5 w-3.5 text-gray-400" />
              </button>
            )}
          </div>

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("create")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "create" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              data-testid="tab-create"
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab("test")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === "test" ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              data-testid="tab-test"
            >
              Test
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Auto saved at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={startAgentEditorTour}
            data-testid="button-agent-editor-tour"
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            How it works
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2" data-testid="button-publish">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Sidebar - Agent Settings - Floating Panel (only shown in Create mode) */}
        {activeTab === "create" && (
        <div 
          ref={settingsPanelRef}
          data-testid="agent-settings-panel"
          className="absolute z-10 bg-white dark:bg-gray-900 flex flex-col overflow-hidden rounded-xl shadow-lg border transition-all"
          style={{
            left: settingsPanelPos.x,
            top: settingsPanelPos.y,
            width: settingsPanelSize.width,
            height: settingsPanelMinimized ? 'auto' : (settingsPanelSize.height > 0 ? settingsPanelSize.height : 'calc(100% - 32px)'),
            maxHeight: settingsPanelMinimized ? 'auto' : 'calc(100% - 32px)',
          }}
        >
          <div 
            className="p-3 border-b flex items-center justify-between cursor-grab select-none"
            onMouseDown={(e) => handlePanelDragStart('settings', e)}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-sm">Global Settings</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSettingsPanelMinimized(!settingsPanelMinimized)}
                data-testid="settings-panel-minimize"
              >
                {settingsPanelMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          
          {!settingsPanelMinimized && (
          <ScrollArea className="flex-1">
            <div className="pb-4">
              <SettingsSection title="Agent Settings" icon={Settings} defaultOpen={true}>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">Voice & Language</label>
                    <div className="flex gap-2">
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="flex-1 h-9">
                          <div className="flex items-center gap-2">
                            <Languages className="h-4 w-4" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-US">English</SelectItem>
                          <SelectItem value="es-ES">Spanish</SelectItem>
                          <SelectItem value="fr-FR">French</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setVoiceSelectorOpen(true)}>
                        <Volume2 className="h-4 w-4" />
                        {selectedVoiceName}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium" data-testid="text-returning-caller-label">Returning Caller Recognition</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center justify-center h-4 w-4 rounded-full border text-muted-foreground cursor-help flex-shrink-0"
                                tabIndex={0}
                                data-testid="info-returning-caller"
                              >
                                <Info className="h-3 w-3" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              When enabled, the agent will recognize returning callers by their phone number. It will greet them by name, reference their previous orders, recommend their favorites, and provide a personalized experience based on their call history.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-xs text-muted-foreground">Recognize regulars by phone number and personalize their experience</p>
                      </div>
                    </div>
                    <Switch
                      checked={repeatCustomerRecognition}
                      onCheckedChange={setRepeatCustomerRecognition}
                      data-testid="switch-returning-caller"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">Global Prompt</label>
                    <div className="flex items-center gap-2 mb-2">
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={globalPrompt}
                      onChange={(e) => setGlobalPrompt(e.target.value)}
                      placeholder="Enter your global prompt here"
                      className="min-h-[80px] text-sm"
                      data-testid="input-global-prompt"
                    />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Knowledge Base" icon={FileText}>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Add knowledge base to provide context to the agent.
                  </p>
                  <Popover open={kbPopoverOpen} onOpenChange={setKbPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2" 
                        data-testid="button-add-knowledge-base"
                      >
                        <Plus className="h-4 w-4" /> Add
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="start">
                      <div className="max-h-[300px] overflow-y-auto">
                        {/* Get unique knowledge base names from all entries */}
                        {(() => {
                          const uniqueNames = Array.from(new Set(allKnowledgeBases.map(kb => kb.question)));
                          if (uniqueNames.length === 0) {
                            return (
                              <div className="p-3 text-sm text-muted-foreground">
                                No knowledge bases available.
                              </div>
                            );
                          }
                          return uniqueNames.map((name, index) => (
                            <button
                              key={index}
                              className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b last:border-b-0"
                              onClick={() => {
                                // Find the knowledge base entry and navigate to it
                                setKbPopoverOpen(false);
                                navigate("/knowledge-base");
                              }}
                              data-testid={`button-kb-select-${index}`}
                            >
                              <Monitor className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{name}</span>
                            </button>
                          ));
                        })()}
                      </div>
                      <div className="border-t">
                        <button
                          className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent transition-colors"
                          onClick={() => {
                            setKbPopoverOpen(false);
                            navigate("/knowledge-base");
                          }}
                          data-testid="button-add-new-knowledge-base"
                        >
                          <ArrowUpRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm">Add New Knowledge Base</span>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </SettingsSection>

              <SettingsSection title="Speech Settings" icon={Headphones}>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">Background Sound</label>
                    <Select value={backgroundSound} onValueChange={setBackgroundSound}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="coffee-shop">Coffee Shop</SelectItem>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="outdoor">Outdoor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500">Responsiveness</label>
                      <span className="text-xs text-muted-foreground">{responsiveness[0]}</span>
                    </div>
                    <Slider value={responsiveness} onValueChange={setResponsiveness} min={0} max={1} step={0.1} />
                    <p className="text-xs text-muted-foreground mt-1">Control how fast the agent responds after users finish speaking.</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500">Interruption Sensitivity</label>
                      <span className="text-xs text-muted-foreground">{interruptionSensitivity[0]}</span>
                    </div>
                    <Slider value={interruptionSensitivity} onValueChange={setInterruptionSensitivity} min={0} max={1} step={0.1} />
                    <p className="text-xs text-muted-foreground mt-1">Control how sensitively AI can be interrupted by human speech.</p>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Call Settings" icon={Phone}>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500">Begin Message Delay</label>
                      <span className="text-xs text-muted-foreground">{(beginMessageDelay[0] / 1000).toFixed(1)}s</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">How long to wait before the agent starts speaking after the call connects</p>
                    <Slider value={beginMessageDelay} onValueChange={setBeginMessageDelay} min={0} max={5000} step={100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500">Max Call Duration</label>
                      <span className="text-xs text-muted-foreground">{Math.round(maxCallDuration[0] / 60000)} min</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Maximum length of a single call before automatic disconnect</p>
                    <Slider value={maxCallDuration} onValueChange={setMaxCallDuration} min={60000} max={7200000} step={60000} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs font-medium text-gray-500">Inactivity Timeout</label>
                      <span className="text-xs text-muted-foreground">{Math.round(inactivityTimeout[0] / 1000)}s</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">How long to wait for caller response before ending the call</p>
                    <Slider value={inactivityTimeout} onValueChange={setInactivityTimeout} min={5000} max={120000} step={1000} />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Voice Tuning" icon={Volume2}>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500">Voice Speed</label>
                      <span className="text-xs text-muted-foreground">{voiceSpeed[0].toFixed(1)}x</span>
                    </div>
                    <Slider value={voiceSpeed} onValueChange={setVoiceSpeed} min={0.5} max={2} step={0.1} />
                    <p className="text-xs text-muted-foreground mt-1">Adjust how fast the voice speaks.</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500">Voice Temperature</label>
                      <span className="text-xs text-muted-foreground">{voiceTemperature[0].toFixed(1)}</span>
                    </div>
                    <Slider value={voiceTemperature} onValueChange={setVoiceTemperature} min={0} max={2} step={0.1} />
                    <p className="text-xs text-muted-foreground mt-1">Higher = more expressive, lower = more consistent.</p>
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-xs font-medium text-gray-500">Voice Volume</label>
                      <span className="text-xs text-muted-foreground">{voiceVolume[0].toFixed(1)}</span>
                    </div>
                    <Slider value={voiceVolume} onValueChange={setVoiceVolume} min={0} max={2} step={0.1} />
                    <p className="text-xs text-muted-foreground mt-1">Adjust the loudness of the agent's voice output.</p>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Hours of Operation" icon={Clock}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-medium">Enable Business Hours</label>
                      <p className="text-xs text-muted-foreground">Agent behavior changes outside set hours</p>
                    </div>
                    <Switch
                      checked={hoursEnabled}
                      onCheckedChange={setHoursEnabled}
                      data-testid="switch-hours-enabled"
                    />
                  </div>

                  {hoursEnabled && (() => {
                    const now = new Date();
                    let localNow: Date;
                    try {
                      localNow = new Date(now.toLocaleString('en-US', { timeZone: hoursTimezone }));
                    } catch {
                      localNow = now;
                    }
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const todayKey = dayNames[localNow.getDay()];
                    const todaySchedule = hoursSchedule[todayKey];
                    const currentMin = localNow.getHours() * 60 + localNow.getMinutes();
                    let liveOpen = false;
                    if (todaySchedule && todaySchedule.open) {
                      const [sH, sM] = todaySchedule.start.split(':').map(Number);
                      const [eH, eM] = todaySchedule.end.split(':').map(Number);
                      const openM = sH * 60 + sM;
                      const closeM = eH * 60 + eM;
                      liveOpen = closeM > openM
                        ? (currentMin >= openM && currentMin < closeM)
                        : (currentMin >= openM || currentMin < closeM);
                    }

                    return (
                    <>
                      <div className="flex items-center gap-2" data-testid="badge-hours-status">
                        <div className={`w-2 h-2 rounded-full ${liveOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-medium">{liveOpen ? 'Currently: OPEN' : 'Currently: CLOSED'}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {localNow.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Timezone</label>
                        <Select value={hoursTimezone} onValueChange={setHoursTimezone}>
                          <SelectTrigger data-testid="select-hours-timezone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="US/Eastern">Eastern (ET)</SelectItem>
                            <SelectItem value="US/Central">Central (CT)</SelectItem>
                            <SelectItem value="US/Mountain">Mountain (MT)</SelectItem>
                            <SelectItem value="US/Pacific">Pacific (PT)</SelectItem>
                            <SelectItem value="US/Hawaii">Hawaii (HT)</SelectItem>
                            <SelectItem value="US/Alaska">Alaska (AKT)</SelectItem>
                            <SelectItem value="Europe/London">London (GMT)</SelectItem>
                            <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                            <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-gray-500">Weekly Schedule</label>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-6 px-2"
                            data-testid="button-copy-mon-fri"
                            onClick={() => {
                              const mon = hoursSchedule.monday;
                              setHoursSchedule(prev => ({
                                ...prev,
                                tuesday: { ...mon },
                                wednesday: { ...mon },
                                thursday: { ...mon },
                                friday: { ...mon },
                              }));
                            }}
                          >
                            Copy Mon to Tue–Fri
                          </Button>
                        </div>
                        {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                          const dayData = hoursSchedule[day];
                          return (
                            <div key={day} className="flex items-center gap-2" data-testid={`hours-row-${day}`}>
                              <Switch
                                checked={dayData.open}
                                onCheckedChange={(checked) => {
                                  setHoursSchedule(prev => ({
                                    ...prev,
                                    [day]: { ...prev[day], open: checked }
                                  }));
                                }}
                                data-testid={`switch-hours-${day}`}
                              />
                              <span className="text-xs w-12 capitalize">{day.slice(0, 3)}</span>
                              {dayData.open ? (
                                <div className="flex items-center gap-1 flex-1">
                                  <input
                                    type="time"
                                    value={dayData.start}
                                    onChange={(e) => {
                                      setHoursSchedule(prev => ({
                                        ...prev,
                                        [day]: { ...prev[day], start: e.target.value }
                                      }));
                                    }}
                                    className="text-xs border rounded-md px-2 py-1 w-[90px] bg-background"
                                    data-testid={`input-hours-start-${day}`}
                                  />
                                  <span className="text-xs text-muted-foreground">to</span>
                                  <input
                                    type="time"
                                    value={dayData.end}
                                    onChange={(e) => {
                                      setHoursSchedule(prev => ({
                                        ...prev,
                                        [day]: { ...prev[day], end: e.target.value }
                                      }));
                                    }}
                                    className="text-xs border rounded-md px-2 py-1 w-[90px] bg-background"
                                    data-testid={`input-hours-end-${day}`}
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Closed</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">After-Hours Mode</label>
                        <Select value={afterHoursMode} onValueChange={setAfterHoursMode}>
                          <SelectTrigger data-testid="select-after-hours-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="24_7">Always Available (24/7)</SelectItem>
                            <SelectItem value="messages_only">Take Messages Only</SelectItem>
                            <SelectItem value="orders_only">Accept Orders Only</SelectItem>
                            <SelectItem value="custom">Custom Instructions</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {afterHoursMode === '24_7' && 'Agent operates normally at all times.'}
                          {afterHoursMode === 'messages_only' && 'Agent takes messages when closed.'}
                          {afterHoursMode === 'orders_only' && 'Agent accepts orders but not reservations when closed.'}
                          {afterHoursMode === 'custom' && 'Provide custom after-hours instructions below.'}
                        </p>
                      </div>

                      {afterHoursMode !== '24_7' && (
                        <div>
                          <label className="text-xs font-medium text-gray-500 mb-1 block">
                            {afterHoursMode === 'custom' ? 'Custom After-Hours Instructions' : 'Additional After-Hours Message (Optional)'}
                          </label>
                          <Textarea
                            value={afterHoursMessage}
                            onChange={(e) => setAfterHoursMessage(e.target.value)}
                            placeholder={afterHoursMode === 'custom'
                              ? "Tell the agent what to do when the restaurant is closed..."
                              : "Optional extra instructions for after-hours calls..."}
                            className="text-xs min-h-[80px] resize-none"
                            data-testid="textarea-after-hours-message"
                          />
                        </div>
                      )}
                    </>
                    );
                  })()}
                </div>
              </SettingsSection>

            </div>
          </ScrollArea>
          )}
          
          {/* Resize handle */}
          {!settingsPanelMinimized && (
            <div 
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={(e) => handlePanelResizeStart('settings', e)}
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400" />
            </div>
          )}
        </div>
        )}

        {/* Center - Content Area */}
        {activeTab === "create" ? (
          <>
            {/* Flow Canvas - Full Area */}
            <div ref={reactFlowWrapper} className="absolute inset-0 overflow-hidden">
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
                proOptions={{ hideAttribution: true }}
                data-testid="flow-canvas"
              >
                <Panel position="bottom-center" className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-lg shadow-sm border p-1 px-2">
                  {/* Auto-save indicator */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-[90px]">
                    {autoSaveStatus === 'saving' && (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <span>Saving...</span>
                      </>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">Saved</span>
                      </>
                    )}
                    {autoSaveStatus === 'error' && (
                      <>
                        <AlertCircle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600 dark:text-red-400">Error</span>
                      </>
                    )}
                    {autoSaveStatus === 'idle' && lastSaved && (
                      <span className="text-muted-foreground/70">
                        Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleUndo} disabled={!canUndo}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRedo} disabled={!canRedo}>
                    <Redo2 className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomOut()}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomIn()}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => fitView()}>
                    <Maximize className="h-4 w-4" />
                  </Button>
                </Panel>

                <Background variant={BackgroundVariant.Dots} gap={20} size={0.5} color="#e2e8f0" />
              </ReactFlow>
            </div>

            {/* Right Sidebar - Node Library - Floating Panel */}
            <div 
              ref={nodesPanelRef}
              data-testid="nodes-library-panel"
              className="absolute z-10 bg-white dark:bg-gray-900 flex flex-col overflow-hidden rounded-xl shadow-lg border transition-all"
              style={{
                right: nodesPanelPos.x === -1 ? 16 : 'auto',
                left: nodesPanelPos.x === -1 ? 'auto' : nodesPanelPos.x,
                top: nodesPanelPos.y,
                width: nodesPanelSize.width,
                height: nodesPanelMinimized ? 'auto' : (nodesPanelSize.height > 0 ? nodesPanelSize.height : 'calc(100% - 32px)'),
                maxHeight: nodesPanelMinimized ? 'auto' : 'calc(100% - 32px)',
              }}
            >
              <div 
                className="p-3 border-b flex items-center justify-between cursor-grab select-none flex-shrink-0"
                onMouseDown={(e) => {
                  // If first drag and using default right alignment, calculate absolute position
                  if (nodesPanelPos.x === -1 && nodesPanelRef.current) {
                    const rect = nodesPanelRef.current.getBoundingClientRect();
                    const parentRect = nodesPanelRef.current.parentElement?.getBoundingClientRect();
                    if (parentRect) {
                      setNodesPanelPos({ x: rect.left - parentRect.left, y: rect.top - parentRect.top });
                    }
                  }
                  handlePanelDragStart('nodes', e);
                }}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold text-sm">Nodes</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNodesPanelMinimized(!nodesPanelMinimized)}
                    data-testid="nodes-panel-minimize"
                  >
                    {nodesPanelMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              
              {!nodesPanelMinimized && (
              <>
              <div className="px-3 py-2 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-search-nodes"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1">
            <div className="p-3 space-y-4">
              {filteredCategories.map((category) => {
                const CategoryIcon = category.icon;
                return (
                  <div key={category.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <CategoryIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{category.label}</span>
                    </div>
                    <div className="space-y-1.5">
                      {category.nodes.map((nodeType) => {
                        const Icon = nodeType.icon;
                        const colors = nodeColors[nodeType.color];
                        return (
                          <div
                            key={nodeType.type}
                            draggable
                            onDragStart={(event) => onDragStart(event, nodeType.type)}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-grab active:cursor-grabbing transition-all hover:shadow-sm"
                            data-testid={`draggable-node-${nodeType.type}`}
                          >
                            <div className={`w-7 h-7 rounded-lg ${colors.bg} flex items-center justify-center shadow-sm`}>
                              <Icon className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{nodeType.label}</p>
                              <p className="text-[10px] text-gray-400 truncate">{nodeType.subtitle}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
              </ScrollArea>
              </>
              )}
              
              {/* Resize handle */}
              {!nodesPanelMinimized && (
                <div 
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                  onMouseDown={(e) => handlePanelResizeStart('nodes', e)}
                >
                  <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-400" />
                </div>
              )}
            </div>
          </>
        ) : (
          /* Test Tab - Chat & Voice Testing Interface - Side by Side (responsive) */
          <div className="flex-1 flex flex-col lg:flex-row bg-gray-50 dark:bg-gray-950 p-6 gap-6 overflow-auto">
            {/* Chat Testing Panel */}
            <div className="flex-1 flex flex-col min-h-[400px]">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border overflow-hidden flex flex-col h-full">
                {/* Chat Header */}
                <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Text Chat</h3>
                      <p className="text-xs text-muted-foreground">Test via text conversation</p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTestMessages([]);
                          setCurrentWorkflowNodeId(null); // Reset workflow state
                          greetingFetchedRef.current = false; // Allow re-fetch of greeting
                        }}
                        className="gap-1"
                        data-testid="button-clear-chat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  {testMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center">
                      <div className="space-y-2">
                        <MessageSquare className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto" />
                        <p className="text-muted-foreground">Start a conversation to test your agent</p>
                        <p className="text-xs text-gray-400">Type a message below to begin</p>
                      </div>
                    </div>
                  ) : (
                    testMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground rounded-br-md' 
                            : 'bg-gray-100 dark:bg-gray-800 rounded-bl-md'
                        }`}>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {isTestLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-2.5">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message to test your agent..."
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendTestMessage()}
                      className="flex-1"
                      data-testid="input-test-message"
                    />
                    <Button 
                      onClick={handleSendTestMessage} 
                      disabled={isTestLoading || !testInput.trim()}
                      data-testid="button-send-test"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Call Panel */}
            <div className="w-full lg:w-80 flex flex-col flex-shrink-0 min-h-[300px] lg:min-h-0">
              <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg border overflow-hidden flex flex-col h-full transition-colors ${
                isInVoiceCall 
                  ? 'border-emerald-300 dark:border-emerald-700' 
                  : ''
              }`}>
                {/* Call Controls */}
                <div className="flex flex-col items-center justify-center text-center p-6">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all ${
                    isInVoiceCall 
                      ? isAgentSpeaking
                        ? 'bg-blue-500 animate-pulse shadow-lg shadow-blue-500/30'
                        : 'bg-emerald-500 shadow-lg shadow-emerald-500/30' 
                      : 'bg-emerald-100 dark:bg-emerald-900/30'
                  }`}>
                    {isAgentSpeaking ? (
                      <Volume2 className="h-8 w-8 text-white animate-pulse" />
                    ) : (
                      <Mic className={`h-8 w-8 ${isInVoiceCall ? 'text-white' : 'text-emerald-600'}`} />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-1">
                    {isInVoiceCall 
                      ? isAgentSpeaking 
                        ? 'Agent Speaking...' 
                        : 'Listening...'
                      : 'Voice Test'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isInVoiceCall 
                      ? isAgentSpeaking
                        ? 'Agent is responding'
                        : 'Speak clearly into your microphone' 
                      : 'Real-time voice conversation'}
                  </p>
                  {voiceServiceDisabled ? (
                    <div className="w-full">
                      {/* Informational banner for service disabled */}
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                        <div className="flex items-start gap-2">
                          <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-amber-600 dark:text-amber-300 text-xs font-bold">!</span>
                          </div>
                          <div className="text-sm text-amber-800 dark:text-amber-200">
                            <p className="font-medium mb-1">Voice Testing Not Configured</p>
                            <p className="text-amber-700 dark:text-amber-300 text-xs">
                              Retell AI integration is required for real-time voice testing. Contact your administrator to enable this feature.
                            </p>
                          </div>
                        </div>
                      </div>
                      <Button 
                        size="lg"
                        className="gap-2 w-full"
                        variant="outline"
                        onClick={startVoiceCall}
                        disabled={isVoiceCallConnecting}
                        data-testid="button-retry-voice"
                      >
                        {isVoiceCallConnecting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Checking Availability...
                          </>
                        ) : (
                          <>
                            <Phone className="h-5 w-5" />
                            Check Again
                          </>
                        )}
                      </Button>
                    </div>
                  ) : isInVoiceCall ? (
                    <Button 
                      variant="destructive" 
                      size="lg"
                      className="gap-2 w-full"
                      onClick={stopVoiceCall}
                      data-testid="button-end-call"
                    >
                      <PhoneOff className="h-5 w-5" />
                      End Call
                    </Button>
                  ) : (
                    <Button 
                      size="lg"
                      className="gap-2 w-full"
                      onClick={startVoiceCall}
                      disabled={isVoiceCallConnecting || isNew}
                      data-testid="button-start-call"
                    >
                      {isVoiceCallConnecting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Phone className="h-5 w-5" />
                          Start Voice Call
                        </>
                      )}
                    </Button>
                  )}
                </div>
                
                {/* Voice Transcript - shown during/after call */}
                {(isInVoiceCall || voiceTranscript.length > 0) && (
                  <div className="border-t flex-1 overflow-hidden flex flex-col">
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Live Transcript</span>
                      {voiceTranscript.length > 0 && !isInVoiceCall && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs"
                          onClick={() => setVoiceTranscript([])}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="flex-1 p-3">
                      <div className="space-y-2">
                        {voiceTranscript.map((msg, idx) => (
                          <div 
                            key={idx}
                            className={`text-sm p-2 rounded-lg ${
                              msg.role === 'user' 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 ml-4' 
                                : 'bg-gray-100 dark:bg-gray-800 mr-4'
                            }`}
                          >
                            <span className="text-xs font-medium text-muted-foreground block mb-1">
                              {msg.role === 'user' ? 'You' : 'Agent'}
                            </span>
                            {msg.content}
                          </div>
                        ))}
                        {voiceTranscript.length === 0 && isInVoiceCall && (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            Transcript will appear here...
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Voice Selector Modal */}
      <VoiceSelector
        open={voiceSelectorOpen}
        onOpenChange={setVoiceSelectorOpen}
        provider={voiceProvider}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={(voiceId: string, voiceName: string, provider?: string) => {
          setSelectedVoiceId(voiceId);
          setSelectedVoiceName(voiceName);
          if (provider) {
            setVoiceProvider(provider);
          }
          setVoiceSelectorOpen(false);
        }}
      />
    </div>
  );
}

export default function AgentEditor() {
  return (
    <ReactFlowProvider>
      <AgentEditorInner />
    </ReactFlowProvider>
  );
}
