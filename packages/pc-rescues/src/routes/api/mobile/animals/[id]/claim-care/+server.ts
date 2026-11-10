import { json } from '@sveltejs/kit';
import { claimAnimalCare, CareReservationConflict } from '$lib/server/care-reservations';
import { validateCareDestination } from '../../../../../../../../core/care-delivery';
import type { RequestHandler } from './$types';
import { getRescue } from '$lib/server/graphql';
import { notifyEligibleRescuers } from '$lib/server/push';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.includes('CARER')) {
    return json({ error: 'Only an active carer can reserve an animal for care.' }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Select a delivery destination.' }, { status: 400 });
  }
  try {
    const delivery = validateCareDestination(body);
    const claim = await claimAnimalCare(params.id, user.organisationId, user.id, delivery);
    // The reservation is already committed. A notification failure must not
    // cause a duplicate care claim or undo the independently claimable job.
    const transport = await getRescue(claim.transportRescueId).catch(() => null);
    if (transport) {
      void notifyEligibleRescuers({
        id: transport.id, organisationId: user.organisationId,
        type: transport.type, breed: 'Transport',
        location: transport.location ?? undefined,
        injury: 'Animal ready for collection and delivery to its nominated carer.'
      }).catch(error => console.error('Carer reserved animal; transport push failed:', error));
    }
    return json({ claim },
      { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof CareReservationConflict) return json({ error: error.message }, { status: 409 });
    if (error instanceof Error && /delivery|location|coordinate|address/i.test(error.message))
      return json({ error: error.message }, { status: 400 });
    console.error('Unable to reserve animal care:', error);
    return json({ error: 'Unable to claim this animal.' }, { status: 503 });
  }
};
