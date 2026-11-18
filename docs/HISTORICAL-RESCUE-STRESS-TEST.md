# Rescue Hub historical rescue stress-test data

This is **synthetic test/demo data**, not real wildlife rescue records. It may only be written to explicitly selected SST `michael`, `michaelcuneo` or `demo` stages.

## Scope

The fixture generator creates **200 historical completed cases** spanning January 2024
through October 2026, across 30 approximate locations in the Hunter, Newcastle,
Lake Macquarie and surrounding NSW region. Report positions are deterministic
synthetic coordinates near those town centres, **not real rescue addresses**.

The fixed outcome mix is:

| Animal final outcome | Records |
| --- | ---: |
| Released at a different location (relocation) | 80 |
| Released at original rescue site | 80 |
| Euthanised after simulated veterinary assessment | 30 |
| Died in care | 10 |
| **Total** | **200** |

Each case includes its own original rescue record, a registered animal with
linked rescue index, and a permanent animal `FINAL_OUTCOME` event. Relocation
cases store a **distinct release GPS point**, and original-site releases
preserve the rescue coordinates. All are marked `demo: true` and
`historicalSeed: true`. Names and care notes are fictional.

## Seed all three environments

`michael`, `michaelcuneo` and `demo` are **separate AWS SST stages
with separate DynamoDB tables**. Checking out the same Git branch does not
copy data between environments.

From the repository root on `feature/maplibre-admin-map-poc`, use an
interactive terminal authenticated to the AWS account that owns all three
stages:

```bash
git pull --ff-only origin feature/maplibre-admin-map-poc
npm ci
npm run seed:all-demo-stages
```

The helper prompts for `SEED ALL 3`, then handles each stage in sequence:

1. `npx sst deploy --stage STAGE` applies the SST-managed directory and
   base Hunter fixtures: 45 fictional incidents, 10 demo volunteers,
   membership records, animal histories for 30 assigned/completed cases,
   and six additional pending mobile reptile incidents.
2. The historical seeder runs a dry-run summary.
3. The seeder runs with `--write --enrich`, asking separately for
   `ENRICH 208 michael`, `ENRICH 208 michaelcuneo` and
   `ENRICH 208 demo`.

The historical fixture set adds **200 deterministic completed cases** dated
2024–2026 and **eight cases completed today (NSW date)** to each stage.
Each case has its original injury location, a linked animal and outcome,
and synthetic GPS checkpoints representing physical pickup, arrival at a
fictional vet, optional care handover and wildlife release. Every checkpoint
is permanently marked `syntheticJourney: true`. These are illustrative
locations, not captured routes or verified private addresses.

If a case has already been seeded, `--enrich` conditionally adds missing
location events and latest-animal-position fields without replacing its
permanent rescue record, final outcome, or other users' data. Existing
fully enriched cases are skipped. Reruns never delete data.

For the historical records and movement checkpoints **only**, after the
SST-managed base data is already present, use:

```bash
npm run seed:all-demo-stages -- --seed-only
```

The current-day case IDs include the NSW date. Repeat the command on
another day to create the fresh set of eight; prior days remain archived.
Run all three on the same date to keep their present-day fixture sets aligned.

To preview one stage **without writing**:

```bash
npx sst shell --stage michaelcuneo -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage michaelcuneo
```

Replace `michaelcuneo` in both positions with `michael` or `demo` as
appropriate. The manual seeder is dry-run by default and validates the
selected SST stage and linked DynamoDB table, rejects production and all
other stages, and requires interactive confirmation before writes.

**Important:** The `demo` stage is deployed at
`rescue.michaelcuneo.com.au`; deploying the helper's default mode will
also redeploy its site and infrastructure. Use `--seed-only` if you do
not intend to deploy application changes. All three stages require
valid AWS credentials and permissions; committing to GitHub alone does
not seed the databases.

## Explore

Open **Administration → Rescues → Map → All rescues · any dates**. It uses the
cursor-based historical index, not the limited Operations snapshot. Rescue
locations are coloured by animal group; **purple pins** identify synthetic
relocation destinations. Clicking either rescue or relocation pin selects
the corresponding rescue's outcome details. Original-site releases don't
create a second marker at the same coordinate.

Under **Administration → Rescues → List**, choose **All statuses** and
**Any date**, search for `dev-historical-2026`, and hit **View pin**. The
map switches to the rescue's **original reported NSW date**, immediately
centres on the selected rescue and shows its details while the archive
request completes. It must not auto-fit to all other pins or lose the case.

Check historic date selection and multi-page map loading as well.
Operations intentionally shows **Completed only today** (NSW calendar date). The eight current-day examples make this tab testable; the 200 historical records remain in the archive.

## Test limitations

This is a read/query/render performance fixture, not a realistic legal or
clinical record audit. It does not simulate all veterinary authorisations,
species-specific relocation permits, rich clinical assessments, or full
rescue-custody handover chains. For production compliance, the complete
animal lifecycle must be recorded through the real authorised workflows.

Automated assertions run with `node --test
packages/core/historical-rescue-fixtures.test.mjs`.
