import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { correctMistakenPickup, PickupCorrectionConflict } from '$lib/server/rescue-pickup-correction';
import type { RequestHandler } from './$types';

/** A confirmed mistake is not normal unclaim. Correction is only possible
 * while the auto-registered animal has no care, handover or vet history.
 * Only the user who claimed this specific incident may request it.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF'))
    return json({ error: 'An active assigned volunteer is required.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.assignedUserId !== user.id ||
      (rescue.organisationId !== user.organisationId &&
        !user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role))))
    return json({ error: 'This rescue is not assigned to you.' }, { status: 403 });
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  if (typeof body?.reason !== 'string' || body.reason.trim().length < 10 || body.reason.length > 500)
    return json({ error: 'Describe why the collection was mistakenly confirmed (10–500 characters).' }, { status: 400 });
  try {
    return json({ rescue: await correctMistakenPickup(rescue, user.id, body.reason) });
  } catch (error) {
    if (error instanceof PickupCorrectionConflict)
      return json({ error: error.message }, { status: 409 });
    console.error('Unable to correct mistaken pickup.', error);
    return json({ error: 'The pickup correction could not be confirmed. Contact dispatch before trying again.' }, { status: 503 });
  }
};
