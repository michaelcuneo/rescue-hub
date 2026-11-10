import { json } from '@sveltejs/kit';
import { getUserById } from '$lib/server/auth';
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
      if (animal.currentCustodianUserId !== user.id) return json({ error: 'Only the current custodian can add care notes.' }, { status: 403 });
      if (!notes || !notesTypes.has(String(body.type))) return json({ error: 'Valid care event type and notes required.' }, { status: 400 });
      await recordAnimalEvent(animal, user.id, { type: body.type as 'OBSERVATION', notes });
      return json({ ok: true });
    }
    if (body.kind === 'TRANSFER') {
      if (animal.currentCustodianUserId !== user.id) return json({ error: 'Only the current custodian can request transfer.' }, { status: 403 });
      if (typeof body.recipientUserId !== 'string' || !body.recipientUserId.trim()) return json({ error: 'Recipient is required.' }, { status: 400 });
      if (body.location !== undefined && (typeof body.location !== 'string' || body.location.length > 250)) return json({ error: 'Invalid location.' }, { status: 400 });
      const recipient = await getUserById(body.recipientUserId);
      if (!recipient || !recipient.enabled || recipient.status !== 'ACTIVE' || recipient.organisationId !== user.organisationId || !recipient.roles.some((r) => ['RESCUER', 'CARER'].includes(r))) return json({ error: 'Recipient must be an active rescuer or carer in this organisation.' }, { status: 400 });
      const updated = await changeAnimalState(animal, user.id, { kind: 'TRANSFER', recipientUserId: body.recipientUserId, location: body.location as string | undefined, notes });
      return json({ animal: updated });
    }
    if (body.kind === 'ACCEPT_TRANSFER') {
      if (!user.roles.some((r) => ['RESCUER', 'CARER'].includes(r))) return json({ error: 'Recipient must be a rescuer or carer.' }, { status: 403 });
      return json({ animal: await changeAnimalState(animal, user.id, { kind: 'ACCEPT_TRANSFER' }) });
    }
    if (body.kind === 'OUTCOME') {
      if (!finalStatuses.has(String(body.status))) return json({ error: 'Invalid final outcome.' }, { status: 400 });
      return json({ animal: await changeAnimalState(animal, user.id, { kind: 'OUTCOME', status: body.status as 'RELEASED', notes }) });
    }
    return json({ error: 'Unknown event kind.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AnimalConflict) return json({ error: error.message }, { status: 409 });
    console.error('Animal event failed.', error);
    return json({ error: 'Could not save animal event.' }, { status: 503 });
  }
};
