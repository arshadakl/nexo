# Resider frontend: deep redesign plan

Status: design specification; implementation is in progress. See [implementation checklist](./frontend-implementation-plan.md) and [validation log](./frontend-redesign-validation.md).
Prepared: 21 October 2026.
Inputs: current frontend source, shared contracts, relevant Worker routes/repositories, `STANDARDS.md`, `Design-SKILL.md`, and official Linear references.

## 1. Direction and scope

**Rebuild Resider as a calm, precise operations workspace for customer conversations, qualification, and handover.** The operator should immediately understand who needs attention, what the customer said, whether a response is a draft or has been sent, and what to do next.

The current interface has the visual vocabulary of a generated SaaS dashboard: purple gradients, sparkle branding, glass surfaces, large shadows, many colored pills, repeated explanatory headers, and technical claims competing with actual customer work. Changing the font and background alone will leave those problems intact.

“Brutal” here means a candid audit and decisive removal of weak patterns. The proposed visual style is restrained and refined; it is not a neo-brutalist style with thick borders and oversized typography.

Priority order:

1. Make the Inbox excellent and trustworthy.
2. Establish one shell, one typography system, and shared interaction primitives.
3. Make lead qualification and partner handover work as extensions of the conversation.
4. Rebuild secondary screens around honest data and clear actions.
5. Validate the complete operator journey across desktop, compact screens, keyboard, failures, and multilingual content.

Keep React 19, Vite, TypeScript, Tailwind 3.4, TanStack Query, Lucide, the existing authentication flow, and the existing API contracts wherever they support the target behavior. This is a frontend redesign with a short, explicit list of possible contract extensions, not a platform rewrite.

This audit is based on source inspection. The authenticated running application has not been visually inspected, and no usability baseline has been measured. Before implementation, capture the existing screens with representative local data; proposed dimensions and task-time targets below must be validated against those captures.

## 2. The candid audit

| Priority | Evidence in the current code | Consequence | Redesign decision |
| --- | --- | --- | --- |
| P0 | `components/layout/Header.tsx` hardcodes `AI Master ON` and `< 1.5ms`; `Sidebar.tsx` labels channels Live without connection data | Decorative confidence looks like operational truth | Remove unsupported indicators. Show health only from a relevant response, including unknown/loading/error |
| P0 | `views/SettingsView.tsx` contains sample staff identities, an uncontrolled retention field, and a Save button without a handler | A polished screen implies capabilities that do not work | Replace sample content with current session data; omit unsupported actions or explicitly identify unavailable configuration |
| P0 | `worker/services/analyticsService.ts` returns fixed `+14% this week`, `99.2% prompt precision`, and estimated message counts | Better styling would make misleading data more persuasive | Remove these claims from presentation; separately correct the service if these fields remain exposed |
| P0 | `InboxView.tsx` holds composer text and edited-draft IDs at view level while selected conversation changes independently | Source suggests a risk of carrying text or draft state into another conversation; verify before editing | Scope composer and draft edit state to conversation ID and protect unsent changes |
| P1 | `AppShell.tsx` applies `p-8`, a centered `max-w-7xl` wrapper, and a gradient to every view | A reading-page layout constrains the most demanding operational screen | Give Inbox full available width and height; use a separate reading width for settings |
| P1 | Inbox has fixed `w-80 lg:w-96` list and inspector panes inside an already constrained shell | The thread is squeezed on common laptop widths | Use measured pane budgets and a collapsible inspector; switch to sequential views on mobile |
| P1 | Sidebar, Header, Login, and several views repeat gradients, blur, sparkle icons, and shadows | Decoration overwhelms hierarchy and weakens product identity | Flat surfaces, neutral navigation, restrained semantic accents, simple wordmark |
| P1 | Header titles and view-level titles repeat the same purpose | Operators spend vertical space reading introductions to familiar screens | One page title, one action toolbar, short contextual help only where needed |
| P1 | Many operational labels are 9–11px, including statuses and qualification details | Apparent density comes from unreadable type | Increase essential text to 13–14px; achieve density through structure and progressive disclosure |
| P1 | `App.tsx` stores the selected screen and conversation in component state | Refresh, browser Back, and shareable links do not preserve work context | Make screen, selected entity, and useful filters addressable in the URL |
| P1 | Conversation rows are clickable divs; lead rows depend on row click and hover-only actions | Core navigation is difficult to discover and use with a keyboard | Semantic links/buttons, visible focus, and actions revealed on focus as well as hover |
| P1 | Custom modal/drawer markup in LeadDrawer, Experts, AI Automation, and WhatsApp connection | Focus trapping, Escape, background inertness, and focus return need explicit verification | Shared accessible Dialog, Sheet, and AlertDialog primitives |
| P1 | Several views destructure loading/data but do not render query errors separately | A failed request can resemble an empty workspace or zero activity | Distinguish initial loading, empty data, failed load, stale data, and mutation failure |
| P2 | Status styles and relative-time functions are repeated across Inbox and Leads | Semantics and formatting will drift during redesign | Central presentation maps and shared date utilities |
| P2 | Login says Nexo Edge; the shell says Resider; index.html retains Vite favicon and Nexo title | The app feels assembled from unrelated templates | Use Resider consistently in visible copy and metadata; leave internal package naming alone |
| P2 | Login prepopulates a personal email and explains edge CPU performance | Sample data and implementation details distract from authentication | Empty email by default, standard form labels, plain sign-in feedback |
| P2 | Overview visualizes current stage populations as a conversion funnel | Counts across different current states do not establish conversion over time | Rename to stage distribution; defer conversion rates until event/cohort data supports them |

The most important defect is not the use of purple. It is that unrelated information has nearly equal visual weight, and some of the loudest signals are unsupported.

## 3. What to take from Linear

Linear describes its UI redesign in terms of reduced noise, aligned navigation, stronger hierarchy, and useful density. That is the relevant precedent for Resider. [Linear redesign article](https://linear.app/now/how-we-redesigned-the-linear-ui), [redesign changelog](https://linear.app/changelog/2024-03-20-new-linear-ui).

Linear's display options separate layout, grouping, ordering, and visible properties. Its Triage provides a dedicated place to review and prioritize incoming work. Resider can adapt these ideas into compact list controls and an explicit review workflow. [Display options](https://linear.app/docs/display-options), [Triage](https://linear.app/docs/triage).

These are design interpretations for Resider, not claims that Resider should reproduce Linear's implementation or exact current pixels. The public [Linear homepage](https://linear.app/) is a reference for overall restraint; marketing layouts should not determine CRM typography or panel sizing.

| Adopt | Apply to Resider |
| --- | --- |
| Clear shell/content separation | Persistent navigation, compact page toolbar, focused work area |
| Alignment and repetition | Shared row heights, field layouts, icon sizes, and action placement |
| Quiet default state | Neutral surfaces and labels; use emphasis for selection, urgency, and primary action |
| Contextual properties | Customer details in an inspector; advanced settings behind disclosure |
| Fast navigation | Deep links, browser history, keyboard access, preserved filters |
| Explicit review | Pending AI replies visibly separate from sent customer messages |

Do not copy Linear's logo, brand assets, issue terminology, decorative website effects, or every feature. Resider's identity comes from a well-designed conversation-to-handover workflow.

## 4. Reconcile Design-SKILL.md before implementation

The supplied file is useful direction but contains conflicting extracted values. Treat the following as deliberate proposed corrections for this project. Keep the original reference intact; place the accepted project rules in `docs/frontend-design-system.md` during implementation.

| Supplied rule/value | Problem | Proposed project interpretation |
| --- | --- | --- |
| Page base `#080A0A` | Suitable starting point | Keep as the dark canvas |
| Raised `#D2D2D3`, overlay `#E3E3E6` | Near-light surfaces conflict with the dark workspace direction | Replace with dark surface steps below |
| Primary text `#5C5C5C`, secondary `#2D2E30` | These cannot be assumed readable on the proposed dark surfaces | Use light neutral text and verify actual foreground/background pairs |
| 60px heading and 17px body everywhere | Marketing-scale rules do not suit a dense CRM | Use 20px view headings and 13–14px operational type |
| 4px grid plus 5/11/13/19px spacing | Contradictory rhythm | Use a real 4px spacing scale; borders and type sizes are separate systems |
| Default 5px gap | Too tight for many controls and off the chosen grid | Use 8px control gaps and 12/16px section gaps |
| Fixed 1920px base and 52px element widths | Not a responsive application specification | Use 1440px reference composition and validate 390–1920px widths |
| Pale hover surfaces | Produces large flashes in a dark app | Use the dedicated dark hover/selection tokens |
| At most 10 colors | A literal cap conflicts with accessible semantic states | Keep a small neutral/accent palette; allow named success/warning/danger tokens |
| Inter, 6/8px radii, 1px borders, clear focus, inline errors | Useful foundations | Retain, with multilingual font fallbacks and tested interactive boundaries |
| No unsolicited animation | Good default | Static redesign. Do not introduce decorative animation or page transitions |

## 5. Proposed visual system

### 5.1 Surface and color tokens

These are original proposed Resider tokens, not extracted Linear colors. Keep HSL CSS custom properties to fit `STANDARDS.md`; HEX values below are the human-readable specification. Expose semantic aliases in Tailwind instead of scattering literal colors through views.

| Token | Proposed HEX | Purpose |
| --- | --- | --- |
| `surface-base` | `#080A0A` | Application canvas |
| `surface-sidebar` | `#0D0F10` | Persistent navigation |
| `surface-panel` | `#111416` | Content panes and grouped settings |
| `surface-raised` | `#191D20` | Dialogs and popovers |
| `surface-hover` | `#202529` | Hovered rows and controls |
| `surface-selected` | `#272D33` | Selected navigation/record |
| `border-subtle` | `#2A3035` | Decorative separation |
| `border-control` | `#68737D` | Input/control boundaries when needed for identification |
| `text-primary` | `#ECEEF0` | Main content |
| `text-secondary` | `#AFB6BE` | Supporting content |
| `text-muted` | `#8C969F` | Timestamps and low-priority labels |
| `accent` | `#7C88F8` | Primary actions and focus |
| `accent-foreground` | `#080A0A` | Text on filled accent buttons |
| `success` | `#79C9A0` | Confirmed success or completion |
| `warning` | `#E5BD76` | Attention and pending intervention |
| `danger` | `#F08D96` | Failure or destructive intent |

Use faint semantic backgrounds sparingly, with readable text. Verify blended colors too. Decorative dividers can remain subtle; boundaries or icons required to identify controls need sufficient contrast. Verify normal text at 4.5:1 and essential non-text indicators at 3:1. Do not assume white text works on the accent fill.

Rules:

- Neutral selection for navigation. Accent color primarily belongs to the next action and focus.
- No gradient page backgrounds, frosted panels, colored card glows, or large card shadows.
- One quiet elevation shadow for overlays when needed; structural layout uses boundaries and spacing.
- Status is always conveyed by words and/or icon shape, never hue alone.
- Channel identity uses a recognizable icon plus accessible text. Brand color is a small supporting cue.
- Do not give all seven lead statuses seven unrelated saturated colors.

### 5.2 Typography

Use Inter for Latin UI text. Provide suitable local/system fallbacks for Malayalam, Arabic, and Hindi; Inter alone does not cover those scripts. Use regular, medium, and semibold weights as the core set. Do not adjust letter spacing by default.

| Role | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| View title | 20 / 28px | 600 | One main title |
| Section title | 14 / 20px | 600 | Inspector and settings sections |
| Operational body | 14 / 20px | 400 | Messages, primary detail text |
| Dense row/control | 13 / 20px | 400–500 | Tables, filters, buttons, navigation |
| Secondary metadata | 12 / 16px | 400 | Timestamps and nonessential labels |
| Metric | 28 / 32px | 600 | A small number of meaningful overview figures |

No essential action, status, error, or qualification field below 12px. Message content gets enough line height for its script and must not be clipped to a fixed Latin line box. Use tabular numerals for counts and times. Avoid monospace for normal customer details.

### 5.3 Geometry and density

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48px.
- Corner radii: 6px controls; 8px overlays and genuine grouped surfaces. Circles only for avatars/status dots.
- Controls: 32px compact desktop, 36px standard; 44px effective touch targets on touch layouts.
- Sidebar items: 32–36px; lead table rows: about 48px; conversation rows: about 72px.
- Icons: 16px default, 20px when part of a major control. Align strokes and baselines.
- Main toolbar: 48px; sidebar: 224px expanded, with an optional compact rail only where useful.
- Reading pages: 880px maximum inner width. Tables and Inbox: use available workspace width.
- Use `100dvh`, `min-h-0`, and `min-w-0`; define the scroll owner of each region.

Density comes from consistent rows and fewer wrappers, not tiny fonts or hidden actions.

## 6. Navigation and shell

### 6.1 Information architecture

```text
Resider                          [workspace/account]

WORKSPACE
  Inbox                         [unread count if accurate]
  Leads
  Partners
  Overview

MANAGE
  AI & knowledge
  Channels
  Settings
```

Use Resider as the visible brand because the current domain workflows and shell already use it. “Partners” names the existing verified-expert directory; keep the verification attribute on records. “Channels” names existing Instagram and WhatsApp integrations. Keep an obvious mapping to existing screens so users can find them after release.

The default authenticated destination should be Inbox unless restoring a valid previous deep link. Keep Overview available for monitoring. Render current workspace/user data from authentication, without a workspace-switch menu unless actual switching exists.

### 6.2 Shell behavior

- Top-left: simple Resider wordmark or existing intentional brand asset, no generic Sparkles tile.
- Sidebar: grouped text navigation with a neutral active row and clear active state.
- Account menu: current name/email/role and sign out. No sample identities.
- Header: page title or breadcrumb on the left; only page-relevant actions on the right.
- Channel issues: small factual warning near Channels and the affected conversation; no permanent “Live” card.
- Sign-out control has an accessible name; all navigation exposes the current page.
- One main landmark with a skip link. Focus moves predictably after navigation.

### 6.3 URL model

Suggested URL state, using one routing approach selected during implementation:

```text
/inbox?channel=all&view=all&conversation=<id>
/inbox?view=review&conversation=<id>
/leads?status=ready_for_team&lead=<id>
/partners?sector=consulting
/overview
/ai?tab=knowledge
/channels
/settings
```

Use a small established router if it materially simplifies nested navigation, Back, and search params; otherwise a narrow History API adapter is sufficient. Do not build a general routing framework. Check existing Worker handling of `/privacy-policy` and `/terms` before changing SPA routing.

The URL owns navigable screen/filter/entity state; TanStack Query owns server data; component state owns transient UI. Unsent customer text stays in memory per conversation. Do not add localStorage persistence for customer content by default.

## 7. Inbox: the flagship redesign

### 7.1 Desktop layout

At 1440px, allocate approximately 224px navigation + 320px conversation list + 608px thread + 288px inspector. Borders are included in CSS sizing. The thread remains the visual center.

```text
┌──────────────┬────────────────────┬──────────────────────────┬──────────────────┐
│ Resider      │ Inbox    All / ... │ Customer       AI paused │ Customer details │
│              ├────────────────────┼──────────────────────────┤                  │
│ Inbox        │ Search             │                          │ Status           │
│ Leads        │ Channel / view     │ Customer and staff       │ Summary          │
│ Partners     ├────────────────────┤ messages                 │ Next action      │
│ Overview     │ Name        4m     │                          │ Qualification    │
│              │ Message preview    │                          │ Consent          │
│              │ Status / unread    ├──────────────────────────┤ Partner          │
│ AI & ...     │                    │ AI draft · Needs review  │ Notes            │
│ Channels     │                    │ Reject  Edit  Approve    │                  │
│ Settings     │                    ├──────────────────────────┤                  │
│ Account      │                    │ Reply…            Send   │                  │
└──────────────┴────────────────────┴──────────────────────────┴──────────────────┘
```

The outer screen is no longer a rounded floating card inside a padded page. Panels attach to the shell. Conversation list, message history, and inspector each own their scrolling; the composer stays reachable. No viewport-height subtraction tied to unrelated header padding.

### 7.2 Conversation list

- Header: “Inbox,” a search field with an explicit label, and compact filter controls.
- Row hierarchy: customer name and timestamp, one-line preview, one useful secondary state.
- Unread: weight and a small marker; do not turn the entire row into a colored badge collection.
- Selected: neutral surface and a stable selection marker, without changing row width.
- Channel: icon plus accessible label; long handles truncate with full text available on focus/open.
- Filters: All, Unread, Human handling, and Needs review only when their semantics and data coverage are supported.
- Preserve selection and scroll position when returning from customer details.
- Search may debounce requests by about 250ms. Changing channel/view can be immediate.
- Distinguish an empty account from zero search matches. Offer “Clear filters” for the latter.
- Indicate partial results when the endpoint returns a capped page; never label a loaded slice as the workspace total.

Needs review can start from the existing pending-drafts endpoint, but that endpoint currently returns a bounded set. Do not advertise a complete queue count until pagination or authoritative totals exist.

### 7.3 Thread

- Header: customer name, channel/contact context, actual human/AI state, “Details,” and a secondary action menu.
- Conversation mode and human takeover are related but separate fields. Show what is known; do not infer an effective global AI state from `aiMode` alone.
- Sender distinction: customer, staff, AI, and system labels use text and alignment, not only bubble hue.
- Messages: 14px minimum, readable width, preserved line breaks, safe handling of long links and mixed scripts.
- Use `dir="auto"` or equivalent content-level direction for Arabic while preserving the operator UI direction.
- Delivery states: pending, sent, delivered, read, failed, and unknown must remain distinguishable.
- A failed dispatch remains visible. Offer recovery only where the send contract can support it safely; avoid an automatic retry that may duplicate a delivered message.
- Load errors belong in the thread with Retry; retain the conversation list and other available data.
- Auto-scroll only when the reader is near the bottom or after their own send. Show a “New messages” affordance while reading earlier content.
- Do not automatically fetch every conversation detail to render a list: the existing detail read also marks messages read.

### 7.4 AI draft review

This is a core product surface and deserves stronger design than a colored callout with three small buttons.

- Place the pending draft above the composer with the label “AI draft · Needs review.”
- Keep unsent draft content visually distinct from sent history.
- Show creation time and only the rationale/metadata actually returned by the draft contract.
- Default actions: Reject, Edit, Approve & send. The final action is the primary button.
- Editing uses an explicit editor mode with Cancel and a clear “Save & send” action if the endpoint sends immediately.
- Preserve the original pending draft until the server confirms its resolution.
- Disable repeated submission while pending. Success must reconcile the message and draft states; failure preserves the content and displays an adjacent error.
- Changing conversations must never transfer the edited draft ID or input text to a different customer.
- If another operator resolves the draft, explain the conflict and refresh it. Do not promise safe concurrent resolution unless backend checks prove it.
- No single-key shortcut sends or approves messages.

### 7.5 Composer

- Standard reply field with visible send action and a short Ctrl/Cmd+Enter hint.
- Enter inserts a newline. Respect IME composition and paste.
- Approved replies move into a compact menu rather than a permanent horizontal strip of emoji chips.
- Keep customer text when sending fails. For failures returned as message delivery state, reconcile against that state rather than treating HTTP success as delivery success.
- Reserve a separate affordance for internal notes so a note cannot be mistaken for a customer reply. Reuse existing note contracts if exposed here.
- Preserve per-conversation unsent input in memory during navigation; clear sensitive drafts on logout.
- When switching away from an unsaved draft edit, preserve it or present an explicit discard decision.

### 7.6 Customer inspector

Use stacked sections and aligned definition rows instead of a card inside a card for every group:

1. **Status and summary:** canonical status, reason, summary if present.
2. **Next action:** existing `nextAction`/owner fields when available; omit empty ornament.
3. **Qualification:** service, intent, business activity, UAE location, emirate, timeline, language.
4. **Missing details:** plain checklist with meaningful labels.
5. **Consent:** contact permission and external-sharing permission, separately labeled.
6. **Partner:** actual assignment details or an assignment action with permission context.
7. **Notes:** existing internal notes, with loading/error/empty states.

Avoid declaring “profiling active” merely because the lead query returned no data. Loading, missing lead, disabled AI, and failed query are different conditions. Missing consent is not automatically a system error; explain the next step.

## 8. Screen-by-screen redesign

### 8.1 Leads

Keep the list as the default. It is already supported and suits comparison across customers. A Kanban board is a later option, not a prerequisite for looking like Linear.

- One toolbar: search, status, service, sorting, result scope, and refresh as a secondary action.
- Default columns: Customer, Service/intent, Status, Next action or missing details, Updated.
- Location and activity move into optional properties or the detail panel when space is constrained.
- Lead name is an actual focusable link/button; optional row click supplements it.
- Status is a compact icon/text property from a shared map.
- Replace multiple missing-detail chips with a short summary such as “2 details missing.”
- Drawer becomes a shared Sheet with summary, qualification, consent/partner, and notes sections.
- Lead editing initializes per record and protects dirty fields from background refetches.
- Save feedback sits beside Save, with validation errors at the relevant field.
- Opening a linked conversation preserves the lead return path and list filters.
- Keep all seven canonical statuses. Do not invent “Won” or “Lost” to fit a generic sales template.

Suggested status emphasis: neutral for needs clarification/exploring; warning for handover requested; success for ready for team/handed over; informational label for support; muted for outside scope/spam. Shape and text distinguish states sharing a color.

### 8.2 Overview

Rebuild it as an operational summary, with a compact metrics strip and useful tables rather than a wall of KPI cards.

- Preserve accurate existing counts, with labels matching their calculation. `activeConversations` currently counts all conversations: label it “Conversations” until the service filters active ones.
- Remove fixed growth/precision claims and unsupported comparisons. Do not add sparklines without time-series data.
- Present stage counts as “Lead stages,” not a measured conversion funnel.
- Treat the current review KPI cautiously: it adds lead and conversation counts and may double count. Do not relabel it “People waiting” or an exact work queue.
- Country distribution currently mixes emirates and service categories. Use a truthful generic grouping initially; split service/emirate breakdowns only after the contract is corrected.
- Existing recent activity is synthesized from updated leads. Label it “Recently updated leads,” rather than a comprehensive audit feed.
- Attention queues such as handover requests and pending drafts need explicit definitions, coverage, ordering, and valid destinations before display.
- Display “Updated …” from query freshness, plus a stale/retry indicator when refresh fails.
- A failed analytics request must not render a healthy row of zeros.

### 8.3 Partners

- Replace equal-weight profile cards with a compact directory list/table: partner, organization, sectors, languages, emirates, availability, verification.
- Preserve current sector/language/emirate filters and name/organization search.
- Use verification and availability as separate attributes; a verified partner can be unavailable.
- Replace comma-separated entry fields with clear multi-value inputs if the fixed taxonomies are known; avoid a large tagging framework.
- Add partner uses a shared form dialog with field errors and mutation feedback.
- Removal uses AlertDialog with partner identity and consequence. Do not add an Undo affordance without a restore contract.
- Assignment from Inbox explains why external-sharing permission is required and presents relevant candidates.
- Do not claim a matching score unless the API actually provides one.

### 8.4 AI & knowledge

Break the current long screen into focused sections/tabs:

| Section | Content | Constraints |
| --- | --- | --- |
| Knowledge | Searchable knowledge items, category, price if authorized for the operator, approval state | Approval is explicit; explain whether content can be quoted to customers |
| Providers | Provider list, model, default indicator, connection test, add/remove | Keep configuration details here, not in the everyday shell |
| Behavior | Concise explanation of existing conversation rules | Read-only unless persisted settings and authorized update endpoints exist |

Remove the permanent “Guardrails Enforced” badge unless a response establishes what was checked. Policy copy may describe configured rules without claiming live enforcement verification. Move lengthy protocol prose into contextual help.

Provider tests show results beside the tested row, including when the test ran. Secret fields use masked inputs and are never prepopulated with returned credentials. Price approval and provider default changes show pending/success/failure and rollback accurately.

### 8.5 Channels

- One compact row/section per supported channel, with account identity, actual connection status, and contextual actions.
- Connected, disconnected, expired/reconnect-required, loading, unknown, and failed status fetch are distinct presentations when supported by the response.
- Keep Instagram OAuth and the existing WhatsApp connection flow; redesign their presentation rather than replacing integration logic.
- Inline setup help follows the selected channel. Do not surround both channels with repeated technical explanations.
- Use shared accessible dialogs for credentials and disconnection.
- Display actionable errors in the affected channel section. OAuth callback success/failure must survive the return navigation.

### 8.6 Settings

The existing page is substantially a placeholder. Redesigning it must not make those placeholders look functional.

- Immediately show real session/workspace identity available from `useAuth`.
- Remove sample staff and inactive Save actions.
- Team management, retention changes, and audit logs require separate capability verification and likely API work.
- For release one, omit unavailable sections or provide a concise read-only explanation without fake values.
- A section is only editable once its persistence, validation, permissions, and error handling exist end to end.

### 8.7 Sign-in and initial loading

- Quiet dark page, simple Resider identity, 360–400px form, no glow or floating glass card.
- Heading “Sign in to Resider”; short supporting sentence only if useful.
- Empty work email, associated labels/IDs, `autocomplete="username"` and `autocomplete="current-password"`.
- Keep paste and password-manager support. Remove registration-style criteria badges from login; align any validation change with the backend auth contract.
- Show “Signing in…” instead of CPU latency claims.
- Preserve privacy/terms destinations and verify they open the intended pages.
- Authentication loading is a neutral loading state, not a performance benchmark.
- Unify title, metadata, favicon, and shell branding.

## 9. Responsive and accessible behavior

| Available viewport | Proposed behavior |
| --- | --- |
| 1440px and above | Full sidebar, conversation list, thread, inspector |
| 1200–1439px | Sidebar/list/thread; inspector opens on demand as an overlay or replaces a pane |
| 768–1199px | Compact navigation, list/thread where the thread retains useful width; details in Sheet |
| Below 768px | Sequential list → conversation → customer details, explicit Back, touch-sized controls |

Breakpoints are starting rules, not permission to squeeze content. At 1024px, reduce or remove panes if the message area cannot retain roughly 440px of useful width. Validate 390, 768, 1024, 1280, 1440, and 1920px, including a short laptop viewport and 200% zoom. At 320px equivalent reflow, preserve access to every core action.

Accessibility acceptance:

- Every primary journey works with keyboard alone.
- Dialogs trap focus, close with Escape where safe, label themselves, and restore focus to their trigger.
- Menus and list controls follow an intentional keyboard pattern; do not combine conflicting tab/listbox models.
- Icon-only controls have accessible names; tooltips do not substitute for labels.
- Visible 2px focus treatment with 2px offset, including on selected/dark surfaces.
- Use semantic headings, table headers, form associations, and current-page state.
- Destructive actions require AlertDialog; use truthful consequence copy.
- Errors are associated with fields/actions and announced appropriately; routine polling does not repeatedly announce the entire message history.
- No hover-only critical information or controls. Focus exposes equivalent actions.
- Respect reduced motion; do not add decorative animation. Skeletons can remain static.
- Test long names, unknown customers, long URLs, empty fields, Malayalam, Arabic, Hindi, emoji, and mixed-direction content.

Suggested shortcuts: Ctrl/Cmd+Enter sends from the composer; Escape closes the active transient surface; an optional Ctrl/Cmd+K menu may navigate existing destinations. Defer command menu implementation until the basic keyboard journey works. Shortcuts must not hijack typing or IME composition.

## 10. Technical implementation boundaries

### 10.1 Reuse and extract

Keep the existing UI foundation (`button`, `input`, `badge`, `card`, `skeleton`, `cn`, and CVA), but make their variants conform to the new system. Existing components are shadcn-style primitives; accessible dialogs/menu components are not currently installed, so their behavior needs an explicit implementation choice.

Suggested additions, only as consumed by real screens:

```text
src/components/ui/
  Dialog.tsx                 # accessible modal primitive
  AlertDialog.tsx            # destructive confirmation
  Sheet.tsx                  # shared customer/detail overlay
  Menu.tsx                   # compact contextual actions
  Tabs.tsx                   # AI/knowledge sections
  Tooltip.tsx                # optional explanatory metadata
src/components/layout/
  PageHeader.tsx             # one title/action contract
  PageToolbar.tsx            # responsive filter/action row
src/components/feedback/
  EmptyState.tsx
  ErrorState.tsx
src/components/inbox/
  ConversationList.tsx
  ConversationRow.tsx
  ConversationThread.tsx
  MessageItem.tsx
  DraftReview.tsx
  MessageComposer.tsx
  CustomerInspector.tsx
src/lib/
  leadPresentation.ts        # labels/icons/semantic emphasis
  formatDate.ts              # relative text + absolute accessible timestamp
```

New filenames follow the project standards; existing lowercase primitive files need not be renamed solely for aesthetics. A mature accessible primitive library is reasonable for focus management; document bundle/dependency tradeoffs before adoption. Do not write a modal framework or general data-grid engine.

### 10.2 State and correctness

- Keep server data in existing custom hooks and centralized query keys.
- Preserve optimistic sends, reconcile canonical message IDs/delivery state, and roll back failures without losing typed content.
- Scope edited lead forms and composer state by record identity; background refresh must not overwrite dirty edits.
- Use targeted cache updates/invalidation. Avoid new duplicate queries simply to support badges in the shell.
- Existing dashboard-level `useConversations()` polls even outside Inbox. Add active-view gating or a suitable summary strategy; do not claim current behavior already follows the standards.
- Reuse the visibility/focus setup in `queries/queryClient.ts`; prove polling stops when hidden rather than adding another global listener.
- Start by preserving existing refresh cadence where operationally necessary. Measure request count, then consolidate redundant list/draft polling without reducing freshness accidentally.
- No raw query fetching in presentation components and no effects solely for derived display values.
- Keep auth/session and tenant boundaries; a redesigned control must not imply a permission the server does not enforce.

### 10.3 Capability matrix

| Desired behavior | Existing support observed | Release-one decision |
| --- | --- | --- |
| Conversation/channel/search/takeover filtering | Hook and route exist | Redesign directly |
| Unread-only queue | Unread counts returned per loaded conversation; no unread route filter observed | Label loaded-result scope, or extend endpoint before claiming a complete queue |
| Review queue | `usePendingDrafts`, `/api/drafts/pending`; bounded repository result | Reuse for a bounded list; pagination/total required for complete queue semantics |
| Lead editing and internal notes | Hooks and routes exist | Reuse and improve form behavior |
| Partner assignment | Matching/assignment routes and hooks exist | Reuse; verify consent enforcement and failure copy |
| Global AI master control | No corresponding settings route observed in inspected route inventory | Remove hardcoded status; defer control until actual contract exists |
| Accurate total unread count | Shell currently sums a capped conversation result | Do not present that sum as an authoritative global total; add aggregate support if required |
| Message history pagination | Messages route accepts a limit; no older-message cursor observed | Preserve honest current scope; add cursor contract for complete history browsing |
| Conversation list pagination | Repository supports limit/offset internally, route does not expose them | Add validated API parameters/metadata if complete browsing is required |
| Team/retention/audit settings | Settings UI is placeholder; relevant routes not observed | Omit editable UI; independent backend feature work |
| Trend charts, SLA, revenue, AI accuracy | No supporting measured series/definitions observed | Defer; no invented charts or metrics |

Do not silently implement incomplete client filtering over the first page and call it a workspace-wide feature. Each promoted queue or count needs a defined source, scope, and refresh behavior.

## 11. Delivery phases and concrete tasks

Estimates assume one experienced frontend engineer, prompt design review, and a working local development environment. They are planning ranges, not commitments. Contract additions are separately estimated after inspection.

| Phase | Work | Deliverable and exit condition | Rough effort |
| --- | --- | --- | --- |
| 0 — Baseline | Run locally, capture screens, create representative fixture data, record API coverage and bundle/request baseline | Before captures at target sizes; state matrix; no customer data needed for fixtures | 0.5–1 day |
| 1 — Foundations | Finalize project design rules, Inter/fallback loading, tokens, primitives, accessible overlays | Component specimen with text contrast, focus, loading, error, and disabled states verified | 1.5–2.5 days |
| 2 — Shell/navigation | Rebuild AppShell/Sidebar/Header, URL state, responsive layout, brand cleanup | Direct links, reload, Back, account menu, and page scroll ownership work | 1–2 days |
| 3 — Inbox vertical slice | Split Inbox, implement list/thread/composer/review/inspector, per-conversation drafts, responsive flow | Receive → select → review/edit → send → handle failure → inspect customer works end to end | 3–5 days |
| 4 — Leads/partners | Compact lead list, shared detail Sheet, protected editing, partner list/forms | Update lead → open chat → check consent → assign partner works with truthful feedback | 2–3 days |
| 5 — Secondary screens | Honest Overview, AI tabs, Channels, Settings cleanup, Login | Every visible action works or is clearly unavailable; no sample operational data | 2–3 days |
| 6 — Final verification | Keyboard/mobile/multilingual/failure review, visual regression capture, build/type/test checks | Acceptance checklist passes; remaining contract-dependent features documented | 1–2 days |

Indicative total: approximately 11–19 engineer-days for the described frontend scope. It does not include building team administration, retention persistence, a full audit system, analytics event collection, or new messaging delivery guarantees.

### Phase 0 task details

- Create fixtures for a pending draft, human takeover, delivered message, failed message, missing qualification, complete qualification, consent missing/granted, unavailable partner, and disconnected channel.
- Capture current Login, Inbox, lead detail, Overview, Partners, AI, Channels, and Settings.
- Confirm what local setup can exercise without sending real Instagram/WhatsApp messages. Use mocked transport/fixtures for verification.
- Record current initial JS/CSS transfer, major render delays, and request counts over a fixed foreground/hidden-tab interval.
- Check root scripts against actual installed tools before claiming a lint gate exists; the package declares a lint command but does not declare ESLint in its devDependencies.

### Phase 1–2 task details

- Add the accepted design-system document; preserve `Design-SKILL.md` as reference.
- Update `index.css`, Tailwind semantic mappings, and `index.html` fonts/metadata.
- Change primitive variants before touching every screen so later work has a stable vocabulary.
- Build PageHeader/Toolbar and overlay primitives only when used.
- Rebuild shell scroll boundaries, full-width workspaces, and narrow reading pages.
- Replace tab state in `App.tsx` with navigable URL state and test legal-page handling.

### Phase 3 task details

- First complete one representative customer flow with new shell, list, thread, inspector, and send.
- Then add draft review/edit/reject states, delivery feedback, takeover states, and dirty-input preservation.
- Verify contract behavior for failed dispatch and draft conflict before presenting retry/recovery controls.
- Add compact and mobile layouts after the desktop flow is coherent; confirm the composer remains visible with the virtual keyboard.
- Remove obsolete wrappers and repeated styling after the new flow works.

### Phase 4–6 task details

- Reuse inspector sections in lead detail where their data/action semantics match; do not force one huge universal profile component.
- Migrate Partners, AI, Channels, Overview, Settings, and Login into the shared system.
- Review every badge and operational claim against its data source.
- Complete whole-journey verification and capture final screenshots with identical fixtures/viewports.

## 12. File-level change map

| Existing file | Planned change |
| --- | --- |
| `frontend/src/index.css` | Correct dark tokens, typography, focus, reduced-motion policy, scroll behavior |
| `frontend/tailwind.config.ts` | Semantic surfaces/status aliases, coherent geometry, remove unused decorative palette after migration |
| `frontend/index.html` | Resider metadata/favicon, Inter and fallback strategy |
| `frontend/src/App.tsx` | Addressable navigation, selected entities/filters, active-query lifecycle, plain auth loading |
| `components/layout/AppShell.tsx` | Full-height pane layout and separate reading-page mode |
| `components/layout/Sidebar.tsx` | Quiet grouped navigation, real identity, accurate count scope |
| `components/layout/Header.tsx` | Single title/action row; remove unsupported health/master claims |
| `components/ui/*` | Consistent control variants and accessible state treatment |
| `views/InboxView.tsx` | Thin orchestration composed from dedicated Inbox components |
| `views/LeadsView.tsx` | Compact table, useful filters, semantic row navigation, explicit query states |
| `components/leads/LeadDrawer.tsx` | Accessible Sheet, protected editing, shared customer presentation |
| `views/ExpertsView.tsx` | Partner directory and accessible create/remove flows |
| `views/AIAutomationView.tsx` | Knowledge/providers/behavior sections, local feedback, concise truthful copy |
| `views/IntegrationsView.tsx` | Factual channel rows, contextual setup/errors |
| `components/integrations/WhatsAppConnectModal.tsx` | Shared dialog behavior and readable setup form |
| `views/OverviewView.tsx` | Honest metrics, stage distribution, recent updates, no fake zeros |
| `views/SettingsView.tsx` | Real account data; remove placeholder people and inactive controls |
| `views/LoginView.tsx` | Plain sign-in, accessible fields, consistent branding |
| `hooks/useConversations.ts`, `useDrafts.ts`, `useLeads.ts` | Activity gating, scoped cache/state reconciliation where required by redesigned behavior |
| `worker/services/analyticsService.ts` | Separate bounded correction if metrics remain exposed; remove fabricated claims/estimates and fix label/data semantics |

Paths in the middle of the table are relative to `frontend/src/`. Add Worker/shared changes only for explicitly selected capability gaps; do not expand the redesign into a general backend cleanup.

## 13. Acceptance and verification

### Visual acceptance

- Inbox looks like a continuous workspace, with the thread as the primary region.
- At 1440px, all main panes fit; at 1280px the inspector collapses; at compact widths no essential control is stranded outside the viewport.
- No decorative page gradients, glass panels, sparkle branding, oversized shadows, or nested cards without a clear grouping purpose.
- One page title per screen. Essential labels remain readable at the specified minimum size.
- Status colors, button hierarchy, spacing, and form layout are consistent across all views.
- Every operational number/state has a truthful source and scope; missing data is not shown as zero/healthy.

### Journey acceptance

| Scenario | Required result |
| --- | --- |
| Select a conversation from Leads | Correct customer opens; Back restores the lead context |
| Type in customer A, switch to B, return | A's text is preserved only for A; B never inherits it |
| Edit an AI draft then change customer | Draft edit identity remains attached to the original conversation |
| Approve or modify/send draft | One user action produces one attempted dispatch; actual delivery and draft states reconcile |
| Request fails or dispatch returns failed status | Content survives; adjacent feedback explains what happened; no false sent state |
| Take over conversation | UI reflects actual server state and rolls back/explains failure |
| Update lead while refetch occurs | Dirty edits survive; successful save updates relevant views |
| Assign partner without sharing consent | Existing server rule is respected and explained; no fake success |
| Open direct URL, refresh, Back/Forward | Screen, useful filters, and selected record remain coherent |
| Hide browser tab or leave Inbox | Polling follows the defined lifecycle without redundant shell queries |
| Use Arabic/Malayalam/long content | Readable messages, stable controls, no clipping or destructive direction errors |
| Keyboard-only modal and navigation | Focus remains visible, contained where needed, and restored correctly |

### Implementation checks

Run after implementation, not as evidence that this plan is already implemented:

```powershell
npm run typecheck
npm run build
npm test
```

Use the existing test suite for regression coverage. Add focused behavioral tests for conversation/draft isolation, failure reconciliation, URL navigation, and dirty form protection. If browser interaction coverage is missing, add only the tooling needed for those meaningful journeys; do not create tests that merely mirror CSS classes.

Capture visual comparisons for the main states at the agreed viewports. Test keyboard, zoom, contrast, and multilingual content manually as well as with available automation. Compare bundle/request measurements to phase 0; explain material increases. Do not add virtualization, elaborate animation, or a chart library without measured need.

Proposed usability targets, to confirm after baseline measurement: find the next actionable conversation within 5 seconds; review and send a visible draft with one explicit approval action; open the customer profile without losing thread context. These are goals, not measured current results.

## 14. Release strategy and stop condition

Deliver coherent increments: foundations/shell first, then complete Inbox, then Leads/Partners, then secondary screens. Each increment uses the new shared tokens and remains runnable. Keep production deployment out of this planning task.

Use ordinary reviewable commits and a preview environment. A new runtime theme switch or feature-flag system is unnecessary for the redesign; rollback can use the previous verified build. Verify static asset and API compatibility if a selected contract change is introduced.

The redesign is complete when the full operator journey works across the agreed layouts, the state and accessibility checks pass, and every visible claim/action is supported. Optional Kanban, global command search, persisted saved views, SLA dashboards, detailed analytics, team management, and retention administration remain separate features.

**First implementation slice:** design tokens + navigation shell + one fully functional Inbox conversation, including draft review, human takeover, customer details, error handling, and mobile navigation. That slice must establish the quality standard before the same system is spread across the remaining screens.
