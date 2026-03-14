# Orderly AI Platform

## Overview

Orderly AI is a voice AI agent platform for restaurants and hospitality businesses, enabling them to build, customize, and deploy intelligent phone agents for reservations, orders, and customer inquiries. It includes a web-based dashboard for agent management, knowledge base configuration, and conversation testing. The platform aims to revolutionize customer interaction in hospitality through AI-driven voice agents.

## User Preferences

Preferred communication style: Simple, everyday language.

Design Aesthetic: Warm, hospitality-focused design for restaurant operators
- "Modern AI meets upscale restaurant UI"
- Soft cream/parchment backgrounds, forest green primary, golden yellow accents
- Pill-shaped buttons, very rounded cards (24px corners), soft warm shadows
- Premium but comfortable, not sterile tech dashboard
- Authentic Orderly AI logo displayed in sidebar and landing page (AVIF format, 40px square)

## System Architecture

### Frontend

The frontend uses React 18+ with TypeScript, Vite, and Tailwind CSS. It leverages shadcn/ui (New York style) based on Radix UI, adhering to Material Design 3 principles for a professional hospitality aesthetic. State management is handled by TanStack Query for server state, React Hook Form with Zod for form state, and React Context for UI themes. Wouter manages client-side routing. The layout features a fixed left sidebar and a responsive main content area.

### Backend

The backend is built with Node.js and Express.js (TypeScript, ES modules), featuring a RESTful API with authentication middleware and PostgreSQL storage for sessions. Authentication supports native email/password with bcrypt hashing and Google OAuth via Passport.js. A comprehensive 2FA system offers TOTP (Authenticator App) and SMS options.

### Data Storage

PostgreSQL (Neon serverless) is the primary database, managed with Drizzle ORM. The schema includes tables for users, sessions, AI agents, visual flow builder data, knowledge bases, templates, test conversations, contacts, Twilio phone numbers, POS integration configurations (Square, Toast), and analytics events. Drizzle Kit is used for migrations.

### Core Features

- **Signup Notifications**: Sends SMS alerts via Twilio when new users register (both email/password and Google OAuth signups).
- **Billing**: Pure usage-based pricing (no monthly subscription fee). Rates vary by chosen AI model and voice provider. Usage tracking and invoice history managed via Stripe. Pricing constants live in `shared/pricing.ts` — model base rates + voice provider surcharges combine into a per-minute cost.
- **Trial Credit System**: Every new signup gets a $10 trial credit automatically provisioned as a Stripe customer balance transaction (-1000 cents). After each call, the exact cost (based on the agent's AI model + voice provider from `shared/pricing.ts`) is deducted from the Stripe customer balance via a positive balance transaction. All calls are logged to `usage_ledger` with `aiModel`, `voiceProvider`, `costCents`, and `minutesUsed`. When credit reaches $0, users must add a payment method. The billing page shows real-time credit balance fetched from Stripe, a progress bar, low-credit/exhausted alerts, and a per-call usage breakdown table.
- **Phone Numbers**: Allows searching, purchasing, assigning, and releasing Twilio numbers.
- **Contacts Management**: Provides full CRUD operations, search, filter, and tagging for customer contacts.
- **POS Integrations**: Supports OAuth 2.0 flows for Square and Toast POS, including server-side proxy endpoints for accessing live menu data, customer management, order creation, and payment processing.
- **Analytics Dashboard**: Offers real-time tracking of calls, orders, and reservations with interactive cards, detailed charts (Recharts), and date range filtering.
- **Workflow Builder**: A visual, Retell AI-style conversation flow builder with a node library, ReactFlow canvas, and node inspector for defining agent behavior. It supports drag-and-drop node placement and visual transitions.
- **Test Center**: Integrated testing for agents with text and real-time voice modes using the Retell Web SDK, displaying live transcripts and agent states.
- **Workflow Executor**: A state machine-based system that uses GPT-4o-mini for evaluating conversation flow transitions during agent execution and testing.
- **Hours of Operation**: Configurable business hours per agent with weekly schedule (per-day open/close toggles and time ranges), timezone selection, and after-hours mode (24/7, messages only, orders only, or custom instructions). Hours data is stored as JSONB (`business_hours`), with `after_hours_mode` and `after_hours_message` columns on the agents table. A `getBusinessHoursPromptBlock()` helper in `server/retell.ts` injects real-time open/closed status into the Retell AI prompt at sync time. Supports overnight schedules (e.g., 22:00–02:00).

### Admin Control Center

- **Role-Based Access Control**: Users have a `role` field ('user', 'admin', 'support', 'billing') and `accountStatus` ('trial', 'active', 'suspended'). Only `admin` role users see the Admin sidebar section.
- **Restaurant Management Panel** (`/admin/restaurants`): Full table of all restaurants with stats, search, status filters, and per-row action menus (view, edit, suspend/activate, login-as, delete). CSV export available.
- **Restaurant Detail Page** (`/admin/restaurants/:id`): Edit restaurant info, toggle account status, impersonate (login-as), and delete account with danger zone.
- **Admin Impersonation**: Super admin can log in as any restaurant user. A sticky amber banner shows "Viewing as [name] — Admin mode" with a "Return to Admin" button while impersonating.
- **Admin Audit Logs**: Every destructive/edit admin action (edit, suspend, delete, impersonate) is logged to `admin_audit_logs` table with admin user, action, target, and IP.
- **Admin Middleware**: `isAdmin` and `isSuperAdmin` Express middleware in `server/auth.ts` protect all `/api/admin/*` routes. Super admin account: hello@getorderly.io. When this email signs in via Google OAuth, admin role and active status are automatically assigned.
- **Admin Usage Stats**: `GET /api/admin/restaurants/:id/stats` returns per-user `totalCalls`, `totalMinutes`, `totalCostCents`, `avgCostPerMinuteCents` aggregated from `usage_ledger` and `call_logs`. The restaurant detail page shows a "Usage & Billing" card with these 4 stats.
- **Admin Support Inbox**: Admin can view and reply to user help messages at `/admin/support`. Full thread view with user account context (calls, minutes, spend). Routes: `GET/POST /api/admin/support`, `GET/POST /api/admin/support/:userId/reply`.
- **Delete Fix**: `DELETE /api/admin/restaurants/:id` now checks both direct admin role and `req.session.originalAdminId` (to allow deletion while impersonating another user).

### User Features
- **Onboarding Tour**: Driver.js powered 7-step guided tour that auto-starts on first login (after onboarding completed but before `tourCompleted=true`). Can be re-triggered via the map icon in the sidebar footer. Completion calls `PATCH /api/user/tour` to set `users.tour_completed=true`.
- **Help Chat**: Users can send messages to admin from the sidebar LifeBuoy button. Admin replies appear in the chat. Unread badge shows when admin has replied. Routes: `GET/POST /api/support/messages`, `GET /api/support/unread-count`.

### Retell AI White-Label Integration

Orderly AI integrates Retell AI as a white-label voice engine for its core voice AI infrastructure. It operates in a multi-tenant setup, syncing agent, LLM, and voice configurations bidirectionally. Call routing occurs directly through Retell for optimal latency. The platform supports various voice providers (ElevenLabs, OpenAI TTS, Cartesia, Deepgram, PlayHT) and LLMs (GPT-4o, GPT-4o Mini, Claude 3.5 Sonnet, Claude 3 Haiku). Agent configurations, including voice, speech, backchannel, ambient sound, and call management settings, are synced to Retell.

## External Dependencies

- **Authentication Service**: Replit OIDC provider (for development).
- **AI Service**: OpenAI API (GPT, Whisper, TTS).
- **Voice AI Engine**: Retell AI.
- **Telephony Service**: Twilio API.
- **Database Service**: Neon Serverless PostgreSQL.
- **Payment Processing**: Stripe.
- **POS Systems**: Square API, Toast POS API.
- **Development Tools**: Replit-specific plugins, Google Fonts CDN.