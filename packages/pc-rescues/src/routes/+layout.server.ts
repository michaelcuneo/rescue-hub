import { getHunterDemo } from '$lib/server/demo';
import { effectiveAvailability } from '$lib/server/availability';
import { canRescueForOrganisation, canTransportForOrganisation } from '../../../../core/care-delivery';
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
      canReceiveRescueOffers: Boolean(active.organisationId &&
        (canTransportForOrganisation(active) ||
         (canRescueForOrganisation(active) && active.teamIds.some(id => id !== 'transport')))))
    } : null,
    demoMode: getHunterDemo(cookies, user)
  };
};
