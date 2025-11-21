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
  id: true,
  createdAt: true,
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
  id: true,
  createdAt: true,
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
