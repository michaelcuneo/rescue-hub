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

/** Dispatchers coordinate organisation jobs. Volunteers do not browse others'
 * assignments or completed records. Team/capability matching is applied only
 * to unclaimed, available species rescue work.
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

  if (rescue.assignedUserId === viewer.id &&
      (rescue.status === 'ASSIGNED' || rescue.status === 'COMPLETED')) return true;

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
