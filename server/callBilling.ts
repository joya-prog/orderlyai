import { db } from "./db";
import { eq } from "drizzle-orm";
import { usageLedger } from "@shared/schema";
import { storage } from "./storage";
import { getUncachableStripeClient } from "./stripeClient";
import { calculateCallCostCents } from "../shared/pricing";

export const ORDERLY_METER_EVENT_NAME = "orderly_call_minutes";

/**
 * A completed call can be reported by more than one source: the Twilio
 * media-stream socket, the Twilio call-status webhook, and the Retell
 * call_analyzed webhook — and any of them may be retried. Each used to bill
 * independently, so the same call could be charged several times.
 *
 * This is the single entry point for charging a call. It is keyed on the
 * call SID: the first caller creates the ledger entry and charges Stripe,
 * and every later caller for the same SID is a no-op.
 */

/**
 * Returns the existing call log for a SID, or creates one. Prevents the media
 * stream and the status webhook from each inserting a row for the same call.
 * Fields already set are never overwritten with empty values.
 */
export async function upsertCallLogBySid(
  callSid: string,
  create: Record<string, any>,
  enrich: Record<string, any> = {},
) {
  const existing = await storage.getCallLogByCallSid(callSid);

  if (existing) {
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(enrich)) {
      const current = (existing as any)[key];
      if (value !== undefined && value !== null && value !== "" && !current) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      await storage.updateCallLog(existing.id, updates as any);
    }
    return { callLog: existing, created: false };
  }

  const callLog = await storage.createCallLog({ ...create, ...enrich, callSid } as any);
  return { callLog, created: true };
}

export interface CallBillingInput {
  userId: string;
  agentId: string | null;
  callLogId: string;
  callSid: string;
  durationSeconds: number;
  aiModel: string | null | undefined;
  voiceProvider: string | null | undefined;
}

export interface CallBillingResult {
  billed: boolean;
  costCents: number;
  reason?: string;
}

export async function billCallOnce(input: CallBillingInput): Promise<CallBillingResult> {
  const { userId, agentId, callLogId, callSid, durationSeconds } = input;
  const aiModel = input.aiModel || "gpt-4o-mini";
  const voiceProvider = input.voiceProvider || "cartesia";

  if (durationSeconds <= 0) {
    return { billed: false, costCents: 0, reason: "zero-duration" };
  }

  // Ledger row is the record of "this call has been charged".
  const existing = await db
    .select()
    .from(usageLedger)
    .where(eq(usageLedger.callLogId, callLogId))
    .limit(1);

  if (existing.length > 0) {
    return { billed: false, costCents: 0, reason: "already-billed" };
  }

  const costCents = calculateCallCostCents(durationSeconds, aiModel, voiceProvider);
  const minutesUsed = (durationSeconds / 60).toFixed(2);

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  await storage.createUsageLedgerEntry({
    userId,
    agentId: agentId || null,
    callLogId,
    periodStart,
    periodEnd,
    minutesUsed,
    aiModel,
    voiceProvider,
    costCents: costCents.toString(),
  } as any);

  if (costCents <= 0) {
    return { billed: false, costCents: 0, reason: "zero-cost" };
  }

  try {
    const subscription = await storage.getSubscription(userId);
    const stripe = await getUncachableStripeClient();

    if (!stripe || !subscription?.stripeCustomerId) {
      return { billed: false, costCents, reason: "no-stripe-customer" };
    }

    if (subscription.stripeSubscriptionId) {
      // Metered subscription. The identifier must be stable across retries or
      // Stripe's own deduplication cannot catch a repeat submission.
      await stripe.billing.meterEvents.create({
        event_name: ORDERLY_METER_EVENT_NAME,
        payload: {
          stripe_customer_id: subscription.stripeCustomerId,
          value: costCents.toString(),
        },
        identifier: `call_${callSid}`,
      });
    } else {
      // Trial credit: a positive balance transaction draws the credit down.
      await stripe.customers.createBalanceTransaction(
        subscription.stripeCustomerId,
        {
          amount: costCents,
          currency: "usd",
          description: `Call ${minutesUsed}min (${aiModel} + ${voiceProvider})`,
        },
        { idempotencyKey: `call_charge_${callSid}` },
      );
    }

    await storage.updateCallLog(callLogId, { billingStatus: "billed" } as any);
    return { billed: true, costCents };
  } catch (err: any) {
    console.error(`[Billing] Failed to charge call ${callSid}:`, err?.message || err);
    // Ledger row stands so usage is still visible and we never double-charge
    // on a retry; the call log stays 'pending' for reconciliation.
    return { billed: false, costCents, reason: "stripe-error" };
  }
}
