# Frontend redesign implementation checklist

Status: user phases 1-4 implemented. Shell/navigation, Inbox, composer, and AI review are complete for the existing contracts. See [validation log](./frontend-redesign-validation.md) for evidence and limits. Phase 5 (full customer details/handover redesign) is next.
Date: 21 October 2026.
Design specification: [frontend-redesign-plan.md](./frontend-redesign-plan.md).

This document defines implementation order, file ownership, deliverables, and verification. Use the design specification for visual values and screen behavior. Each stage must leave the application runnable.

### User-facing phase mapping

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Design foundation and sign-in | Implemented |
| 2 | Navigation shell, responsive navigation, deep links/history | Implemented |
| 3 | Inbox list, search/filtering, thread, query feedback | Implemented |
| 4 | Composer isolation, AI review, delivery feedback | Implemented |
| 5 | Full customer details, notes, qualification and handover workflow | Implemented |
| 6 | Leads and Partners | Implemented |
| 7 | Overview, AI & knowledge, Channels, Settings | Implemented |
| 8 | Whole-application accessibility, device and release verification | Pending; phase-specific checks recorded as work ships |

The implementation stages below predate this eight-phase grouping. Stages 02-04 correspond to completed user phases 2-4. Lead-specific filter/detail URLs remain with the Leads migration; Inbox selection and filters already use URL state.

## 1. Release-one scope and decisions

- Keep React 19, Vite, TypeScript, Tailwind 3.4, TanStack Query, existing authentication, API hooks, and Lucide.
- Use Resider consistently in visible branding; keep internal package names.
- Dark theme, Inter for Latin text, suitable script fallbacks, 4px spacing grid, 6/8px radii, flat surfaces, and one restrained accent.
- Default working screen: Inbox. Preserve valid direct links.
- Keep Leads as a table. Partners becomes a compact directory.
- Use a narrow History API navigation adapter for the current seven screens. Add an established router only if implementation demonstrates a concrete need beyond this model.
- Use mature accessible dialog/menu primitives where needed. Select a compatible package during dependency review; avoid hand-building focus trapping.
- No decorative animation, Kanban, new chart library, workspace switcher, global search service, new settings backend, or persistent customer drafts in browser storage.
- Keep existing API shapes for the core redesign. Features requiring complete queues, authoritative aggregate counts, or pagination remain separately tracked below.

## 2. Execution sequence

```text
00 Baseline
   -> 01 Tokens and controls
   -> 02 Navigation shell
   -> 03 Inbox list and thread
   -> 04 Composer and AI review
   -> 05 Customer details and handover
   -> 06 Leads and Partners
   -> 07 Secondary screens
   -> 08 Release verification
```

The first complete milestone is stages 00-05: a working redesigned Inbox on desktop and mobile, including failure handling. Do not postpone message-state correctness until the final polish stage.

## 3. Stage 00 - Establish the baseline

Files: existing package scripts, `frontend/vite.config.ts`, local fixture/test configuration, and a new `docs/frontend-redesign-validation.md` log.

- [ ] Run `npm run typecheck`, `npm run build`, and `npm test`; record existing failures separately from future regressions.
- [ ] Inspect test setup and installed tools before adding browser/component testing dependencies.
- [ ] Start frontend using `npm run dev`; its API proxy expects the local Worker on port 8787. Start Worker using `npm run dev:worker` if a local backend is required.
- [ ] Use local/test data and mocked outbound messaging for behavioral verification.
- [ ] Prepare reusable fixtures: pending draft, edited draft, human takeover, failed delivery, empty result, failed query, partial qualification, consent missing/granted, unavailable partner, and disconnected channel.
- [ ] Capture current screens at 390, 1024, and 1440px; capture 768, 1280, and 1920px as layout checks later.
- [ ] Record foreground and hidden-tab request counts and initial production JS/CSS size.
- [ ] Confirm legal-page behavior: Worker explicitly handles `/privacy-policy` and `/terms`; Vite currently proxies only `/api` and `/webhooks`. Make local verification account for this difference.

Exit: baseline commands/results, representative data, and screenshots are documented. No claims that tests or live journeys passed without recorded evidence.

## 4. Stage 01 - Implement tokens and shared controls

Modify:

- `frontend/src/index.css`
- `frontend/tailwind.config.ts`
- `frontend/index.html`
- `frontend/src/components/ui/button.tsx`, `input.tsx`, `badge.tsx`, `card.tsx`, `skeleton.tsx`

Add as consumed:

- `docs/frontend-design-system.md`
- Accessible `Dialog.tsx`, `AlertDialog.tsx`, `Sheet.tsx`, and `Menu.tsx` wrappers in `components/ui/`.
- `components/feedback/EmptyState.tsx` and `ErrorState.tsx`.

Tasks:

- [ ] Translate proposed HEX tokens into the existing HSL-variable convention; preserve semantic aliases used by existing screens.
- [ ] Load Inter and define script-compatible fallback fonts. Replace Plus Jakarta Sans in CSS and HTML together.
- [ ] Standardize control heights, focus rings, disabled states, spacing, and radii.
- [ ] Use dark foreground text on the proposed accent fill where contrast requires it.
- [ ] Separate decorative divider tokens from interactive boundaries.
- [ ] Remove gradient/channel badge variants only when their callers have replacements.
- [ ] Adopt accessible overlay behavior: focus trap, labeling, Escape, focus restoration, and scroll containment.
- [ ] Use the primitives in an actual consumer or temporary local specimen; do not add a production design-system route solely for review.

Exit: actual text/background pairs pass contrast checks; keyboard focus is visible; controls work in loading, error, and disabled states; typecheck/build pass.

## 5. Stage 02 - Replace the shell and navigation

Modify `App.tsx`, `components/layout/AppShell.tsx`, `Sidebar.tsx`, and `Header.tsx`.

Add `lib/navigation.ts`, `hooks/useNavigation.ts`, and `components/layout/PageToolbar.tsx` if those seams fit the implementation.

- [x] Represent screen, selected conversation, and Inbox filters in typed URL state. Lead detail/filter URLs move with the Leads screen in user phase 6.
- [x] Parse and validate URL values; fall back safely for unknown tabs/filters.
- [x] Define history behavior: push for screen/record changes; replace for debounced search edits; Back/Forward restores valid prior context.
- [x] Preserve an unauthenticated deep link through sign-in; default to Inbox when no valid destination exists.
- [x] Replace the universal padded/max-width container with workspace and reading-page layout modes.
- [x] Set `100dvh`, `min-h-0`, and `min-w-0` at the required layout boundaries; define scroll ownership explicitly.
- [x] Build quiet grouped navigation, current-page semantics, responsive menu/rail, and real account identity.
- [x] Remove hardcoded CPU, AI-master, and channel-live claims.
- [x] Stop presenting the sum of a capped conversation response as a global unread total. Omit the number or label its loaded-result scope until an authoritative count exists.
- [x] Remove the always-on shell conversation query if its only purpose was that unsupported total.
- [x] Remove duplicated titles as each view is migrated.

Exit: direct links, refresh, Back/Forward, sign-in return, logout, and mobile navigation work. Legal destinations are preserved. Inbox uses available width without page-level nested scrolling.

## 6. Stage 03 - Build the Inbox list and thread

Modify `views/InboxView.tsx` and `hooks/useConversations.ts`.

Extract into `components/inbox/`:

- `ConversationList.tsx`
- `ConversationRow.tsx`
- `ConversationThread.tsx`
- `MessageItem.tsx`

Add shared `lib/leadPresentation.ts` and `lib/formatDate.ts` as their first consumers appear.

- [x] Keep InboxView responsible for orchestration, not the markup of every pane.
- [x] Build semantic conversation selection, search, existing channel filters, selected/unread states, and explicit result scope.
- [x] Debounce server search; preserve keyboard focus and avoid stale results replacing newer filters.
- [x] Give the conversation list and thread independent scroll containers.
- [x] Render sender types, multiline messages, timestamps, and all returned delivery statuses.
- [x] Separate loading, first-use empty, no matches, request error, and stale-data error.
- [x] Gate list/message polling by active view and selected conversation; reuse current visibility handling.
- [x] Keep a reader's scroll position when new messages arrive above/below their current context; offer a new-message action.
- [x] Avoid eager detail fetching for all rows because detail requests currently mark messages read.
- [x] At compact widths collapse details first, then navigation/list panes as needed. Mobile uses list -> thread with an explicit Back action.

Exit: selecting, searching, filtering, opening a direct conversation link, reading older visible messages, and handling a failed thread request work across target sizes. No unnecessary polling remains after leaving Inbox.

## 7. Stage 04 - Implement composer and AI draft review

Modify `InboxView.tsx`, `hooks/useConversations.ts`, and `hooks/useDrafts.ts` where behavior requires it.

Add `components/inbox/MessageComposer.tsx` and `DraftReview.tsx`.

- [x] Store unsent text per conversation ID in memory at a lifecycle level that survives normal screen navigation.
- [x] Bind draft-edit ID and edited text to the originating conversation. Clear in-memory customer drafts on logout.
- [x] Prevent background query refresh from overwriting dirty input.
- [x] Keep Enter as newline; Ctrl/Cmd+Enter sends; respect IME composition.
- [x] Move approved quick replies into a compact, accessible menu.
- [x] Separate pending AI content from sent messages. Implement Reject, Edit, Cancel edit, and Approve & send with explicit pending/error feedback.
- [x] Reconcile optimistic messages against server IDs and actual delivery state.
- [x] Treat a response containing `deliveryStatus: failed` as a delivery failure even when the HTTP request succeeded.
- [x] Preserve text on failure. Do not add automatic retries without duplicate-send protection.
- [x] Disable repeated actions while their mutation is pending; verify backend behavior before promising concurrent draft resolution safety.
- [x] Replace clear-history `window.confirm` with AlertDialog and truthful consequence copy.

Focused regression cases:

1. Type in customer A, switch to B, return: only A retains A's text.
2. Edit A's AI draft, switch to B: no A draft ID can be submitted for B.
3. Request fails: editor content survives and error is visible.
4. Dispatch fails after HTTP success: message is marked failed, never shown as delivered.
5. Successful draft approval: pending draft and canonical message reconcile without duplicate UI rows.

Exit: these cases pass with mocked transport, and the same flow is usable on a narrow/mobile viewport.

## 8. Stage 05 - Customer details and handover

Add `components/inbox/CustomerInspector.tsx`; reuse lead/expert/note hooks.

- [ ] Present status/reason, summary, next action, qualification, missing details, consent, partner, and notes using flat sections.
- [ ] Render only data actually present in the contract; use distinct loading/error/missing-lead states.
- [ ] Show human takeover and conversation AI mode without inventing a global effective state.
- [ ] Keep takeover feedback and rollback adjacent to the action.
- [ ] Explain contact consent and external-sharing consent separately.
- [ ] Verify partner assignment enforcement in the existing API before determining UI enabled/disabled behavior.
- [ ] Show assignment success only after server confirmation; preserve selection on error.
- [ ] Reuse Sheet for compact customer details and restore focus on close.

Exit: conversation -> qualification -> consent -> partner assignment works, including failure states. Stages 00-05 now form the first complete implementation milestone.

## 9. Stage 06 - Leads and Partners

Modify `views/LeadsView.tsx`, `components/leads/LeadDrawer.tsx`, and `views/ExpertsView.tsx`.

- [ ] Replace lead status/time duplication with shared presentation utilities.
- [ ] Make customer names semantic links/buttons; keep row actions available on keyboard focus.
- [ ] Reduce default columns and replace missing-detail badge clusters with readable summaries.
- [ ] Move lead detail into shared Sheet; initialize forms per lead and protect dirty fields from refetch.
- [ ] Keep all seven canonical lead statuses and existing validated update payloads.
- [ ] Preserve return context when opening a linked conversation.
- [ ] Change Partners to a compact directory with verification and availability shown separately.
- [ ] Reuse current filters and create/delete hooks; replace custom modal/confirm markup with shared primitives.
- [ ] Display field validation and mutation failures within the active form.

Exit: edit/save/reopen lead, navigate into Inbox and back, create/remove partner, and consent-gated assignment preserve correct data and focus behavior.

## 10. Stage 07 - Migrate secondary screens

| Screen | Implementation tasks | Exit condition |
| --- | --- | --- |
| Overview | Accurate labels; metrics strip; stage distribution; recently updated leads; remove unsupported growth/precision figures and misleading zeros | Every number and label matches its source; errors are distinct from empty data |
| AI & knowledge | Split Knowledge/Providers/Behavior; use shared dialogs and local test/approval feedback; policy text stays read-only unless persisted controls exist | Add/test/default/remove provider and knowledge approval flows still work |
| Channels | Compact factual status rows; reuse Instagram OAuth and WhatsApp connection; accessible setup/disconnect dialogs | Connect/callback/disconnect and failed status fetch have distinct correct feedback |
| Settings | Real session identity; remove sample staff and nonfunctional save buttons | Every editable setting has an actual persistence contract, or is omitted |
| Login | Resider branding, empty email, associated labels/autocomplete, plain progress text, no glow or CPU claims | Existing auth behavior and deep-link return work; password managers and paste work |

Files: corresponding `views/*View.tsx`, `components/integrations/WhatsAppConnectModal.tsx`, and metadata/assets as needed.

If inaccurate analytics fields remain in the service response, make a separately scoped correction in `worker/services/analyticsService.ts` with appropriate service regression coverage. Do not turn this into new analytics infrastructure.

## 11. Contract-dependent backlog

These items must not quietly expand the frontend implementation. A limited result must be labeled as limited; if complete coverage is required for release, explicitly promote the relevant contract task into the release scope.

| Task | Required backend work before exposing full behavior |
| --- | --- |
| Complete review queue | Paginate pending drafts and return authoritative total/continuation metadata |
| Complete conversation browsing | Expose validated pagination; keep filtering and ordering stable across pages |
| Global unread count / unread queue | Tenant-scoped aggregate and/or server unread filtering |
| Older message history | Cursor-based history API and defined chronological ordering |
| Global AI master control | Read/update settings contract, authorization, persistence, and defined effective-state precedence |
| Editable team/retention/audit pages | Actual supported API, permission checks, persistence, and validation |
| Trends, SLA, conversion, AI accuracy | Measured events, time windows, definitions, and aggregate queries |

Existing frontend flows can be redesigned while these items remain deferred. Do not show fake counts, disabled demo controls, or invented charts to fill their places.

## 12. Stage 08 - Verification and release readiness

- [ ] Run `npm run typecheck`, `npm run build`, and `npm test`; compare to the initial baseline.
- [ ] Run lint only after confirming the declared lint command has a usable installed configuration/toolchain.
- [ ] Exercise the focused mutation/navigation/form regressions from stages 02-06.
- [ ] Capture final representative states at 390, 768, 1024, 1280, 1440, and 1920px, including a short viewport.
- [ ] Verify 200% zoom, keyboard-only operation, overlay focus, contrast, and touch targets.
- [ ] Verify Malayalam, Arabic, Hindi, long names/links, missing fields, and mixed-direction messages.
- [ ] Verify mobile keyboard behavior, composer visibility, and detail navigation.
- [ ] Compare production bundle size and foreground/hidden-tab request counts with baseline; explain material changes.
- [ ] Search migrated UI for leftover unsupported claims, sample identities, gradients, unnecessary blur, 9-11px essential labels, and nonfunctional controls.
- [ ] Remove unused styles/components/dependencies introduced or made obsolete by this work; avoid unrelated repository cleanup.
- [ ] Record completed gates and remaining contract-dependent limitations in the validation log.

Release gate: the full Inbox-to-handover journey works, all shipped screens use the shared system, every visible action/state is truthful, and no new critical regression remains. Publish/deploy is a separate action from producing this plan.

## 13. Reviewable change batches and effort

| Batch | Stages | Review focus | Indicative effort |
| --- | --- | --- | --- |
| A | 00-01 | Baseline, token consistency, primitive behavior | 2-3.5 days |
| B | 02 | Navigation/history, shell responsiveness, query lifecycle | 1-2 days |
| C | 03-05 | Complete Inbox, customer-state isolation, messaging correctness | 3-5 days |
| D | 06 | Qualification and partner workflows | 2-3 days |
| E | 07 | Secondary screens and truthful data presentation | 2-3 days |
| F | 08 | Whole-journey and visual/accessibility verification | 1-2 days |

Total planning range: approximately 11-19 engineer-days, assuming one experienced frontend engineer and a working local environment. New backend contracts and existing baseline failures can change this range.

Start with batch A, then batch B, then complete batch C before extending the new visual system to the remaining screens. No sub-agent delegation, production deployment, or application changes are performed by this planning document.
