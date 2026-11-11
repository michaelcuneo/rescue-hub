/**
 * A care reservation is independent from rescue/transport job assignment.
 * Only the reserved carer and the volunteer who claimed transportation may
 * access the full delivery destination.
 */
export const DELIVERY_MODES = ['CURRENT_LOCATION', 'WORKPLACE', 'OTHER'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export type DeliveryInput = {
  mode?: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};
export type ValidDeliveryDestination = {
  mode: DeliveryMode;
  address: string;
  latitude: number;
  longitude: number;
};
export function validateCareDestination(input: DeliveryInput): ValidDeliveryDestination {
  if (!DELIVERY_MODES.some(mode => mode === input.mode)) {
    throw new Error('Select your current location, workplace or another delivery address.');
  }
  if (typeof input.address !== 'string') throw new Error('A delivery location label is required.');
  const address = input.address.trim();
  if (address.length < 5 || address.length > 250) {
    throw new Error('Provide a delivery address or recognised GPS location.');
  }
  const latitude = input.latitude, longitude = input.longitude;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Select a confirmed map location for the animal delivery.');
  }
  return { mode: input.mode as DeliveryMode, address, latitude, longitude };
}

export function canClaimAnimalCare(
  status: string, vetStage?: string, reservedCarerUserId?: string, pendingTransferId?: string
) {
  return status === 'AT_VET' && vetStage === 'ASSESSED_AWAITING_TRANSPORT' &&
    !reservedCarerUserId && !pendingTransferId;
}

/** Independent rescue requires active field membership AND an operational role.
 * Legacy members without a membership type retain their existing eligibility.
 * Teams are checked separately against the actual animal species.
 */
export function canRescueForOrganisation(user: {
  enabled: boolean; status: string; roles: string[]; membershipTypeId?: string;
}): boolean {
  if (!user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER')) return false;
  return (!user.membershipTypeId || user.membershipTypeId === 'active-rescuer') &&
    user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN'].includes(role));
}

export function canTransportForOrganisation(user: {
  enabled: boolean; status: string; roles: string[]; membershipTypeId?: string;
}): boolean {
  if (!user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER')) return false;
  return canRescueForOrganisation(user) || user.membershipTypeId === 'transport-volunteer';
}

/** Receipt from the receiving carer completes an already collected transport.
 * Claim alone, cancellation or animal death never counts as delivered.
 */
export function transportCloseStatus(
  eventKind: string, jobStatus: string, pickedUpAt?: string | null
): 'COMPLETED' | 'CANCELLED' {
  return eventKind === 'ACCEPT_TRANSFER' && jobStatus === 'ASSIGNED' && !!pickedUpAt
    ? 'COMPLETED' : 'CANCELLED';
}
