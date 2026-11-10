/**
 * Only an actionable response or transport pickup belongs on the operations map.
 * Claiming a case reserves it, but DOES NOT mean the animal has been collected.
 * Physical pickup is recorded separately, at which point its pin disappears.
 *
 * Permanent animal/care records must never be filtered or deleted by this helper.
 */
export type MapCase = { status: string; pickedUpAt?: string | null };
export function shouldShowRescuePin(rescue: MapCase): boolean {
  return (rescue.status === 'PENDING' || rescue.status === 'ASSIGNED') &&
    !rescue.pickedUpAt;
}
