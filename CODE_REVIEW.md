# Orderly AI — Code Review (August 2, 2026)

Full review of security, backend correctness, and frontend/UX. Findings verified against actual code paths.

---

## P0 — Fix before anything else

### Money is leaking in both directions

**1. Retell-routed calls are never billed or logged**
`server/routes.ts:4658-4770`
Call logs are only created by the Twilio paths (`routes.ts:4497`, `voiceCallHandler.ts:685`). Once a number is assigned to an agent it's linked into Retell's native inbound routing (`routes.ts:2231`), so those calls arrive with a Retell call ID matching no log — the handler logs `"No call log found"` and drops everything. No charge, no transcript, no analytics.
*Fix:* create the call log inside the webhook when no row matches, keyed by Retell `call_id`.

**2. Twilio-routed calls can bill twice**
`server/voiceCallHandler.ts:668-735` + `server/routes.ts:4406-4569`
The WebSocket `stop` handler and the Twilio status webhook each independently write a call log, a ledger row, and a Stripe balance debit for the same CallSid. No dedupe; no unique constraint on `call_logs.call_sid`.
*Fix:* one billing owner per call + unique constraint on `callSid`.

**3. No webhook idempotency**
`server/routes.ts:4457-4569`
The Stripe meter identifier embeds `eventTimestamp` (`call_${CallSid}_${eventTimestamp}`), so it changes on every retry and defeats Stripe's deduplication. `createBalanceTransaction` has no idempotency key anywhere. `auth.ts:60`'s 3-attempt retry can double-grant the $10 trial credit.

**4. Any user can self-upgrade to enterprise for free**
`server/routes.ts:3191-3267`
`PUT /api/subscription` takes `planType` from the request body, validates it against a name whitelist only, and applies full plan limits with zero Stripe interaction.

### Cross-tenant compromise

**5. Billing theft via agent assignment**
`server/routes.ts:2224-2233`
`PATCH /api/phone-numbers/:id` verifies the *phone number* belongs to the caller but never that the supplied `agentId` does (`storage.getAgent` is unscoped). Billing follows `agent.userId`.
*Attack:* buy a $1 number, point it at a victim's agent, call in a loop. Victim pays; attacker talks to the victim's agent and can extract their knowledge base by asking.

**6. Unauthenticated voice WebSocket**
`server/routes.ts:4914-4927`, `server/voiceCallHandler.ts:534-638`
The upgrade handler performs no origin/session/Twilio check, and trusts `customParameters.agentId` verbatim. On `stop` it debits `agent.userId` for attacker-controlled wall-clock duration.
*Attack:* anyone with any agent UUID opens the socket, holds it an hour, sends `stop` — victim billed for 60 minutes.

**7. Password hashes returned to the browser**
`server/routes.ts:241-249`, `server/auth.ts:892-900`
`storage.getUser` does `select().from(users)` — every column — and routes `res.json(user)` it unfiltered. Every session receives its own bcrypt hash; support/billing roles receive everyone's.
*Fix:* a `toPublicUser()` projection applied at every boundary.

---

## P1 — High

| # | Issue | Location |
|---|---|---|
| 8 | 2FA disables without password — `if (user.passwordHash && password)` skips verification when `password` is omitted | `routes.ts:4158-4184` |
| 9 | No CSRF protection anywhere, with `SameSite=None` cookies in production | `auth.ts:239-244` |
| 10 | Cross-tenant flow-node writes — bulk endpoints insert client-supplied `agentId` unvalidated | `routes.ts:1768-1851` |
| 11 | Square/Toast OAuth access + refresh tokens returned to the browser | `routes.ts:2350-2359` |
| 12 | Unverified email change + hardcoded super-admin auto-elevation = admin escalation path | `routes.ts:4371-4400` → `auth.ts:386` |
| 13 | Stripe webhook fails open when `NODE_ENV !== 'production'` — forged `setup_intent.succeeded` activates accounts | `app.ts:158-176` |
| 14 | Business hours frozen at save time — prompt bakes in "Status: OPEN"; agent saved at noon tells 2 AM callers you're open | `retell.ts:79-122` |
| 15 | Overnight schedules (22:00–02:00) mis-evaluated after midnight | `retell.ts:62-76` |
| 16 | Workflow executor infinite recursion — no depth guard, one GPT call per hop | `workflowExecutor.ts:218-236` |
| 17 | 2FA TOTP secret sent to third-party QR service (`api.qrserver.com`) | `settings.tsx:1162` |
| 18 | `accountStatus: 'suspended'` never enforced by any middleware | `auth.ts:1065-1077` |
| 19 | Prompt edits write to the wrong Retell field — old prompt stays live, greeting updates silently dropped | `retell.ts:305-329` |

---

## P2 — Medium

**Backend:** SSRF via redirect in KB fetch (`routes.ts:5417`); SMS 2FA codes from `Math.random()` (`twilioClient.ts:117`); `support`/`billing` roles get destructive admin powers (`auth.ts:1072`); unauthenticated multer upload with no size limit (`routes.ts:13`); password reset link host from `Host` header (`auth.ts:962`); unauthenticated platform metrics (`routes.ts:5123`); managed Stripe webhook registered at a path with no handler — returns 200 with HTML, events silently dropped (`app.ts:51-58`); webhook rate-limit paths don't match real routes, so telephony webhooks fall under the 100-req/15min IP limiter (`rateLimit.ts:50`); `PATCH /api/agents/:id` passes raw `req.body` to the DB (`routes.ts:736`); free-text summary written into the `callOutcome` enum field, breaking conversion analytics (`routes.ts:4678`).

**Frontend:** No route-based code splitting — ReactFlow, Recharts, driver.js, Retell SDK all in the initial bundle (`App.tsx:18-37`); `staleTime: Infinity` + `refetchOnWindowFocus: false` globally, so dashboards never refresh (`queryClient.ts:50`); KB collection delete has no confirmation dialog (`knowledge-base.tsx:352`); missing error states on all data-heavy pages; tables lack `overflow-x-auto` on mobile (`contacts.tsx`, `phone-numbers.tsx`); fake hardcoded sparkline presented as real usage data (`app-sidebar.tsx:84-101`).

---

## P3 — Cleanup

Two parallel flow-builder implementations (~1,200 duplicated, already-diverged lines) between `agent-editor.tsx` and `flow-builder.tsx`. Dead `server/replitAuth.ts`. Legacy OpenAI/Whisper voice pipeline running parallel to Retell (`openai.ts` hardcodes model `"gpt-5"` regardless of agent config). Root-level one-off scripts (`fix-stripe-webhook.ts` uses a nonexistent Stripe param and 400s). ~200 screenshots in `attached_assets/`. Money and durations stored as `text` throughout, forcing `CAST` in every aggregate. ~55 `any` usages. Duplicated media-query hooks. No tests, no CI.

---

## Verified clean

- **No SQL injection** — Drizzle used correctly throughout; the one raw `db.execute` uses tagged templates.
- **Stripe, Twilio, and Retell webhooks are signature-verified** (Stripe's business-logic route only in production — see #13).
- **Square/Toast OAuth CSRF** correctly implemented: 32-byte server-side nonce, staleness check, userId from DB not callback.
- **bcrypt** cost 12, compared correctly; backup codes hashed and consumed on use.
- **Admin impersonation** correctly gated by `isSuperAdmin`, writes an audit record.
- Tenant scoping is correct on mainstream CRUD (agents, contacts, KB, phone numbers, integrations, call logs, API keys).

---

## Frontend verdict: targeted refactor, not a rebuild

The bones are good — consistent shadcn/Radix base, a real design-token system, TanStack Query wired properly, onboarding tour, empty states, test IDs throughout. The problems are concentrated and mechanical, not architectural.

**Largest files:** `agent-editor.tsx` 2,860 · `settings.tsx` 1,563 · `auth.tsx` 1,058 · `analytics.tsx` 953 · `knowledge-base.tsx` 808

### Two product decisions needed

**A. Brand direction.** `replit.md` specifies warm hospitality — cream/parchment, forest green, golden yellow, pill buttons, 24px corners. `design_guidelines.md` specifies cobalt-blue clinical SaaS. The code implements the latter (`index.css:29` `--primary: 217 91% 60%`, 9px radii). The whole value prop is "not a sterile tech dashboard," but the app is a sterile tech dashboard. Because the token system exists, retheming is mostly `index.css` + `tailwind.config.ts` plus ~30 hardcoded `blue-*`/`slate-*` literals.

**B. Four routed pages are unreachable.** `/contacts`, `/integrations`, `/test-center`, `/workflows` are registered in `App.tsx` but appear in no sidebar and are linked from nowhere. POS Integrations is a headline selling point for restaurants and is currently invisible. Kill or surface?

### Highest-impact UX work
1. Resolve the orphan routes (above).
2. Ship the intended theme, and fix the fake sidebar graph in the same pass.
3. Lazy-load routes and set a sane cache policy — the login page loads fast and morning analytics are actually current.
