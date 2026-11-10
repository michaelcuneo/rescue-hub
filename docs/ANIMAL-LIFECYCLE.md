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

## Telephone updates, veterinary callback and transport queue (11 November 2026)

**Telephone notes belong to the permanent animal history.** Dispatch/coordinators record the caller's name and role (vet, rescuer, carer or public reporter), their unverified statement, recording user and timestamp, and an optional callback number **only with explicit permission**. The caller does not need a Rescue Hub account. Telephone notes are not automatically treated as clinical findings.

When an animal is registered and marked **At Vet**, dispatch may record a call saying that the animal is ready for collection. By selecting **offer transport** and a verified veterinary pickup address/coordinates, dispatch creates a separate pending transport rescue linked to the existing permanent animal, source incident and phone event. Qualified available volunteers receive the new offer and **claim it themselves**. Dispatch never assigns the responder. The pickup pin must be at the veterinary facility, not the initial injury scene.

The carer reservation and new transport job do not move the animal or change its current physical custodian when claimed. After the volunteer physically collects the animal and confirms pickup, the animal custody changes to the collecting volunteer in the same conditional database transaction; the transport pickup pin disappears. The volunteer then arranges an acknowledged handover to a carer. On successful handover, the linked transport job closes in the same transaction; an otherwise completed handover cancels an obsolete transport offer. Only one outstanding transport offer per animal is allowed. Volunteers can read linked history after claiming, but cannot register a duplicate animal for the transport job.

Pre-registration telephone updates still need their own provisional intake/animal model: this implementation records permanent **animal-level** telephone updates only after animal registration. Do not claim that callbacks for unclaimed, unregistered sightings are supported by this form.

## Confirmed physical collection, AREC updates and historical outcomes (11 November 2026)

This is the canonical demonstration lifecycle:

1. A person reports an injured animal. The responsible organisation receives a `PENDING` incident and a visible map pin.
2. An eligible rescuer **self-claims**. It becomes `ASSIGNED` but remains on the map until collection. Claiming never means that the animal was collected.
3. On physically collecting the animal, the rescuer presses **Animal picked up**. An atomic event records the collector and collection time and removes the job pin from both operational maps. The case and any registered animal record remain available internally.
4. The rescuer registers the animal if not yet registered, logs transportation and veterinary drop-off (e.g. AREC) in its permanent care timeline. The animal is `AT_VET` but has **no active location pin** because nobody needs an initial pickup response.
5. If AREC calls later to report euthanasia or death, dispatch logs the vet's identity, actual words and source as a permanent `PHONE_UPDATE` and `FINAL_OUTCOME`. The animal becomes `EUTHANISED` or `DECEASED`, any pending pickup job is cancelled, and the incident is completed when every linked animal has a terminal outcome. No record is deleted.
6. Alternatively, if AREC reports the animal is ready for care, dispatch records the phone call and offers a **new transport pickup job** with the *vet's GPS coordinates*. That job has a new visible map pin linked to the existing animal, never a new animal identity.
7. A qualified transport volunteer self-claims that pickup. The pin stays visible until the volunteer **physically collects the animal**; collection atomically assigns the linked animal's custody to the volunteer, logs transport and removes the pickup pin.
8. The volunteer transports the animal to its carer. The receiving carer acknowledges custody, putting the animal in `IN_CARE` and completing the linked transport job. Subsequent treatment and notes continue under the same animal ID. Eventually the carer records `RELEASED`, `EUTHANISED` or `DECEASED` as appropriate; that care is complete.

**Separation of concerns:** map visibility belongs to a particular job; current care status, custodian, outcome and chronological history belong to the permanent animal. Historical records, including phone-source attribution and custody transitions, remain stored in DynamoDB for organisation oversight and future NPWS reporting. A department-specific report template, data retention agreement and official submission format must be confirmed with NPWS before describing the export as compliant.

**Multiple animals:** one incident may have many registered animals. One terminal outcome never closes a sibling still in care; the parent job closes only when every registered animal has a final disposition.

## Carer self-claims with independent volunteer transport (11 November 2026)

The person who **accepts responsibility for long-term care** and the person who **transports** an animal are two separate volunteers. A carer does not have to drive to the clinic, and no dispatcher assigns either person.

When a vet reports that a registered animal at the clinic is ready for care, dispatch enters the permanent animal telephone update with a verified clinic pickup location and marks the animal as available. The system creates a care offer for active carers in the organisation and a linked pickup job held in `awaitingCarer` state. The transport job is not yet visible or claimable on operational maps.

A carer opens **Care offers** on the Expo app, selects the animal, and chooses **Transport to me** with one of: current foreground GPS location, searched workplace address, or another searched address. The server conditionally writes the care reservation, animal audit event, and **private** delivery coordinates, removes the open care offer, and unlocks the pickup job. Two carers cannot both win a claim. Care reservation does not change physical custody at the vet.

An available, authorised organisation volunteer can now self-claim the **transport** job, regardless of species-specific rescue team. This includes membership type `transport-volunteer`, as well as active rescuers and carers. Public reporters and unaffiliated members of the public cannot claim transport. Only the actual assigned transporter, nominated carer, and authorised organisation coordinators may view the carer's private delivery details. Pickup map pins contain only the **veterinary clinic** location, never a carer's home or workplace.

The transporter confirms **physical collection** at the clinic, which records the animal's new custodian and hides the transport pickup pin. The transporter delivers it to the reserved carer and records a custody-transfer request. The carer acknowledges custody on physical receipt, and the same animal record then becomes `IN_CARE`. Its later release or final outcome remains attached to the original animal ID and preserved for NPWS historical reporting.

The carer may explicitly refresh their current GPS delivery position **before pickup**, but the app does not continuously track them. After the animal has been physically collected, address changes require coordination rather than silent rerouting. The assigned transporter can refresh delivery instructions before departure.

### Validation and limitations

Tests cover delivery mode and GPS validation, role-independent transport eligibility, one-carer reservation policy, and map hiding while waiting for a carer. CI also checks mobile TypeScript, strict Svelte diagnostics and the production web bundle. Transactional AWS integration, physical-device GPS/map search, delivery handover, Expo push delivery, and NPWS reporting exports require live testing. Existing users need appropriate `CARER` role or `transport-volunteer` membership to see these flows.

## Claim release and active-worklist rules (10 November 2026)

- A rescuer can **release an uncollected claim** from Manage Animals & Care History. This puts the incident back in the eligible volunteer queue. Release is conditional and audited, and cannot orphan an already registered animal.
- After animal registration, changing plans requires **acknowledged custody handover**, not an unclaim. Until the recipient accepts, the current custodian remains responsible and the case stays in their active list.
- A **carer handover** changes the animal's current custodian to the accepting carer and moves it into care. Once none of the incident's animals remains in the original rescuer's custody, it leaves the original rescuer's active worklist. The receiving carer sees their active care regardless of who claimed the original rescue.
- Dropping an animal at a **veterinary clinic** does **not** end its permanent record. The animal remains attached to a responsible custodian as **At vet · being assessed**. It is **off the public/volunteer operational map** after physical collection, although authorised carers and coordinators can still retrieve its history. Any later veterinary collection request creates a new map job.
- **Transport** is a separate handover purpose from permanent care. An accepted transport handover sets the animal to IN_TRANSIT, not IN_CARE. Eligible transport volunteers include those with an active transport team or rescuer/carer capacity; the sender is not released until acceptance.
- The desktop and mobile **maps show only uncollected, actionable jobs**, not all animals in care. Pending jobs and claimed-but-not-yet-collected jobs have pins; once the assigned rescuer explicitly confirms physical pickup the job disappears from both maps. The mobile worklist and permanent animal records remain accessible to authorised custodians and coordinators. Completed and cancelled jobs never have operational pins.

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
