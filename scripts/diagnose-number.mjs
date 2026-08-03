#!/usr/bin/env node
/**
 * Reports why an inbound call to a Twilio number does or doesn't reach Retell.
 *
 * Usage (run where TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are set):
 *   node scripts/diagnose-number.mjs +18338585336
 *
 * Read-only: lists configuration, changes nothing.
 */
import twilio from "twilio";

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/diagnose-number.mjs +1XXXXXXXXXX");
  process.exit(1);
}

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
if (!sid || !token) {
  console.error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not set in this shell.");
  process.exit(1);
}

const client = twilio(sid, token);
const digits = (s) => (s || "").replace(/\D/g, "");

const numbers = await client.incomingPhoneNumbers.list({ limit: 200 });
const number = numbers.find((n) => digits(n.phoneNumber) === digits(target));

if (!number) {
  console.log(`NOT FOUND: ${target} is not an incoming number on this Twilio account.`);
  console.log("If the number was bought through Retell instead, no Twilio trunk is involved.");
  process.exit(0);
}

console.log(`Number:       ${number.phoneNumber}  (${number.sid})`);
console.log(`voiceUrl:     ${number.voiceUrl || "(none)"}`);
console.log(`voiceAppSid:  ${number.voiceApplicationSid || "(none)"}`);
console.log(`trunkSid:     ${number.trunkSid || "(none)"}`);

const trunks = await client.trunking.v1.trunks.list({ limit: 50 });
console.log(`\nTrunks on account: ${trunks.length}`);
for (const t of trunks) {
  const origs = await t.originationUrls().list();
  const onTrunk = await t.phoneNumbers().list({ limit: 200 });
  const has = onTrunk.some((n) => digits(n.phoneNumber) === digits(target));
  console.log(`\n  ${t.friendlyName}  (${t.sid})`);
  console.log(`    termination:  ${t.domainName || "(none)"}`);
  console.log(`    origination:  ${origs.map((o) => o.sipUrl).join(", ") || "(none)"}`);
  console.log(`    numbers:      ${onTrunk.length}`);
  console.log(`    >> ${target} on this trunk? ${has ? "YES" : "no"}`);
}

console.log("\n--- verdict ---");
if (number.trunkSid) {
  console.log("Number IS attached to a trunk. If calls still fail, the break is");
  console.log("between the trunk and Retell (origination URI or Retell-side import).");
} else if (number.voiceUrl) {
  console.log("Number is NOT on a trunk; it points at a webhook instead:");
  console.log(`  ${number.voiceUrl}`);
  console.log("Inbound calls go there, not to Retell.");
} else {
  console.log("Number has NO trunk and NO voiceUrl — Twilio has no route for it.");
  console.log("Inbound calls are dropped before Retell is ever involved.");
  console.log("Fix: Console > Elastic SIP Trunking > Retell > Numbers > add this number.");
}
