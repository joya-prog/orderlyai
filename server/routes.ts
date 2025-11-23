// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateAgentResponse, transcribeAudio, synthesizeSpeech, listOpenAIVoices, VoiceConfig } from "./openai";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
import { insertAgentSchema, insertKnowledgeBaseSchema, updateKnowledgeBaseSchema, insertActionSchema, insertContactSchema, insertPhoneNumberSchema, updatePhoneNumberSchema, insertIntegrationConfigSchema, insertAnalyticsEventSchema } from "@shared/schema";
import twilio from "twilio";
import crypto from "crypto";

// Initialize Twilio client
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilioAccountSid && twilioAuthToken 
  ? twilio(twilioAccountSid, twilioAuthToken) 
  : null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Agent routes
  app.get("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getAgents(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      // Verify ownership
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertAgentSchema.parse({ ...req.body, userId });
      const agent = await storage.createAgent(data);
      res.json(agent);
    } catch (error: any) {
      console.error("Error creating agent:", error);
      res.status(400).json({ message: error.message || "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const updated = await storage.updateAgent(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // Knowledge base routes
  // Get all knowledge items for the current user (across all agents)
  app.get("/api/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getAllKnowledgeBase(userId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching all knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  // Get knowledge items for a specific agent
  app.get("/api/agents/:id/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Storage layer enforces ownership check internally
      const items = await storage.getKnowledgeBase(req.params.id, userId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  // Create knowledge item (can specify agentId in body)
  app.post("/api/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertKnowledgeBaseSchema.parse(req.body);
      // Storage layer enforces ownership check internally
      const item = await storage.createKnowledgeBase(data, userId);
      if (!item) {
        return res.status(403).json({ message: "Forbidden: Agent not found or not owned by user" });
      }
      res.json(item);
    } catch (error: any) {
      console.error("Error creating knowledge item:", error);
      res.status(400).json({ message: error.message || "Failed to create knowledge item" });
    }
  });

  // Bulk import knowledge items with transaction
  app.post("/api/knowledge/bulk-import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Invalid import data" });
      }

      // Validate all items
      const validatedItems = items.map(item => insertKnowledgeBaseSchema.parse(item));

      // Storage layer enforces ownership check internally for all agents
      const imported = await storage.bulkCreateKnowledgeBase(validatedItems, userId);
      if (!imported) {
        return res.status(403).json({ message: "Forbidden: One or more agents not found or not owned by user" });
      }
      res.json({ success: true, count: imported.length });
    } catch (error: any) {
      console.error("Error bulk importing knowledge items:", error);
      res.status(400).json({ message: error.message || "Failed to bulk import knowledge items" });
    }
  });

  app.post("/api/agents/:id/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertKnowledgeBaseSchema.parse({ ...req.body, agentId: req.params.id });
      // Storage layer enforces ownership check internally
      const item = await storage.createKnowledgeBase(data, userId);
      if (!item) {
        return res.status(403).json({ message: "Forbidden: Agent not found or not owned by user" });
      }
      res.json(item);
    } catch (error: any) {
      console.error("Error creating knowledge item:", error);
      res.status(400).json({ message: error.message || "Failed to create knowledge item" });
    }
  });

  app.patch("/api/knowledge/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate and sanitize update data using dedicated schema
      // This schema explicitly whitelists only category/question/answer
      // and can never include agentId, ensuring tenant safety
      const validated = updateKnowledgeBaseSchema.parse(req.body);
      
      // Storage layer enforces ownership AND UpdateKnowledgeBase type - defense in depth
      const updated = await storage.updateKnowledgeBase(req.params.id, userId, validated);
      if (!updated) {
        return res.status(404).json({ message: "Knowledge item not found or access denied" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating knowledge item:", error);
      res.status(400).json({ message: error.message || "Failed to update knowledge item" });
    }
  });

  app.delete("/api/knowledge/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Storage layer enforces ownership check internally
      const success = await storage.deleteKnowledgeBase(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ message: "Knowledge item not found or access denied" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting knowledge item:", error);
      res.status(500).json({ message: "Failed to delete knowledge item" });
    }
  });

  // Agent testing route
  app.post("/api/agents/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { message, history = [] } = req.body;

      // Get knowledge base for context - storage layer enforces ownership
      const userId = req.user.claims.sub;
      const knowledgeItems = await storage.getKnowledgeBase(req.params.id, userId);
      const knowledgeContext = knowledgeItems
        .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
        .join("\n\n");

      // Generate response using OpenAI
      const response = await generateAgentResponse(
        agent.systemPrompt,
        agent.greetingMessage,
        agent.personality,
        knowledgeContext,
        history,
        message
      );

      // Save test conversation
      await storage.saveTestConversation({
        agentId: req.params.id,
        messages: [...history, { role: "user", content: message }, { role: "assistant", content: response }],
      });

      res.json({ response });
    } catch (error) {
      console.error("Error testing agent:", error);
      res.status(500).json({ message: "Failed to test agent" });
    }
  });

  // Voice transcription route
  app.post("/api/agents/:id/transcribe", isAuthenticated, upload.single("audio"), async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No audio file provided" });
      }

      const transcript = await transcribeAudio(req.file.buffer);
      res.json({ text: transcript });
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ message: error.message || "Failed to transcribe audio" });
    }
  });

  // Voice synthesis route
  app.post("/api/agents/:id/synthesize", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ message: "No text provided" });
      }

      const voiceConfig: VoiceConfig = {
        provider: agent.voiceProvider || 'openai',
        voiceId: agent.voiceId || 'nova',
        speed: agent.voiceSpeed || '1.0',
        volume: agent.voiceVolume || '100',
      };

      const audioBuffer = await synthesizeSpeech(text, voiceConfig);
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("Error synthesizing speech:", error);
      res.status(500).json({ message: error.message || "Failed to synthesize speech" });
    }
  });

  // Voice listing route
  app.get("/api/voices/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const { provider } = req.params;
      
      if (provider === 'openai') {
        const voices = await listOpenAIVoices();
        res.json(voices);
      } else if (provider === 'elevenlabs') {
        const { getElevenLabsVoices } = await import('./elevenlabs');
        const voices = await getElevenLabsVoices();
        res.json(voices);
      } else if (provider === 'cartesia') {
        res.status(501).json({ message: "Cartesia voices coming soon" });
      } else {
        res.status(400).json({ message: "Invalid voice provider" });
      }
    } catch (error: any) {
      console.error("Error listing voices:", error);
      res.status(500).json({ message: error.message || "Failed to list voices" });
    }
  });

  // Voice preview route
  app.post("/api/voices/:provider/preview", isAuthenticated, async (req: any, res) => {
    try {
      const { provider } = req.params;
      const { voiceId, text } = req.body;
      
      if (!voiceId) {
        return res.status(400).json({ message: "Voice ID required" });
      }

      const previewText = text || "Hello! How can I help you today?";
      
      if (provider === 'openai') {
        const voiceConfig: VoiceConfig = {
          provider: 'openai',
          voiceId: voiceId,
          speed: '1.0',
        };
        const audioBuffer = await synthesizeSpeech(previewText, voiceConfig);
        
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", audioBuffer.length);
        res.send(audioBuffer);
      } else if (provider === 'elevenlabs') {
        const { previewElevenLabsVoice } = await import('./elevenlabs');
        const audioBuffer = await previewElevenLabsVoice(voiceId, previewText);
        
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", audioBuffer.length);
        res.send(audioBuffer);
      } else if (provider === 'cartesia') {
        res.status(501).json({ message: "Cartesia preview coming soon" });
      } else {
        res.status(400).json({ message: "Invalid voice provider" });
      }
    } catch (error: any) {
      console.error("Error generating voice preview:", error);
      res.status(500).json({ message: error.message || "Failed to generate voice preview" });
    }
  });

  // Template routes
  app.get("/api/templates", isAuthenticated, async (req: any, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  app.post("/api/templates/use", isAuthenticated, async (req: any, res) => {
    try {
      const { templateId } = req.body;
      const template = await storage.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const userId = req.user.claims.sub;
      const agent = await storage.createAgent({
        userId,
        name: `${template.name} (Copy)`,
        description: template.description,
        industry: template.industry,
        status: "draft",
        greetingMessage: template.greetingMessage,
        personality: template.personality,
        systemPrompt: template.systemPrompt,
      });

      // Add default knowledge if provided
      if (template.defaultKnowledge && Array.isArray(template.defaultKnowledge)) {
        for (const item of template.defaultKnowledge as any[]) {
          await storage.createKnowledgeBase({
            agentId: agent.id,
            category: item.category || "faq",
            question: item.question,
            answer: item.answer,
          }, userId);
        }
      }

      res.json({ agentId: agent.id });
    } catch (error) {
      console.error("Error using template:", error);
      res.status(500).json({ message: "Failed to create agent from template" });
    }
  });

  // Flow nodes routes
  app.get("/api/agents/:id/flow-nodes", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const nodes = await storage.getFlowNodes(req.params.id);
      res.json(nodes);
    } catch (error) {
      console.error("Error fetching flow nodes:", error);
      res.status(500).json({ message: "Failed to fetch flow nodes" });
    }
  });

  app.post("/api/agents/:id/flow-nodes/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const { nodes } = req.body;
      const existingNodes = await storage.getFlowNodes(req.params.id);
      const savedNodeIds = new Set(nodes.map((n: any) => n.id));
      
      // Delete nodes that are no longer in the flow
      for (const node of existingNodes) {
        if (!savedNodeIds.has(node.id)) {
          await storage.deleteFlowNode(node.id);
        }
      }

      // Upsert nodes (update if exists, create if new) to preserve IDs
      const resultNodes = [];
      for (const node of nodes) {
        const exists = existingNodes.find(n => n.id === node.id);
        if (exists) {
          const updated = await storage.updateFlowNode(node.id, node);
          resultNodes.push(updated);
        } else {
          const created = await storage.createFlowNode(node);
          resultNodes.push(created);
        }
      }

      res.json(resultNodes);
    } catch (error) {
      console.error("Error saving flow nodes:", error);
      res.status(500).json({ message: "Failed to save flow nodes" });
    }
  });

  // Flow connections routes
  app.get("/api/agents/:id/flow-connections", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const connections = await storage.getFlowConnections(req.params.id);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching flow connections:", error);
      res.status(500).json({ message: "Failed to fetch flow connections" });
    }
  });

  app.post("/api/agents/:id/flow-connections/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { connections } = req.body;
      const existingConnections = await storage.getFlowConnections(req.params.id);
      
      // Delete all existing connections and recreate (edges are simpler - no need to preserve IDs)
      for (const conn of existingConnections) {
        await storage.deleteFlowConnection(conn.id);
      }

      // Create new connections
      const createdConnections = [];
      for (const conn of connections) {
        const created = await storage.createFlowConnection(conn);
        createdConnections.push(created);
      }

      res.json(createdConnections);
    } catch (error) {
      console.error("Error saving flow connections:", error);
      res.status(500).json({ message: "Failed to save flow connections" });
    }
  });

  // Actions routes
  app.get("/api/actions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const actions = await storage.getActions(userId);
      res.json(actions);
    } catch (error) {
      console.error("Error fetching actions:", error);
      res.status(500).json({ message: "Failed to fetch actions" });
    }
  });

  app.get("/api/actions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const action = await storage.getAction(req.params.id);
      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }
      if (action.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(action);
    } catch (error) {
      console.error("Error fetching action:", error);
      res.status(500).json({ message: "Failed to fetch action" });
    }
  });

  app.post("/api/actions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertActionSchema.parse({ ...req.body, userId });
      const action = await storage.createAction(data);
      res.json(action);
    } catch (error: any) {
      console.error("Error creating action:", error);
      res.status(400).json({ message: error.message || "Failed to create action" });
    }
  });

  app.patch("/api/actions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const updated = await storage.updateAction(req.params.id, userId, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Action not found or forbidden" });
      }
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating action:", error);
      res.status(400).json({ message: error.message || "Failed to update action" });
    }
  });

  app.delete("/api/actions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const deleted = await storage.deleteAction(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Action not found or forbidden" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting action:", error);
      res.status(500).json({ message: "Failed to delete action" });
    }
  });

  app.post("/api/actions/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const action = await storage.getAction(req.params.id);
      if (!action) {
        return res.status(404).json({ message: "Action not found" });
      }
      if (action.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate and parse headers
      const headers: Record<string, string> = {};
      if (action.headers) {
        try {
          const parsedHeaders = JSON.parse(JSON.stringify(action.headers));
          if (!Array.isArray(parsedHeaders)) {
            return res.status(400).json({ message: "Headers must be an array" });
          }
          
          // Limit to 20 headers to prevent abuse
          if (parsedHeaders.length > 20) {
            return res.status(400).json({ message: "Maximum 20 headers allowed" });
          }
          
          for (const h of parsedHeaders) {
            // Coerce to string and trim
            let key = '';
            let value = '';
            
            if (h.key !== null && h.key !== undefined) {
              key = String(h.key).trim();
            }
            
            if (h.value !== null && h.value !== undefined) {
              value = String(h.value).trim();
            }
            
            if (!key || !value) {
              return res.status(400).json({ message: "Header keys and values cannot be empty or whitespace" });
            }
            
            headers[key] = value;
          }
        } catch (error) {
          return res.status(400).json({ message: "Invalid headers format" });
        }
      }

      // Validate body template if present
      let requestBody = undefined;
      if (action.bodyTemplate && (action.method === 'POST' || action.method === 'PUT')) {
        try {
          // Validate it's valid JSON
          JSON.parse(action.bodyTemplate);
          requestBody = action.bodyTemplate;
        } catch (error) {
          return res.status(400).json({ message: "Invalid JSON in body template" });
        }
      }

      const requestOptions: RequestInit = {
        method: action.method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        signal: AbortSignal.timeout(30000), // 30 second timeout
      };

      if (requestBody) {
        requestOptions.body = requestBody;
      }

      // Execute the action with timeout
      const response = await fetch(action.endpoint, requestOptions);
      
      // Extract response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      // Parse response body based on content-type
      const contentType = response.headers.get('content-type') || 'text/plain';
      let responseBody: unknown;
      
      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch (error) {
          responseBody = await response.text();
        }
      } else if (contentType.includes('text/')) {
        responseBody = await response.text();
      } else {
        // Binary or unknown content type
        responseBody = `Binary content (${contentType}). ${await response.text().catch(() => 'Unable to read body')}`;
      }

      res.json({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        contentType,
      });
    } catch (error: any) {
      console.error("Error testing action:", error);
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return res.status(408).json({ message: "Request timeout after 30 seconds" });
      }
      res.status(500).json({ message: error.message || "Failed to test action" });
    }
  });

  // Contact routes
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const searchQuery = req.query.search as string | undefined;
      const contacts = await storage.getContacts(userId, searchQuery);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.get("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      // Verify ownership
      if (contact.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ message: "Failed to fetch contact" });
    }
  });

  app.post("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertContactSchema.omit({ userId: true }).parse(req.body);
      const contact = await storage.createContact({ ...validated, userId });
      res.json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contact = await storage.updateContact(req.params.id, userId, req.body);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found or access denied" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await storage.deleteContact(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ message: "Contact not found or access denied" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // Phone number routes
  app.get("/api/phone-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const phoneNumbers = await storage.getPhoneNumbers(userId);
      res.json(phoneNumbers);
    } catch (error) {
      console.error("Error fetching phone numbers:", error);
      res.status(500).json({ message: "Failed to fetch phone numbers" });
    }
  });

  app.post("/api/phone-numbers/search", isAuthenticated, async (req: any, res) => {
    try {
      if (!twilioClient) {
        return res.status(503).json({ message: "Twilio not configured" });
      }

      const { areaCode, country = 'US' } = req.body;
      
      const availableNumbers = await twilioClient.availablePhoneNumbers(country)
        .local.list({ areaCode, limit: 20 });

      res.json(availableNumbers.map(num => ({
        phoneNumber: num.phoneNumber,
        friendlyName: num.friendlyName,
        capabilities: num.capabilities,
      })));
    } catch (error) {
      console.error("Error searching phone numbers:", error);
      res.status(500).json({ message: "Failed to search phone numbers" });
    }
  });

  app.post("/api/phone-numbers/purchase", isAuthenticated, async (req: any, res) => {
    try {
      if (!twilioClient) {
        return res.status(503).json({ message: "Twilio not configured" });
      }

      const userId = req.user.claims.sub;
      const { phoneNumber, friendlyName } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Purchase the number from Twilio
      const incomingNumber = await twilioClient.incomingPhoneNumbers.create({
        phoneNumber,
        friendlyName: friendlyName || phoneNumber,
      });

      // Prepare data matching schema requirements
      const phoneNumberData = {
        userId,
        number: incomingNumber.phoneNumber,
        friendlyName: (friendlyName && friendlyName.trim()) || incomingNumber.friendlyName || null,
        provider: 'twilio',
        providerId: incomingNumber.sid,
        status: 'active',
        capabilities: incomingNumber.capabilities,
      };

      const created = await storage.createPhoneNumber(phoneNumberData);
      res.json(created);
    } catch (error: any) {
      console.error("Error purchasing phone number:", error);
      res.status(500).json({ message: error.message || "Failed to purchase phone number" });
    }
  });

  app.patch("/api/phone-numbers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate with Zod schema
      const validated = updatePhoneNumberSchema.parse(req.body);

      // Remove undefined values to prevent corruption
      const cleanedData: any = {};
      for (const [key, value] of Object.entries(validated)) {
        if (value !== undefined) {
          cleanedData[key] = value;
        }
      }

      // Ensure at least one field remains after cleaning
      if (Object.keys(cleanedData).length === 0) {
        return res.status(400).json({ message: "At least one field must be provided for update" });
      }

      const phoneNumber = await storage.updatePhoneNumber(req.params.id, userId, cleanedData);
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found or access denied" });
      }
      res.json(phoneNumber);
    } catch (error: any) {
      console.error("Error updating phone number:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid update data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update phone number" });
    }
  });

  app.delete("/api/phone-numbers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const phoneNumber = await storage.getPhoneNumber(req.params.id);

      if (!phoneNumber || phoneNumber.userId !== userId) {
        return res.status(404).json({ message: "Phone number not found or access denied" });
      }

      // Release from Twilio (only if client is configured)
      if (twilioClient && phoneNumber.providerId) {
        try {
          await twilioClient.incomingPhoneNumbers(phoneNumber.providerId).remove();
        } catch (twilioError) {
          console.error("Error releasing from Twilio:", twilioError);
          // Continue with database deletion even if Twilio fails
        }
      }

      // Delete from database (works even without Twilio client)
      const success = await storage.deletePhoneNumber(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ message: "Failed to delete phone number" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting phone number:", error);
      res.status(500).json({ message: "Failed to delete phone number" });
    }
  });

  // Integration routes
  app.get("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const integrations = await storage.getIntegrations(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertIntegrationConfigSchema.parse({ ...req.body, userId });
      const integration = await storage.createIntegration(data);
      res.json(integration);
    } catch (error: any) {
      console.error("Error creating integration:", error);
      res.status(400).json({ message: error.message || "Failed to create integration" });
    }
  });

  app.patch("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const integration = await storage.updateIntegration(req.params.id, userId, req.body);
      if (!integration) {
        return res.status(404).json({ message: "Integration not found or access denied" });
      }
      res.json(integration);
    } catch (error) {
      console.error("Error updating integration:", error);
      res.status(500).json({ message: "Failed to update integration" });
    }
  });

  app.delete("/api/integrations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const success = await storage.deleteIntegration(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ message: "Integration not found or access denied" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting integration:", error);
      res.status(500).json({ message: "Failed to delete integration" });
    }
  });

  // Square OAuth routes
  app.get("/api/integrations/square/oauth/init", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const clientId = process.env.SQUARE_CLIENT_ID;
    const redirectUri = process.env.SQUARE_OAUTH_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return res.status(500).json({ message: "Square OAuth not configured. Please set SQUARE_CLIENT_ID and SQUARE_OAUTH_REDIRECT_URI." });
    }

    // Generate cryptographically secure state nonce and store in database
    const nonce = crypto.randomBytes(32).toString('hex');
    await storage.createOAuthState({
      nonce,
      userId,
      service: 'square',
    });

    const scopes = ['MERCHANT_PROFILE_READ', 'ITEMS_READ', 'ORDERS_READ', 'ORDERS_WRITE'].join(' ');
    const authUrl = `https://connect.squareup.com/oauth2/authorize?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.redirect(authUrl);
  });

  app.get("/api/integrations/square/oauth/callback", async (req: any, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.redirect('/integrations?error=missing_code');
      }

      // Verify state against database-stored nonce
      const oauthState = await storage.getOAuthState(state as string);
      if (!oauthState || oauthState.service !== 'square') {
        console.error('OAuth state mismatch or not found in database');
        return res.redirect('/integrations?error=invalid_state');
      }

      // Check if state is stale (older than 10 minutes)
      const stateAge = Date.now() - new Date(oauthState.createdAt).getTime();
      if (stateAge > 600000) {
        await storage.deleteOAuthState(state as string);
        return res.redirect('/integrations?error=expired_state');
      }

      // Use userId from database state, not from query params
      const userId = oauthState.userId;
      await storage.deleteOAuthState(state as string); // Clean up used nonce

      const clientId = process.env.SQUARE_CLIENT_ID;
      const clientSecret = process.env.SQUARE_CLIENT_SECRET;
      const redirectUri = process.env.SQUARE_OAUTH_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        return res.redirect('/integrations?error=oauth_not_configured');
      }

      const tokenResponse = await fetch('https://connect.squareup.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Square OAuth error:', await tokenResponse.text());
        return res.redirect('/integrations?error=token_exchange_failed');
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_at, merchant_id } = tokenData;

      const existingIntegrations = await storage.getIntegrations(userId);
      const existingSquare = existingIntegrations.find(i => i.service === 'square');

      if (existingSquare) {
        await storage.updateIntegration(existingSquare.id, userId, {
          status: 'active',
          credentials: { access_token, refresh_token, expires_at, merchant_id },
        });
      } else {
        await storage.createIntegration({
          userId,
          service: 'square',
          name: 'Square POS',
          status: 'active',
          credentials: { access_token, refresh_token, expires_at, merchant_id },
        });
      }

      res.redirect('/integrations?success=square_connected');
    } catch (error) {
      console.error('Square OAuth callback error:', error);
      res.redirect('/integrations?error=callback_failed');
    }
  });

  // Toast OAuth routes
  app.get("/api/integrations/toast/oauth/init", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const clientId = process.env.TOAST_CLIENT_ID;
    const redirectUri = process.env.TOAST_OAUTH_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      return res.status(500).json({ message: "Toast OAuth not configured. Please set TOAST_CLIENT_ID and TOAST_OAUTH_REDIRECT_URI." });
    }

    // Generate cryptographically secure state nonce and store in database
    const nonce = crypto.randomBytes(32).toString('hex');
    await storage.createOAuthState({
      nonce,
      userId,
      service: 'toast',
    });

    const authUrl = `https://ws-api.toasttab.com/authentication/v1/oauth/authorize?client_id=${clientId}&response_type=code&state=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    res.redirect(authUrl);
  });

  app.get("/api/integrations/toast/oauth/callback", async (req: any, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.redirect('/integrations?error=missing_code');
      }

      // Verify state against database-stored nonce
      const oauthState = await storage.getOAuthState(state as string);
      if (!oauthState || oauthState.service !== 'toast') {
        console.error('OAuth state mismatch or not found in database');
        return res.redirect('/integrations?error=invalid_state');
      }

      // Check if state is stale (older than 10 minutes)
      const stateAge = Date.now() - new Date(oauthState.createdAt).getTime();
      if (stateAge > 600000) {
        await storage.deleteOAuthState(state as string);
        return res.redirect('/integrations?error=expired_state');
      }

      // Use userId from database state, not from query params
      const userId = oauthState.userId;
      await storage.deleteOAuthState(state as string); // Clean up used nonce

      const clientId = process.env.TOAST_CLIENT_ID;
      const clientSecret = process.env.TOAST_CLIENT_SECRET;
      const redirectUri = process.env.TOAST_OAUTH_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        return res.redirect('/integrations?error=oauth_not_configured');
      }

      const tokenResponse = await fetch('https://ws-api.toasttab.com/authentication/v1/oauth/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        console.error('Toast OAuth error:', await tokenResponse.text());
        return res.redirect('/integrations?error=token_exchange_failed');
      }

      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token, expires_in } = tokenData;
      const expires_at = new Date(Date.now() + (expires_in * 1000)).toISOString();

      const existingIntegrations = await storage.getIntegrations(userId);
      const existingToast = existingIntegrations.find(i => i.service === 'toast');

      if (existingToast) {
        await storage.updateIntegration(existingToast.id, userId, {
          status: 'active',
          credentials: { access_token, refresh_token, expires_at },
        });
      } else {
        await storage.createIntegration({
          userId,
          service: 'toast',
          name: 'Toast POS',
          status: 'active',
          credentials: { access_token, refresh_token, expires_at },
        });
      }

      res.redirect('/integrations?success=toast_connected');
    } catch (error) {
      console.error('Toast OAuth callback error:', error);
      res.redirect('/integrations?error=callback_failed');
    }
  });

  // Analytics routes
  app.get("/api/analytics/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { agentId, eventType, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (agentId) filters.agentId = agentId;
      if (eventType) filters.eventType = eventType;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const events = await storage.getAnalyticsEvents(userId, filters);
      res.json(events);
    } catch (error) {
      console.error("Error fetching analytics events:", error);
      res.status(500).json({ message: "Failed to fetch analytics events" });
    }
  });

  app.post("/api/analytics/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = insertAnalyticsEventSchema.parse({ ...req.body, userId });
      const event = await storage.createAnalyticsEvent(data);
      res.json(event);
    } catch (error: any) {
      console.error("Error creating analytics event:", error);
      res.status(400).json({ message: error.message || "Failed to create analytics event" });
    }
  });

  app.get("/api/analytics/overview", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;

      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const overview = await storage.getAnalyticsOverview(userId, filters);
      res.json(overview);
    } catch (error) {
      console.error("Error fetching analytics overview:", error);
      res.status(500).json({ message: "Failed to fetch analytics overview" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
