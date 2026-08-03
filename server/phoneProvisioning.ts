import * as retell from "./retell";
import { storage } from "./storage";

/**
 * Connects a Twilio number to Retell so inbound calls actually reach an agent.
 *
 * Previously nothing wired this up: purchased numbers were created with no
 * voiceUrl and were never imported into Retell, so assigning an agent updated
 * only our own database while calls went nowhere.
 *
 * Retell reaches Twilio over an Elastic SIP Trunk. The trunk is ACCOUNT-level
 * and configured once in the Twilio console — not per number:
 *
 *   1. Elastic SIP Trunking -> create a trunk.
 *   2. Termination: set a SIP URI (e.g. orderly.pstn.twilio.com). Put that
 *      value in RETELL_TERMINATION_URI.
 *   3. Origination: add ORIGINATION URI  sip:sip.retellai.com
 *   4. Authentication: either whitelist Retell's SBC CIDR 18.98.16.120/30,
 *      or create credentials and set RETELL_SIP_USERNAME / RETELL_SIP_PASSWORD.
 *   5. Put the trunk SID in TWILIO_TRUNK_SID.
 *
 * Numbers are then moved onto that trunk and imported into Retell here.
 */

export interface ProvisionResult {
  ok: boolean;
  retellPhoneNumberId?: string;
  /** Operator-facing explanation when routing could not be established. */
  warning?: string;
}

function missingConfig(): string | null {
  if (!process.env.RETELL_TERMINATION_URI) {
    return "RETELL_TERMINATION_URI is not set, so numbers cannot be connected to the voice provider. Configure the Twilio SIP trunk and set this secret.";
  }
  if (!process.env.TWILIO_TRUNK_SID) {
    return "TWILIO_TRUNK_SID is not set, so numbers cannot be attached to the SIP trunk that routes calls to the voice provider.";
  }
  return null;
}

/** Moves a purchased Twilio number onto the Retell SIP trunk. Idempotent. */
async function attachNumberToTrunk(
  twilioClient: any,
  phoneNumberSid: string,
): Promise<void> {
  const trunkSid = process.env.TWILIO_TRUNK_SID!;
  try {
    await twilioClient.trunking.v1
      .trunks(trunkSid)
      .phoneNumbers.create({ phoneNumberSid });
  } catch (err: any) {
    // 21705 = number already assigned to this trunk; anything else is real.
    if (err?.code === 21705) return;
    throw err;
  }
}

/**
 * Ensures a number is on the trunk and imported into Retell, optionally bound
 * to an inbound agent. Safe to call repeatedly.
 */
export async function provisionNumberForRetell(
  twilioClient: any,
  opts: {
    phoneNumberRecordId: string;
    userId: string;
    number: string;
    providerSid: string | null;
    inboundAgentId?: string;
  },
): Promise<ProvisionResult> {
  if (!(await retell.isRetellConfigured())) {
    return { ok: false, warning: "Voice provider is not configured, so inbound calls will not reach this number." };
  }

  const configProblem = missingConfig();
  if (configProblem) {
    return { ok: false, warning: configProblem };
  }

  if (!twilioClient) {
    return { ok: false, warning: "Twilio is not configured, so this number cannot be connected." };
  }

  try {
    if (opts.providerSid) {
      await attachNumberToTrunk(twilioClient, opts.providerSid);
    }

    const imported = await retell.importRetellPhoneNumber(
      opts.number,
      process.env.RETELL_TERMINATION_URI!,
      opts.inboundAgentId,
    );

    if (!imported) {
      return { ok: false, warning: "Could not register this number with the voice provider. Inbound calls will not reach an agent yet." };
    }

    await storage.updatePhoneNumber(opts.phoneNumberRecordId, opts.userId, {
      retellPhoneNumberId: imported.phoneNumber,
    } as any);

    return { ok: true, retellPhoneNumberId: imported.phoneNumber };
  } catch (err: any) {
    // Retell rejects an import for a number it already knows; treat as success
    // so re-assigning an agent doesn't surface a spurious failure.
    const message: string = err?.message || String(err);
    if (/already exist|already imported|duplicate/i.test(message)) {
      return { ok: true, retellPhoneNumberId: opts.number };
    }
    console.error("[Provisioning] Failed to connect number to Retell:", message);
    return { ok: false, warning: `Could not connect this number to the voice provider: ${message}` };
  }
}
