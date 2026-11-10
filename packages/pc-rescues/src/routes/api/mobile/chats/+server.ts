import { json } from '@sveltejs/kit';
import { ChatAccessError, listMyChannels } from '$lib/server/organisation-chat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) return json({ error: 'Sign in to your organisation to access chats.' }, { status: 401 });
  try {
    return json({ channels: await listMyChannels(locals.user) },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    console.error('Unable to load organisation chats:', error);
    return json({ error: 'Chats are temporarily unavailable.' }, { status: 503 });
  }
};
