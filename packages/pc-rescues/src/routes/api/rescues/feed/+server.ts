import { json } from '@sveltejs/kit';
import { listAdminRescues } from '$lib/server/admin-data';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import type { RequestHandler } from './$types';
import { canSeeDesktopRescue } from '../../../../../core/desktop-dispatch-access';
import { classifyDispatchCapability, getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';

// Authenticated desktop snapshot. Subscriptions signal an invalidation; the
// server enforces organisation boundaries when returning actual rescue data.
export const GET: RequestHandler = async ({ locals, cookies }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE') {
    return json({ error: 'Authentication required.' }, { status: 401 });
  }
  const organisationId = getHunterDemo(cookies, user)
    ? HUNTER_DEMO_ORGANISATION
    : user.organisationId;
  if (!organisationId) return json({ error: 'Organisation required.' }, { status: 403 });
  const viewer = { ...user, organisationId };
  const [rescues, membership] = await Promise.all([
    listAdminRescues(),
    getOrganisationMembershipConfig(organisationId)
  ]);
  return json({
    items: rescues.filter(rescue => canSeeDesktopRescue(
      viewer, rescue,
      memberCanReceiveCapability(
        viewer.teamIds, membership,
        classifyDispatchCapability(rescue.type, rescue.breed ?? '')
      )
    ))
  }, { headers: { 'cache-control': 'private, no-store' } });
};
