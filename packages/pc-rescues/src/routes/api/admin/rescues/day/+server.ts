import { json } from '@sveltejs/kit';
import { hasAdministrativeRole } from '$lib/server/auth';
import { listRescuesForNSWDay } from '$lib/server/admin-data';
import type { RequestHandler } from './$types';

/** Historical records are deliberately separate from the operational feed.
 * Authority administrators may inspect NSW records; organisation staff are
 * scoped server-side to their own rescue organisation.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const actor = locals.user;
  if (!actor || !actor.enabled || actor.status !== 'ACTIVE' || !hasAdministrativeRole(actor)) {
    return json({ error: 'Administration access required.' }, { status: 403 });
  }

  const day = url.searchParams.get('date') ?? '';
  const organisation = url.searchParams.get('organisation') ?? 'all';
  const isAuthority = actor.roles.includes('PLATFORM_ADMIN') || actor.roles.includes('AUTHORITY_ADMIN');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(Date.parse(`${day}T12:00:00Z`)) ||
      new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) {
    return json({ error: 'Choose a valid calendar date.' }, { status: 400 });
  }
  if (!isAuthority && !actor.organisationId) {
    return json({ error: 'An organisation is required.' }, { status: 403 });
  }
  if (!isAuthority && organisation !== 'all' && organisation !== actor.organisationId) {
    return json({ error: 'Access to this organisation is restricted.' }, { status: 403 });
  }
  try {
    const rescues = await listRescuesForNSWDay(day);
    const scoped = rescues.filter(rescue => isAuthority
      ? (organisation === 'all' || rescue.organisationId === organisation)
      : rescue.organisationId === actor.organisationId);
    return json({ items: scoped }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Unable to fetch administration rescue history', error);
    return json({ error: 'Historical rescues could not be retrieved.' }, { status: 503 });
  }
};
