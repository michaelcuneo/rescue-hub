import { routeOperatingArea, type OperatingAreas, type RouteResult } from '../../../../core/operating-area-routing';

// The SvelteKit static asset is generated from the NSW DCCEEW layer snapshot.
// We fetch our own versioned asset, never the live ArcGIS service, and retain
// the parsed geometry in a warm Lambda for ten minutes.
const CACHE_MS = 10 * 60_000;
let cached: { expiresAt: number; data: OperatingAreas } | null = null;
let loading: Promise<OperatingAreas> | null = null;

async function loadOperatingAreas(eventFetch: typeof fetch): Promise<OperatingAreas> {
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (!loading) {
    loading = (async () => {
      const response = await eventFetch('/data/operating-areas.geojson', {
        headers: { accept: 'application/geo+json, application/json' }
      });
      if (!response.ok) throw new Error(`NSW coverage snapshot unavailable (${response.status})`);
      const data = await response.json() as OperatingAreas;
      if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
        throw new Error('NSW coverage snapshot is incomplete.');
      }
      cached = { expiresAt: Date.now() + CACHE_MS, data };
      return data;
    })().finally(() => { loading = null; });
  }
  return loading;
}

export async function resolveReportOrganisation(
  eventFetch: typeof fetch, latitude: number, longitude: number
): Promise<RouteResult> {
  return routeOperatingArea(await loadOperatingAreas(eventFetch), latitude, longitude);
}
