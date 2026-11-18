import { json } from '@sveltejs/kit';
import { hasAdministrativeRole } from '$lib/server/auth';
import { ArchiveRequestError, parseArchiveFilters, searchRescueArchive } from '$lib/server/rescue-archive';
import type { RequestHandler } from './$types';

/** Administration-only historical rescue map. The same archive index and
 * security boundaries apply to all-time, single-day and date-range views.
 * Results are incrementally paginated; no silent 200-record truncation.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const actor = locals.user;
  if (!actor || !actor.enabled || actor.status !== 'ACTIVE' || !hasAdministrativeRole(actor)) {
    return json({ error: 'Administration access required.' }, { status: 403 });
  }
  const isAuthority = actor.roles.includes('PLATFORM_ADMIN') || actor.roles.includes('AUTHORITY_ADMIN');
  if (!isAuthority && !actor.organisationId) {
    return json({ error: 'Organisation required.' }, { status: 403 });
  }
  try {
    const params = new URLSearchParams(url.searchParams);
    params.set('q', '');
    params.set('status', 'all');
    params.set('order', 'newest');
    const filters = parseArchiveFilters(params, isAuthority ? null : actor.organisationId!);
    if (!['all', 'selected_day', 'range'].includes(filters.period)) {
      throw new ArchiveRequestError('Invalid map history period.');
    }
    const result = await searchRescueArchive(filters, url.searchParams.get('cursor') ?? undefined, new Map(), 250);
    return json(result, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ArchiveRequestError)
      return json({ error: error.message }, { status: 400 });
    console.error('Historical rescue map query failed', error);
    return json({ error: 'Unable to load rescue locations.' }, { status: 503 });
  }
};
