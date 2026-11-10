import { json } from '@sveltejs/kit';
import { getRealtimeResource } from '$lib/server/realtime-resource';
import { getHunterDemo } from '$lib/server/demo';
import type { RequestHandler } from './$types';

// The key can subscribe ONLY to opaque change signals. All rescue data is
// retrieved through the user's existing authorised HTTP endpoints.
export const GET: RequestHandler = async ({ locals, cookies }) => {
  if (!locals.user?.enabled || locals.user.status !== 'ACTIVE' ||
      (!locals.user.organisationId && !getHunterDemo(cookies, locals.user))) {
    return json({ error: 'An active Rescue Hub session is required.' }, { status: 401 });
  }
  return json({
    url: getRealtimeResource().url,
    apiKey: getRealtimeResource().apiKey
  }, { headers: { 'cache-control': 'private, no-store' } });
};
