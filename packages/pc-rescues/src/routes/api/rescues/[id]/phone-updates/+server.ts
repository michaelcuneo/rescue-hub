import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { addRescuePhoneUpdate, listRescuePhoneUpdates } from '$lib/server/rescue-phone-updates';
import { validatePhoneUpdate } from '../../../../../../../core/rescue-phone-update';
import type { RequestHandler } from './$types';

async function authorised({ locals, cookies, params }: Parameters<RequestHandler>[0], writing: boolean) {
  const user = locals.user;
  if (!user?.enabled || user.status !== 'ACTIVE') return null;
  const org = getHunterDemo(cookies, user) ? HUNTER_DEMO_ORGANISATION : user.organisationId;
  if (!org) return null;
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== org) return null;
  const dispatcher = user.roles.some(role =>
    ['DISPATCHER', 'ORG_ADMIN', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role));
  // Only coordinators enter calls; assigned responders may read them.
  if (writing ? !dispatcher : !dispatcher && rescue.assignedUserId !== user.id) return null;
  return { user, rescue, organisationId: org };
}

export const GET: RequestHandler = async event => {
  const access = await authorised(event, false);
  if (!access) return json({ error: 'Incident history unavailable.' }, { status: 403 });
  try {
    return json({ items: await listRescuePhoneUpdates(access.rescue.id, access.organisationId) },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Unable to read rescue telephone updates:', error);
    return json({ error: 'Unable to load telephone updates.' }, { status: 503 });
  }
};

export const POST: RequestHandler = async event => {
  const access = await authorised(event, true);
  if (!access) return json({ error: 'Dispatcher access required.' }, { status: 403 });
  const body = await event.request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return json({ error: 'Valid telephone update required.' }, { status: 400 });
  let input;
  try {
    input = validatePhoneUpdate(body);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid telephone update.' }, { status: 400 });
  }
  try {
    const update = await addRescuePhoneUpdate(
      access.rescue.id, access.organisationId, access.user.id, input
    );
    return json({ update }, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('Unable to record rescue telephone update:', error);
    return json({ error: 'Unable to save telephone update.' }, { status: 503 });
  }
};
