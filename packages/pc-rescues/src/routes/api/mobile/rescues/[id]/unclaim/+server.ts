import { json } from '@sveltejs/kit';
import { RescueCannotUnclaimError, unclaimRescue } from '$lib/server/rescue-claims';
import { getRescue } from '$lib/server/graphql';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF')) {
    return json({ error: 'Authentication required.' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
  const assignment = await getRescue(params.id);
  const allowed = Boolean(assignment?.assignedUserId === user.id &&
    (assignment.organisationId === user.organisationId ||
      user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role))));
  if (!assignment?.organisationId || !allowed)
    return json({ error: 'This rescue is not assigned to you.' }, { status: 403 });
  try {
    const rescue = await unclaimRescue(params.id, assignment.organisationId, user.id, reason);
    return json({ rescue });
  } catch (error) {
    if (error instanceof RescueCannotUnclaimError) {
      return json({ error: error.message }, { status: 409 });
    }
    console.error('Unable to unclaim rescue.', error);
    return json({ error: 'Unable to release the claim.' }, { status: 503 });
  }
};
