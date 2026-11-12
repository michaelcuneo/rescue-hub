import { json } from '@sveltejs/kit';
import { ChatAccessError, listChatDirectory } from '$lib/server/organisation-chat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'Sign in to access members.' }, { status: 401 });
  try {
    return json({ members: await listChatDirectory(locals.user,
      url.searchParams.get('organisationId') || undefined) },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    console.error('Chat member directory could not load:', error);
    return json({ error: 'Unable to load chat members.' }, { status: 503 });
  }
};
