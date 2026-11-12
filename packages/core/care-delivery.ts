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

/** Rescue eligibility requires an explicitly assigned active-rescuer
 * membership, a suitable system role and matching species qualifications.
 * A blank membership is never interpreted as being trained for field rescue.
 */
export function canRescueForOrganisation(user: {
  enabled: boolean; status: string; roles: string[]; membershipTypeId?: string;
}): boolean {
  if (!user.enabled || user.status !== 'ACTIVE' || user.roles.includes('PUBLIC_REPORTER')) return false;
  return user.membershipTypeId === 'active-rescuer' &&
    user.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN'].includes(role));
}

/** Transport eligibility is independent of species training and carer status.
 * It is assigned deliberately by an administrator, never inferred from being
 * a rescuer, carer, or member of the Transport team.
 * Missing legacy flags are deliberately treated as not authorised.
 */
export function canTransportForOrganisation(user: {
  enabled: boolean; status: string; roles: string[];
  canTransport?: boolean; membershipTypeId?: string;
}): boolean {
  if (!user.enabled || user.status !== 'ACTIVE' ||
      user.roles.includes('PUBLIC_REPORTER') || user.canTransport !== true) return false;
  return true;
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
