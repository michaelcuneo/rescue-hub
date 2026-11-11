import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { correctReportedRescue, RescueCorrectionConflict } from '$lib/server/rescue-corrections';
import type { RequestHandler } from './$types';
import { canUpdateOwnRescue } from '../../../../../../../../core/field-rescue-progress';

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE')
    return json({ error: 'Sign in with an active organisation account.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!canUpdateOwnRescue(user, rescue))
    return json({ error: 'Only the assigned member may update this active rescue.' }, { status: 403 });
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
