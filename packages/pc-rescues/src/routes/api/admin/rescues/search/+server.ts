import { json } from '@sveltejs/kit';
import { hasAdministrativeRole } from '$lib/server/auth';
import { ArchiveRequestError, listArchiveResponderNames, parseArchiveFilters, searchRescueArchive } from '$lib/server/rescue-archive';
import type { RequestHandler } from './$types';

/**
 * Search across the entire rescue history, not the 200-case operational snapshot.
 * The server alone defines organisation access and each cursor is scoped to
 * both the request filters and the authenticated viewer's organisation.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const actor = locals.user;
  if (!actor || !actor.enabled || actor.status !== 'ACTIVE' || !hasAdministrativeRole(actor)) {
    return json({ error: 'Administration access required.' }, { status: 403 });
  }
  const isAuthority = actor.roles.includes('PLATFORM_ADMIN') || actor.roles.includes('AUTHORITY_ADMIN');
  if (!isAuthority && !actor.organisationId) {
    return json({ error: 'An organisation is required.' }, { status: 403 });
  }

  try {
    const filters = parseArchiveFilters(url.searchParams, isAuthority ? null : actor.organisationId!);
    // Responder-name searching loads every directory page, unlike the
    // historical first-page-only listUsers helper. Ordinary filtered queries
    // avoid this additional lookup.
    const names = filters.query
      ? await listArchiveResponderNames(isAuthority ? null : actor.organisationId!)
      : new Map<string, string>();
    const result = await searchRescueArchive(filters, url.searchParams.get('cursor') ?? undefined, names);
    return json(result, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof ArchiveRequestError) {
      return json({ error: error.message }, { status: 400 });
    }
    console.error('Rescue archive search failed:', error);
    return json({ error: 'Unable to search rescue history. Please retry.' }, { status: 503 });
  }
};
