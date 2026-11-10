import { json } from '@sveltejs/kit';
import { getAnimal } from '$lib/server/animals';
import { getCareDestination } from '$lib/server/care-reservations';
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
