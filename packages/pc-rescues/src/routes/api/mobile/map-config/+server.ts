import { env } from '$env/dynamic/public';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Public browser Mapbox token only. Never expose SST/AppSync credentials here.
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user?.organisationId) return json({ error: 'Authentication required.' }, { status: 401 });
  const token = env.PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';
  if (!token || !token.startsWith('pk.')) return json({ error: 'Mapbox is not configured.' }, { status: 503 });
  return json({
    token,
    style: 'mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn',
    operatingAreasUrl: new URL('/data/operating-areas.geojson', url.origin).toString()
  }, { headers: { 'cache-control': 'private, no-store' } });
};
