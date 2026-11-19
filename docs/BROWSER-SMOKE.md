# Browser smoke and accessibility verification

A manually dispatched GitHub Actions workflow lives at
`.github/workflows/browser-smoke.yml`. It uses Chromium / Playwright to
check the **fake-data demo only**, and is never started on a normal push or
on production. Public sign-in and documentation tests run without credentials.

For authenticated read-only smoke tests, set repository Actions secrets
`RESCUE_E2E_EMAIL` and `RESCUE_E2E_PASSWORD` to an approved fake-data
demo account with dispatch/admin permissions. The tests intentionally
**do not submit messages, invite people, or modify rescues**.
Missing credentials skip authenticated scenarios; a successful public-only
run is not evidence that the private workflows passed.

The workflow covers desktop, a narrow viewport simulating 200% desktop zoom,
and mobile widths. Actual visual scaling, keyboard-only VoiceOver/NVDA
testing, real phones and reduced-motion checks still need manual acceptance.
Never use personal login secrets in commit history or project files.
