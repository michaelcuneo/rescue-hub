import { createRescue, getOrganisation, getRescue } from './graphql';
import { getPublicReport, markPublicReportConverted } from './public-reports';
import { notifyEligibleRescuers } from './push';
import { resolveReportOrganisation } from './operating-area-resolver';

export class PublicReportRoutingError extends Error {
  constructor(message: string, public readonly code: 'NOT_FOUND' | 'ALREADY_CONVERTED' | 'NO_COVERAGE' | 'AMBIGUOUS_COVERAGE' | 'UNKNOWN_ORGANISATION' | 'CONFLICT') {
    super(message);
  }
}

/**
 * No caller chooses the organisation. It is recalculated on the server from
 * the pinned incident coordinates at conversion time.
 *
 * Stable rescue IDs and the conditional AppSync create avoid duplicate rescues.
 * Retrying a partially completed conversion reconciles the existing rescue.
 */
export async function dispatchPublicReport(id: string, eventFetch: typeof fetch) {
  const report = await getPublicReport(id);
  if (!report) throw new PublicReportRoutingError('Report not found.', 'NOT_FOUND');
  if (report.status === 'CONVERTED') throw new PublicReportRoutingError('Report already dispatched.', 'ALREADY_CONVERTED');

  const route = await resolveReportOrganisation(eventFetch, report.latitude, report.longitude);
  if (route.status !== 'MATCHED') {
    throw new PublicReportRoutingError(
      route.reason === 'AMBIGUOUS_COVERAGE'
        ? 'This location overlaps several authorised operating areas. Refer to the jurisdictional coordinator.'
        : 'No verified operating organisation covers this location. Refer to the jurisdictional coordinator.',
      route.reason
    );
  }
  const organisationId = route.organisationId;
  const organisation = await getOrganisation(organisationId);
  if (!organisation) {
    throw new PublicReportRoutingError('The GPS-matched organisation is not in the active directory. Refer to the jurisdictional coordinator.', 'UNKNOWN_ORGANISATION');
  }

  const rescueId = `public-report-${report.id}`;
  let rescue = await getRescue(rescueId);
  if (!rescue) {
    try {
      rescue = await createRescue({
        id: rescueId, organisationId, type: report.animal,
        injury: report.condition, location: 'Public wildlife report (pin location)',
        latitude: report.latitude, longitude: report.longitude, status: 'PENDING'
      });
    } catch (error) {
      // A concurrent request might have won the conditional put.
      rescue = await getRescue(rescueId);
      if (!rescue) throw error;
    }
  }
  if (rescue.organisationId !== organisationId) {
    throw new PublicReportRoutingError('Existing rescue ownership conflicts with the verified operating-area boundary.', 'CONFLICT');
  }

  try {
    await markPublicReportConverted(report.id, rescue.id, organisationId);
  } catch (error) {
    const current = await getPublicReport(report.id);
    if (current?.status !== 'CONVERTED' || current.rescueId !== rescue.id ||
        current.organisationId !== organisationId) throw error;
  }

  const notification = await notifyEligibleRescuers({
    id: rescue.id, organisationId, type: rescue.type, injury: rescue.injury ?? undefined,
    location: rescue.location ?? undefined, breed: rescue.breed ?? undefined
  }).catch(error => {
    console.error('Public report rescue notifications failed:', error);
    return null;
  });
  return { rescue, route, notification };
}
