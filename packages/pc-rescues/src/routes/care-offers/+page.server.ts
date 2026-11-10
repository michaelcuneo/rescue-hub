import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user?.organisationId || !user.enabled || user.status !== 'ACTIVE')
    throw redirect(303, '/login');
  if (!user.roles.includes('CARER')) throw redirect(303, '/');
  return { carerId: user.id };
};
