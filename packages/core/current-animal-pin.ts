/** One operational map marker per rescue/case: best *recorded* animal location.
 * A fallback to the report location is never proof of the animal's whereabouts.
 * Full per-animal custody history remains separate from incident dispatch status.
 */
export type MapPoint = { latitude: number; longitude: number; label: string; kind: 'reported' | 'checkpoint' | 'release'; recordedAt?: string };
export type RescueMapProjection = {
  latitude: number; longitude: number; location?: string | null;
  animalStatus?: string | null; historicalOutcome?: string | null;
  historicalReleaseLatitude?: number | null; historicalReleaseLongitude?: number | null;
  historicalReleaseLocation?: string | null;
  releaseSites?: Array<{ latitude: number; longitude: number; location?: string; releasedAt?: string }> | null;
  latestAnimalGps?: {
    animalId?: string; latitude: number; longitude: number; recordedAt?: string;
    phase?: string; location?: string
  } | null;
};
function valid(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && typeof longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
    (latitude !== 0 || longitude !== 0);
}
export function currentAnimalPin(rescue: RescueMapProjection): MapPoint {
  const gps = rescue.latestAnimalGps;
  const releases = (rescue.releaseSites ?? []).filter(site => valid(site.latitude, site.longitude))
    .sort((a, b) => String(b.releasedAt ?? '').localeCompare(String(a.releasedAt ?? '')));
  const latestRelease = releases[0];
  const historical = rescue.historicalOutcome === 'RELEASED' &&
    valid(rescue.historicalReleaseLatitude, rescue.historicalReleaseLongitude)
    ? {
        latitude: rescue.historicalReleaseLatitude!, longitude: rescue.historicalReleaseLongitude!,
        location: rescue.historicalReleaseLocation ?? 'Recorded wildlife release',
        releasedAt: undefined
      } : null;
  const release = latestRelease ?? historical;
  const gpsValid = gps && valid(gps.latitude, gps.longitude);
  const latestReleaseAt = release?.releasedAt ? Date.parse(release.releasedAt) : NaN;
  const gpsAt = gps?.recordedAt ? Date.parse(gps.recordedAt) : NaN;
  // An explicit terminal release is the final observed destination, even
  // when an older transport GPS checkpoint remains on the rescue projection.
  if (release && (rescue.animalStatus === 'RELEASED' || rescue.historicalOutcome === 'RELEASED' ||
    !gpsValid || (Number.isFinite(latestReleaseAt) && Number.isFinite(gpsAt) && latestReleaseAt >= gpsAt))) {
    return { latitude: release.latitude, longitude: release.longitude,
      kind: 'release', label: release.location || 'Recorded release location',
      ...(release.releasedAt ? { recordedAt: release.releasedAt } : {}) };
  }
  if (gpsValid) {
    return { latitude: gps.latitude, longitude: gps.longitude, kind: 'checkpoint',
      label: gps.location || ('Recorded ' + String(gps.phase ?? 'animal').replaceAll('_', ' ').toLowerCase() + ' location'),
      ...(gps.recordedAt ? { recordedAt: gps.recordedAt } : {}) };
  }
  return { latitude: rescue.latitude, longitude: rescue.longitude,
    kind: 'reported', label: rescue.location || 'Original injury report location' };
}
