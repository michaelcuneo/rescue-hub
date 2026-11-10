import { json } from '@sveltejs/kit';
import { canTriage, listTriageReports } from '$lib/server/public-reports';
import { getHunterDemo } from '$lib/server/demo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, cookies }) => {
  if (!canTriage(locals.user) || !(
    locals.user.roles.some(role => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role)) ||
    getHunterDemo(cookies, locals.user)
  )) return json({ error: 'Dispatcher access required.' }, { status: 403 });
  return json({ items: await listTriageReports() }, {
    headers: { 'cache-control': 'private, no-store' }
  });
};
