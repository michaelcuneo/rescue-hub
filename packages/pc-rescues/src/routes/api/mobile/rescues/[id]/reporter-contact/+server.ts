import { json } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { getAssignedReporterContact } from '$lib/server/public-report-contact';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE')
    return json({ error: 'Access denied.' }, { status: 403 });
  const rescue = await getRescue(params.id);
  if (!rescue || rescue.organisationId !== user.organisationId ||
      rescue.assignedUserId !== user.id) {
    return json({ error: 'Rescue not found or not assigned to you.' }, { status: 404 });
  }
  return json({ contact: await getAssignedReporterContact(rescue, user) }, {
    headers: { 'cache-control': 'private, no-store' }
  });
};
