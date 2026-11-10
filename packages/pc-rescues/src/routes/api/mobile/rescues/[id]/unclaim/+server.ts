import { json } from '@sveltejs/kit';
import { RescueCannotUnclaimError, unclaimRescue } from '$lib/server/rescue-claims';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE') {
    return json({ error: 'Authentication required.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  try {
    const rescue = await unclaimRescue(params.id, user.organisationId, user.id, reason);
    return json({ rescue });
  } catch (error) {
    if (error instanceof RescueCannotUnclaimError) {
      return json({ error: error.message }, { status: 409 });
    }
    console.error('Unable to unclaim rescue.', error);
    return json({ error: 'Unable to release the claim.' }, { status: 503 });
  }
};
