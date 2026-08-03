import { z } from "zod";
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { toPublicUser } from "./sanitize";
import { billCallOnce, upsertCallLogBySid } from "./callBilling";
import { getSquareMenuContext, appendSquareMenuBlock } from "./squareMenu";
import { provisionNumberForRetell } from "./phoneProvisioning";

// Twilio sends inbound trunk calls here so they reach the voice provider.
// Retell issues an ACCOUNT-SPECIFIC origination URI (e.g. a
// sip:<id>.sip.livekit.cloud host shown on their phone-number page), so this
// must not be hardcoded — overwriting a working trunk with the generic host
// would break inbound routing. Read the account's value from config and fall
// back to Retell's documented default only when nothing is set.
// https://docs.retellai.com/deploy/twilio
const RETELL_ORIGINATION_URI =
  process.env.RETELL_ORIGINATION_URI || "sip:sip.retellai.com";
import { setupAuth, isAuthenticated, isAdmin, isSuperAdmin, sendCreditExhaustedAlert, getUserIdFromUpgradeRequest } from "./auth";
import { generateAgentResponse, transcribeAudio, synthesizeSpeech, VoiceConfig, buildFlowContext, analyzeCallTranscript } from "./openai";
import { handleTwilioWebSocket, generateTwiML, getActiveCalls, handleBrowserTestWebSocket } from "./voiceCallHandler";
import { createWorkflowExecutor, WorkflowState } from "./workflowExecutor";
import * as retell from "./retell";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage() });
import { insertAgentSchema, insertKnowledgeBaseSchema, updateKnowledgeBaseSchema, insertContactSchema, insertPhoneNumberSchema, updatePhoneNumberSchema, insertIntegrationConfigSchema, insertAnalyticsEventSchema, onboardingSchema, users, adminAuditLogs, agents, usageLedger, callLogs, supportMessages, kbCollections, kbSources, agentKbCollections } from "@shared/schema";
import twilio from "twilio";
import crypto from "crypto";
import { getTwilioClient, getTwilioAccountSid, getTwilioAuthToken, sendSms2FACode, verifySms2FACode, sendSignupNotification } from "./twilioClient";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { calculateCallCostCents, DEFAULT_TRIAL_CREDIT_CENTS } from '../shared/pricing';
import { db } from "./db";
import { sql, eq, and, sum, count, desc, inArray } from "drizzle-orm";

// ==================== CREDIT STATUS HELPER ====================

interface CreditStatus {
  balanceCents: number;
  hasPaymentMethod: boolean;
  isTrial: boolean;
}

// In-memory cache: 30s TTL for fresh entries, stale entries returned as fallback on Stripe errors
const creditStatusCache = new Map<string, { status: CreditStatus; expiresAt: number }>();

// Throttle: at most one credit-exhausted alert email per user per hour
const creditAlertThrottle = new Map<string, number>();
const CREDIT_ALERT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

async function getUserCreditStatus(userId: string): Promise<CreditStatus | null> {
  const now = Date.now();
  const cached = creditStatusCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.status;
  }

  try {
    const stripe = await getUncachableStripeClient();
    if (!stripe) {
      // Stripe not configured — fall back to stale cache or allow through
      if (cached) {
        console.warn(`[CreditStatus] Stripe unavailable, using stale cache for user ${userId}`);
        return cached.status;
      }
      return null;
    }

    const subscription = await storage.getSubscription(userId);
    if (!subscription?.stripeCustomerId) {
      return { balanceCents: 0, hasPaymentMethod: false, isTrial: true };
    }

    const isTrial = !subscription.stripeSubscriptionId || subscription.planType === 'trial';

    const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);
    if (customer.deleted) {
      return { balanceCents: 0, hasPaymentMethod: false, isTrial };
    }

    const balanceCents = Math.max(0, -(customer.balance ?? 0));

    const paymentMethods = await stripe.paymentMethods.list({
      customer: subscription.stripeCustomerId,
      type: 'card',
      limit: 1,
    });
    const hasPaymentMethod = paymentMethods.data.length > 0;

    const status: CreditStatus = { balanceCents, hasPaymentMethod, isTrial };
    creditStatusCache.set(userId, { status, expiresAt: now + 30_000 });
    return status;
  } catch (err) {
    console.error('[CreditStatus] Failed to fetch credit status for user', userId, err);
    // On transient Stripe errors, return stale cache if available (fail-safe for known users)
    // rather than always failing open
    if (cached) {
      console.warn(`[CreditStatus] Returning stale cached status for user ${userId} after Stripe error`);
      return cached.status;
    }
    // No stale data available — fail open (unknown user or first-time check during outage)
    return null;
  }
}

// Initialize Twilio client - but prefer the Replit connection integration
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilioAccountSid && twilioAuthToken 
  ? twilio(twilioAccountSid, twilioAuthToken) 
  : null;

async function getKbContentForUser(userId: string): Promise<string> {
  try {
    const sources = await db
      .select({
        collectionName: kbCollections.name,
        sourceName: kbSources.name,
        content: kbSources.content,
      })
      .from(kbSources)
      .innerJoin(kbCollections, eq(kbSources.collectionId, kbCollections.id))
      .where(eq(kbCollections.userId, userId));

    if (sources.length === 0) return '';

    const grouped: Record<string, Array<{ name: string; content: string }>> = {};
    for (const s of sources) {
      if (!s.content) continue;
      if (!grouped[s.collectionName]) grouped[s.collectionName] = [];
      grouped[s.collectionName].push({ name: s.sourceName, content: s.content });
    }

    if (Object.keys(grouped).length === 0) return '';

    let text = '';
    for (const [collName, items] of Object.entries(grouped)) {
      text += `### ${collName}\n\n`;
      for (const item of items) {
        text += `**${item.name}**\n${item.content}\n\n`;
      }
    }
    return text.trim();
  } catch (err) {
    console.error('[KB] Error fetching KB content for user:', err);
    return '';
  }
}

async function getKbContentForAgent(agentId: string, userId: string): Promise<string> {
  try {
    // Check if this agent has any explicit collection attachments
    const attachments = await db
      .select({ collectionId: agentKbCollections.collectionId })
      .from(agentKbCollections)
      .where(eq(agentKbCollections.agentId, agentId));

    if (attachments.length === 0) {
      // No explicit attachments — fall back to all user collections (backward compat)
      return getKbContentForUser(userId);
    }

    const collectionIds = attachments.map(a => a.collectionId);

    // Fetch sources only for attached collections, verifying ownership via userId join
    const sources = await db
      .select({
        collectionName: kbCollections.name,
        sourceName: kbSources.name,
        content: kbSources.content,
      })
      .from(kbSources)
      .innerJoin(kbCollections, eq(kbSources.collectionId, kbCollections.id))
      .where(
        and(
          eq(kbCollections.userId, userId),
          inArray(kbCollections.id, collectionIds)
        )
      );

    if (sources.length === 0) return '';

    const grouped: Record<string, Array<{ name: string; content: string }>> = {};
    for (const s of sources) {
      if (!s.content) continue;
      if (!grouped[s.collectionName]) grouped[s.collectionName] = [];
      grouped[s.collectionName].push({ name: s.sourceName, content: s.content });
    }

    if (Object.keys(grouped).length === 0) return '';

    let text = '';
    for (const [collName, items] of Object.entries(grouped)) {
      text += `### ${collName}\n\n`;
      for (const item of items) {
        text += `**${item.name}**\n${item.content}\n\n`;
      }
    }
    return text.trim();
  } catch (err) {
    console.error('[KB] Error fetching KB content for agent:', err);
    return '';
  }
}

function appendKbBlock(prompt: string, kbContent: string): string {
  if (!kbContent) return prompt;
  const kbSection = `\n\n## Knowledge Base\n\n${kbContent}`;
  if (prompt.includes('## Knowledge Base')) {
    return prompt.replace(/\n\n## Knowledge Base[\s\S]*$/, kbSection);
  }
  return prompt + kbSection;
}

/**
 * Single source of truth for what an agent knows on a live call: its system
 * prompt plus knowledge base plus the live Square menu.
 *
 * Every path that writes a prompt to Retell must go through this. Building the
 * prompt ad hoc is what caused the knowledge base to be stripped on save, and
 * why the Square menu never reached a real call at all.
 */
async function buildAgentPrompt(
  basePrompt: string,
  agentId: string | null,
  userId: string,
): Promise<string> {
  const kbContent = agentId
    ? await getKbContentForAgent(agentId, userId)
    : await getKbContentForUser(userId);
  const withKb = appendKbBlock(basePrompt || '', kbContent);

  // Square is optional; getSquareMenuContext returns '' when not connected.
  const menu = await getSquareMenuContext(userId);
  return appendSquareMenuBlock(withKb, menu);
}

// Debounce map: prevents duplicate Retell syncs when multiple KB sources change at once
const kbSyncDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleKbSync(userId: string): void {
  const existing = kbSyncDebounceMap.get(userId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    kbSyncDebounceMap.delete(userId);
    try {
      if (!await retell.isRetellConfigured()) return;
      const userAgents = await storage.getAgents(userId);
      for (const agent of userAgents) {
        if (!agent.retellAgentId || !agent.retellLlmId) continue;
        try {
          const enrichedPrompt = await buildAgentPrompt(agent.systemPrompt || '', agent.id, userId);
          await retell.updateRetellConversationFlow(agent.retellLlmId, {
            generalPrompt: enrichedPrompt,
            beginMessage: agent.greetingMessage || '',
            model: agent.aiModel || 'gpt-4o-mini',
            modelTemperature: 0.7,
          }, agent);
          console.log(`[KB Sync] Re-synced agent ${agent.id} -> Retell ${agent.retellAgentId} after KB change`);
        } catch (agentErr) {
          console.error(`[KB Sync] Failed to sync agent ${agent.id}:`, agentErr);
        }
      }
    } catch (err) {
      console.error('[KB Sync] Failed to sync KB for user', userId, err);
    }
  }, 500);
  kbSyncDebounceMap.set(userId, timer);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      // getUser returns undefined for a missing row. Spreading that produced a
      // 200 with an empty object, so the client saw a logged-in user with no
      // fields rather than an error.
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Include phoneNumber alias for frontend compatibility
      res.json({
        ...toPublicUser(user),
        phoneNumber: user.restaurantPhone || '',
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Onboarding route
  app.post('/api/onboarding/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = onboardingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.errors 
        });
      }
      
      const { restaurantName, restaurantType, restaurantPhone, restaurantWebsite } = validationResult.data;
      
      const user = await storage.updateUserOnboarding(userId, {
        restaurantName,
        restaurantType,
        restaurantPhone,
        restaurantWebsite,
      });

      sendSignupNotification({
        email: user.email || 'Unknown',
        signupMethod: user.authProvider === 'google' ? 'Google OAuth' : 'Email/Password',
        restaurantName: restaurantName || undefined,
        restaurantType: restaurantType || undefined,
        restaurantPhone: restaurantPhone || undefined,
      }).catch(console.error);

      res.json(toPublicUser(user));
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // ─── Admin Routes (protected by isAdmin middleware) ───────────────────────

  // Helper: write to audit log
  async function writeAuditLog(adminUserId: string, action: string, targetUserId: string | null, resource: string, details: any, ip: string) {
    try {
      await db.insert(adminAuditLogs).values({
        adminUserId,
        action,
        targetUserId: targetUserId || null,
        targetResource: resource,
        details,
        ipAddress: ip,
      });
    } catch (e) {
      console.error("Audit log write failed:", e);
    }
  }

  // GET /api/admin/signups — legacy alias kept for backward compat
  app.get("/api/admin/signups", isAdmin, async (req: any, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          authProvider: users.authProvider,
          restaurantName: users.restaurantName,
          restaurantType: users.restaurantType,
          restaurantPhone: users.restaurantPhone,
          restaurantWebsite: users.restaurantWebsite,
          onboardingCompleted: users.onboardingCompleted,
          role: users.role,
          accountStatus: users.accountStatus,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(sql`${users.createdAt} desc`);
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching signups:", error);
      res.status(500).json({ message: "Failed to fetch signups" });
    }
  });

  // GET /api/admin/restaurants — full restaurant list with enriched data
  app.get("/api/admin/restaurants", isAdmin, async (req: any, res) => {
    try {
      const search = (req.query.search as string || '').toLowerCase();
      const statusFilter = req.query.status as string;
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          authProvider: users.authProvider,
          restaurantName: users.restaurantName,
          restaurantType: users.restaurantType,
          restaurantPhone: users.restaurantPhone,
          restaurantWebsite: users.restaurantWebsite,
          onboardingCompleted: users.onboardingCompleted,
          role: users.role,
          accountStatus: users.accountStatus,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(sql`${users.role} != 'admin'`)
        .orderBy(sql`${users.createdAt} desc`);

      let filtered = allUsers;
      if (search) {
        filtered = filtered.filter(u =>
          u.restaurantName?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(search)
        );
      }
      if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(u => u.accountStatus === statusFilter);
      }

      res.json(filtered);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  // GET /api/admin/restaurants/export — CSV export
  app.get("/api/admin/restaurants/export", isAdmin, async (req: any, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          restaurantName: users.restaurantName,
          restaurantType: users.restaurantType,
          restaurantPhone: users.restaurantPhone,
          restaurantWebsite: users.restaurantWebsite,
          accountStatus: users.accountStatus,
          authProvider: users.authProvider,
          onboardingCompleted: users.onboardingCompleted,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(sql`${users.role} != 'admin'`)
        .orderBy(sql`${users.createdAt} desc`);

      const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Restaurant Name', 'Type', 'Phone', 'Website', 'Status', 'Auth Provider', 'Onboarded', 'Signup Date'];
      const rows = allUsers.map(u => [
        u.id, u.email, u.firstName, u.lastName, u.restaurantName,
        u.restaurantType, u.restaurantPhone, u.restaurantWebsite,
        u.accountStatus, u.authProvider, u.onboardingCompleted, u.createdAt
      ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));

      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="restaurants.csv"');
      res.send(csv);
    } catch (error) {
      console.error("Error exporting restaurants:", error);
      res.status(500).json({ message: "Failed to export" });
    }
  });

  // GET /api/admin/restaurants/:id — single restaurant detail
  app.get("/api/admin/restaurants/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [user] = await db.select().from(users).where(eq(users.id, id));
      if (!user) return res.status(404).json({ message: "Not found" });
      res.json(toPublicUser(user));
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      res.status(500).json({ message: "Failed to fetch restaurant" });
    }
  });

  // GET /api/admin/restaurants/:id/stats — per-user usage & cost stats
  app.get("/api/admin/restaurants/:id/stats", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get user's agent IDs
      const userAgents = await db.select({ id: agents.id }).from(agents).where(eq(agents.userId, id));
      const agentIds = userAgents.map(a => a.id);

      let totalCalls = 0;
      let totalMinutes = 0;
      let totalCostCents = 0;

      if (agentIds.length > 0) {
        // Query usage_ledger for cost/minutes
        const ledgerRows = await db.select().from(usageLedger).where(eq(usageLedger.userId, id));
        totalMinutes = ledgerRows.reduce((acc, r) => acc + parseFloat(r.minutesUsed || '0'), 0);
        totalCostCents = ledgerRows.reduce((acc, r) => acc + parseInt(r.costCents || '0'), 0);

        // Query call_logs for call count
        const callRows = await db.select({ id: callLogs.id }).from(callLogs).where(eq(callLogs.userId, id));
        totalCalls = callRows.length;
      }

      const avgCostPerMinuteCents = totalMinutes > 0 ? Math.round(totalCostCents / totalMinutes) : 0;

      res.json({ totalCalls, totalMinutes: Math.round(totalMinutes * 100) / 100, totalCostCents, avgCostPerMinuteCents });
    } catch (error) {
      console.error("Error fetching restaurant stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // PATCH /api/admin/restaurants/:id — edit restaurant info
  app.patch("/api/admin/restaurants/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { restaurantName, restaurantType, restaurantPhone, restaurantWebsite, accountStatus } = req.body;
      const updates: any = {};
      if (restaurantName !== undefined) updates.restaurantName = restaurantName;
      if (restaurantType !== undefined) updates.restaurantType = restaurantType;
      if (restaurantPhone !== undefined) updates.restaurantPhone = restaurantPhone;
      if (restaurantWebsite !== undefined) updates.restaurantWebsite = restaurantWebsite;
      if (accountStatus !== undefined) updates.accountStatus = accountStatus;
      updates.updatedAt = new Date();

      const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      await writeAuditLog(req.user.id, 'edit_restaurant', id, 'user', updates, req.ip || '');
      res.json(updated);
    } catch (error) {
      console.error("Error updating restaurant:", error);
      res.status(500).json({ message: "Failed to update restaurant" });
    }
  });

  // PATCH /api/admin/restaurants/:id/status — suspend or activate
  app.patch("/api/admin/restaurants/:id/status", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { accountStatus } = req.body;
      if (!['active', 'trial', 'suspended'].includes(accountStatus)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const [updated] = await db.update(users).set({ accountStatus, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      await writeAuditLog(req.user.id, accountStatus === 'suspended' ? 'suspend_account' : 'activate_account', id, 'user', { accountStatus }, req.ip || '');
      res.json(updated);
    } catch (error) {
      console.error("Error updating status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // PATCH /api/admin/restaurants/:id/unlock — unlock dashboard after onboarding call
  app.patch("/api/admin/restaurants/:id/unlock", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [updated] = await db.update(users)
        .set({ onboardingCallUnlocked: true, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "User not found" });
      await writeAuditLog(req.user.id, 'unlock_dashboard', id, 'user', {}, req.ip || '');
      res.json(updated);
    } catch (error) {
      console.error("Error unlocking dashboard:", error);
      res.status(500).json({ message: "Failed to unlock dashboard" });
    }
  });

  // DELETE /api/admin/restaurants/:id — delete account
  app.delete("/api/admin/restaurants/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Support both direct admin requests and requests while impersonating
      const actualAdminId = req.session?.originalAdminId || req.user.id;
      const [adminUser] = await db.select().from(users).where(eq(users.id, actualAdminId));
      if (!adminUser || adminUser.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: admin role required" });
      }

      const { id } = req.params;

      // Don't allow deleting the super admin account itself
      if (id === actualAdminId) {
        return res.status(400).json({ message: "Cannot delete your own admin account" });
      }

      // Delete audit log entries referencing this user (no cascade on admin_audit_logs)
      await db.delete(adminAuditLogs).where(eq(adminAuditLogs.targetUserId, id));

      // Log the deletion AFTER wiping FK references — use null targetUserId to avoid re-creating an FK reference
      await writeAuditLog(actualAdminId, 'delete_account', null, 'user', { deletedUserId: id }, req.ip || '');
      await db.delete(users).where(eq(users.id, id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      const message = error instanceof Error ? error.message : "Failed to delete restaurant";
      res.status(500).json({ message });
    }
  });

  // POST /api/admin/impersonate/:id — login as a restaurant user
  app.post("/api/admin/impersonate/:id", isSuperAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const [target] = await db.select().from(users).where(eq(users.id, id));
      if (!target) return res.status(404).json({ message: "User not found" });

      // Store original admin ID so we can restore later
      req.session.originalAdminId = req.user.id;

      await writeAuditLog(req.user.id, 'impersonate', id, 'user', { targetEmail: target.email }, req.ip || '');

      req.login(target, (err: any) => {
        if (err) return res.status(500).json({ message: "Failed to impersonate" });
        res.json({ success: true, user: target });
      });
    } catch (error) {
      console.error("Error impersonating:", error);
      res.status(500).json({ message: "Failed to impersonate" });
    }
  });

  // POST /api/admin/impersonate/stop — return to admin account
  app.post("/api/admin/impersonate/stop", isAuthenticated, async (req: any, res) => {
    try {
      const originalAdminId = req.session.originalAdminId;
      if (!originalAdminId) return res.status(400).json({ message: "Not in impersonation session" });

      const [admin] = await db.select().from(users).where(eq(users.id, originalAdminId));
      if (!admin) return res.status(404).json({ message: "Admin user not found" });

      delete req.session.originalAdminId;
      req.login(admin, (err: any) => {
        if (err) return res.status(500).json({ message: "Failed to restore admin session" });
        res.json({ success: true, user: admin });
      });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation" });
    }
  });

  // GET /api/admin/audit-logs — list audit logs
  app.get("/api/admin/audit-logs", isAdmin, async (req: any, res) => {
    try {
      const logs = await db.select().from(adminAuditLogs).orderBy(sql`${adminAuditLogs.createdAt} desc`).limit(200);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // GET /api/admin/session — check if currently impersonating
  app.get("/api/admin/session", isAuthenticated, async (req: any, res) => {
    res.json({
      isImpersonating: !!req.session.originalAdminId,
      originalAdminId: req.session.originalAdminId || null,
    });
  });

  // Agent routes
  app.get("/api/agents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      if (agent.userId !== req.user.id) {
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
      const userId = req.user.id;
      const data = insertAgentSchema.parse({ ...req.body, userId });
      
      // Create agent in our database first
      let agent = await storage.createAgent(data);
      
      // Sync with Retell AI if configured
      if (await retell.isRetellConfigured()) {
        try {
          const enrichedPrompt = await buildAgentPrompt(data.systemPrompt || '', agent.id, userId);
          // Create Conversation Flow in Retell (conversation-flow type agent)
          const flowId = await retell.createRetellConversationFlow({
            generalPrompt: enrichedPrompt,
            beginMessage: data.greetingMessage,
            model: data.aiModel || 'gpt-4o-mini',
            modelTemperature: 0.7,
          }, agent);
          
          if (flowId) {
            // Create Agent in Retell with conversation-flow type
            const retellAgentId = await retell.createRetellAgent({
              agentName: data.name,
              voiceId: data.voiceId || '11labs-Adrian',
              voiceModel: (data as any).voiceModel || 'eleven_turbo_v2',
              voiceSpeed: parseFloat(data.voiceSpeed || '1.0'),
              voiceTemperature: parseFloat((data as any).voiceTemperature || '1.0'),
              volume: parseFloat((data as any).voiceVolume || '1.0'),
              responsiveness: parseFloat((data as any).responsiveness || '1.0'),
              interruptionSensitivity: parseFloat(data.interruptionSensitivity || '1.0'),
              language: data.language || 'en-US',
              enableBackchannel: (data as any).enableBackchannel ?? true,
              backchannelFrequency: parseFloat((data as any).backchannelFrequency || '0.9'),
              backchannelWords: (data as any).backchannelWords || ['yeah', 'uh-huh', 'I see'],
              ambientSound: (data as any).ambientSound || undefined,
              ambientSoundVolume: parseFloat((data as any).ambientSoundVolume || '1.0'),
              beginMessageDelayMs: parseInt((data as any).beginMessageDelayMs || '1000'),
              reminderTriggerMs: parseInt((data as any).reminderTriggerMs || '10000'),
              reminderMaxCount: parseInt((data as any).reminderMaxCount || '2'),
              reminderMessage: (data as any).reminderMessage,
              boostedKeywords: (data as any).boostedKeywords || [],
              pronunciationDictionary: (data as any).pronunciationDictionary || [],
              endCallPhrases: (data as any).endCallPhrases || ['goodbye', 'bye', 'have a nice day'],
              maxCallDurationMs: parseInt((data as any).maxCallDurationMs || '3600000'),
              inactivityTimeoutMs: parseInt((data as any).inactivityTimeoutMs || '30000'),
              fallbackVoiceId: (data as any).fallbackVoiceId,
              voicemailDetection: (data as any).voicemailDetection ?? false,
              voicemailMessage: (data as any).voicemailMessage,
              warmTransferEnabled: (data as any).warmTransferEnabled ?? false,
              warmTransferNumber: (data as any).warmTransferNumber,
              warmTransferMessage: (data as any).warmTransferMessage,
            }, flowId);
            
            // Update our agent with Retell IDs (store flowId as retellLlmId for backwards compatibility)
            if (retellAgentId) {
              agent = await storage.updateAgent(agent.id, {
                retellAgentId,
                retellLlmId: flowId,
              }) || agent;
              console.log(`[Retell] Synced agent ${agent.id} -> Retell ${retellAgentId} (conversation-flow)`);
            }
          }
        } catch (retellError) {
          console.error('[Retell] Error syncing new agent:', retellError);
          // Don't fail the request - agent is created locally, Retell sync can retry later
        }
      }
      
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
      if (agent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Update agent in our database
      const updated = await storage.updateAgent(req.params.id, req.body);
      
      // Sync with Retell AI if configured and agent has Retell IDs
      if (await retell.isRetellConfigured() && agent.retellAgentId && agent.retellLlmId) {
        try {
          const data = req.body;
          
          // Update Conversation Flow if prompt/model/hours changed
          if (data.systemPrompt || data.greetingMessage || data.aiModel || data.businessHours || data.afterHoursMode || data.afterHoursMessage !== undefined || data.timezone) {
            const mergedAgent = { ...agent, ...data };
            const basePrompt = data.systemPrompt || agent.systemPrompt || '';
            const enrichedPrompt = await buildAgentPrompt(basePrompt, agent.id, agent.userId);
            await retell.updateRetellConversationFlow(agent.retellLlmId, {
              generalPrompt: enrichedPrompt,
              beginMessage: data.greetingMessage || agent.greetingMessage,
              model: data.aiModel || agent.aiModel,
              modelTemperature: 0.7,
            }, mergedAgent);
          }
          
          // Update Agent voice/behavior settings - complete mapping
          await retell.updateRetellAgent(agent.retellAgentId, {
            agentName: data.name || agent.name,
            voiceId: data.voiceId || agent.voiceId,
            voiceModel: data.voiceModel || (agent as any).voiceModel,
            voiceSpeed: data.voiceSpeed ? parseFloat(data.voiceSpeed) : undefined,
            voiceTemperature: data.voiceTemperature ? parseFloat(data.voiceTemperature) : undefined,
            volume: data.voiceVolume ? parseFloat(data.voiceVolume) : undefined,
            responsiveness: data.responsiveness ? parseFloat(data.responsiveness) : undefined,
            interruptionSensitivity: data.interruptionSensitivity ? parseFloat(data.interruptionSensitivity) : undefined,
            language: data.language || agent.language,
            enableBackchannel: data.enableBackchannel ?? (agent as any).enableBackchannel,
            backchannelFrequency: data.backchannelFrequency ? parseFloat(data.backchannelFrequency) : undefined,
            backchannelWords: data.backchannelWords || (agent as any).backchannelWords,
            ambientSound: data.ambientSound || (agent as any).ambientSound || undefined,
            ambientSoundVolume: data.ambientSoundVolume ? parseFloat(data.ambientSoundVolume) : undefined,
            beginMessageDelayMs: data.beginMessageDelayMs ? parseInt(data.beginMessageDelayMs) : undefined,
            reminderTriggerMs: data.reminderTriggerMs ? parseInt(data.reminderTriggerMs) : undefined,
            reminderMaxCount: data.reminderMaxCount ? parseInt(data.reminderMaxCount) : undefined,
            reminderMessage: data.reminderMessage ?? (agent as any).reminderMessage,
            boostedKeywords: data.boostedKeywords || (agent as any).boostedKeywords,
            pronunciationDictionary: data.pronunciationDictionary || (agent as any).pronunciationDictionary,
            endCallPhrases: data.endCallPhrases || (agent as any).endCallPhrases,
            maxCallDurationMs: data.maxCallDurationMs ? parseInt(data.maxCallDurationMs) : undefined,
            inactivityTimeoutMs: data.inactivityTimeoutMs ? parseInt(data.inactivityTimeoutMs) : undefined,
            fallbackVoiceId: data.fallbackVoiceId ?? (agent as any).fallbackVoiceId,
            voicemailDetection: data.voicemailDetection ?? (agent as any).voicemailDetection,
            voicemailMessage: data.voicemailMessage ?? (agent as any).voicemailMessage,
            warmTransferEnabled: data.warmTransferEnabled ?? (agent as any).warmTransferEnabled,
            warmTransferNumber: data.warmTransferNumber ?? (agent as any).warmTransferNumber,
            warmTransferMessage: data.warmTransferMessage ?? (agent as any).warmTransferMessage,
          });
          
          console.log(`[Retell] Synced agent update ${agent.id} -> Retell ${agent.retellAgentId}`);
        } catch (retellError) {
          console.error('[Retell] Error syncing agent update:', retellError);
          // Don't fail the request - local update succeeded
        }
      }
      
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
      if (agent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Clean up Retell resources if configured
      if (await retell.isRetellConfigured()) {
        try {
          if (agent.retellAgentId) {
            await retell.deleteRetellAgent(agent.retellAgentId);
            console.log(`[Retell] Deleted agent ${agent.retellAgentId}`);
          }
          if (agent.retellLlmId) {
            await retell.deleteRetellLLM(agent.retellLlmId);
            console.log(`[Retell] Deleted LLM ${agent.retellLlmId}`);
          }
        } catch (retellError) {
          console.error('[Retell] Error cleaning up Retell resources:', retellError);
          // Continue with local deletion even if Retell cleanup fails
        }
      }
      
      await storage.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // Manually sync an agent to Retell (for agents created before Retell integration)
  app.post("/api/agents/:id/sync-retell", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (!await retell.isRetellConfigured()) {
        return res.status(400).json({ message: "Retell AI is not configured" });
      }

      const enrichedPrompt = await buildAgentPrompt(agent.systemPrompt || '', agent.id, agent.userId);

      // If already synced, push current config as an update instead of creating new resources
      if (agent.retellAgentId && agent.retellLlmId) {
        await retell.updateRetellConversationFlow(agent.retellLlmId, {
          generalPrompt: enrichedPrompt,
          beginMessage: agent.greetingMessage || '',
          model: agent.aiModel || 'gpt-4o-mini',
          modelTemperature: 0.7,
        }, agent);

        await retell.updateRetellAgent(agent.retellAgentId, {
          agentName: agent.name,
          voiceId: agent.voiceId || '11labs-Adrian',
          voiceModel: agent.voiceModel || 'eleven_turbo_v2',
          voiceSpeed: parseFloat(agent.voiceSpeed || '1.0'),
          voiceTemperature: agent.voiceTemperature ? parseFloat(String(agent.voiceTemperature)) : 1.0,
          volume: agent.voiceVolume ? parseFloat(String(agent.voiceVolume)) : 1.0,
          responsiveness: agent.responsiveness ? parseFloat(String(agent.responsiveness)) : 1.0,
          interruptionSensitivity: parseFloat(agent.interruptionSensitivity || '1.0'),
          language: agent.language || 'en-US',
          enableBackchannel: agent.enableBackchannel ?? true,
          backchannelFrequency: typeof agent.backchannelFrequency === 'number' ? agent.backchannelFrequency : 0.9,
          backchannelWords: agent.backchannelWords || ['yeah', 'uh-huh', 'I see'],
          ambientSound: agent.ambientSound || undefined,
          ambientSoundVolume: typeof agent.ambientSoundVolume === 'number' ? agent.ambientSoundVolume : 1.0,
          beginMessageDelayMs: typeof agent.beginMessageDelayMs === 'number' ? agent.beginMessageDelayMs : 1000,
        });

        console.log(`[Retell] Force-synced existing agent ${agent.id} -> Retell ${agent.retellAgentId}`);
        return res.json({ message: "Agent force-synced to Retell successfully", retellAgentId: agent.retellAgentId, agent });
      }

      // Create Conversation Flow in Retell
      const flowId = await retell.createRetellConversationFlow({
        generalPrompt: enrichedPrompt,
        beginMessage: agent.greetingMessage || '',
        model: agent.aiModel || 'gpt-4o-mini',
        modelTemperature: 0.7,
      }, agent);

      if (!flowId) {
        return res.status(500).json({ message: "Failed to create conversation flow" });
      }

      // Create Agent in Retell with conversation-flow type
      const retellAgentId = await retell.createRetellAgent({
        agentName: agent.name,
        voiceId: agent.voiceId || '11labs-Adrian',
        voiceModel: agent.voiceModel || 'eleven_turbo_v2',
        voiceSpeed: parseFloat(agent.voiceSpeed || '1.0'),
        voiceTemperature: agent.voiceTemperature ? parseFloat(String(agent.voiceTemperature)) : 1.0,
        volume: agent.voiceVolume ? parseFloat(String(agent.voiceVolume)) : 1.0,
        responsiveness: agent.responsiveness ? parseFloat(String(agent.responsiveness)) : 1.0,
        interruptionSensitivity: parseFloat(agent.interruptionSensitivity || '1.0'),
        language: agent.language || 'en-US',
        enableBackchannel: agent.enableBackchannel ?? true,
        backchannelFrequency: typeof agent.backchannelFrequency === 'number' ? agent.backchannelFrequency : 0.9,
        backchannelWords: agent.backchannelWords || ['yeah', 'uh-huh', 'I see'],
        ambientSound: agent.ambientSound || undefined,
        ambientSoundVolume: typeof agent.ambientSoundVolume === 'number' ? agent.ambientSoundVolume : 1.0,
        beginMessageDelayMs: typeof agent.beginMessageDelayMs === 'number' ? agent.beginMessageDelayMs : 1000,
      }, flowId);

      if (!retellAgentId) {
        return res.status(500).json({ message: "Failed to create agent" });
      }

      // Update our agent with IDs (store flowId as retellLlmId for backwards compatibility)
      const updated = await storage.updateAgent(agent.id, {
        retellAgentId,
        retellLlmId: flowId,
      });

      console.log(`[Retell] Manually synced agent ${agent.id} -> Retell ${retellAgentId} (conversation-flow)`);
      res.json({ message: "Agent synced to Retell successfully", retellAgentId, agent: updated });
    } catch (error: any) {
      console.error("Error syncing agent to Retell:", error);
      res.status(500).json({ message: error.message || "Failed to sync agent to Retell" });
    }
  });

  // Create a Retell web call for voice testing (real-time, phone-quality experience)
  app.post("/api/agents/:id/web-call", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Credit gate: block web calls for trial users with no credit and no payment method
      const webCallCreditStatus = await getUserCreditStatus(req.user.id);
      if (webCallCreditStatus && webCallCreditStatus.isTrial && webCallCreditStatus.balanceCents <= 0 && !webCallCreditStatus.hasPaymentMethod) {
        return res.status(402).json({
          message: "Your trial credit has been used. Please add a payment method to continue making calls.",
          addPaymentUrl: "/billing",
        });
      }

      // Check if Retell is configured - return 501 if voice service is not available
      if (!await retell.isRetellConfigured()) {
        return res.status(501).json({ 
          message: "Voice testing is not currently available. Retell AI integration required.",
          disabled: true
        });
      }

      // If agent is not synced to Retell, sync it first
      let retellAgentId = agent.retellAgentId;
      let flowId = agent.retellLlmId;

      // Build enriched prompt: base + business hours block + KB content
      const webCallBasePrompt = agent.systemPrompt || "You are a helpful restaurant assistant.";
      const webCallEnrichedPrompt = await buildAgentPrompt(webCallBasePrompt, agent.id, agent.userId);
      
      if (!retellAgentId) {
        console.log(`[Retell] Agent ${agent.id} not synced, syncing now for web call...`);
        
        // Create Conversation Flow in Retell
        flowId = await retell.createRetellConversationFlow({
          generalPrompt: webCallEnrichedPrompt,
          beginMessage: agent.greetingMessage || "Hello! Thank you for calling. How can I help you today?",
          model: 'gpt-4o-mini',
          modelTemperature: 0.7,
        }, agent);
        
        if (!flowId) {
          return res.status(500).json({ message: "Failed to create Retell conversation flow" });
        }
        
        // Create Agent in Retell
        retellAgentId = await retell.createRetellAgent({
          agentName: agent.name,
          voiceId: agent.voiceId || '11labs-Adrian',
          voiceModel: agent.voiceModel || 'eleven_turbo_v2',
          voiceSpeed: parseFloat(agent.voiceSpeed || '1.0'),
          voiceTemperature: agent.voiceTemperature ? parseFloat(String(agent.voiceTemperature)) : 1.0,
          volume: agent.voiceVolume ? parseFloat(String(agent.voiceVolume)) : 1.0,
          responsiveness: agent.responsiveness ? parseFloat(String(agent.responsiveness)) : 1.0,
          interruptionSensitivity: parseFloat(agent.interruptionSensitivity || '1.0'),
          language: agent.language || 'en-US',
          enableBackchannel: agent.enableBackchannel ?? true,
          backchannelFrequency: typeof agent.backchannelFrequency === 'number' ? agent.backchannelFrequency : 0.9,
          backchannelWords: agent.backchannelWords || ['yeah', 'uh-huh', 'I see'],
          ambientSound: agent.ambientSound || undefined,
          ambientSoundVolume: typeof agent.ambientSoundVolume === 'number' ? agent.ambientSoundVolume : 1.0,
          beginMessageDelayMs: typeof agent.beginMessageDelayMs === 'number' ? agent.beginMessageDelayMs : 1000,
        }, flowId);

        if (!retellAgentId) {
          return res.status(500).json({ message: "Failed to create Retell agent" });
        }

        // Update our agent with Retell IDs
        await storage.updateAgent(agent.id, {
          retellAgentId,
          retellLlmId: flowId,
        });
        
        console.log(`[Retell] Auto-synced agent ${agent.id} -> Retell ${retellAgentId} for web call`);
      }

      // Always sync workflow nodes to Retell before starting the call
      // This ensures the conversation flow matches the current workflow structure
      if (flowId) {
        const dbNodes = await storage.getFlowNodes(agent.id);
        const dbConnections = await storage.getFlowConnections(agent.id);
        
        if (dbNodes.length > 0) {
          console.log(`[Retell] Syncing ${dbNodes.length} workflow nodes to conversation flow ${flowId}`);
          
          // Map database nodes to OrderlyFlowNode format (convert null to undefined)
          const nodes = dbNodes.map(node => ({
            id: node.id,
            type: node.type,
            label: node.label,
            content: node.content || undefined,
            contentMode: (node.config as any)?.contentMode as 'prompt' | 'static' | undefined,
            config: node.config as Record<string, any> | undefined,
            transitions: (node.config as any)?.transitions as Array<{ id: string; label: string; condition?: string }> | undefined,
          }));
          
          // Map database connections to OrderlyFlowConnection format
          const connections = dbConnections.map(conn => ({
            id: conn.id,
            sourceNodeId: conn.sourceNodeId,
            targetNodeId: conn.targetNodeId,
            sourceHandle: conn.sourceHandle || undefined,
            label: conn.label || undefined,
          }));
          
          await retell.syncWorkflowToRetell(
            flowId,
            nodes,
            connections,
            webCallEnrichedPrompt,
            'gpt-4o-mini',
            agent
          );
        }
      }

      // Create the web call
      const webCall = await retell.createRetellWebCall(retellAgentId, {
        orderlyAgentId: agent.id,
        userId: req.user.id,
        testCall: true,
      });

      if (!webCall) {
        return res.status(500).json({ message: "Failed to create web call" });
      }

      console.log(`[Retell] Created web call for agent ${agent.id}: ${webCall.callId}`);
      res.json({
        callId: webCall.callId,
        accessToken: webCall.accessToken,
        retellAgentId,
      });
    } catch (error: any) {
      console.error("Error creating web call:", error);
      res.status(500).json({ message: error.message || "Failed to create web call" });
    }
  });

  // Knowledge base routes
  // Get all knowledge items for the current user (across all agents)
  app.get("/api/knowledge", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
      
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
      const userId = req.user.id;
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

  // Helper function to format Square catalog for AI context
  // getSquareMenuContext now lives in ./squareMenu at module scope, so the
  // Retell prompt builders can reach it too. The old nested copy here also
  // ignored Square's catalog pagination cursor and truncated large menus.

  // Agent testing route - uses workflow executor when workflow exists
  app.post("/api/agents/:id/test", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { message, history = [], currentNodeId } = req.body;

      // Get knowledge base for context - storage layer enforces ownership
      const userId = req.user.id;
      const knowledgeItems = await storage.getKnowledgeBase(req.params.id, userId);
      const knowledgeContext = knowledgeItems
        .map((item) => `Q: ${item.question}\nA: ${item.answer}`)
        .join("\n\n");

      // Get live Square menu data if connected
      const squareMenuContext = await getSquareMenuContext(userId);
      const fullKnowledgeContext = knowledgeContext + squareMenuContext;

      // Get flow nodes and connections
      const flowNodes = await storage.getFlowNodes(req.params.id);
      const flowConnections = await storage.getFlowConnections(req.params.id);
      
      let response: string;
      let nextNodeId: string | null = null;

      // Use workflow executor if workflow exists
      if (flowNodes.length > 0) {
        const workflowExecutor = createWorkflowExecutor(
          flowNodes, 
          flowConnections, 
          agent, 
          fullKnowledgeContext
        );
        
        // Initialize or restore workflow state
        const workflowState: WorkflowState = {
          currentNodeId: currentNodeId || workflowExecutor.findStartNode()?.id || null,
          conversationHistory: history.map((m: any) => ({ role: m.role, content: m.content })),
          visitedNodes: new Set<string>()
        };
        
        const result = await workflowExecutor.processUserInput(workflowState, message);
        response = result.response;
        nextNodeId = result.newState.currentNodeId;
        
        console.log(`[test] Workflow response for agent ${req.params.id}, current node: ${nextNodeId}`);
      } else {
        // Fallback to free-form AI when no workflow
        const flowContext = buildFlowContext(flowNodes, flowConnections);
        
        response = await generateAgentResponse(
          agent.systemPrompt,
          agent.greetingMessage,
          agent.personality,
          fullKnowledgeContext,
          history,
          message,
          flowContext
        );
        
        console.log(`[test] AI response for agent ${req.params.id} (no workflow)`);
      }

      // Save test conversation
      await storage.saveTestConversation({
        agentId: req.params.id,
        messages: [...history, { role: "user", content: message }, { role: "assistant", content: response }],
      });

      res.json({ response, currentNodeId: nextNodeId });
    } catch (error) {
      console.error("Error testing agent:", error);
      res.status(500).json({ message: "Failed to test agent" });
    }
  });

  // Start chat - returns agent greeting from workflow or agent settings
  app.post("/api/agents/:id/start-chat", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Get flow nodes and connections to find workflow greeting
      const flowNodes = await storage.getFlowNodes(req.params.id);
      const flowConnections = await storage.getFlowConnections(req.params.id);
      
      let greeting: string;
      
      if (flowNodes.length > 0) {
        // Use workflow executor to get greeting from workflow
        const workflowExecutor = createWorkflowExecutor(flowNodes, flowConnections, agent, "");
        greeting = workflowExecutor.getGreeting();
        console.log(`[start-chat] Using workflow greeting for agent ${req.params.id}`);
      } else {
        // Fallback to agent's default greeting
        greeting = agent.greetingMessage?.trim() || "Hello! Thank you for calling. How can I help you today?";
        console.log(`[start-chat] Using agent default greeting for agent ${req.params.id}`);
      }
      
      res.json({ greeting });
    } catch (error) {
      console.error("Error starting chat:", error);
      res.status(500).json({ message: "Failed to start chat" });
    }
  });

  // Voice transcription route
  app.post("/api/agents/:id/transcribe", isAuthenticated, upload.single("audio"), async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.id) {
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
      if (agent.userId !== req.user.id) {
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

  // Voice listing route - fetches voices directly from Retell's voice catalog
  // Falls back to static voice lists when Retell is not configured
  app.get("/api/voices/:provider", isAuthenticated, async (req: any, res) => {
    try {
      const { provider } = req.params;
      const providerLower = provider.toLowerCase();
      
      // Handle cartesia separately (not yet available)
      if (providerLower === 'cartesia') {
        return res.status(501).json({ message: "Cartesia voices coming soon" });
      }
      
      // Map frontend provider names to Retell provider names
      const providerMap: Record<string, string> = {
        'openai': 'openai',
        'elevenlabs': 'elevenlabs',
        'deepgram': 'deepgram',
        'playht': 'playht',
      };
      
      const retellProvider = providerMap[providerLower];
      if (!retellProvider) {
        return res.status(400).json({ message: "Invalid voice provider" });
      }
      
      // Try to fetch voices from Retell API (these have the correct Retell voice IDs)
      const retellVoices = await retell.listRetellVoices(retellProvider);
      
      // If Retell returns voices, use them
      if (retellVoices.length > 0) {
        const voices = retellVoices.map(v => ({
          id: v.voice_id,
          voice_id: v.voice_id,
          name: v.voice_name,
          preview_url: v.preview_audio_url,
          labels: {
            accent: v.accent,
            gender: v.gender,
            age: v.age,
          },
        }));
        return res.json(voices);
      }
      
      // Fallback to static voice lists when Retell is not configured
      // These use correct Retell voice ID format
      if (providerLower === 'openai') {
        const staticVoices = [
          { id: "openai-Alloy", voice_id: "openai-Alloy", name: "Alloy", labels: { gender: "neutral", accent: "American" } },
          { id: "openai-Ash", voice_id: "openai-Ash", name: "Ash", labels: { gender: "male", accent: "American" } },
          { id: "openai-Coral", voice_id: "openai-Coral", name: "Coral", labels: { gender: "female", accent: "American" } },
          { id: "openai-Sage", voice_id: "openai-Sage", name: "Sage", labels: { gender: "neutral", accent: "American" } },
          { id: "openai-Ballad", voice_id: "openai-Ballad", name: "Ballad", labels: { gender: "male", accent: "American" } },
          { id: "openai-Verse", voice_id: "openai-Verse", name: "Verse", labels: { gender: "female", accent: "American" } },
        ];
        return res.json(staticVoices);
      }
      
      if (providerLower === 'elevenlabs') {
        const staticVoices = [
          { id: "11labs-Adrian", voice_id: "11labs-Adrian", name: "Adrian", labels: { gender: "male", accent: "American" } },
          { id: "11labs-Aria", voice_id: "11labs-Aria", name: "Aria", labels: { gender: "female", accent: "American" } },
          { id: "11labs-Brian", voice_id: "11labs-Brian", name: "Brian", labels: { gender: "male", accent: "American" } },
          { id: "11labs-Cimo", voice_id: "11labs-Cimo", name: "Cimo", labels: { gender: "male", accent: "American" } },
          { id: "11labs-Jessica", voice_id: "11labs-Jessica", name: "Jessica", labels: { gender: "female", accent: "American" } },
          { id: "11labs-Lily", voice_id: "11labs-Lily", name: "Lily", labels: { gender: "female", accent: "British" } },
          { id: "11labs-Myra", voice_id: "11labs-Myra", name: "Myra", labels: { gender: "female", accent: "Indian" } },
          { id: "11labs-Roger", voice_id: "11labs-Roger", name: "Roger", labels: { gender: "male", accent: "American" } },
          { id: "11labs-Sarah", voice_id: "11labs-Sarah", name: "Sarah", labels: { gender: "female", accent: "American" } },
        ];
        return res.json(staticVoices);
      }
      
      // For other providers without static fallback, return empty array
      res.json([]);
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
        // Strip "openai-" prefix if present and lowercase for OpenAI TTS API
        let cleanVoiceId = voiceId;
        if (cleanVoiceId.startsWith('openai-')) {
          cleanVoiceId = cleanVoiceId.replace('openai-', '');
        }
        cleanVoiceId = cleanVoiceId.toLowerCase();

        const voiceConfig: VoiceConfig = {
          provider: 'openai',
          voiceId: cleanVoiceId,
          speed: '1.0',
        };
        const audioBuffer = await synthesizeSpeech(previewText, voiceConfig);
        
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Content-Length", audioBuffer.length);
        res.send(audioBuffer);
      } else if (provider === 'elevenlabs') {
        // Strip "11labs-" prefix if present for direct ElevenLabs API calls
        let cleanVoiceId = voiceId;
        if (cleanVoiceId.startsWith('11labs-')) {
          cleanVoiceId = cleanVoiceId.replace('11labs-', '');
        }

        // If the ID looks like a real ElevenLabs UUID/alphanumeric ID, call ElevenLabs directly
        // Otherwise it's a Retell name-based ID — fall back to OpenAI TTS so we never
        // serve Retell-branded audio samples
        const isRealElevenLabsId = /^[a-zA-Z0-9]{20,}$/.test(cleanVoiceId);

        if (isRealElevenLabsId) {
          const { previewElevenLabsVoice } = await import('./elevenlabs');
          const audioBuffer = await previewElevenLabsVoice(cleanVoiceId, previewText);
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Content-Length", audioBuffer.length);
          res.send(audioBuffer);
        } else {
          // Retell-format IDs (e.g. "11labs-Willa") don't map to a real ElevenLabs UUID.
          // Synthesize the preview text with OpenAI TTS instead so no Retell branding leaks.
          const voiceConfig: VoiceConfig = {
            provider: 'openai',
            voiceId: 'alloy',
            speed: '1.0',
          };
          const audioBuffer = await synthesizeSpeech(previewText, voiceConfig);
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Content-Length", audioBuffer.length);
          res.send(audioBuffer);
        }
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
      if (!templateId) {
        return res.status(400).json({ message: "templateId is required" });
      }
      const template = await storage.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const userId = req.user.id;

      // Create agent with safe null-fallbacks for all text fields
      let agent = await storage.createAgent({
        userId,
        name: `${template.name || 'Agent'} (Copy)`,
        description: template.description || '',
        industry: template.industry || 'casual_dining',
        status: "draft",
        greetingMessage: template.greetingMessage || 'Hello, how can I help you today?',
        personality: template.personality || 'Professional and friendly',
        systemPrompt: template.systemPrompt || '',
      });

      // Sync with Retell AI if configured (conversation-flow type) — non-blocking
      if (await retell.isRetellConfigured()) {
        try {
          const flowId = await retell.createRetellConversationFlow({
            generalPrompt: template.systemPrompt || '',
            beginMessage: template.greetingMessage || 'Hello, how can I help you today?',
            model: 'gpt-4o-mini',
            modelTemperature: 0.7,
          });
          
          if (flowId) {
            const retellAgentId = await retell.createRetellAgent({
              agentName: `${template.name || 'Agent'} (Copy)`,
              voiceId: '11labs-Adrian',
              voiceModel: 'eleven_turbo_v2',
              voiceSpeed: 1.0,
              voiceTemperature: 1.0,
              volume: 1.0,
              responsiveness: 1.0,
              interruptionSensitivity: 1.0,
              language: 'en-US',
              enableBackchannel: true,
              backchannelFrequency: 0.9,
              backchannelWords: ['yeah', 'uh-huh', 'I see'],
              beginMessageDelayMs: 1000,
            }, flowId);

            if (retellAgentId) {
              agent = await storage.updateAgent(agent.id, {
                retellAgentId,
                retellLlmId: flowId,
              });
              console.log(`[Retell] Synced template agent ${agent.id} -> Retell ${retellAgentId} (conversation-flow)`);
            }
          }
        } catch (retellError) {
          console.error('[Retell] Error syncing template agent (non-fatal):', retellError);
          // Don't fail the whole request — agent is still usable locally
        }
      }

      // Add default knowledge if provided — each item in its own try/catch
      if (template.defaultKnowledge && Array.isArray(template.defaultKnowledge)) {
        for (const item of template.defaultKnowledge as any[]) {
          try {
            if (!item.question || !item.answer) continue;
            await storage.createKnowledgeBase({
              agentId: agent.id,
              category: item.category || "faq",
              question: String(item.question),
              answer: String(item.answer),
            }, userId);
          } catch (kbError) {
            console.error('[Template] Error creating knowledge base item (non-fatal):', kbError);
          }
        }
      }

      res.json({ agentId: agent.id });
    } catch (error) {
      console.error("Error using template:", error);
      const message = error instanceof Error ? error.message : "Failed to create agent from template";
      res.status(500).json({ message });
    }
  });

  // Flow nodes routes
  app.get("/api/agents/:id/flow-nodes", isAuthenticated, async (req: any, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      if (agent.userId !== req.user.id) {
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
      if (agent.userId !== req.user.id) {
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
      if (agent.userId !== req.user.id) {
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
      if (agent.userId !== req.user.id) {
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

      // Sync workflow to Retell AI if configured
      if (await retell.isRetellConfigured() && agent.retellLlmId) {
        try {
          const flowNodes = await storage.getFlowNodes(req.params.id);
          
          // Convert to Orderly format for Retell sync
          const orderlyNodes = flowNodes.map(node => ({
            id: node.id,
            type: node.type,
            label: node.label,
            content: node.content || undefined,
            contentMode: (node.config as any)?.contentMode || 'prompt',
            config: node.config as Record<string, any> | undefined,
            transitions: (node.config as any)?.transitions || [],
          }));
          
          const orderlyConnections = createdConnections.map(conn => ({
            id: conn.id,
            sourceNodeId: conn.sourceNodeId,
            targetNodeId: conn.targetNodeId,
            sourceHandle: conn.sourceHandle || undefined,
            label: conn.label || undefined,
          }));

          // Must carry the knowledge base: this sync rewrites global_prompt, and
          // the editor always fires it right after PATCH. Passing the raw system
          // prompt here silently stripped the KB from the live agent on every save.
          const workflowEnrichedPrompt = await buildAgentPrompt(agent.systemPrompt || '', agent.id, agent.userId);

          await retell.syncWorkflowToRetell(
            agent.retellLlmId,
            orderlyNodes,
            orderlyConnections,
            workflowEnrichedPrompt,
            agent.aiModel || 'gpt-4o-mini',
            agent
          );
          
          console.log(`[Retell] Synced workflow for agent ${agent.id}`);
        } catch (retellError) {
          console.error('[Retell] Error syncing workflow:', retellError);
          // Don't fail the request - local save succeeded
        }
      }

      res.json(createdConnections);
    } catch (error) {
      console.error("Error saving flow connections:", error);
      res.status(500).json({ message: "Failed to save flow connections" });
    }
  });

  // Contact routes
  app.get("/api/contacts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      if (contact.userId !== req.user.id) {
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
  /**
   * Retell decides which agent actually answers, so it is the source of truth
   * for inbound routing. Our rows drifted from it whenever a Retell sync failed
   * after the DB write (see PATCH below), leaving the dashboard confidently
   * naming an agent that was not answering the phone.
   *
   * One list call covers every number. Only corrects a row when Retell names an
   * agent we can resolve locally — a blank inbound agent on Retell's side is
   * left alone rather than wiping a local assignment.
   */
  async function reconcilePhoneNumberAgents(userId: string, numbers: any[]): Promise<any[]> {
    if (!(await retell.isRetellConfigured())) return numbers;

    try {
      const [remote, agents] = await Promise.all([
        retell.listRetellPhoneNumbers(),
        storage.getAgents(userId),
      ]);

      const byRetellAgentId = new Map(
        agents.filter((a: any) => a.retellAgentId).map((a: any) => [a.retellAgentId, a]),
      );
      const digits = (s: string) => (s || '').replace(/\D/g, '');
      const remoteByNumber = new Map(remote.map((r: any) => [digits(r.phoneNumber), r]));

      return await Promise.all(numbers.map(async (n: any) => {
        const match = remoteByNumber.get(digits(n.number));
        const localAgent = match?.inboundAgentId
          ? byRetellAgentId.get(match.inboundAgentId)
          : undefined;
        if (!localAgent || localAgent.id === n.agentId) return n;

        console.warn(
          `[Retell] Phone ${n.number} answers as agent ${localAgent.id} (${localAgent.name}) ` +
          `but our record said ${n.agentId ?? 'none'} — correcting to match.`,
        );
        const updated = await storage.updatePhoneNumber(n.id, userId, { agentId: localAgent.id } as any);
        return updated ?? { ...n, agentId: localAgent.id };
      }));
    } catch (err) {
      console.error('[Retell] Could not reconcile phone number agents:', err);
      return numbers;
    }
  }

  app.get("/api/phone-numbers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const phoneNumbers = await storage.getPhoneNumbers(userId);
      res.json(await reconcilePhoneNumberAgents(userId, phoneNumbers));
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

      const userId = req.user.id;
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

      // Connect the number to the voice provider. Without this the number is
      // bought and shown in the dashboard but no inbound call ever reaches an
      // agent — previously the silent default.
      const provisioned = await provisionNumberForRetell(twilioClient, {
        phoneNumberRecordId: created.id,
        userId,
        number: created.number,
        providerSid: created.providerId,
      });

      res.json(provisioned.ok ? created : { ...created, routingWarning: provisioned.warning });
    } catch (error: any) {
      console.error("Error purchasing phone number:", error);
      res.status(500).json({ message: error.message || "Failed to purchase phone number" });
    }
  });

  // SIP Trunk connection endpoint
  app.post("/api/phone-numbers/sip-trunk", isAuthenticated, async (req: any, res) => {
    try {
      if (!twilioClient) {
        return res.status(503).json({ message: "Twilio not configured" });
      }

      const userId = req.user.id;
      const { 
        phoneNumber, 
        friendlyName, 
        sipDomain,
        sipAuthType = 'credentials',
        sipUsername,
        sipPassword,
        ipAddresses 
      } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }

      // Clean phone number (remove formatting)
      const cleanNumber = phoneNumber.replace(/[^+\d]/g, '');
      if (cleanNumber.length < 10) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }

      // Create or use existing SIP domain
      let finalSipDomain = sipDomain;
      let trunkSid: string | null = null;

      try {
        // Create a SIP trunk for this user if they don't have one
        const trunkName = `orderly-${userId.substring(0, 8)}`;
        
        // Try to find existing trunk or create new one
        const trunks = await twilioClient.trunking.v1.trunks.list({ limit: 50 });
        let trunk = trunks.find(t => t.friendlyName === trunkName);
        
        if (!trunk) {
          // Create new SIP trunk
          trunk = await twilioClient.trunking.v1.trunks.create({
            friendlyName: trunkName,
            secure: true,
          });
        }
        
        trunkSid = trunk.sid;

        // Generate domain if not provided
        if (!finalSipDomain) {
          finalSipDomain = `${trunkName}.sip.twilio.com`;
        }

        // Origination = where Twilio sends INBOUND calls. This must point at
        // the voice provider. It previously pointed at
        // sip:<number>@<trunk>.sip.twilio.com — back at Twilio itself — so
        // inbound calls reached the trunk and then went nowhere. (A repl.co
        // URL was also computed here and never sent to Twilio at all; it was
        // only written to our own DB, which made the trunk look configured.)
        try {
          await twilioClient.trunking.v1.trunks(trunk.sid)
            .originationUrls
            .create({
              friendlyName: `Retell origination for ${cleanNumber}`,
              sipUrl: RETELL_ORIGINATION_URI,
              weight: 1,
              priority: 1,
              enabled: true,
            });
        } catch (origError: any) {
          // Origination might already exist, continue
          if (!origError.message?.includes('already exists')) {
            console.warn("Origination URL warning:", origError.message);
          }
        }

        // Handle authentication based on type
        if (sipAuthType === 'credentials' && sipUsername && sipPassword) {
          // Create credential list
          try {
            const credList = await twilioClient.sip.credentialLists.create({
              friendlyName: `Creds-${cleanNumber}`,
            });
            
            await twilioClient.sip.credentialLists(credList.sid)
              .credentials
              .create({
                username: sipUsername,
                password: sipPassword,
              });
            
            // Associate credential list with trunk (use any to bypass SDK type issues)
            await (twilioClient.trunking.v1.trunks(trunk.sid) as any)
              .credentialLists
              .create({ credentialListSid: credList.sid });
          } catch (credError: any) {
            console.warn("Credential setup warning:", credError.message);
          }
        } else if (sipAuthType === 'ip_acl' && ipAddresses) {
          // Create IP ACL
          try {
            const aclList = await twilioClient.sip.ipAccessControlLists.create({
              friendlyName: `ACL-${cleanNumber}`,
            });
            
            // Add each IP address
            const ips = ipAddresses.split(',').map((ip: string) => ip.trim()).filter(Boolean);
            for (const ip of ips) {
              await twilioClient.sip.ipAccessControlLists(aclList.sid)
                .ipAddresses
                .create({
                  friendlyName: ip,
                  ipAddress: ip,
                });
            }
            
            // Associate IP ACL with trunk
            await twilioClient.trunking.v1.trunks(trunk.sid)
              .ipAccessControlLists
              .create({ ipAccessControlListSid: aclList.sid });
          } catch (aclError: any) {
            console.warn("IP ACL setup warning:", aclError.message);
          }
        }
      } catch (trunkError: any) {
        console.error("SIP trunk setup error:", trunkError);
        // Continue anyway - we can still create the phone number record
      }

      // Create phone number record with SIP trunk info
      const phoneNumberData = {
        userId,
        number: cleanNumber,
        friendlyName: friendlyName?.trim() || cleanNumber,
        provider: 'twilio',
        providerId: null, // No Twilio phone number SID for SIP trunked numbers
        status: 'active',
        capabilities: { voice: true, sms: false },
        connectionType: 'sip_trunk',
        sipDomain: finalSipDomain,
        sipUri: `sip:${cleanNumber}@${finalSipDomain}`,
        sipAuthType,
        trunkSid,
        originationUrl: RETELL_ORIGINATION_URI,
      };

      const created = await storage.createPhoneNumber(phoneNumberData);

      // The trunk alone doesn't route anything: Retell also has to know the
      // number exists. Without this the trunk is configured and calls still
      // fail. providerId is null here, so provisioning skips the trunk-attach
      // step (the number is already on the trunk) and only imports.
      const provisioned = await provisionNumberForRetell(twilioClient, {
        phoneNumberRecordId: created.id,
        userId,
        number: created.number,
        providerSid: null,
      });

      res.json(provisioned.ok ? created : { ...created, routingWarning: provisioned.warning });
    } catch (error: any) {
      console.error("Error creating SIP trunk connection:", error);
      res.status(500).json({ message: error.message || "Failed to connect SIP trunk" });
    }
  });

  app.patch("/api/phone-numbers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
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

      // Calls are billed to the *agent's* owner, so assigning another tenant's
      // agent to your number would charge them for your traffic and expose
      // their prompt and knowledge base to your callers.
      if (cleanedData.agentId) {
        const targetAgent = await storage.getAgent(cleanedData.agentId);
        if (!targetAgent || targetAgent.userId !== userId) {
          return res.status(404).json({ message: "Agent not found" });
        }
      }

      // Capture old agentId before update to detect changes
      const existingPhoneNumber = await storage.getPhoneNumber(req.params.id);

      const phoneNumber = await storage.updatePhoneNumber(req.params.id, userId, cleanedData);
      if (!phoneNumber) {
        return res.status(404).json({ message: "Phone number not found or access denied" });
      }

      // If agentId changed and the phone number has a Retell number ID, sync with Retell
      let routingWarning: string | null = null;
      if ('agentId' in cleanedData && existingPhoneNumber && cleanedData.agentId !== existingPhoneNumber.agentId) {
        try {
          if (await retell.isRetellConfigured()) {
            const retellNumberId = phoneNumber.retellPhoneNumberId || phoneNumber.number;
            if (cleanedData.agentId) {
              const targetAgent = await storage.getAgent(cleanedData.agentId);
              if (!targetAgent?.retellAgentId) {
                routingWarning = 'Agent is not synced to the voice provider yet, so calls will not reach it. Open the agent and save it to sync.';
              } else if (!phoneNumber.retellPhoneNumberId) {
                // Number was never registered with the voice provider (numbers
                // bought before provisioning existed). Do it now, binding the
                // agent in the same step.
                const provisioned = await provisionNumberForRetell(twilioClient, {
                  phoneNumberRecordId: phoneNumber.id,
                  userId,
                  number: phoneNumber.number,
                  providerSid: phoneNumber.providerId,
                  inboundAgentId: targetAgent.retellAgentId,
                });
                if (provisioned.ok) {
                  console.log(`[Retell] Provisioned + linked ${phoneNumber.number} -> agent ${targetAgent.retellAgentId}`);
                } else {
                  routingWarning = provisioned.warning ?? null;
                }
              } else {
                // updateRetellPhoneNumber returns false on failure rather than
                // throwing. Ignoring it previously logged success and returned
                // 200 while no call routing existed at all.
                const linked = await retell.updateRetellPhoneNumber(retellNumberId, targetAgent.retellAgentId);
                if (linked) {
                  console.log(`[Retell] Linked phone ${retellNumberId} -> agent ${targetAgent.retellAgentId}`);
                } else {
                  console.error(`[Retell] FAILED to link phone ${retellNumberId} -> agent ${targetAgent.retellAgentId}`);
                  routingWarning = 'Saved, but the number could not be linked to the voice provider, so inbound calls will not reach this agent yet.';
                }
              }
            } else {
              // agentId cleared — remove inbound agent from Retell
              const cleared = await retell.updateRetellPhoneNumber(retellNumberId, undefined);
              console.log(`[Retell] Cleared inbound agent for phone ${retellNumberId}: ${cleared ? 'ok' : 'FAILED'}`);
            }
          } else {
            routingWarning = 'Voice provider is not configured, so inbound calls will not reach this agent.';
          }
        } catch (retellErr) {
          console.error('[Retell] Error syncing phone number assignment:', retellErr);
          routingWarning = 'Saved, but linking the number to the voice provider failed. Inbound calls will not reach this agent yet.';
        }
      }

      // The DB write happens before the Retell sync, so a failed sync used to
      // leave us claiming an assignment that was never made — the row said one
      // agent while a different one answered the phone. Put the old value back
      // so our record keeps describing who actually takes the call.
      let responseNumber = phoneNumber;
      if (routingWarning && 'agentId' in cleanedData && existingPhoneNumber) {
        const revert = await storage.updatePhoneNumber(req.params.id, userId, {
          agentId: existingPhoneNumber.agentId,
        } as any);
        if (revert) responseNumber = revert;
        console.warn(
          `[Retell] Reverted agent assignment for ${phoneNumber.number} to ` +
          `${existingPhoneNumber.agentId ?? 'none'} — the voice provider did not accept the change.`,
        );
      }

      res.json(routingWarning ? { ...responseNumber, routingWarning } : responseNumber);
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
      const userId = req.user.id;
      const phoneNumber = await storage.getPhoneNumber(req.params.id);

      if (!phoneNumber || phoneNumber.userId !== userId) {
        return res.status(404).json({ message: "Phone number not found or access denied" });
      }

      if (twilioClient) {
        // Handle cleanup based on connection type
        if (phoneNumber.connectionType === 'sip_trunk' && phoneNumber.trunkSid) {
          // Clean up SIP trunk resources
          console.log(`Disconnecting SIP trunk for ${phoneNumber.number}`);
          try {
            const trunkSid = phoneNumber.trunkSid;
            const trunkContext = twilioClient.trunking.v1.trunks(trunkSid);
            
            // Remove origination URLs associated with this number
            const originationUrls = await trunkContext.originationUrls.list();
            
            for (const origUrl of originationUrls) {
              if (origUrl.sipUrl?.includes(phoneNumber.number)) {
                await trunkContext.originationUrls(origUrl.sid).remove();
                console.log(`Removed origination URL: ${origUrl.sid}`);
              }
            }
            
            // Check if trunk has any remaining origination URLs
            const remainingUrls = await trunkContext.originationUrls.list();
            
            // If no other numbers using this trunk, delete the entire trunk and its resources
            if (remainingUrls.length === 0) {
              console.log(`Trunk ${trunkSid} has no more origination URLs, cleaning up...`);
              
              // Remove credential list associations from trunk (cast to any for SDK type compatibility)
              try {
                const credLists = await (trunkContext as any).credentialLists.list();
                for (const credList of credLists) {
                  await (trunkContext as any).credentialLists(credList.sid).remove();
                  console.log(`Removed credential list association: ${credList.sid}`);
                }
              } catch (credError: any) {
                console.warn("Credential list cleanup warning:", credError.message);
              }
              
              // Remove IP ACL associations from trunk
              try {
                const ipAcls = await (trunkContext as any).ipAccessControlLists.list();
                for (const ipAcl of ipAcls) {
                  await (trunkContext as any).ipAccessControlLists(ipAcl.sid).remove();
                  console.log(`Removed IP ACL association: ${ipAcl.sid}`);
                }
              } catch (ipAclError: any) {
                console.warn("IP ACL cleanup warning:", ipAclError.message);
              }
              
              // Delete the trunk itself
              try {
                await trunkContext.remove();
                console.log(`Deleted SIP trunk: ${trunkSid}`);
              } catch (trunkDeleteError: any) {
                console.warn("Trunk deletion warning:", trunkDeleteError.message);
              }
            }
          } catch (sipError: any) {
            console.error("Error cleaning up SIP trunk:", sipError.message);
            // Continue with database deletion even if cleanup fails
          }
        } else if (phoneNumber.providerId) {
          // Release purchased number from Twilio
          try {
            await twilioClient.incomingPhoneNumbers(phoneNumber.providerId).remove();
          } catch (twilioError) {
            console.error("Error releasing from Twilio:", twilioError);
            // Continue with database deletion even if Twilio fails
          }
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
      const userId = req.user.id;
      const integrations = await storage.getIntegrations(userId);
      res.json(integrations);
    } catch (error) {
      console.error("Error fetching integrations:", error);
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
    const userId = req.user.id;
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

    const scopes = ['MERCHANT_PROFILE_READ', 'ITEMS_READ', 'ORDERS_READ', 'ORDERS_WRITE', 'PAYMENTS_WRITE', 'CUSTOMERS_WRITE'].join(' ');
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

  // Square API helper function - gets valid access token with auto-refresh
  async function getSquareAccessToken(userId: string): Promise<{ accessToken: string; merchantId: string } | null> {
    const integrations = await storage.getIntegrations(userId);
    const squareIntegration = integrations.find(i => i.service === 'square' && i.status === 'active');
    
    if (!squareIntegration || !squareIntegration.credentials) {
      return null;
    }

    const credentials = squareIntegration.credentials as {
      access_token: string;
      refresh_token: string;
      expires_at: string;
      merchant_id: string;
    };

    // Check if token is expired or will expire in next 5 minutes
    const expiresAt = new Date(credentials.expires_at).getTime();
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt - now < fiveMinutes) {
      // Token needs refresh
      const clientId = process.env.SQUARE_CLIENT_ID;
      const clientSecret = process.env.SQUARE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('Square OAuth not configured for token refresh');
        return null;
      }

      try {
        const refreshResponse = await fetch('https://connect.squareup.com/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: credentials.refresh_token,
          }),
        });

        if (!refreshResponse.ok) {
          console.error('Square token refresh failed:', await refreshResponse.text());
          return null;
        }

        const newTokens = await refreshResponse.json();
        
        // Square refresh response doesn't include expires_at - compute 30 days from now
        const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        const newExpiresAt = newTokens.expires_at || thirtyDaysFromNow;
        const newMerchantId = newTokens.merchant_id || credentials.merchant_id;
        
        // Update stored credentials
        await storage.updateIntegration(squareIntegration.id, userId, {
          credentials: {
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token || credentials.refresh_token,
            expires_at: newExpiresAt,
            merchant_id: newMerchantId,
          },
        });

        return { accessToken: newTokens.access_token, merchantId: newMerchantId };
      } catch (error) {
        console.error('Square token refresh error:', error);
        return null;
      }
    }

    return { accessToken: credentials.access_token, merchantId: credentials.merchant_id };
  }

  // Square API Proxy Endpoints

  // Get catalog/menu items
  app.get("/api/square/catalog", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/catalog/list?types=ITEM,CATEGORY,MODIFIER_LIST', {
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square catalog error:', error);
        return res.status(response.status).json({ message: "Failed to fetch catalog", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square catalog error:', error);
      res.status(500).json({ message: "Failed to fetch Square catalog" });
    }
  });

  // Get locations
  app.get("/api/square/locations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/locations', {
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square locations error:', error);
        return res.status(response.status).json({ message: "Failed to fetch locations", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square locations error:', error);
      res.status(500).json({ message: "Failed to fetch Square locations" });
    }
  });

  // Search/create customers
  app.post("/api/square/customers/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/customers/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square customer search error:', error);
        return res.status(response.status).json({ message: "Failed to search customers", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square customer search error:', error);
      res.status(500).json({ message: "Failed to search Square customers" });
    }
  });

  app.post("/api/square/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square customer create error:', error);
        return res.status(response.status).json({ message: "Failed to create customer", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square customer create error:', error);
      res.status(500).json({ message: "Failed to create Square customer" });
    }
  });

  // Create order
  app.post("/api/square/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square order create error:', error);
        return res.status(response.status).json({ message: "Failed to create order", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square order create error:', error);
      res.status(500).json({ message: "Failed to create Square order" });
    }
  });

  // Create payment link (for "pay now" flow)
  app.post("/api/square/payment-links", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/online-checkout/payment-links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square payment link error:', error);
        return res.status(response.status).json({ message: "Failed to create payment link", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square payment link error:', error);
      res.status(500).json({ message: "Failed to create Square payment link" });
    }
  });

  // Process payment directly
  app.post("/api/square/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tokenInfo = await getSquareAccessToken(userId);

      if (!tokenInfo) {
        return res.status(401).json({ message: "Square not connected or token expired. Please reconnect." });
      }

      const response = await fetch('https://connect.squareup.com/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenInfo.accessToken}`,
          'Square-Version': '2024-01-18',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Square payment error:', error);
        return res.status(response.status).json({ message: "Failed to process payment", error });
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Square payment error:', error);
      res.status(500).json({ message: "Failed to process Square payment" });
    }
  });

  // Toast OAuth routes
  app.get("/api/integrations/toast/oauth/init", isAuthenticated, async (req: any, res) => {
    const userId = req.user.id;
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

    const scopes = [
      'config:read',
      'menus:read',
      'orders:read',
      'orders.orders:write',
      'orders.items:write',
      'orders.payments:write',
      'guest.pi:read',
      'restaurants:read',
    ].join(' ');

    const authUrl = `https://ws-api.toasttab.com/authentication/v1/oauth/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${nonce}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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

  app.get("/api/analytics/usage-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;

      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const periodMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime());
      const prevStart = new Date(start.getTime() - periodMs);

      const [currentUsage, prevUsage, currentCalls, prevCalls] = await Promise.all([
        db.select({
          totalMinutes: sql<string>`COALESCE(SUM(CAST(${usageLedger.minutesUsed} AS numeric)), 0)`,
          totalCostCents: sql<string>`COALESCE(SUM(CAST(${usageLedger.costCents} AS numeric)), 0)`,
          callCount: sql<number>`COUNT(*)`,
        }).from(usageLedger).where(
          and(
            eq(usageLedger.userId, userId),
            sql`${usageLedger.createdAt} >= ${start}`,
            sql`${usageLedger.createdAt} <= ${end}`
          )
        ),
        db.select({
          totalMinutes: sql<string>`COALESCE(SUM(CAST(${usageLedger.minutesUsed} AS numeric)), 0)`,
          totalCostCents: sql<string>`COALESCE(SUM(CAST(${usageLedger.costCents} AS numeric)), 0)`,
          callCount: sql<number>`COUNT(*)`,
        }).from(usageLedger).where(
          and(
            eq(usageLedger.userId, userId),
            sql`${usageLedger.createdAt} >= ${prevStart}`,
            sql`${usageLedger.createdAt} < ${prevEnd}`
          )
        ),
        db.select({
          count: sql<number>`COUNT(*)`,
          avgDuration: sql<string>`COALESCE(AVG(NULLIF(CAST(${callLogs.durationSeconds} AS numeric), 0)), 0)`,
        }).from(callLogs).where(
          and(
            eq(callLogs.userId, userId),
            sql`${callLogs.createdAt} >= ${start}`,
            sql`${callLogs.createdAt} <= ${end}`
          )
        ),
        db.select({
          count: sql<number>`COUNT(*)`,
          avgDuration: sql<string>`COALESCE(AVG(NULLIF(CAST(${callLogs.durationSeconds} AS numeric), 0)), 0)`,
        }).from(callLogs).where(
          and(
            eq(callLogs.userId, userId),
            sql`${callLogs.createdAt} >= ${prevStart}`,
            sql`${callLogs.createdAt} < ${prevEnd}`
          )
        ),
      ]);

      const dailyRows = await db.select({
        day: sql<string>`DATE(${usageLedger.createdAt})`,
        minutes: sql<string>`COALESCE(SUM(CAST(${usageLedger.minutesUsed} AS numeric)), 0)`,
        costCents: sql<string>`COALESCE(SUM(CAST(${usageLedger.costCents} AS numeric)), 0)`,
        callCount: sql<number>`COUNT(*)`,
      }).from(usageLedger).where(
        and(
          eq(usageLedger.userId, userId),
          sql`${usageLedger.createdAt} >= ${start}`,
          sql`${usageLedger.createdAt} <= ${end}`
        )
      ).groupBy(sql`DATE(${usageLedger.createdAt})`).orderBy(sql`DATE(${usageLedger.createdAt})`);

      const currCallCount = Number(currentUsage[0]?.callCount || 0);
      const currCostCents = parseFloat(currentUsage[0]?.totalCostCents || '0');
      const prevCallCount = Number(prevUsage[0]?.callCount || 0);
      const prevCostCents = parseFloat(prevUsage[0]?.totalCostCents || '0');

      res.json({
        current: {
          totalMinutes: parseFloat(currentUsage[0]?.totalMinutes || '0'),
          totalCostCents: currCostCents,
          callCount: currCallCount,
          avgCostCentsPerCall: currCallCount > 0 ? currCostCents / currCallCount : 0,
          avgDurationSeconds: parseFloat(currentCalls[0]?.avgDuration || '0'),
          dailyBreakdown: dailyRows.map(r => ({
            date: r.day,
            minutes: parseFloat(r.minutes),
            costCents: parseFloat(r.costCents),
            callCount: Number(r.callCount),
          })),
        },
        previousPeriod: {
          totalMinutes: parseFloat(prevUsage[0]?.totalMinutes || '0'),
          totalCostCents: prevCostCents,
          callCount: prevCallCount,
          avgCostCentsPerCall: prevCallCount > 0 ? prevCostCents / prevCallCount : 0,
          avgDurationSeconds: parseFloat(prevCalls[0]?.avgDuration || '0'),
        },
      });
    } catch (error) {
      console.error("Error fetching usage summary:", error);
      res.status(500).json({ message: "Failed to fetch usage summary" });
    }
  });

  // Call logs routes
  app.get("/api/call-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const logs = await storage.getCallLogsForUser(userId, start, end);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching call logs:", error);
      res.status(500).json({ message: "Failed to fetch call logs" });
    }
  });

  app.get("/api/call-logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const log = await storage.getCallLogById(req.params.id);
      
      if (!log) {
        return res.status(404).json({ message: "Call log not found" });
      }
      if (log.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      res.json(log);
    } catch (error) {
      console.error("Error fetching call log:", error);
      res.status(500).json({ message: "Failed to fetch call log" });
    }
  });

  app.post("/api/call-logs/:id/analyze", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const log = await storage.getCallLogById(req.params.id);

      if (!log) {
        return res.status(404).json({ message: "Call log not found" });
      }
      if (log.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (!log.transcript) {
        return res.status(400).json({ message: "No transcript available to analyze" });
      }

      const analysis = await analyzeCallTranscript(log.transcript);

      const updated = await storage.updateCallLog(log.id, {
        callerName: analysis.callerName,
        sentiment: analysis.sentiment,
        callOutcome: analysis.callOutcome,
        orderSummary: analysis.orderSummary,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error analyzing call log:", error);
      res.status(500).json({ message: "Failed to analyze call log" });
    }
  });

  // Subscription routes
  app.get("/api/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let subscription = await storage.getSubscription(userId);

      // If no subscription exists, create a default trial subscription
      if (!subscription) {
        subscription = await storage.createSubscription({
          userId,
          planType: 'trial',
          status: 'active',
          minutesLimit: '60',
          agentsLimit: '1',
          phoneNumbersLimit: '1',
          concurrentCallsLimit: '2',
        });

        // Also create initial usage metrics
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        await storage.createUsageMetrics({
          userId,
          subscriptionId: subscription.id,
          periodStart: now,
          periodEnd,
          minutesUsed: '0',
          activeAgents: '0',
          activePhoneNumbers: '0',
          totalCalls: '0',
          overageMinutes: '0',
          overageCharges: '0',
        });
      }

      res.json(subscription);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Admin-only: plan limits are entitlements, so a user must not be able to
  // grant themselves a tier. Billing is usage-based and settled through Stripe;
  // the dashboard only ever reads this resource.
  app.put("/api/subscription", isAdmin, async (req: any, res) => {
    try {
      const targetUserId = req.body.userId;
      const userId = typeof targetUserId === 'string' && targetUserId ? targetUserId : req.user.id;

      // Validate plan type
      const validPlans = ['trial', 'starter', 'professional', 'business', 'enterprise'];
      const { planType } = req.body;

      if (planType && !validPlans.includes(planType)) {
        return res.status(400).json({ message: "Invalid plan type" });
      }

      // Define plan limits
      const planLimits: Record<string, any> = {
        trial: {
          minutesLimit: '60',
          agentsLimit: '1',
          phoneNumbersLimit: '1',
          concurrentCallsLimit: '2',
          posIntegrationsEnabled: false,
          analyticsEnabled: false,
        },
        starter: {
          minutesLimit: '500',
          agentsLimit: '1',
          phoneNumbersLimit: '1',
          concurrentCallsLimit: '2',
          posIntegrationsEnabled: false,
          analyticsEnabled: false,
        },
        professional: {
          minutesLimit: '2000',
          agentsLimit: '3',
          phoneNumbersLimit: '3',
          concurrentCallsLimit: '5',
          posIntegrationsEnabled: true,
          analyticsEnabled: true,
        },
        business: {
          minutesLimit: '10000',
          agentsLimit: '999',
          phoneNumbersLimit: '10',
          concurrentCallsLimit: '20',
          posIntegrationsEnabled: true,
          analyticsEnabled: true,
          customWorkflowsEnabled: true,
        },
        enterprise: {
          minutesLimit: '99999',
          agentsLimit: '999',
          phoneNumbersLimit: '999',
          concurrentCallsLimit: '999',
          posIntegrationsEnabled: true,
          analyticsEnabled: true,
          customWorkflowsEnabled: true,
          prioritySupportEnabled: true,
        },
      };

      // Build safe update object with plan limits if changing plan
      const updates: any = {};
      if (planType) {
        updates.planType = planType;
        Object.assign(updates, planLimits[planType]);
      }

      const subscription = await storage.updateSubscription(userId, updates);
      if (!subscription) {
        return res.status(404).json({ message: "Subscription not found" });
      }

      res.json(subscription);
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Usage metrics routes
  app.get("/api/usage-metrics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const metrics = await storage.getCurrentUsageMetrics(userId);
      
      if (!metrics) {
        return res.status(404).json({ message: "No usage metrics found" });
      }

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching usage metrics:", error);
      res.status(500).json({ message: "Failed to fetch usage metrics" });
    }
  });

  // ==================== BILLING & WEBHOOKS ====================

  const ORDERLY_METER_EVENT_NAME = 'orderly_call_minutes';

  async function getOrCreateMeter(stripe: any) {
    const meters = await stripe.billing.meters.list({ limit: 100 });
    let meter = meters.data.find((m: any) => m.event_name === ORDERLY_METER_EVENT_NAME && m.status === 'active');

    if (meter) {
      return meter;
    }

    meter = await stripe.billing.meters.create({
      display_name: 'Orderly AI Call Minutes',
      event_name: ORDERLY_METER_EVENT_NAME,
      default_aggregation: { formula: 'sum' },
      customer_mapping: {
        type: 'by_id',
        event_payload_key: 'stripe_customer_id',
      },
    });

    return meter;
  }

  async function getOrCreateMeteredPrice(stripe: any) {
    const ORDERLY_PRODUCT_NAME = 'Orderly AI Usage';
    const ORDERLY_METERED_PRICE_LOOKUP = 'orderly_usage_per_cent_v2';

    const existingPrices = await stripe.prices.list({
      lookup_keys: [ORDERLY_METERED_PRICE_LOOKUP],
      active: true,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      return existingPrices.data[0];
    }

    const meter = await getOrCreateMeter(stripe);

    const products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find((p: any) => p.name === ORDERLY_PRODUCT_NAME);

    if (!product) {
      product = await stripe.products.create({
        name: ORDERLY_PRODUCT_NAME,
        metadata: { type: 'usage_billing' },
      });
    }

    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      unit_amount: 1,
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        meter: meter.id,
      },
      lookup_key: ORDERLY_METERED_PRICE_LOOKUP,
      metadata: { description: 'Per cent usage charge (1 unit = 1 cent)' },
    });

    return price;
  }

  // Get Stripe publishable key for frontend
  app.get("/api/billing/stripe-config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ 
        publishableKey,
        hasStripeConnection: !!publishableKey 
      });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ message: "Failed to get Stripe configuration" });
    }
  });

  // Valid plan types whitelist - now just 'standard' with usage-based billing
  const VALID_PLAN_TYPES = ['standard', 'starter', 'professional', 'business', 'enterprise'] as const;
  type ValidPlanType = typeof VALID_PLAN_TYPES[number];

  function isValidPlanType(plan: string): plan is ValidPlanType {
    return VALID_PLAN_TYPES.includes(plan as ValidPlanType);
  }

  // Create Stripe checkout session for subscription
  app.post("/api/billing/create-checkout-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { planType, priceId } = req.body;

      // Validate planType against whitelist
      if (!planType || typeof planType !== 'string') {
        return res.status(400).json({ message: "planType is required" });
      }

      const normalizedPlan = planType.toLowerCase().trim();
      if (!isValidPlanType(normalizedPlan)) {
        return res.status(400).json({ 
          message: `Invalid plan type. Valid options: ${VALID_PLAN_TYPES.join(', ')}` 
        });
      }

      if (normalizedPlan === 'enterprise') {
        return res.status(400).json({ message: "Please contact sales for Enterprise plans" });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if user already has a Stripe customer ID
      let subscription = await storage.getSubscription(userId);
      let customerId = subscription?.stripeCustomerId;

      // Create customer if needed
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
      }

      // Price IDs for each plan tier (these would be your actual Stripe price IDs)
      // In production, these should be fetched from Stripe or stored in environment variables
      const priceTiers: Record<ValidPlanType, string> = {
        standard: priceId || process.env.STRIPE_STANDARD_PRICE_ID || 'price_standard',
        starter: priceId || process.env.STRIPE_STARTER_PRICE_ID || 'price_starter',
        professional: priceId || process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_pro',
        business: priceId || process.env.STRIPE_BUSINESS_PRICE_ID || 'price_business',
        enterprise: priceId || process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_enterprise',
      };

      const selectedPrice = priceTiers[normalizedPlan];

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: selectedPrice, quantity: 1 }],
        success_url: `${req.headers.origin || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/settings?checkout=success`,
        cancel_url: `${req.headers.origin || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/settings?checkout=canceled`,
        metadata: { userId, planType },
        subscription_data: {
          metadata: { userId, planType },
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
    }
  });

  // Create Stripe portal session for subscription management
  app.post("/api/billing/create-portal-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const subscription = await storage.getSubscription(userId);
      if (!subscription?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${req.headers.origin || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/settings`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: error.message || "Failed to create portal session" });
    }
  });

  app.post("/api/billing/create-setup-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let subscription = await storage.getSubscription(userId);
      let customerId = subscription?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
          metadata: { userId },
        });
        customerId = customer.id;
        if (subscription) {
          await storage.updateSubscription(userId, { stripeCustomerId: customerId });
        } else {
          await storage.createSubscription({
            userId,
            planType: 'trial',
            stripeCustomerId: customerId,
            minutesLimit: '100',
          });
        }
      }

      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating setup intent:", error);
      res.status(500).json({ message: error.message || "Failed to create setup intent" });
    }
  });

  app.post("/api/billing/confirm-payment-method", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const subscription = await storage.getSubscription(userId);
      if (!subscription?.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found" });
      }

      const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);
      if (customer.deleted) {
        return res.status(400).json({ message: "Customer not found" });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: 'card',
      });

      if (paymentMethods.data.length > 0) {
        const defaultPm = paymentMethods.data[0];
        await stripe.customers.update(subscription.stripeCustomerId, {
          invoice_settings: { default_payment_method: defaultPm.id },
        });

        if (!subscription.stripeSubscriptionId) {
          const meteredPrice = await getOrCreateMeteredPrice(stripe);

          const stripeSub = await stripe.subscriptions.create({
            customer: subscription.stripeCustomerId,
            items: [{ price: meteredPrice.id }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
          });

          const now = new Date();
          const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

          await storage.updateSubscription(userId, {
            planType: 'standard',
            status: 'active',
            stripeSubscriptionId: stripeSub.id,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            minutesLimit: '999999',
          });
        } else {
          await storage.updateSubscription(userId, {
            planType: subscription.planType === 'trial' ? 'standard' : subscription.planType,
          });
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error confirming payment method:", error);
      res.status(500).json({ message: error.message || "Failed to confirm payment method" });
    }
  });

  // Cancel subscription
  app.post("/api/billing/cancel-subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.status(503).json({ message: "Stripe is not configured" });
      }

      const subscription = await storage.getSubscription(userId);
      if (!subscription?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      // Cancel at period end so user keeps access until subscription expires
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local subscription status
      await storage.updateSubscription(userId, {
        status: 'canceling',
      });

      res.json({ message: "Subscription will be canceled at the end of the billing period" });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });

  // Delete user account
  app.delete("/api/auth/account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { confirmEmail } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify confirmation email matches
      if (confirmEmail !== user.email) {
        return res.status(400).json({ message: "Email confirmation does not match" });
      }

      // Cancel any active Stripe subscription first
      const subscription = await storage.getSubscription(userId);
      if (subscription?.stripeSubscriptionId) {
        try {
          const stripe = await getUncachableStripeClient();
          if (stripe) {
            await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
          }
        } catch (stripeError: any) {
          console.error("Error canceling Stripe subscription during account deletion:", stripeError.message);
        }
      }

      // Delete admin_audit_logs rows referencing this user (no cascade on those FKs)
      await db.delete(adminAuditLogs).where(eq(adminAuditLogs.targetUserId, userId));
      await db.delete(adminAuditLogs).where(eq(adminAuditLogs.adminUserId, userId));

      // Delete all user data (remaining tables cascade automatically)
      await storage.deleteUserAccount(userId);

      // Destroy the session
      req.logout((err: any) => {
        if (err) {
          console.error("Error during logout:", err);
        }
        req.session.destroy((sessionErr: any) => {
          if (sessionErr) {
            console.error("Error destroying session:", sessionErr);
          }
          res.json({ message: "Account deleted successfully" });
        });
      });
    } catch (error: any) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: error.message || "Failed to delete account" });
    }
  });

  // Get invoices for user
  app.get("/api/billing/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const invoices = await storage.getInvoices(userId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get usage ledger entries for billing display
  app.get("/api/billing/usage", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = await storage.getSubscription(userId);
      
      if (!subscription) {
        return res.json({ 
          currentPeriodUsage: 0,
          usageLimit: 0,
          percentUsed: 0,
        });
      }

      // Get current billing period usage
      const periodStart = subscription.currentPeriodStart || new Date(new Date().setDate(1));
      const periodEnd = subscription.currentPeriodEnd || new Date();
      
      const totalMinutes = await storage.getTotalUsageForPeriod(userId, periodStart, periodEnd);
      const limitMinutes = parseFloat(subscription.minutesLimit || '500');
      
      res.json({
        currentPeriodUsage: totalMinutes,
        usageLimit: limitMinutes,
        percentUsed: limitMinutes > 0 ? (totalMinutes / limitMinutes) * 100 : 0,
        periodStart,
        periodEnd,
      });
    } catch (error) {
      console.error("Error fetching usage:", error);
      res.status(500).json({ message: "Failed to fetch usage" });
    }
  });

  // Get call logs for billing/analytics
  app.get("/api/billing/call-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { startDate, endDate } = req.query;
      
      const logs = await storage.getCallLogsForUser(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching call logs:", error);
      res.status(500).json({ message: "Failed to fetch call logs" });
    }
  });

  // Get usage ledger entries for current user (call-by-call with model/cost breakdown)
  app.get("/api/billing/usage-ledger", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const entries = await storage.getUsageLedgerForUser(userId, 20);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching usage ledger:", error);
      res.status(500).json({ message: "Failed to fetch usage ledger" });
    }
  });

  // Get trial credit balance from Stripe customer balance
  app.get("/api/billing/credit-balance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = await storage.getSubscription(userId);

      if (!subscription?.stripeCustomerId) {
        return res.json({
          creditGrantedCents: DEFAULT_TRIAL_CREDIT_CENTS,
          balanceCents: 0,
          hasCredit: false,
        });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.json({ creditGrantedCents: DEFAULT_TRIAL_CREDIT_CENTS, balanceCents: 0, hasCredit: false });
      }

      const isTrial = !subscription.stripeSubscriptionId || subscription.planType === 'trial';

      const customer = await stripe.customers.retrieve(subscription.stripeCustomerId);
      if (customer.deleted) {
        return res.json({ creditGrantedCents: DEFAULT_TRIAL_CREDIT_CENTS, balanceCents: 0, hasCredit: false });
      }

      // Self-healing: only for trial accounts — if there are zero balance transactions,
      // the signup credit was never applied (e.g. Stripe was unavailable at signup)
      if (isTrial) {
        const balanceTransactions = await stripe.customers.listBalanceTransactions(
          subscription.stripeCustomerId,
          { limit: 1 }
        );
        if (balanceTransactions.data.length === 0) {
          console.log(`[BillingCredit] Auto-healing missing trial credit for user ${userId} (no balance transactions found)`);
          try {
            await stripe.customers.createBalanceTransaction(subscription.stripeCustomerId, {
              amount: -DEFAULT_TRIAL_CREDIT_CENTS,
              currency: 'usd',
              description: 'Orderly AI $10 Trial Credit (auto-healed)',
            });
            // Invalidate credit status cache so next call reflects new balance
            creditStatusCache.delete(userId);
            console.log(`[BillingCredit] Auto-healed $${DEFAULT_TRIAL_CREDIT_CENTS / 100} trial credit for user ${userId}`);
          } catch (healErr) {
            console.error(`[BillingCredit] Auto-heal failed for user ${userId}:`, healErr);
          }
          // Re-fetch the customer to get updated balance
          const refreshedCustomer = await stripe.customers.retrieve(subscription.stripeCustomerId);
          if (!refreshedCustomer.deleted) {
            const healedBalance = Math.max(0, -(refreshedCustomer.balance ?? 0));
            return res.json({
              creditGrantedCents: DEFAULT_TRIAL_CREDIT_CENTS,
              balanceCents: healedBalance,
              hasCredit: healedBalance > 0,
            });
          }
        }
      }

      // Stripe balance: negative = credit remaining, positive = amount owed
      const balanceCents = Math.max(0, -(customer.balance ?? 0));
      res.json({
        creditGrantedCents: DEFAULT_TRIAL_CREDIT_CENTS,
        balanceCents,
        hasCredit: balanceCents > 0,
      });
    } catch (error: any) {
      console.error("Error fetching credit balance:", error);
      res.status(500).json({ message: "Failed to fetch credit balance" });
    }
  });

  // Get payment method status for the current user
  app.get("/api/billing/payment-methods", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const subscription = await storage.getSubscription(userId);

      if (!subscription?.stripeCustomerId) {
        return res.json({ hasPaymentMethod: false, count: 0 });
      }

      const stripe = await getUncachableStripeClient();
      if (!stripe) {
        return res.json({ hasPaymentMethod: false, count: 0 });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.stripeCustomerId,
        type: 'card',
      });

      res.json({
        hasPaymentMethod: paymentMethods.data.length > 0,
        count: paymentMethods.data.length,
      });
    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      res.status(500).json({ message: "Failed to fetch payment methods" });
    }
  });

  // ==================== USER PREFERENCES ====================

  // Get user preferences
  app.get("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      let prefs = await storage.getUserPreferences(userId);
      
      // Create default preferences if they don't exist
      if (!prefs) {
        prefs = await storage.createUserPreferences({ userId });
      }
      
      res.json(prefs);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // Update user preferences
  app.patch("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { timezone, language, theme, emailNotifications, smsNotifications, marketingEmails, weeklyDigest } = req.body;
      
      // Ensure preferences exist
      let prefs = await storage.getUserPreferences(userId);
      if (!prefs) {
        prefs = await storage.createUserPreferences({ userId });
      }
      
      const updated = await storage.updateUserPreferences(userId, {
        timezone,
        language,
        theme,
        emailNotifications,
        smsNotifications,
        marketingEmails,
        weeklyDigest,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // ==================== API KEYS ====================

  // Get all API keys for user
  app.get("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const keys = await storage.getApiKeys(userId);
      // Don't return the hash, just return display info
      const safeKeys = keys.map(k => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        isActive: k.isActive,
        lastUsedAt: k.lastUsedAt,
        expiresAt: k.expiresAt,
        createdAt: k.createdAt,
      }));
      res.json(safeKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  // Create new API key
  app.post("/api/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, scopes, expiresAt } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      // Generate a new API key
      const bcrypt = await import("bcryptjs");
      const rawKey = `ord_${crypto.randomBytes(24).toString('hex')}`;
      const keyPrefix = rawKey.substring(0, 12) + '...';
      const keyHash = await bcrypt.hash(rawKey, 10);
      
      const apiKey = await storage.createApiKey({
        userId,
        name,
        keyPrefix,
        keyHash,
        scopes: scopes || [],
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      
      // Return the full key only once (on creation)
      res.json({
        id: apiKey.id,
        name: apiKey.name,
        key: rawKey, // Only returned on creation!
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  // Revoke API key
  app.patch("/api/api-keys/:id/revoke", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      await storage.revokeApiKey(id, userId);
      res.json({ message: "API key revoked" });
    } catch (error) {
      console.error("Error revoking API key:", error);
      res.status(500).json({ message: "Failed to revoke API key" });
    }
  });

  // Delete API key
  app.delete("/api/api-keys/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      
      await storage.deleteApiKey(id, userId);
      res.json({ message: "API key deleted" });
    } catch (error) {
      console.error("Error deleting API key:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // ==================== SECURITY / PASSWORD ====================

  // Change password
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify current password
      const bcrypt = await import("bcryptjs");
      if (user.passwordHash) {
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
      } else if (user.authProvider === 'google') {
        // Google-only users don't have a password to verify
        // They can set a new password without current password check
      }
      
      // Hash and save new password
      const newHash = await bcrypt.hash(newPassword, 12);
      await storage.updateUserPassword(userId, newHash);
      
      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Get 2FA status
  app.get("/api/auth/2fa/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const twoFactor = await storage.getTwoFactorAuth(userId);
      
      res.json({
        isEnabled: twoFactor?.isEnabled || false,
        hasBackupCodes: (twoFactor?.backupCodes?.length || 0) > 0,
        smsEnabled: twoFactor?.smsEnabled || false,
        phoneNumber: twoFactor?.phoneNumber ? `***-***-${twoFactor.phoneNumber.slice(-4)}` : null,
        preferredMethod: twoFactor?.preferredMethod || 'totp',
      });
    } catch (error) {
      console.error("Error fetching 2FA status:", error);
      res.status(500).json({ message: "Failed to fetch 2FA status" });
    }
  });

  // Setup 2FA (generate secret)
  app.post("/api/auth/2fa/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Use otplib for proper TOTP secret generation (base32 format)
      const { authenticator } = await import("otplib");
      const secret = authenticator.generateSecret();
      
      // Generate backup codes
      const backupCodes: string[] = [];
      const bcrypt = await import("bcryptjs");
      const hashedBackupCodes: string[] = [];
      
      for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);
        hashedBackupCodes.push(await bcrypt.hash(code, 10));
      }
      
      // Check if 2FA record exists
      const existing = await storage.getTwoFactorAuth(userId);
      if (existing) {
        await storage.updateTwoFactorAuth(userId, {
          secret,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
        });
      } else {
        await storage.createTwoFactorAuth({
          userId,
          secret,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
        });
      }
      
      // Generate proper otpauth URL using otplib
      const issuer = 'Orderly AI';
      const otpauthUrl = authenticator.keyuri(user.email || user.id, issuer, secret);
      
      res.json({
        secret,
        otpauthUrl,
        backupCodes, // Show backup codes only once during setup
      });
    } catch (error) {
      console.error("Error setting up 2FA:", error);
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  // Enable 2FA (after verification)
  app.post("/api/auth/2fa/enable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }
      
      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor || !twoFactor.secret) {
        return res.status(400).json({ message: "2FA not set up. Please run setup first." });
      }
      
      // Validate code format
      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Invalid code format. Enter 6 digits." });
      }
      
      // Verify the TOTP code using otplib
      const { authenticator } = await import("otplib");
      const isValid = authenticator.verify({ token: code, secret: twoFactor.secret });
      
      if (!isValid) {
        return res.status(400).json({ message: "Invalid verification code. Please try again." });
      }
      
      await storage.updateTwoFactorAuth(userId, { isEnabled: true });
      
      res.json({ message: "Two-factor authentication enabled" });
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      res.status(500).json({ message: "Failed to enable 2FA" });
    }
  });

  // Disable 2FA
  app.post("/api/auth/2fa/disable", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Verify password before disabling 2FA. Accounts that have a password
      // must supply it — omitting the field previously skipped the check.
      if (user.passwordHash) {
        if (!password) {
          return res.status(400).json({ message: "Password is required to disable two-factor authentication" });
        }
        const bcrypt = await import("bcryptjs");
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: "Password is incorrect" });
        }
      }

      await storage.deleteTwoFactorAuth(userId);
      
      res.json({ message: "Two-factor authentication disabled" });
    } catch (error) {
      console.error("Error disabling 2FA:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  // Setup SMS 2FA - send verification code to phone number
  app.post("/api/auth/2fa/sms/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      
      // Validate phone number format (basic validation)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }
      
      // Format phone number with country code if not present
      const formattedPhone = cleanPhone.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;
      
      // Send verification code
      const smsResult = await sendSms2FACode(formattedPhone, userId);
      if (!smsResult.success) {
        return res.status(500).json({ message: smsResult.error || "Failed to send verification code" });
      }
      
      // Store the phone number temporarily in the user's 2FA record (not enabled yet)
      const existing = await storage.getTwoFactorAuth(userId);
      if (existing) {
        await storage.updateTwoFactorAuth(userId, {
          phoneNumber: formattedPhone,
          smsEnabled: false, // Not enabled until verified
        });
      } else {
        // Create a placeholder 2FA record with just the phone
        const { authenticator } = await import("otplib");
        await storage.createTwoFactorAuth({
          userId,
          secret: authenticator.generateSecret(), // Generate a secret in case they want TOTP later
          phoneNumber: formattedPhone,
          smsEnabled: false,
          isEnabled: false,
        });
      }
      
      res.json({ 
        message: "Verification code sent",
        phoneLastFour: formattedPhone.slice(-4)
      });
    } catch (error) {
      console.error("Error setting up SMS 2FA:", error);
      res.status(500).json({ message: "Failed to setup SMS 2FA" });
    }
  });

  // Verify SMS 2FA setup and enable
  app.post("/api/auth/2fa/sms/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ message: "Verification code is required" });
      }
      
      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor?.phoneNumber) {
        return res.status(400).json({ message: "Phone number not configured. Please start SMS setup first." });
      }
      
      // Verify the SMS code
      const isValid = verifySms2FACode(twoFactor.phoneNumber, userId, code);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }
      
      // Enable SMS 2FA
      await storage.updateTwoFactorAuth(userId, {
        smsEnabled: true,
        isEnabled: true,
        preferredMethod: 'sms',
      });
      
      res.json({ message: "SMS two-factor authentication enabled" });
    } catch (error) {
      console.error("Error verifying SMS 2FA:", error);
      res.status(500).json({ message: "Failed to verify SMS 2FA" });
    }
  });

  // Update preferred 2FA method
  app.post("/api/auth/2fa/preferred-method", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { method } = req.body;
      
      if (!method || !['totp', 'sms'].includes(method)) {
        return res.status(400).json({ message: "Invalid method. Must be 'totp' or 'sms'" });
      }
      
      const twoFactor = await storage.getTwoFactorAuth(userId);
      if (!twoFactor?.isEnabled) {
        return res.status(400).json({ message: "2FA is not enabled" });
      }
      
      // Check if the selected method is available
      if (method === 'sms' && !twoFactor.smsEnabled) {
        return res.status(400).json({ message: "SMS 2FA is not set up. Please add a phone number first." });
      }
      
      if (method === 'totp' && !twoFactor.secret) {
        return res.status(400).json({ message: "Authenticator app is not set up. Please set it up first." });
      }
      
      await storage.updateTwoFactorAuth(userId, { preferredMethod: method });
      
      res.json({ message: `Preferred 2FA method set to ${method === 'totp' ? 'authenticator app' : 'SMS'}` });
    } catch (error) {
      console.error("Error updating preferred method:", error);
      res.status(500).json({ message: "Failed to update preferred method" });
    }
  });

  // Test SMS endpoint - sends test message directly via Twilio
  app.post("/api/test-sms", isAuthenticated, async (req: any, res) => {
    try {
      const { getTwilioClient, getTwilioFromPhoneNumber } = await import("./twilioClient");
      const adminNumber = process.env.ADMIN_SMS_NUMBER;
      
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        adminNumberSet: !!adminNumber,
        twilioAccountSidSet: !!process.env.TWILIO_ACCOUNT_SID,
        twilioAuthTokenSet: !!process.env.TWILIO_AUTH_TOKEN,
        twilioPhoneNumberSet: !!process.env.TWILIO_PHONE_NUMBER,
      };
      
      if (!adminNumber) {
        return res.status(400).json({ 
          success: false, 
          error: "ADMIN_SMS_NUMBER not configured",
          diagnostics
        });
      }

      try {
        const client = await getTwilioClient();
        diagnostics.clientCreated = true;
        
        const fromNumber = await getTwilioFromPhoneNumber();
        diagnostics.fromNumber = fromNumber ? fromNumber.substring(0, 6) + "****" : "NOT SET";
        diagnostics.toNumber = adminNumber.substring(0, 6) + "****";
        
        const result = await client.messages.create({
          body: `Orderly AI Test SMS - ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`,
          from: fromNumber,
          to: adminNumber
        });
        
        res.json({
          success: true,
          messageSid: result.sid,
          status: result.status,
          diagnostics
        });
      } catch (twilioError: any) {
        diagnostics.clientCreated = false;
        res.status(500).json({ 
          success: false, 
          error: twilioError.message,
          code: twilioError.code,
          status: twilioError.status,
          moreInfo: twilioError.moreInfo,
          diagnostics
        });
      }
    } catch (error: any) {
      console.error("[Test SMS] Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Update user profile
  app.patch("/api/auth/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email, phoneNumber, restaurantName } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update user fields
      const updated = await storage.upsertUser({
        ...user,
        firstName: firstName !== undefined ? firstName : user.firstName,
        lastName: lastName !== undefined ? lastName : user.lastName,
        email: email !== undefined ? email : user.email,
        restaurantPhone: phoneNumber !== undefined ? phoneNumber : user.restaurantPhone,
        restaurantName: restaurantName !== undefined ? restaurantName : user.restaurantName,
      });
      
      // Return with phoneNumber alias for frontend compatibility
      res.json({
        ...updated,
        phoneNumber: updated.restaurantPhone,
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ==================== TWILIO WEBHOOK ====================

  // Twilio call status webhook - called when a call ends
  // This endpoint must be configured in Twilio's webhook settings
  app.post("/api/webhooks/twilio/call-status", async (req, res) => {
    try {
      // Validate Twilio webhook signature
      const twilioSig = req.headers['x-twilio-signature'] as string | undefined;
      const authToken = await getTwilioAuthToken();
      const isProduction = process.env.NODE_ENV === 'production';
      
      // In production, ALWAYS require signature validation
      if (isProduction) {
        if (!authToken) {
          console.error("CRITICAL: Twilio auth token not configured in production");
          return res.status(503).send('Service unavailable - Twilio not configured');
        }
        
        if (!twilioSig) {
          console.warn("Missing Twilio signature in production - rejecting webhook");
          return res.status(403).send('Forbidden - Missing signature');
        }
        
        const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const isValid = twilio.validateRequest(authToken, twilioSig, webhookUrl, req.body);
        
        if (!isValid) {
          console.warn("Invalid Twilio signature - rejecting webhook");
          return res.status(403).send('Forbidden - Invalid signature');
        }
      } else {
        // In development, validate signature if available but allow unsigned requests
        if (authToken && twilioSig) {
          const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
          const isValid = twilio.validateRequest(authToken, twilioSig, webhookUrl, req.body);
          
          if (!isValid) {
            console.warn("Invalid Twilio signature in dev - allowing for testing");
          }
        }
      }

      const {
        CallSid,
        CallStatus,
        CallDuration,
        From,
        To,
        Direction,
        AccountSid,
      } = req.body;

      console.log(`Twilio call webhook: ${CallSid} - Status: ${CallStatus}`);

      // Only process completed calls for billing
      if (CallStatus !== 'completed') {
        return res.status(200).send('OK');
      }

      const durationSeconds = parseInt(CallDuration || '0', 10);
      const durationMinutes = Math.ceil(durationSeconds / 60); // Round up to nearest minute

      // Find the phone number this call was made to/from to identify the user
      const phoneNumbers = await db.execute(sql`
        SELECT * FROM phone_numbers WHERE number = ${To} OR number = ${From}
      `);

      if (!phoneNumbers.rows || phoneNumbers.rows.length === 0) {
        console.log(`No matching phone number found for call ${CallSid}`);
        return res.status(200).send('OK');
      }

      const phoneNumber = phoneNumbers.rows[0] as any;
      const userId = phoneNumber.user_id;

      // Fetch agent to get aiModel + voiceProvider for accurate cost calculation
      let aiModel = 'gpt-4o-mini';
      let voiceProvider = 'cartesia';

      if (phoneNumber.agent_id) {
        try {
          const agent = await storage.getAgent(phoneNumber.agent_id);
          if (agent) {
            aiModel = agent.aiModel || aiModel;
            voiceProvider = agent.voiceProvider || voiceProvider;
          }
        } catch (agentErr) {
          console.warn('[Billing] Could not fetch agent for cost calc, using defaults');
        }
      }

      // Reuse the row the media stream may already have created for this call.
      const { callLog } = await upsertCallLogBySid(
        CallSid,
        {
          userId,
          phoneNumberId: phoneNumber.id,
          agentId: phoneNumber.agent_id,
          direction: Direction?.toLowerCase() || 'inbound',
          fromNumber: From,
          toNumber: To,
          status: CallStatus,
          billingStatus: 'pending',
        },
        {
          duration: durationSeconds.toString(),
          durationSeconds: durationSeconds.toString(),
          durationMinutes: durationMinutes.toString(),
        },
      );

      // No-op if the media-stream handler already charged this call.
      await billCallOnce({
        userId,
        agentId: phoneNumber.agent_id || null,
        callLogId: callLog.id,
        callSid: CallSid,
        durationSeconds,
        aiModel,
        voiceProvider,
      });

      res.status(200).send('OK');
    } catch (error: any) {
      console.error("Error processing Twilio webhook:", error);
      res.status(500).send('Error');
    }
  });

  // Validate Twilio webhook signature (optional middleware for security)
  async function validateTwilioSignature(req: any, res: any, next: any) {
    const twilioSig = req.headers['x-twilio-signature'];
    const authToken = await getTwilioAuthToken();
    
    if (!twilioSig || !authToken) {
      console.warn("Missing Twilio signature or auth token");
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).send('Forbidden');
      }
      return next(); // Continue without validation in dev
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const valid = twilio.validateRequest(authToken, twilioSig, url, req.body);
    
    if (!valid) {
      console.warn("Invalid Twilio signature");
      return res.status(403).send('Forbidden');
    }
    
    next();
  }

  // Retell post-call webhook — receives call_analyzed events with transcript and analytics
  app.post("/api/webhooks/retell", async (req: any, res) => {
    // Respond 200 immediately to avoid Retell retries
    res.status(200).send('OK');

    (async () => {
      try {
        const retellApiKey = process.env.RETELL_API_KEY;
        const isProduction = process.env.NODE_ENV === 'production';

        // Retell signature verification — fail-closed in all environments when API key is configured
        if (!retellApiKey) {
          if (isProduction) {
            console.error('[Retell webhook] RETELL_API_KEY not set in production — rejecting all requests');
            return;
          }
          console.warn('[Retell webhook] RETELL_API_KEY not set — skipping signature verification (dev only)');
        } else {
          const retellSig = req.headers['x-retell-signature'] as string | undefined;
          if (!retellSig) {
            console.warn('[Retell webhook] Missing X-Retell-Signature header — rejecting');
            return;
          }
          const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
          const expectedSigBuf = Buffer.from(
            crypto.createHmac('sha256', retellApiKey).update(rawBody).digest('base64')
          );
          const receivedSigBuf = Buffer.from(retellSig);
          // Use constant-time comparison to prevent timing attacks
          const isValid = expectedSigBuf.length === receivedSigBuf.length &&
            crypto.timingSafeEqual(expectedSigBuf, receivedSigBuf);
          if (!isValid) {
            console.warn('[Retell webhook] Invalid X-Retell-Signature — rejecting');
            return;
          }
        }

        const body = req.body;
        const eventType: string = body.event || body.event_type || '';

        // Only process call_analyzed events
        if (eventType !== 'call_analyzed') {
          console.log(`[Retell webhook] Ignoring event type: ${eventType}`);
          return;
        }

        const callData = body.data || body.call || body;
        const retellCallId: string | undefined = callData.call_id;
        const durationSeconds: number = parseInt(callData.call_duration_seconds ?? callData.duration_ms / 1000 ?? '0', 10) || 0;
        const transcript: string | undefined = callData.transcript;
        const callAnalysis = callData.call_analysis || {};
        const sentiment: string | undefined = callAnalysis.user_sentiment?.toLowerCase();
        const summary: string | undefined = callAnalysis.call_summary;

        console.log(`[Retell webhook] Processing call_analyzed for call ${retellCallId}`);

        // Find matching call log by retell call_id (stored as callSid) or the call_sid field in payload
        const payloadCallSid: string | undefined = callData.call_sid || callData.twilio_call_sid;
        let callLog = retellCallId ? await storage.getCallLogByCallSid(retellCallId) : null;
        if (!callLog && payloadCallSid && payloadCallSid !== retellCallId) {
          callLog = await storage.getCallLogByCallSid(payloadCallSid);
        }

        // Calls routed natively by Retell never pass through the Twilio webhook
        // or the media-stream handler, so no log exists yet. Without this the
        // event was dropped entirely — the call was never billed or recorded.
        if (!callLog && retellCallId) {
          const retellAgentId: string | undefined = callData.agent_id;
          const ownerAgent = retellAgentId
            ? await storage.getAgentByRetellAgentId(retellAgentId)
            : undefined;

          if (!ownerAgent) {
            console.warn(`[Retell webhook] No local agent for retell agent_id ${retellAgentId} — cannot attribute call ${retellCallId}`);
            return;
          }

          const direction = callData.direction === 'outbound' ? 'outbound' : 'inbound';
          callLog = await storage.createCallLog({
            userId: ownerAgent.userId,
            agentId: ownerAgent.id,
            callSid: retellCallId,
            direction,
            fromNumber: callData.from_number || null,
            toNumber: callData.to_number || null,
            status: 'completed',
            billingStatus: 'pending',
          } as any);
          console.log(`[Retell webhook] Created call log ${callLog.id} for Retell-routed call ${retellCallId}`);
        }

        if (callLog) {
          // Update call log with transcript and analytics
          const durationMinutes = Math.ceil(durationSeconds / 60);
          const updatePayload: any = {
            billingStatus: 'reported',
          };
          if (transcript) updatePayload.transcript = transcript;
          if (durationSeconds > 0) {
            updatePayload.durationSeconds = durationSeconds.toString();
            updatePayload.durationMinutes = durationMinutes.toString();
            updatePayload.duration = durationSeconds.toString();
          }
          if (sentiment) updatePayload.sentiment = sentiment;
          // callOutcome is an enum the logs page filters and badges on — a
          // free-text summary here silently breaks conversion analytics.
          if (summary) {
            updatePayload.metadata = { ...(callLog.metadata as any || {}), retellSummary: summary };
          }

          await storage.updateCallLog(callLog.id, updatePayload);
          console.log(`[Retell webhook] Updated call log ${callLog.id} with transcript and analytics`);

          // Charges only if this call has no ledger entry yet, so a webhook
          // retry (or a Twilio-side charge) cannot bill the caller twice.
          let aiModel: string | null | undefined;
          let voiceProvider: string | null | undefined;
          if (callLog.agentId) {
            try {
              const agent = await storage.getAgent(callLog.agentId);
              aiModel = agent?.aiModel;
              voiceProvider = agent?.voiceProvider;
            } catch {
              console.warn('[Retell billing] Could not fetch agent, using defaults');
            }
          }

          await billCallOnce({
            userId: callLog.userId,
            agentId: callLog.agentId || null,
            callLogId: callLog.id,
            callSid: retellCallId || callLog.callSid || callLog.id,
            durationSeconds,
            aiModel,
            voiceProvider: voiceProvider || 'elevenlabs',
          });
        } else {
          console.warn(`[Retell webhook] No call log found for retell call_id: ${retellCallId}`);
        }
      } catch (err: any) {
        console.error('[Retell webhook] Processing error:', err.message);
      }
    })();
  });

  // Twilio Voice Webhook - handles incoming calls and routes to AI agent
  app.post("/api/voice/incoming", async (req, res) => {
    try {
      const { To, From, CallSid } = req.body;
      console.log(`[Voice] Incoming call from ${From} to ${To}, CallSid: ${CallSid}`);

      // Find the phone number and its assigned agent
      const phoneNumber = await storage.getPhoneNumberByNumber(To);
      if (!phoneNumber || !phoneNumber.agentId) {
        console.log(`[Voice] No agent assigned to ${To}, rejecting call`);
        res.type('text/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, this number is not configured to receive calls. Please try again later.</Say>
  <Hangup />
</Response>`);
        return;
      }

      // Credit gate: check if the account owner has sufficient balance before routing
      const creditStatus = await getUserCreditStatus(phoneNumber.userId);
      if (creditStatus && creditStatus.isTrial && creditStatus.balanceCents <= 0 && !creditStatus.hasPaymentMethod) {
        console.warn(`[Voice] Blocking call to ${To} — trial user ${phoneNumber.userId} has no credit and no payment method`);

        // Fire alert email (throttled to once per hour per user, non-blocking)
        const lastAlertAt = creditAlertThrottle.get(phoneNumber.userId) ?? 0;
        if (Date.now() - lastAlertAt > CREDIT_ALERT_THROTTLE_MS) {
          // Normalize APP_BASE_URL — strip any protocol prefix so we always control the scheme
          const rawBase =
            process.env.REPLIT_DOMAINS?.split(',').find(d => !d.includes('replit.dev')) ||
            process.env.APP_BASE_URL ||
            'app.getorderly.io';
          const canonicalHost = rawBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
          const billingUrl = `https://${canonicalHost}/billing`;
          // Set throttle only after we confirm the owner has an email (avoids silently burning 1h quota on lookup failures)
          storage.getUser(phoneNumber.userId).then(owner => {
            if (owner?.email) {
              creditAlertThrottle.set(phoneNumber.userId, Date.now());
              sendCreditExhaustedAlert(owner.email, From || 'Unknown caller', billingUrl).catch(err => {
                console.error('[Voice] Failed to send credit alert email:', err);
              });
            }
          }).catch(() => {});
        }

        res.type('text/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, this service is temporarily unavailable. Please contact the restaurant directly.</Say>
  <Hangup />
</Response>`);
        return;
      }

      // Get the base URL for WebSocket connection
      const baseUrl = `https://${req.get('host')}`;
      const twiml = generateTwiML(phoneNumber.agentId, phoneNumber.id, baseUrl);

      console.log(`[Voice] Routing call to agent ${phoneNumber.agentId}`);
      res.type('text/xml');
      res.send(twiml);
    } catch (error) {
      console.error("[Voice] Error handling incoming call:", error);
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, an error occurred. Please try again later.</Say>
  <Hangup />
</Response>`);
    }
  });

  // Get active calls for monitoring
  app.get("/api/voice/calls/active", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const activeCalls = getActiveCalls();
      
      // Filter to only show calls for this user's agents
      const userCalls = Array.from(activeCalls.values())
        .filter(call => call.userId === userId)
        .map(call => ({
          callSid: call.callSid,
          agentId: call.agent.id,
          agentName: call.agent.name,
          fromNumber: call.fromNumber,
          toNumber: call.toNumber,
          startTime: call.callStartTime,
          duration: Math.floor((Date.now() - call.callStartTime) / 1000),
        }));

      res.json(userCalls);
    } catch (error) {
      console.error("Error fetching active calls:", error);
      res.status(500).json({ message: "Failed to fetch active calls" });
    }
  });

  const httpServer = createServer(app);

  // Set up WebSocket servers in noServer mode for manual upgrade handling
  const wss = new WebSocketServer({ noServer: true });
  const testWss = new WebSocketServer({ noServer: true });
  
  wss.on('connection', (ws, req) => {
    console.log('[Voice] WebSocket connection established');
    handleTwilioWebSocket(ws, req);
  });

  wss.on('error', (error) => {
    console.error('[Voice] WebSocket server error:', error);
  });

  testWss.on('connection', (ws, req: any) => {
    console.log('[TestCall] WebSocket connection established');

    // agentId comes from the URL, but the user identity comes from the session
    // resolved during the upgrade — a client must not assert its own userId.
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const agentId = url.searchParams.get('agentId');
    const userId: string | undefined = req.authenticatedUserId;

    if (!agentId) {
      console.error('[TestCall] Missing agentId');
      ws.send(JSON.stringify({ type: 'error', message: 'Missing agentId' }));
      ws.close();
      return;
    }

    if (!userId) {
      console.error('[TestCall] Unauthenticated test-call connection rejected');
      ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
      ws.close();
      return;
    }

    handleBrowserTestWebSocket(ws, agentId, userId);
  });

  testWss.on('error', (error) => {
    console.error('[TestCall] WebSocket server error:', error);
  });

  // Handle upgrade requests manually to ensure our WebSocket paths are handled
  // before Vite's HMR WebSocket can intercept them
  httpServer.on('upgrade', (request: any, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

    if (pathname === '/voice-stream') {
      // Authenticated by the signed token in the Twilio `start` frame — a
      // session cookie is not available on a carrier-originated socket.
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname === '/test-call') {
      getUserIdFromUpgradeRequest(request).then((userId) => {
        if (!userId) {
          console.warn('[TestCall] Rejecting unauthenticated upgrade');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        request.authenticatedUserId = userId;
        testWss.handleUpgrade(request, socket, head, (ws) => {
          testWss.emit('connection', ws, request);
        });
      }).catch((err) => {
        console.error('[TestCall] Upgrade authentication failed:', err);
        socket.destroy();
      });
    }
    // For other paths (like Vite HMR), let them fall through to other handlers
  });

  console.log('[Voice] WebSocket server initialized on /voice-stream');
  console.log('[TestCall] WebSocket server initialized on /test-call');

  // PATCH /api/user/pre-call-intake — save pre-call intake form data
  const preCallIntakeSchema = z.object({
    businessHours: z.string().max(500),
    timezone: z.string().max(100),
    cuisineDescription: z.string().max(300),
    menuCategories: z.array(z.string().max(80)).max(8),
    popularItems: z.array(z.string().max(100)).max(10),
    priceRange: z.string().max(20),
    faqs: z.array(z.object({
      question: z.string().max(200),
      answer: z.string().max(500),
    })).max(5),
    policies: z.string().max(1000),
  });

  app.patch("/api/user/pre-call-intake", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const parsed = preCallIntakeSchema.safeParse(req.body?.preCallIntake);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid intake data", errors: parsed.error.flatten() });
      }
      const preCallIntake = parsed.data;
      const [updated] = await db.update(users)
        .set({ preCallIntake })
        .where(eq(users.id, userId))
        .returning();
      res.json(updated);
    } catch (error) {
      console.error("Error saving pre-call intake:", error);
      res.status(500).json({ message: "Failed to save intake data" });
    }
  });

  // PATCH /api/user/tour — mark guided tour as completed
  app.patch("/api/user/tour", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await db.update(users).set({ tourCompleted: true } as any).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to update tour status" });
    }
  });

  // ---- Support Chat Routes ----

  // POST /api/support/messages — user sends a message
  app.post("/api/support/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Message content required" });

      const [msg] = await db.insert(supportMessages).values({
        userId,
        content: content.trim(),
        senderRole: 'user',
        read: false,
      }).returning();
      res.json(msg);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // GET /api/support/messages — user fetches their own thread
  app.get("/api/support/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const messages = await db.select().from(supportMessages)
        .where(eq(supportMessages.userId, userId))
        .orderBy(supportMessages.createdAt);

      // Mark admin messages as read
      await db.update(supportMessages)
        .set({ read: true })
        .where(and(eq(supportMessages.userId, userId), eq(supportMessages.senderRole, 'admin')));

      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // GET /api/support/unread-count — user checks for unread admin replies
  app.get("/api/support/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const unread = await db.select().from(supportMessages)
        .where(and(eq(supportMessages.userId, userId), eq(supportMessages.senderRole, 'admin'), eq(supportMessages.read, false)));
      res.json({ count: unread.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // GET /api/admin/support — admin lists all conversations with last message
  app.get("/api/admin/support", isAdmin, async (req: any, res) => {
    try {
      // Get all users who have sent support messages
      const allMessages = await db.select().from(supportMessages).orderBy(desc(supportMessages.createdAt));

      // Group by userId
      const threadMap = new Map<string, { userId: string; lastMessage: any; unreadCount: number }>();
      for (const msg of allMessages) {
        if (!threadMap.has(msg.userId)) {
          threadMap.set(msg.userId, { userId: msg.userId, lastMessage: msg, unreadCount: 0 });
        }
        if (msg.senderRole === 'user' && !msg.read) {
          threadMap.get(msg.userId)!.unreadCount++;
        }
      }

      // Enrich with user info
      const threads = [];
      // @ts-ignore
      for (const thread of threadMap.values()) {
        const [user] = await db.select({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName, restaurantName: users.restaurantName, profileImageUrl: users.profileImageUrl }).from(users).where(eq(users.id, thread.userId));
        if (user) threads.push({ ...thread, user });
      }

      // Sort by last message date desc
      threads.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());

      res.json(threads);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch support threads" });
    }
  });

  // GET /api/admin/support/:userId — admin reads full thread for a user
  app.get("/api/admin/support/:userId", isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ message: "User not found" });

      const messages = await db.select().from(supportMessages)
        .where(eq(supportMessages.userId, userId))
        .orderBy(supportMessages.createdAt);

      // Get account stats
      const ledgerRows = await db.select().from(usageLedger).where(eq(usageLedger.userId, userId));
      const totalCostCents = ledgerRows.reduce((acc, r) => acc + parseInt(r.costCents || '0'), 0);
      const totalMinutes = ledgerRows.reduce((acc, r) => acc + parseFloat(r.minutesUsed || '0'), 0);

      const userAgents = await db.select({ id: agents.id }).from(agents).where(eq(agents.userId, userId));
      const callRows = await db.select({ id: callLogs.id }).from(callLogs).where(eq(callLogs.userId, userId));

      res.json({
        user: toPublicUser(user),
        messages,
        stats: { totalCalls: callRows.length, totalMinutes: Math.round(totalMinutes * 100) / 100, totalCostCents, agentsCount: userAgents.length },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch thread" });
    }
  });

  // POST /api/admin/support/:userId/reply — admin replies to a user
  app.post("/api/admin/support/:userId/reply", isAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Reply content required" });

      const [msg] = await db.insert(supportMessages).values({
        userId,
        content: content.trim(),
        senderRole: 'admin',
        read: false,
      }).returning();

      // Mark user messages in this thread as read (admin has seen them)
      await db.update(supportMessages)
        .set({ read: true })
        .where(and(eq(supportMessages.userId, userId), eq(supportMessages.senderRole, 'user')));

      res.json(msg);
    } catch (error) {
      res.status(500).json({ message: "Failed to send reply" });
    }
  });


  // ============================================
  // MISSION CONTROL INTEGRATION ENDPOINTS
  // ============================================
  
  // Get dashboard metrics for Mission Control
  app.get("/api/metrics/dashboard", async (req: any, res) => {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Active agents count
      const activeAgentsResult = await db
        .select({ count: count() })
        .from(agents)
        .where(eq(agents.status, 'active'));

      // Total users
      const totalUsersResult = await db
        .select({ count: count() })
        .from(users);

      // New signups (last 24h)
      const newSignupsResult = await db
        .select({ count: count() })
        .from(users)
        .where(sql`${users.createdAt} >= ${yesterday}`);

      // Calls in last 24h
      const callsTodayResult = await db
        .select({ count: count() })
        .from(callLogs)
        .where(sql`${callLogs.createdAt} >= ${yesterday}`);

      // Call success rate (last 24h)
      const successfulCallsResult = await db
        .select({ count: count() })
        .from(callLogs)
        .where(sql`${callLogs.createdAt} >= ${yesterday} AND ${callLogs.status} = 'completed'`);

      const totalCallsToday = callsTodayResult[0]?.count || 0;
      const successfulCalls = successfulCallsResult[0]?.count || 0;
      const successRate = totalCallsToday > 0 
        ? Math.round((successfulCalls / totalCallsToday) * 100) 
        : 0;

      res.json({
        timestamp: now.toISOString(),
        summary: {
          activeAgents: activeAgentsResult[0]?.count || 0,
          totalUsers: totalUsersResult[0]?.count || 0,
          newSignupsToday: newSignupsResult[0]?.count || 0,
          callsToday: totalCallsToday,
          callSuccessRate: successRate,
        },
        systemHealth: {
          status: 'healthy',
          lastChecked: now.toISOString(),
        },
      });
    } catch (error) {
      console.error('[Metrics] Dashboard error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch metrics',
        systemHealth: { status: 'degraded', lastChecked: new Date().toISOString() }
      });
    }
  });

  // Subagent activity log endpoint
  app.get("/api/subagent-activity", async (req: any, res) => {
    res.json({
      activities: [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          agent: 'orderly-ops',
          type: 'health-check',
          title: 'System health check passed',
          status: 'success',
          business: 'orderly-ai',
        },
      ],
    });
  });
  // ── Agent ↔ KB Collection assignments ───────────────────────────────────────

  // GET /api/agents/:id/kb-collections — list attached collection IDs for an agent
  app.get("/api/agents/:id/kb-collections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id: agentId } = req.params;
      const agent = await storage.getAgent(agentId);
      if (!agent || agent.userId !== userId) return res.status(404).json({ message: "Not found" });

      const rows = await db
        .select({ collectionId: agentKbCollections.collectionId })
        .from(agentKbCollections)
        .where(eq(agentKbCollections.agentId, agentId));

      res.json(rows.map(r => r.collectionId));
    } catch (error: any) {
      console.error("Error fetching agent KB collections:", error);
      res.status(500).json({ message: "Failed to fetch agent KB collections" });
    }
  });

  // POST /api/agents/:id/kb-collections/:collectionId — attach a collection to an agent
  app.post("/api/agents/:id/kb-collections/:collectionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id: agentId, collectionId } = req.params;

      const agent = await storage.getAgent(agentId);
      if (!agent || agent.userId !== userId) return res.status(404).json({ message: "Agent not found" });

      const [col] = await db
        .select()
        .from(kbCollections)
        .where(and(eq(kbCollections.id, collectionId), eq(kbCollections.userId, userId)));
      if (!col) return res.status(404).json({ message: "Collection not found" });

      await db
        .insert(agentKbCollections)
        .values({ agentId, collectionId })
        .onConflictDoNothing();

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error attaching KB collection to agent:", error);
      res.status(500).json({ message: "Failed to attach KB collection" });
    }
  });

  // DELETE /api/agents/:id/kb-collections/:collectionId — detach a collection from an agent
  app.delete("/api/agents/:id/kb-collections/:collectionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id: agentId, collectionId } = req.params;

      const agent = await storage.getAgent(agentId);
      if (!agent || agent.userId !== userId) return res.status(404).json({ message: "Agent not found" });

      await db
        .delete(agentKbCollections)
        .where(and(eq(agentKbCollections.agentId, agentId), eq(agentKbCollections.collectionId, collectionId)));

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error detaching KB collection from agent:", error);
      res.status(500).json({ message: "Failed to detach KB collection" });
    }
  });

  // ── KB Collections ──────────────────────────────────────────────────────────

  // GET /api/kb — list user's collections with source count
  app.get("/api/kb", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const collections = await db
        .select({
          id: kbCollections.id,
          userId: kbCollections.userId,
          name: kbCollections.name,
          createdAt: kbCollections.createdAt,
        })
        .from(kbCollections)
        .where(eq(kbCollections.userId, userId))
        .orderBy(kbCollections.createdAt);

      const collectionsWithCount = await Promise.all(
        collections.map(async (col) => {
          const [{ cnt }] = await db
            .select({ cnt: count() })
            .from(kbSources)
            .where(eq(kbSources.collectionId, col.id));
          return { ...col, sourceCount: Number(cnt) };
        })
      );

      res.json(collectionsWithCount);
    } catch (error: any) {
      console.error("Error fetching KB collections:", error);
      res.status(500).json({ message: "Failed to fetch KB collections" });
    }
  });

  // POST /api/kb — create a new collection
  app.post("/api/kb", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name is required" });
      }
      const [col] = await db
        .insert(kbCollections)
        .values({ userId, name: name.trim() })
        .returning();
      res.json(col);
    } catch (error: any) {
      console.error("Error creating KB collection:", error);
      res.status(500).json({ message: "Failed to create KB collection" });
    }
  });

  // PATCH /api/kb/:id — rename a collection
  app.patch("/api/kb/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name is required" });
      }
      const [existing] = await db
        .select()
        .from(kbCollections)
        .where(and(eq(kbCollections.id, id), eq(kbCollections.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Not found" });

      const [col] = await db
        .update(kbCollections)
        .set({ name: name.trim() })
        .where(eq(kbCollections.id, id))
        .returning();
      res.json(col);
    } catch (error: any) {
      console.error("Error renaming KB collection:", error);
      res.status(500).json({ message: "Failed to rename KB collection" });
    }
  });

  // DELETE /api/kb/:id — delete collection (cascades sources)
  app.delete("/api/kb/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [existing] = await db
        .select()
        .from(kbCollections)
        .where(and(eq(kbCollections.id, id), eq(kbCollections.userId, userId)));
      if (!existing) return res.status(404).json({ message: "Not found" });

      await db.delete(kbCollections).where(eq(kbCollections.id, id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting KB collection:", error);
      res.status(500).json({ message: "Failed to delete KB collection" });
    }
  });

  // ── KB Sources ───────────────────────────────────────────────────────────────

  // GET /api/kb/:id/sources — list sources in a collection
  app.get("/api/kb/:id/sources", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const [col] = await db
        .select()
        .from(kbCollections)
        .where(and(eq(kbCollections.id, id), eq(kbCollections.userId, userId)));
      if (!col) return res.status(404).json({ message: "Not found" });

      const sources = await db
        .select()
        .from(kbSources)
        .where(eq(kbSources.collectionId, id))
        .orderBy(kbSources.createdAt);
      res.json(sources);
    } catch (error: any) {
      console.error("Error fetching KB sources:", error);
      res.status(500).json({ message: "Failed to fetch KB sources" });
    }
  });

  // POST /api/kb/:id/sources — add a source (url / pdf / text)
  const kbUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
  app.post(
    "/api/kb/:id/sources",
    isAuthenticated,
    kbUpload.single("file"),
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;
        const [col] = await db
          .select()
          .from(kbCollections)
          .where(and(eq(kbCollections.id, id), eq(kbCollections.userId, userId)));
        if (!col) return res.status(404).json({ message: "Not found" });

        const type = req.body.type;

        if (type === "url") {
          const { url } = req.body;
          if (!url) return res.status(400).json({ message: "url is required" });

          // SSRF protection: only allow http/https to public hosts
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(url);
          } catch {
            return res.status(400).json({ message: "Invalid URL" });
          }
          if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            return res.status(400).json({ message: "Only http and https URLs are allowed" });
          }
          // Block localhost and private/internal IP ranges
          const hostname = parsedUrl.hostname.toLowerCase();
          const blockedPatterns = [
            /^localhost$/,
            /^127\./,
            /^10\./,
            /^172\.(1[6-9]|2\d|3[01])\./,
            /^192\.168\./,
            /^169\.254\./,
            /^::1$/,
            /^0\.0\.0\.0$/,
            /^fc00:/,
            /^fe80:/,
            /metadata\.google\.internal/,
            /169\.254\.169\.254/,
          ];
          if (blockedPatterns.some((p) => p.test(hostname))) {
            return res.status(400).json({ message: "URLs pointing to internal or private addresses are not allowed" });
          }

          let name = url;
          let content: string | null = null;
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(url, {
              signal: controller.signal,
              headers: { "User-Agent": "Mozilla/5.0" },
              redirect: "follow",
            });
            clearTimeout(timeout);
            // Limit response size to 5MB
            const MAX_BYTES = 5 * 1024 * 1024;
            const contentLength = Number(resp.headers.get("content-length") || 0);
            if (contentLength > MAX_BYTES) throw new Error("Response too large");
            const html = await resp.text();
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (titleMatch) {
              name = titleMatch[1].trim();
            } else {
              const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
              if (h1Match) name = h1Match[1].trim();
            }
            const stripped = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            content = stripped.slice(0, 10000);
          } catch {
            // fallback: name = url, content = null
          }

          const [src] = await db
            .insert(kbSources)
            .values({ collectionId: id, type: "url", name, url, content })
            .returning();
          scheduleKbSync(userId);
          return res.json(src);
        }

        if (type === "pdf") {
          const file = req.file;
          if (!file) return res.status(400).json({ message: "file is required" });
          const fileName = file.originalname;
          const fileSizeBytes = file.size;
          const content = file.buffer.slice(0, 100000).toString("utf-8");

          const [src] = await db
            .insert(kbSources)
            .values({ collectionId: id, type: "pdf", name: fileName, fileName, fileSizeBytes, content })
            .returning();
          scheduleKbSync(userId);
          return res.json(src);
        }

        if (type === "text") {
          const { name, content } = req.body;
          if (!name || !content) return res.status(400).json({ message: "name and content are required" });

          const [src] = await db
            .insert(kbSources)
            .values({ collectionId: id, type: "text", name, content })
            .returning();
          scheduleKbSync(userId);
          return res.json(src);
        }

        return res.status(400).json({ message: "Invalid type. Must be url, pdf, or text." });
      } catch (error: any) {
        console.error("Error adding KB source:", error);
        res.status(500).json({ message: "Failed to add KB source" });
      }
    }
  );

  // DELETE /api/kb/:id/sources/:sourceId — delete a source
  app.delete("/api/kb/:id/sources/:sourceId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id, sourceId } = req.params;
      const [col] = await db
        .select()
        .from(kbCollections)
        .where(and(eq(kbCollections.id, id), eq(kbCollections.userId, userId)));
      if (!col) return res.status(404).json({ message: "Not found" });

      await db.delete(kbSources).where(and(eq(kbSources.id, sourceId), eq(kbSources.collectionId, id)));
      scheduleKbSync(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting KB source:", error);
      res.status(500).json({ message: "Failed to delete KB source" });
    }
  });

  return httpServer;
}
