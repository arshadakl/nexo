# Code Quality and Architecture Standards

This document establishes the mandatory standards, naming conventions, and architectural principles for both the **Cloudflare Worker backend** and the **React (Vite) frontend** across the lifetime of the **Nexo** project.

---

## 1. Single-Deployment Architecture Overview

- **Host**: Cloudflare Worker with **Workers Static Assets** (`assets = { directory: "./frontend/dist" }`).
- **Routing**:
  - `/api/*`: Handled by Hono API routes running on Cloudflare Workers edge.
  - `/webhooks/*`: Meta Instagram & WhatsApp webhook ingestion endpoints (no browser session, signature authenticated).
  - Non-API routes / Static assets: Cloudflare Worker Static Assets serves JS, CSS, fonts, and falls back to `index.html` for client-side React SPA routing.
- **Benefits**:
  - Zero CORS overhead or configuration drift.
  - Same-origin authentication cookies (`HttpOnly`, `Secure`, `SameSite=Strict`).
  - Single atomic deployment via Wrangler (`npm run deploy`).

---

## 2. Frontend Standards (React 19, TypeScript, TanStack Query & Tailwind CSS)

### 2.1 TanStack Query (React Query v5) Best Practices & Aggressive Caching
To protect Cloudflare Workers' 100,000 dynamic requests/day limit and D1's 5M daily row-read budget, frontend caching is **aggressive by design**:

- **Tiered Cache Invalidation (`staleTime` & `gcTime`)**:
  | Data Tier | `staleTime` | `gcTime` | Example Endpoints |
  | :--- | :--- | :--- | :--- |
  | **Static / Config** | **10 minutes** | **60 minutes** | AI Provider presets, system settings, knowledge base topics |
  | **Semi-Static** | **2 minutes** | **15 minutes** | Tenant AI provider list, lead pipeline stages, integration status |
  | **Active Inbox List** | **15 seconds** | **5 minutes** | Conversation list, unread counts, filter views |
  | **Active Messages** | **10 seconds** | **5 minutes** | Message thread for selected conversation |
  | **User Profile / Auth** | **5 minutes** | **30 minutes** | Current session, tenant permissions |

- **Background Tab Throttling**:
  - `refetchInterval` automatically pauses when tab is hidden (`document.visibilityState === 'hidden'`).
  - Polling only runs on the active inbox view (interval: 15s), never on background tabs, settings, or analytics.
  - `refetchOnWindowFocus: true` only triggers if data is actually past its `staleTime`.

- **Optimistic UI Updates on Mutations**:
  - Never trigger a full list re-fetch after a user mutation when the result is known.
  - Apply optimistic updates directly to the TanStack Query cache for:
    - Sending a manual message (`onMutate` appends pending message to cache).
    - Taking over a conversation (instantly marks `human_takeover: true` and `ai_mode: OFF`).
    - Updating lead status (instantly updates Kanban column in cache).
    - Toggling AI master/channel switch.
  - Roll back cache only on mutation failure (`onError`).

- **Query Key Factories**: Never hardcode string arrays in components. Define centralized, strongly-typed query key factories:
  ```typescript
  export const queryKeys = {
    auth: {
      session: ['auth', 'session'] as const,
    },
    conversations: {
      all: ['conversations'] as const,
      list: (filters: ConversationFilterParams) => [...queryKeys.conversations.all, 'list', filters] as const,
      detail: (id: string) => [...queryKeys.conversations.all, 'detail', id] as const,
      messages: (id: string, cursor?: string) => [...queryKeys.conversations.all, 'messages', id, cursor] as const,
    },
    leads: {
      all: ['leads'] as const,
      list: (filters: LeadFilterParams) => [...queryKeys.leads.all, 'list', filters] as const,
      detail: (id: string) => [...queryKeys.leads.all, 'detail', id] as const,
    },
    aiProviders: {
      all: ['ai-providers'] as const,
      list: () => [...queryKeys.aiProviders.all, 'list'] as const,
      detail: (id: string) => [...queryKeys.aiProviders.all, 'detail', id] as const,
      presets: ['ai-providers', 'presets'] as const,
    },
    integrations: {
      all: ['integrations'] as const,
      status: () => [...queryKeys.integrations.all, 'status'] as const,
    },
  };
  ```
- **Custom Hooks Encapsulation**: Components must not call raw `useQuery` directly. Wrap each query and mutation in a descriptive custom hook (e.g., `useConversations(filters)`, `useSendMessage()`, `useAIProviders()`, `useTakeoverConversation()`).
- **Targeted Cache Invalidation**: Every mutation must specify targeted cache updates using `queryClient.setQueryData(...)` or `queryClient.invalidateQueries({ queryKey: ... })` to ensure the UI stays synchronized with D1 without broad wildcard refetches.


### 2.2 Prohibiting Unwanted `useEffect`
Following modern React 19 / industry standard guidelines:
- **NO `useEffect` for Data Fetching**: Always use TanStack Query.
- **NO `useEffect` for Transforming or Deriving State**: Derive values during render:
  ```typescript
  // ❌ BAD
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => { setUnreadCount(conversations.filter(c => c.unread).length); }, [conversations]);

  // ✅ GOOD
  const unreadCount = useMemo(() => conversations.filter(c => c.unread).length, [conversations]);
  ```
- **NO `useEffect` for User Actions**: Handle actions in event handlers (`onClick`, `onSubmit`), not by syncing state into an effect.
- **Allowed Uses of `useEffect`**: Only for true synchronization with external non-React systems (e.g., setting document title, setting up global window listeners or keyboard shortcuts, integrating third-party DOM widgets).

### 2.3 Strict Naming Conventions
- **Files & Directories**:
  - React Components: **PascalCase** (`ConversationList.tsx`, `LeadCard.tsx`, `AIProviderModal.tsx`).
  - Hooks: **camelCase** with `use` prefix (`useConversations.ts`, `useAuth.ts`, `useDebounce.ts`).
  - Utilities / Services: **camelCase** (`formatDate.ts`, `apiClient.ts`).
  - Types / Contracts: **camelCase** with `.types.ts` (`conversation.types.ts`, `lead.types.ts`, `ai.types.ts`).
  - Constants: **camelCase** or **SCREAMING_SNAKE_CASE** (`constants.ts`, `queryKeys.ts`).
- **Variables & Functions**:
  - Booleans: Must use descriptive prefixes like `is`, `has`, `should`, `can` (e.g., `isLoading`, `hasUnread`, `canTakeover`, `isActive`).
  - Event Handlers: Named with `handle` prefix in components (`handleSubmit`, `handleTakeover`, `handleFilterChange`) and `on` prefix for props (`onSuccess`, `onClose`, `onSelect`).
  - Types & Interfaces: **PascalCase**, noun phrases, no Hungarian notation (e.g., `Conversation`, `LeadProfile`, `CreateAIProviderInput`; avoid `IConversation`).

### 2.4 UI & UX Standards
- **Component States**: Every view must explicitly handle 4 states:
  1. `Loading` (skeleton / spinner)
  2. `Empty` (helpful callout when list is 0)
  3. `Error` (human-readable error message with retry button)
  4. `Success` (clean data presentation)
- **Formatting**:
  - Dates: Standard localized ISO date-time display with clear relative/absolute formatting.
  - Scores: Clear score pill (0–100) with color indicators and rationale tooltips.
- **Accessibility & Design**: Semantic HTML elements (`<main>`, `<nav>`, `<article>`, `<dialog>`), keyboard accessibility, clear focus states, contrast-compliant modern design.

### 2.5 Tailwind CSS & shadcn/ui Component Standards
- **Framework**: Tailwind CSS v3.4 configured with PostCSS and `tailwindcss-animate`.
- **Component Pattern (shadcn/ui)**:
  - Base UI components reside in `frontend/src/components/ui/` (`button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `table.tsx`, `dialog.tsx`, etc.).
  - Variant management via `class-variance-authority` (`cva`).
  - Class name merging via `cn(...)` in `src/lib/utils.ts` (`clsx` + `twMerge`).
  - Strict HSL CSS variable tokens defined in `src/index.css` for consistent dark/light theme contrast.
  - Icons provided exclusively by `lucide-react`.

---

## 3. Backend Standards (Cloudflare Workers, Hono, D1, Queues)

### 3.1 Strict Free-Tier CPU Budget (< 10 ms CPU, Target p95 < 7 ms)
- **Zero Heavy Cryptography**: Use native `crypto.subtle` (Web Crypto API) for HMAC-SHA256 signature verification (`X-Hub-Signature-256`) and AES-256-GCM for credential encryption. Never import Node.js heavy polyfills or bulky crypto libraries.
- **Streamlined Webhook Ingestion**:
  1. Read raw body once (`await c.req.raw.text()`).
  2. Verify HMAC signature in constant time.
  3. Parse bounded JSON once.
  4. Lookup connection and insert into `webhook_events` (D1) using unique event key.
  5. Enqueue lightweight queue message `{ eventId, schemaVersion }`.
  6. Return HTTP 200 immediately.
- **Never Call External AI or Meta APIs from the Webhook Handler**: AI inference and Meta Graph API calls happen exclusively inside the Queue consumer or background recovery.

### 3.2 Modular Backend Architecture
- `src/config/`: Typed environment schema, validated with Zod.
- `src/routes/`: Thin Hono controllers handling HTTP routing, parsing, and status codes.
- `src/services/`: Pure business logic (AI qualification engine, lead scoring, Meta API client, safety guards).
- `src/adapters/`:
  - `ai/`: OpenAI-compatible dynamic provider client (pure `fetch()`, zero external SDKs, structured Zod validation).
  - `meta/`: Instagram Login & WhatsApp Cloud API adapters.
- `src/repositories/`: D1 database abstraction using prepared statements and atomic batching (`db.batch([...])`). No raw SQL string concatenations.
- `src/queue/`: Cloudflare Queue consumer with conversation leasing, idempotency checks, pre-send policy verification, and dead-letter handling.
- `src/cron/`: Bounded, indexed scheduled task for recovering pending/stale outbox jobs and expired leases without full-table scans.
- `src/middleware/`: Multi-tenant membership checks, authentication, CSRF validation, secure headers, and global error handling.

### 3.3 Dynamic, Replaceable AI Provider Architecture
- **OpenAI-Compatible Standard**: AI providers (OpenAI, Groq, OpenRouter, DeepSeek, self-hosted) are configured dynamically via the dashboard and stored in D1 (`tenant_ai_providers`).
- **Encrypted Credentials**: API keys are encrypted using Web Crypto AES-256-GCM with versioned keys and random nonces before storage in D1. API keys are never returned in plain text to the frontend.
- **Structured Output**: AI output is strictly validated using Zod schemas (`AIQualificationResult`). Any invalid JSON is safely handled via fallback routing to staff without dropping the message.
- **Bounded Latency**: Enforce a hard timeout (e.g., 25s) using `AbortSignal.timeout(...)`.

### 3.4 Database Integrity & Performance (D1)
- **Source of Truth**: D1 is the authoritative state. Queue messages are transient delivery triggers.
- **Keyset Pagination**: Use keyset/cursor pagination (`WHERE id > ? ORDER BY id ASC LIMIT ?`) instead of unbounded `OFFSET` queries.
- **Deduplication Constraints**:
  - `webhook_events.event_key` is UNIQUE.
  - `messages.provider_message_id` is UNIQUE.
  - `oauth_attempts.state_hash` is UNIQUE.
  - `outbox_jobs.dedupe_key` is UNIQUE.
  - `tenant_ai_providers (tenant_id, is_default)` filtered index.

---

## 4. Code Quality & Testing Requirements

- **Type Safety**: TypeScript strict mode enabled (`"strict": true`, `"noImplicitAny": true`, `"exactOptionalPropertyTypes": true`).
- **Tests**:
  - Unit tests with Vitest for HMAC verification, AES-GCM encryption/decryption, AI prompt construction, lead scoring, and Zod output schemas.
  - Mocked tests for Meta Graph API and Queue consumers.
  - Realistic fixtures for Instagram and WhatsApp webhook payloads.
- **Linting & Formatting**: Clean code without unused imports, dead variables, or unhandled promise rejections.

---

## 5. Git & Conventional Commits Specification (v1.0.0)

All commit messages in this repository **MUST** strictly follow the [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) specification.

### 5.1 Commit Message Structure
```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 5.2 Structural Elements & Types
- **`feat`**: Introduces a new feature to the codebase (correlates with `MINOR` in Semantic Versioning).
- **`fix`**: Patches a bug in the codebase (correlates with `PATCH` in Semantic Versioning).
- **`docs`**: Documentation only changes (e.g., updating README or STANDARDS).
- **`style`**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.).
- **`refactor`**: A code change that neither fixes a bug nor adds a feature.
- **`perf`**: A code change that improves performance (e.g., optimizing CPU time or D1 read/write budgets).
- **`test`**: Adding missing tests or correcting existing tests.
- **`build`**: Changes that affect the build system or external dependencies (e.g., Vite, Wrangler, npm packages).
- **`ci`**: Changes to CI configuration files and scripts.
- **`chore`**: Maintenance tasks, housekeeping, or repository configuration updates.
- **`revert`**: Reverts a previous commit.

### 5.3 Breaking Changes
- A breaking change **MUST** be indicated by:
  - An exclamation mark (`!`) right before the terminal colon: `feat(api)!: change webhook response schema`, OR
  - A footer starting with `BREAKING CHANGE: <description>` (correlates with `MAJOR` in Semantic Versioning).

### 5.4 Standard Scopes for This Repository
- **Backend / Worker**:
  - `(worker)`: Core Worker routing or entry point
  - `(webhook)`: Meta Instagram / WhatsApp webhook ingestion and HMAC verification
  - `(meta)`: Instagram Login or WhatsApp Cloud API adapters
  - `(ai)`: OpenAI-compatible provider adapter, prompts, extraction, or scoring
  - `(d1)`: Database migrations, repositories, queries, or batching
  - `(queue)`: Queue consumer, retry logic, lease locks, or DLQ
  - `(cron)`: Scheduled recovery worker
  - `(auth)`: User authentication, sessions, RBAC, CSRF, security headers
  - `(api)`: General CRM API endpoints
- **Frontend**:
  - `(frontend)`: General frontend setup, routing, or layout
  - `(queries)`: TanStack Query hooks, query key factories, mutations
  - `(ui)`: UI components, design tokens, styling, dialogs
  - `(inbox)`: Inbox view, message composer, takeover controls
  - `(leads)`: Lead pipeline, Kanban, scoring views
- **General**:
  - `(config)`: Wrangler configuration, environment bindings, tsconfig
  - `(deps)`: Dependency upgrades or additions
  - `(test)`: Test fixtures, Vitest suite, mock setup
