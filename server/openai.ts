// Reference: javascript_openai blueprint
import OpenAI from "openai";
import { Readable } from "stream";
import type { FlowNode, FlowConnection } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Build flow context from nodes and connections for AI understanding
export function buildFlowContext(nodes: FlowNode[], connections: FlowConnection[]): string {
  if (!nodes || nodes.length === 0) {
    return "";
  }

  // Create a map for quick node lookup
  const nodeMap = new Map<string, FlowNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  // Create adjacency list for connections
  const adjacencyList = new Map<string, Array<{ targetId: string; label?: string }>>();
  connections.forEach(conn => {
    if (!adjacencyList.has(conn.sourceNodeId)) {
      adjacencyList.set(conn.sourceNodeId, []);
    }
    adjacencyList.get(conn.sourceNodeId)!.push({
      targetId: conn.targetNodeId,
      label: conn.label || undefined
    });
  });

  // Find the starting node (usually type 'greeting' or the node with no incoming connections)
  const nodesWithIncoming = new Set(connections.map(c => c.targetNodeId));
  let startNode = nodes.find(n => n.type === 'greeting') || 
                  nodes.find(n => !nodesWithIncoming.has(n.id)) ||
                  nodes[0];

  // Build flow instructions by traversing the graph
  const flowInstructions: string[] = [];
  const visited = new Set<string>();

  function describeNode(node: FlowNode, depth: number = 0): string {
    const indent = "  ".repeat(depth);
    const config = node.config as Record<string, any> || {};
    
    switch (node.type) {
      case 'greeting':
        return `${indent}START: ${node.content || node.label}`;
      case 'question':
        return `${indent}ASK: "${node.content || node.label}"`;
      case 'condition':
        const condition = config.condition || node.label;
        return `${indent}IF: ${condition}`;
      case 'action':
        const action = config.action || node.content || node.label;
        return `${indent}DO: ${action}`;
      case 'transfer':
        const transferTo = config.transferTo || config.department || 'staff';
        return `${indent}TRANSFER: Connect caller to ${transferTo}`;
      case 'end':
        return `${indent}END: ${node.content || 'Thank them and end the call'}`;
      default:
        return `${indent}${node.type.toUpperCase()}: ${node.content || node.label}`;
    }
  }

  function traverseFlow(nodeId: string, depth: number = 0, pathVisited: Set<string> = new Set()) {
    // Use path-specific visited set to allow convergent branches
    if (pathVisited.has(nodeId)) return; // Prevent cycles in current path only
    if (depth > 15) {
      flowInstructions.push(`${"  ".repeat(depth)}[...flow continues]`);
      return;
    }

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Create new path set for this branch
    const newPathVisited = new Set(pathVisited);
    newPathVisited.add(nodeId);

    // Only describe node if not already described globally
    if (!visited.has(nodeId)) {
      flowInstructions.push(describeNode(node, depth));
      visited.add(nodeId);
    } else {
      flowInstructions.push(`${"  ".repeat(depth)}[continues to: ${node.label}]`);
      return; // Don't re-traverse already described nodes
    }

    // Get outgoing connections
    const outgoing = adjacencyList.get(nodeId) || [];
    
    if (outgoing.length === 1) {
      // Single path - continue linearly
      flowInstructions.push(`${"  ".repeat(depth)}  ↓`);
      traverseFlow(outgoing[0].targetId, depth, newPathVisited);
    } else if (outgoing.length > 1) {
      // Multiple paths - show branching
      outgoing.forEach((conn, idx) => {
        const branchLabel = conn.label || `Option ${idx + 1}`;
        flowInstructions.push(`${"  ".repeat(depth)}  → [${branchLabel}]:`);
        traverseFlow(conn.targetId, depth + 1, newPathVisited);
      });
    }
  }

  if (startNode) {
    traverseFlow(startNode.id);
  }

  // Also include any disconnected nodes
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      flowInstructions.push(`\nADDITIONAL: ${describeNode(node, 0)}`);
    }
  });

  if (flowInstructions.length === 0) {
    return "";
  }

  return `\n\n=== CONVERSATION WORKFLOW (MUST FOLLOW) ===
You MUST follow this conversation workflow structure. This defines your conversation path:

${flowInstructions.join('\n')}

WORKFLOW RULES:
1. START with the greeting/start node when beginning a conversation
2. FOLLOW the workflow path - move through nodes in the defined order
3. At BRANCH points (conditions), choose the appropriate path based on user response
4. COLLECT required information at each step before proceeding to the next
5. Use the EXACT actions specified (book reservation, take order, transfer call, etc.)
6. END the conversation only when reaching an END node or completing the flow
7. Stay WITHIN the workflow - do not invent steps not defined in the flow
8. Be natural and conversational while following the structure

=== END WORKFLOW ===`;
}

// Default values for agents without custom configuration
const DEFAULT_SYSTEM_PROMPT = `You are a friendly and helpful AI assistant for a restaurant. Your job is to:
- Answer questions about the menu, hours, and services
- Help customers with reservations and orders
- Provide information about specials and promotions
- Be warm, professional, and conversational

Always be helpful and provide accurate information based on what you know.`;

const DEFAULT_PERSONALITY = "Warm, friendly, and professional. Speak naturally like a helpful restaurant host.";

const DEFAULT_GREETING = "Hello! Thank you for calling. How can I help you today?";

export async function generateAgentResponse(
  systemPrompt: string,
  greetingMessage: string,
  personality: string,
  knowledgeContext: string,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
  flowContext?: string
): Promise<string> {
  try {
    // Use defaults for empty or missing values
    const effectiveSystemPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    const effectivePersonality = personality?.trim() || DEFAULT_PERSONALITY;
    const effectiveGreeting = greetingMessage?.trim() || DEFAULT_GREETING;
    const effectiveKnowledge = knowledgeContext?.trim() || "No specific knowledge base configured yet.";
    const effectiveFlowContext = flowContext?.trim() || "";
    
    const fullSystemPrompt = `${effectiveSystemPrompt}

PERSONALITY: ${effectivePersonality}

GREETING: When starting a conversation, use this greeting: "${effectiveGreeting}"

KNOWLEDGE BASE:
${effectiveKnowledge}
${effectiveFlowContext}

You are a helpful restaurant AI assistant. Use the knowledge base to answer questions accurately.${effectiveFlowContext ? ' You MUST follow the conversation workflow defined above - this is your primary directive. Guide the conversation according to the workflow steps while remaining natural and friendly.' : ' Be conversational and helpful.'}`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: fullSystemPrompt },
    ];

    // Add conversation history
    if (conversationHistory.length === 0) {
      // First message - include greeting
      messages.push({ role: "assistant", content: effectiveGreeting });
    } else {
      conversationHistory.forEach((msg) => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Add current user message
    messages.push({ role: "user", content: userMessage });

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      max_completion_tokens: 500,
    });

    return response.choices[0].message.content || "I apologize, I couldn't generate a response.";
  } catch (error: any) {
    console.error("OpenAI API error:", error);
    
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your API key billing status or try again later.");
    }
    
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key. Please check your configuration.");
    }
    
    if (error?.status === 503 || error?.code === 'overloaded_error') {
      throw new Error("OpenAI service is temporarily overloaded. Please try again in a moment.");
    }
    
    throw new Error("Failed to generate agent response. Please try again.");
  }
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    const file = new File([audioBuffer], "audio.webm", { type: "audio/webm" });
    
    const response = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    return response.text;
  } catch (error: any) {
    console.error("OpenAI Whisper API error:", error);
    
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your API key billing status or try again later.");
    }
    
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key. Please check your configuration.");
    }
    
    throw new Error("Failed to transcribe audio. Please try again.");
  }
}

export interface VoiceConfig {
  provider: string;
  voiceId: string;
  speed?: string;
  volume?: string;
  model?: string;
}

export async function synthesizeSpeech(text: string, config?: VoiceConfig): Promise<Buffer> {
  try {
    const voiceId = config?.voiceId || "nova";
    const speed = config?.speed ? parseFloat(config.speed) : 1.0;
    
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voiceId as any,
      input: text,
      speed: Math.max(0.25, Math.min(4.0, speed)),
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (error: any) {
    console.error("OpenAI TTS API error:", error);
    
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your API key billing status or try again later.");
    }
    
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      throw new Error("Invalid OpenAI API key. Please check your configuration.");
    }
    
    throw new Error("Failed to synthesize speech. Please try again.");
  }
}

export interface Voice {
  id: string;
  name: string;
  provider: string;
  language: string;
  gender?: string;
  description?: string;
}

export interface CallAnalysis {
  callerName: string | null;
  sentiment: 'positive' | 'neutral' | 'negative';
  callOutcome: string;
  orderSummary: string | null;
}

export async function analyzeCallTranscript(transcript: string): Promise<CallAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are analyzing a restaurant phone call transcript. Extract the following information and respond in JSON format:
{
  "callerName": "The caller's name if they provided it, or null if unknown",
  "sentiment": "positive" | "neutral" | "negative" (overall tone of the call),
  "callOutcome": "order_placed" | "reservation_made" | "info_provided" | "transferred" | "callback_scheduled" | "no_resolution",
  "orderSummary": "A brief summary of what was ordered (e.g. '2x Margherita Pizza, 1x Caesar Salad, 1x Coke'), or null if no order was placed"
}
Be concise and accurate. Only set orderSummary if an order was actually confirmed/placed.`
        },
        {
          role: "user",
          content: transcript,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { callerName: null, sentiment: 'neutral', callOutcome: 'no_resolution', orderSummary: null };
    }

    const parsed = JSON.parse(content);
    return {
      callerName: parsed.callerName || null,
      sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      callOutcome: parsed.callOutcome || 'no_resolution',
      orderSummary: parsed.orderSummary || null,
    };
  } catch (error) {
    console.error("Error analyzing call transcript:", error);
    return { callerName: null, sentiment: 'neutral', callOutcome: 'no_resolution', orderSummary: null };
  }
}

export async function listOpenAIVoices(): Promise<Voice[]> {
  return [
    { id: "alloy", name: "Alloy", provider: "openai", language: "en", gender: "neutral", description: "Neutral and balanced" },
    { id: "echo", name: "Echo", provider: "openai", language: "en", gender: "male", description: "Clear and articulate" },
    { id: "fable", name: "Fable", provider: "openai", language: "en", gender: "neutral", description: "Warm and expressive" },
    { id: "onyx", name: "Onyx", provider: "openai", language: "en", gender: "male", description: "Deep and authoritative" },
    { id: "nova", name: "Nova", provider: "openai", language: "en", gender: "female", description: "Friendly and engaging" },
    { id: "shimmer", name: "Shimmer", provider: "openai", language: "en", gender: "female", description: "Soft and pleasant" },
  ];
}
