import { error, redirect } from '@sveltejs/kit';
import { listTriageReports } from '$lib/server/public-reports';
import { getHunterDemo } from '$lib/server/demo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/login?next=/reports');
  if (!user.enabled || user.status !== 'ACTIVE' || !(
    user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role)) ||
    getHunterDemo(cookies, user)
  )) throw error(403, 'Central public-report triage access required.');
  return { reports: await listTriageReports() };
};
