export type DesktopRescueViewer = {
  id: string;
  organisationId?: string;
  enabled: boolean;
  status: string;
  roles: string[];
  membershipTypeId?: string;
  teamIds: string[];
};

export type DesktopRescueCase = {
  organisationId?: string | null;
  status: string;
  assignedUserId?: string | null;
  awaitingCarer?: boolean | null;
  transportAnimalId?: string | null;
};

/** Operational worklists show the organisation's pending, assigned and
 * today's completed cases. Assignment/care mutation rights remain separate.
 * Team eligibility still constrains which PENDING jobs may be claimed.
 */
export function canSeeDesktopRescue(
  viewer: DesktopRescueViewer,
  rescue: DesktopRescueCase,
  suitableSpeciesTeam: boolean
): boolean {
  if (!viewer.enabled || viewer.status !== 'ACTIVE' ||
      !viewer.organisationId || rescue.organisationId !== viewer.organisationId ||
      viewer.roles.includes('PUBLIC_REPORTER')) return false;

  if (viewer.roles.some(role =>
    ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN', 'ORG_ADMIN', 'DISPATCHER'].includes(role))) return true;

  // The queue may display colleague assignments and today's completed jobs.
  // This grants read-only queue visibility, not case ownership or care rights.
  if ((rescue.status === 'ASSIGNED' || rescue.status === 'COMPLETED') &&
      viewer.roles.some(role => ['RESCUER', 'CARER'].includes(role))) return true;

  if (rescue.status !== 'PENDING' || rescue.assignedUserId || rescue.awaitingCarer) return false;

  // Keep eligibility independent of the app/server module graph so this
  // pure policy runs identically under Node's strip-types test runner.
  const fieldRescuer = (!viewer.membershipTypeId ||
    viewer.membershipTypeId === 'active-rescuer') &&
    viewer.roles.some(role => ['RESCUER', 'CARER', 'ORG_ADMIN'].includes(role));

  if (rescue.transportAnimalId) {
    return fieldRescuer || viewer.membershipTypeId === 'transport-volunteer';
  }

  return fieldRescuer && suitableSpeciesTeam;
}
