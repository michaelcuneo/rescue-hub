import { json } from '@sveltejs/kit';
import { ChatAccessError, openDirectChat } from '$lib/server/organisation-chat';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, url, request }) => {
  if (!locals.user) return json({ error: 'Sign in to start a chat.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as { recipientUserId?: unknown } | null;
  if (!payload || typeof payload.recipientUserId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.recipientUserId))
    return json({ error: 'Choose a valid organisation member.' }, { status: 400 });
  try {
    return json(await openDirectChat(locals.user, payload.recipientUserId,
      url.searchParams.get('organisationId') || undefined),
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    console.error('Direct chat could not be opened:', error);
    return json({ error: 'Unable to open private chat.' }, { status: 503 });
  }
};
