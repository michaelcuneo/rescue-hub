import { redirect } from '@sveltejs/kit';
import { defaultAvailabilityPolicy, effectiveAvailability } from '$lib/server/availability';
import { getOrganisationMembershipConfig } from '$lib/server/membership';
import { getPushDeviceRegistrationCount } from '$lib/server/push';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/login?next=%2Fsettings');
  if (!user.enabled || user.status !== 'ACTIVE') throw redirect(303, '/login');

  // Exactly the same availability permission boundary as the mobile API.
  // Platform-only administrators can inspect their account but cannot opt
  // themselves into an organisation's species rescue queue.
  const canManageAvailability = Boolean(
    user.organisationId &&
    (user.canTransport === true || user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN', 'DISPATCHER'].includes(role)))
  );
  const [membership, devices] = await Promise.all([
    user.organisationId
      ? getOrganisationMembershipConfig(user.organisationId).catch(() => null)
      : Promise.resolve(null),
    canManageAvailability
      ? getPushDeviceRegistrationCount(user.id).catch(() => null)
      : Promise.resolve(null)
  ]);
  return {
    profile: {
      name: user.name,
      email: user.email,
      roles: user.roles,
      organisationId: user.organisationId ?? null,
      membershipTypeId: user.membershipTypeId ?? null,
      teamIds: user.teamIds
    },
    membership,
    canManageAvailability,
    availability: user.availabilityPolicy ?? defaultAvailabilityPolicy(user.availabilityStatus),
    availabilityStatus: effectiveAvailability(user),
    registeredDevices: devices
  };
};
