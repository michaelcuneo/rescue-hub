import { json } from '@sveltejs/kit';
import { getAnimal, getPendingAnimalTransfer, listAnimalEvents } from '$lib/server/animals';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Access denied.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId) return json({ error: 'Animal not found.' }, { status: 404 });
  const pending = await getPendingAnimalTransfer(animal);
  if (animal.currentCustodianUserId !== user.id && pending?.toUserId !== user.id && !user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(r))) {
    return json({ error: 'Access denied.' }, { status: 403 });
  }
  const events = await listAnimalEvents(animal.id);
  return json({ animal, events: user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER'].includes(r)) || animal.currentCustodianUserId === user.id ? events : events.filter((event) => event.id === animal.pendingTransferId) });
};
