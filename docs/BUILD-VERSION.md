# Build version displayed in Settings

The desktop web application's **Settings → Application version** section
shows the version number from `packages/pc-rescues/package.json`, the exact
Git commit compiled into the current build, the Git branch (when available)
and the time the bundle was generated (UTC).

- The commit links to `michaelcuneo/rescue-hub` on GitHub.
- `packages/pc-rescues/vite.config.ts` captures metadata during the Vite
  build and substitutes it into the SvelteKit server bundle. The deployed
  Lambda does not need `git` or a GitHub token at request time.
- Git SHA is read from `RESCUE_HUB_GIT_SHA`, `GITHUB_SHA`, or
  `git rev-parse HEAD` in that order. Only a valid full SHA is linked.
  An unresolved SHA is shown as **Not recorded**, never silently replaced
  with the current remote HEAD.
- Branch comes from `RESCUE_HUB_GIT_BRANCH`, GitHub Actions branch environment,
  or the checked-out branch, when available. Branch is informational; the
  full commit identifies the exact source revision.
- The timestamp is **build time**, not the time someone pushed to GitHub.
- The settings view reads the snapshot from the application build, not a
  live request to GitHub. A push does not change an already deployed version.

Use `npm run check --workspace=website` and
`npm run build --workspace=website` to verify the SvelteKit build.
You can inspect `/settings` after deployment. The current build version
is `0.0.1` until the website package version is explicitly changed.
Different SST stages may have different revisions while deployments are
underway. This metadata does not change any stage configuration or
run any deployment/seeding commands.
