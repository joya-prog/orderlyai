import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// AI Agents table
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  industry: text("industry").notNull(), // 'fine_dining', 'casual_dining', 'catering', 'hotel'
  status: text("status").notNull().default('draft'), // 'draft', 'testing', 'active', 'paused'
  greetingMessage: text("greeting_message").notNull(),
  personality: text("personality").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  
  // General Configuration
  voiceEngine: text("voice_engine").notNull().default('1.0'), // '1.0', '2.0'
  aiModel: text("ai_model").notNull().default('gpt-4o'), // 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo'
  timezone: text("timezone").notNull().default('US/Pacific'),
  customVocabulary: text("custom_vocabulary").array().default(sql`'{}'::text[]`),
  filterWords: text("filter_words").array().default(sql`'{}'::text[]`),
  useFillerWords: boolean("use_filler_words").default(false),
  
  // Voice Configuration
  voiceProvider: text("voice_provider").notNull().default('openai'), // 'openai', 'elevenlabs', 'cartesia'
  voiceId: text("voice_id").notNull().default('nova'),
  voiceName: text("voice_name"),
  language: text("language").notNull().default('en'),
  voiceSpeed: text("voice_speed").notNull().default('1.0'), // 0.5 - 2.0
  voiceVolume: text("voice_volume").notNull().default('100'), // 0 - 100
  interruptionSensitivity: text("interruption_sensitivity").notNull().default('0'), // 0-5 words
  voicePrompting: text("voice_prompting"),
  patienceLevel: text("patience_level").notNull().default('medium'), // 'low', 'medium', 'high'
  speechRecognition: text("speech_recognition").notNull().default('faster'), // 'faster', 'high_accuracy'
  
  // Call Configuration
  optimizeLatency: text("optimize_latency").notNull().default('0'), // '0', '1', '2', '3', '4'
  stability: text("stability").notNull().default('50'), // 0-100
  styleExaggeration: text("style_exaggeration").notNull().default('0'), // 0-100
  similarity: text("similarity").notNull().default('75'), // 0-100
  maxIdleDuration: text("max_idle_duration").notNull().default('7'), // seconds
  speakerBoost: boolean("speaker_boost").default(false),
  idleReminders: boolean("idle_reminders").default(true),
  idleReminderMessage: text("idle_reminder_message").default("I'm still here. Do you have any questions?"),
  idleReminderInterval: text("idle_reminder_interval").notNull().default('4'), // seconds
  pauseBeforeSpeaking: text("pause_before_speaking").notNull().default('0'), // seconds
  ringDuration: text("ring_duration").notNull().default('0'), // seconds
  limitCallDuration: boolean("limit_call_duration").default(true),
  maxCallDuration: text("max_call_duration").notNull().default('20'), // minutes
  enableRecordings: boolean("enable_recordings").default(false),
  enableTranscripts: boolean("enable_transcripts").default(true),
  limitDataRetention: boolean("limit_data_retention").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Flow nodes for agent conversation logic
export const flowNodes = pgTable("flow_nodes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'greeting', 'question', 'condition', 'action', 'transfer', 'end'
  label: text("label").notNull(),
  content: text("content"), // Question text, action description, etc.
  position: jsonb("position").notNull(), // {x: number, y: number}
  config: jsonb("config"), // Node-specific configuration
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlowNodeSchema = createInsertSchema(flowNodes).omit({
  createdAt: true,
}).extend({
  id: z.string().optional(), // Allow client to provide ID to preserve edge connections
});

export type InsertFlowNode = z.infer<typeof insertFlowNodeSchema>;
export type FlowNode = typeof flowNodes.$inferSelect;

// Flow connections between nodes
export const flowConnections = pgTable("flow_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }),
  sourceNodeId: varchar("source_node_id").notNull().references(() => flowNodes.id, { onDelete: 'cascade' }),
  targetNodeId: varchar("target_node_id").notNull().references(() => flowNodes.id, { onDelete: 'cascade' }),
  label: text("label"), // Optional label for connection
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFlowConnectionSchema = createInsertSchema(flowConnections).omit({
  createdAt: true,
}).extend({
  id: z.string().optional(), // Allow client to provide ID if needed
});

export type InsertFlowConnection = z.infer<typeof insertFlowConnectionSchema>;
export type FlowConnection = typeof flowConnections.$inferSelect;

// Knowledge base items for each agent
export const knowledgeBase = pgTable("knowledge_base", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }),
  category: text("category").notNull(), // 'menu', 'hours', 'policies', 'faq', 'custom'
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;

// Update schema: only allows updating content fields, never agentId
export const updateKnowledgeBaseSchema = z.object({
  category: z.enum(["menu", "hours", "policies", "faq", "custom"]).optional(),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
});
export type UpdateKnowledgeBase = z.infer<typeof updateKnowledgeBaseSchema>;

// Agent templates
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  industry: text("industry").notNull(),
  greetingMessage: text("greeting_message").notNull(),
  personality: text("personality").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  defaultKnowledge: jsonb("default_knowledge"), // Pre-filled FAQ and knowledge items
  flowTemplate: jsonb("flow_template"), // Pre-configured flow nodes
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
});

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// Test conversations for debugging
export const testConversations = pgTable("test_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => agents.id, { onDelete: 'cascade' }),
  messages: jsonb("messages").notNull(), // Array of {role: 'user'|'assistant', content: string}
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTestConversationSchema = createInsertSchema(testConversations).omit({
  id: true,
  createdAt: true,
});

export type InsertTestConversation = z.infer<typeof insertTestConversationSchema>;
export type TestConversation = typeof testConversations.$inferSelect;

// Contacts table for CRM
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  tags: text("tags").array(), // Array of tags for filtering
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Phone numbers (Twilio integration)
export const phoneNumbers = pgTable("phone_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: 'set null' }), // Can be unassigned
  number: varchar("number").notNull().unique(),
  friendlyName: text("friendly_name"), // User-defined label for the number
  provider: text("provider").notNull().default('twilio'), // 'twilio', 'vonage', etc.
  providerId: varchar("provider_id"), // Provider's ID for this number (Twilio SID)
  status: text("status").notNull().default('active'), // 'active', 'inactive', 'pending'
  capabilities: jsonb("capabilities"), // {voice: true, sms: true}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPhoneNumberSchema = createInsertSchema(phoneNumbers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePhoneNumberSchema = z.object({
  friendlyName: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  status: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update",
});

export type InsertPhoneNumber = z.infer<typeof insertPhoneNumberSchema>;
export type UpdatePhoneNumber = z.infer<typeof updatePhoneNumberSchema>;
export type PhoneNumber = typeof phoneNumbers.$inferSelect;

// Custom actions/webhooks
export const actions = pgTable("actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'webhook', 'api_call', 'database_query'
  method: text("method").notNull().default('POST'), // 'GET', 'POST', 'PUT', 'DELETE'
  endpoint: text("endpoint").notNull(),
  headers: jsonb("headers"), // Custom headers
  bodyTemplate: text("body_template"), // Template for request body
  responseMapping: jsonb("response_mapping"), // How to parse response
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertActionSchema = createInsertSchema(actions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAction = z.infer<typeof insertActionSchema>;
export type Action = typeof actions.$inferSelect;

// Integration configurations
export const integrationConfigs = pgTable("integration_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: text("service").notNull(), // 'square', 'toast' (OAuth), 'twilio', 'stripe', 'calendly'
  name: text("name").notNull(),
  status: text("status").notNull().default('inactive'), // 'active', 'inactive', 'error'
  credentials: jsonb("credentials").notNull(), // OAuth tokens: {access_token, refresh_token, expires_at, merchant_id} or API keys
  config: jsonb("config"), // Service-specific configuration
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIntegrationConfigSchema = createInsertSchema(integrationConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;

// Menu items from POS systems
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  integrationId: varchar("integration_id").references(() => integrationConfigs.id, { onDelete: 'cascade' }),
  posId: varchar("pos_id"), // ID in the POS system
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  price: text("price").notNull(), // Stored as text to handle decimal precision
  modifiers: jsonb("modifiers"), // Available customizations
  available: boolean("available").default(true),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

// Orders placed through agents
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: 'set null' }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'set null' }),
  integrationId: varchar("integration_id").references(() => integrationConfigs.id, { onDelete: 'set null' }),
  posOrderId: varchar("pos_order_id"), // ID in the POS system
  items: jsonb("items").notNull(), // Array of {menuItemId, name, quantity, price, modifiers}
  subtotal: text("subtotal").notNull(),
  tax: text("tax"),
  total: text("total").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'confirmed', 'preparing', 'completed', 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Call logs for tracking all interactions
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: 'set null' }),
  contactId: varchar("contact_id").references(() => contacts.id, { onDelete: 'set null' }),
  phoneNumberId: varchar("phone_number_id").references(() => phoneNumbers.id, { onDelete: 'set null' }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: 'set null' }),
  callSid: varchar("call_sid"), // Twilio call SID
  direction: text("direction").notNull(), // 'inbound', 'outbound'
  fromNumber: varchar("from_number"),
  toNumber: varchar("to_number"),
  duration: text("duration"), // Duration in seconds (legacy field)
  durationSeconds: text("duration_seconds"), // Duration in seconds
  durationMinutes: text("duration_minutes"), // Duration in minutes (for billing)
  status: text("status").notNull(), // 'completed', 'busy', 'no-answer', 'failed'
  billingStatus: text("billing_status").default('pending'), // 'pending', 'reported', 'billed'
  transcript: text("transcript"),
  recordingUrl: text("recording_url"),
  metadata: jsonb("metadata"), // Additional call data
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCallLog = z.infer<typeof insertCallLogSchema>;
export type CallLog = typeof callLogs.$inferSelect;

// Analytics events for tracking agent performance and usage
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: 'set null' }),
  eventType: text("event_type").notNull(), // 'call_started', 'call_ended', 'intent_detected', 'order_placed', 'reservation_made', 'transfer', 'error'
  eventData: jsonb("event_data"), // Additional event-specific data
  duration: text("duration"), // For call_ended events (in seconds)
  metadata: jsonb("metadata"), // Extra context
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// OAuth state storage for secure OAuth flows
export const oauthStates = pgTable("oauth_states", {
  nonce: varchar("nonce").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: text("service").notNull(), // 'square', 'toast'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOAuthStateSchema = createInsertSchema(oauthStates).omit({
  createdAt: true,
});

export type InsertOAuthState = z.infer<typeof insertOAuthStateSchema>;
export type OAuthState = typeof oauthStates.$inferSelect;

// Subscriptions table for billing management
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  planType: text("plan_type").notNull().default('trial'), // 'trial', 'starter', 'professional', 'business', 'enterprise'
  status: text("status").notNull().default('active'), // 'active', 'canceled', 'past_due', 'trialing'
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  
  // Usage limits based on plan
  minutesLimit: text("minutes_limit").notNull().default('60'), // Monthly call minutes
  agentsLimit: text("agents_limit").notNull().default('1'), // Number of AI agents allowed
  phoneNumbersLimit: text("phone_numbers_limit").notNull().default('1'), // Number of phone numbers
  concurrentCallsLimit: text("concurrent_calls_limit").notNull().default('2'), // Max concurrent calls
  
  // Features enabled
  posIntegrationsEnabled: boolean("pos_integrations_enabled").default(false),
  analyticsEnabled: boolean("analytics_enabled").default(false),
  customWorkflowsEnabled: boolean("custom_workflows_enabled").default(false),
  prioritySupportEnabled: boolean("priority_support_enabled").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Usage metrics for tracking consumption
export const usageMetrics = pgTable("usage_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: varchar("subscription_id").notNull().references(() => subscriptions.id, { onDelete: 'cascade' }),
  
  // Current billing period metrics
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Usage counters
  minutesUsed: text("minutes_used").notNull().default('0'), // Total call minutes used
  activeAgents: text("active_agents").notNull().default('0'), // Current active agents
  activePhoneNumbers: text("active_phone_numbers").notNull().default('0'), // Current phone numbers
  totalCalls: text("total_calls").notNull().default('0'), // Total calls in period
  
  // Overage tracking
  overageMinutes: text("overage_minutes").notNull().default('0'), // Minutes over limit
  overageCharges: text("overage_charges").notNull().default('0'), // Charges for overages
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUsageMetricSchema = createInsertSchema(usageMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUsageMetric = z.infer<typeof insertUsageMetricSchema>;
export type UsageMetric = typeof usageMetrics.$inferSelect;

// Usage ledger for tracking call minutes per billing period (for Stripe metered billing)
export const usageLedger = pgTable("usage_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: 'set null' }),
  callLogId: varchar("call_log_id").references(() => callLogs.id, { onDelete: 'set null' }),
  
  // Billing period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Usage tracking
  minutesUsed: text("minutes_used").notNull().default('0'),
  
  // Stripe reporting
  reportedToStripeAt: timestamp("reported_to_stripe_at"),
  stripeUsageRecordId: varchar("stripe_usage_record_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUsageLedgerSchema = createInsertSchema(usageLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertUsageLedger = z.infer<typeof insertUsageLedgerSchema>;
export type UsageLedger = typeof usageLedger.$inferSelect;

// Invoices table for tracking Stripe invoices
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeInvoiceId: varchar("stripe_invoice_id").unique(),
  
  // Invoice details
  status: text("status").notNull().default('draft'), // 'draft', 'open', 'paid', 'uncollectible', 'void'
  amountDue: text("amount_due").notNull().default('0'), // In cents
  amountPaid: text("amount_paid").notNull().default('0'),
  currency: text("currency").notNull().default('usd'),
  
  // Period info
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  
  // PDF
  hostedInvoiceUrl: text("hosted_invoice_url"),
  invoicePdfUrl: text("invoice_pdf_url"),
  
  // Line items summary
  lineItemsSummary: jsonb("line_items_summary"), // [{description, amount}]
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
