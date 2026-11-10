# Public wildlife reporting — Rescue Hub

## Purpose

Anyone can create a standalone **public reporter** account without belonging to a rescue organisation. Public reporters are **not** carers, rescuers, dispatchers or transport volunteers. Their only operational ability is to place a pin and report an animal they believe is injured.

The app retains reporter-submitted observations as unverified facts, but automatically creates an operational rescue when GPS resolves one verified responsible organisation. A citizen's species identification and description are *unverified*; the public form explicitly says not to handle wildlife, especially snakes and bats.

## Entry points

- Web: `/join` (email/password or configured social sign-in), `/report` (authenticated map reporter)
- Mobile: Sign in → **Create a public reporter account**; verify email, then a reporter-only map and form; authenticated social providers also appear if configured
- Existing organisation invitation and login are unchanged
- Reporter cases are stored as `PUBLIC_REPORT#<uuid>`; index `PUBLIC_REPORTS` supports central triage and `REPORTER#<id>` supports account-own history
- `/reports` is central exception triage, distinct from the ordinary rescue queue
- GPS-matched reports automatically create pending rescues with stable IDs and qualified-rescuer notifications; triage retries exceptional failures
- Accounts with `PUBLIC_REPORTER` are redirected from the dispatcher dashboard and cannot subscribe to internal rescue feeds, claim rescues, change availability or receive responder push notifications

## Social sign-in setup

All three social providers use *server-side* OAuth code exchange and identity verification. No credentials are copied to the Expo app, and no provider account is automatically granted organisation membership.

SST passes these **server-only** variables through to the deployed SvelteKit Lambda. Supply the appropriate values to the environment running `sst deploy --stage demo`:

| Provider | Server-side variables |
| --- | --- |
| Google | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` |
| Apple | `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` |
| Facebook | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |

Configure the provider application with these exact callback URLs:

- Google: `https://rescue.michaelcuneo.com.au/auth/social/google/callback`
- Apple Service ID return URL: `https://rescue.michaelcuneo.com.au/auth/social/apple/callback` (domain `rescue.michaelcuneo.com.au`)
- Facebook Valid OAuth Redirect URI: `https://rescue.michaelcuneo.com.au/auth/social/facebook/callback`

Apple uses a Services ID, Team ID, key ID and the associated `.p8` private key. Store the private key securely; provide newline escapes as `\\n` if deploying from a single-line environment value. **Do not commit secrets, tokens or private keys to Git.**

Only fully configured providers appear on the signup screens. Without any provider credentials, **verified email/password signup still works**. Social sign-in must be smoke-tested with live provider configurations; code checks are not a provider login test.

### Native social sessions

The native app uses `expo-web-browser` with the installed custom `rescuehub://auth` URL scheme. It generates a fresh PKCE challenge for every login; the server stores it in a one-time OAuth state (10-minute expiry). The callback returns a **90-second one-use handoff code** to the app, never the session token. The app exchanges that code together with the PKCE verifier over HTTPS, then stores the session token in SecureStore.

On-device social sign-in requires an installed iOS/Android development or production build; Expo Go is not sufficient for the custom-scheme authentication test. To rebuild native dependencies use the compatible Expo 58 packages and Xcode or EAS.

## Security & routing boundaries

- Public reporter profile: only `PUBLIC_REPORTER`, no organisation ID or membership/team permissions.
- Email accounts require a six-digit verification code before reporting. Passwords are scrypt-hashed.
- Social identity: provider token/code validated on the server and matched to a stable provider user ID. Existing accounts sharing the same email are **not** automatically linked to a social account, which prevents takeover.
- The public API limits reports to one submission per user per minute and validates map coordinates and text length.
- Reporters can retrieve only **their own** submitted reports. Location-bearing central triage is limited to platform/authority users (and explicitly activated platform demo context), not arbitrary organisations. No automatic boundary-guessing or mass volunteer notification occurs at the public intake stage.
- No dispatcher chooses an organisation. The backend revalidates GPS ownership at conversion and never trusts a client-supplied organisation ID.
- No images, personal contact numbers, precise reporter location collection beyond the **incident pin**, or background device location tracking are required by this first public reporting flow.
- Consider WAF/CAPTCHA, SES reputation and abuse analytics before publicly advertising self-registration.


## GPS-first routing and reporter contact (11 November 2026)

**Responsible organisation is derived server-side from the incident map pin; no dispatcher chooses an organisation.** The backend evaluates the committed NSW DCCEEW polygon/multipolygon boundary snapshot, honours holes, prefers a single licensed local operating area over the general WIRES layer, and refuses ambiguous overlaps or uncovered areas. An unverified citizen species guess is never used to pick an organisation.

- Normal flow: verified reporter submits → GPS resolves one active directory organisation → a deterministic operational rescue ID is created → volunteer self-claim queue and qualified-rescuer notifications update. This requires no central dispatcher approval.
- Exceptions: no coverage, overlapping local organisations, inaccessible boundaries, missing directory record or dispatch failure leave the original public report in central triage. Coordinators can **retry GPS routing**, but cannot override geographic authority by submitting an organisation ID.
- The original report (including the reporter's initial animal description) is retained. A custodian or authorised coordinator can correct a registered animal's species/identifying details; the edit uses a version-checked transaction and records an append-only before/after audit event.
- The reporter can separately opt into secure in-app messages and phone calls. Both default to **off**. Reporter phone numbers are only retrieved by the currently assigned eligible rescuer if explicitly permitted. Messaging is restricted to the reporter and current assigned rescuer, with a 10-second send throttle and no public case browsing.
- Mobile uses the same authenticated JSON APIs as the web. In-app conversations refresh every 15 seconds; they are not currently push-notified and are not guaranteed to deliver urgent messages.

**Important:** This routing model currently covers the supplied NSW snapshot, not all Australian jurisdictions. Boundary overlaps involving specialist organisations and stale boundary source data still require policy validation with the relevant authority; do not claim full national dispatch. The committed snapshot is a simplified geometry intended for demonstration and must be verified against licensed source boundaries before production use.

### Validation

The new `packages/core/operating-area-routing.test.mjs` covers valid local routing, overlapping areas, holes, multipolygons, uncovered locations and unserviced polygons. GitHub Actions also runs mobile TypeScript, warning-free Svelte diagnostics and the SvelteKit build. Live AWS behaviour, SES delivery, third-party OAuth and actual push notification delivery require separate smoke testing after deployment.

## Manual end-to-end test

1. Deploy the latest demo stage to AWS and verify `PUBLIC_MAPBOX_ACCESS_TOKEN` and SES sender are configured.
2. Visit `/join`; register an unfamiliar email, verify the six-digit code, and confirm `/report` loads instead of the dispatcher dashboard.
3. Tap the map, describe a **fictional** injured blue-tongue, submit. Verify a receipt reference and no rescue claim controls.
4. Verify the report automatically becomes a pending rescue for the matched operating area without selecting an organisation. Check `/reports` for exceptional failures and use **Retry GPS dispatch** only when appropriate.
5. Attempt reporter access to `/api/mobile/rescues`, `/api/realtime`, `/api/dispatch/reports`, and rescue claim endpoints; verify they reject access.
6. Install a native build, verify mobile public email signup and reporting, and test Google/Apple/Facebook **individually** after the provider credentials are configured.
