# Desktop interaction and sitewide risk audit — 19 November 2026

Branch: `feature/provider-independent-geocoding`

## Scope and verification limits

**Static code audit** of desktop Svelte routes and shared components, targeted
server-side access patterns, map integrations and existing CI. Reviewed native
selectors, custom suggestions, disclosures, navigation and key modals, plus
operational feed and chat fetching. This is **not** a live authenticated browser
session, cross-browser test, accessibility scan with a screen reader, AWS
penetration test or production load test. Where noted, a finding is a *risk*
rather than a reproduced user-facing failure.

## Dropdown inventory

| Location | Type | Expected behaviour | Result |
| --- | --- | --- | --- |
| Dispatch / animal species | Custom combobox | Outside pointer, Tab/focus leave, Escape, select option all dismiss | Code fixed; source regression; browser QA outstanding |
| Dispatch / AWS address lookup | Async suggestion list | Same as above; old request must not reopen list | Code fixed, request-generation guard; browser QA outstanding |
| Chats / `@` mentions | Async listbox | Outside pointer, Tab/focus leave, Escape, Enter/arrow selection; no stale reopen | Code fixed; browser QA outstanding |
| Chats / channel People | Popover-like panel | Outside pointer, Tab/focus leave, Escape | Code fixed; browser QA outstanding |
| Global account menu | Native `<details>` adapted as menu | Outside pointer, Tab/focus leave, Escape | Code fixed; browser QA outstanding |
| Administration / rescue, people navigation | Persistent disclosure-style navigation | Explicit toggle only; outside click should not destroy navigation context | Intentionally unchanged |
| Administration / rescue status, date, organisation, sort, staff, clinic | Native `<select>` | Browser-native keyboard/mouse dismissal | No custom focus trap found |
| Chats / organisation | Native `<select>` | Browser-native dismissal | No custom focus trap found |
| Settings / theme | Native `<select>` | Browser-native dismissal | No custom focus trap found |
| Care record / caller, treatment, outcome | Native `<select>` | Browser-native dismissal | No custom focus trap found |
| Veterinary portal / outcome | Native `<select>` | Browser-native dismissal | No custom focus trap found |
| Vet forms, admin diagnostics | HTML `<details>` disclosure | User explicitly expands/collapses; does not need outside dismissal | Intentionally unchanged |
| Legacy `User.svelte` | Melt UI menu | Not the active account menu in root layout | Excluded from live behaviour; confirm no residual imports during cleanup |

## Changes made during this audit

1. `AppTopbar.svelte`: account menu dismisses on focus departure as well as
   outside pointer and Escape.
2. `chats/+page.svelte`: mentions now invalidate pending/in-flight
   searches on dismissal and input changes. Both mention list and People panel
   dismiss by outside interaction, focus departure and Escape. Arrow-key
   navigation selects a highlighted mention without stealing textarea focus.
3. `DispatcherShell.svelte`: converted wrapper labels containing
   interactive option buttons into explicit `<label for>` elements inside
   field containers. This avoids implicit label activation and nested
   interactive-content problems while preserving styling.
4. Added source-level dropdown regression assertions to normal CI.
   
The earlier Dispatch Intake outside-click/Escape changes and native-selector
behaviour were retained.

## Outstanding issues and concerns (not silently considered fixed)

| Priority | Area | Evidence / risk | Recommended follow-up |
| --- | --- | --- | --- |
| P1 | Keyboard-modal accessibility | Feedback dialog initially focuses its close button, but has no focus trap or focus restoration. Administration portalled person/invite dialogs similarly do not establish explicit focus containment. Keyboard users can move into the underlying UI. | Add tested focus scope, focus return and inert background handling, without regressing close/Escape. Verify with NVDA/VoiceOver. |
| P1 | AWS geocoding cost and rate control | `/api/geocoding/search` checks dispatcher roles, but has no server-side per-user rate limiter. A client-side 260 ms debounce isn't an abuse or cost limit. Requests use billed Storage mode. | Add authenticated per-user throttling/quota and CloudWatch alarms; verify real API error rates and costs. |
| P1 | Map availability and integrity | Desktop maps import `maplibre-gl@6.18.0` directly from `unpkg.com`; both light/dark tiles depend on OpenFreeMap. An external outage or CSP restriction can blank maps, which are critical to rescue dispatch. | Bundle/pin the MapLibre npm package in SvelteKit, pin assets, monitor map availability, and provide a readable coordinates fallback. |
| P2 | Chat request volume | `chats/+page.svelte` refreshes channels/members and selected messages/member lists every 15 seconds, *and* subscribes to realtime changes. Redundant network/DynamoDB work scales with open chat tabs. | Measure per-user requests, pause on hidden tabs, and reduce polling when realtime is healthy. |
| P2 | Chat mention UX | The suggestion list now has keyboard highlight and dismissal, but no live end-to-end tests of screen readers, focus, race handling or a no-matches hint. | Add Playwright browser tests and verify VoiceOver/TalkBack announcements. |
| P2 | UI density / accessibility | Several controls and status labels use fixed 10–12px font sizes, and the theme contrast tests cover tokens rather than every state, hover, disabled control and map overlay. | Perform responsive 200% zoom, WCAG contrast and keyboard focus audits on both themes. |
| P2 | Production evidence | CI runs unit and compilation checks, not live authenticated browser flows, deployed IAM, AWS Places results or real notification delivery. | Add seeded non-sensitive E2E account, smoke tests in deployed demo, and monitoring dashboards. |
| P3 | Legacy component debt | Old Melt UI `User.svelte` and `Settings.svelte` coexist with the active `AppTopbar`, and have legacy theme assumptions. | Establish unused status via import/dependency graph and remove or modernise safely. |
| Deferred | React Native map | Expo still uses Mapbox map components by prior product decision. | Migrate after desktop polish, with separate regression suite. |

## Suggested browser acceptance pass

On desktop, test every custom menu with: mouse opening, outside pointer click,
Escape, Tab/Shift+Tab out, choosing an option, repeatedly opening/closing,
and dismissal during a slow/failed network response. Repeat at 200% zoom and
in both themes. Test account menu and Chats People with keyboard-only input.
Then verify major flows: Dispatch intake → assign → pickup, admin people/invite
and clinic management, Chats mentions, care history, release map, and the vet
portal. Test on the actual `demo` stage and confirm CloudWatch logs when AWS
Places is unreachable.

No SST deployment was performed as part of this audit.
