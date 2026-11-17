import { redirect } from '@sveltejs/kit';
import { mayUseDesktopPortal } from '../../../../../../core/desktop-portal-access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => {
  if (!mayUseDesktopPortal(locals.user)) throw redirect(303, '/login');
  return {};
};
