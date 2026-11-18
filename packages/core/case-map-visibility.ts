/**
 * Only an actionable response or transport pickup belongs on the operations map.
 * Claiming a case reserves it, but DOES NOT mean the animal has been collected.
 * Physical pickup is recorded separately, at which point its pin disappears.
 *
 * Permanent animal/care records must never be filtered or deleted by this helper.
 */
export type MapCase = { status?: string; pickedUpAt?: string | null; awaitingCarer?: boolean | null };
export function shouldShowRescuePin(rescue: MapCase): boolean {
  return (rescue.status === 'PENDING' || rescue.status === 'ASSIGNED') &&
    !rescue.pickedUpAt && !rescue.awaitingCarer;
}

/**
 * Keep each rescue's original pin visible throughout pickup, transport and
 * care. Completion remains on Operations for its NSW completion day; older
 * completions remain permanently visible in Administration's history map.
 */
export function shouldShowOperationsMapPin(rescue: MapCase, completedToday: boolean): boolean {
  return rescue.status === 'PENDING' || rescue.status === 'ASSIGNED' ||
    (rescue.status === 'COMPLETED' && completedToday);
}
