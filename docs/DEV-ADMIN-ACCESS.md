# Development administrator access

If you are using a newly created SST stage, visit
`http://localhost:3000/setup` to create its first platform administrator.
The regular login page redirects to this first-run setup when the stage has
not been initialised.

If the stage has already been initialised and you do not have a working
administrator credential, use the guarded development bootstrap CLI:

```sh
npx sst shell --stage YOUR_DEV_STAGE -- node packages/pc-rescues/scripts/create-dev-admin.mjs --stage YOUR_DEV_STAGE
```

The stage flag must match the SST stage in both positions; use your **own
local development stage** and never `demo`, `prod` or `production`.
The script also checks the linked DynamoDB table's name before modifying it.

By default, the created account is:

- Name: Development Administrator
- Email: `dev-admin@rescuehub.example`
- Role: `PLATFORM_ADMIN`

To specify a personal testing email, append `--email address@example.com`.
The CLI asks you to type `CREATE YOUR_DEV_STAGE` to confirm the exact target,
then generates a strong password and prints it to your local terminal only.
It uses the application's original scrypt credential format, atomically
creates the email lookup, user profile and password rows, and initialises
the stage if there is no existing bootstrap marker.

If the same email belongs to a development account created by this
script, running it again requires an explicit `RESET YOUR_DEV_STAGE`
confirmation and rotates that account's password. **It refuses to overwrite
ordinary or production-created user accounts.** This is a CLI tool, not a
web endpoint or a bypass of application authentication.

Never commit or paste the generated password into a source file, terminal
recording, pull request or issue. Sign in at
`http://localhost:3000/login` after successful creation.

This script **does not** run automatically and does not create an account on
GitHub. It writes only to the explicitly linked SST stage when the developer
runs it with their own AWS credentials.

## Operations with a bootstrap development administrator

A development administrator created by the guarded CLI is a
`PLATFORM_ADMIN` without an actual organisation membership. This is
intentional: platform-level oversight is not the same as field membership.

When running the **local Vite/SST development server**, the account now opens
**Operations** in the existing **Hunter demonstration organisation context**
(`native-animal-trust-fund`) rather than redirecting straight to Admin.
The Operations queue and API remain organisation-scoped; this does **not**
permit cross-organisation operational browsing. The fallback requires the
server-verified `devBootstrap` account marker, `PLATFORM_ADMIN` and
`dev === true`. It is not enabled in production or deployed demo builds.

For real organisation staff or a deployed environment, choose/enter an
explicit operating organisation. The existing `/demo/hunter` context switch
remains available to an authorised platform administrator.


## Existing platform administrators without organisation membership

An existing `PLATFORM_ADMIN` or `AUTHORITY_ADMIN` may legitimately have
no member organisation. The root Operations loader must **not** silently
pick an organisation or automatically widen permissions: the existing root
guard is intentional.

Instead, the top **Operations** link for an unaffiliated platform/authority
administrator leads to the already-authorised `/demo/hunter` route, which
explicitly sets the limited Hunter demo context and redirects to
`/`. This also works for a normal administrator who was **not** created
by the special development bootstrap script. Organisation members retain
a normal `/` link. The link uses a full navigation so the cookie is set
before the Operations page loads.

The demo endpoint already verifies platform/authority permission; this
change does not grant cross-organisation browsing or alter any DynamoDB
account, invitation, or rescue data. The actual database records remain
isolated by SST stage. Real organisations still require appropriate
membership and server-side authorisation before field operations.
