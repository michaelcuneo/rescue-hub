import { json } from '@sveltejs/kit';
import { getUserById } from '$lib/server/auth';
import { getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';
import { getAnimal, recordAnimalEvent, changeAnimalState, AnimalConflict } from '$lib/server/animals';
import type { RequestHandler } from './$types';

const notesTypes = new Set(['OBSERVATION', 'VET_ASSESSMENT', 'TREATMENT', 'FEEDING', 'WEIGHT', 'REVIEW']);
const finalStatuses = new Set(['RELEASED', 'EUTHANISED', 'DECEASED']);
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Access denied.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId) return json({ error: 'Animal not found.' }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.kind !== 'string') return json({ error: 'Event kind is required.' }, { status: 400 });
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > 4000) return json({ error: 'Notes exceed 4000 characters.' }, { status: 400 });
  try {
    if (body.kind === 'NOTE') {
      const coordinator = user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(r));
      if (animal.currentCustodianUserId !== user.id && !coordinator) return json({ error: 'Only the custodian or an authorised coordinator can record care updates.' }, { status: 403 });
      if (coordinator && animal.currentCustodianUserId !== user.id && (body.source !== 'PHONE' || typeof body.reportedByName !== 'string' || !body.reportedByName.trim())) return json({ error: 'Telephone updates on behalf of others require the information source.' }, { status: 400 });
      if (body.reportedByName !== undefined && (typeof body.reportedByName !== 'string' || body.reportedByName.length > 120)) return json({ error: 'Invalid source name.' }, { status: 400 });
      if (!notes || !notesTypes.has(String(body.type))) return json({ error: 'Valid care event type and notes required.' }, { status: 400 });
      await recordAnimalEvent(animal, user.id, { type: body.type as 'OBSERVATION', notes, source: body.source === 'PHONE' ? 'PHONE' : 'DIRECT', reportedByName: typeof body.reportedByName === 'string' ? body.reportedByName.trim() : undefined, coordinatorOverride: coordinator });
      return json({ ok: true });
    }
    if (body.kind === 'TRANSFER') {
      if (animal.currentCustodianUserId !== user.id) return json({ error: 'Only the current custodian can request transfer.' }, { status: 403 });
      if (animal.reservedCarerUserId && body.purpose !== 'TRANSPORT' && body.recipientUserId !== animal.reservedCarerUserId)
        return json({ error: 'Care has already been reserved by another carer.' }, { status: 409 });
      if (typeof body.recipientUserId !== 'string' || !body.recipientUserId.trim()) return json({ error: 'Recipient is required.' }, { status: 400 });
      if (body.location !== undefined && (typeof body.location !== 'string' || body.location.length > 250)) return json({ error: 'Invalid location.' }, { status: 400 });
      const recipient = await getUserById(body.recipientUserId);
      if (!recipient || !recipient.enabled || recipient.status !== 'ACTIVE' || recipient.organisationId !== user.organisationId) {
        return json({ error: 'Recipient must be active in this organisation.' }, { status: 400 });
      }
      const purpose = body.purpose === 'TRANSPORT' ? 'TRANSPORT' : 'CARE';
      const teamConfig = await getOrganisationMembershipConfig(user.organisationId);
      const canTransport = memberCanReceiveCapability(recipient.teamIds, teamConfig, 'OTHER') ||
        recipient.roles.some(r => ['RESCUER', 'CARER'].includes(r));
      if (purpose === 'TRANSPORT' ? !canTransport : !recipient.roles.includes('CARER')) {
        return json({ error: purpose === 'TRANSPORT'
          ? 'Recipient must have transport eligibility or be an active rescuer/carer.'
          : 'Care handover requires an active carer.' }, { status: 400 });
      }
      const updated = await changeAnimalState(animal, user.id, { kind: 'TRANSFER', recipientUserId: body.recipientUserId, location: body.location as string | undefined, notes, purpose });
      return json({ animal: updated });
    }
    if (body.kind === 'ACCEPT_TRANSFER') {
      // The transfer request already verified recipient eligibility. Only the
      // nominated recipient can accept, enforced by the atomic custody update.
      return json({ animal: await changeAnimalState(animal, user.id, { kind: 'ACCEPT_TRANSFER' }) });
    }
    if (body.kind === 'SELF_CARE') {
      if (!user.roles.includes('CARER'))
        return json({ error: 'You must have an active carer role to take the animal into your own care.' }, { status: 403 });
      return json({ animal: await changeAnimalState(animal, user.id, { kind: 'SELF_CARE', notes }) });
    }
    if (body.kind === 'VET_TRANSPORT_STARTED') {
      if (typeof body.location !== 'string' || !body.location.trim() || body.location.length > 250)
        return json({ error: 'Veterinary destination is required.' }, { status: 400 });
      return json({ animal: await changeAnimalState(animal, user.id, {
        kind: 'VET_TRANSPORT_STARTED', location: body.location, notes
      }) });
    }
    if (body.kind === 'VET_DROPOFF' || body.kind === 'VET_ASSESSED') {
      const location = typeof body.location === 'string' ? body.location.trim() : '';
      if (location.length > 250) return json({ error: 'Location is too long.' }, { status: 400 });
      return json({ animal: await changeAnimalState(animal, user.id, {
        kind: body.kind, location, notes
      }) });
    }
    if (body.kind === 'OUTCOME') {
      if (!finalStatuses.has(String(body.status))) return json({ error: 'Invalid final outcome.' }, { status: 400 });
      const location = typeof body.location === 'string' ? body.location.trim() : '';
      const latitude = body.latitude, longitude = body.longitude;
      if (body.status === 'RELEASED' && (!location || location.length > 250))
        return json({ error: 'A release location is required.' }, { status: 400 });
      if (latitude !== undefined || longitude !== undefined) {
        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
            !Number.isFinite(longitude) || longitude < -180 || longitude > 180)
          return json({ error: 'Invalid release GPS coordinates.' }, { status: 400 });
      }
      return json({ animal: await changeAnimalState(animal, user.id, {
        kind: 'OUTCOME', status: body.status as 'RELEASED', notes, location,
        releaseReason: body.releaseReason === 'RELOCATION' ? 'RELOCATION' : undefined,
        latitude: typeof latitude === 'number' ? latitude : undefined,
        longitude: typeof longitude === 'number' ? longitude : undefined
      }) });
    }
    return json({ error: 'Unknown event kind.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AnimalConflict) return json({ error: error.message }, { status: 409 });
    console.error('Animal event failed.', error);
    return json({ error: 'Could not save animal event.' }, { status: 503 });
  }
};
