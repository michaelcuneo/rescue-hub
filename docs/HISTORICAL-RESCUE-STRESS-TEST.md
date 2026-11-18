# Rescue Hub historical rescue stress-test data

This is **synthetic test/demo data**, not real wildlife rescue records. It may only be written to explicitly selected SST `michael` or `demo` stages.

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

## Seed a local development or deployed demo stage

From the repository root with the latest branch pulled, first preview the
target stage without writing:

```bash
npx sst shell --stage michael -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage michael
```

To seed your **michael** stage:

```bash
npx sst shell --stage michael -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage michael --write
```

Type `SEED 208 michael` at the terminal confirmation prompt.

To seed the **deployed demonstration database** separately, using the same
code and AWS credentials with access to that stage:

```bash
npx sst shell --stage demo -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage demo --write
```

Type `SEED 208 demo` to confirm. **Seeding demo is a separate AWS database
write**, not a local preview; use only for a clearly synthetic demonstration
environment. No website deployment is required to insert records, but the
website must be deployed from this branch to use the updated Dispatch query.

The script inserts **200 historical records plus eight extra cases completed
on the NSW calendar day the script is run**. Of the eight current-day cases,
two are relocations, two return to the original rescue site, three are
euthanasias and one died in care. Each example's *report date* precedes its
*completion date*, explicitly exercising the historical-workflow filtering
regression. At midnight in NSW, yesterday's completed examples become history;
to populate the new day, run the script again. Date-specific IDs prevent
duplication.

Both stages are guarded: the SST link must match the explicitly requested
`michael` or `demo` stage and the table name must contain the stage.
`production` and other stages are rejected. The script is **dry-run by
default**, requires `--write` and an interactive typed confirmation, and
conditionally writes three linked DynamoDB records per case. Reruns skip
already-seeded records and never overwrite live ones. It does not run at
deploy/startup, and it does not delete any records.

**Important:** On `demo`, ensure the organisation-scoped dispatcher account
is viewing the fictional Hunter organisation (`native-animal-trust-fund`).
Historical records are visible through Administration → Rescues → Map; today's
eight cases show in Operations → Completed and on its map at the incident
coordinates. The other 200 completed records never pollute the live queue.

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
