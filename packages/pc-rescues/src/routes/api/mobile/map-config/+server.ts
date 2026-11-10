import { env } from '$env/dynamic/public';
import { PUBLIC_MAPBOX_ACCESS_TOKEN as buildToken } from '$env/static/public';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Public browser Mapbox token only. Never expose SST/AppSync credentials here.
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user?.organisationId) return json({ error: 'Authentication required.' }, { status: 401 });
  // SST injects the public token for vite build. Server-side dynamic public
  // env may be empty in adapter-backed API routes even when the browser map works.
  // Prefer the same build-time value as the working portal; retain runtime fallback.
  const token = buildToken?.trim() || process.env.PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || env.PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || '';
  if (!token || !token.startsWith('pk.')) return json({ error: 'Mapbox is not configured.' }, { status: 503 });
  return json({
    token,
    style: 'mapbox://styles/michaelcuneo/ckzzecgy7005j14qvpzd53fgn',
    operatingAreasUrl: new URL('/data/operating-areas.geojson', url.origin).toString()
  }, { headers: { 'cache-control': 'private, no-store' } });
};
