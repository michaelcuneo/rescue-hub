# Organisation members: independent permissions and qualifications

Rescue Hub separates the following administrative decisions:

1. **System permissions** (`roles[]`): any combination of authorised
   RESCUER, CARER, DISPATCHER, ORG_ADMIN and other administrative roles.
   These grant software access, not evidence of wildlife accreditation.
2. **Species training / teams** (`teamIds[]`): multiple verified species or
   specialist areas. None is selected by default; species rescue offers
   require the explicit `RESCUER` permission **and** matching training.
3. **Transport authorisation** (`canTransport`): a separate Boolean,
   explicitly assigned by an administrator. Defaults to false. Members
   without cars can still be carers, rescuers, or committee members.
   Authorised transport-only volunteers do **not** need a rescuer or
   carer access role.
4. **Organisation positions** (`positionIds[]`): committee and management
   titles such as President, Secretary, Treasurer or Raptor Leader. These
   are descriptive directory labels and never grant access or training.

**Nothing is preselected on a new invitation.** Even a role or membership
without matching training does not qualify the person for a species rescue.

## Existing members

Operational Membership has been retired from invitations, member editing and
rescue eligibility. Historical `membershipTypeId` fields are tolerated for
compatibility but no longer grant or block rescue or transport permissions.
When an administrator saves an existing member, that legacy field is cleared.
Do not convert a legacy membership into an automatic RESCUER, CARER or
transport permission; review and assign each independently.

The transport permission uses a fail-closed migration policy: old profiles
without `canTransport: true` are **not** silently assumed to have a car or
transport authorisation. An administrator must review existing members and
tick **Can transport animals** where appropriate. This is a deliberate
change from the old logic, which inferred transport from being a rescuer,
carer, or the retired transport membership category.

The same transport check applies to the mobile feed, claiming transport
jobs and push notifications; the backend is authoritative even if a client
shows a stale job. Only members explicitly assigned the RESCUER permission **and** a matching trained
area may claim a species rescue. A CARER or ORG_ADMIN role does not replace RESCUER.

Members without operational roles can still use organisation chats and
set chat availability, including Busy / Do Not Disturb.

## Suggested HWR member configurations

- **President and Carer:** position President, CARER access; species
  training only where verified; transport off unless explicitly authorised.
- **Raptor Leader:** Raptor Leader position; species training Raptors;
  optional CARER and/or RESCUER access as separately approved.
- **Secretary:** Secretary position, no rescue access, no training, transport
  off; still appears in chats and can manage availability.
- **Transport-only volunteer:** explicit transport authorisation,
  no species-training or care access implied.

All administrative edits are validated server-side and preserve the existing
privilege boundary: organisation administrators cannot grant platform or
authority administrator privileges. Changing software roles invalidates
existing sessions.
