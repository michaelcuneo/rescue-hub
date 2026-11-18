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
