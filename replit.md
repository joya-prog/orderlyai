# Orderly AI Platform

## Overview

Orderly AI is a voice AI agent platform designed for restaurants and hospitality businesses. It enables users to build, customize, and deploy intelligent phone agents for reservations, orders, and customer inquiries. The platform includes a web-based dashboard for managing AI agents, configuring their behavior via knowledge bases, and testing conversations.

## User Preferences

Preferred communication style: Simple, everyday language.

**Design Aesthetic:** Warm, hospitality-focused design for restaurant operators
- "Modern AI meets upscale restaurant UI"
- Soft cream/parchment backgrounds, forest green primary, golden yellow accents
- Pill-shaped buttons, very rounded cards (24px corners), soft warm shadows
- Premium but comfortable, not sterile tech dashboard
- Authentic Orderly AI logo displayed in sidebar and landing page (AVIF format, 40px square)

## System Architecture

### Frontend

- **Framework**: React 18+ with TypeScript, using Vite.
- **UI Component System**: shadcn/ui (New York style) built on Radix UI, following Material Design 3 principles.
- **Styling**: Tailwind CSS with custom CSS variables for design tokens, focusing on a professional hospitality aesthetic. Custom typography includes Inter (UI) and Space Grotesk (headings). Supports light/dark themes.
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form state, and React Context for theme/sidebar.
- **Routing**: Wouter for client-side routing.
- **Layout**: Fixed left sidebar (280px) and a main content area with responsive design.

### Backend

- **Runtime**: Node.js with Express.js (TypeScript, ES modules).
- **API Design**: RESTful API with authentication middleware, organized routes, and an abstraction layer for database operations.
- **Session Management**: Express sessions with PostgreSQL storage.
- **Authentication**: OpenID Connect (OIDC) via Replit Auth using Passport.js.

### Data Storage

- **Database**: PostgreSQL (Neon serverless).
- **ORM**: Drizzle ORM with type-safe schemas.
- **Schema**:
    - `users`: User accounts.
    - `sessions`: Express session storage.
    - `agents`: AI agent configurations with a status workflow.
    - `flowNodes`, `flowConnections`: Visual flow builder data.
    - `knowledgeBase`: Q&A pairs for agent training.
    - `templates`: Pre-built agent templates.
    - `testConversations`: Conversation history for agent testing.
    - `contacts`: CRM contacts with tags and notes.
    - `phoneNumbers`: Twilio phone numbers with agent assignments.
    - `integrationConfigs`: POS integration OAuth tokens (Square, Toast).
    - `analyticsEvents`: Event tracking for calls, orders, reservations.
- **Migrations**: Drizzle Kit.

### Core Features

- **Plan & Billing**: Settings page with pricing calculator, subscription management, usage tracking, invoice history, and Stripe billing portal integration.
- **Phone Numbers Management**: Search, purchase, assign, and release Twilio phone numbers.
- **Contacts Management**: Full CRUD, search, filter, and tag operations for contacts.
- **POS Integrations**: OAuth 2.0 flows for Square and Toast POS, with automatic token refresh.
- **Analytics Dashboard**: Real-time tracking for calls, orders, reservations, with KPI cards and Recharts visualizations.
- **Workflow Builder**: Integrated into the agent editor with drag-and-drop interface for creating agent flows.
- **Test Center**: Integrated into the agent editor with text and voice testing modes (using OpenAI GPT-5, Whisper, TTS) for conversational agents.
- **Integrations Page**: Displays available and upcoming integrations (Square, Toast, Twilio, Resy, Tock, Yelp).

### Billing Infrastructure

- **Stripe Integration**: Uses `stripe-replit-sync` for automatic webhook management and schema sync.
- **Twilio Webhooks**: Secure call status tracking with X-Twilio-Signature validation (mandatory in production).
- **Metered Billing**: Call minutes automatically reported to Stripe metered billing after call completion.
- **Database Tables**:
    - `callLogs`: Individual call records with duration tracking and billing status.
    - `usageLedger`: Aggregated usage records per billing period.
    - `invoices`: Synced invoice data from Stripe.
- **Security**: 
    - Twilio webhook signature validation (hard-fail in production).
    - Plan type whitelist validation for checkout sessions.
    - Tenant-scoped storage queries for billing data isolation.

## External Dependencies

- **Authentication Service**: Replit OIDC provider.
- **AI Service**: OpenAI API (GPT-5, Whisper, TTS) for conversational responses, speech-to-text, and text-to-speech.
- **Telephony Service**: Twilio API for phone number management and call routing.
- **Database Service**: Neon Serverless PostgreSQL.
- **Development Tools**: Replit-specific plugins (cartographer, dev banner, runtime error overlay).
- **Fonts**: Google Fonts CDN (Inter, Space Grotesk, Fira Code).
- **Environment Variables**: `DATABASE_URL`, `OPENAI_API_KEY`, `SESSION_SECRET`, `REPL_ID`, `ISSUER_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `SQUARE_CLIENT_ID`, `SQUARE_CLIENT_SECRET`, `SQUARE_OAUTH_REDIRECT_URI`, `TOAST_CLIENT_ID`, `TOAST_CLIENT_SECRET`, `TOAST_OAUTH_REDIRECT_URI`.