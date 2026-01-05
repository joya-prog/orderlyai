import { useEffect, useState, useMemo, useCallback, useRef, DragEvent, memo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, KnowledgeBase } from "@shared/schema";
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
  Sparkles,
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
} from "lucide-react";
import { VoiceSelector } from "@/components/voice-selector";
import { SidebarTrigger } from "@/components/ui/sidebar";
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

function AgentEditorInner() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isNew = id === "new";
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
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
  const [executionMode, setExecutionMode] = useState<"flex" | "rigid">("flex");
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
  const [voicemailDetection, setVoicemailDetection] = useState(false);
  const [warmTransferEnabled, setWarmTransferEnabled] = useState(false);
  const [warmTransferNumber, setWarmTransferNumber] = useState("");
  const [warmTransferMessage, setWarmTransferMessage] = useState("");
  
  // Track if greeting fetch is in progress to prevent duplicate requests
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);
  
  // Test conversation state
  const [testMessages, setTestMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [testInput, setTestInput] = useState("");
  const [isTestLoading, setIsTestLoading] = useState(false);
  
  // Voice call state
  const [isInVoiceCall, setIsInVoiceCall] = useState(false);
  const [isVoiceCallConnecting, setIsVoiceCallConnecting] = useState(false);
  const voiceWsRef = useRef<WebSocket | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingAudioRef = useRef(false);
  
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
      setVoicemailDetection(agent.voicemailDetection || false);
      const warmEnabled = agent.warmTransferEnabled || false;
      setWarmTransferEnabled(warmEnabled);
      // Only populate warm transfer fields if enabled
      setWarmTransferNumber(warmEnabled ? (agent.warmTransferNumber || "") : "");
      setWarmTransferMessage(warmEnabled ? (agent.warmTransferMessage || "") : "");
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

  // Load flow nodes
  useEffect(() => {
    if (flowNodesData.length > 0) {
      const loadedNodes = flowNodesData.map((node) => ({
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
      setNodes(loadedNodes);
      setHistory([cloneState(loadedNodes, [])]);
      setHistoryIndex(0);
    }
  }, [flowNodesData, setNodes]);

  useEffect(() => {
    if (flowConnectionsData.length > 0) {
      const loadedEdges = flowConnectionsData.map((conn) => ({
        id: conn.id,
        source: conn.sourceNodeId,
        target: conn.targetNodeId,
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
        voicemailDetection,
        warmTransferEnabled,
        warmTransferNumber: warmTransferEnabled ? warmTransferNumber : null,
        warmTransferMessage: warmTransferEnabled ? warmTransferMessage : null,
      });
      
      // Save flow nodes and connections
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
  }, [id, isNew, agentName, language, globalPrompt, aiModel, selectedVoiceName, voiceProvider, selectedVoiceId, voiceSpeed, voiceTemperature, voiceVolume, responsiveness, interruptionSensitivity, backgroundSound, beginMessageDelay, maxCallDuration, inactivityTimeout, voicemailDetection, warmTransferEnabled, warmTransferNumber, warmTransferMessage, nodes, edges]);
  
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
    
  }, [agentName, language, globalPrompt, aiModel, selectedVoiceName, voiceProvider, selectedVoiceId, voiceSpeed, voiceTemperature, voiceVolume, responsiveness, interruptionSensitivity, backgroundSound, beginMessageDelay, maxCallDuration, inactivityTimeout, voicemailDetection, warmTransferEnabled, warmTransferNumber, warmTransferMessage, nodes, edges, triggerAutoSave, isNew]);

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
      await saveMutation.mutateAsync({
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
        voicemailDetection,
        warmTransferEnabled,
        warmTransferNumber: warmTransferEnabled ? warmTransferNumber : null,
        warmTransferMessage: warmTransferEnabled ? warmTransferMessage : null,
      });
      await saveFlowMutation.mutateAsync({ nodes, edges });
    } finally {
      setIsSaving(false);
    }
  }, [agentName, language, globalPrompt, aiModel, selectedVoiceName, voiceProvider, selectedVoiceId, voiceSpeed, voiceTemperature, voiceVolume, responsiveness, interruptionSensitivity, backgroundSound, beginMessageDelay, maxCallDuration, inactivityTimeout, voicemailDetection, warmTransferEnabled, warmTransferNumber, warmTransferMessage, nodes, edges, saveMutation, saveFlowMutation]);

  // Initialize chat when switching to test tab - fetch greeting
  // Runs whenever: entering test tab with no messages, or messages are cleared
  useEffect(() => {
    if (activeTab === "test" && testMessages.length === 0 && !isGreetingLoading && !isNew && id) {
      const fetchGreeting = async () => {
        setIsGreetingLoading(true);
        try {
          const response = await apiRequest("POST", `/api/agents/${id}/start-chat`, {});
          const data = await response.json();
          if (data.greeting) {
            setTestMessages([{ role: 'assistant', content: data.greeting }]);
          }
        } catch (error) {
          console.error("Failed to load agent greeting:", error);
        } finally {
          setIsGreetingLoading(false);
        }
      };
      fetchGreeting();
    }
  }, [activeTab, testMessages.length, isGreetingLoading, isNew, id]);

  // Reset chat when agent changes
  useEffect(() => {
    setTestMessages([]);
    setIsGreetingLoading(false);
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
      const response = await apiRequest("POST", `/api/agents/${id}/test`, {
        message: userMessage,
        history: testMessages,
      });
      const data = await response.json();
      setTestMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to get response", variant: "destructive" });
    } finally {
      setIsTestLoading(false);
    }
  }, [testInput, testMessages, isTestLoading, id, toast]);

  // Voice call - play audio from queue using playback context
  const playNextAudio = useCallback(async () => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingAudioRef.current = true;
    const audioData = audioQueueRef.current.shift();
    
    // Use playback context, create new one if needed
    if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
      playbackContextRef.current = new AudioContext();
    }
    
    if (audioData) {
      try {
        // Clone the ArrayBuffer since decodeAudioData detaches it
        const clonedData = audioData.slice(0);
        const audioBuffer = await playbackContextRef.current.decodeAudioData(clonedData);
        const source = playbackContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackContextRef.current.destination);
        source.onended = () => {
          isPlayingAudioRef.current = false;
          playNextAudio();
        };
        source.start();
      } catch (error) {
        console.error("Error playing audio:", error);
        isPlayingAudioRef.current = false;
        // Continue to next audio in queue
        setTimeout(playNextAudio, 100);
      }
    } else {
      isPlayingAudioRef.current = false;
    }
  }, []);

  // Voice call - convert base64 to ArrayBuffer
  const base64ToArrayBuffer = useCallback((base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }, []);

  // Voice call - convert ArrayBuffer to base64
  const arrayBufferToBase64 = useCallback((buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }, []);

  // Voice call - start call with microphone
  const startVoiceCall = useCallback(async () => {
    if (isNew || !id || !user) return;
    
    setIsVoiceCallConnecting(true);
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      
      // Create audio context for recording (sample rate will be resampled)
      const audioContext = new AudioContext();
      captureContextRef.current = audioContext;
      
      // Create WebSocket connection
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/test-call?agentId=${id}&userId=${user.id}`);
      voiceWsRef.current = ws;
      
      ws.onopen = () => {
        console.log('[VoiceCall] WebSocket connected');
        setIsInVoiceCall(true);
        setIsVoiceCallConnecting(false);
        
        // Set up audio processing - record microphone audio
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        audioProcessorRef.current = processor;
        
        processor.onaudioprocess = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            const inputData = event.inputBuffer.getChannelData(0);
            
            // Resample to 16kHz if needed
            const sourceRate = audioContext.sampleRate;
            const targetRate = 16000;
            const ratio = sourceRate / targetRate;
            const resampledLength = Math.floor(inputData.length / ratio);
            const resampledData = new Float32Array(resampledLength);
            
            for (let i = 0; i < resampledLength; i++) {
              resampledData[i] = inputData[Math.floor(i * ratio)];
            }
            
            // Convert float32 to int16 PCM
            const int16Data = new Int16Array(resampledData.length);
            for (let i = 0; i < resampledData.length; i++) {
              int16Data[i] = Math.max(-32768, Math.min(32767, Math.floor(resampledData[i] * 32768)));
            }
            
            // Convert to base64 and send as JSON
            const base64Audio = arrayBufferToBase64(int16Data.buffer);
            ws.send(JSON.stringify({
              type: 'audio_chunk',
              audio: base64Audio,
            }));
          }
        };
        
        // Connect source to processor, but NOT to destination (prevents feedback)
        source.connect(processor);
        // Connect processor to a dummy node (required for it to process)
        const dummyGain = audioContext.createGain();
        dummyGain.gain.value = 0;
        processor.connect(dummyGain);
        dummyGain.connect(audioContext.destination);
      };
      
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'audio' && message.audio) {
            // Decode base64 audio and queue for playback
            const audioData = base64ToArrayBuffer(message.audio);
            audioQueueRef.current.push(audioData);
            
            // Also show the text in chat if provided
            if (message.text) {
              setTestMessages(prev => {
                // Avoid duplicates - check if last message is same
                if (prev.length > 0 && prev[prev.length - 1].content === message.text) {
                  return prev;
                }
                return [...prev, { role: 'assistant', content: message.text }];
              });
            }
            
            playNextAudio();
          } else if (message.type === 'greeting' && message.text) {
            setTestMessages([{ role: 'assistant', content: message.text }]);
          } else if (message.type === 'transcript' && message.text) {
            // Server sends user's transcribed speech
            setTestMessages(prev => [...prev, { role: 'user', content: message.text }]);
          } else if (message.type === 'response' && message.text) {
            setTestMessages(prev => [...prev, { role: 'assistant', content: message.text }]);
          } else if (message.type === 'error') {
            toast({ title: "Call Error", description: message.message, variant: "destructive" });
          } else if (message.type === 'state') {
            // State updates from server (listening, processing, speaking)
            console.log('[VoiceCall] State:', message.state);
          }
        } catch (e) {
          console.error('[VoiceCall] Error parsing message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[VoiceCall] WebSocket error:', error);
        toast({ title: "Connection Error", description: "Failed to connect to voice server", variant: "destructive" });
      };
      
      ws.onclose = () => {
        console.log('[VoiceCall] WebSocket closed');
        // Only call stopVoiceCall if we're still in a call (prevents recursive calls)
        if (isInVoiceCall) {
          setIsInVoiceCall(false);
          setIsVoiceCallConnecting(false);
        }
      };
      
    } catch (error: any) {
      console.error('[VoiceCall] Error starting call:', error);
      setIsVoiceCallConnecting(false);
      
      if (error.name === 'NotAllowedError') {
        toast({ title: "Microphone Access Denied", description: "Please allow microphone access to use voice testing", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Failed to start voice call", variant: "destructive" });
      }
    }
  }, [isNew, id, user, toast, playNextAudio, isInVoiceCall, arrayBufferToBase64, base64ToArrayBuffer]);

  // Voice call - stop call
  const stopVoiceCall = useCallback(() => {
    // Close WebSocket
    if (voiceWsRef.current) {
      voiceWsRef.current.close();
      voiceWsRef.current = null;
    }
    
    // Stop audio processor
    if (audioProcessorRef.current) {
      audioProcessorRef.current.disconnect();
      audioProcessorRef.current = null;
    }
    
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    // Close capture audio context
    if (captureContextRef.current) {
      captureContextRef.current.close();
      captureContextRef.current = null;
    }
    
    // Close playback audio context (let any playing audio finish first)
    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    
    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    
    setIsInVoiceCall(false);
    setIsVoiceCallConnecting(false);
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
          <Button onClick={handleSave} disabled={isSaving} className="gap-2" data-testid="button-publish">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Publish
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Sidebar - Agent Settings - Floating Panel */}
        <div 
          ref={settingsPanelRef}
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
                  
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">Execution Mode</label>
                    <div className="space-y-2">
                      <div 
                        onClick={() => setExecutionMode("flex")}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${executionMode === "flex" ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Flex Mode</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Nodes combined flexibly. Some settings may not apply.</p>
                      </div>
                      <div 
                        onClick={() => setExecutionMode("rigid")}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${executionMode === "rigid" ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="h-4 w-4 text-violet-500" />
                          <span className="text-sm font-medium">Rigid Mode</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Follows nodes step by step exactly.</p>
                      </div>
                    </div>
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
                        onClick={() => setTestMessages([])}
                        className="gap-1"
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
              <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-lg border overflow-hidden flex flex-col h-full p-6 transition-colors ${
                isInVoiceCall 
                  ? 'border-emerald-300 dark:border-emerald-700' 
                  : ''
              }`}>
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-all ${
                    isInVoiceCall 
                      ? 'bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/30' 
                      : 'bg-emerald-100 dark:bg-emerald-900/30'
                  }`}>
                    <Mic className={`h-10 w-10 ${isInVoiceCall ? 'text-white' : 'text-emerald-600'}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {isInVoiceCall ? 'Call in Progress' : 'Voice Test'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {isInVoiceCall 
                      ? 'Speak clearly into your microphone' 
                      : 'Test your agent with real voice'}
                  </p>
                  {isInVoiceCall ? (
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
