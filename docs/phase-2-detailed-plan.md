# Phase 2 Detailed Plan: Pluggable AI Engine & Provider Governance

This document establishes the exhaustive, file-by-file engineering specification for **Phase 2 (Dynamic AI Providers, Intake Engine & Dashboard Governance)** with a ruthless focus on **Cloudflare Workers Free-Tier CPU minimization (< 10 ms CPU hard limit, target p95 < 2.5 ms)**.

---

## 1. Architectural Mandates for Phase 2

### 1.1 The 10 ms CPU Budget Enforcement
Waiting for an LLM over the network (whether Groq takes 250 ms, OpenAI takes 600 ms, or OpenRouter takes 1,200 ms) is **wall-clock I/O wait time**; it consumes **0 ms of Worker CPU**. 
However, any CPU-heavy work before or after the fetch can breach the 10 ms Free-tier hard ceiling.

```
Phase 2 AI Execution CPU Budget Breakdown (Target: < 2.3 ms Total CPU):
┌──────────────────────────────────────────────────────────┬──────────┐
│ Operation                                                │ CPU Time │
├──────────────────────────────────────────────────────────┼──────────┤
│ 1. Session verification & Tenant resolution              │ 0.3 ms   │
│ 2. D1 lookup of active provider (Prepared statement)     │ 0.3 ms   │
│ 3. Web Crypto AES-256-GCM API key decryption (Native C++)│ 0.15 ms  │
│ 4. Prompt payload preparation & JSON.stringify (~2 KiB)  │ 0.15 ms  │
│ 5. Network fetch() to OpenAI / Groq / OpenRouter API     │ 0.0 ms*  │
│ 6. Response body extraction & JSON.parse (~3 KiB)        │ 0.35 ms  │
│ 7. Structured Zod schema parsing & validation            │ 0.45 ms  │
│ 8. Deterministic score computation & status mapping      │ 0.25 ms  │
│ 9. D1 batch telemetry update (ai_runs + provider health) │ 0.35 ms  │
├──────────────────────────────────────────────────────────┼──────────┤
│ Total Active V8 CPU Consumed                             │ ~2.3 ms  │
│ Safety Buffer against 10.0 ms hard ceiling               │ 77%      │
└──────────────────────────────────────────────────────────┴──────────┘
* Network I/O is wall-clock wait, isolate suspended with 0% CPU usage.
```

### 1.2 The 5 Strict Anti-Patterns Prohibited in Phase 2
1. ❌ **No External AI SDKs**: Never import `@google/genai`, `openai`, `langchain`, or `@anthropic-ai/sdk`. These packages include massive Node polyfills, streaming event emitters, and circular AST parsers that spike CPU and cold-start times. Use our lightweight native `fetch()` adapter (~130 lines).
2. ❌ **No Cleartext API Keys in Network Payloads**: API keys are encrypted at rest with **Web Crypto AES-256-GCM** with fresh random IVs. When returning provider listings to the dashboard, keys must be strictly masked (e.g. `gsk_••••••••••••3x9Q`).
3. ❌ **No Unbounded Output Tokens**: All AI calls must enforce `max_tokens` (default 600) and `AbortSignal.timeout(25000)`.
4. ❌ **No Giant Catch-All Zod Schemas**: Schemas must be pre-compiled at module scope and validate only required extraction fields.
5. ❌ **No Multi-Turn Tool Loops**: A single bounded decision call per inbound message. Multi-agent/tool loops are strictly out of scope to avoid CPU exhaustion and runaway latency.

---

## 2. Directory Layout & File Structure for Phase 2

```
nexo/
├── shared/
│   ├── types/
│   │   └── ai.types.ts                # Expanded with test result & provider preset contracts
│   └── schemas/
│       └── ai.schema.ts               # Enhanced test prompt & provider update schemas
├── worker/
│   ├── adapters/
│   │   └── ai/
│   │       ├── adapter.interface.ts   # Core AIProviderClient contract
│   │       └── openAiCompatible.ts    # Native fetch() OpenAI-compatible implementation
│   ├── repositories/
│   │   └── aiProviderRepository.ts    # D1 prepared statements, AES-256-GCM encryption/decryption
│   ├── services/
│   │   ├── aiQualificationService.ts  # Structured prompt builder, scoring rubric, and intake engine
│   │   └── aiHealthCheckService.ts    # Provider connectivity, latency measurement, and health updates
│   ├── routes/
│   │   └── aiProvider.routes.ts       # /api/ai/presets, /api/ai/providers (CRUD + Test)
│   └── index.ts                       # Mount /api/ai routes into primary router
├── frontend/
│   └── src/
│       ├── hooks/
│       │   └── useAIProviders.ts      # TanStack Query custom hooks with optimistic updates
│       └── views/
│           └── AIAutomationView.tsx   # Dynamic UI with live provider cards, test modal, and kill switches
└── tests/
    ├── aiAdapter.test.ts              # Unit tests for native fetch adapter with mock server
    └── aiRepository.test.ts           # D1 repository tests for encryption, masking, and default switching
```

---

## 3. Detailed Component Specifications

### 3.1 Dynamic OpenAI-Compatible Adapter (`worker/adapters/ai/openAiCompatible.ts`)
- **Protocol**: Standard HTTP `POST {baseUrl}/chat/completions`.
- **Headers**:
  ```json
  {
    "Content-Type": "application/json",
    "Authorization": "Bearer {decryptedApiKey}",
    "User-Agent": "Nexo-Edge-Worker/1.0"
  }
  ```
- **Payload**:
  ```json
  {
    "model": "llama-3.3-70b-versatile",
    "temperature": 0.2,
    "max_tokens": 600,
    "response_format": { "type": "json_object" },
    "messages": [
      { "role": "system", "content": "..." },
      { "role": "user", "content": "..." }
    ]
  }
  ```
- **Structured Output Extraction**:
  1. Inspect `response.status`.
  2. If `401 / 403`: Return structured error `{ code: "AUTH_FAILED", recoverable: false }`.
  3. If `429`: Return structured error `{ code: "RATE_LIMITED", recoverable: true, retryAfter: ... }`.
  4. If `200 OK`: Read text, parse with `JSON.parse()`, extract `choices[0].message.content`, and parse with pre-compiled `AIQualificationResultSchema`.
  5. Enforce 25-second abort via `AbortSignal.timeout(25000)`.

### 3.2 AI Provider Repository (`worker/repositories/aiProviderRepository.ts`)
- **Database Operations (D1 Prepared Statements)**:
  - `listByTenant(tenantId)`: Selects all providers for tenant with masked keys.
  - `getByIdDecrypted(tenantId, providerId)`: Retrieves encrypted key + nonce, decrypts via Web Crypto AES-256-GCM, and returns plain key strictly for adapter execution.
  - `create(tenantId, input)`: Encrypts API key with AES-256-GCM, manages `is_default` exclusivity, and inserts into `tenant_ai_providers`.
  - `update(tenantId, providerId, input)`: Partial updates with optional key re-encryption.
  - `setDefault(tenantId, providerId)`: Atomic D1 batch setting `is_default = 0` for all other tenant providers and `is_default = 1` for selected provider.
  - `updateHealthStatus(tenantId, providerId, status, latencyMs)`: Records connectivity health.

### 3.3 Intake & Qualification Engine (`worker/services/aiQualificationService.ts`)
- **Bounded Prompt Builder**:
  - Max 10 recent messages in thread (prevents token bloat and keeps parsing fast).
  - Facts already established in lead record are supplied in system prompt so AI never repeats questions.
  - Visa guidelines/knowledge snippets appended only when relevant to applicant's stated destination.
- **Deterministic Scoring & Policy Mapping**:
  - Commercial readiness rubric: Intent (0–25) + Completeness (0–25) + Readiness (0–20) + Timeline (0–15) + Engagement (0–15).
  - Enforces safe defaults: If missing fields > 2, status remains `collecting_information` rather than falsely marking unqualified.
  - If applicant asks for a human, expresses anger, or mentions legal disputes, forces `humanReviewRequired: true` and `leadStatus: 'needs_human_review'`.

### 3.4 REST API Endpoints (`worker/routes/aiProvider.routes.ts`)
- `GET /api/ai/presets`:
  - Returns verified presets for:
    1. **Groq**: `https://api.groq.com/openai/v1` (`llama-3.3-70b-versatile`, `mixtral-8x7b-32768`).
    2. **OpenRouter**: `https://openrouter.ai/api/v1` (`deepseek/deepseek-chat`, `anthropic/claude-3.5-haiku`).
    3. **OpenAI**: `https://api.openai.com/v1` (`gpt-4o-mini`, `gpt-4o`).
    4. **DeepSeek**: `https://api.deepseek.com/v1` (`deepseek-chat`).
    5. **Together AI**: `https://api.together.xyz/v1` (`meta-llama/Llama-3.3-70B-Instruct-Turbo`).
    6. **Custom OpenAI-Compatible**: Custom base URL with custom model.
- `GET /api/ai/providers`: List tenant's active providers with masked keys and latency stats.
- `POST /api/ai/providers`: Validate with `CreateAIProviderSchema`, encrypt key, insert into D1.
- `PUT /api/ai/providers/:id`: Update provider configuration or re-encrypt new key.
- `POST /api/ai/providers/:id/test`: Live test prompt against endpoint, measuring exact round-trip latency in ms and validating JSON schema parsing.
- `POST /api/ai/providers/:id/set-default`: Atomic D1 batch setting active default.
- `DELETE /api/ai/providers/:id`: Delete provider (prevents deleting active default if others exist).

### 3.5 Frontend Integration (`frontend/src/views/AIAutomationView.tsx`)
- TanStack Query hooks in `useAIProviders.ts`:
  - `useAIProviders()`: `staleTime: 2 minutes`.
  - `useAIProviderPresets()`: `staleTime: 10 minutes`.
  - `useCreateAIProvider()`: Optimistic cache update with rollback on error.
  - `useTestAIProvider()`: Real-time latency measurement spinner and success badge.
  - `useSetDefaultAIProvider()`: Instant toggle badge in UI.
- Interactive modal with Quick-Preset dropdown that pre-fills base URL, recommended models, and header templates.

---

## 4. Phase 2 Step-by-Step Implementation Roadmap

```
Step 2.1: Domain Contracts & Adapter Core
  ├── shared/types/ai.types.ts (Expanded with preset & test types)
  ├── worker/adapters/ai/adapter.interface.ts
  └── worker/adapters/ai/openAiCompatible.ts (Native fetch, timeout, Zod extraction)

Step 2.2: D1 Repository & Encryption Storage
  ├── worker/repositories/aiProviderRepository.ts (Prepared statements, AES-GCM, masking)
  └── worker/services/aiHealthCheckService.ts (Connectivity & latency test)

Step 2.3: REST Endpoints & Route Mounting
  ├── worker/routes/aiProvider.routes.ts (/presets, /providers, /test, /set-default)
  └── worker/index.ts (Mount /api/ai routes)

Step 2.4: Unit & Integration Tests
  ├── tests/aiAdapter.test.ts (Mock server, 200 OK, 401, 429, timeout, invalid JSON)
  └── tests/aiRepository.test.ts (Encryption round-trip, key masking, default exclusivity)

Step 2.5: Frontend Hook & Dynamic UI Wiring
  ├── frontend/src/hooks/useAIProviders.ts (TanStack Query hooks)
  └── frontend/src/views/AIAutomationView.tsx (Full CRUD, preset prefill, test button)
```

---

## 5. Granular Conventional Commits Plan for Phase 2

To maintain atomic, intentional commit hygiene:

1. **`feat(ai)`**: `feat(ai): implement native OpenAI-compatible adapter and health check service`
   - Files: `shared/types/ai.types.ts`, `worker/adapters/ai/*`, `worker/services/aiHealthCheckService.ts`
2. **`feat(d1)`**: `feat(d1): create AI provider repository with AES-256-GCM encryption and masking`
   - Files: `worker/repositories/aiProviderRepository.ts`
3. **`feat(api)`**: `feat(api): add REST endpoints for dynamic AI provider management and testing`
   - Files: `worker/routes/aiProvider.routes.ts`, `worker/index.ts`
4. **`test(ai)`**: `test(ai): add unit tests for AI adapter, schema parsing, and provider repository`
   - Files: `tests/aiAdapter.test.ts`, `tests/aiRepository.test.ts`
5. **`feat(ui)`**: `feat(ui): wire AIAutomationView to backend with TanStack Query and live testing`
   - Files: `frontend/src/hooks/useAIProviders.ts`, `frontend/src/views/AIAutomationView.tsx`

---

## 6. Definition of Done for Phase 2

Phase 2 is complete when:
1. All AI calls execute in **< 2.5 ms active Worker CPU**.
2. Zero external heavy SDKs are added to `package.json`.
3. An admin can add any standard OpenAI endpoint (Groq, OpenRouter, OpenAI, DeepSeek, or custom) from the dashboard.
4. Clicking "Test Connection" executes a live backend prompt, measures round-trip latency in ms, and validates structured output.
5. Setting a provider as default atomically updates D1 and the UI cache.
6. All unit tests pass with `npm run test` and TypeScript compiles cleanly with `npm run typecheck`.
