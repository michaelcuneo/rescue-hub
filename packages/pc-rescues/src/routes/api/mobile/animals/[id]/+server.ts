import { json } from '@sveltejs/kit';
import { getAnimal, getPendingAnimalTransfer, listAnimalEvents, correctAnimalIdentification, AnimalConflict } from '$lib/server/animals';
import type { RequestHandler } from './$types';
import { getRescue } from '$lib/server/graphql';

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') return json({ error: 'Access denied.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId) return json({ error: 'Animal not found.' }, { status: 404 });
  const pending = await getPendingAnimalTransfer(animal);
  const transport = animal.activeTransportRescueId ? await getRescue(animal.activeTransportRescueId) : null;
  const claimedTransport = transport?.organisationId === user.organisationId && transport.assignedUserId === user.id;
  if (animal.currentCustodianUserId !== user.id && pending?.toUserId !== user.id && !claimedTransport && !user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(r))) {
    return json({ error: 'Access denied.' }, { status: 403 });
  }
  const events = await listAnimalEvents(animal.id);
  return json({ animal, events: user.roles.some((r) => ['ORG_ADMIN', 'DISPATCHER'].includes(r)) || (animal.currentCustodianUserId === user.id || claimedTransport) ? events : events.filter((event) => event.id === animal.pendingTransferId) });
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE')
    return json({ error: 'Access denied.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId)
    return json({ error: 'Animal not found.' }, { status: 404 });
  const coordinator = user.roles.some(role => ['ORG_ADMIN', 'DISPATCHER'].includes(role));
  if (animal.currentCustodianUserId !== user.id && !coordinator)
    return json({ error: 'Only the current custodian or organisation coordinator can correct identification.' }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.species !== 'string' || typeof body.description !== 'string')
    return json({ error: 'Species and description must be strings.' }, { status: 400 });
  try {
    return json({ animal: await correctAnimalIdentification(animal, user.id, {
      species: body.species, description: body.description
    }) });
  } catch (error) {
    if (error instanceof AnimalConflict) return json({ error: error.message }, { status: 409 });
    console.error('Animal identification correction failed:', error);
    return json({ error: 'Unable to correct animal identification.' }, { status: 503 });
  }
};
