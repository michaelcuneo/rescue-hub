import { listTriageReports } from './public-reports';
import type { RescueHubUser } from './auth';

/** A report that could not be GPS-routed is not yet a dispatchable rescue.
 * Central coordinators may inspect/retry it in Pending, without publishing
 * unverified organisation ownership or any reporter contact information.
 */
export type RoutingException = {
  id: string;
  animal: string;
  condition: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  routingStatus: string;
  routingReason: string | null;
  areaLabel: string | null;
};

export async function listPendingRoutingExceptions(
  user: Pick<RescueHubUser, 'enabled' | 'status' | 'roles'>
): Promise<RoutingException[]> {
  if (!user.enabled || user.status !== 'ACTIVE' ||
      !user.roles.some(role => ['PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role))) return [];

  const reports = await listTriageReports();
  return reports.filter(report => report.status === 'SUBMITTED').map(report => ({
    id: report.id,
    animal: report.animal,
    condition: report.condition,
    latitude: report.latitude,
    longitude: report.longitude,
    createdAt: report.createdAt,
    routingStatus: report.routingStatus ?? 'UNROUTED',
    routingReason: report.routingReason ?? null,
    areaLabel: report.areaLabel ?? null
  }));
}
