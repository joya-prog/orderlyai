import Retell from 'retell-sdk';
import type { Agent } from '@shared/schema';

const RETELL_API_KEY = process.env.RETELL_API_KEY;

if (!RETELL_API_KEY) {
  console.warn('[Retell] RETELL_API_KEY not configured - Retell integration disabled');
}

const retellClient = RETELL_API_KEY ? new Retell({ apiKey: RETELL_API_KEY }) : null;

// Valid Retell ambient sound values
const VALID_AMBIENT_SOUNDS = ['coffee-shop', 'convention-hall', 'summer-outdoor', 'mountain-outdoor', 'static-noise', 'call-center'] as const;
type ValidAmbientSound = typeof VALID_AMBIENT_SOUNDS[number];

// Validate and return ambient sound only if it's a valid Retell value
function getValidAmbientSound(value: string | undefined): ValidAmbientSound | undefined {
  if (!value || value.trim() === '') return undefined;
  return VALID_AMBIENT_SOUNDS.includes(value as ValidAmbientSound) ? (value as ValidAmbientSound) : undefined;
}

interface BusinessHoursSchedule {
  enabled: boolean;
  schedule: Record<string, { open: boolean; start: string; end: string }>;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

type HoursAgent = Pick<Agent, 'businessHours' | 'afterHoursMode' | 'afterHoursMessage' | 'timezone'>;

export function isWithinBusinessHours(agent: HoursAgent): { isOpen: boolean; currentTimeLabel: string } {
  const tz = agent.timezone || 'US/Pacific';
  const bh = agent.businessHours as BusinessHoursSchedule | null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const realNow = new Date();
  const currentTimeLabel = `${formatter.format(realNow)} (${tz})`;

  if (!bh || !bh.enabled || !bh.schedule) {
    return { isOpen: true, currentTimeLabel };
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(realNow);

  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase() || '';
  const hourStr = parts.find(p => p.type === 'hour')?.value || '0';
  const minuteStr = parts.find(p => p.type === 'minute')?.value || '0';
  const currentMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr);

  const daySchedule = bh.schedule[weekday];
  if (!daySchedule || !daySchedule.open) {
    return { isOpen: false, currentTimeLabel };
  }

  const [startH, startM] = daySchedule.start.split(':').map(Number);
  const [endH, endM] = daySchedule.end.split(':').map(Number);
  const openMin = startH * 60 + startM;
  const closeMin = endH * 60 + endM;

  const isInWindow = closeMin > openMin
    ? (currentMinutes >= openMin && currentMinutes < closeMin)
    : (currentMinutes >= openMin || currentMinutes < closeMin);

  return { isOpen: isInWindow, currentTimeLabel };
}

export function getBusinessHoursPromptBlock(agent: HoursAgent): string {
  const mode = agent.afterHoursMode || '24_7';
  if (mode === '24_7') return '';

  const bh = agent.businessHours as BusinessHoursSchedule | null;
  if (!bh || !bh.enabled || !bh.schedule) return '';

  const { isOpen, currentTimeLabel } = isWithinBusinessHours(agent);

  let statusLine: string;
  if (isOpen) {
    const tz = agent.timezone || 'US/Pacific';
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(new Date()).toLowerCase();
    const daySchedule = bh.schedule[weekday];
    if (daySchedule && daySchedule.open) {
      const [eH, eM] = daySchedule.end.split(':').map(Number);
      statusLine = `OPEN — closes at ${formatTime12(eH, eM)}`;
    } else {
      statusLine = 'OPEN';
    }
  } else {
    statusLine = 'CLOSED';
  }

  let block = `\n\n## Hours of Operation\nCurrent time: ${currentTimeLabel}\nStatus: ${statusLine}\n`;

  if (!isOpen) {
    if (mode === 'messages_only') {
      block += `\nYou are currently operating in after-hours mode. The restaurant is closed right now. Politely let callers know that the restaurant is closed, and offer to take their name, phone number, and the reason for their call so the team can follow up during business hours. Do NOT attempt to make reservations or place orders.`;
    } else if (mode === 'orders_only') {
      block += `\nYou are currently operating in after-hours mode. The restaurant is closed right now. You may still accept catering or next-day orders, but do NOT book reservations. Let callers know the team will confirm their order during business hours.`;
    } else if (mode === 'custom' && agent.afterHoursMessage) {
      block += `\nYou are currently operating in after-hours mode. Follow these instructions:\n${agent.afterHoursMessage}`;
    }
  }

  return block;
}

function formatTime12(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function appendHoursBlock(prompt: string, agent: HoursAgent): string {
  const block = getBusinessHoursPromptBlock(agent);
  return block ? prompt + block : prompt;
}

export interface RetellAgentConfig {
  agentName: string;
  voiceId: string;
  voiceModel?: string;
  voiceSpeed?: number;
  voiceTemperature?: number;
  volume?: number;
  responsiveness?: number;
  interruptionSensitivity?: number;
  language?: string;
  enableBackchannel?: boolean;
  backchannelFrequency?: number;
  backchannelWords?: string[];
  reminderTriggerMs?: number;
  reminderMaxCount?: number;
  reminderMessage?: string;
  ambientSound?: string;
  ambientSoundVolume?: number;
  boostedKeywords?: string[];
  pronunciationDictionary?: Array<{ word: string; pronunciation: string }>;
  beginMessageDelayMs?: number;
  endCallPhrases?: string[];
  maxCallDurationMs?: number;
  inactivityTimeoutMs?: number;
  fallbackVoiceId?: string;
  voicemailDetection?: boolean;
  voicemailMessage?: string;
  warmTransferEnabled?: boolean;
  warmTransferNumber?: string;
  warmTransferMessage?: string;
  llmId?: string;
  webhookUrl?: string;
}

export interface RetellLLMConfig {
  generalPrompt: string;
  beginMessage?: string;
  generalTools?: Array<{
    type: string;
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;
  inboundDynamicVariablesWebhookUrl?: string;
  model?: string;
  modelTemperature?: number;
  knowledgeBaseIds?: string[];
}

export interface RetellConversationFlowConfig {
  generalPrompt: string;
  beginMessage?: string;
  model?: string;
  modelTemperature?: number;
}

// Types for converting Orderly flow nodes to Retell format
export interface OrderlyFlowNode {
  id: string;
  type: string;
  label: string;
  content?: string;
  contentMode?: 'prompt' | 'static';
  config?: Record<string, any>;
  transitions?: Array<{ id: string; label: string; condition?: string }>;
}

export interface OrderlyFlowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  label?: string;
}

export interface RetellCallLog {
  callId: string;
  agentId: string;
  callType: string;
  callStatus: string;
  startTimestamp: number;
  endTimestamp?: number;
  transcript?: string;
  recordingUrl?: string;
  publicLogUrl?: string;
  disconnectionReason?: string;
  callAnalysis?: {
    callSuccessful?: boolean;
    callSummary?: string;
    userSentiment?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface RetellPhoneNumber {
  phoneNumber: string;
  phoneNumberPretty: string;
  inboundAgentId?: string;
  outboundAgentId?: string;
  areaCode?: string;
  nickname?: string;
  lastModificationTimestamp: number;
}

export async function isRetellConfigured(): Promise<boolean> {
  return retellClient !== null;
}

export async function createRetellLLM(config: RetellLLMConfig): Promise<string | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const llmResponse = await retellClient.llm.create({
      general_prompt: config.generalPrompt,
      begin_message: config.beginMessage,
      general_tools: config.generalTools as any,
      inbound_dynamic_variables_webhook_url: config.inboundDynamicVariablesWebhookUrl,
      model: config.model as any || 'gpt-4o-mini',
      model_temperature: config.modelTemperature,
    });

    console.log('[Retell] Created LLM:', llmResponse.llm_id);
    return llmResponse.llm_id;
  } catch (error) {
    console.error('[Retell] Error creating LLM:', error);
    throw error;
  }
}

export async function createRetellConversationFlow(config: RetellConversationFlowConfig, agent?: HoursAgent): Promise<string | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const prompt = agent ? appendHoursBlock(config.generalPrompt, agent) : config.generalPrompt;
    const flowResponse = await retellClient.conversationFlow.create({
      model_choice: {
        model: (config.model as any) || 'gpt-4o-mini',
        type: 'cascading',
      },
      model_temperature: config.modelTemperature || 0.7,
      nodes: [
        {
          id: 'start',
          type: 'conversation',
          instruction: {
            type: 'prompt',
            text: prompt,
          },
        },
      ],
      start_speaker: 'agent',
      global_prompt: config.beginMessage || undefined,
    });

    console.log('[Retell] Created Conversation Flow:', flowResponse.conversation_flow_id);
    return flowResponse.conversation_flow_id;
  } catch (error) {
    console.error('[Retell] Error creating Conversation Flow:', error);
    throw error;
  }
}

export async function updateRetellConversationFlow(flowId: string, config: Partial<RetellConversationFlowConfig>, agent?: HoursAgent): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    const prompt = (config.generalPrompt || config.beginMessage || undefined);
    const finalPrompt = prompt && agent ? appendHoursBlock(prompt, agent) : prompt;
    await retellClient.conversationFlow.update(flowId, {
      model_choice: config.model ? {
        model: config.model as any,
        type: 'cascading',
      } : undefined,
      model_temperature: config.modelTemperature,
      global_prompt: finalPrompt,
    });

    console.log('[Retell] Updated Conversation Flow:', flowId);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating Conversation Flow:', error);
    throw error;
  }
}

// Convert Orderly flow nodes to Retell conversation flow format and sync
export async function syncWorkflowToRetell(
  flowId: string,
  nodes: OrderlyFlowNode[],
  connections: OrderlyFlowConnection[],
  globalPrompt?: string,
  model?: string,
  agent?: HoursAgent
): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  if (nodes.length === 0) {
    console.log('[Retell] No nodes to sync');
    return true;
  }

  try {
    // Step 1: Find the start node (greeting type or node with no incoming edges)
    const nodesWithIncoming = new Set(connections.map(c => c.targetNodeId));
    let startNode = nodes.find(n => n.type === 'greeting');
    if (!startNode) {
      startNode = nodes.find(n => !nodesWithIncoming.has(n.id)) || nodes[0];
    }
    
    console.log(`[Retell] Start node identified: ${startNode.id} (${startNode.type}: "${startNode.label}")`);

    // Step 2: Build adjacency list for BFS ordering
    const adjacencyList = new Map<string, string[]>();
    nodes.forEach(n => adjacencyList.set(n.id, []));
    connections.forEach(conn => {
      const targets = adjacencyList.get(conn.sourceNodeId) || [];
      if (!targets.includes(conn.targetNodeId)) {
        targets.push(conn.targetNodeId);
        adjacencyList.set(conn.sourceNodeId, targets);
      }
    });

    // Step 3: BFS from start node
    const sortedNodeIds: string[] = [];
    const visited = new Set<string>();
    const queue: string[] = [startNode.id];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      sortedNodeIds.push(nodeId);
      const neighbors = adjacencyList.get(nodeId) || [];
      neighbors.forEach(n => { if (!visited.has(n)) queue.push(n); });
    }
    
    // Add orphaned nodes
    nodes.forEach(n => { if (!visited.has(n.id)) sortedNodeIds.push(n.id); });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Step 4: Build connection map (sourceHandle -> targetNodeId, sourceNodeId -> targetNodeId)
    const connectionMap = new Map<string, string>();
    // Also build a multi-map: sourceNodeId -> all connections from that node
    const connectionsBySource = new Map<string, OrderlyFlowConnection[]>();
    connections.forEach(conn => {
      if (conn.sourceHandle) {
        connectionMap.set(conn.sourceHandle, conn.targetNodeId);
      }
      if (!connectionMap.has(conn.sourceNodeId)) {
        connectionMap.set(conn.sourceNodeId, conn.targetNodeId);
      }
      const existing = connectionsBySource.get(conn.sourceNodeId) || [];
      existing.push(conn);
      connectionsBySource.set(conn.sourceNodeId, existing);
    });

    console.log(`[Retell] Connection map built with ${connectionMap.size} entries`);

    // Step 5: Convert Orderly nodes to Retell API format
    const retellNodes: any[] = [];

    sortedNodeIds.forEach((nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return;

      // Map Orderly node types to Retell API node types
      let retellNodeType = 'conversation';
      if (node.type === 'end' || node.type === 'end_call') {
        retellNodeType = 'end';
      } else if (node.type === 'transfer_call' || node.type === 'transfer') {
        retellNodeType = 'call_transfer';
      } else if (node.type === 'press_digit' || node.type === 'keypad_input') {
        retellNodeType = 'press_digit';
      }

      // Build instruction (Retell uses 'prompt' or 'static_sentence')
      const instructionType = node.contentMode === 'static' ? 'static_sentence' : 'prompt';
      const instruction = {
        type: instructionType,
        text: node.content || node.label || 'Continue the conversation.',
      };

      // Build edges (Retell's transition format) from connections
      const edges: any[] = [];
      const nodeConnections = connectionsBySource.get(node.id) || [];

      if (node.transitions && node.transitions.length > 0) {
        // Use defined transitions to build edges
        node.transitions.forEach((transition, idx) => {
          const handleId = `${node.id}-${transition.id}`;
          let targetNodeId = connectionMap.get(handleId);
          if (!targetNodeId) {
            targetNodeId = connectionMap.get(node.id);
          }
          
          if (targetNodeId) {
            const conditionText = transition.condition || transition.label || 'Continue';
            console.log(`[Retell] Edge: "${conditionText}" -> ${targetNodeId} (handle: ${handleId})`);
            edges.push({
              id: `edge_${node.id}_${idx}`,
              transition_condition: {
                type: 'prompt',
                prompt: conditionText,
              },
              destination_node_id: targetNodeId,
            });
          }
        });
      }
      
      // If no transitions matched, use connections directly to build edges
      if (edges.length === 0 && nodeConnections.length > 0) {
        nodeConnections.forEach((conn, idx) => {
          const conditionText = conn.label || 'Continue';
          console.log(`[Retell] Edge (from connection): "${conditionText}" -> ${conn.targetNodeId}`);
          edges.push({
            id: `edge_${node.id}_conn_${idx}`,
            transition_condition: {
              type: 'prompt',
              prompt: conditionText,
            },
            destination_node_id: conn.targetNodeId,
          });
        });
      }

      // Build the Retell node
      const retellNode: any = {
        id: node.id,
        type: retellNodeType,
      };

      // Type-specific handling
      if (retellNodeType === 'end') {
        // End nodes: no instruction or edges needed
      } else if (retellNodeType === 'call_transfer') {
        const config = node.config as Record<string, any> | undefined;
        if (config?.transferTo) {
          retellNode.transfer_destination = {
            type: 'phone',
            number: config.transferTo,
          };
          retellNode.instruction = instruction;
        } else {
          // No transfer destination configured — fall back to conversation node
          retellNode.type = 'conversation';
          retellNode.instruction = instruction;
          console.log(`[Retell] Node ${node.id} has no transfer destination, using conversation type`);
        }
        if (edges.length > 0) {
          retellNode.edges = edges;
        }
      } else if (retellNodeType === 'press_digit') {
        retellNode.instruction = instruction;
        if (edges.length > 0) {
          retellNode.edges = edges;
        }
      } else {
        // conversation nodes
        retellNode.instruction = instruction;
        if (edges.length > 0) {
          retellNode.edges = edges;
        }
      }

      retellNodes.push(retellNode);
    });

    console.log(`[Retell] Syncing ${retellNodes.length} nodes: ${retellNodes.map(n => `${n.id}(${n.type})`).join(' -> ')}`);

    // Step 6: Update Retell conversation flow
    await retellClient.conversationFlow.update(flowId, {
      model_choice: model ? {
        model: model as any,
        type: 'cascading',
      } : undefined,
      model_temperature: 0.7,
      nodes: retellNodes,
      global_prompt: (globalPrompt && agent) ? appendHoursBlock(globalPrompt, agent) : (globalPrompt || undefined),
      start_node_id: startNode.id,
      start_speaker: 'agent',
    } as any);

    console.log(`[Retell] Successfully synced workflow to flow: ${flowId}`);
    return true;
  } catch (error) {
    console.error('[Retell] Error syncing workflow:', error);
    return false;
  }
}

export async function updateRetellLLM(llmId: string, config: Partial<RetellLLMConfig>): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.llm.update(llmId, {
      general_prompt: config.generalPrompt,
      begin_message: config.beginMessage,
      general_tools: config.generalTools as any,
      model: config.model as any,
      model_temperature: config.modelTemperature,
    });

    console.log('[Retell] Updated LLM:', llmId);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating LLM:', error);
    throw error;
  }
}

export async function deleteRetellLLM(llmId: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.llm.delete(llmId);
    console.log('[Retell] Deleted LLM:', llmId);
    return true;
  } catch (error) {
    console.error('[Retell] Error deleting LLM:', error);
    return false;
  }
}

export async function createRetellAgent(config: RetellAgentConfig, conversationFlowId: string): Promise<string | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const agentResponse = await retellClient.agent.create({
      response_engine: {
        type: 'conversation-flow',
        conversation_flow_id: conversationFlowId,
      },
      voice_id: config.voiceId,
      agent_name: config.agentName,
      voice_model: config.voiceModel as any,
      voice_speed: config.voiceSpeed,
      voice_temperature: config.voiceTemperature,
      volume: config.volume,
      responsiveness: config.responsiveness,
      interruption_sensitivity: config.interruptionSensitivity,
      language: config.language as any,
      enable_backchannel: config.enableBackchannel,
      backchannel_frequency: config.backchannelFrequency,
      backchannel_words: config.backchannelWords,
      reminder_trigger_ms: config.reminderTriggerMs,
      reminder_max_count: config.reminderMaxCount,
      ambient_sound: getValidAmbientSound(config.ambientSound),
      ambient_sound_volume: getValidAmbientSound(config.ambientSound) ? config.ambientSoundVolume : undefined,
      boosted_keywords: config.boostedKeywords,
      pronunciation_dictionary: config.pronunciationDictionary,
      begin_message_delay_ms: config.beginMessageDelayMs,
      end_call_after_silence_ms: config.inactivityTimeoutMs,
      max_call_duration_ms: config.maxCallDurationMs,
      fallback_voice_ids: config.fallbackVoiceId ? [config.fallbackVoiceId] : undefined,
      enable_voicemail_detection: config.voicemailDetection,
      voicemail_message: config.voicemailMessage,
      webhook_url: config.webhookUrl,
    });

    console.log('[Retell] Created agent (conversation-flow):', agentResponse.agent_id);
    return agentResponse.agent_id;
  } catch (error) {
    console.error('[Retell] Error creating agent:', error);
    throw error;
  }
}

export async function updateRetellAgent(agentId: string, config: Partial<RetellAgentConfig>): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.agent.update(agentId, {
      agent_name: config.agentName,
      voice_id: config.voiceId,
      voice_model: config.voiceModel as any,
      voice_speed: config.voiceSpeed,
      voice_temperature: config.voiceTemperature,
      volume: config.volume,
      responsiveness: config.responsiveness,
      interruption_sensitivity: config.interruptionSensitivity,
      language: config.language as any,
      enable_backchannel: config.enableBackchannel,
      backchannel_frequency: config.backchannelFrequency,
      backchannel_words: config.backchannelWords,
      reminder_trigger_ms: config.reminderTriggerMs,
      reminder_max_count: config.reminderMaxCount,
      ambient_sound: getValidAmbientSound(config.ambientSound),
      ambient_sound_volume: getValidAmbientSound(config.ambientSound) ? config.ambientSoundVolume : undefined,
      boosted_keywords: config.boostedKeywords,
      pronunciation_dictionary: config.pronunciationDictionary,
      begin_message_delay_ms: config.beginMessageDelayMs,
      end_call_after_silence_ms: config.inactivityTimeoutMs,
      max_call_duration_ms: config.maxCallDurationMs,
      fallback_voice_ids: config.fallbackVoiceId ? [config.fallbackVoiceId] : undefined,
      enable_voicemail_detection: config.voicemailDetection,
      voicemail_message: config.voicemailMessage,
      webhook_url: config.webhookUrl,
    });

    console.log('[Retell] Updated agent:', agentId);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating agent:', error);
    throw error;
  }
}

export async function deleteRetellAgent(agentId: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.agent.delete(agentId);
    console.log('[Retell] Deleted agent:', agentId);
    return true;
  } catch (error) {
    console.error('[Retell] Error deleting agent:', error);
    return false;
  }
}

export async function getRetellAgent(agentId: string): Promise<any | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const agent = await retellClient.agent.retrieve(agentId);
    return agent;
  } catch (error) {
    console.error('[Retell] Error getting agent:', error);
    return null;
  }
}

export async function listRetellAgents(): Promise<any[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const agents = await retellClient.agent.list();
    return agents;
  } catch (error) {
    console.error('[Retell] Error listing agents:', error);
    return [];
  }
}

// Retell Voice interface
export interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider: 'elevenlabs' | 'openai' | 'deepgram' | 'playht';
  accent?: string;
  gender?: string;
  age?: string;
  preview_audio_url?: string;
}

// Fetch all available voices from Retell's voice catalog
export async function listRetellVoices(provider?: string): Promise<RetellVoice[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const voices = await retellClient.voice.list();
    
    // Map to our interface and optionally filter by provider
    const mappedVoices: RetellVoice[] = voices.map((voice: any) => ({
      voice_id: voice.voice_id,
      voice_name: voice.voice_name,
      provider: voice.provider,
      accent: voice.accent,
      gender: voice.gender,
      age: voice.age,
      preview_audio_url: voice.preview_audio_url,
    }));
    
    // Filter by provider if specified
    if (provider) {
      const providerLower = provider.toLowerCase();
      return mappedVoices.filter(v => v.provider.toLowerCase() === providerLower);
    }
    
    return mappedVoices;
  } catch (error) {
    console.error('[Retell] Error listing voices:', error);
    return [];
  }
}

export async function getRetellCallLogs(agentId?: string, limit: number = 50): Promise<RetellCallLog[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const filterCriteria: any = {};
    if (agentId) {
      filterCriteria.agent_id = [agentId];
    }

    const calls = await retellClient.call.list({
      filter_criteria: Object.keys(filterCriteria).length > 0 ? filterCriteria : undefined,
      limit,
      sort_order: 'descending',
    });

    return calls.map((call: any) => ({
      callId: call.call_id,
      agentId: call.agent_id,
      callType: call.call_type,
      callStatus: call.call_status,
      startTimestamp: call.start_timestamp,
      endTimestamp: call.end_timestamp,
      transcript: call.transcript,
      recordingUrl: call.recording_url,
      publicLogUrl: call.public_log_url,
      disconnectionReason: call.disconnection_reason,
      callAnalysis: call.call_analysis ? {
        callSuccessful: call.call_analysis.call_successful,
        callSummary: call.call_analysis.call_summary,
        userSentiment: call.call_analysis.user_sentiment,
      } : undefined,
      metadata: call.metadata,
    }));
  } catch (error) {
    console.error('[Retell] Error getting call logs:', error);
    return [];
  }
}

export async function getRetellCall(callId: string): Promise<RetellCallLog | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const call = await retellClient.call.retrieve(callId);
    return {
      callId: call.call_id,
      agentId: call.agent_id,
      callType: call.call_type,
      callStatus: call.call_status,
      startTimestamp: call.start_timestamp,
      endTimestamp: call.end_timestamp,
      transcript: call.transcript,
      recordingUrl: call.recording_url,
      publicLogUrl: call.public_log_url,
      disconnectionReason: call.disconnection_reason,
      callAnalysis: call.call_analysis ? {
        callSuccessful: call.call_analysis.call_successful,
        callSummary: call.call_analysis.call_summary,
        userSentiment: call.call_analysis.user_sentiment,
      } : undefined,
      metadata: call.metadata,
    };
  } catch (error) {
    console.error('[Retell] Error getting call:', error);
    return null;
  }
}

export async function listRetellPhoneNumbers(): Promise<RetellPhoneNumber[]> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return [];
  }

  try {
    const phoneNumbers = await retellClient.phoneNumber.list();
    return phoneNumbers.map((pn: any) => ({
      phoneNumber: pn.phone_number,
      phoneNumberPretty: pn.phone_number_pretty,
      inboundAgentId: pn.inbound_agent_id,
      outboundAgentId: pn.outbound_agent_id,
      areaCode: pn.area_code,
      nickname: pn.nickname,
      lastModificationTimestamp: pn.last_modification_timestamp,
    }));
  } catch (error) {
    console.error('[Retell] Error listing phone numbers:', error);
    return [];
  }
}

export async function importRetellPhoneNumber(
  phoneNumber: string,
  terminationUri: string,
  inboundAgentId?: string
): Promise<RetellPhoneNumber | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const pn = await retellClient.phoneNumber.import({
      phone_number: phoneNumber,
      termination_uri: terminationUri,
      inbound_agent_id: inboundAgentId,
    });

    return {
      phoneNumber: pn.phone_number,
      phoneNumberPretty: pn.phone_number_pretty,
      inboundAgentId: pn.inbound_agent_id,
      outboundAgentId: pn.outbound_agent_id,
      areaCode: pn.area_code,
      nickname: pn.nickname,
      lastModificationTimestamp: pn.last_modification_timestamp,
    };
  } catch (error) {
    console.error('[Retell] Error importing phone number:', error);
    throw error;
  }
}

export async function updateRetellPhoneNumber(
  phoneNumber: string,
  inboundAgentId?: string,
  outboundAgentId?: string,
  nickname?: string
): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.phoneNumber.update(phoneNumber, {
      inbound_agent_id: inboundAgentId,
      outbound_agent_id: outboundAgentId,
      nickname: nickname,
    });

    console.log('[Retell] Updated phone number:', phoneNumber);
    return true;
  } catch (error) {
    console.error('[Retell] Error updating phone number:', error);
    return false;
  }
}

export async function deleteRetellPhoneNumber(phoneNumber: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    await retellClient.phoneNumber.delete(phoneNumber);
    console.log('[Retell] Deleted phone number:', phoneNumber);
    return true;
  } catch (error) {
    console.error('[Retell] Error deleting phone number:', error);
    return false;
  }
}

export async function createRetellWebCall(agentId: string, metadata?: Record<string, unknown>): Promise<{
  callId: string;
  webCallLink: string;
  accessToken: string;
} | null> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return null;
  }

  try {
    const webCall = await retellClient.call.createWebCall({
      agent_id: agentId,
      metadata: metadata,
    });

    return {
      callId: webCall.call_id,
      webCallLink: webCall.web_call_link,
      accessToken: webCall.access_token,
    };
  } catch (error) {
    console.error('[Retell] Error creating web call:', error);
    throw error;
  }
}

export async function addKnowledgeToLLM(llmId: string, knowledgeBaseText: string): Promise<boolean> {
  if (!retellClient) {
    console.error('[Retell] Client not configured');
    return false;
  }

  try {
    const currentLlm = await retellClient.llm.retrieve(llmId);
    const existingPrompt = currentLlm.general_prompt || '';
    
    const knowledgeSection = `

## Knowledge Base

${knowledgeBaseText}
`;

    const updatedPrompt = existingPrompt.includes('## Knowledge Base')
      ? existingPrompt.replace(/## Knowledge Base[\s\S]*$/, knowledgeSection.trim())
      : existingPrompt + knowledgeSection;

    await retellClient.llm.update(llmId, {
      general_prompt: updatedPrompt,
    });

    console.log('[Retell] Added knowledge to LLM:', llmId);
    return true;
  } catch (error) {
    console.error('[Retell] Error adding knowledge to LLM:', error);
    return false;
  }
}

export function formatKnowledgeBaseForRetell(items: Array<{ question: string; answer: string; category?: string }>): string {
  const grouped: Record<string, Array<{ question: string; answer: string }>> = {};
  
  for (const item of items) {
    const category = item.category || 'General';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({ question: item.question, answer: item.answer });
  }

  let text = '';
  for (const [category, qaPairs] of Object.entries(grouped)) {
    text += `### ${category}\n\n`;
    for (const qa of qaPairs) {
      text += `**Q: ${qa.question}**\n${qa.answer}\n\n`;
    }
  }

  return text.trim();
}

export const RETELL_VOICE_PROVIDERS = {
  elevenlabs: {
    name: 'ElevenLabs',
    description: 'Premium voices with emotional range',
    voices: [
      { id: '11labs-Adrian', name: 'Adrian', gender: 'male' },
      { id: '11labs-Aria', name: 'Aria', gender: 'female' },
      { id: '11labs-Brian', name: 'Brian', gender: 'male' },
      { id: '11labs-Callum', name: 'Callum', gender: 'male' },
      { id: '11labs-Charlotte', name: 'Charlotte', gender: 'female' },
      { id: '11labs-Chris', name: 'Chris', gender: 'male' },
      { id: '11labs-Daniel', name: 'Daniel', gender: 'male' },
      { id: '11labs-Eric', name: 'Eric', gender: 'male' },
      { id: '11labs-George', name: 'George', gender: 'male' },
      { id: '11labs-Lily', name: 'Lily', gender: 'female' },
      { id: '11labs-Matilda', name: 'Matilda', gender: 'female' },
      { id: '11labs-Sarah', name: 'Sarah', gender: 'female' },
    ],
    models: ['eleven_turbo_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2', 'eleven_flash_v2_5'],
  },
  openai: {
    name: 'OpenAI',
    description: 'Fast and reliable voices',
    voices: [
      { id: 'openai-Alloy', name: 'Alloy', gender: 'neutral' },
      { id: 'openai-Echo', name: 'Echo', gender: 'male' },
      { id: 'openai-Fable', name: 'Fable', gender: 'neutral' },
      { id: 'openai-Onyx', name: 'Onyx', gender: 'male' },
      { id: 'openai-Nova', name: 'Nova', gender: 'female' },
      { id: 'openai-Shimmer', name: 'Shimmer', gender: 'female' },
    ],
    models: [],
  },
  deepgram: {
    name: 'Deepgram',
    description: 'Speed optimized voices',
    voices: [
      { id: 'deepgram-Angus', name: 'Angus', gender: 'male' },
      { id: 'deepgram-Arcas', name: 'Arcas', gender: 'male' },
      { id: 'deepgram-Asteria', name: 'Asteria', gender: 'female' },
      { id: 'deepgram-Athena', name: 'Athena', gender: 'female' },
      { id: 'deepgram-Helios', name: 'Helios', gender: 'male' },
      { id: 'deepgram-Hera', name: 'Hera', gender: 'female' },
      { id: 'deepgram-Luna', name: 'Luna', gender: 'female' },
      { id: 'deepgram-Orion', name: 'Orion', gender: 'male' },
      { id: 'deepgram-Perseus', name: 'Perseus', gender: 'male' },
      { id: 'deepgram-Stella', name: 'Stella', gender: 'female' },
      { id: 'deepgram-Zeus', name: 'Zeus', gender: 'male' },
    ],
    models: [],
  },
  cartesia: {
    name: 'Cartesia',
    description: 'Ultra-low latency voices',
    voices: [
      { id: 'cartesia-Barbershop Man', name: 'Barbershop Man', gender: 'male' },
      { id: 'cartesia-British Lady', name: 'British Lady', gender: 'female' },
      { id: 'cartesia-California Girl', name: 'California Girl', gender: 'female' },
      { id: 'cartesia-Commercial Lady', name: 'Commercial Lady', gender: 'female' },
      { id: 'cartesia-Commercial Man', name: 'Commercial Man', gender: 'male' },
      { id: 'cartesia-Confident Man', name: 'Confident Man', gender: 'male' },
      { id: 'cartesia-Doctor Mischief', name: 'Doctor Mischief', gender: 'male' },
      { id: 'cartesia-Friendly Sidekick', name: 'Friendly Sidekick', gender: 'male' },
      { id: 'cartesia-Hannah', name: 'Hannah', gender: 'female' },
      { id: 'cartesia-Indian Lady', name: 'Indian Lady', gender: 'female' },
      { id: 'cartesia-Indian Man', name: 'Indian Man', gender: 'male' },
      { id: 'cartesia-Midwestern Woman', name: 'Midwestern Woman', gender: 'female' },
      { id: 'cartesia-Nonfiction Man', name: 'Nonfiction Man', gender: 'male' },
      { id: 'cartesia-Reflective Woman', name: 'Reflective Woman', gender: 'female' },
      { id: 'cartesia-Reporter Man', name: 'Reporter Man', gender: 'male' },
      { id: 'cartesia-Storyteller Lady', name: 'Storyteller Lady', gender: 'female' },
      { id: 'cartesia-Sweet Lady', name: 'Sweet Lady', gender: 'female' },
      { id: 'cartesia-Teacher Lady', name: 'Teacher Lady', gender: 'female' },
    ],
    models: ['sonic-english', 'sonic-multilingual'],
  },
  playht: {
    name: 'PlayHT',
    description: 'High quality voice cloning',
    voices: [
      { id: 'playht-Adolfo', name: 'Adolfo', gender: 'male' },
      { id: 'playht-Angelo', name: 'Angelo', gender: 'male' },
      { id: 'playht-Charlotte', name: 'Charlotte', gender: 'female' },
      { id: 'playht-Davis', name: 'Davis', gender: 'male' },
      { id: 'playht-Donna', name: 'Donna', gender: 'female' },
      { id: 'playht-Dylan', name: 'Dylan', gender: 'male' },
      { id: 'playht-Jack', name: 'Jack', gender: 'male' },
      { id: 'playht-Jennifer', name: 'Jennifer', gender: 'female' },
      { id: 'playht-Matt', name: 'Matt', gender: 'male' },
      { id: 'playht-Michael', name: 'Michael', gender: 'male' },
      { id: 'playht-Ruby', name: 'Ruby', gender: 'female' },
      { id: 'playht-Will', name: 'Will', gender: 'male' },
    ],
    models: ['PlayHT2.0', 'PlayHT2.0-turbo', 'Play3.0-mini'],
  },
} as const;

export const RETELL_LLM_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, best quality', pricePerMin: 0.10 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable', pricePerMin: 0.07 },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic\'s latest', pricePerMin: 0.10 },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast Claude model', pricePerMin: 0.07 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous flagship', pricePerMin: 0.10 },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Legacy, fastest', pricePerMin: 0.05 },
] as const;

export const RETELL_AMBIENT_SOUNDS = [
  { id: 'coffee-shop', name: 'Coffee Shop' },
  { id: 'convention-hall', name: 'Convention Hall' },
  { id: 'summer-outdoor', name: 'Summer Outdoor' },
  { id: 'mountain-outdoor', name: 'Mountain Outdoor' },
  { id: 'static', name: 'Static' },
  { id: 'call-center', name: 'Call Center' },
] as const;

export const RETELL_LANGUAGES = [
  { id: 'en-US', name: 'English (US)' },
  { id: 'en-GB', name: 'English (UK)' },
  { id: 'es-ES', name: 'Spanish (Spain)' },
  { id: 'es-419', name: 'Spanish (Latin America)' },
  { id: 'fr-FR', name: 'French' },
  { id: 'de-DE', name: 'German' },
  { id: 'it-IT', name: 'Italian' },
  { id: 'pt-BR', name: 'Portuguese (Brazil)' },
  { id: 'pt-PT', name: 'Portuguese (Portugal)' },
  { id: 'zh-CN', name: 'Chinese (Mandarin)' },
  { id: 'ja-JP', name: 'Japanese' },
  { id: 'ko-KR', name: 'Korean' },
  { id: 'nl-NL', name: 'Dutch' },
  { id: 'pl-PL', name: 'Polish' },
  { id: 'ru-RU', name: 'Russian' },
  { id: 'hi-IN', name: 'Hindi' },
  { id: 'ar-SA', name: 'Arabic' },
  { id: 'tr-TR', name: 'Turkish' },
] as const;
