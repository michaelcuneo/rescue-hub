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

/** Operational visibility is organisation-scoped: all pending, assigned,
 * and (today's) completed rescue summaries. Claim eligibility and care write
 * access remain separate server-side checks.
 */
export function canSeeDesktopRescue(
  viewer: DesktopRescueViewer,
  rescue: DesktopRescueCase,
  _suitableSpeciesTeam: boolean
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

  if (rescue.status !== 'PENDING') return false;
  // Rescue jobs are visible across trained species teams; authorisation to
  // claim, transport or manage an animal is independently enforced by the API.
  const trainedFieldMember = viewer.roles.some(role => ['RESCUER', 'CARER'].includes(role))
    && !['support-member', 'probationary-rescuer', 'transport-volunteer'].includes(viewer.membershipTypeId ?? '');
  return trainedFieldMember
    || (viewer.membershipTypeId === 'transport-volunteer' && Boolean(rescue.transportAnimalId));
}
