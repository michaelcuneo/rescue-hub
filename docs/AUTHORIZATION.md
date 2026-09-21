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

Rescue Hub owns its authentication model and does not depend on Amazon Cognito or another hosted identity directory.

The authentication design follows the same portable pattern used by the project's other SST applications:

- users, credentials, organisation membership and sessions are stored in the Rescue Hub data store;
- passwords are salted and hashed with Node.js scrypt;
- browser sessions use random opaque tokens in HTTP-only cookies;
- only the SHA-256 hash of a session token is stored server-side;
- native clients may use the same opaque session token as a Bearer token;
- session records have expiry/TTL;
- each user profile has an auth epoch, allowing password changes, disable operations and removals to invalidate existing sessions;
- invitation and password-reset codes are short lived, stored as hashes and rate limited;
- email delivery is an adapter. The current AWS deployment uses SES, but authentication data and credential semantics are not tied to SES or AWS.

Authentication and authorisation remain separate concerns.

A valid Rescue Hub identity does not grant access to any rescue organisation by itself. Organisation membership and roles are stored in the application data model and are enforced server-side.

The same identity is intended to work across:

- the SvelteKit web application;
- the future React Native iOS application;
- the future React Native Android application.

Web clients receive secure session cookies. Native clients use the same login/activation/reset endpoints and receive an opaque session token suitable for secure device storage.

### Initial deployment

A new deployment exposes a one-time setup flow only while the auth bootstrap record does not exist. The first user created by this flow becomes the platform administrator. The bootstrap record is written transactionally with that account and prevents the setup process from being repeated.

### Organisation invitations

Organisation administrators invite users rather than allowing unrestricted public registration.

An invitation creates:

- the Rescue Hub user record;
- the unique email lookup;
- exactly one pending organisation membership;
- the selected organisation role or roles;
- a short-lived activation code.

The invited person activates the account by supplying the code and choosing their own password. The membership then becomes active.

This preserves the rule that an operational user can belong to only one wildlife rescue organisation at a time.

### Administrative account actions

Authorised administrators can:

- invite users;
- enable or disable accounts;
- send password-reset codes;
- remove operational access.

Disabling, password changes and removals invalidate previous sessions by changing the user's auth epoch.

Organisation administrators may manage only users within their own organisation. Authority/platform administrators can be granted wider management scope.

### Email and notification portability

The current AWS deployment may use Amazon SES to send invitation and password-reset codes, but SES is a delivery implementation rather than an identity provider.

Future bulk email and mobile push notification services must remain organisation/authority scoped, queued and auditable. Mobile device registrations will attach to the same Rescue Hub user identity rather than creating a separate mobile account system.
