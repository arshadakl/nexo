# Phase 1: Foundation, Project Structure & Core Architecture Plan

This document provides a comprehensive, file-by-file specification and step-by-step implementation plan for **Phase 1 (Foundation & Scaffolding)** of **Nexo**.

---

## 1. Project Topology & Directory Structure

To maintain clean separation between the edge Worker backend, the React 19 frontend, and shared domain models while deploying as **one single atomic Cloudflare Worker**, we adopt the following structure:

```
nexo/
├── .github/
│   └── workflows/
│       └── ci.yml                     # Typecheck, lint, and Vitest suite
├── migrations/
│   ├── 0001_core_schema.sql           # Tenants, users, memberships, sessions, audit_logs
│   ├── 0002_integrations_schema.sql   # Meta connections, oauth_attempts, webhook_events, outbox_jobs
│   ├── 0003_ai_providers_schema.sql   # Dynamic OpenAI-compatible providers, ai_runs, knowledge_articles
│   └── 0004_crm_schema.sql            # Conversations, messages, leads, lead_links, notes
├── docs/
│   ├── architecture.md
│   ├── cpu-optimization-architecture.md
│   └── phase-1-detailed-plan.md
├── shared/
│   ├── index.ts                       # Public shared exports
│   ├── types/
│   │   ├── auth.types.ts              # Session, User, Role (owner, supervisor, agent)
│   │   ├── ai.types.ts                # AIProvider, ModelConfig, QualificationResult
│   │   ├── crm.types.ts               # Conversation, Message, Lead, LeadScore
│   │   └── meta.types.ts              # Instagram & WhatsApp normalized event schemas
│   └── schemas/
│       ├── ai.schema.ts               # Strict Zod schemas for AI structured outputs
│       └── lead.schema.ts             # Zod schemas for lead extraction fields
├── worker/                            # Cloudflare Worker Backend (Hono)
│   ├── index.ts                       # Entry: fetch, queue, scheduled handlers
│   ├── env.d.ts                       # Worker environment & bindings types
│   ├── config/
│   │   └── env.ts                     # Runtime env validation with Zod
│   ├── middleware/
│   │   ├── errorHandler.ts            # Standardized JSON error envelope (< 0.1ms CPU)
│   │   ├── securityHeaders.ts         # Strict CSP, HSTS, frame-ancestors, SameSite
│   │   ├── authGuard.ts               # Session verification & tenant resolution
│   │   └── rbacGuard.ts               # Role checks (owner, supervisor, agent)
│   ├── lib/
│   │   ├── crypto.ts                  # Native Web Crypto (AES-256-GCM, HMAC-SHA256, timingSafeEqual)
│   │   ├── response.ts                # Standardized API response helpers (ok, error, paginate)
│   │   └── logger.ts                  # Sanitized structured logging (scrubs tokens, keys, PII)
│   ├── adapters/
│   │   ├── ai/
│   │   │   ├── adapter.interface.ts   # AIProviderClient interface
│   │   │   └── openAiCompatible.ts    # Native fetch() client for OpenAI/Groq/OpenRouter
│   │   └── meta/
│   │       ├── instagramAdapter.ts    # Meta Instagram Graph API client
│   │       └── whatsAppAdapter.ts     # Meta WhatsApp Cloud API client
│   ├── repositories/
│   │   ├── tenantRepository.ts        # Prepared D1 statements for tenants & members
│   │   ├── aiProviderRepository.ts    # Encrypted API key storage & provider CRUD
│   │   ├── conversationRepository.ts  # Keyset paginated conversation queries
│   │   └── outboxRepository.ts        # Durable outbox batch operations
│   ├── routes/
│   │   ├── health.routes.ts           # /api/healthz & /api/readyz
│   │   ├── auth.routes.ts             # Login, logout, session state
│   │   ├── aiProvider.routes.ts       # CRUD & Test connection for dynamic AI providers
│   │   ├── conversation.routes.ts     # Inbox endpoints, messages, takeover, AI switches
│   │   ├── lead.routes.ts             # Lead CRUD, scoring overrides, Kanban queries
│   │   └── webhook.routes.ts          # /webhooks/meta/instagram & /webhooks/meta/whatsapp
│   ├── queue/
│   │   └── consumer.ts                # Worker queue handler (conversation lease, AI inference, send)
│   └── cron/
│       └── recoverySweep.ts           # Bounded sweeper for stuck outbox jobs and expired leases
├── frontend/                          # React 19 + Vite Frontend SPA
│   ├── index.html                     # Root HTML entry with fonts & meta tags
│   ├── vite.config.ts                 # Vite config with @cloudflare/vite-plugin
│   ├── tailwind.config.ts             # Tailwind CSS v3.4 + animation plugin
│   ├── postcss.config.js              # PostCSS config
│   ├── src/
│   │   ├── main.tsx                   # React root mount
│   │   ├── App.tsx                    # Top-level routing & layout providers
│   │   ├── index.css                  # Tailwind directives & HSL color tokens (dark/light)
│   │   ├── lib/
│   │   │   ├── utils.ts               # cn() class merging (clsx + twMerge)
│   │   │   └── apiClient.ts           # Type-safe fetch client with CSRF & session handling
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   └── tooltip.tsx
│   │   │   └── layout/                # Shell & navigation
│   │   │       ├── Sidebar.tsx
│   │   │       ├── Header.tsx
│   │   │       └── AppShell.tsx
│   │   ├── hooks/                     # Custom TanStack Query hooks & utilities
│   │   │   ├── useAuth.ts
│   │   │   ├── useConversations.ts
│   │   │   ├── useLeads.ts
│   │   │   ├── useAIProviders.ts
│   │   │   └── useDebounce.ts
│   │   ├── queries/
│   │   │   ├── queryClient.ts         # QueryClient instance with tiered staleTime & tab suspension
│   │   │   └── queryKeys.ts           # Centralized query key factories
│   │   └── views/                     # Page views
│   │       ├── OverviewView.tsx
│   │       ├── InboxView.tsx
│   │       ├── LeadsView.tsx
│   │       ├── AIAutomationView.tsx
│   │       ├── IntegrationsView.tsx
│   │       └── SettingsView.tsx
├── package.json                       # Workspace root scripts & tooling
├── wrangler.jsonc                     # Cloudflare Worker configuration & bindings
├── tsconfig.json                      # Base TypeScript config (strict mode)
├── STANDARDS.md                       # Architectural standards and git commit specification
└── README.md
```

---

## 2. Phase 1 Core Deliverables & Step-by-Step Execution Plan

Phase 1 establishes the full-stack foundation so the project can be built, typechecked, migrated, and run locally against Miniflare/Cloudflare Workers runtime with zero configuration drift.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PHASE 1 SPRINT MAP                            │
├────────────────────────────────┬───────────────────────────────────────┤
│ Step 1.1: Environment & Config │ package.json, wrangler.jsonc, tsconfig│
│ Step 1.2: D1 Migrations Engine │ 0001_core, 0002_integrations, 0003_ai │
│ Step 1.3: Web Crypto Engine    │ AES-256-GCM, HMAC-SHA256 (Native C++) │
│ Step 1.4: Worker Backend Core  │ Hono entry, error envelope, /healthz  │
│ Step 1.5: Frontend Foundation  │ React 19, Tailwind, shadcn/ui, Tokens │
│ Step 1.6: TanStack Query Setup │ Tiered caching, Tab throttle, Keys   │
│ Step 1.7: CI & Test Pipeline   │ Vitest, Miniflare pool, typecheck     │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

### Step 1.1: Root Configuration & Cloudflare Bindings (`wrangler.jsonc`)
- **`wrangler.jsonc`**:
  - Worker entry: `worker/index.ts`.
  - Static assets directory: `./frontend/dist`.
  - D1 database binding: `DB` (database name: `nexo-db`).
  - Queue producer/consumer binding: `MESSAGING_QUEUE` (queue name: `nexo-messaging-queue`, `max_batch_size: 1`, `max_retries: 3`).
  - Scheduled cron: `"*/5 * * * *"` for outbox sweeper.
  - Secret declarations: `SESSION_SECRET`, `META_APP_SECRET`, `META_TOKEN_ENCRYPTION_KEY`, `WEBHOOK_VERIFY_TOKEN`.
- **`tsconfig.json`**:
  - Target: `ES2022`, Module: `ESNext`, `moduleResolution: "bundler"`.
  - Flags: `"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`, `"skipLibCheck": true`.
  - Path aliases: `@shared/*` -> `./shared/*`, `@worker/*` -> `./worker/*`, `@frontend/*` -> `./frontend/src/*`.

---

### Step 1.2: Baseline D1 Database Migrations
Migrations are written in pure SQL with strict indexing and foreign keys:

1. **`migrations/0001_core_schema.sql`**:
   - `tenants`: Multi-tenant root (id, name, slug, timezone, retention_days, created_at, updated_at).
   - `users`: Staff identities (id, email, password_hash, display_name, status, created_at).
   - `memberships`: (tenant_id, user_id, role ['owner', 'supervisor', 'agent'], UNIQUE(tenant_id, user_id)).
   - `sessions`: Secure cookie sessions (id, user_id, tenant_id, expires_at, created_at).
   - `audit_logs`: Tenant-scoped audit trail (id, tenant_id, user_id, action, target_type, target_id, diff_json, timestamp).
   - Compound indexes: `(tenant_id, created_at)`, `(user_id, expires_at)`.

2. **`migrations/0002_integrations_schema.sql`**:
   - `integration_connections`: Meta IG/WhatsApp connection metadata, encrypted tokens (encrypted_token, key_version, nonce), granted_scopes, connection_status, last_health_check_at.
   - `oauth_attempts`: Single-use state verification records (state_hash, tenant_id, user_id, provider, expires_at, consumed_at).
   - `webhook_events`: Durable inbound buffer (event_key UNIQUE, provider, connection_id, status ['received', 'processing', 'completed', 'failed'], attempts, payload_json, received_at).
   - `outbox_jobs`: Background jobs for queue dispatch & recovery (id, tenant_id, job_type, linked_id, status, scheduled_at, lease_owner, lease_expires_at).

3. **`migrations/0003_ai_providers_schema.sql`**:
   - `tenant_ai_providers`: Dynamic OpenAI-compatible providers:
     - `id`, `tenant_id`, `name`, `base_url`, `encrypted_api_key`, `key_version`, `key_nonce`, `default_model`, `temperature`, `max_tokens`, `is_active`, `is_default`, `custom_headers`, `last_health_status`, `timestamps`.
     - Filtered index: `(tenant_id, is_active, is_default)`.
   - `ai_runs`: Audit telemetry for AI invocations (id, conversation_id, provider_id, model, latency_ms, tokens_used, outcome, error_code, timestamp).
   - `knowledge_articles`: Approved FAQs & guidelines for intake context.

4. **`migrations/0004_crm_schema.sql`**:
   - `conversations`: (id, tenant_id, connection_id, channel ['instagram', 'whatsapp'], provider_convo_id, customer_id, customer_name, ai_mode ['INHERIT', 'ON', 'OFF'], human_takeover [0/1], last_message_at, unread_count).
   - `messages`: (id, conversation_id, provider_msg_id UNIQUE, direction ['inbound', 'outbound'], sender_type ['applicant', 'ai', 'staff'], message_text, delivery_status, created_at).
   - `leads`: (id, tenant_id, full_name, residence_country, destination_country, visa_category, education, experience, timeline, budget, lead_score, lead_status, owner_id).

---

### Step 1.3: Web Crypto Engine (`worker/lib/crypto.ts`)
- **AES-256-GCM Encryption**:
  - `encryptCredential(plainText: string, masterKeyBase64: string): Promise<{ ciphertext: string; nonce: string; version: number }>`
  - `decryptCredential(ciphertext: string, nonce: string, version: number, masterKeyBase64: string): Promise<string>`
  - Generates a fresh 12-byte cryptographically secure random nonce via `crypto.getRandomValues(new Uint8Array(12))` for every encryption.
  - Zero polyfills; executed in native C++ in **< 0.2 ms CPU**.
- **HMAC-SHA256 Webhook Verification**:
  - `verifyMetaSignature(rawBody: string, signatureHeader: string, appSecret: string): Promise<boolean>`
  - Uses `crypto.subtle.importKey` and `crypto.subtle.sign` to reproduce the signature.
  - Compares signatures using byte-by-byte constant-time XOR comparison to eliminate timing attacks.

---

### Step 1.4: Worker Backend Core & Middleware
- **Hono Router Setup (`worker/index.ts`)**:
  - Mounts `/api/healthz`, `/api/auth/*`, `/api/ai/*`, `/api/conversations/*`, `/api/leads/*`.
  - Mounts `/webhooks/meta/instagram` & `/webhooks/meta/whatsapp` outside of session middleware.
  - Implements `queue` export for Cloudflare Queue consumer.
  - Implements `scheduled` export for cron sweeper.
- **Middleware Pipeline**:
  - `securityHeaders`: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `errorHandler`: Returns standard RFC 7807 problem details (`{ error: { code: string, message: string, status: number } }`). Never leaks stack traces or SQL errors.
  - `authGuard`: Extracts secure session cookie, verifies against `sessions` table in D1 (or signed session token), binds `tenantId` and `userId` to Hono context.

---

### Step 1.5: Frontend Foundation (React 19 + Tailwind + shadcn/ui)
- **Vite & Tailwind Config**:
  - React 19 with fast refresh.
  - Tailwind CSS v3.4 with PostCSS.
  - CSS Variables in `frontend/src/index.css` defining semantic HSL tokens:
    - `--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`.
- **shadcn/ui Component Primitives**:
  - Standardized `Button` (default, destructive, outline, secondary, ghost, link).
  - Standardized `Card`, `Badge`, `Input`, `Dialog`, `Table`, `Tabs`, `Skeleton`.
  - All primitives utilize `class-variance-authority` (`cva`) and `cn()` from `src/lib/utils.ts`.
- **Navigation Shell**:
  - Responsive `AppShell` with collapsible sidebar, channel indicators (Instagram magenta gradient, WhatsApp emerald green), active tenant selector, and user session badge.

---

### Step 1.6: TanStack Query Setup & Client Cache Layer
- **`queryClient.ts`**:
  - Global defaults: `refetchOnWindowFocus: true`, `retry: 1`.
  - Tiered `staleTime` defaults:
    - Presets/Settings: 10 mins.
    - Entities (Leads/Integrations): 2 mins.
    - Inbox/Messages: 15s.
  - Active Tab Throttle: Hook into `document.addEventListener('visibilitychange', ...)` to suspend query execution when hidden.
- **`queryKeys.ts`**:
  - Strictly typed factories for all domain resources to ensure cache invalidation is surgical and never does wildcard scans.

---

### Step 1.7: Testing Suite & Quality Gate
- **Vitest Configuration**:
  - Uses `@cloudflare/vitest-pool-workers` / Miniflare to execute tests against a live mock D1 and Queue instance.
  - Unit tests for:
    - AES-256-GCM encryption/decryption round-trip.
    - HMAC signature verification with valid, tampered, and missing signatures.
    - Zod schema validation for AI qualification output.
    - Prepared statement repositories and keyset queries.

---

## 3. Definition of Done for Phase 1

Phase 1 is complete when:
1. `npm run build` cleanly builds the React frontend assets (`frontend/dist`) and the Worker bundle without TypeScript or bundling errors.
2. `wrangler d1 migrations apply DB --local` successfully applies all 4 migration files to local D1.
3. `npm run test` executes and passes all crypto, D1 repository, and schema validation tests.
4. `GET /api/healthz` returns `200 OK` with JSON `{ status: "ok", timestamp: ... }`.
5. Frontend runs locally via Vite, rendering the modern dark-themed AppShell with navigation tabs and zero console warnings.
