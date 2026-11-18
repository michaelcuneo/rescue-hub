import { json } from '@sveltejs/kit';
import { listRescuesForNSWDay } from '$lib/server/admin-data';
import { getHunterDemo, HUNTER_DEMO_ORGANISATION } from '$lib/server/demo';
import { classifyDispatchCapability, getOrganisationMembershipConfig, memberCanReceiveCapability } from '$lib/server/membership';
import { canSeeDesktopRescue } from '../../../../../../core/desktop-dispatch-access';
import type { RequestHandler } from './$types';

function todayNSW(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Sydney', day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(new Date());
  const value = (key: string) => parts.find(part => part.type === key)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export const GET: RequestHandler = async ({ locals, cookies, url }) => {
  const user = locals.user;
  if (!user || !user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF')) {
    return json({ error: 'Staff access required.' }, { status: 403 });
  }
  const organisationId = getHunterDemo(cookies, user)
    ? HUNTER_DEMO_ORGANISATION : user.organisationId;
  if (!organisationId) return json({ error: 'Organisation required.' }, { status: 403 });
  const day = url.searchParams.get('date') || todayNSW();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(`${day}T12:00:00Z`)) ||
      new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day ||
      day > todayNSW()) {
    return json({ error: 'Select a valid NSW dispatch date, no later than today.' }, { status: 400 });
  }
  try {
    const membership = await getOrganisationMembershipConfig(organisationId);
    const viewer = getHunterDemo(cookies, user) ? {
      ...user,
      organisationId,
      roles: [...new Set([...user.roles, 'DISPATCHER' as const])]
    } : user;
    const cases = await listRescuesForNSWDay(day);
    const visible = cases.filter(rescue => canSeeDesktopRescue(
      viewer,
      rescue,
      memberCanReceiveCapability(
        viewer.teamIds, membership,
        classifyDispatchCapability(rescue.type, rescue.breed ?? '')
      )
    ));
    return json({ items: visible }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Unable to load NSW daily rescue records', error);
    return json({ error: 'Unable to load daily rescues.' }, { status: 503 });
  }
};
