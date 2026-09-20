# Rescue Lifecycle and Dispatch Workflow

## Objective

The primary workflow begins with a phone call and should produce an actionable rescue on the regional map in seconds.

## 1. Intake

A dispatcher receives a report from a member of the public.

Minimum useful intake:

- animal/species or best available description;
- address or map location;
- condition/injury notes;
- reporter contact information when operationally required;
- immediate hazards or access notes.

The initial form should allow uncertainty. A caller may not know the exact species, age, sex or injury.

Those fields can be refined later.

## 2. Locate

The dispatcher searches for an address, landmark or location and places a map pin.

The UI should make it easy to:

- search;
- click the map;
- drag/correct the pin;
- see the resolved address;
- see which rescue region/organisation owns that point.

If the point falls outside the dispatcher's authorised region, the system should clearly identify the responsible area rather than silently creating a local rescue.

## 3. Create rescue

On submission, the backend creates the canonical Rescue record.

The initial state is normally:

`PENDING`

Creation records:

- rescue ID;
- responsible authority;
- responsible organisation;
- region;
- coordinates;
- address/location description;
- animal details;
- incident condition;
- dispatcher;
- creation time;
- caller information where retained;
- audit event.

## 4. Broadcast

The new rescue becomes visible in real time to the appropriate organisation.

Eligible, currently available rescuers can be notified.

The map pin is an operational object, not merely a visual marker. Selecting it should expose the rescue details and actions the current user is authorised to perform.

## 5. Accept / assign

A rescuer may claim a pending rescue, or a dispatcher may assign it.

The backend must arbitrate assignment so two rescuers cannot independently believe they have accepted the same rescue.

Once accepted:

`PENDING -> ASSIGNED`

The assignment records:

- assigned user;
- assignment time;
- assignment method (claimed/dispatcher assigned);
- actor;
- audit event.

Other clients should receive the change immediately.

## 6. Rescue progress

The case should be able to record operational milestones without forcing a complex workflow on every incident.

Likely events include:

- accepted;
- en route;
- arrived;
- animal located;
- animal not located;
- collected;
- transferred;
- admitted to care;
- veterinary assessment;
- released;
- euthanised;
- deceased before collection;
- deceased in care;
- cancelled/duplicate.

The final status enum can remain compact while detailed lifecycle events live in a separate event history.

## 7. Outcome

Every completed case should have an outcome.

Important outcome information includes:

- animal disposition;
- date/time;
- person/organisation responsible;
- transfer destination where relevant;
- release information where relevant;
- mortality;
- euthanasia;
- euthanasia performer/authoriser where required;
- notes and supporting records where appropriate.

A completed rescue should not lose its earlier operational history.

## 8. Close

A rescue can become:

`COMPLETED`

or, for invalid/withdrawn work:

`CANCELLED`

Closing a rescue creates a final audit event.

Records should remain available according to regulatory and organisational retention requirements.

## Realtime behaviour

Realtime updates are required for operationally important changes such as:

- newly created rescue;
- assignment;
- status;
- cancellation;
- meaningful location correction.

The intended experience is dispatch-like: a user should not have to manually refresh the map to discover that a rescue has appeared or has already been claimed.

AppSync subscriptions are the natural fit for this in the current SST architecture.

## Availability and notification flow

A new rescue should trigger an eligibility calculation.

Conceptually:

```text
rescue location
  -> responsible region
  -> responsible organisation
  -> active rescuers
  -> users currently available
  -> future qualification/species constraints
  -> notification targets
```

Being able to view the organisation's map does not necessarily mean the user should receive every notification.

## Geographic handoff

Normal operation keeps a case within its responsible organisation.

If inter-organisation transfer is added later, it should be explicit:

1. request transfer;
2. nominate receiving organisation;
3. verify geographic/operational authority;
4. accept transfer;
5. preserve original organisation and transfer history;
6. change current ownership;
7. notify relevant users.

A rescue must never appear to have always belonged to the receiving organisation when it was originally created elsewhere.
