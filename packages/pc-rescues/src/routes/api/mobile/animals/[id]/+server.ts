import { json } from '@sveltejs/kit';
import { getAnimal, listAnimalEvents } from '$lib/server/animals';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Access denied.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId) return json({ error: 'Animal not found.' }, { status: 404 });
  if (animal.currentCustodianUserId !== user.id && !user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER'].includes(r))) {
    return json({ error: 'Access denied.' }, { status: 403 });
  }
  return json({ animal, events: await listAnimalEvents(animal.id) });
};
