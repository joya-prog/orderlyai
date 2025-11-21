# Orderly AI Platform

## Overview

Orderly AI is a voice AI agent platform designed for restaurants and hospitality businesses. The application enables users to build, customize, and deploy intelligent phone agents that handle reservations, orders, and customer inquiries. The platform provides a web-based dashboard for managing AI agents, configuring their behavior through knowledge bases, and testing conversations before deployment.

## User Preferences

Preferred communication style: Simple, everyday language.

**Design Aesthetic:** Warm, hospitality-focused design for restaurant operators
- "Modern AI meets upscale restaurant UI"
- Soft cream/parchment backgrounds, forest green primary, golden yellow accents
- Pill-shaped buttons, very rounded cards (24px corners), soft warm shadows
- Premium but comfortable, not sterile tech dashboard

## System Architecture

### Frontend Architecture

**Framework**: React 18+ with TypeScript, using Vite as the build tool and development server.

**UI Component System**: The application uses shadcn/ui (New York style) built on Radix UI primitives. This provides a comprehensive set of accessible, customizable components following Material Design 3 principles adapted for SaaS dashboards.

**Styling Approach**: 
- Tailwind CSS with custom design tokens defined in CSS variables
- Design system emphasizes clarity over decoration with professional hospitality aesthetics
- Custom typography using Inter (UI elements) and Space Grotesk (headings)
- Spacing system based on Tailwind units (2, 4, 6, 8, 12, 16, 24)
- Theme support (light/dark) with CSS custom properties

**State Management**: 
- TanStack Query (React Query) for server state management
- React Hook Form with Zod validation for form state
- React Context for theme and sidebar state

**Routing**: Wouter for client-side routing (lightweight alternative to React Router)

**Layout Structure**: 
- Fixed left sidebar (280px width) for main navigation
- Main content area with max-width containers
- Responsive design with mobile breakpoints

### Backend Architecture

**Runtime**: Node.js with Express.js framework

**Language**: TypeScript with ES modules

**Development vs Production**:
- Development: Uses Vite middleware for HMR and hot reloading
- Production: Serves pre-built static assets from dist/public

**API Design**: RESTful API with the following patterns:
- Authentication middleware protecting all `/api` routes
- Route handlers organized in `server/routes.ts`
- Storage abstraction layer (`server/storage.ts`) for database operations
- Separate development and production entry points

**Session Management**: Express sessions with PostgreSQL storage using connect-pg-simple

**Authentication**: OpenID Connect (OIDC) integration with Replit Auth using Passport.js strategy

### Data Storage

**Database**: PostgreSQL (via Neon serverless)

**ORM**: Drizzle ORM with type-safe schema definitions

**Schema Structure**:
- `users` - User accounts from Replit Auth
- `sessions` - Express session storage
- `agents` - AI agent configurations with status workflow (draft → testing → active → paused)
- `flowNodes` and `flowConnections` - Visual flow builder data (currently unused but schema exists)
- `knowledgeBase` - Q&A pairs organized by category for agent training
- `templates` - Pre-built agent templates for different industries
- `testConversations` - Conversation history for testing agents
- `contacts` - CRM contacts with name, email, phone, tags, and notes (searchable)
- `phoneNumbers` - Twilio phone numbers with nullable agentId for assignment/unassignment workflows
- `integrationConfigs` - POS integration OAuth tokens and configuration (Square, Toast)
- `analyticsEvents` - Event tracking for calls, orders, reservations with metadata

**Migration Strategy**: Drizzle Kit for schema migrations (push-based approach)

**Data Relationships**:
- Users have many agents (cascade delete)
- Users have many contacts (cascade delete)
- Users have many phone numbers (cascade delete)
- Users have many integrations (cascade delete)
- Users have many analytics events (cascade delete)
- Agents have many knowledge base items (cascade delete)
- Agents have many test conversations (cascade delete)
- Agents optionally referenced by analytics events (nullable, set null on agent delete)
- Phone numbers optionally reference agents (nullable, set null on agent delete)
- Templates can be cloned to create new agents

### External Dependencies

**Authentication Service**: Replit OIDC provider for user authentication and session management

**AI Service**: OpenAI API (GPT-5 model) for generating conversational responses
- System prompts combine agent personality, greeting, and knowledge base
- Conversation history maintained for context
- Used in agent testing interface

**Telephony Service**: Twilio API for phone number management
- Centralized platform account (credentials stored as secrets)
- Search available numbers by area code
- Purchase and release phone numbers programmatically
- Assign phone numbers to AI agents for call routing
- Graceful degradation when credentials not configured (DB operations still work)

**Database Service**: Neon Serverless PostgreSQL
- WebSocket-based connection pooling
- Configured via DATABASE_URL environment variable

**Development Tools**:
- Replit-specific plugins for development experience (cartographer, dev banner, runtime error overlay)
- These are conditionally loaded only in Replit development environment

**Fonts**: Google Fonts CDN for Inter, Space Grotesk, and Fira Code typefaces

**Environment Variables Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key for agent responses
- `SESSION_SECRET` - Express session encryption key
- `REPL_ID` - Replit environment identifier
- `ISSUER_URL` - OIDC issuer URL (defaults to replit.com/oidc)
- `TWILIO_ACCOUNT_SID` - Twilio account identifier (optional for phone number features)
- `TWILIO_AUTH_TOKEN` - Twilio authentication token (optional for phone number features)
- `SQUARE_CLIENT_ID` - Square OAuth application client ID (required for Square POS integration)
- `SQUARE_CLIENT_SECRET` - Square OAuth application client secret (required for Square POS integration)
- `SQUARE_OAUTH_REDIRECT_URI` - Square OAuth callback URL (required, e.g., https://yourdomain.com/api/integrations/square/oauth/callback)
- `TOAST_CLIENT_ID` - Toast OAuth application client ID (required for Toast POS integration)
- `TOAST_CLIENT_SECRET` - Toast OAuth application client secret (required for Toast POS integration)
- `TOAST_OAUTH_REDIRECT_URI` - Toast OAuth callback URL (required, e.g., https://yourdomain.com/api/integrations/toast/oauth/callback)

## Feature Implementation Status

### Completed Features

**Phone Numbers Management** (Production Ready)
- Search available Twilio phone numbers by area code
- Purchase phone numbers with optional friendly names
- Assign/unassign phone numbers to AI agents
- Release (delete) phone numbers from Twilio and database
- Validation: Zod schema with nullable agentId support, undefined filtering, empty payload rejection
- Security: Authentication on all routes, ownership validation, tenant isolation
- End-to-end tested with playwright verification

**Contacts Management** (Production Ready)
- Full CRUD operations for customer contacts
- Search and filtering capabilities
- Tag-based organization
- Notes and relationship tracking
- End-to-end tested with playwright verification

**POS Integrations** (In Progress - Migrating to OAuth)
- OAuth 2.0 flows for Square POS and Toast POS
- Automatic token refresh and management
- Secure token storage in JSONB fields
- One-click connection via OAuth redirect
- Integration status tracking and monitoring
- Previous version: Manual API key entry (deprecated)

**Analytics Dashboard** (Production Ready)
- Real-time analytics tracking for calls, orders, reservations
- Overview API endpoint with aggregated statistics
- Event types: call_started, call_ended, order_placed, reservation_made
- KPI cards: Total Calls, Average Duration, Orders, Reservations, Revenue, Total Events
- Recharts visualizations: Call Volume, Event Distribution, Agent Activity, Revenue Trends
- Date range filtering (last 30 days default)
- Edge case handling: nullable agentId, invalid metadata amounts, string parsing
- Chronological sorting of time-series data
- Nullish coalescing to preserve zero values
- Loading states and empty states
- End-to-end tested with comprehensive edge cases

**Workflow Builder Integration** (Production Ready)
- Workflow builder integrated into agent editor as a tab (Settings and Workflow tabs)
- Standalone Workflows navigation item removed from sidebar
- Workflows accessed through: Agents → Select Agent → Workflow Tab
- Drag-and-drop interface with restaurant-focused node types (greeting, menu, reservation, order, faq)
- Node palette on right, large canvas on left
- Save/load functionality within agent editor context
- Frontend-generated UUIDs for new nodes using crypto.randomUUID()
- Bulk save API with automatic upsert and deletion logic
- Preserves existing workflow data when switching between agents

**Integrations Page** (Production Ready)
- OAuth-enabled integrations: Square POS, Toast POS
- Upcoming integrations (Coming Soon): Twilio, Resy, Tock, Yelp Reservations
- Company logos using react-icons/si (Square, Twilio, Yelp) and official logo images (Toast, Resy, Tock)
- All logos displayed in 48px circular containers with proper aspect ratio
- Brand-accurate colors with dark mode support
- 3-column responsive grid layout (stacks to 2 columns on medium screens)
- All interactive elements properly instrumented with data-testid attributes
- Opacity applied only to icon containers to preserve text contrast for accessibility