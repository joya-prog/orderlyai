import crypto from "crypto";

/**
 * Twilio's Media Streams socket cannot carry a session cookie, so the stream
 * parameters are the only identity it presents. Signing them here means the
 * /voice-stream handler will only bill an agent that this server itself
 * selected in /api/voice/incoming — an unsigned or edited agentId is rejected
 * rather than charged to whoever owns it.
 */

const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // a call may legitimately run for hours

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) {
    throw new Error("SESSION_SECRET must be set to sign voice stream tokens");
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createStreamToken(agentId: string, phoneNumberId: string | null): string {
  const payload = `${agentId}.${phoneNumberId || ""}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export interface StreamTokenClaims {
  agentId: string;
  phoneNumberId: string | null;
}

/** Returns the claims if the token is authentic and unexpired, otherwise null. */
export function verifyStreamToken(token: string | undefined | null): StreamTokenClaims | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const encodedPayload = token.slice(0, separator);
  const providedSignature = token.slice(separator + 1);

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString();
  } catch {
    return null;
  }

  const expected = sign(payload);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(providedSignature);
  if (expectedBuf.length !== providedBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) return null;

  const [agentId, phoneNumberId, issuedAt] = payload.split(".");
  if (!agentId || !issuedAt) return null;

  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age) || age < 0 || age > TOKEN_TTL_MS) return null;

  return { agentId, phoneNumberId: phoneNumberId || null };
}
