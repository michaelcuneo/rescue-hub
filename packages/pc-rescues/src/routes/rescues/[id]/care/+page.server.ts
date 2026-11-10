import { error } from '@sveltejs/kit';
import { getRescue } from '$lib/server/graphql';
import { getAssignedReporterContact } from '$lib/server/public-report-contact';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE') error(403, 'An active account is required.');
  const organisationId = getHunterDemo(cookies, user) ? HUNTER_DEMO_ORGANISATION : user.organisationId;
  const rescue = await getRescue(params.id);
  if (!rescue || !organisationId || rescue.organisationId !== organisationId) error(404, 'Rescue not found.');
  if (rescue.assignedUserId !== user.id && !user.roles.some((role) => ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role))) error(403, 'Access denied.');
  return { rescue, userId: user.id, roles: user.roles,
    reporterContact: await getAssignedReporterContact(rescue, user) };
};
