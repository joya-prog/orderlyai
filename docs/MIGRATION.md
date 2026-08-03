# Moving off Replit

Runbook for relocating Orderly AI to self-managed hosting. Written to be
followed top to bottom, with the risky, hard-to-reverse steps last.

Nothing here affects Retell. Agents, conversation flows, and phone numbers live
in Retell's account and don't care where this server runs. The only Retell-side
change is one webhook URL, in step 6.

---

## What is actually tied to Replit

Less than it looks:

| Thing | Status |
|---|---|
| **Replit Auth** (`server/replitAuth.ts`) | **Dead code** — nothing imports it. Login is `server/auth.ts` (own sessions, Google OAuth, SMS 2FA). Deleted in this PR. |
| **Twilio credentials** | Already falls back to `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`. No change needed. |
| **Stripe credentials** | Checks `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` **first**. No change needed. |
| **Postgres** | Real work — see step 2. |
| **Secrets store** | Re-enter on the new host. `.env.example` lists all 41. |
| **Hosting + domain** | Steps 3 and 7. |

The connector code paths are left in place on purpose: they're still what
production uses until cutover. Remove them afterwards (step 8).

---

## 1. Create the accounts

- **Railway** — app hosting. Long-running Express with WebSockets, so Vercel's
  serverless model is the wrong shape. Render or Fly.io substitute cleanly.
- **Neon** — Postgres. Replit's Postgres is Neon underneath, which makes the
  dump/restore boring.

## 2. Move the database

```bash
export SOURCE_DATABASE_URL="<Replit DATABASE_URL>"
export TARGET_DATABASE_URL="<Neon connection string>"
./scripts/migrate-db.sh
```

Reads the source only, never writes to it. Prints a row-count comparison per
table and exits non-zero on any mismatch. **A mismatch means stop** — do not
continue to step 3.

Keep the `.dump` file. Keep Replit's database running until the new host has
been live for a week.

## 3. Deploy the app

Point Railway at `joya-prog/orderlyai`, branch `main`. `railway.json` already
sets build (`npm run build`), start (`npm start`), and the health check
(`/api/health`).

Set every variable from `.env.example`, with two changes:

- `DATABASE_URL` → the Neon string from step 2
- `APP_BASE_URL` → Railway's temporary URL for now (real domain in step 7)

Don't skip `RETELL_TERMINATION_URI`, `TWILIO_TRUNK_SID`, and
`RETELL_ORIGINATION_URI` — without them, buying a number silently skips
provisioning and inbound calls never reach an agent.

## 4. Verify on the temporary URL

Before any external system points here:

- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Log in — confirms sessions and `DATABASE_URL`
- [ ] Agents, phone numbers, and call logs all show existing data
- [ ] Open an agent, save it, confirm no error (exercises the Retell sync)
- [ ] Startup logs print the right `[Retell webhook URL]`

## 5. Point external systems at the new URL

**Every one of these holds the old URL.** Each fails differently, and several
fail silently.

| System | Where | Set to | If missed |
|---|---|---|---|
| **Retell** | Dashboard → webhook | `<base>/api/webhooks/retell` | **Calls stop being logged and billed** |
| **Twilio** | Console → status callback | `<base>/api/webhooks/twilio/call-status` | Call records incomplete |
| **Stripe** | Dashboard → Webhooks | `<base>/api/webhooks/stripe` — then update `STRIPE_WEBHOOK_SECRET` | Subscription changes ignored |
| **Square** | Developer Dashboard → OAuth | `SQUARE_OAUTH_REDIRECT_URI` | Merchants can't connect |
| **Toast** | Developer portal → OAuth | `TOAST_OAUTH_REDIRECT_URI` | Same |
| **Google** | Cloud Console → Credentials | `GOOGLE_OAUTH_CALLBACK_URL` | Google login breaks |

Retell is the expensive one: billing runs off that webhook, so a missed update
means calls happen and nobody is charged.

## 6. Run both in parallel

Leave Replit running. Both point at the same Neon database, so either can serve
while DNS propagates. Watch the new host's logs through a few real calls before
continuing.

## 7. Move DNS

Point `orderlyai.studio` at Railway. Set `APP_BASE_URL` to the real domain and
redeploy. Re-check the step 5 table — anything using the temporary URL needs
updating to the real one.

## 8. Decommission

Only after a **week** of clean operation:

- [ ] Archive the `.dump` somewhere off this machine
- [ ] Remove the Replit Connectors fallbacks in `server/twilioClient.ts` and
      `server/stripeClient.ts` (dead once `TWILIO_*` / `STRIPE_*` are set)
- [ ] Drop `REPLIT_*` / `REPL_*` from `.env.example`
- [ ] Pause the Replit deployment — don't delete it yet
- [ ] Delete Replit's database last, and only with the dump verified

---

## Rollback

Before DNS (step 7): point the external systems in step 5 back at Replit. It's
still running and still shares the database.

After DNS: revert the DNS record. Propagation is the slow part, which is why
step 6 exists — DNS is the last thing to move and the only step with real lag.
