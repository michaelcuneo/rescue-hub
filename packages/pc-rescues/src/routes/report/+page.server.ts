import { redirect } from '@sveltejs/kit';
import { canReport } from '$lib/server/public-reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login?next=/report');
  if (!canReport(locals.user)) throw redirect(303, '/');
  return { reporter: { name: locals.user.name } };
};
