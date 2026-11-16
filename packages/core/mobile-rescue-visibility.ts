/** Separates "may see my assigned incident" from the qualifications needed to
 * claim a NEW rescue. An original claimant may need the history after custody
 * moves to a vet or another carer, even though its pin is no longer on the map.
 *
 * Platform/authority administrators can inspect incidents assigned to their
 * own identity across organisation boundaries. This does NOT allow claiming,
 * pickup or alteration in another organisation.
 */
export type MobileRescueViewer = {
  id: string; organisationId?: string; roles: string[];
};
export type MobileRescueCase = {
  organisationId?: string | null; assignedUserId?: string | null; status: string;
  awaitingCarer?: boolean | null;
};
export type RescueVisibility = 'MY_ASSIGNMENT' | 'MY_CUSTODY' | 'COORDINATOR' | 'QUALIFIED_PENDING' | null;

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

  const coordinator = user.roles.some(role =>
    ['PLATFORM_ADMIN','AUTHORITY_ADMIN','ORG_ADMIN','DISPATCHER'].includes(role));
  if (coordinator && ['PENDING','ASSIGNED'].includes(rescue.status))
    return 'COORDINATOR';

  if (qualifiesForPending && rescue.status === 'PENDING' &&
      !rescue.assignedUserId && !rescue.awaitingCarer) return 'QUALIFIED_PENDING';
  return null;
}
