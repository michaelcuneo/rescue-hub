import { error, redirect } from '@sveltejs/kit';
import { documentationGuideById, documentationGuides } from '$lib/documentation/guides';
import type { PageServerLoad } from './$types';

const PUBLIC_GUIDES = new Set(['overview', 'readiness']);
const ADMIN_ROLES = new Set(['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN']);
const STAFF_ROLES = new Set([
  'PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN',
  'DISPATCHER', 'RESCUER', 'CARER', 'DATA_STEWARD'
]);

export const load: PageServerLoad = async ({ locals, url }) => {
  const guideId = url.searchParams.get('guide') ?? 'overview';
  const guide = documentationGuideById.get(guideId);
  if (!guide) error(404, 'Documentation guide not found.');

  const user = locals.user;
  const active = Boolean(user?.enabled && user.status === 'ACTIVE' &&
    user.roles.some(role => STAFF_ROLES.has(role)));
  const administrator = Boolean(active && user?.roles.some(role => ADMIN_ROLES.has(role)));

  if (!PUBLIC_GUIDES.has(guide.id) && !active) {
    throw redirect(303, '/login?next=' +
      encodeURIComponent('/documentation?guide=' + guide.id));
  }
  if (guide.id === 'administrators' && !administrator)
    error(403, 'Administrator access is required for this guide.');

  const guideDirectory = documentationGuides.filter(item =>
    PUBLIC_GUIDES.has(item.id) || (active && (item.id !== 'administrators' || administrator))
  ).map(({ id, title, audience, minutes, description }) =>
    ({ id, title, audience, minutes, description }));

  return {
    guide,
    guideDirectory,
    isStaff: active,
    isAdministrator: administrator,
    userName: active ? user?.name : null,
    publiclyShareable: PUBLIC_GUIDES.has(guide.id)
  };
};
