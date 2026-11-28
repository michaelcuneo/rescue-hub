import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ChatAccessError } from '$lib/server/organisation-chat';
import { listChatMentions } from '$lib/server/chat-mention-lookup';

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) return json({error:'Authentication required.'},{status:401});
  const channelId = url.searchParams.get('channelId') ?? '';
  const query = url.searchParams.get('q') ?? '';
  if (!channelId || query.length > 60)
    return json({error:'Invalid mention search.'},{status:400});
  try {
    const items = await listChatMentions(
      locals.user, channelId, url.searchParams.get('organisationId') || undefined, query
    );
    return json({items},{headers:{'cache-control':'private, no-store'}});
  } catch (error) {
    if (error instanceof ChatAccessError)
      return json({error:error.message},{status:403});
    console.error('Mention suggestions unavailable:',error);
    return json({error:'Could not find people and animals.'},{status:503});
  }
};
