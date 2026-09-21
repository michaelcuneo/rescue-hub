# Tenancy, Roles and Authorisation

## Authorisation model

Rescue Hub is a hierarchical multi-tenant system.

Access is determined by a combination of:

- governing jurisdiction;
- organisation membership;
- role;
- rescue ownership;
- geographic coverage;
- availability where dispatch/notification is concerned.

Every API operation that reads or mutates protected data must enforce these rules server-side.

## Core entities

### Authority

Represents the government or governing wildlife authority for a jurisdiction.

For the NSW implementation, the authority model should represent NSW DCCEEW's Biodiversity and Heritage Regulator / Wildlife Team as the regulatory layer. NSW NPWS is part of the same department but is not an Australia-wide authority. Other states and territories require their own authority records and regulatory mappings.

An Authority owns or governs one or more Organisations.

Suggested fields:

- `id`
- `name`
- `jurisdiction`
- `status`
- `policyVersion`

### Organisation

Represents an independent wildlife rescue organisation.

Suggested fields:

- `id`
- `authorityId`
- `name`
- `code`
- `status`
- `contact details`
- `coverageRegionIds`

An organisation is a tenant boundary.

### Region

Represents an authorised geographic coverage area.

The production model should support polygon/multipolygon geometry, not just a centre point and radius.

Suggested fields:

- `id`
- `authorityId`
- `organisationId`
- `name`
- `geometry`
- `effectiveFrom`
- `effectiveTo`
- `status`

Historical region definitions should be retainable so an old rescue remains interpretable if boundaries later change.

### User

Represents a person with access to the platform.

An operational wildlife rescue user may have only one active rescue-organisation membership at a time. A person who is an active member of Hunter Wildlife Rescue cannot simultaneously be an active member of WIRES, and vice versa. Government/regulator access is modelled separately as authority access and does not count as a second rescue-organisation membership.

### Membership

Connects a user to exactly one active rescue organisation and grants operational roles. Authority/government access is represented separately so regulator users are not treated as members of a rescue organisation.

Suggested roles:

#### Platform administrator

Technical platform administration only.

This role should not automatically imply operational permission to read every rescue record.

#### Governing authority administrator

Can view and administer organisations and rescue records within the authority's jurisdiction.

#### Governing authority viewer/auditor

Read-oriented oversight of organisations and rescue history.

#### Organisation administrator

Manages organisation users, local settings and operational configuration.

#### Dispatcher

Creates rescue incidents, updates dispatch information and coordinates assignments for the organisation.

#### Rescuer/carer

Receives eligible rescue work, accepts assignments and records rescue progress/outcomes appropriate to their permissions.

A person may hold more than one role inside their single active rescue organisation, but may not hold active operational memberships in multiple rescue organisations.

## Visibility rules

### Organisation user

By default an organisation-scoped user can access:

- their organisation;
- their organisation's authorised regions;
- rescue cases owned by their organisation;
- users/members necessary for dispatch;
- their own availability and profile;
- organisation configuration their role permits.

They must not be able to enumerate another organisation's private rescue or user records simply by changing an identifier in a request.

The backend must also reject any attempt to create a second active rescue-organisation membership for the same user. Moving from one rescue organisation to another must be an explicit transfer/change-of-membership workflow that closes the previous active membership first.

### Governing authority user

A governing-authority role can access organisations and cases inside its own jurisdiction according to role.

For NSW, this jurisdiction is state-based. A future national Rescue Hub deployment may aggregate multiple state/territory authorities, but authority-level access in one jurisdiction must not automatically imply equivalent access in another.

### Rescue location

When a rescue is created, its coordinates must be resolved against active coverage geometry.

The responsible organisation should be derived/validated by the backend.

A client-provided `organisationId` is not sufficient proof that an organisation owns a location.

## Availability

Availability is a dispatch rule, not an authorisation role.

A rescuer can remain authorised to use Rescue Hub while being unavailable for new work.

Suggested model:

- recurring weekly availability;
- one-off availability overrides;
- holiday/unavailable date ranges;
- manual on-duty/off-duty status;
- timezone.

The notification system should calculate effective availability at the time of dispatch.

## Notifications

A new rescue should only notify a user when all required conditions are met, including:

- the user is an active member;
- the user has a relevant rescuer/carer role;
- the rescue belongs to the user's organisation or an explicitly authorised cooperative workflow;
- the user is currently available;
- any future qualification/species constraints are satisfied.

Notification eligibility must be calculated on the backend.

## Audit

Material actions should create immutable audit events.

Examples:

- rescue created;
- location changed;
- organisation ownership changed;
- rescue accepted;
- assignment changed;
- rescue status changed;
- animal outcome recorded;
- euthanasia recorded;
- significant details corrected;
- case closed/reopened;
- administrative override.

An audit event should contain at least:

- actor;
- timestamp;
- action;
- entity;
- previous values where appropriate;
- new values where appropriate;
- organisation/authority context;
- reason for privileged overrides where required.

## Security rule

The frontend is not a security boundary.

The PC and Admin applications can present different interfaces, but AppSync/server operations must independently verify the actor's authority for every protected operation.


## Identity architecture

Rescue Hub uses one Amazon Cognito User Pool as the shared credential authority for the web application and future native mobile clients.

Separate Cognito application clients are created for:

- Rescue Hub Web (SvelteKit);
- Rescue Hub Mobile (future React Native iOS/Android).

Cognito owns authentication concerns such as credentials, password reset and account enable/disable state.

Rescue Hub's own data model remains authoritative for:

- rescue-organisation membership;
- the one-active-rescue-organisation-per-user constraint;
- organisation roles;
- authority/regulator roles;
- availability;
- operational permissions;
- audit history.

An identity existing in Cognito does not grant access to an organisation by itself.

Organisation administrators will manage only users in their own tenant. Governing-authority administrators may have wider jurisdictional visibility according to their authority role.

Administrative user actions such as invitation, disable/enable, password reset, membership changes and removal must create audit events before production use.

Bulk email and mobile push broadcasts must be organisation/authority scoped, permission checked, queued and auditable. The future React Native clients should register device installations against the same Rescue Hub user identity rather than creating a second mobile-only account system.
