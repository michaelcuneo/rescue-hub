# Implementation Roadmap

This roadmap records the intended next steps after the SvelteKit/SST modernisation.

It is ordered around operational value rather than attempting to build every enterprise feature at once.

## Phase 1 — Domain and tenancy foundation

Build the real multi-tenant data model.

Add:

- Authority;
- Organisation;
- Region;
- User;
- Membership;
- roles;
- one-active-rescue-organisation-per-user constraint;
- explicit organisation transfer/change-of-membership workflow;
- Rescue ownership by authority/organisation/region;
- server-side authorisation primitives.

Acceptance criteria:

- an organisation user cannot read another organisation's private cases;
- a user cannot hold active operational memberships in two rescue organisations simultaneously;
- an authorised governing user can view all participating organisations in its jurisdiction;
- every rescue has explicit tenant and geographic ownership.

## Phase 2 — Dispatcher intake

Turn the current PC map into the primary dispatch workstation.

Build:

- address/location search;
- click/drop/drag rescue pin;
- region lookup;
- fast rescue intake form;
- rescue creation;
- live pending-rescue map;
- rescue detail panel.

Acceptance criteria:

- a dispatcher can take a call and create a mapped rescue rapidly;
- the backend rejects or redirects an out-of-region rescue appropriately;
- the rescue appears to other authorised users without manual refresh.

## Phase 3 — Rescuer availability and assignment

Build:

- user availability schedule;
- temporary unavailable/holiday periods;
- on-duty toggle;
- eligible-rescuer calculation;
- targeted notifications;
- claim/accept operation;
- dispatcher assignment;
- atomic assignment protection.

Acceptance criteria:

- unavailable users do not receive ordinary rescue notifications;
- two users cannot successfully claim the same rescue;
- assignment changes appear in real time.

## Phase 4 — Rescue lifecycle and animal outcome

Build:

- rescue event history;
- progress events;
- outcome model;
- transfer/care records;
- release;
- mortality;
- euthanasia details;
- closure and reopening where authorised;
- immutable audit trail.

Acceptance criteria:

- a completed rescue has an explicit outcome;
- euthanasia can record who performed/authorised it as required;
- the governing view can reconstruct the important history of a case.

## Phase 5 — Governing-authority portal

Expand the Admin application.

Build:

- organisation directory;
- region management;
- cross-organisation rescue search;
- map and reporting across the jurisdiction;
- case/audit inspection;
- aggregate rescue/outcome statistics;
- policy/configuration management where appropriate.

Acceptance criteria:

- governing users can inspect all authorised organisations without breaking organisation tenant isolation;
- organisation users cannot gain equivalent access through client manipulation.

## Phase 6 — Government integration

After demonstrating and validating the product:

- identify the relevant existing government service/API;
- document authentication and data-contract requirements;
- build a server-side integration adapter;
- add retry/idempotency;
- map internal and external identifiers;
- add sync status/audit information.

Acceptance criteria:

- Rescue Hub continues operating during an upstream outage;
- synchronisation can be retried safely;
- users can see whether a record has synchronised successfully.

## Phase 7 — National expansion

Generalise authority boundaries beyond the initial NSW DCCEEW/Biodiversity and Heritage Regulator model.

Build:

- multiple state/territory authorities;
- authority-specific integration adapters;
- jurisdiction-aware policy/configuration;
- national aggregate reporting only for explicitly authorised roles.

The product should not require a fork or separate deployment for every rescue organisation.

## Open implementation decisions

These require explicit decisions during development:

- identity/auth provider and invitation flow;
- mapping/geocoding provider;
- national-scale spatial region lookup strategy;
- notification channels (push/SMS/email/in-app);
- carer qualification/species constraints;
- reporter personal-data retention rules;
- government data-retention requirements;
- offline/poor-connectivity behaviour;
- formal cross-organisation rescue handoff;
- exact external NSW DCCEEW/Biodiversity and Heritage Regulator system/API contract for the NSW implementation.
