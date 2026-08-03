import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { ensureTemplatesSeeded } from './seed';
import { applyRateLimits } from "./rateLimit";
import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import { storage } from "./storage";
import { usageLedger, users } from "@shared/schema";
import crypto from "crypto";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    log('DATABASE_URL not set, skipping Stripe initialization', 'stripe');
    return;
  }

  try {
    log('Initializing Stripe schema...', 'stripe');
    await runMigrations({ databaseUrl });
    log('Stripe schema ready', 'stripe');

    const stripeSync = await getStripeSync();

    log('Setting up managed webhook...', 'stripe');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      {
        enabled_events: ['*'],
        description: 'Managed webhook for Orderly AI billing',
      }
    );
    log(`Webhook configured: ${webhook.url} (UUID: ${uuid})`, 'stripe');

    stripeSync.syncBackfill()
      .then(() => {
        log('Stripe data synced', 'stripe');
      })
      .catch((err: any) => {
        log(`Error syncing Stripe data: ${err.message}`, 'stripe');
      });
  } catch (error: any) {
    log(`Failed to initialize Stripe: ${error.message}`, 'stripe');
  }
}

initStripe();

async function initKbSchema() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kb_collections (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS kb_sources (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id varchar NOT NULL REFERENCES kb_collections(id) ON DELETE CASCADE,
        type text NOT NULL,
        name text NOT NULL,
        content text,
        url text,
        file_name text,
        file_size_bytes integer,
        created_at timestamp DEFAULT now()
      )
    `);
  } catch (error: any) {
    log(`KB schema init error: ${error.message}`, 'kb');
  }
}

initKbSchema();

app.post(
  '/api/stripe/webhook/:uuid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        log('STRIPE WEBHOOK ERROR: req.body is not a Buffer', 'stripe');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      const { uuid } = req.params;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);

      res.status(200).json({ received: true });
    } catch (error: any) {
      log(`Webhook error: ${error.message}`, 'stripe');
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Stripe business-logic webhook — must be before express.json() for raw body
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    res.status(200).json({ received: true });

    (async () => {
      try {
        const signature = req.headers['stripe-signature'];
        if (!signature || !Buffer.isBuffer(req.body)) {
          log('[Stripe webhook] Missing signature or non-buffer body — ignoring', 'stripe');
          return;
        }

        const sig = Array.isArray(signature) ? signature[0] : signature;
        const rawBody = req.body as Buffer;
        const correlationId = crypto.randomUUID();

        // Primary verification: route through WebhookHandlers (stripe-replit-sync)
        try {
          await WebhookHandlers.processWebhook(rawBody, sig, correlationId);
        } catch (syncErr: any) {
          // processWebhook may fail if correlationId doesn't match a managed config;
          // fall back to STRIPE_WEBHOOK_SECRET for standalone verification
          const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
          const isProduction = process.env.NODE_ENV === 'production';

          if (webhookSecret) {
            try {
              const stripe = await getUncachableStripeClient();
              stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
            } catch (verifyErr: any) {
              log(`[Stripe webhook] Signature verification failed: ${verifyErr.message}`, 'stripe');
              return;
            }
          } else if (isProduction) {
            log('[Stripe webhook] STRIPE_WEBHOOK_SECRET not set in production — rejecting unsigned payload', 'stripe');
            return;
          } else {
            log('[Stripe webhook] STRIPE_WEBHOOK_SECRET not set in dev — proceeding without verification', 'stripe');
          }
        }

        let event: any;
        try {
          event = JSON.parse(rawBody.toString());
        } catch (parseErr: any) {
          log(`[Stripe webhook] Failed to parse event JSON: ${parseErr.message}`, 'stripe');
          return;
        }

        const eventType: string = event.type;
        log(`[Stripe webhook] Processing event: ${eventType} (correlationId: ${correlationId})`, 'stripe');

        if (eventType === 'invoice.payment_failed') {
          const invoice = event.data.object;
          const customerId: string | undefined = invoice.customer;
          if (customerId) {
            const subscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            if (subscription) {
              await storage.updateSubscription(subscription.userId, { status: 'past_due' });
              // Also mark user account status so the app can gate access
              await db.update(users)
                .set({ accountStatus: 'suspended', updatedAt: new Date() })
                .where(eq(users.id, subscription.userId));
              log(`[Stripe webhook] Marked past_due + suspended account for customer ${customerId}`, 'stripe');
            }
          }
        } else if (eventType === 'customer.subscription.deleted') {
          const sub = event.data.object;
          const stripeSubId: string = sub.id;
          const existing = await storage.getSubscriptionByStripeId(stripeSubId);
          if (existing) {
            await storage.updateSubscription(existing.userId, {
              status: 'canceled',
              stripeSubscriptionId: null,
              cancelAtPeriodEnd: false,
            });
            log(`[Stripe webhook] Marked subscription canceled for sub ${stripeSubId}`, 'stripe');
          }
        } else if (eventType === 'setup_intent.succeeded') {
          const setupIntent = event.data.object;
          const customerId: string | undefined = setupIntent.customer;
          if (customerId) {
            const subscription = await storage.getSubscriptionByStripeCustomerId(customerId);
            // Activate if subscription is pending, trialing, or on the trial plan (setup_intent completion signals payment method attached)
            if (subscription && (subscription.status === 'pending' || subscription.status === 'trialing' || subscription.planType === 'trial')) {
              await storage.updateSubscription(subscription.userId, { status: 'active' });
              await db.update(users)
                .set({ accountStatus: 'active', updatedAt: new Date() })
                .where(eq(users.id, subscription.userId));
              log(`[Stripe webhook] Activated subscription for customer ${customerId}`, 'stripe');
            }
          }
        }
      } catch (err: any) {
        log(`[Stripe webhook] Processing error: ${err.message}`, 'stripe');
      }
    })();
  }
);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
applyRateLimits(app);
// CORS middleware for Mission Control integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://mission-control-3lbuw6lp0-rob-s-projects-e70d4ae8.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  ensureTemplatesSeeded().catch(console.error);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // Printed so the exact URL to paste into Retell is never guessed. Prefer
    // APP_BASE_URL so this stays correct once the app is off Replit.
    const base = process.env.APP_BASE_URL
      || (process.env.REPLIT_DOMAINS?.split(',')[0] && `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`)
      || `http://localhost:${port}`;
    log(`serving on ${base}`);
    log(`[Retell webhook URL] ${base}/api/webhooks/retell`, 'retell');
  });
}
