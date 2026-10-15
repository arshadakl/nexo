# Nexo Architecture: Maximum CPU Optimization & Free-Tier Efficiency

This document details the exact technical architecture, data structures, and runtime strategies designed to **minimize active CPU usage** across all Cloudflare Worker invocations.

The target is to keep **p95 CPU time under 3 ms for HTTP/webhooks** and **under 5 ms for queue/AI dispatch**, well below Cloudflare's Free-tier hard ceiling of **10 ms CPU**.

---

## 1. Wall-Clock Time vs. Active CPU Time

On Cloudflare Workers:
- **Wall-Clock Time** (Network I/O): Waiting for OpenAI/Groq, Meta Graph API, or Cloudflare D1 network responses does **NOT** consume Worker CPU. The V8 isolate is suspended waiting for external I/O.
- **Active CPU Time**: The exact number of milliseconds V8 is actively executing JavaScript instructions (JSON parsing, loops, cryptographic hashing, string manipulation, object allocations, regex matching).
- **The Threat**: If an invocation spends > 10 ms of active CPU work, Cloudflare terminates the isolate with error `1101 / Worker exceeded CPU limit`.

```
Typical Inbound Webhook Execution Timeline (Total Wall: ~45ms | CPU: ~1.8ms):
[Raw Body Read: 0.2ms CPU] 
  → [Web Crypto HMAC: 0.3ms CPU] 
  → [Bounded JSON Parse: 0.4ms CPU] 
  → [D1 Batch Write: 0.5ms CPU + 30ms I/O wait] 
  → [Queue Send: 0.2ms CPU + 10ms I/O wait] 
  → [200 OK: 0.1ms CPU]
  Total CPU: ~1.7ms (83% safety margin under 10ms ceiling)
```

---

## 2. The 8 Golden Rules of Minimal CPU Architecture

### Rule 1: Zero Polyfilled Cryptography (100% Web Crypto API)
- ❌ **Anti-Pattern**: Using `crypto-js`, `node:crypto` polyfills, `bcryptjs`, or pure-JS HMAC libraries. These run in JS bytecode and consume 15–50 ms of CPU!
- ✅ **Nexo Architecture**:
  - Webhook HMAC-SHA256 (`X-Hub-Signature-256`) uses native `crypto.subtle.importKey` + `crypto.subtle.sign` or `verify`. Native C++ handles the bytes in **< 0.15 ms CPU**.
  - Constant-time comparison uses byte-by-byte XOR loop or `crypto.subtle.timingSafeEqual` (built into V8).
  - Token and API key encryption uses native `crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data)` in **< 0.2 ms CPU**.

### Rule 2: Single-Pass Bounded Ingestion
- ❌ **Anti-Pattern**: Parsing unbounded JSON bodies (e.g., 2MB+), parsing twice, or validating deep nested objects with heavy recursive Zod schemas.
- ✅ **Nexo Architecture**:
  1. Enforce strict `Content-Length` and stream size cap (max 128 KiB). Reject oversized bodies immediately before reading or parsing.
  2. Read raw string once: `const raw = await c.req.raw.text()`.
  3. Validate HMAC signature against `raw` string directly.
  4. Parse with native `JSON.parse(raw)` **only after** signature verification succeeds.
  5. Validate only the top-level dispatch fields (`entry`, `changes` or `messaging`) using shallow extraction. Never parse unneeded metadata fields.

### Rule 3: Zero-Overhead Prepared D1 Repositories (No Heavy ORMs)
- ❌ **Anti-Pattern**: Heavy ORMs (Prisma, TypeORM, MikroORM) instantiate ASTs, map prototype chains, and create thousands of intermediary objects per query, eating 4–8 ms of CPU per request.
- ✅ **Nexo Architecture**:
  - Prepared D1 statements compiled once at module level or pre-bound:
    ```typescript
    // Prepared statement: compiled once, zero AST runtime overhead
    const stmt = db.prepare(
      `SELECT id, status, unread_count, ai_mode, human_takeover 
       FROM conversations 
       WHERE tenant_id = ? AND id = ?`
    );
    ```
  - **Batching**: Use `db.batch([stmt1, stmt2, stmt3])` to execute multiple writes in a single isolate transition.
  - **Column Pruning**: Never use `SELECT *`. Selecting 30 columns when 4 are needed wastes V8 memory allocation and JSON bridge serialization CPU.

### Rule 4: Native `fetch()` AI Client (Zero External SDKs)
- ❌ **Anti-Pattern**: Importing `@google/genai`, `openai`, `langchain`, or `@anthropic-ai/sdk`. These packages include massive Node polyfills, streaming parsers, retry classes, and large bundled dependencies that increase cold starts and CPU time.
- ✅ **Nexo Architecture**:
  - `OpenAICompatibleAdapter` is a single lightweight TypeScript class (~120 lines) using standard `fetch()`:
    ```typescript
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...customHeaders
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: promptMessages
      }),
      signal: AbortSignal.timeout(25000)
    });
    ```
  - Deserialization and validation: Parse bounded response JSON once, validate with a flat, strict Zod schema in **< 1.0 ms CPU**.

### Rule 5: Static Asset Interception (Workers Static Assets)
- ❌ **Anti-Pattern**: Worker route handler runs dynamically for CSS, JS, images, checking session tokens or running routing logic.
- ✅ **Nexo Architecture**:
  - Cloudflare's **Workers Static Assets** system serves frontend files (`/assets/*`, `.js`, `.css`, `.svg`, etc.) directly from edge CDN cache.
  - The dynamic Worker `fetch` handler is only invoked for:
    - `/api/*`
    - `/webhooks/*`
    - SPA HTML fallback on direct navigation to `/inbox`, `/leads`, etc.
  - Static asset requests consume **0 ms** of dynamic Worker CPU!

### Rule 6: Queue Consumer Isolation & Micro-Batches
- ❌ **Anti-Pattern**: `max_batch_size = 10` on Free tier. If each message takes 1.5 ms CPU to process, 10 messages = 15 ms CPU → **Worker Crash!**
- ✅ **Nexo Architecture**:
  - `max_batch_size = 1` for Free-tier production.
  - Each invocation processes exactly one queue event:
    1. Read event from D1 by ID (~0.5 ms CPU).
    2. Check conversation lease lock (~0.3 ms CPU).
    3. Make external AI API call (Network wait: ~1200 ms, CPU: **0 ms**).
    4. Validate AI JSON response (~0.8 ms CPU).
    5. Pre-send check & Meta Send API call (Network wait: ~200 ms, CPU: **0 ms**).
    6. Update message & lead in D1 (~0.6 ms CPU).
    7. Total invocation CPU: **~2.2 ms** (Safe margin: 78% remaining).

### Rule 7: Indexed Keyset Pagination (Zero Full-Table Scans)
- ❌ **Anti-Pattern**: `OFFSET 5000 LIMIT 25`. D1 has to scan and deserialize 5,025 rows, consuming high V8 CPU and exhausting D1 free daily read limits.
- ✅ **Nexo Architecture**:
  - Keyset pagination with compound indexes:
    ```sql
    -- Efficient keyset query: scans exactly 25 rows
    SELECT id, channel, display_name, last_message_at, unread_count 
    FROM conversations 
    WHERE tenant_id = ? AND last_message_at < ? 
    ORDER BY last_message_at DESC 
    LIMIT 25;
    ```
  - Eliminates unnecessary row parsing in the Worker isolate.

### Rule 8: Bounded Scheduled Recovery Sweeper
- ❌ **Anti-Pattern**: Cron handler runs every 5 minutes and runs `SELECT * FROM outbox_jobs WHERE status = 'pending'`, scanning the entire table.
- ✅ **Nexo Architecture**:
  - Scheduled sweep uses a hard limit:
    ```sql
    SELECT id, event_id FROM outbox_jobs 
    WHERE status = 'pending' AND scheduled_at <= ? 
    ORDER BY scheduled_at ASC 
    LIMIT 20;
    ```
  - Bounded to 20 jobs maximum per cron run. If 50 jobs are backed up, the sweeper processes 20, exits in **~1.5 ms CPU**, and catches the rest on the next run.

### Rule 9: Aggressive Client-Side Caching (TanStack Query) to Slash Worker Invocations
- ❌ **Anti-Pattern**: Re-fetching list APIs on every component re-render, tab click, or route switch. A single staff user navigating between Inbox, Leads, and AI Settings can trigger 200+ Worker invocations in 10 minutes.
- ✅ **Nexo Architecture**:
  - **Tiered `staleTime`**:
    - AI Provider presets & settings: `10 minutes` staleTime.
    - Semi-static entities (leads, connections): `2 minutes` staleTime.
    - Inbox conversation lists: `15 seconds` staleTime.
  - **Background Tab Suspension**: Polling and refetches completely stop when the browser tab is hidden (`document.visibilityState === 'hidden'`).
  - **Optimistic Mutations**: User actions (takeover, manual message send, lead status change) update the TanStack Query cache in-memory immediately, avoiding expensive round-trip list refetches.
  - **Direct Impact**: Cuts dynamic Worker invocations and D1 reads by **over 70%**, preserving the 100k daily request and 5M daily row-read free tier budgets.

---


## 3. Invocation CPU Budget Matrix

| Execution Context | Operation Breakdown | Target CPU | Hard Limit | Margin |
| :--- | :--- | :--- | :--- | :--- |
| **Meta Webhook POST** | Size cap check + HMAC-SHA256 + JSON parse + D1 insert + Queue enqueue | **1.8 ms** | 10.0 ms | **82%** |
| **Meta Webhook GET** | Query param parse + constant-time token compare + return challenge | **0.4 ms** | 10.0 ms | **96%** |
| **Queue Consumer (AI)** | D1 lookup + Lease check + AI parse/validate + Pre-send check + D1 update | **2.5 ms** | 10.0 ms | **75%** |
| **API: Inbox List** | Cookie session verify + Keyset query (25 rows) + JSON response | **1.2 ms** | 10.0 ms | **88%** |
| **API: AI Provider Test**| AES decrypt key + fetch AI endpoint + validate structured test schema | **1.6 ms** | 10.0 ms | **84%** |
| **Scheduled Sweeper** | Query 20 pending outbox records + batch re-enqueue + lease cleanup | **2.0 ms** | 10.0 ms | **80%** |

---

## 4. Implementation Guidelines for Codebase

1. **Pre-compile Regexes & Schemas**:
   - Define all Zod schemas, URL patterns, and regular expressions at module scope. Never instantiate schemas inside a loop or request handler.
2. **Reuse Web Crypto Keys**:
   - Import the webhook secret or encryption master key once per request or cache in memory where supported, avoiding repeated key imports for multi-entry webhooks.
3. **Small Request & Response Payloads**:
   - Always strip internal debugging tokens, prompt traces, and raw webhooks before writing to D1 or returning to the client.
4. **Use Native JavaScript Iterators**:
   - Prefer native `for...of` or standard array methods over heavy utility libraries (like `lodash` or `ramda`).
