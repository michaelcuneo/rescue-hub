/** A field volunteer's mobile worklist is NOT a coordinator's oversight feed.
 * Pending cases are visible only when qualification/transport authorisation
 * has already been verified by the server; existing assignments and custody
 * remain accessible for continuity of animal care and audit history.
 *
 * Administrator and dispatcher roles do not widen the mobile worklist. Those
 * roles retain their separately authorised desktop oversight functions.
 */
export type MobileRescueViewer = {
  id: string; organisationId?: string; roles: string[];
};
export type MobileRescueCase = {
  organisationId?: string | null; assignedUserId?: string | null; status: string;
  awaitingCarer?: boolean | null;
};
// COORDINATOR is retained only for older deployed API responses; new mobile
// feeds must never emit it and native clients must ignore it.
export type RescueVisibility = 'MY_ASSIGNMENT' | 'MY_CUSTODY' | 'QUALIFIED_PENDING' | 'COORDINATOR' | null;

export function isVisibleMobileWorkItem(rescue: { visibility?: RescueVisibility }): boolean {
  return rescue.visibility === 'MY_ASSIGNMENT' ||
    rescue.visibility === 'MY_CUSTODY' ||
    rescue.visibility === 'QUALIFIED_PENDING';
}

export function mobileRescueVisibility(
  user: MobileRescueViewer, rescue: MobileRescueCase,
  hasCustody: boolean, qualifiesForPending: boolean
): RescueVisibility {
  const sameOrganisation = Boolean(user.organisationId &&
    rescue.organisationId === user.organisationId);
  const crossOrgSupervisor = user.roles.some(role =>
    role === 'PLATFORM_ADMIN' || role === 'AUTHORITY_ADMIN');

  // Never lose an explicitly assigned case just because its physical custody
  // moved elsewhere or the member's training/roles were changed later.
  if (rescue.assignedUserId === user.id && (sameOrganisation || crossOrgSupervisor))
    return 'MY_ASSIGNMENT';
  if (!sameOrganisation) return null;
  if (hasCustody) return 'MY_CUSTODY';

  if (qualifiesForPending && rescue.status === 'PENDING' &&
      !rescue.assignedUserId && !rescue.awaitingCarer) return 'QUALIFIED_PENDING';
  return null;
}
