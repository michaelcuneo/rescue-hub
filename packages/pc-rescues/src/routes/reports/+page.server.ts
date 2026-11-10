import { error, redirect } from '@sveltejs/kit';
import { listTriageReports } from '$lib/server/public-reports';
import { listAdminOrganisations } from '$lib/server/admin-data';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/login?next=/reports');
  if (!user.enabled || user.status !== 'ACTIVE' || !(
    user.roles.some(role => ['PLATFORM_ADMIN','AUTHORITY_ADMIN'].includes(role)) ||
    getHunterDemo(cookies, user)
  )) throw error(403, 'Central public-report triage access required.');
  const [reports, organisations] = await Promise.all([
    listTriageReports(), listAdminOrganisations()
  ]);
  return {
    reports, organisations,
    defaultOrganisationId: getHunterDemo(cookies, user)
      ? HUNTER_DEMO_ORGANISATION : user.organisationId ?? ''
  };
};
