// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateAgentResponse } from "./openai";
import { insertAgentSchema, insertKnowledgeBaseSchema, updateKnowledgeBaseSchema, insertActionSchema, insertContactSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}
