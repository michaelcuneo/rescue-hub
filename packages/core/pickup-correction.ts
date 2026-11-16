/** A mistaken pickup can be reversed only before any actual animal care,
 * veterinary activity, custody handover or other animal event is recorded.
 * Preserve the original claim/animal history as an audit tombstone.
 */
export type CorrectablePickupRescue = {
 id: string; organisationId?: string | null; assignedUserId?: string | null;
 status: string; pickedUpAt?: string | null; quickAnimalId?: string | null;
 animalCount?: number | null; transportAnimalId?: string | null;
};
export type CorrectablePickupAnimal = {
 id: string; rescueId: string; organisationId: string; currentCustodianUserId?: string;
 status: string; version: number; pendingTransferId?: string | null;
 activeTransportRescueId?: string | null; reservedCarerUserId?: string | null;
 registrationVoidedAt?: string | null;
};
export function canCorrectMistakenPickup(
 rescue: CorrectablePickupRescue, animal: CorrectablePickupAnimal,
 userId: string, animalEventTypes: string[]
): boolean {
 return Boolean(
   rescue.status === 'ASSIGNED' && rescue.assignedUserId === userId &&
   rescue.pickedUpAt && !rescue.transportAnimalId && rescue.quickAnimalId === animal.id &&
   rescue.animalCount === 1 && animal.rescueId === rescue.id &&
   animal.organisationId === rescue.organisationId &&
   animal.currentCustodianUserId === userId && animal.status === 'IN_RESCUE' &&
   animal.version === 1 && !animal.pendingTransferId &&
   !animal.activeTransportRescueId && !animal.reservedCarerUserId &&
   !animal.registrationVoidedAt &&
   animalEventTypes.length === 1 && animalEventTypes[0] === 'ANIMAL_REGISTERED'
 );
}
