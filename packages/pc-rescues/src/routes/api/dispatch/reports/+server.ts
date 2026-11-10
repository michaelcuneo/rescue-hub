import { json } from '@sveltejs/kit';
import { canTriage, listTriageReports } from '$lib/server/public-reports';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!canTriage(locals.user)) return json({ error: 'Dispatcher access required.' }, { status: 403 });
  return json({ items: await listTriageReports() }, {
    headers: { 'cache-control': 'private, no-store' }
  });
};
