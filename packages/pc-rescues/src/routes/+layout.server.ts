import { getHunterDemo } from '$lib/server/demo';
import { effectiveAvailability } from '$lib/server/availability';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
  const user = locals.user;
  const active = user?.enabled && user.status === 'ACTIVE' ? user : null;
  return {
    viewer: active ? {
      name: active.name,
      roles: active.roles,
      availabilityMode: active.availabilityPolicy?.mode ??
        (active.availabilityStatus === 'AVAILABLE' ? 'ON' : 'OFF'),
      isAvailableNow: effectiveAvailability(active) === 'AVAILABLE',
      canReceiveRescueOffers: Boolean(active.organisationId && (active.canTransport === true || active.roles.some(role =>
        ['RESCUER', 'CARER', 'ORG_ADMIN', 'DISPATCHER'].includes(role))))
    } : null,
    demoMode: getHunterDemo(cookies, user)
  };
};
