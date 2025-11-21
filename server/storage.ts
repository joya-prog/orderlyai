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
  getKnowledgeBase(agentId: string): Promise<KnowledgeBase[]>;
  createKnowledgeBase(item: InsertKnowledgeBase): Promise<KnowledgeBase>;
  deleteKnowledgeBase(id: string): Promise<void>;

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
  async getKnowledgeBase(agentId: string): Promise<KnowledgeBase[]> {
    return await db.select().from(knowledgeBase).where(eq(knowledgeBase.agentId, agentId));
  }

  async createKnowledgeBase(item: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [created] = await db.insert(knowledgeBase).values(item).returning();
    return created;
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id));
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
