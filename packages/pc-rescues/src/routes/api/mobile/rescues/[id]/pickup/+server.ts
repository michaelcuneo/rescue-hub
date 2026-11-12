import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { getAnimal } from '$lib/server/animals';
import { confirmRescuePickup, RescuePickupConflict } from '$lib/server/rescue-pickup';
import type { RequestHandler } from './$types';
import { canTransportForOrganisation } from '../../../../../../../../core/care-delivery';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') {
    return json({ error: 'An active assigned volunteer is required.' }, { status: 403 });
  }
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== user.organisationId ||
      rescue.assignedUserId !== user.id)
    return json({ error: 'This job is not assigned to you.' }, { status: 404 });
  const canPickup = rescue.transportAnimalId ? canTransportForOrganisation(user) :
    user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN'].includes(role));
  if (!canPickup) return json({ error: 'This account is not eligible to collect the animal.' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { notes?: unknown; species?: unknown; description?: unknown };
  if (body.notes !== undefined && typeof body.notes !== 'string')
    return json({ error: 'Pickup notes must be text.' }, { status: 400 });
  if (!rescue.transportAnimalId && body.species !== undefined &&
      (typeof body.species !== 'string' || !body.species.trim() || body.species.length > 120))
    return json({ error: 'A valid species is required.' }, { status: 400 });
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000))
    return json({ error: 'Invalid animal description.' }, { status: 400 });
  try {
    const updated = await confirmRescuePickup(
      rescue, user.id, String(body.notes ?? ''),
      !rescue.transportAnimalId && typeof body.species === 'string'
        ? { species: body.species, description: String(body.description ?? '') } : undefined
    );
    return json({
      rescue: updated,
      animal: !rescue.transportAnimalId && typeof updated.quickAnimalId === 'string'
        ? await getAnimal(updated.quickAnimalId) : undefined
    });
  } catch (error) {
    if (error instanceof RescuePickupConflict) return json({ error: error.message }, { status: 409 });
    console.error('Physical collection could not be recorded:', error);
    return json({ error: 'Unable to record collection.' }, { status: 503 });
  }
};
