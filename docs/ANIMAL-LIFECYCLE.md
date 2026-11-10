# Rescue Hub: Animal-centred operating model (authoritative)

**Status:** Product requirement confirmed by project owner, 10 November 2026. This document supersedes conflicting descriptions of manual dispatch, simple rescue closure, or treating a transfer as a final outcome.

## Non-negotiable product intent

Rescue Hub tracks **each animal continuously** from first report, through self-selected rescue, transport, veterinary treatment, custody transfers, potentially months of rehabilitation, and final disposition. The essential operational question is: **Where is each animal, who is responsible for it now, what has happened, and what happens next?**

**Rescuers choose jobs they can perform.** Routine rescue allocation is **not** manually dispatched by an administrator. Eligible rescuers see and receive relevant available jobs and claim them themselves. Administrative intervention is exceptional, not the default workflow.

A rescue response ending is **not** the same as an animal record ending. Dropping an animal at a vet, handing it to a carer, or completing transport must not close or erase the animal's ongoing record. Some animals remain in care for a long time.

## Canonical end-to-end journey

1. Intake: record incident, reporter details where needed, species/uncertainty, injury, hazards, geographic position and responsible organisation.
2. Offer: publish to eligible available rescuers; do not presume a human dispatcher chooses the responder.
3. Claim: eligible rescuer self-claims; server must atomically reject competing claims, audit claimant/time and update other clients.
4. Response: track en route, arrival, animal found/not found, collection, and transport.
5. Custody: transfer animal to vet, carer or another approved custodian; preserve location, recipient, handover/acceptance, time and prior custody chain.
6. Care: record veterinary assessments, treatment, medication, weight, feeding, observations, photos, review dates, and subsequent transfers as applicable. Keep the animal active for weeks/months if necessary.
7. Outcome: explicitly record release (including release location/date), euthanasia (with appropriate authorisation/performer), natural death, or other approved final disposition. Do not infer final outcome from a transport or handover.
8. Oversight: organisations and authorised governing bodies can reconstruct the full history and identify animals currently in care, their current custodians, outstanding handovers, overdue reviews and final outcomes.

## Claim release and active-worklist rules (10 November 2026)

- A rescuer can **release an uncollected claim** from Manage Animals & Care History. This puts the incident back in the eligible volunteer queue. Release is conditional and audited, and cannot orphan an already registered animal.
- After animal registration, changing plans requires **acknowledged custody handover**, not an unclaim. Until the recipient accepts, the current custodian remains responsible and the case stays in their active list.
- A **carer handover** changes the animal's current custodian to the accepting carer and moves it into care. Once none of the incident's animals remains in the original rescuer's custody, it leaves the original rescuer's active worklist. The receiving carer sees their active care regardless of who claimed the original rescue.
- Dropping an animal at a **veterinary clinic** does **not** end the rescue. The animal remains attached to the current responsible person as **At vet · being assessed**; once the assessment is recorded it becomes **Assessed · awaiting transport**. The case remains visible until custody is properly transferred or a final outcome is recorded.
- **Transport** is a separate handover purpose from permanent care. An accepted transport handover sets the animal to IN_TRANSIT, not IN_CARE. Eligible transport volunteers include those with an active transport team or rescuer/carer capacity; the sender is not released until acceptance.
- The mobile map and list are **active operational worklists**, not complete historical records. Historical custody and care events persist even when an animal leaves a former volunteer's active queue. An organisation-level history interface is required for retrospective access.

## Separate domain objects

- **RescueIncident / RescueCase:** the initial report, response, geographic/organisation authority, claimant and response milestones. One incident may involve multiple animals.
- **Animal:** permanent unique identifier, incident link, species/description and relevant identifiers, current life/care status, current location/custodian, and final disposition if any.
- **CustodyTransfer:** animal ID, from/to person or facility, requested/accepted/declined times, origin/destination, responsible organisations, and audit information. An unaccepted handover must not silently change authoritative custody.
- **AnimalEvent / CareRecord:** append-only chronological observations, care/treatment events, medical notes, attachments, location changes, and milestones, attributed to actors and timestamps.
- **Outcome:** explicit terminal disposition and required details; outcome must not be conflated with a completed rescue response.

The current code's simple PENDING / ASSIGNED / COMPLETED rescue status and single assignedUserId are **insufficient** to represent long-term animal custody and care. Extend the data model rather than overloading those fields. Avoid destructive migration of existing demonstration records.

## Invariants for implementations and AI agents

1. No default manual dispatch: the primary operation is an eligible rescuer's **Claim Rescue**.
2. Claim is conditional/atomic, tenant-authorised and idempotent where appropriate; two rescuers must not both win.
3. Distinguish **response status**, **animal care status**, **custody state**, and **final outcome**.
4. An animal has an authoritative current custodian and last-known location (including unknown/not yet confirmed); maintain a full immutable custody history.
5. Veterinary drop-off and transfer to a carer are **handoffs**, not automatic case/animal closure.
6. Track multiple animals under one incident independently; their care and outcomes may diverge.
7. Preserve organisation/jurisdiction isolation, permitted cross-organisation transfers, role-based access, privacy of carers' home addresses, and auditability.
8. Notify appropriate rescuers without notifying unavailable/ineligible users; failures must be observable and retryable.
9. Support long-running care, pending acceptance, overdue reviews and reporting, not only a queue of open rescue jobs.
10. Design backend contracts for both SvelteKit desktop and React Native iOS/Android; do not make mobile depend on desktop-only state.
11. Avoid claiming that unimplemented workflows are already working. Tests must cover claim contention, transfer acknowledgement, multi-animal incidents, long-term care, privacy, and final outcome.

## Example (illustrative)

A reported injured kangaroo is claimed by a qualified rescuer, collected, taken to a vet, then handed to a wildlife carer. The **rescue response** may be finished, but the **animal** remains IN_CARE, with the carer as current custodian. Weeks later it may move to another carer. Months later its release or death is recorded. Every transition, location and responsible person remains traceable.

## Implementation order

1. Correct rescue claim API and UI to self-claim, including atomic contention protection.
2. Introduce incident/animal/event/custody/outcome persistence with migration strategy.
3. Add custody transfer acknowledgement and current-location views.
4. Add long-term care records and review tracking.
5. Expose consistent authenticated APIs to React Native; implement mobile claim, progress, handover and care screens.
6. Add oversight/reporting and end-to-end tests; validate with rescue organisations and DCCEEW.

## Related docs

Read this first, then [PRODUCT.md](PRODUCT.md), [RESCUE-WORKFLOW.md](RESCUE-WORKFLOW.md), [AUTHORIZATION.md](AUTHORIZATION.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [ROADMAP.md](ROADMAP.md). Where older text says routine dispatcher assignment or closure at handover, **this document takes precedence** until those documents are reconciled.
