/** Clinic access is a separate, least-privilege account type. A vet's
 * organisation is the rescue organisation that granted their clinic access;
 * it does not give them rescue, carer, dispatch or organisation chat rights.
 */
export type VetActor = {
  id: string; enabled: boolean; status: string; organisationId?: string;
  vetClinicId?: string; roles: string[];
};
export type VetAnimal = {
  organisationId: string; vetClinicId?: string; status: string;
  physicalCustodianType?: string;
};
export function isVetOnlyUser(user: Pick<VetActor, 'roles'>): boolean {
  return user.roles.includes('VET_STAFF');
}
export function canVetAccessAnimal(user: VetActor | null | undefined, animal: VetAnimal | null | undefined): boolean {
  return Boolean(user && animal && user.enabled && user.status === 'ACTIVE' &&
    user.roles.length === 1 && user.roles[0] === 'VET_STAFF' &&
    user.organisationId && user.vetClinicId &&
    user.organisationId === animal.organisationId &&
    user.vetClinicId === animal.vetClinicId &&
    animal.status === 'AT_VET' && animal.physicalCustodianType === 'VET');
}
export function validateVetClinic(input: {
  name?: unknown; address?: unknown; latitude?: unknown; longitude?: unknown;
}): { name: string; address: string; latitude: number; longitude: number } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  const lat = Number(input.latitude), lng = Number(input.longitude);
  if (name.length < 2 || name.length > 120 || address.length < 5 || address.length > 250 ||
    input.latitude === '' || input.longitude === '' || input.latitude == null || input.longitude == null ||
    !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('Enter a clinic name, full pickup address and valid GPS coordinates.');
  }
  return { name, address, latitude: lat, longitude: lng };
}
