import type { FlowNode, FlowConnection, Agent } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface Transition {
  id: string;
  label: string;
  condition?: string;
  color?: string;
  targetNodeId?: string;
}

export interface WorkflowState {
  currentNodeId: string | null;
  conversationHistory: Array<{ role: string; content: string }>;
  visitedNodes: Set<string>;
}

export interface WorkflowExecutorResult {
  response: string;
  nextNodeId: string | null;
  nodeType: string;
  isEnd: boolean;
}

export class WorkflowExecutor {
  private nodes: Map<string, FlowNode>;
  private connections: FlowConnection[];
  private agent: Agent;
  private knowledgeContext: string;

  constructor(
    nodes: FlowNode[],
    connections: FlowConnection[],
    agent: Agent,
    knowledgeContext: string = ""
  ) {
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.connections = connections;
    this.agent = agent;
    this.knowledgeContext = knowledgeContext;
  }

  findStartNode(): FlowNode | null {
    const greetingNode = Array.from(this.nodes.values()).find(n => n.type === 'greeting');
    if (greetingNode) return greetingNode;

    const nodesWithIncoming = new Set(this.connections.map(c => c.targetNodeId));
    const rootNode = Array.from(this.nodes.values()).find(n => !nodesWithIncoming.has(n.id));
    if (rootNode) return rootNode;

    return this.nodes.size > 0 ? Array.from(this.nodes.values())[0] : null;
  }

  getGreeting(): string {
    const startNode = this.findStartNode();
    if (startNode && startNode.content) {
      return startNode.content;
    }
    return this.agent.greetingMessage;
  }

  getOutgoingConnections(nodeId: string): FlowConnection[] {
    return this.connections.filter(c => c.sourceNodeId === nodeId);
  }

  getNodeById(nodeId: string): FlowNode | undefined {
    return this.nodes.get(nodeId);
  }

  getTransitionsForNode(node: FlowNode): Transition[] {
    // Get transitions from outgoing connections instead of node.config
    // The flow builder stores transition labels on FlowConnection objects
    const outgoingConnections = this.getOutgoingConnections(node.id);
    
    if (outgoingConnections.length === 0) {
      return [];
    }
    
    // Build transitions from connection labels
    const transitions: Transition[] = outgoingConnections.map((conn, index) => ({
      id: conn.sourceHandle || conn.id,
      label: conn.label || `Option ${index + 1}`,
      condition: undefined,
      targetNodeId: conn.targetNodeId
    }));
    
    return transitions;
  }

  async evaluateTransition(
    currentNode: FlowNode,
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<{ nextNodeId: string | null; matchedTransition: Transition | null }> {
    const transitions = this.getTransitionsForNode(currentNode);
    
    if (transitions.length === 0) {
      return { nextNodeId: null, matchedTransition: null };
    }

    if (transitions.length === 1) {
      // Only one path, take it directly
      const transition = transitions[0];
      console.log(`[WorkflowExecutor] Single transition "${transition.label}" -> ${transition.targetNodeId}`);
      return { 
        nextNodeId: transition.targetNodeId || null, 
        matchedTransition: transition 
      };
    }

    // Multiple transitions - use GPT to classify which one matches user input
    const transitionDescriptions = transitions.map((t, i) => 
      `${i + 1}. "${t.label}" ${t.condition ? `(condition: ${t.condition})` : ''}`
    ).join('\n');

    const classificationPrompt = `You are evaluating which conversation path to take based on user input.

Current node: "${currentNode.label}" - "${currentNode.content || ''}"

Available transitions:
${transitionDescriptions}

User said: "${userInput}"

Based on the user's response, which transition number (1-${transitions.length}) best matches?
Think about what the user is asking for:
- If they mention "order", "food", "pickup", "delivery" -> look for order-related transition
- If they mention "reservation", "table", "booking" -> look for reservation-related transition
- If they mention "hours", "open", "close" -> look for hours/info transition

Reply with ONLY the number (e.g., "1" or "2"). If none clearly match, reply with "1" for the default path.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: classificationPrompt }],
        max_tokens: 10,
        temperature: 0.1,
      });

      const answer = response.choices[0]?.message?.content?.trim() || "1";
      const transitionIndex = parseInt(answer, 10) - 1;
      
      // Ensure valid index
      const validIndex = Math.max(0, Math.min(transitionIndex, transitions.length - 1));
      const selectedTransition = transitions[validIndex];
      
      console.log(`[WorkflowExecutor] User said: "${userInput}"`);
      console.log(`[WorkflowExecutor] Available transitions: ${transitions.map(t => t.label).join(', ')}`);
      console.log(`[WorkflowExecutor] GPT selected: #${validIndex + 1} "${selectedTransition.label}" -> ${selectedTransition.targetNodeId}`);

      return {
        nextNodeId: selectedTransition.targetNodeId || null,
        matchedTransition: selectedTransition
      };
    } catch (error) {
      console.error('[WorkflowExecutor] Error evaluating transition:', error);
      const fallbackTransition = transitions[0];
      return {
        nextNodeId: fallbackTransition.targetNodeId || null,
        matchedTransition: fallbackTransition
      };
    }
  }

  async executeNode(
    nodeId: string,
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<WorkflowExecutorResult> {
    const node = this.nodes.get(nodeId);
    
    if (!node) {
      return {
        response: "I apologize, but I seem to have lost track of our conversation. How can I help you?",
        nextNodeId: null,
        nodeType: 'unknown',
        isEnd: true
      };
    }

    let response = node.content || node.label;
    const config = node.config as Record<string, any> | null;

    switch (node.type) {
      case 'greeting':
      case 'response':
      case 'question':
        response = node.content || node.label;
        break;

      case 'collect_input':
        response = node.content || "Could you please provide that information?";
        break;

      case 'keypad_input':
        response = node.content || "Please enter your selection using your keypad.";
        break;

      case 'check_availability':
        response = node.content || "Let me check availability for you.";
        break;

      case 'book_reservation':
        response = node.content || "I'll book that reservation for you.";
        break;

      case 'take_order':
        response = node.content || "I'll take your order now.";
        break;

      case 'dietary_info':
        response = node.content || "Let me check that dietary information for you.";
        break;

      case 'condition':
        const { nextNodeId: conditionNext } = await this.evaluateTransition(node, userInput, conversationHistory);
        if (conditionNext) {
          return this.executeNode(conditionNext, userInput, conversationHistory);
        }
        response = node.content || "";
        break;

      case 'wait':
        const waitMs = config?.waitMs || 1000;
        response = node.content || "";
        break;

      case 'loop_back':
        const targetNodeId = config?.targetNodeId;
        if (targetNodeId && this.nodes.has(targetNodeId)) {
          return this.executeNode(targetNodeId, userInput, conversationHistory);
        }
        break;

      case 'transfer_call':
        const transferTo = config?.transferTo || config?.department || 'staff';
        response = node.content || `Let me transfer you to ${transferTo}.`;
        break;

      case 'press_digit':
        response = node.content || "";
        break;

      case 'end_call':
      case 'end':
        response = node.content || "Thank you for calling. Goodbye!";
        return {
          response,
          nextNodeId: null,
          nodeType: node.type,
          isEnd: true
        };

      default:
        response = node.content || node.label;
    }

    const { nextNodeId } = await this.evaluateTransition(node, userInput, conversationHistory);

    return {
      response,
      nextNodeId,
      nodeType: node.type,
      isEnd: node.type === 'end' || node.type === 'end_call'
    };
  }

  async processUserInput(
    state: WorkflowState,
    userInput: string
  ): Promise<{ response: string; newState: WorkflowState }> {
    if (!state.currentNodeId) {
      const startNode = this.findStartNode();
      if (!startNode) {
        return {
          response: this.agent.greetingMessage,
          newState: state
        };
      }
      state.currentNodeId = startNode.id;
    }

    const currentNode = this.nodes.get(state.currentNodeId);
    if (!currentNode) {
      return {
        response: "I apologize, but something went wrong. How can I help you?",
        newState: state
      };
    }

    const { nextNodeId, matchedTransition } = await this.evaluateTransition(
      currentNode,
      userInput,
      state.conversationHistory
    );

    if (!nextNodeId) {
      const fallbackResponse = await this.generateFallbackResponse(
        userInput,
        state.conversationHistory,
        currentNode
      );
      
      state.conversationHistory.push(
        { role: 'user', content: userInput },
        { role: 'assistant', content: fallbackResponse }
      );
      
      return {
        response: fallbackResponse,
        newState: state
      };
    }

    const result = await this.executeNode(nextNodeId, userInput, state.conversationHistory);

    state.currentNodeId = result.nextNodeId;
    state.visitedNodes.add(nextNodeId);
    state.conversationHistory.push(
      { role: 'user', content: userInput },
      { role: 'assistant', content: result.response }
    );

    return {
      response: result.response,
      newState: state
    };
  }

  private async generateFallbackResponse(
    userInput: string,
    conversationHistory: Array<{ role: string; content: string }>,
    currentNode: FlowNode
  ): Promise<string> {
    const prompt = `You are a helpful ${this.agent.personality} AI assistant for a restaurant.

Current conversation context: You're at the "${currentNode.label}" step.
Node content: "${currentNode.content || ''}"

${this.knowledgeContext ? `Knowledge base:\n${this.knowledgeContext}\n` : ''}

The user said something that doesn't clearly match any expected response. 
Provide a helpful response that:
1. Acknowledges what they said
2. Gently guides them back to the current conversation topic
3. Stays in character as ${this.agent.personality}

Keep your response concise and natural.`;

    try {
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: prompt },
        ...conversationHistory.slice(-6).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content
        })),
        { role: "user", content: userInput }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 150,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || 
        "I'm sorry, I didn't quite catch that. Could you please repeat?";
    } catch (error) {
      console.error('[WorkflowExecutor] Fallback response error:', error);
      return "I'm sorry, could you please repeat that?";
    }
  }

  createInitialState(): WorkflowState {
    const startNode = this.findStartNode();
    return {
      currentNodeId: startNode?.id || null,
      conversationHistory: [],
      visitedNodes: new Set(startNode ? [startNode.id] : [])
    };
  }
}

export function createWorkflowExecutor(
  nodes: FlowNode[],
  connections: FlowConnection[],
  agent: Agent,
  knowledgeContext: string = ""
): WorkflowExecutor {
  return new WorkflowExecutor(nodes, connections, agent, knowledgeContext);
}
