// Reference: javascript_database and javascript_log_in_with_replit blueprints
import {
  users,
  agents,
  flowNodes,
  flowConnections,
  knowledgeBase,
  templates,
  testConversations,
  actions,
  contacts,
  phoneNumbers,
  integrationConfigs,
  analyticsEvents,
  oauthStates,
  subscriptions,
  usageMetrics,
  usageLedger,
  invoices,
  callLogs,
  orders,
  passwordResetTokens,
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
  type Action,
  type InsertAction,
  type Contact,
  type InsertContact,
  type PhoneNumber,
  type InsertPhoneNumber,
  type IntegrationConfig,
  type InsertIntegrationConfig,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type OAuthState,
  type InsertOAuthState,
  type Subscription,
  type InsertSubscription,
  type UsageMetric,
  type InsertUsageMetric,
  type UsageLedger,
  type InsertUsageLedger,
  type Invoice,
  type InsertInvoice,
  type CallLog,
  type InsertCallLog,
  type Order,
  type PasswordResetToken,
  type InsertPasswordResetToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, like, or, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(userData: Partial<UpsertUser>): Promise<User>;
  linkGoogleAccount(userId: string, googleId: string): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserOnboarding(id: string, data: {
    restaurantName: string;
    restaurantType: string;
    restaurantPhone?: string;
    restaurantWebsite?: string;
  }): Promise<User>;

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

  // Actions operations
  getActions(userId: string): Promise<Action[]>;
  getAction(id: string): Promise<Action | undefined>;
  createAction(action: InsertAction): Promise<Action>;
  updateAction(id: string, userId: string, action: Partial<InsertAction>): Promise<Action | null>;
  deleteAction(id: string, userId: string): Promise<boolean>;

  // Contact operations
  getContacts(userId: string, searchQuery?: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string, userId: string): Promise<Contact | null>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, userId: string, contact: Partial<InsertContact>): Promise<Contact | null>;
  deleteContact(id: string, userId: string): Promise<boolean>;

  // Order operations (for repeat customer recognition)
  getOrdersForContact(contactId: string, limit?: number): Promise<Order[]>;

  // Phone number operations
  getPhoneNumbers(userId: string): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string): Promise<PhoneNumber | undefined>;
  getPhoneNumberByNumber(number: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: string, userId: string, phoneNumber: Partial<InsertPhoneNumber>): Promise<PhoneNumber | null>;
  deletePhoneNumber(id: string, userId: string): Promise<boolean>;

  // Integration operations
  getIntegrations(userId: string): Promise<IntegrationConfig[]>;
  getIntegration(id: string, userId: string): Promise<IntegrationConfig | null>;
  getIntegrationByService(service: string, userId: string): Promise<IntegrationConfig | null>;
  createIntegration(integration: InsertIntegrationConfig): Promise<IntegrationConfig>;
  updateIntegration(id: string, userId: string, integration: Partial<InsertIntegrationConfig>): Promise<IntegrationConfig | null>;
  deleteIntegration(id: string, userId: string): Promise<boolean>;

  // Analytics operations
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(userId: string, filters?: { agentId?: string; eventType?: string; startDate?: Date; endDate?: Date }): Promise<AnalyticsEvent[]>;
  getAnalyticsOverview(userId: string, filters?: { startDate?: Date; endDate?: Date }): Promise<{ totalCalls: number; totalOrders: number; totalReservations: number; avgDuration: number; events: number }>;

  // OAuth state operations
  createOAuthState(state: InsertOAuthState): Promise<OAuthState>;
  getOAuthState(nonce: string): Promise<OAuthState | undefined>;
  deleteOAuthState(nonce: string): Promise<boolean>;
  cleanupExpiredOAuthStates(): Promise<number>;

  // Subscription operations
  getSubscription(userId: string): Promise<Subscription | null>;
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  updateSubscription(userId: string, subscription: Partial<InsertSubscription>): Promise<Subscription | null>;
  deleteSubscription(userId: string): Promise<boolean>;

  // Usage metrics operations
  getCurrentUsageMetrics(userId: string): Promise<UsageMetric | null>;
  createUsageMetrics(metrics: InsertUsageMetric): Promise<UsageMetric>;
  updateUsageMetrics(userId: string, metrics: Partial<InsertUsageMetric>): Promise<UsageMetric | null>;

  // Usage ledger operations (for Stripe metered billing)
  createUsageLedgerEntry(entry: InsertUsageLedger): Promise<UsageLedger>;
  getUnreportedUsageEntries(userId: string): Promise<UsageLedger[]>;
  markUsageReported(id: string, stripeUsageRecordId: string): Promise<UsageLedger | null>;
  getTotalUsageForPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<number>;

  // Invoice operations
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoiceByStripeId(stripeInvoiceId: string): Promise<Invoice | null>;
  updateInvoice(stripeInvoiceId: string, invoice: Partial<InsertInvoice>): Promise<Invoice | null>;

  // Call log operations for billing
  createCallLog(callLog: InsertCallLog): Promise<CallLog>;
  getCallLogById(id: string): Promise<CallLog | null>;
  getCallLogByCallSid(callSid: string): Promise<CallLog | null>;
  updateCallLog(id: string, callLog: Partial<InsertCallLog>): Promise<CallLog | null>;
  getCallLogsForUser(userId: string, startDate?: Date, endDate?: Date): Promise<CallLog[]>;

  // Get user by Stripe customer ID
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null>;

  // Password reset token operations
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | null>;
  markPasswordResetTokenUsed(token: string): Promise<boolean>;
  invalidatePriorResetTokens(userId: string): Promise<number>;
  deleteExpiredPasswordResetTokens(): Promise<number>;
  updateUserPassword(userId: string, passwordHash: string): Promise<User | null>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user;
  }

  async createUser(userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db.insert(users).values(userData as UpsertUser).returning();
    return user;
  }

  async linkGoogleAccount(userId: string, googleId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ googleId, authProvider: 'google', updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
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

  async updateUserOnboarding(id: string, data: {
    restaurantName: string;
    restaurantType: string;
    restaurantPhone?: string;
    restaurantWebsite?: string;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        restaurantName: data.restaurantName,
        restaurantType: data.restaurantType,
        restaurantPhone: data.restaurantPhone || null,
        restaurantWebsite: data.restaurantWebsite || null,
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
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

  // Actions operations
  async getActions(userId: string): Promise<Action[]> {
    return await db.select().from(actions).where(eq(actions.userId, userId));
  }

  async getAction(id: string): Promise<Action | undefined> {
    const [action] = await db.select().from(actions).where(eq(actions.id, id));
    return action;
  }

  async createAction(action: InsertAction): Promise<Action> {
    const [created] = await db.insert(actions).values(action).returning();
    return created;
  }

  async updateAction(id: string, userId: string, action: Partial<InsertAction>): Promise<Action | null> {
    // Verify ownership
    const existing = await this.getAction(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const [updated] = await db
      .update(actions)
      .set({ ...action, updatedAt: new Date() })
      .where(eq(actions.id, id))
      .returning();
    return updated;
  }

  async deleteAction(id: string, userId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.getAction(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    await db.delete(actions).where(eq(actions.id, id));
    return true;
  }

  // Contact operations
  async getContacts(userId: string, searchQuery?: string): Promise<Contact[]> {
    if (!searchQuery) {
      return await db.select().from(contacts).where(eq(contacts.userId, userId));
    }

    // Search by name, email, phone, or notes
    return await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, userId),
          or(
            like(contacts.name, `%${searchQuery}%`),
            like(contacts.email, `%${searchQuery}%`),
            like(contacts.phone, `%${searchQuery}%`),
            like(contacts.notes, `%${searchQuery}%`)
          )
        )
      );
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async getContactByPhone(phone: string, userId: string): Promise<Contact | null> {
    // Normalize phone number for comparison (remove non-digits except +)
    const normalizedPhone = phone.replace(/[^\d+]/g, '');
    
    // Try exact match first
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.phone, phone)));
    
    if (contact) return contact;
    
    // Try with normalized phone if no exact match
    const [contactNormalized] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.userId, userId), eq(contacts.phone, normalizedPhone)));
    
    return contactNormalized || null;
  }

  async getOrdersForContact(contactId: string, limit: number = 5): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.contactId, contactId))
      .orderBy(sql`${orders.createdAt} DESC`)
      .limit(limit);
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [created] = await db.insert(contacts).values(contact).returning();
    return created;
  }

  async updateContact(id: string, userId: string, contact: Partial<InsertContact>): Promise<Contact | null> {
    // Verify ownership
    const existing = await this.getContact(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const [updated] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updated;
  }

  async deleteContact(id: string, userId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.getContact(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    await db.delete(contacts).where(eq(contacts.id, id));
    return true;
  }

  // Phone number operations
  async getPhoneNumbers(userId: string): Promise<PhoneNumber[]> {
    return await db.select().from(phoneNumbers).where(eq(phoneNumbers.userId, userId));
  }

  async getPhoneNumber(id: string): Promise<PhoneNumber | undefined> {
    const [phoneNumber] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.id, id));
    return phoneNumber;
  }

  async getPhoneNumberByNumber(number: string): Promise<PhoneNumber | undefined> {
    const [phoneNumber] = await db.select().from(phoneNumbers).where(eq(phoneNumbers.number, number));
    return phoneNumber;
  }

  async createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber> {
    const [created] = await db.insert(phoneNumbers).values(phoneNumber).returning();
    return created;
  }

  async updatePhoneNumber(id: string, userId: string, phoneNumber: Partial<InsertPhoneNumber>): Promise<PhoneNumber | null> {
    // Verify ownership
    const existing = await this.getPhoneNumber(id);
    if (!existing || existing.userId !== userId) {
      return null;
    }

    const [updated] = await db
      .update(phoneNumbers)
      .set({ ...phoneNumber, updatedAt: new Date() })
      .where(eq(phoneNumbers.id, id))
      .returning();
    return updated;
  }

  async deletePhoneNumber(id: string, userId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.getPhoneNumber(id);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    await db.delete(phoneNumbers).where(eq(phoneNumbers.id, id));
    return true;
  }

  // Integration operations
  async getIntegrations(userId: string): Promise<IntegrationConfig[]> {
    return await db.select().from(integrationConfigs).where(eq(integrationConfigs.userId, userId));
  }

  async getIntegration(id: string, userId: string): Promise<IntegrationConfig | null> {
    const [integration] = await db.select().from(integrationConfigs).where(
      and(eq(integrationConfigs.id, id), eq(integrationConfigs.userId, userId))
    );
    return integration || null;
  }

  async getIntegrationByService(service: string, userId: string): Promise<IntegrationConfig | null> {
    const [integration] = await db.select().from(integrationConfigs).where(
      and(eq(integrationConfigs.service, service), eq(integrationConfigs.userId, userId))
    );
    return integration || null;
  }

  async createIntegration(integration: InsertIntegrationConfig): Promise<IntegrationConfig> {
    const [created] = await db.insert(integrationConfigs).values(integration).returning();
    return created;
  }

  async updateIntegration(id: string, userId: string, integration: Partial<InsertIntegrationConfig>): Promise<IntegrationConfig | null> {
    // Verify ownership
    const existing = await this.getIntegration(id, userId);
    if (!existing) {
      return null;
    }

    const [updated] = await db
      .update(integrationConfigs)
      .set({ ...integration, updatedAt: new Date() })
      .where(eq(integrationConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteIntegration(id: string, userId: string): Promise<boolean> {
    // Verify ownership
    const existing = await this.getIntegration(id, userId);
    if (!existing) {
      return false;
    }

    await db.delete(integrationConfigs).where(eq(integrationConfigs.id, id));
    return true;
  }

  // Analytics operations
  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [created] = await db.insert(analyticsEvents).values(event).returning();
    return created;
  }

  async getAnalyticsEvents(userId: string, filters?: { agentId?: string; eventType?: string; startDate?: Date; endDate?: Date }): Promise<AnalyticsEvent[]> {
    const conditions = [eq(analyticsEvents.userId, userId)];

    if (filters?.agentId) {
      conditions.push(eq(analyticsEvents.agentId, filters.agentId));
    }
    if (filters?.eventType) {
      conditions.push(eq(analyticsEvents.eventType, filters.eventType));
    }
    if (filters?.startDate) {
      conditions.push(sql`${analyticsEvents.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${analyticsEvents.createdAt} <= ${filters.endDate}`);
    }

    return await db.select().from(analyticsEvents).where(and(...conditions));
  }

  async getAnalyticsOverview(userId: string, filters?: { startDate?: Date; endDate?: Date }): Promise<{ totalCalls: number; totalOrders: number; totalReservations: number; avgDuration: number; events: number }> {
    const events = await this.getAnalyticsEvents(userId, filters);

    const totalCalls = events.filter(e => e.eventType === 'call_started').length;
    const totalOrders = events.filter(e => e.eventType === 'order_placed').length;
    const totalReservations = events.filter(e => e.eventType === 'reservation_made').length;
    
    // Filter call_ended events and validate duration is a valid number
    const callEndedWithValidDuration = events
      .filter(e => e.eventType === 'call_ended' && e.duration != null)
      .map(e => {
        const parsed = parseInt(e.duration!, 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((d): d is number => d !== null && d >= 0);

    const avgDuration = callEndedWithValidDuration.length > 0
      ? callEndedWithValidDuration.reduce((sum, duration) => sum + duration, 0) / callEndedWithValidDuration.length
      : 0;

    return {
      totalCalls,
      totalOrders,
      totalReservations,
      avgDuration: Math.round(avgDuration),
      events: events.length,
    };
  }

  // OAuth state operations
  async createOAuthState(state: InsertOAuthState): Promise<OAuthState> {
    const [created] = await db.insert(oauthStates).values(state).returning();
    return created;
  }

  async getOAuthState(nonce: string): Promise<OAuthState | undefined> {
    const [state] = await db.select().from(oauthStates).where(eq(oauthStates.nonce, nonce));
    return state;
  }

  async deleteOAuthState(nonce: string): Promise<boolean> {
    const result = await db.delete(oauthStates).where(eq(oauthStates.nonce, nonce));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async cleanupExpiredOAuthStates(): Promise<number> {
    // Delete OAuth states older than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 600000);
    const result = await db.delete(oauthStates).where(sql`${oauthStates.createdAt} < ${tenMinutesAgo}`);
    return result.rowCount || 0;
  }

  // Subscription operations
  async getSubscription(userId: string): Promise<Subscription | null> {
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return subscription || null;
  }

  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(subscription).returning();
    return created;
  }

  async updateSubscription(userId: string, subscription: Partial<InsertSubscription>): Promise<Subscription | null> {
    const [updated] = await db
      .update(subscriptions)
      .set({ ...subscription, updatedAt: new Date() })
      .where(eq(subscriptions.userId, userId))
      .returning();
    return updated || null;
  }

  async deleteSubscription(userId: string): Promise<boolean> {
    const result = await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Usage metrics operations
  async getCurrentUsageMetrics(userId: string): Promise<UsageMetric | null> {
    // Get the subscription first
    const subscription = await this.getSubscription(userId);
    if (!subscription) return null;

    // Get the most recent usage metrics for this subscription
    const [metrics] = await db
      .select()
      .from(usageMetrics)
      .where(eq(usageMetrics.subscriptionId, subscription.id))
      .orderBy(sql`${usageMetrics.createdAt} DESC`)
      .limit(1);

    return metrics || null;
  }

  async createUsageMetrics(metrics: InsertUsageMetric): Promise<UsageMetric> {
    const [created] = await db.insert(usageMetrics).values(metrics).returning();
    return created;
  }

  async updateUsageMetrics(userId: string, metrics: Partial<InsertUsageMetric>): Promise<UsageMetric | null> {
    // Get subscription
    const subscription = await this.getSubscription(userId);
    if (!subscription) return null;

    // Update the most recent metrics for this subscription
    const [updated] = await db
      .update(usageMetrics)
      .set({ ...metrics, updatedAt: new Date() })
      .where(eq(usageMetrics.subscriptionId, subscription.id))
      .returning();

    return updated || null;
  }

  // Usage ledger operations (for Stripe metered billing)
  async createUsageLedgerEntry(entry: InsertUsageLedger): Promise<UsageLedger> {
    const [created] = await db.insert(usageLedger).values(entry).returning();
    return created;
  }

  async getUnreportedUsageEntries(userId: string): Promise<UsageLedger[]> {
    return await db
      .select()
      .from(usageLedger)
      .where(and(
        eq(usageLedger.userId, userId),
        sql`${usageLedger.reportedToStripeAt} IS NULL`
      ));
  }

  async markUsageReported(id: string, stripeUsageRecordId: string): Promise<UsageLedger | null> {
    const [updated] = await db
      .update(usageLedger)
      .set({ 
        reportedToStripeAt: new Date(),
        stripeUsageRecordId,
      })
      .where(eq(usageLedger.id, id))
      .returning();
    return updated || null;
  }

  async getTotalUsageForPeriod(userId: string, periodStart: Date, periodEnd: Date): Promise<number> {
    const entries = await db
      .select()
      .from(usageLedger)
      .where(and(
        eq(usageLedger.userId, userId),
        sql`${usageLedger.periodStart} >= ${periodStart}`,
        sql`${usageLedger.periodEnd} <= ${periodEnd}`
      ));
    
    return entries.reduce((sum, entry) => sum + parseFloat(entry.minutesUsed || '0'), 0);
  }

  // Invoice operations
  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [created] = await db.insert(invoices).values(invoice).returning();
    return created;
  }

  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db
      .select()
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(sql`${invoices.createdAt} DESC`);
  }

  async getInvoiceByStripeId(stripeInvoiceId: string): Promise<Invoice | null> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId));
    return invoice || null;
  }

  async updateInvoice(stripeInvoiceId: string, invoice: Partial<InsertInvoice>): Promise<Invoice | null> {
    const [updated] = await db
      .update(invoices)
      .set({ ...invoice, updatedAt: new Date() })
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .returning();
    return updated || null;
  }

  // Call log operations for billing
  async createCallLog(callLog: InsertCallLog): Promise<CallLog> {
    const [created] = await db.insert(callLogs).values(callLog).returning();
    return created;
  }

  async getCallLogById(id: string): Promise<CallLog | null> {
    const [log] = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.id, id));
    return log || null;
  }

  async getCallLogByCallSid(callSid: string): Promise<CallLog | null> {
    const [log] = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.callSid, callSid));
    return log || null;
  }

  async updateCallLog(id: string, callLog: Partial<InsertCallLog>): Promise<CallLog | null> {
    const [updated] = await db
      .update(callLogs)
      .set(callLog)
      .where(eq(callLogs.id, id))
      .returning();
    return updated || null;
  }

  async getCallLogsForUser(userId: string, startDate?: Date, endDate?: Date): Promise<CallLog[]> {
    const conditions = [eq(callLogs.userId, userId)];
    
    if (startDate) {
      conditions.push(sql`${callLogs.createdAt} >= ${startDate}` as any);
    }
    if (endDate) {
      conditions.push(sql`${callLogs.createdAt} <= ${endDate}` as any);
    }
    
    return await db
      .select()
      .from(callLogs)
      .where(and(...conditions))
      .orderBy(sql`${callLogs.createdAt} DESC`);
  }

  // Get user by Stripe customer ID
  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
    
    if (!subscription) return null;
    
    const user = await this.getUser(subscription.userId);
    return user || null;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
    return subscription || null;
  }

  async getSubscriptionByStripeCustomerId(stripeCustomerId: string): Promise<Subscription | null> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
    return subscription || null;
  }

  // Password reset token operations
  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [created] = await db
      .insert(passwordResetTokens)
      .values(token)
      .returning();
    return created;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | null> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return resetToken || null;
  }

  async markPasswordResetTokenUsed(token: string): Promise<boolean> {
    const result = await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
    return true;
  }

  async invalidatePriorResetTokens(userId: string): Promise<number> {
    const result = await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(and(
        eq(passwordResetTokens.userId, userId),
        eq(passwordResetTokens.used, false)
      ));
    return 0;
  }

  async deleteExpiredPasswordResetTokens(): Promise<number> {
    const result = await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
    return 0;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<User | null> {
    const [updated] = await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated || null;
  }
}

export const storage = new DatabaseStorage();
