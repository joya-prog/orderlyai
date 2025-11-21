// Reference: javascript_database and javascript_log_in_with_replit blueprints
import {
  users,
  agents,
  flowNodes,
  flowConnections,
  knowledgeBase,
  templates,
  testConversations,
  type User,
  type UpsertUser,
  type Agent,
  type InsertAgent,
  type FlowNode,
  type InsertFlowNode,
  type FlowConnection,
  type InsertFlowConnection,
  type KnowledgeBase,
  type InsertKnowledgeBase,
  type UpdateKnowledgeBase,
  type Template,
  type InsertTemplate,
  type TestConversation,
  type InsertTestConversation,
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations - required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Agent operations
  getAgents(userId: string): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentForUser(id: string, userId: string): Promise<Agent | null>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;

  // Flow node operations
  getFlowNodes(agentId: string): Promise<FlowNode[]>;
  createFlowNode(node: InsertFlowNode): Promise<FlowNode>;
  updateFlowNode(id: string, node: Partial<InsertFlowNode>): Promise<FlowNode>;
  deleteFlowNode(id: string): Promise<void>;

  // Flow connection operations
  getFlowConnections(agentId: string): Promise<FlowConnection[]>;
  createFlowConnection(connection: InsertFlowConnection): Promise<FlowConnection>;
  deleteFlowConnection(id: string): Promise<void>;

  // Knowledge base operations
  getAllKnowledgeBase(userId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBase(agentId: string, userId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined>;
  getOwnedKnowledgeItem(id: string, userId: string): Promise<KnowledgeBase | null>;
  createKnowledgeBase(item: InsertKnowledgeBase, userId: string): Promise<KnowledgeBase | null>;
  bulkCreateKnowledgeBase(items: InsertKnowledgeBase[], userId: string): Promise<KnowledgeBase[] | null>;
  updateKnowledgeBase(id: string, userId: string, item: UpdateKnowledgeBase): Promise<KnowledgeBase | null>;
  deleteKnowledgeBase(id: string, userId: string): Promise<boolean>;

  // Template operations
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;

  // Test conversation operations
  saveTestConversation(conversation: InsertTestConversation): Promise<TestConversation>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Agent operations
  async getAgents(userId: string): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.userId, userId));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent;
  }

  async getAgentForUser(id: string, userId: string): Promise<Agent | null> {
    // Tenant-scoped agent lookup - single source of truth for agent ownership
    // Returns agent only if it exists AND belongs to the user
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)));
    return agent || null;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [created] = await db.insert(agents).values(agent).returning();
    return created;
  }

  async updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent> {
    const [updated] = await db
      .update(agents)
      .set({ ...agent, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();
    return updated;
  }

  async deleteAgent(id: string): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }

  // Flow node operations
  async getFlowNodes(agentId: string): Promise<FlowNode[]> {
    return await db.select().from(flowNodes).where(eq(flowNodes.agentId, agentId));
  }

  async createFlowNode(node: InsertFlowNode): Promise<FlowNode> {
    const [created] = await db.insert(flowNodes).values(node).returning();
    return created;
  }

  async updateFlowNode(id: string, node: Partial<InsertFlowNode>): Promise<FlowNode> {
    const [updated] = await db
      .update(flowNodes)
      .set(node)
      .where(eq(flowNodes.id, id))
      .returning();
    return updated;
  }

  async deleteFlowNode(id: string): Promise<void> {
    await db.delete(flowNodes).where(eq(flowNodes.id, id));
  }

  // Flow connection operations
  async getFlowConnections(agentId: string): Promise<FlowConnection[]> {
    return await db.select().from(flowConnections).where(eq(flowConnections.agentId, agentId));
  }

  async createFlowConnection(connection: InsertFlowConnection): Promise<FlowConnection> {
    const [created] = await db.insert(flowConnections).values(connection).returning();
    return created;
  }

  async deleteFlowConnection(id: string): Promise<void> {
    await db.delete(flowConnections).where(eq(flowConnections.id, id));
  }

  // Knowledge base operations
  async getAllKnowledgeBase(userId: string): Promise<KnowledgeBase[]> {
    // Get all knowledge items for all agents belonging to this user
    return await db
      .select({
        id: knowledgeBase.id,
        agentId: knowledgeBase.agentId,
        category: knowledgeBase.category,
        question: knowledgeBase.question,
        answer: knowledgeBase.answer,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      })
      .from(knowledgeBase)
      .innerJoin(agents, eq(knowledgeBase.agentId, agents.id))
      .where(eq(agents.userId, userId));
  }

  async getKnowledgeBase(agentId: string, userId: string): Promise<KnowledgeBase[]> {
    // Enforce ownership at storage layer using tenant-scoped helper
    const agent = await this.getAgentForUser(agentId, userId);
    if (!agent) {
      return []; // Agent doesn't exist or user doesn't own it
    }
    return await db.select().from(knowledgeBase).where(eq(knowledgeBase.agentId, agentId));
  }

  async getKnowledgeBaseItem(id: string): Promise<KnowledgeBase | undefined> {
    const [item] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id));
    return item;
  }

  async getOwnedKnowledgeItem(id: string, userId: string): Promise<KnowledgeBase | null> {
    // Centralized tenant-aware ownership check
    // Returns the item only if it belongs to an agent owned by the user
    const [result] = await db
      .select({
        id: knowledgeBase.id,
        agentId: knowledgeBase.agentId,
        category: knowledgeBase.category,
        question: knowledgeBase.question,
        answer: knowledgeBase.answer,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      })
      .from(knowledgeBase)
      .innerJoin(agents, eq(knowledgeBase.agentId, agents.id))
      .where(and(eq(knowledgeBase.id, id), eq(agents.userId, userId)));
    
    return result || null;
  }

  async createKnowledgeBase(item: InsertKnowledgeBase, userId: string): Promise<KnowledgeBase | null> {
    // Enforce ownership at storage layer using tenant-scoped helper
    const agent = await this.getAgentForUser(item.agentId, userId);
    if (!agent) {
      return null; // Agent doesn't exist or user doesn't own it
    }
    const [created] = await db.insert(knowledgeBase).values(item).returning();
    return created;
  }

  async bulkCreateKnowledgeBase(items: InsertKnowledgeBase[], userId: string): Promise<KnowledgeBase[] | null> {
    // Enforce ownership at storage layer using tenant-scoped helper
    // All items must belong to agents owned by the same user
    const agentIds = [...new Set(items.map(item => item.agentId))];
    for (const agentId of agentIds) {
      const agent = await this.getAgentForUser(agentId, userId);
      if (!agent) {
        return null; // At least one agent doesn't exist or user doesn't own it
      }
    }
    // All agents verified - safe to insert
    const created = await db.insert(knowledgeBase).values(items).returning();
    return created;
  }

  async updateKnowledgeBase(id: string, userId: string, item: UpdateKnowledgeBase): Promise<KnowledgeBase | null> {
    // Enforce ownership at storage layer - defense in depth
    // First verify the knowledge item belongs to an agent owned by the user
    const owned = await this.getOwnedKnowledgeItem(id, userId);
    if (!owned) {
      return null; // Item doesn't exist or user doesn't own it
    }

    // Only accepts UpdateKnowledgeBase type - enforces tenant-safe updates at data layer
    const [updated] = await db
      .update(knowledgeBase)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(knowledgeBase.id, id))
      .returning();
    return updated;
  }

  async deleteKnowledgeBase(id: string, userId: string): Promise<boolean> {
    // Enforce ownership at storage layer - defense in depth
    // First verify the knowledge item belongs to an agent owned by the user
    const owned = await this.getOwnedKnowledgeItem(id, userId);
    if (!owned) {
      return false; // Item doesn't exist or user doesn't own it
    }

    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
    return true;
  }

  // Template operations
  async getTemplates(): Promise<Template[]> {
    return await db.select().from(templates).where(eq(templates.isPublic, true));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const [created] = await db.insert(templates).values(template).returning();
    return created;
  }

  // Test conversation operations
  async saveTestConversation(conversation: InsertTestConversation): Promise<TestConversation> {
    const [saved] = await db.insert(testConversations).values(conversation).returning();
    return saved;
  }
}

export const storage = new DatabaseStorage();
