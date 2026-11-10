import { getPublicReport } from './public-reports';
import type { Rescue } from './graphql';
import type { RescueHubUser } from './auth';

/** Never expose reporter contact information to ordinary organisation members
 * or to someone who merely browses the unclaimed rescue map.
 */
export async function getAssignedReporterContact(rescue: Rescue, user: RescueHubUser) {
  if (!rescue.id.startsWith('public-report-') || !rescue.organisationId ||
      rescue.organisationId !== user.organisationId || rescue.assignedUserId !== user.id ||
      !user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.some(role => role === 'RESCUER' || role === 'CARER')) return null;
  const reportId = rescue.id.slice('public-report-'.length);
  const report = await getPublicReport(reportId);
  if (!report || report.rescueId !== rescue.id ||
      report.organisationId !== rescue.organisationId ||
      (!report.allowMessages && !report.allowPhoneContact)) return null;
  return {
    reportId, allowMessages: report.allowMessages === true,
    allowPhoneContact: report.allowPhoneContact === true,
    contactPhone: report.allowPhoneContact ? report.contactPhone ?? null : null
  };
}
