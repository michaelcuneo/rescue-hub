# Technical Architecture

## Current direction

Rescue Hub uses an SST-native AWS architecture.

```text
PC Rescues (SvelteKit) ─┐
                        ├── SST linked resources
Admin (SvelteKit) ──────┘
             |
             v
        AppSync GraphQL
             |
             v
          DynamoDB
```

The former Amplify backend has been removed.

## Applications

### PC Rescues

Path:

`packages/pc-rescues`

Purpose:

- dispatcher workstation;
- rescue map;
- intake;
- regional rescue queue;
- assignment;
- rescuer/carer operations;
- availability-aware operational workflow.

### Admin

Path:

`packages/admin`

Purpose:

- governing-authority oversight;
- cross-organisation reporting;
- organisation/region administration;
- audit and outcome visibility;
- system configuration appropriate to governing roles.

The Admin application is not intended to bypass backend authorisation. It receives broader data only because the authenticated role is authorised for broader scope.

## Infrastructure

### DynamoDB

Defined in:

`packages/infra/data.ts`

The table uses a single-table structure with:

- `pk`
- `sk`
- `gsi1pk`
- `gsi1sk`
- `gsi2pk`
- `gsi2sk`

This mirrors the established SST pattern used in CiteThat.social.

The current rescue-only schema is an initial implementation. The table will expand to represent authorities, organisations, regions, memberships, availability, rescue events and outcomes.

### AppSync

Defined in:

`packages/infra/api.ts`

GraphQL schema:

`packages/core/schema.graphql`

SST exposes a linked resource:

`RescueHubGraphQL`

Server-side SvelteKit code accesses it through:

```ts
import { Resource } from "sst";

Resource.RescueHubGraphQL.url;
Resource.RescueHubGraphQL.apiKey;
```

The API key is a server-side application credential in the current prototype. It must not be exposed to browser code.

As authentication is implemented, protected operations should authorise the user identity and tenancy context rather than treating possession of the application API key as end-user permission.

## Server boundary

Browser components should not talk directly to privileged AppSync operations using a shared API key.

The expected path is:

```text
browser
  -> SvelteKit server route/action
  -> authenticated user + tenant/role check
  -> server GraphQL client
  -> AppSync
  -> DynamoDB
```

This also gives Rescue Hub a clean place to integrate government APIs later.

## Data model direction

The backend should evolve around these primary entities:

- Authority
- Organisation
- Region
- User
- Membership
- Availability
- Rescue
- RescueAssignment
- RescueEvent
- AnimalOutcome
- AuditEvent

The Rescue entity should contain the current state required for fast reads.

RescueEvent/AuditEvent should preserve historical state transitions.

## Geographic data

Organisation coverage requires polygon/multipolygon geometry.

DynamoDB can remain the system of record for organisation and case data, but point-in-polygon lookup should be treated as a deliberate capability.

Initial options include:

- storing simplified GeoJSON with application-side point-in-polygon evaluation where the number of regions is small;
- maintaining a spatial lookup/index appropriate to national scale;
- using an AWS geospatial/location service where beneficial.

Do not encode regional authority only as a human-readable organisation name on the rescue.

## Authentication

The former Amplify Cognito definition has intentionally not been carried forward merely for parity.

Authentication should be added as an SST-owned capability that supports the tenancy model in `AUTHORIZATION.md`.

Requirements include:

- secure user identity;
- organisation memberships;
- governing-authority memberships;
- role claims/lookup;
- server-side authorisation;
- invitation/onboarding;
- revocation;
- session management.

The final identity provider can be selected independently of AppSync/DynamoDB.

## Realtime

AppSync subscriptions should be used for operational events where possible.

Likely subscriptions include:

- new rescue for organisation/region;
- rescue assignment changed;
- rescue status changed;
- rescue location corrected;
- availability/dispatcher events only where operationally necessary.

Subscription authorisation must respect tenant and jurisdiction boundaries.

## External government integration

Government-system integration belongs behind a server adapter.

Suggested boundary:

```text
Rescue Hub domain
      |
GovernmentIntegration interface
      |
NSW DCCEEW / Biodiversity and Heritage Regulator adapter (and equivalent adapters for other jurisdictions)
```

The product should own its internal canonical model and translate to/from external schemas.

This prevents a third-party API from dictating the Rescue Hub UI or making the whole service unavailable during an upstream outage.

## Infrastructure rule

Infrastructure belongs in SST.

Do not reintroduce a parallel Amplify backend or generated Amplify outputs for the same resources.


## NSW regulatory authority model

For NSW, do not model NPWS as an Australia-wide national authority.

The current hierarchy relevant to wildlife rehabilitation is better represented conceptually as:

```text
NSW Government
    |
DCCEEW
    |
Biodiversity and Heritage Regulator / Wildlife Team
    |
Licensed wildlife rehabilitation organisations
    |
Authorised rehabilitators
```

NSW NPWS is also part of DCCEEW and has wildlife responsibilities, but its name does not indicate federal jurisdiction.

This distinction matters to the data model: `Authority` must be jurisdictional and capable of representing separate state/territory regulators in a future Australia-wide deployment.
