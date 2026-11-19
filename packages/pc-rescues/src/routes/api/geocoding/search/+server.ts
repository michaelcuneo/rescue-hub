import { json } from '@sveltejs/kit';
import { geocodingEnabled, searchRescueAddresses } from '$lib/server/rescue-geocoding';
import { validRescueCoordinates } from '../../../../../../core/rescue-location';
import type { RequestHandler } from './$types';

/** Not an unrestricted public geocoding proxy: only verified dispatch staff. */
export const GET: RequestHandler = async ({ locals, url, fetch: eventFetch }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER'))
    return json({ error: 'Authentication required.' }, { status: 401 });
  if (!user.roles.some(role =>
    ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role)))
    return json({ error: 'Dispatcher access required.' }, { status: 403 });

  const query = url.searchParams.get('q')?.trim() ?? '';
  if (query.length > 120) return json({ error: 'Address query too long.' }, { status: 400 });
  if (!geocodingEnabled()) {
    return json({ error: 'Address lookup is disabled on this deployment.' },
      { status: 503, headers: { 'cache-control': 'private, no-store' } });
  }
  const latitude = Number(url.searchParams.get('lat'));
  const longitude = Number(url.searchParams.get('lon'));
  // null numeric conversion yields 0: require both parameters explicitly.
  const hasBias = url.searchParams.has('lat') && url.searchParams.has('lon');
  const bias = { latitude, longitude };
  try {
    const results = await searchRescueAddresses(query, eventFetch,
      hasBias && validRescueCoordinates(bias) ? bias : undefined);
    return json({ results }, { headers: { 'cache-control': 'private, no-store' } });
  } catch {
    // Real AWS service failures must not masquerade as an empty result set.
    return json({ error: 'Address lookup service is temporarily unavailable.' },
      { status: 502, headers: { 'cache-control': 'private, no-store' } });
  }
};
