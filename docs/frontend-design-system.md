# Resider frontend design system

Implemented foundation, 21 October 2026. This is the project-specific interpretation of `Design-SKILL.md`; the reference file remains unchanged.

## Tokens

CSS source of truth: `frontend/src/index.css`. Values use HSL custom properties. Existing `background`, `card`, `primary`, `secondary`, `muted`, and related aliases remain supported while screens migrate.

| Role | HEX | Tailwind token |
| --- | --- | --- |
| Canvas | #080A0A | `surface-base` / `background` |
| Navigation | #0D0F10 | `surface-sidebar` |
| Panel | #111416 | `surface-panel` / `card` |
| Overlay | #191D20 | `surface-raised` / `popover` |
| Hover | #202529 | `surface-hover` / `accent` |
| Selection | #272D33 | `surface-selected` |
| Primary text | #ECEEF0 | `content-primary` / `foreground` |
| Supporting text | #AFB6BE | `content-secondary` / `secondary-foreground` |
| Metadata | #8C969F | `content-muted` / `muted-foreground` |
| Structural border | #2A3035 | `border` |
| Interactive boundary | #68737D | `input` |
| Primary action/focus | #7C88F8 | `primary` / `ring` |
| Success | #79C9A0 | `success` |
| Attention | #E5BD76 | `warning` |
| Failure | #F08D96 | `danger` / `destructive` |

Primary and destructive filled buttons use the canvas color for text. Text on neutral selections stays foreground/secondary text: do not put small primary-colored text on `surface-selected`, where the contrast is below 4.5:1.

Use structural borders for visual grouping and interactive boundaries for inputs/outlined controls. Color alone never names a status. Brand/channel badge aliases remain for compatibility but are now neutral; their text identifies the channel.

## Typography and geometry

- Latin UI: Inter, weights 400/500/600. The font stack includes Noto Sans Malayalam, Arabic, and Devanagari, followed by system fonts.
- Google Fonts uses `display=swap`, matching the existing external-font delivery approach. Fonts are not bundled into the production JS/CSS measurements.
- Body: 14px with 1.5 line height. Controls: 13px/20px. Supporting metadata: 12px/16px. View heading: 20px/28px.
- No default letter-spacing override.
- Spacing follows 4px steps. Controls use 6px corners; cards/overlays use 8px.
- Base controls are 36px; compact controls 32px; sign-in controls 44px.
- Components have no decorative motion, scale feedback, gradient fills, or shadows by default. Existing unmigrated views can still explicitly request old effects; remove those as their screen is migrated.
- Skeleton is static and decorative (`aria-hidden`); consumers must provide their own meaningful loading state.

## Interaction contract

- Focus-visible: 2px accent outline, offset 2px. Never substitute a tooltip for an accessible label.
- Native disabled controls retain a not-allowed cursor and 50% opacity. Consumers must disable pending mutation actions.
- Input supports `aria-invalid` with an error border; associate actual error text using `aria-describedby`.
- Sign-in uses associated labels, username/current-password autocomplete, native required-field validation, an alert for server failures, and a busy form state.
- The server owns credential validation, including first-login password requirements; login does not enforce registration criteria on existing accounts.
- `Dialog.tsx` wraps the browser's native modal dialog: inert background, native focus containment, Escape handling, and explicit focus restoration. The alert variant confirms history deletion; edge-aligned variants serve navigation/customer details. Chrome checks verified Escape and trigger-focus restoration. ErrorState provides query feedback. General menus/tabs remain for their later screen consumers; native selects currently handle filters and approved replies.

## Verified contrast samples

Computed from the specified sRGB colors using relative luminance:

| Pair | Ratio |
| --- | --- |
| Primary text / canvas | 17.06:1 |
| Supporting text / panel | 9.03:1 |
| Metadata / raised surface | 5.64:1 |
| Metadata / selected surface | 4.62:1 |
| Dark text / primary action | 6.36:1 |
| Input boundary / raised surface | 3.50:1 |
| Input boundary / hover surface | 3.19:1 |
| Danger text / panel | 7.89:1 |

These samples are not a claim of whole-application accessibility conformance. View overrides and opacity blends must be checked during each screen migration.
