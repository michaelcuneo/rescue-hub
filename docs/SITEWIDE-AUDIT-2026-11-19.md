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

## P1 remediation — feature branch, 19 November 2026

All three P1 remediations have been **implemented in source**. The table above
remains the original audit snapshot; verification below supersedes its status.

1. **Keyboard modal focus:** New `lib/actions/modal-focus.ts` manages a
   top-of-stack focus trap, background `inert`, Escape, and focus restoration.
   Applied to Administration invite/person dialogs and the feedback modal.
   Preserves close-button and backdrop interactions. Browser/VoiceOver tests
   are still required for nested transitions and save-error flows.
2. **AWS Location cost and abuse control:** Conditional DynamoDB counters
   now enforce per-user minute/day and stage-wide day quotas for address
   search and uncached reverse geocoding. Paid upstream calls fail closed if
   the counter table cannot be reached. Search returns HTTP 429 with
   `Retry-After`; reverse lookups fall back to authoritative GPS.
   The demo SST stage provisions an account-level **USD 25/month** Amazon
   Location Service budget. Real email notifications require
   `RESCUE_LOCATION_BUDGET_ALERT_EMAIL` at deployment; without it the
   budget has no notification subscriber. The budget is a lagging alert,
   **not an automatic AWS spending cutoff**.
3. **Map availability:** All three desktop map components load
   `maplibre-gl@6.18.0` from a pinned npm package instead of unpkg.
   CSS is bundled with SvelteKit and the dependency lock is now complete
   and checked using `npm ci`. Initial or repeated map-tile failures
   switch to a local GPS-only background without discarding pins, boundaries
   or the release-pin UI. OpenFreeMap remains the primary external basemap
   provider, and a failover/uptime SLO still merits real browser tests.

The P1 hardening assertions are now part of CI. No live SST deploy, live AWS
budget notification, cross-browser test, or screen-reader acceptance has
occurred from this audit. Follow the budget setup in `docs/GEOCODING.md`,
then deploy only the intended stage and smoke-test all dialogs and maps.

## P2 remediation — 19 November 2026

1. **Chat network load:** The `/chats` page no longer polls all chat endpoints
   every 15 seconds while a realtime subscription is healthy. It uses
   coalesced realtime invalidation, a 120-second connected safety fallback,
   a 20-second disconnected backstop, and no background polling when the tab
   is hidden. It revalidates when visible again. Member-directory data has
   a 90-second freshness budget; per-channel people lists refresh when shown.
   The latest read acknowledgment is de-duplicated.
2. **Mentions:** The list now announces loading, result counts and no matches
   in a polite live region. Arrow keys select a result, Enter accepts it,
   Escape/outside focus dismisses it, and slow network responses cannot
   resurrect a dismissed list. Keyboard-only and screen-reader acceptance
   on real devices is **not** yet verified.
3. **Text, zoom, colour and motion:** Increased sub-13px text across desktop
   administration, chat, navigation, documentation and dispatch. Preserved
   real browser scrollbars at zoom, made narrow navigation horizontally
   scrollable, improved chat reflow at 200% zoom and honoured reduced-motion
   and Windows forced-colour preferences. Existing light/dark **palette
   tokens were not modified**. Source/contrast checks supplement—but do not
   replace—manual WCAG 2.2 evaluation at 200% and 400% zoom.
4. **Browser evidence:** Added an opt-in, read-only Chromium Playwright suite
   under `tests/browser` with desktop, mobile and narrow-window profiles
   (representing 200% desktop zoom). A `workflow_dispatch` GitHub workflow
   targets the **fake-data demo only**. Without explicit GitHub Actions demo
   credentials the authenticated scenarios are skipped; never infer success
   from a public-only smoke pass. No user messages, rescues or invitations
   are modified.
5. **Deployment monitoring:** Added a public, nonsensitive `/api/healthz`
   probe and a **demo-only** CloudWatch operations dashboard with Lambda
   errors, latency and DynamoDB throttling. Lambda error and geocoding
   cache throttle alarms publish to an SNS topic. To receive emails, set
   `RESCUE_MONITOR_ALERT_EMAIL` or `RESCUE_LOCATION_BUDGET_ALERT_EMAIL`
   in the demo SST deployment environment and confirm the SNS email
   subscription. CloudWatch dashboard/alarm services can add AWS charges.

**Remaining acceptance:** Execute the browser smoke manually after the demo
deploy, validate a **real** authenticated fake-data test account, verify
screen-reader announcements (VoiceOver/NVDA/TalkBack), test 200%/400% zoom
in both themes, validate alarm delivery and map failure simulation, and
review the CloudWatch dashboard for production-like workloads.

React Native Mapbox migration and legacy UI cleanup remain deferred
outside this desktop-focused P2 change.

## Demo map incident / temporary rollback — 19 November 2026

The live demo built from commit `8be63c4` was reported to have lost its
desktop map. The root cause could not be established from GitHub CI: there
is no authenticated browser console or map network trace available. A likely
risk was the P1 map fallback which replaced the real basemap with an empty
GPS-only style after initial or repeated errors; the same change also altered
how the MapLibre module and CSS were loaded.

**Immediate corrective action:** Restore the three desktop map components
and root layout to their pre-P1 map-bundling implementation at `e50999e`.
This returns the previously used pinned external MapLibre 6.18.0 JS/CSS loader
and original OpenFreeMap styles, leaving all unrelated P1/P2 code intact.
The pinned npm dependency remains installed but is not used by these map
components until a browser-verified bundling migration can be completed.

**Unresolved:** This is a rollback of the P1 map-resilience change, not a
verified root-cause fix. CDN/tiles remain an availability dependency. Before
reintroducing any fallback, test the demo in a real browser, especially
network loss, partially failing tiles, worker/CSP errors and both themes.
Never switch to an empty basemap on a single tile error. Confirm the
operational, historical, and release maps visually after deploying the
corrective commit. Do not claim the map is restored until live verification.
