# Rescue Hub historical rescue stress-test data

This is **synthetic development data**, not real wildlife rescue records.

## Scope

The fixture generator creates **200 completed cases** spanning January 2024
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

## Run on Halide, dev stage only

From the repository root with the new branch pulled:

```bash
# Inspect the planned write; performs no DynamoDB modification:
npx sst shell --stage dev -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage dev

# Create records, after entering SEED 200 dev:
npx sst shell --stage dev -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage dev --write
```

The script refuses other SST stages, verifies the linked table belongs to
`dev`, and prompts before writing. It conditionally creates exactly
three records per case in a DynamoDB transaction. It skips its own existing
seed IDs on rerun; **it never overwrites existing user/live records**. If a
non-seed record occupies any deterministic rescue ID, it stops with an error.
There is no automatic startup/deploy side effect or removal command.

Rerunning `--write` will report skipped records instead of duplicating them.
No seed has been run from GitHub; you must run it from your own AWS environment.

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
The Operations map intentionally shows **Completed only today**; this
historic dataset does not populate its active rescue queue.

## Test limitations

This is a read/query/render performance fixture, not a realistic legal or
clinical record audit. It does not simulate all veterinary authorisations,
species-specific relocation permits, rich clinical assessments, or full
rescue-custody handover chains. For production compliance, the complete
animal lifecycle must be recorded through the real authorised workflows.

Automated assertions run with `node --test
packages/core/historical-rescue-fixtures.test.mjs`.
