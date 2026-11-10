import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { confirmRescuePickup, RescuePickupConflict } from '$lib/server/rescue-pickup';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN'].includes(role))) {
    return json({ error: 'An active assigned volunteer is required.' }, { status: 403 });
  }
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== user.organisationId ||
      rescue.assignedUserId !== user.id)
    return json({ error: 'This job is not assigned to you.' }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { notes?: unknown };
  if (body.notes !== undefined && typeof body.notes !== 'string')
    return json({ error: 'Pickup notes must be text.' }, { status: 400 });
  try {
    return json({ rescue: await confirmRescuePickup(rescue, user.id, String(body.notes ?? '')) });
  } catch (error) {
    if (error instanceof RescuePickupConflict) return json({ error: error.message }, { status: 409 });
    console.error('Physical collection could not be recorded:', error);
    return json({ error: 'Unable to record collection.' }, { status: 503 });
  }
};
