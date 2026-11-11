import { json } from '@sveltejs/kit';
import {
  ChatAccessError, readChatPage, postChatMessage, markChatRead
} from '$lib/server/organisation-chat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const page = await readChatPage(locals.user, params.channelId, url.searchParams.get('before') || undefined, url.searchParams.get('organisationId') || undefined);
    return json(page, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    console.error('Chat history unavailable:', error);
    return json({ error: 'Could not load messages.' }, { status: 503 });
  }
};
export const POST: RequestHandler = async ({ locals, params, request, url }) => {
  if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload || Array.isArray(payload)) return json({ error: 'Message is required.' }, { status: 400 });
  try {
    return json({ message: await postChatMessage(locals.user, params.channelId, { text: payload.text, animalId: payload.animalId }, url.searchParams.get('organisationId') || undefined) },
      { status: 201, headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    if (error instanceof Error && /message must|enter a message/i.test(error.message))
      return json({ error: error.message }, { status: 400 });
    console.error('Unable to post chat message:', error);
    return json({ error: 'Could not send your message.' }, { status: 503 });
  }
};
export const PATCH: RequestHandler = async ({ locals, params, request, url }) => {
  if (!locals.user) return json({ error: 'Authentication required.' }, { status: 401 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  try {
    await markChatRead(locals.user, params.channelId, payload?.messageId, url.searchParams.get('organisationId') || undefined);
    return json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    console.error('Unable to update chat read state:', error);
    return json({ error: 'Unable to update read state.' }, { status: 503 });
  }
};
