import { json } from '@sveltejs/kit';
import { ChatAccessError, listMyChannels, listChatOrganisations } from '$lib/server/organisation-chat';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({ error: 'Sign in to your organisation to access chats.' }, { status: 401 });
  try {
    const organisations = await listChatOrganisations(locals.user);
    const organisationId = url.searchParams.get('organisationId') || locals.user.organisationId || organisations[0]?.id;
    return json({ organisations, organisationId, channels: await listMyChannels(locals.user, organisationId) },
      { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ChatAccessError) return json({ error: error.message }, { status: 403 });
    console.error('Unable to load organisation chats:', error);
    return json({ error: 'Chats are temporarily unavailable.' }, { status: 503 });
  }
};
