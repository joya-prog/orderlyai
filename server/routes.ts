// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateAgentResponse } from "./openai";
import { insertAgentSchema, insertKnowledgeBaseSchema, updateKnowledgeBaseSchema } from "@shared/schema";

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

  const httpServer = createServer(app);
  return httpServer;
}
