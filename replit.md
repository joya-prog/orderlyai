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

- **Billing**: Manages subscriptions, usage tracking, and invoice history via Stripe.
- **Phone Numbers**: Allows searching, purchasing, assigning, and releasing Twilio numbers.
- **Contacts Management**: Provides full CRUD operations, search, filter, and tagging for customer contacts.
- **POS Integrations**: Supports OAuth 2.0 flows for Square and Toast POS, including server-side proxy endpoints for accessing live menu data, customer management, order creation, and payment processing.
- **Analytics Dashboard**: Offers real-time tracking of calls, orders, and reservations with interactive cards, detailed charts (Recharts), and date range filtering.
- **Workflow Builder**: A visual, Retell AI-style conversation flow builder with a node library, ReactFlow canvas, and node inspector for defining agent behavior. It supports drag-and-drop node placement and visual transitions.
- **Test Center**: Integrated testing for agents with text and real-time voice modes using the Retell Web SDK, displaying live transcripts and agent states.
- **Workflow Executor**: A state machine-based system that uses GPT-4o-mini for evaluating conversation flow transitions during agent execution and testing.

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