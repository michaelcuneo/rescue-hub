import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { correctReportedRescue, RescueCorrectionConflict } from '$lib/server/rescue-corrections';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.some(role => role === 'RESCUER' || role === 'CARER')) {
    return json({ error: 'Assigned active rescuer access required.' }, { status: 403 });
  }
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== user.organisationId || rescue.assignedUserId !== user.id)
    return json({ error: 'Rescue not assigned to you.' }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.type !== 'string' || typeof body.injury !== 'string')
    return json({ error: 'Animal identification and condition are required.' }, { status: 400 });
  try {
    return json({ rescue: await correctReportedRescue(rescue, user.id, {
      type: body.type, injury: body.injury
    }) });
  } catch (error) {
    if (error instanceof RescueCorrectionConflict)
      return json({ error: error.message }, { status: 409 });
    console.error('Rescue correction failed:', error);
    return json({ error: 'Unable to correct reported observation.' }, { status: 503 });
  }
};
