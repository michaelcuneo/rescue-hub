# Veterinary clinics in Rescue Hub

## Purpose

Replace repeat veterinary telephone callbacks with a restricted, audited
clinic workspace. The responsible rescue organisation retains its existing
animal record and its authority over volunteer care and transport assignments.

## Initial scoped implementation

1. The rescue organisation administrator adds a **verified veterinary clinic**
   in **Administration → People & access → Approved veterinary clinics** with
   name, pickup address and confirmed coordinates.
2. The administrator invites a member with **Veterinary clinic staff** as
   their **only** permission and assigns exactly one registered clinic.
   Clinic staff cannot be rescue volunteers, carers or dispatchers through
   that account; those need a separate, independently approved account.
3. A rescuer physically hands an animal to the vet and **selects the approved
   clinic** in the mobile veterinary handover form. That single transaction
   writes the existing animal's veterinary custody status and its explicit
   clinic linkage. Typing a clinic name without selecting the registered
   clinic does **not** give clinic staff access.
4. The clinic member signs in via the existing invitation/password system.
   They are redirected to **/vet**. The workspace lists only animals
   explicitly handed over to their clinic, currently at veterinary care.
   Their role cannot browse the map, other rescues or organisation chats.
5. Staff record clinical assessments as attributed permanent animal events.
   **Ready for care** directly uses the existing atomic vet update:
   pending care offer, held transport pickup, original permanent animal
   record, realtime refresh and later carer/transport self-claims.
   The record says `source = VET_PORTAL`, never `PHONE`.
6. Confirmed death or euthanasia is recorded directly with the staff member
   identity and clinical notes, cancelling outstanding collection work and
   leaving an auditable final record. Do not use this for routine discharge.

## Safety and boundaries

- Clinic accounts are linked to one rescue organisation and one approved
  clinic in this first implementation. Shared multi-organisation clinic
  tenancy needs separate design and privacy review before rollout.
- An explicit rescuer handover is required before a vet account can access
  the animal. Staff cannot claim or browse unrelated animals.
- Existing phone callbacks remain supported as a contingency and for
  clinics without accounts. An unlinked historical vet dropoff is not
  automatically exposed.
- Transport remains volunteer self-claiming; a vet marking an animal ready
  does not assign a driver or transfer custody. Care/transport offers follow
  the current existing sequence.
- The organisation administrator is responsible for verifying the clinic,
  address, coordinates and staff identity before inviting anyone.
- This is an operational coordination record, **not** a certified clinical
  patient-management system. Do not treat it as such or claim automatic
  regulatory integration.
- A valid linked clinic and veterinary employee are checked on every write.
  Concurrent updates fail with a retry rather than silently overwriting an
  animal's current custody/outcome.
- Do not use raw untrusted messages as proof of confirmed veterinary findings;
  clinic staff sign in and their actor IDs are retained in the audit history.

## Acceptance tests (real AWS + devices required)

- Invite and activate restricted clinic staff; no rescue map or Chats access.
- Handover a test animal to Clinic A; Clinic A sees it, Clinic B does not.
- A text-only/unregistered vet dropoff must not appear in either clinic list.
- Clinic A records assessment; rescue staff see the same permanent animal history.
- Clinic A marks ready; exactly one care offer and held transport job appear,
  and a second click cannot duplicate them.
- An eligible carer accepts responsibility; the transport job unlocks.
- An authorised transporter collects; the animal disappears from Clinic A's
  active queue and appears with its new custodian.
- A confirmed outcome cancels outstanding work and preserves the audit trail.
- Check revoked/disabled accounts, unauthorised animal IDs, wrong organisation,
  stale versions and network failures all fail safely.
- Test the real email invitation, SvelteKit build, Expo app and live notifications.

## Not yet complete

Clinic self-registration/verification, multi-organisation support,
clinical attachments and signatures, electronic laboratory results,
formal agency reporting, and production privacy/retention approval.
