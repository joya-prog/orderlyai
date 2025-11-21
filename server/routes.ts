// Reference: javascript_log_in_with_replit blueprint
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateAgentResponse } from "./openai";
import { insertAgentSchema, insertKnowledgeBaseSchema } from "@shared/schema";

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
  app.get("/api/agents/:id/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const items = await storage.getKnowledgeBase(req.params.id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching knowledge base:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  app.post("/api/agents/:id/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const data = insertKnowledgeBaseSchema.parse({ ...req.body, agentId: req.params.id });
      const item = await storage.createKnowledgeBase(data);
      res.json(item);
    } catch (error: any) {
      console.error("Error creating knowledge item:", error);
      res.status(400).json({ message: error.message || "Failed to create knowledge item" });
    }
  });

  app.delete("/api/knowledge/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteKnowledgeBase(req.params.id);
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

      // Get knowledge base for context
      const knowledgeItems = await storage.getKnowledgeBase(req.params.id);
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
          });
        }
      }

      res.json({ agentId: agent.id });
    } catch (error) {
      console.error("Error using template:", error);
      res.status(500).json({ message: "Failed to create agent from template" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
