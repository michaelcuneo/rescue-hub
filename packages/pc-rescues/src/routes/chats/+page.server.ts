import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/login');
  if ((!user.organisationId && !user.roles.some(role => role === 'PLATFORM_ADMIN' || role === 'AUTHORITY_ADMIN')) || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER')) throw redirect(303, '/');
  return { userId: user.id, name: user.name, canSelectOrganisation: user.roles.some(role => role === 'PLATFORM_ADMIN' || role === 'AUTHORITY_ADMIN') };
};
