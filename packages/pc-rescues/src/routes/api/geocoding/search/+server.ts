import { json } from '@sveltejs/kit';
import { searchRescueAddresses } from '$lib/server/rescue-geocoding';
import type { RequestHandler } from './$types';

/** Not an unrestricted public address-search proxy. */
export const GET: RequestHandler = async ({ locals, url, fetch: eventFetch }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER'))
    return json({ error: 'Authentication required.' }, { status: 401 });
  if (!user.roles.some(role => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role)))
    return json({ error: 'Dispatcher access required.' }, { status: 403 });
  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length > 120) return json({ error: 'Address query too long.' }, { status: 400 });
  const results = await searchRescueAddresses(query, eventFetch);
  return json({ results }, { headers: { 'cache-control': 'private, no-store' } });
};
