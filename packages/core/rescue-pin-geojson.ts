/**
 * Rescue pins are geographic GeoJSON *points*, not free-moving HTML elements.
 * Mapbox renders these features in the same camera projection as the map.
 * Input coordinates are never changed by pan, zoom or selection.
 */
export type RescuePinRecord = {
  id: string;
  type: string;
  status: string;
  latitude: number;
  longitude: number;
  color: string;
  initials: string;
};
export type RescuePinFeature = {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: { id: string; type: string; status: string; color: string; initials: string };
};
export type RescuePinCollection = {
  type: 'FeatureCollection';
  features: RescuePinFeature[];
};

/** GeoJSON and Mapbox always use [longitude, latitude] (not [latitude, longitude]). */
export function createRescuePinCollection(rows: readonly RescuePinRecord[]): RescuePinCollection {
  const seen = new Set<string>();
  const features: RescuePinFeature[] = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || seen.has(row.id) ||
      !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude) ||
      Math.abs(row.latitude) > 90 || Math.abs(row.longitude) > 180) continue;
    seen.add(row.id);
    features.push({
      type: 'Feature',
      id: row.id,
      geometry: { type: 'Point', coordinates: [row.longitude, row.latitude] },
      properties: {
        id: row.id, type: row.type, status: row.status,
        color: row.color, initials: row.initials
      }
    });
  }
  return { type: 'FeatureCollection', features };
}
