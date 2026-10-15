# Implementation Specification: Cloudflare-Only AI Visa Lead CRM

**Audience:** Coding agent / autonomous implementation agent  
**Product:** Multi-tenant-ready visa consultancy CRM with Instagram DMs first and WhatsApp DMs next  
**Deployment goal:** One Cloudflare Worker deployment that serves the React dashboard as static assets and exposes the API and Meta webhooks from the same Worker script  
**Initial hosting target:** Cloudflare Workers Free tier, with explicit quota monitoring and a documented upgrade path  
**Last checked against official documentation:** 15 October 2026

---

## 0. Rules for the coding agent

Implement this as production-minded software, not as a prototype that merely looks complete.

1. **Inspect the repository first.** Preserve working code, conventions, existing lint rules, package manager, and tests. If the repository is empty, scaffold the architecture below. Do not overwrite unrelated files.
2. Before implementing a provider integration, consult the current official Meta documentation linked in Section 20. Do not copy unverified endpoint names, permission scopes, callback behavior, token expiry assumptions, or Graph API versions from old examples.
3. **Never fake a successful integration.** Mock provider behavior only behind test/development adapters. Production UI must show `Not connected`, `Pending setup`, `Connected`, `Reconnect required`, `Disconnected`, or `Error` honestly. Do not hard-code connected states or fake messages/leads in production.
4. Build in vertical slices. First make the app deployable with health checks, auth, D1 migrations, assets and tests. Then add Instagram, inbox, AI, and WhatsApp. Keep every slice compiling and tested.
5. Keep the system provider-agnostic at the domain layer and provider-specific at the adapter layer. Do not scatter Meta API details throughout UI components or generic business logic.
6. Treat all incoming messages, profile fields, webhook bodies, file names, URLs, and AI output as untrusted data.
7. Use strict TypeScript. Avoid `any` except where an external SDK is untyped and the boundary is immediately validated. Validate all public request bodies and all LLM output.
8. Add tests with each feature. Do not postpone tests until the end.
9. Do not deploy to a live Meta app or send real messages unless explicit production secrets and an intentional deployment command are present. Local tests must never send real customer messages.
10. Do not claim that the whole conversation takes under 10 ms. The real constraint is active CPU time per invocation on the Free tier. Network waiting (LLM/Meta/D1 calls) is wall-clock time, not active CPU time. Bound input size and code work; measure CPU in Cloudflare and use tests/profiling to keep execution paths under the Free limit.
11. Avoid adding a separate Node server, n8n, external database, Pages project, or second Worker solely for convenience. The application Worker should expose `fetch`, `queue`, and `scheduled` handlers from one entry Worker. D1 and Queues are separate Cloudflare resources, provisioned/configured for this deployment.
12. If a requested feature conflicts with Meta policy or a verified platform limit, do not work around the rule. Record the limitation, implement a safe error state and explain it in project docs.

## 1. Product scope and defaults

### 1.1 Goal

Build an AI-assisted CRM for a visa consultancy that:

- Connects the consultancy's Instagram professional account from a button inside the CRM using Meta's official Instagram Login authorization flow.
- Later connects WhatsApp Business Platform through Meta's official Embedded Signup flow.
- Receives supported customer-initiated DMs through Meta webhooks.
- Displays Instagram and WhatsApp conversations in separate channel views, plus an optional unified inbox.
- Extracts applicant details and asks relevant follow-up questions with a natural, concise conversational style.
- Creates and updates lead records, classifies commercial readiness, explains the reason for the status, and routes uncertain or sensitive cases to staff.
- Has a React dashboard for inbox, applicant profiles, pipeline, assignments, follow-ups, automation settings, integrations, analytics, audit logs, and staff settings.
- Defaults AI automation to ON, but provides a global kill switch, per-channel controls, per-conversation overrides, human handoff and optional approval-before-send mode.
- Runs the dashboard assets, API, webhook handlers, OAuth callbacks, queue consumer, and cron recovery handler on Cloudflare.

### 1.2 Explicitly out of scope for the first release

- Automated visa eligibility decisions or promises of visa approval.
- Submitting visa applications to government systems.
- Collecting passport scans, bank statements or other sensitive documents inside Instagram/WhatsApp DMs.
- Mass unsolicited messaging, scraping, unofficial Instagram automation, browser automation, or using user passwords.
- Cross-company data sharing, automated identity matching by name alone, or automatic declarations that someone is lying/fraudulent.
- Multiple AI agents/tool loops. One bounded LLM call per eligible inbound customer message is the default.
- A separate always-on Node.js backend, n8n, or another hosting platform.

### 1.3 Default application behavior

- New tenant: AI master switch ON.
- New channel connection: channel AI switch ON after connection is fully verified.
- New conversation: AI mode `INHERIT`, which means the conversation follows tenant/channel settings.
- A conversation assigned to a staff member who has explicitly taken over must pause automatic replies until staff resumes AI or returns the conversation to `INHERIT`.
- Unknown eligibility, incomplete answers, low-confidence extraction, contradictory data, suspected fraud, sensitive legal questions, or unsupported messages must not trigger an overconfident AI response. Ask one safe clarifying question or hand off to a human.
- A business's AI settings must never override provider messaging restrictions, revoked permissions, a disconnected account, an expired/invalid token, or an out-of-window WhatsApp template requirement.

## 2. Cloudflare execution model: design for 10 ms CPU, not 10 ms wall time

### 2.1 Mandatory distinction

On Workers Free, ordinary Worker invocations have a 10 ms **CPU time** limit. This is not a 10 ms end-to-end deadline. The time spent waiting on network requests, storage operations, and other I/O is not active CPU time. The LLM may take seconds; that does not mean the Worker uses seconds of CPU.

However, a Free-tier invocation that executes more than its CPU allowance can fail. Do not rely on the fact that a queue consumer can have a longer wall-clock duration to assume that Free-tier CPU limits disappear. Keep each invocation bounded and verify the actual deployed plan/runtime limits. Paid plans have different CPU allowances and allow configured limits; do not configure a Paid-only value and assume it works on Free.

### 2.2 Engineering targets

- Target p95 active CPU under **7 ms** for normal HTTP handlers and webhook handling, leaving margin against the 10 ms hard ceiling.
- No normal endpoint should deliberately consume the entire 10 ms budget.
- Set hard request-body limits and bounded array/history sizes. Reject oversized bodies before JSON parsing where possible.
- Use no unbounded loops, recursive AI/tool loops, full-table scans, giant JSON serialization, large cryptographic operations, or synchronous CPU-heavy work.
- Use `fetch()` and D1/Queue bindings asynchronously. Waiting for the LLM is okay; repeated local computation is not.
- Store conversation state and job progress in D1. Never use module-level variables as durable state or locks.
- Keep the webhook's critical path to: request method/path check → raw-body size cap → signature validation → bounded parse/normalization → durable event/outbox write → queue enqueue attempt → success response.
- The queue consumer may wait for the LLM and Meta APIs, but each invocation's active code path must still stay inside the deployed CPU allowance. Start with a small batch size of one for Free-tier testing.
- For the dashboard, static asset requests should be served by Cloudflare's asset system without executing dynamic Worker logic wherever possible.

### 2.3 Current Free-tier budgets that must be documented and monitored

Re-check these in official Cloudflare documentation before initial deployment because quotas and pricing can change:

- Workers Free: 100,000 dynamic Worker requests per day; 10 ms CPU per invocation. Static asset requests are documented as free/unlimited when served as assets.
- Queues Free: 10,000 operations per day. A small message typically creates three operations (write, read, delete), so this is roughly 3,333 successfully delivered queue messages/day before retry/DLQ overhead. The Free plan retains messages for 24 hours.
- D1 Free: 5 million rows read/day, 100,000 rows written/day, 500 MB maximum database size per database, and 5 GB total account storage; verify current query subrequest limits before finalizing migrations.
- D1 daily quota exhaustion can make subsequent queries fail until the quota resets. The application must surface the issue instead of silently dropping messages.
- LLM provider usage is a separate cost and limit. Meta messaging/provider policies and any Meta charges are separate from Cloudflare costs.

**Capacity consequence:** Do not market the Free tier as guaranteed sufficient for unlimited production usage. Monitor daily queue operations, retries, D1 row reads/writes, dynamic request count, CPU, LLM cost and webhook failures. Include a written threshold-based upgrade runbook.

## 3. One deployment architecture

### 3.1 Required shape

Use one repository and one Worker script with the following handlers/bindings:

- `fetch(request, env, ctx)`: app API, OAuth callbacks, manual sends, static asset fallback/routing.
- `queue(batch, env, ctx)`: asynchronous message processing.
- `scheduled(event, env, ctx)`: bounded recovery sweep for pending outbox/event records and due token-health checks where appropriate.
- React/Vite build output served as Worker Static Assets through the Cloudflare Vite plugin.
- D1 binding for the application database.
- Queue producer/consumer bindings declared in Wrangler config.
- Secrets configured in Cloudflare, not committed to the repository.

### 3.2 Recommended implementation stack

- React + TypeScript + Vite.
- Cloudflare Vite plugin and Workers Static Assets; do not deploy the UI separately to Pages if the requirement is one combined application deployment.
- Hono for HTTP route composition on Workers, or the project's existing compatible router if established.
- D1 with prepared SQL statements. A lightweight typed query layer is acceptable; do not add a large ORM without a clear reason and CPU/compatibility testing.
- Zod (or another maintained schema validator) for public API inputs and LLM structured output. Keep webhook schemas bounded and validate only fields required by the selected event.
- TanStack Query for API cache/mutations and a table/list virtualization solution for large inboxes.
- A maintained authentication library with documented Cloudflare Workers + D1 support. Do not hand-roll password storage, session issuance, reset tokens or email verification. Pin compatible versions.
- Vitest with Cloudflare's Workers test pool/Miniflare bindings for unit/integration tests; Playwright for browser-level tests.
- Web Crypto API for token encryption/signature verification; no Node-only crypto or filesystem APIs at runtime.

### 3.3 Deployment semantics

- `npm run build` builds the React client and Worker bundle using the Cloudflare Vite plugin.
- `npm run deploy` should perform one `wrangler deploy` for the Worker + static assets.
- Provision D1 and Queues once, configure bindings/secrets, and apply D1 migrations as explicit deployment steps. Resource creation and D1 schema migrations are not literally the same operation as uploading the Worker bundle.
- Configure SPA fallback for frontend routes, while `/api/*` and `/webhooks/*` must always route to the Worker API and never return `index.html` as a fake API response.
- One production Worker name and one customer-facing origin. Use route-based APIs on the same origin; avoid CORS unless genuinely required.
- Use explicit `development`, `test`, and `production` environments, each with separate DBs/queues/secrets. Never point local tests at production resources.

## 4. Meta app strategy and official account connection

Use one Meta developer app owned by the product operator. Each customer authorizes their own supported assets through that app. Do not ask customers to create a developer app.

The user asked for a Connect button and Meta-hosted consent dialog. Build a polished CRM flow around Meta's official authorization/onboarding UI, but never imitate the Meta dialog or collect Meta passwords directly.

### 4.1 Instagram: Instagram Login for Instagram professional accounts

Use Meta's current **Instagram API with Instagram Login** flow for professional Business/Creator accounts. The official Meta collection says this flow does not require a Facebook Page linked to the Instagram professional account.

Minimum permissions for DM-only functionality should start with the currently documented scopes:

- `instagram_business_basic`
- `instagram_business_manage_messages`

Do not use the retired `business_basic` or `business_manage_messages` scope values. Do not request content publishing, comments, ads or other permissions unless a shipped feature demonstrably needs them.

Implementation requirements:

1. Admin selects **Connect Instagram**.
2. Server creates a cryptographically random, single-use OAuth `state`, saves only a hash plus tenant ID, user ID, provider, expiry and redirect target in D1, and returns the official Meta authorization URL or launches the documented flow.
3. Use exact configured redirect URI. Never derive a trusted callback URI from untrusted `Host`/query parameters.
4. Validate state, authenticated user session, tenant membership, state expiry, single-use status and expected provider in the callback.
5. Exchange the one-time authorization code server-side with Meta's documented token endpoint. Never send app secret or tokens to React.
6. Follow the current official long-lived-token exchange and refresh procedures as documented. Store token expiry received from Meta; do not hardcode assumed validity. Refresh before expiry when supported, and mark `Reconnect required` when refresh cannot recover.
7. Fetch and verify the professional account ID and display metadata using the current supported API.
8. Store an encrypted token and only the scopes actually granted. Do not log authorization codes or access tokens.
9. Subscribe/configure the required Instagram webhook fields and the account/app subscription exactly as required by the current Meta docs. Treat app-level webhook configuration and account-level subscriptions as separate possible steps.
10. Perform a minimal safe capability check (read permitted account metadata; do not send a test DM to a real customer). Mark connected only when the required setup steps succeed.
11. Show account identity, scopes/permissions summary, connection health, last webhook time, expiry/refresh status, reconnect action and disconnect action.

Provider adapter requirements:

- Keep Instagram base URL and Graph/API version in configuration; do not scatter URL strings through route handlers.
- Pin a currently supported Graph API version via a single `META_GRAPH_API_VERSION` setting. Do not auto-upgrade the version without testing.
- Use the API host and endpoints prescribed by Instagram Login documentation; do not mix Facebook Login token endpoints with Instagram Login without an explicit documented reason.
- Instagram's Send API only supports replying to an eligible customer who has initiated contact in the supported context. Do not build cold-DM capabilities. Group messaging is not supported in the documented Instagram API collection.
- Requests-folder conversations and older/inactive requests may have API visibility limitations. Show an honest unavailable state rather than inventing missing history.

### 4.2 WhatsApp: official Embedded Signup

Use the official WhatsApp Business Platform Embedded Signup flow for onboarding customer business assets. Do not treat it as the same flow as Instagram Login.

The Meta onboarding sequence can require configuration and server-side steps beyond launching the dialog. Confirm the precise order for the selected Meta Tech Provider / Solution Partner setup and current Embedded Signup configuration before coding. Typical documented steps include receiving the authorization code and the WABA/phone-number/business identifiers from the signup result, completing the server-side authorization/API calls, registering a phone number where required, and subscribing the app to the WABA's webhooks.

Request only the current permissions needed by the selected flow and shipped functionality. Meta's current Embedded Signup collection calls out App Review and Advanced Access for `business_management` and `whatsapp_business_management`; WhatsApp messaging also requires the applicable `whatsapp_business_messaging` access. Verify exact required access against the currently configured Meta app before production.

Implementation requirements:

1. Admin selects **Connect WhatsApp**.
2. Load the official Meta/Facebook JavaScript SDK only on the explicit user action/page needed. Configure the documented Embedded Signup `config_id`, app ID, response type and supported feature flags from environment/config.
3. Pin/verify the current SDK initialization and login callback approach with Meta's current Embedded Signup docs. Listen for the documented signup `postMessage` event with an exact allowlist of trusted origins. Reject wildcard origins and malformed/missing identifiers.
4. Generate and validate a server-controlled, single-use tenant-bound state/attempt record. Do not trust WABA IDs/phone IDs received from browser messages until verified through server-side Graph API calls authorized by the completed flow.
5. Exchange the authorization code only on the server. Encrypt tokens before storage. Never persist a token in localStorage/sessionStorage or ship it to React.
6. Complete the provider-specific business asset access/setup steps required for this app type: verify WABA access; associate the intended phone number; register the number if the documented flow requires it; fetch/record display phone number and phone-number ID; subscribe the app to the WABA webhooks; fetch relevant templates/status where needed.
7. Decide the billing/business model explicitly. Do not automatically share the product operator's credit line with customer WABAs. If the selected Meta partner flow makes credit-line sharing relevant, gate it behind a documented explicit business configuration and required approval.
8. Store WABA ID, business ID, phone-number ID, display phone number, provider token metadata, account status, subscription status and onboarding stage.
9. If the user closes the dialog, denies permission, picks an unsupported asset, already has a connected number, or onboarding is only partially complete, persist a recoverable state and explain the next step. Do not label the integration connected prematurely.
10. Provide a retry/resume setup flow and a disconnect/revocation flow.

WhatsApp policy logic:

- Track the last inbound customer message and the customer-service window for each conversation.
- Within the permitted customer-service window, use supported free-form replies where allowed.
- Outside the window, block arbitrary free-form business-initiated messages and require an eligible approved template and the necessary opt-in/policy conditions.
- A template must be selected from approved templates retrieved/managed through the API; do not let the LLM invent a template name or bypass approval.
- Track template category/status/locale and provider send errors. Treat template rejection, opt-out, blocked recipient, phone-number restriction, rate-limit responses and quality-rating issues distinctly.
- Implement a clear escalation path when the AI cannot resolve the request, as required by the relevant business messaging rules.

### 4.3 App review and production readiness

Before declaring integrations production-ready, document and verify:

- App mode and business ownership configuration.
- Valid OAuth redirect URI(s), allowed domains, privacy policy URL, data deletion instructions/callback if applicable, terms URL if required, and app contact details.
- App Review submissions and Advanced Access for the exact production permissions/scopes.
- Business verification or tech-provider requirements that apply to the chosen Meta arrangement.
- Webhook product setup, callback URLs, verify token, subscribed fields and production account subscription behavior.
- Developer/tester roles and test assets for development mode.
- The exact Graph API version currently supported at release time.
- A provider-compliant privacy policy explaining message processing, AI assistance, retention, staff access, and rights/deletion process.

Do not claim that a dev-mode test means that any consultancy can connect in production. Show a configuration checklist in the Integration Settings page for items that still require operator action.

## 5. Application modules and UI requirements

### 5.1 Navigation

- Overview
- Inbox
  - All conversations
  - Instagram
  - WhatsApp
  - Unread
  - Assigned to me
  - Needs human review
  - AI paused / failed
- Leads
- Follow-ups
- Consultations (calendar/appointments can be a later slice)
- Knowledge base / approved responses
- Analytics
- AI automation
- Integrations
- Team and roles
- Audit log
- Settings

### 5.2 Overview

Show real database-derived metrics only:

- New DMs today and over a selected period.
- Leads by status.
- Unread and unanswered conversations.
- Qualified leads awaiting staff follow-up.
- Follow-ups overdue.
- Consultation bookings and conversions, if those workflows are implemented.
- AI replies sent, AI pauses, handoffs and failures.
- Channel connection health and last webhook receipt.
- Provider/API failure rate and queue backlog/oldest pending event.

All counters must define their time window and query tenant-scoped indexes. Never display fake sample numbers outside an explicitly labeled demo environment.

### 5.3 Inbox

Must support:

- Separate Instagram and WhatsApp inboxes and a unified inbox filter.
- Filter/search by channel, unread, owner, lead status, country, visa category, AI status and date.
- Cursor-based pagination; no loading all messages/conversations into the browser.
- Conversation view with chronological messages, direction, sender type (AI/staff/applicant), timestamps, delivery state, reply error, supported attachments/media metadata and channel badge.
- Applicant/lead side panel with extracted fields, missing fields, score breakdown and confidence markers.
- Assignment, internal notes, archive, reopen, mark-unread and manual reply.
- AI state and last AI decision/reason, with safe redaction of internal prompts and secrets.
- Explicit takeover/resume actions. Manual takeover must pause AI before any subsequent automated send can happen.
- A message composer that respects provider/channel constraints and does not silently send an unapproved WhatsApp template or an out-of-window text.
- Loading, empty, permission denied, disconnected account, message unavailable, rate limited, stale data and server error states.
- Avoid aggressive polling. For initial deployment, poll active inbox data roughly every 10–15 seconds, stop/slow polling in hidden tabs, refresh on focus and use cursor/updated-since queries. Measure Worker request budgets before reducing intervals. Consider a proper real-time transport only after volume justifies its operational cost.

### 5.4 Leads

- List/table and Kanban pipeline.
- Search and filter on name, destination, visa category, status, score range, assignee, channel and last activity.
- Manual edit/override with audit entry.
- Show which facts were supplied by the applicant and which were AI-extracted; distinguish unknown/missing from explicit negative answers.
- Show the score components and the rationale. Score is a commercial prioritization signal, not proof of honesty or visa eligibility.
- Link several channel conversations to one lead only through reliable identity confirmation. Do not merge based on name similarity alone.
- Export only for authorized roles, audit exports, and avoid including raw tokens/internal prompts.

Recommended lead statuses:

- `new`
- `collecting_information`
- `qualified`
- `consultation_booked`
- `converted`
- `unqualified`
- `spam_irrelevant`
- `needs_human_review`
- `closed_lost`

Do not use a binary “genuine/fake” field. Incomplete, unqualified, spam and human-review are different states.

### 5.5 AI automation page

Include:

- Tenant-wide emergency/master enable/disable.
- Separate Instagram and WhatsApp switches.
- Per-channel human-approval mode (AI drafts, human must approve).
- Per-conversation mode: `INHERIT`, `ON`, `OFF`.
- Maximum automatic replies per conversation and per rolling time window.
- Maximum AI calls per inbound event (default exactly one decision call, no autonomous tool loop).
- Confidence threshold / human-review rules.
- Tone and supported languages.
- Approved knowledge sources and their last reviewed date.
- Current provider/model, response latency and usage/cost trend if provider supplies usage.
- Recent AI activity with request ID, prompt-version identifier, decision type and redacted reason. Never show secrets or raw hidden system prompt.
- Test playground that is isolated from live provider sends; production test messages must be opt-in and explicit.

Effective reply eligibility is computed server-side immediately before sending:

`tenant master ON` AND `channel enabled` AND `connection healthy and permission valid` AND `conversation mode != OFF` AND `not under human takeover` AND `message is eligible under provider policies` AND `not in approval-required mode unless approved`.

An explicit per-conversation ON setting cannot override a tenant emergency OFF or channel OFF. It only opts back in when higher-level controls allow automation.

### 5.6 Integrations page

For each connected provider show:

- Connected account/business/phone identity and provider identifiers in staff-appropriate form.
- Setup state and granted permissions/scopes.
- Last token health check and expiry/refresh status.
- Last valid webhook timestamp and recent webhook failures.
- Webhook subscription state and the steps still missing.
- Connect, reconnect, re-run setup, and disconnect actions.
- Clear error codes translated into safe instructions.
- Never expose raw access tokens, app secrets, authorization codes or webhook verify tokens.

### 5.7 Team, permissions and audit

Roles at minimum:

- `owner/admin`: integration configuration, team management, all records, automation defaults.
- `supervisor`: conversations/leads/team assignments, reviews, override status.
- `agent`: assigned conversations/leads, manual replies, notes, handoff.

Sensitive operations requiring audit: connecting/disconnecting an account, changing AI settings, human takeover/resume, exporting leads, editing lead statuses, changing roles, deleting records, sending templates, and changing retention.

## 6. AI qualification design

### 6.1 One bounded decision per inbound customer message

Use a single LLM request to return a validated structured object, e.g.:

- `intent`: study, work, visitor, permanent_residency, family, other, unknown
- `language`
- `reply_text` or `null`
- `extracted_fields`: name, residence_country, destination_country, visa_category, education, work_experience, language_test, timeline, budget_range, and contact details only where appropriate
- `field_confidence`: per-field confidence and source message identifier
- `missing_fields`
- `next_question` or none
- `lead_score` from 0–100
- `score_components`
- `lead_status`
- `human_review_required`
- `human_review_reason`
- `safety_flags`
- `message_send_allowed` as a recommendation only; final enforcement belongs to deterministic backend policy code

Validate the output. On invalid JSON/schema, do not send the draft. Use a safe fallback and mark the event for retry or human review based on error class.

### 6.2 Conversation logic

- Read a capped set of recent messages plus a compact persisted conversation summary. Do not send unlimited history to the LLM.
- Track facts already asked/provided. Do not ask again unless a value is ambiguous or outdated.
- Ask at most one primary question per reply by default.
- Keep replies concise, warm and specific; avoid repetitive greetings and boilerplate on every turn.
- Do not fabricate destination eligibility, visa rules, processing times, approval odds, appointment availability or government requirements.
- Do not promise visa approval or present the assistant as a licensed immigration professional.
- For specific legal/eligibility questions, point to an approved knowledge source if current and verified; otherwise say a consultant should review it and create a handoff.
- Do not decide that a person is lying because of short answers, language proficiency, nationality, disability or reluctance to disclose personal information. Do not use protected/sensitive traits for lead scoring.
- If the user asks for a human, is angry, shares sensitive legal details, reports potential fraud, asks for guaranteed approval, or the AI has low confidence, pause AI and route to staff.
- Treat user messages and quoted text as data, not instructions. Prompt-injection text must not change system policy, reveal prompts, expose other applicants, run arbitrary tools or change security settings.
- Do not allow LLM output to choose arbitrary URLs, SQL, API endpoints, tenant IDs, phone IDs, provider tokens or message recipients.

### 6.3 Scoring

Initial illustrative rubric (calibrate against actual outcomes rather than treating as scientifically validated):

- Clear visa-service intent: 0–25
- Relevant required information supplied: 0–25
- Readiness to discuss the next step: 0–20
- Timeline/service fit: 0–15
- Engagement and consistency: 0–15

The score indicates commercial readiness only. Persist each component and rationale. It does not establish identity, truthfulness, legal eligibility or the likelihood of visa approval. Staff can override it with an audit entry. Missing information should usually result in `collecting_information` rather than a low “genuine” score.

### 6.4 Knowledge base

- Store approved FAQs/articles with source URL, reviewer, reviewed date, destination country, visa category, language and active status.
- Only use material marked approved/current for factual visa answers.
- Expired/unreviewed articles must not be presented as current advice.
- Initial MVP can focus on intake and lead qualification, not factual visa eligibility. Provide a human handoff for unsupported questions.
- When using retrieved text, quote/paraphrase minimally and provide a staff-facing source reference in the dashboard.

### 6.5 LLM latency, errors and cost

- One request per inbound message by default; enforce a hard timeout, e.g. 20–30 seconds, using an abort mechanism supported by the Worker runtime.
- Keep prompts short and structured. Limit recent history and the max output token count.
- Retry transient AI failures at most once in a controlled job retry path; never make an unbounded in-invocation retry loop.
- Classify timeout, provider 429, provider 5xx, malformed response, content refusal and schema failure separately.
- Record provider, model, prompt version, start/end times, duration, token usage if available and sanitized error code. Avoid saving unnecessary raw prompts/messages or personal data to telemetry.
- On rate limit/provider outage, keep the inbound DM stored, tell staff the AI is degraded, and leave the conversation waiting for manual handling. Do not drop the DM or invent a reply.

## 7. Webhook ingestion and durable processing

### 7.1 Provider-specific webhook routes

Implement separate routes for clarity, e.g.:

- `GET/POST /webhooks/meta/instagram`
- `GET/POST /webhooks/meta/whatsapp`

Do not require the normal browser session on webhook routes. Authenticate using provider-required webhook verification and request signature validation.

### 7.2 GET verification

- Validate the expected subscribe mode and compare the verification token to a server-side secret using a safe comparison.
- Return the exact challenge only when the verification is valid.
- Return a non-success response on missing/malformed/wrong parameters.
- Never log the verify token.

### 7.3 POST validation

- Enforce content type and a small maximum body size appropriate to provider payloads (begin around 256 KiB and test documented payload variants; reject oversize with a clear non-2xx response so the event is not silently accepted).
- Read the raw body exactly once for signature verification. Use the documented `X-Hub-Signature-256` HMAC-SHA256 flow with the Meta app secret where applicable. Compare in constant time. Verify provider-specific requirements from current docs.
- Validate JSON after signature verification. Do not trust `object`, account ID, event timestamp, phone number ID, sender ID or WABA ID without checking against connected-asset records.
- Handle a payload containing multiple entries/messaging events/status events; do not assume one request equals one message.
- Ignore unknown event fields safely but emit a sanitized metric. Version the internal normalized event schema.
- Return non-2xx if the event cannot be made durable. Do not return 200 after merely storing the event in memory.

### 7.4 Durable inbox/outbox pattern

D1 and Queues are not one atomic transaction. Avoid the failure gap where D1 commits but Queue send fails, or Queue send succeeds but the D1 update fails.

Use a durable event/inbox table and outbox/recovery state:

1. Validate signature and bounded payload.
2. Normalize provider event(s), derive a stable idempotency key, and insert event records as `received` using a unique key. Use a D1 batch/transaction where supported for the event plus required processing/outbox record.
3. For incoming customer messages needing AI, enqueue a small queue message containing only the internal event ID and schema version; do not copy the whole message/PII into the Queue payload.
4. Update the event's enqueue state only after the queue send succeeds. If enqueue fails, retain the pending outbox record; a bounded cron sweeper enqueues pending records later.
5. If queue send succeeded but the subsequent D1 status write failed, the sweeper may enqueue a duplicate. The consumer must be idempotent, so duplicate delivery is safe.
6. Return 200 only after the provider event has been durably stored and can be recovered; if D1 itself fails before durable storage, return non-2xx and alert/log for provider retry.
7. Never use a process-local promise, variable, or memory buffer as the only copy of an event.

Queue retention on Free is 24 hours. D1 is the durable record for accepted events; Queue is the delivery mechanism, not the only event store.

### 7.5 Idempotency

- Prefer provider message IDs (`mid`, WhatsApp message `id`) combined with provider/connected asset/direction where appropriate.
- For events without a stable provider event ID, create a documented deterministic fingerprint from a canonical bounded subset of provider, account, event type, sender/recipient, timestamp and event-specific fields. Avoid just hashing message text or using seconds-only timestamps.
- Put a UNIQUE constraint on the stable event key and relevant provider message identity.
- Duplicate delivery must not create a second message, lead, AI answer or outbound reply.
- Track delivery/read status independently from the message's semantic content; out-of-order status events must not regress state (e.g. `delivered` must not revert to `sent`).

### 7.6 Queue consumer

- Start with `max_batch_size = 1` and a minimal batch timeout on Free. Increase only after CPU and quota tests demonstrate safety.
- Each queue message is a pointer to a D1 event. Reload authoritative data from D1; do not trust queue payload values as authorization.
- Check that the event hasn't already completed. Acquire a bounded per-conversation lease/lock using a D1 conditional update or other supported durable primitive; handle busy-lock/requeue behavior without tight loops.
- Preserve per-conversation ordering. Use provider timestamps plus receipt sequence and avoid running two AI decisions concurrently for the same conversation.
- Process one inbound event: normalize/canonicalize message → update conversation state → create/link lead if necessary → evaluate AI eligibility → call one LLM decision → validate schema → apply deterministic policy → save AI decision/draft → re-check current settings and provider policy immediately before sending → send through the adapter only if eligible → persist resulting provider message ID/status → mark event complete.
- If human approval mode is active, persist the draft and notify/update UI; do not send.
- Do not send if tenant/channel/conversation automation has been disabled while the LLM was running. Settings must be re-read immediately before the external send.
- When sending a reply, persist an outbound intent/draft before the provider call. Because a provider may accept a message even if the client times out before receiving the response, mark ambiguous results `delivery_unknown` and reconcile where possible; do not blindly resend messages after ambiguous outcomes.
- Explicitly ack a queue message only when the job is complete or durably moved into a known non-retry state. Retry transient failures; send repeatedly failing poison events to a dead-letter queue with enough redacted metadata to diagnose them.
- Do not use tight retry loops. Respect provider `Retry-After`/rate-limit guidance; schedule delayed retries where supported.

### 7.7 Keep queue usage viable on Free

- Queue only work that genuinely needs asynchronous processing, especially inbound customer messages that need AI.
- Process simple message status/read/delivery receipts with bounded indexed D1 updates in the webhook path if the CPU budget and provider rules allow, instead of spending three Queue operations on every status event. If that cannot be reliably done under the CPU limit, queue it and count the operations.
- Avoid enqueuing a second job solely to send the AI reply; do the bounded outbound send in the same consumer invocation after the AI decision, using durable intent and idempotency controls.
- Manual sends may use the same durable send-job system because staff sends are lower-volume and need recovery.
- Count retries, dead-letter writes and message-size chunking against quota. Alert well before 10,000 ops/day.
- If the application regularly nears the Free operation limit, upgrade. Do not sacrifice data durability or security to stay free.

## 8. Conversation ordering and send safety

### 8.1 Per-conversation concurrency

- Use a durable lease per conversation with owner/job ID and expiry. Every lease acquisition/release must be conditional and idempotent.
- Do not keep locks only in module scope.
- If a lease is still held, defer/retry without burning CPU in a loop.
- A stale/expired lease must be recoverable after a crashed invocation.
- Events received during processing should be stored and handled in order; do not let older AI responses overwrite a newer customer message's state.

### 8.2 Prevent stale AI replies

Immediately before sending, re-check:

- Conversation exists and belongs to the same tenant/connection.
- Current inbound message is still the eligible trigger event.
- No newer customer message invalidates the prepared answer (if a newer message exists, discard/stale-mark the draft and process the newest context).
- Tenant master/channel controls are still ON.
- Conversation mode is not OFF and human takeover has not occurred.
- Connection is active, token works and required messaging permission is present.
- Channel-specific messaging window/template/opt-in requirements pass.
- Approval-before-send is not enabled unless staff approved this exact draft.
- The outbound action has not already succeeded or become delivery-unknown.

### 8.3 Error classification

Do not treat every provider error as a retryable server failure.

- Auth revoked/invalid token: mark reconnect required; pause outbound automation; notify owner.
- Missing permissions: mark action blocked and surface setup instructions.
- Invalid recipient/account ID: permanent error; no retry.
- Policy/window/template violation: blocked; no blind retry.
- Rate limited: honor provider backoff, schedule retry within event age/window constraints.
- Temporary 5xx/network failure before request dispatch: bounded retry may be appropriate.
- Timeout after request dispatch or connection reset with unknown acceptance: mark `delivery_unknown`; reconcile/status-check where supported and avoid blind duplicate sends.
- Unsupported media/message type: report safe error, keep inbound conversation, offer staff fallback.
- D1 quota or service error: alert; don't silently mark an event completed.

## 9. D1 data model (migration-first, tenant-scoped)

Design the schema before features; use migrations checked into source control. Add indexes for every common list, join and unique lookup. Avoid cross-tenant scans.

Minimum tables (split or extend when justified):

1. `tenants`: ID, name, slug, status, timezone, locale, retention settings, created/updated timestamps.
2. `users`: authentication library-owned account/user records.
3. `memberships`: tenant ID, user ID, role, status, created timestamp; UNIQUE tenant/user.
4. `sessions` / password reset / verification tables as required by the chosen auth library; do not invent its schema manually.
5. `integration_connections`: tenant ID, provider (`instagram`/`whatsapp`), external account/WABA/phone identifiers, display metadata, granted scopes, encrypted token payload/version/nonce, expiry, status, webhook subscription status, last health check, last webhook, sanitized error code, timestamps. UNIQUE by provider and external asset where appropriate.
6. `oauth_attempts`: hashed state, provider, tenant/user IDs, expiry, consumed timestamp, redirect allowlist key, setup stage, minimal metadata. State is single-use.
7. `webhook_events`: connection/provider identifiers, unique event key, event type, normalized IDs, provider timestamp, receipt timestamp, status, attempts, sanitized error code, optional short-lived redacted payload only if justified.
8. `outbox_jobs`: job type, linked event/action ID, status, attempts, scheduled time, lease owner/expiry, last error class, created/updated timestamps.
9. `conversations`: tenant ID, connection ID, channel, provider conversation ID, external user/customer ID, display name/username or masked phone, last inbound/outbound timestamps, assignment, status, unread count, AI mode (`INHERIT`/`ON`/`OFF`), human takeover fields, last message timestamp. Add provider-scoped uniqueness.
10. `messages`: tenant ID, conversation ID, provider message ID, direction, sender type (`applicant`/`ai`/`staff`/`system`), message type, bounded body text, timestamps, provider delivery state, outbound action key, error class. Unique provider message identity where available.
11. `leads`: tenant ID, display name, residence country, destination country, visa category, education, experience, language test, timeline, budget range, contact and consent fields where appropriate, score, scoring breakdown JSON, status, owner, last qualified time, created/updated time.
12. `lead_conversation_links`: link one applicant record to multiple verified channel conversations with a method and confidence/audit trail.
13. `lead_events`: status/field changes, actor/source, previous/new value, reason, timestamp.
14. `channel_automation_settings`: tenant, channel, enabled, approval mode, rate/volume caps; UNIQUE tenant/channel.
15. `conversation_ai_state`: conversation ID, short summary, last processed message, last AI state/version, human takeover and current lease metadata if this is the selected design.
16. `ai_runs`: conversation/message/event IDs, provider/model, prompt version, status, latency, token usage if available, safe outcome class, redacted error; do not retain secrets or unnecessary full prompts.
17. `followups`: tenant/lead/conversation, due time, status, assigned user, note, completion details.
18. `internal_notes`: tenant/conversation/lead, author, body, timestamps; never expose to customer messaging.
19. `knowledge_articles`: tenant, title, country/category/language, source URL, content, review status, reviewer, reviewed date, expiry date.
20. `audit_logs`: tenant, actor, action, resource type/ID, sanitized diff/metadata, request ID, timestamp.
21. `idempotency_records` where provider/outbound operation semantics need an explicit store.

### Schema rules

- Every business-data record has `tenant_id`, directly or through a guaranteed tenant-owned parent. Every query and mutation checks tenant membership in server code.
- Use stable opaque IDs (UUID/ULID) for internal identifiers. Do not expose sequential database IDs when avoidable.
- Store timestamps as UTC epoch milliseconds or a consistent ISO UTC representation; document the format and use it everywhere.
- Use parameterized/prepared statements only. Never concatenate user input into SQL.
- Add indexes such as `(tenant_id, updated_at)`, `(tenant_id, channel, last_message_at)`, `(tenant_id, status, created_at)`, `(tenant_id, assigned_user_id, status)`, unique webhook event keys, unique connection provider IDs, and `(conversation_id, provider_timestamp)` for messages.
- Query list pages using keyset/cursor pagination rather than large OFFSET scans.
- Store bounded text and JSON sizes; do not store full unbounded provider payloads by default.
- Keep message statuses monotonic where possible; a late `sent` event must not overwrite `delivered` or `read`.
- Foreign keys and cascading deletes must be chosen deliberately. Disconnecting a provider should not blindly delete customer records, but explicit customer data deletion must delete or anonymize associated data according to policy.
- Use D1 batch/transaction patterns for logically atomic DB changes. Remember D1 and Queues cannot share one atomic transaction; use the outbox pattern.

## 10. Token security and credential lifecycle

- Configure `META_APP_ID`, `META_APP_SECRET`, Instagram redirect URI, WhatsApp Embedded Signup config ID, Meta webhook verification token, `META_TOKEN_ENCRYPTION_KEY`, and LLM credentials as Cloudflare secrets or appropriate non-secret vars. Only truly non-secret identifiers may be regular vars.
- Encrypt each customer access token before D1 storage using Web Crypto AES-GCM with a versioned 256-bit key and a fresh random nonce. Store encryption key only as a Worker secret; keep key version metadata to support rotation. Never invent deterministic nonces.
- Token decryption is allowed only inside server-side provider adapters, after tenant and connection authorization has been checked.
- Tokens must never appear in frontend payloads, error responses, analytics, logs, stack traces, audit diffs, test screenshots or exception messages.
- Implement token health checks and refresh only as allowed/documented by the current provider flow.
- On revoked permissions, disconnect, token expiry that cannot be refreshed, deleted/disabled account or provider error, pause automation and set a visible integration state.
- On disconnect: disable automation first; cancel/deactivate pending outbound jobs; revoke permissions/token if supported by the official API; clear encrypted token material; preserve business conversation/lead data unless user requested deletion; write an audit event.
- Provide a tenant data deletion/export procedure and a scheduled cleanup task for expired OAuth states, short-lived raw webhook diagnostics, old completed outbox records and data beyond configured retention.

## 11. Authentication, authorization and browser security

- Require authenticated staff for every dashboard/API route except public auth routes, Meta callbacks and provider webhooks.
- Prefer a maintained auth library documented to work on Workers and D1. Pin versions and test production runtime compatibility.
- Use Secure, HttpOnly, SameSite cookies. Apply CSRF protections to cookie-authenticated mutation endpoints; validate Origin/Referer for browser mutations as an additional defense, not as the only defense.
- Set a strict Content Security Policy and safe security headers. Sanitize any rich text/Markdown before rendering. Default to plain text for DMs; never allow message text to inject HTML.
- Validate redirect targets against an allowlist to prevent open redirects.
- Use a server-generated request ID, per-user rate limits for auth/sensitive actions, bounded request sizes and consistent error envelopes.
- Avoid logging message bodies or full phone numbers by default. Mask phone numbers in operational logs; allow authorized staff to view necessary customer data in the UI.
- Enforce RBAC on the server for each read/write/export. Hiding a button is not authorization.
- Ensure tenant ID is derived from the authenticated membership, not accepted blindly from query/body/AI output.
- Test IDORs on conversations, leads, attachments, connections, notes, follow-ups, audit logs and exports.

## 12. API outline

Use consistent response/error envelopes and cursor pagination. Exact route naming can follow existing conventions, but keep equivalent boundaries.

### Health and auth

- `GET /api/healthz`: liveness only; no secret details.
- `GET /api/readyz`: safe dependency/readiness check for authorized operators; no token disclosure.
- Auth routes provided by chosen library.

### Integrations

- `GET /api/integrations`: tenant's connections and setup states, never tokens.
- `POST /api/integrations/instagram/connect`: create OAuth state and return official authorization URL.
- `GET /api/integrations/instagram/callback`: validate state, exchange code server-side, finish setup.
- `POST /api/integrations/whatsapp/attempt`: create single-use setup attempt and return only non-secret launch configuration.
- `POST /api/integrations/whatsapp/complete`: validate signup attempt and complete server-side onboarding from callback/code and verified identifiers.
- `POST /api/integrations/:connectionId/recheck`: owner/supervisor only; run bounded provider health check.
- `POST /api/integrations/:connectionId/disconnect`: disable automation and disconnect safely.

### Webhooks

- `GET/POST /webhooks/meta/instagram`
- `GET/POST /webhooks/meta/whatsapp`
- Webhook routes must have no ordinary browser session dependency and must have strict payload/signature rules.

### Inbox/conversations

- `GET /api/conversations?channel=&status=&assignedTo=&cursor=&updatedSince=`
- `GET /api/conversations/:id`
- `GET /api/conversations/:id/messages?cursor=`
- `POST /api/conversations/:id/messages` for staff-initiated reply; enforce provider policies and idempotency.
- `POST /api/conversations/:id/takeover`
- `POST /api/conversations/:id/resume-ai`
- `PATCH /api/conversations/:id/ai-mode` with `INHERIT`/`ON`/`OFF`.
- `POST /api/conversations/:id/assign`
- `POST /api/conversations/:id/notes`
- `POST /api/conversations/:id/archive` and reopen equivalent.

### Leads/follow-up

- `GET /api/leads` with filters and keyset pagination.
- `POST /api/leads` only where staff-created lead flow is needed.
- `GET /api/leads/:id`
- `PATCH /api/leads/:id` with allowlisted fields, version checks and audit log.
- `GET /api/leads/:id/events`
- Follow-up CRUD and completion endpoints with authorization.

### Automation/knowledge/analytics

- `GET/PATCH /api/automation/settings` for tenant master switch and channel controls.
- `GET /api/automation/activity` for redacted run timeline.
- Knowledge article CRUD/review routes; require review permission to publish.
- `GET /api/analytics/overview` with bounded date ranges and indexed aggregate queries.
- `GET /api/audit-logs` restricted to appropriate role.

### API standards

- Validate query/body/path params.
- Return `400` for invalid input, `401` unauthenticated, `403` unauthorized, `404` absent/not accessible, `409` conflict, `422` policy-invalid request, `429` rate limited, `5xx` for retryable infrastructure failure.
- Do not expose raw provider error objects, SQL messages, prompts or secrets to frontend.
- Use `Cache-Control: no-store` for sensitive CRM API responses.
- Never cache private conversation/lead responses in shared edge cache.

## 13. D1 performance rules

- No unindexed full-table scans in common inbox/lead queries.
- Keep list queries bounded (e.g. 25–50 records/page); keep message windows bounded (e.g. 50–100 messages/page).
- Use keyset pagination with a stable sort pair such as `(last_message_at, id)` or `(created_at, id)`.
- Do not `SELECT *` from wide tables. Select only required fields; fetch token ciphertext only in provider-adapter code.
- Do not include encrypted tokens in every integration listing query.
- Use a single bounded aggregate query or precomputed counters for overview dashboards rather than scanning every lead on each load.
- Use prepared queries and indexes; measure D1 row read/write metrics. The number of rows scanned, not just rows returned, affects Free read usage.
- When a free quota is exceeded, surface a system banner, stop retry storms, preserve pending event records, alert the operator and avoid returning fake empty data.
- Add a `db:check` script/migration drift check; production migrations must be reversible where practical and backup-aware.

## 14. Retries, scheduling and recovery

### Scheduled sweep

Run a small scheduled sweep (initially every 5 minutes unless measured quotas justify a different interval) that:

- Selects at most a small bounded number of pending outbox rows using an index.
- Requeues old `received` events not yet enqueued.
- Marks events stuck in a lease past expiry as recoverable.
- Cleans expired OAuth states and short-retention diagnostic payloads in bounded batches.
- Checks only due token-health items, not all connections at every run.
- Emits sanitized metrics for oldest pending event and failed jobs.

Do not scan the entire event table each schedule. Use a status+scheduled index and a hard per-run limit. Continue on subsequent schedules if backlog remains.

### Retry classification

- Transient database/service/network errors: bounded retry with exponential backoff/jitter; no busy loop.
- Provider rate limits: use provider retry-after where present and make sure retry won't violate messaging window/policy.
- Invalid tokens/permissions/policy violations: do not retry blindly; pause channel and surface action needed.
- Poison event / repeated schema mismatch: dead-letter with sanitized reason and make it visible in system health.
- Retry jobs must retain a unique idempotency key and original event identity.

### Recovery behavior

- If a queue message is lost/expired but the D1 event remains pending, the sweeper can enqueue again.
- If the AI ran but sending was not attempted, resume from the persisted decision/draft instead of paying for another AI call unnecessarily.
- If the provider may have accepted a send but response was lost, mark `delivery_unknown`; don't duplicate without reconciliation.
- If D1 quota exhaustion makes writes impossible, fail closed, raise an alert and let provider retry behavior work where possible. Do not claim success without durable acceptance.

## 15. Privacy, data retention and deletion

- Collect only information needed to qualify a lead. Initial DM intake should not ask for passport number, full bank details, scans or other highly sensitive material.
- Explain that the account uses an AI assistant if that is the product behavior, and state how customer information is handled in the privacy policy.
- Define retention in tenant settings and document the default with the business/legal owner. A sensible initial default for inactive lead data could be 180 days, but make this configurable and align it with contractual/legal needs before production.
- Do not retain raw webhook payloads indefinitely. Prefer not to store them; when short-term diagnostics are necessary, redact and delete within a short documented interval.
- Provide an operator workflow for data export/deletion and applicable Meta data-deletion request handling.
- Delete/anonymize linked messages, leads, AI summaries and audit-linked PII consistently; preserve only legally justified minimal audit records.
- Do not feed one tenant's content into another tenant's AI context or knowledge base.
- Do not use customer message data for model training unless a separately reviewed, explicit lawful basis/consent and provider terms support it.

## 16. Observability and operational dashboard

Track metrics and sanitized logs for:

- Webhook received, signature rejected, normalized, duplicate, durably stored, queue enqueue success/failure.
- Queue depth/backlog, oldest message age, retry counts, DLQ size, queue ops per day.
- D1 rows read/written, query errors, quota-exhaustion events, migration status.
- Worker CPU time by route/handler, 10 ms CPU exceptions, invocation count, unhandled exceptions.
- AI provider latency, rate limits, timeouts, malformed outputs and estimated cost.
- Meta send response classes, rate limits, invalid tokens, message delivery status and unknown outcomes.
- Connection health, token expiry/reconnect status, webhook subscription status and last valid webhook.
- AI pause/handoff rate, human edits, lead status transitions and conversion results.

Never log tokens, auth codes, passwords, full webhook signatures, full phone numbers, hidden prompts, full unredacted messages by default, or raw customer documents. Logs should carry `request_id`, `tenant_id` (internal opaque ID), connection ID and event ID where appropriate.

## 17. Error and edge-case checklist

### Meta connection

- User cancels the dialog.
- User denies one permission, or permission set is insufficient.
- OAuth state missing, expired, reused, modified or belongs to another tenant.
- OAuth callback arrives twice.
- Authorization code already used/expired.
- Wrong redirect URI or API version mismatch.
- Instagram account is personal rather than professional/unsupported.
- Connected Instagram account doesn't grant messaging permission.
- User connects a second account in the same tenant.
- Account already connected to another tenant; prevent accidental cross-tenant attachment.
- Token exchange succeeds but D1 write fails; recover/reconnect without logging token.
- Token refresh fails, permissions revoked, account disabled, app goes out of live mode.
- Webhook subscription fails after token storage; show partial onboarding and provide retry.
- WhatsApp Embedded Signup `postMessage` from untrusted origin or malformed data.
- WhatsApp setup returns business ID but no WABA ID/phone ID, or selected number can't be registered.
- WABA subscription or phone registration fails halfway through.
- Signup succeeds but customer chooses to cancel before finishing optional/required partner steps.
- App review/Advanced Access is pending; show operator setup checklist instead of implying broad access.

### Webhooks/messages

- GET verification token is wrong.
- Invalid/missing HMAC signature.
- Empty body, malformed JSON, oversize body, unknown provider object, unknown fields.
- Multiple messages/events/status changes in one webhook payload.
- Duplicate webhook delivery and out-of-order event timestamps.
- Missing provider message ID; deterministic fingerprint collision risk.
- Event references unknown/disconnected account or unknown sender/recipient.
- Conversation identity changed/display name unavailable.
- Instagram message request not visible through API or history is unavailable.
- Text, media, sticker, story reply, post share, quick reply, unsupported type, empty body.
- Status event arrives before canonical message row exists; store/reconcile without crashing.
- Queue send succeeds but D1 status update fails; duplicate queue is harmless.
- D1 event persists but queue send fails; sweep recovers it.
- Provider retries after the original webhook was accepted.
- D1 is down/quota exceeded; do not ACK non-durable payloads.
- Queue ops quota exceeded or queue retention exceeded; alert and recover from D1 backlog.

### AI and automation

- AI disabled while a queue job is waiting.
- AI disabled while the LLM is responding.
- Human takes over while AI is responding.
- Newer applicant message arrives while prior AI reply is being generated.
- Two queue jobs arrive for one conversation concurrently.
- AI timeout, 429, 5xx, empty output, refusal, malformed JSON, schema violation, low-confidence field, unsupported language, very long/hostile message, prompt injection.
- AI asks for sensitive documents or promises approval; reject through deterministic policy.
- AI output names a different tenant/account/customer; ignore and log safety flag.
- Lead was manually edited while AI was processing; merge only fields that are still safe to auto-update, preserve manual overrides.
- Repeated messages loop the bot; cap replies and detect duplicate/echo events.
- AI generated a draft but human-approval mode is enabled; save draft only.
- AI provider is down; keep message and surface manual fallback.

### Outbound messages

- Account becomes disconnected between draft and send.
- Token expires/revoked before send.
- Provider 429; respect backoff.
- Provider 4xx policy/window/template error; no blind retry.
- Provider times out after possibly accepting the message; mark unknown and avoid duplicates.
- Provider succeeds but D1 fails to record sent status; reconcile with webhook/provider where possible.
- Duplicate send job/queue retry.
- Instagram recipient has not initiated contact/unsupported messaging relationship.
- WhatsApp template isn't approved/in required language or customer-service window is closed.
- User opted out or has not given required opt-in for business-initiated WhatsApp message.
- Attachment URL has expired or points to an untrusted host.
- Text includes unsafe HTML/markdown or exceeds provider length/format limits.

### Frontend/API/security

- Unauthenticated API calls, expired session, CSRF, untrusted origin.
- Cross-tenant IDOR attempts on every resource.
- Concurrent changes to status/automation settings; use optimistic version checks where necessary.
- API response contains token accidentally; test with secret canaries.
- Empty state vs failed API call; never render failure as “zero leads.”
- Cursor invalid/forged, malicious search query, oversized filter list, SQL wildcard abuse.
- User with agent role attempts export/integration changes/team admin actions.
- XSS through customer message/name/notes/knowledge text; safely render plain text and sanitized trusted Markdown only.
- Static SPA fallback accidentally intercepts `/api/*` or webhook callback paths.
- Rate abuse on login, OAuth attempts, manual sends and AI-triggering actions.
- App deploy while jobs are queued; maintain backward-compatible event schema versions or safely reject/quarantine old payloads.

## 18. Testing and acceptance criteria

### 18.1 Required automated checks

- `typecheck`, `lint`, formatting check, unit tests, integration tests, production build, Worker preview test and browser tests all pass.
- D1 migrations apply to a clean local D1 and to a disposable remote staging DB.
- No production route depends on unbound mocks or hardcoded demo records.
- No secret/token pattern appears in frontend bundles, logs, API fixtures or snapshots.

### 18.2 Unit tests

- OAuth state creation/validation, expiry, single-use and tenant binding.
- Token encryption/decryption, key version handling, invalid ciphertext behavior.
- Provider payload normalizers and canonical event identity.
- Meta signature valid/invalid/tampered/oversize body cases.
- AI output schema valid/invalid and safe fallback.
- Lead scoring components and deterministic status mapping.
- Effective AI eligibility precedence.
- WhatsApp service-window/template gating.
- Retry classification and ambiguous send outcomes.
- Tenant authorization middleware for each role.

### 18.3 Integration tests

- Webhook → D1 durable inbox/outbox → queue consumer → mock LLM → mock Meta send → persisted message state.
- Duplicate webhook creates one canonical message and one AI reply at most.
- Enqueue failure is recovered by scheduled sweep.
- Consumer retry doesn't repeat a successful outbound send.
- Human takeover while LLM is in-flight prevents send.
- Global/channel/conversation switch precedence works.
- Connection revoked while a job is queued stops send.
- D1 errors/quota simulated: event isn't falsely marked successful.
- Out-of-order messages don't regress state or send stale reply.
- WhatsApp template-required message is blocked until a valid approved template is selected.
- Cross-tenant read/write attempts return unauthorized/not-found behavior without leaking record existence.

### 18.4 Browser tests

- Sign in/out and session timeout.
- Connect Instagram launches correct configured Meta auth URL and preserves/validates state on callback.
- WhatsApp signup dialog launch/cancel/error/complete callback via a mocked SDK bridge.
- Inbox filters, cursor pagination, message list and reply composer.
- Global/channel/conversation AI switches and human takeover.
- Leads table/Kanban and manual edit audit event.
- Disconnected/permission-revoked states.
- Responsive layouts at desktop/tablet/mobile widths.
- Accessibility basics: keyboard navigation, focus handling, labels, dialog focus trap, visible status, reduced motion.

### 18.5 CPU and quota tests

- Measure Cloudflare runtime CPU, not browser request duration. Add explicit request-size tests and expensive-input fuzz tests.
- In the Free-tier test environment, test each ordinary Worker code path against the 10 ms CPU ceiling. Aim below 7 ms p95. A unit test cannot guarantee every future runtime execution stays under 10 ms; production CPU monitoring is required.
- Test queue consumer on the actual Free plan; do not infer its CPU allowance only from Paid-tier docs/config. Keep batch size one initially.
- Stress query patterns against a representative D1 dataset and monitor rows scanned/read, not just returned row count.
- Simulate queue daily operation exhaustion, D1 daily read/write quota exhaustion, rate limits, retry storms and queue backlog.
- Test with large but allowed messages, maximum recent-history context, non-English messages and long Unicode/emoji input.

### 18.6 Manual Meta staging checklist

- Use test business assets and approved test users first.
- Verify the OAuth host, callback URI, requested scopes, granted scopes and account ID for Instagram Login.
- Verify webhook setup and a real user-initiated test DM in an approved staging context.
- For WhatsApp, complete Embedded Signup with a test business/number, verify registered phone-number ID/WABA ID, app subscription, inbound message webhook, outbound response and delivery status webhook.
- Verify token invalidation/revocation and reconnect flows.
- Obtain production review/Advanced Access before advertising general customer onboarding.

### Release acceptance criteria

The initial release is not complete until:

- React dashboard and API deploy from one Worker project.
- D1 migrations and queue bindings are documented and reproducible.
- A real eligible Instagram professional account can connect through the official flow in the approved environment.
- Webhook events are signature-validated, durably accepted, idempotent and recoverable.
- AI can collect fields and create/update a lead without generating unsupported visa promises.
- Manual takeover and all AI switches are enforced by the server immediately before outbound sends.
- The inbox clearly separates channel, applicant, AI, staff and delivery states.
- WhatsApp integration either works end-to-end in the approved environment or is honestly labeled incomplete/not connected with an actionable setup checklist.
- Automated tests pass and documented failure recovery is demonstrated.
- No secret appears in browser/client code or logs.
- Free-tier limits and upgrade triggers are documented in the runbook.

## 19. Suggested implementation milestones

### Milestone 0 — Discovery and architecture proof

- Inspect repository and write `docs/architecture.md`, `docs/meta-setup.md`, `docs/free-tier-budget.md` and ADRs for multi-tenant model, single Worker deployment, queue/outbox, AI provider and token encryption.
- Confirm current Meta endpoints/permissions from official docs.
- Provision a development app, test assets and local emulation without production tokens.
- Record decisions and blockers before feature coding.

### Milestone 1 — Full-stack foundation

- Scaffold React + Vite + Workers Vite plugin.
- Configure the one Worker `fetch` API and asset handling.
- Add auth library, tenant/membership model, RBAC, structured errors, request IDs and security headers.
- Create D1 migrations, bindings, seed/bootstrap path for first owner and lint/typecheck/test pipeline.
- Deploy a skeleton and verify API/SPA routing, secrets and D1 access.

### Milestone 2 — Integration framework + Instagram

- Create encrypted credential storage and single-use OAuth attempts.
- Implement Instagram Login connect/callback/token exchange and the required webhook subscriptions.
- Implement webhook verification/signature checking and durable event/outbox ingestion.
- Add basic integration status UI and real reconnect/disconnect behavior.
- Confirm one live test DM in the approved environment.

### Milestone 3 — Inbox + lead CRM, without live AI sending

- Implement conversations/messages normalization, inbox filters, keyset pagination and lead profiles.
- Implement manual replies through the provider adapter with policy checks and audited send state.
- Add lead statuses, assignments, internal notes and human takeover.
- Add mocked deterministic AI interface in tests, but do not expose mock mode as a production connection.

### Milestone 4 — AI intake and safe automation

- Add one-call structured LLM decision pipeline, field extraction, summary, score and adaptive question strategy.
- Add the knowledge-base boundary/human escalation rules.
- Add global/channel/conversation/human-approval controls and enforce them before send.
- Add queue consumer, lease/order protection, idempotency, durable outbound intent, retries/DLQ and scheduled recovery.
- Test the “AI disabled while request is in flight” race.

### Milestone 5 — WhatsApp Embedded Signup

- Add official SDK/configuration and robust dialog event validation.
- Implement secure server-side completion, asset verification, phone registration where needed, app/WABA webhook subscription and connection health.
- Implement WhatsApp Cloud API send/receive and template/customer-service window rules.
- Add independent WhatsApp inbox/automation controls while reusing leads and staff modules.
- Demonstrate end-to-end staging DM plus status events.

### Milestone 6 — Production hardening

- Add analytics, monitoring, alerting, retention/delete workflow and operator runbook.
- Run security/tenant-isolation checks, replay tests, queue/D1 exhaustion tests and production build checks.
- Submit/complete Meta app review and permission access tasks.
- Document Cloudflare deploy, migrations, secrets, queue recovery, token rotation, app-review checklist, backup/restore and incident response.
- Do not enable general customer onboarding before relevant Meta production access is approved.

## 20. Official documentation the agent must consult

Treat these as starting points. Follow links within the official collections to the current endpoint reference and use the currently supported version/configuration during implementation.

### Cloudflare

- Workers pricing, request and CPU limits: https://developers.cloudflare.com/workers/platform/pricing/
- Queue limits and consumer CPU behavior: https://developers.cloudflare.com/queues/platform/limits/
- Queue pricing/operation counts: https://developers.cloudflare.com/queues/platform/pricing/
- D1 pricing and daily read/write limits: https://developers.cloudflare.com/d1/platform/pricing/
- D1 technical limits: https://developers.cloudflare.com/d1/platform/limits/
- React + Vite full-stack Worker: https://developers.cloudflare.com/workers/framework-guides/web-apps/react/
- Static assets in Workers: https://developers.cloudflare.com/workers/static-assets/
- D1 data security: https://developers.cloudflare.com/d1/reference/data-security/

### Meta / Instagram / WhatsApp

- Meta's Instagram API collection (Instagram Login, scopes, Send API, webhooks): https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-4909-bf2c-9442db5c8f00
- Instagram Login folder: https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
- Meta WhatsApp Embedded Signup documentation: https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup
- Meta WhatsApp Cloud API collection: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- WhatsApp webhook subscriptions: https://www.postman.com/meta/whatsapp-business-platform/folder/ozgs3jn/webhook-subscriptions
- WhatsApp Business Messaging Policy: https://whatsappbusiness.com/policy/

The implementation must not depend on blog posts or third-party snippets when official docs differ. Capture the reviewed endpoint, permission names, API version, and test date in `docs/meta-setup.md`.

## 21. Final engineering stance

Cloudflare can host the React dashboard, API, webhooks and asynchronous jobs in one full-stack Worker deployment. The platform design is viable, but the Free plan is a constrained starting tier, not an unlimited production guarantee.

The important design principles are:

1. Keep the HTTP webhook path tiny and durable.
2. Let network calls to the LLM/Meta take seconds while keeping active CPU within the deployed invocation limit.
3. Store events/jobs in D1 and use Queues for asynchronous delivery; recover queue-enqueue gaps with a durable outbox and scheduled sweeper.
4. Treat provider sends as non-idempotent unless proven otherwise; handle ambiguous send outcomes without blindly sending duplicates.
5. Enforce AI and messaging-policy controls server-side immediately before sending.
6. Build all tenant boundaries, authorization and credential isolation from day one.
7. Measure real CPU, queue operations and D1 row usage on Cloudflare Free; upgrade rather than compromising durability if quotas become a business risk.

**Definition of done:** The application is deployable as one Worker + React assets; integrations reflect actual Meta authorization state; inbound events are durably handled; AI is bounded, auditable and controllable; staff can take over; no cross-tenant or token leakage occurs; and all quota/failure paths have tested recovery behavior.
