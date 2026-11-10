# Public wildlife reporting — Rescue Hub

## Purpose

Anyone can create a standalone **public reporter** account without belonging to a rescue organisation. Public reporters are **not** carers, rescuers, dispatchers or transport volunteers. Their only operational ability is to place a pin and report an animal they believe is injured.

The app keeps reporter-submitted observations separate from operational rescues until a central dispatcher reviews and accepts them. A citizen's species identification and description are *unverified*; the public form explicitly says not to handle wildlife, especially snakes and bats.

## Entry points

- Web: `/join` (email/password or configured social sign-in), `/report` (authenticated map reporter)
- Mobile: Sign in → **Create a public reporter account**; verify email, then a reporter-only map and form; authenticated social providers also appear if configured
- Existing organisation invitation and login are unchanged
- Reporter cases are stored as `PUBLIC_REPORT#<uuid>`; index `PUBLIC_REPORTS` supports central triage and `REPORTER#<id>` supports account-own history
- `/reports` is central dispatch triage, distinct from the ordinary rescue queue
- Central triage can **Accept and dispatch**, creating a pending rescue with a stable ID and then sending qualified-user notifications
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
- A central dispatcher manually chooses the operational organisation by its active context when converting a report. For a national rollout, implement and validate a jurisdiction/operating-area routing service before delegating the national queue to individual organisations.
- No images, personal contact numbers, precise reporter location collection beyond the **incident pin**, or background device location tracking are required by this first public reporting flow.
- Consider WAF/CAPTCHA, SES reputation and abuse analytics before publicly advertising self-registration.

## Manual end-to-end test

1. Deploy the latest demo stage to AWS and verify `PUBLIC_MAPBOX_ACCESS_TOKEN` and SES sender are configured.
2. Visit `/join`; register an unfamiliar email, verify the six-digit code, and confirm `/report` loads instead of the dispatcher dashboard.
3. Tap the map, describe a **fictional** injured blue-tongue, submit. Verify a receipt reference and no rescue claim controls.
4. Sign in as a central administrator and open `/reports`. Inspect the report, select **Accept and dispatch**, then verify a new pending rescue appears in the organisation's dispatcher map and qualified rescuer's mobile map via subscriptions.
5. Attempt reporter access to `/api/mobile/rescues`, `/api/realtime`, `/api/dispatch/reports`, and rescue claim endpoints; verify they reject access.
6. Install a native build, verify mobile public email signup and reporting, and test Google/Apple/Facebook **individually** after the provider credentials are configured.
