import { json } from '@sveltejs/kit';
import { getAnimal } from '$lib/server/animals';
import { getCareDestination, updateCareDestination, CareReservationConflict } from '$lib/server/care-reservations';
import { validateCareDestination } from '../../../../../../../../core/care-delivery';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE')
    return json({ error: 'Access denied.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId)
    return json({ error: 'Animal not found.' }, { status: 404 });
  const destination = await getCareDestination(animal, user);
  if (!destination) return json({ error: 'Delivery instructions unavailable for this account.' }, { status: 403 });
  return json({ destination }, { headers: { 'cache-control': 'private, no-store' } });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.includes('CARER'))
    return json({ error: 'An active carer is required.' }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json({ error: 'Choose a valid delivery position.' }, { status: 400 });
  try {
    const destination = validateCareDestination(body);
    return json({ updated: await updateCareDestination(params.id, user.organisationId, user.id, destination) },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof CareReservationConflict) return json({ error: error.message }, { status: 409 });
    if (error instanceof Error && /delivery|location|coordinate|address/i.test(error.message))
      return json({ error: error.message }, { status: 400 });
    console.error('Unable to update carer location:', error);
    return json({ error: 'Unable to update delivery location.' }, { status: 503 });
  }
};
