/**
 * Geographic routing against the published NSW wildlife-rehabilitation
 * operating-area GeoJSON. Coordinates are [longitude, latitude] (GeoJSON).
 * Never use a reporter's unverified species guess to select an organisation.
 */
export type OperatingAreaFeature = {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  properties: {
    organisationId?: string; organisationName?: string; areaLabel?: string;
    directoryStatus?: string;
  };
};
export type OperatingAreas = { type: 'FeatureCollection'; features: OperatingAreaFeature[] };
export type RouteResult =
  | { status: 'MATCHED'; organisationId: string; areaLabel: string; matchedAreaIds: string[] }
  | { status: 'UNROUTED'; reason: 'NO_COVERAGE' | 'AMBIGUOUS_COVERAGE'; matchedAreaIds: string[] };

type Position = [number, number];
type Ring = Position[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2 &&
    typeof value[0] === 'number' && typeof value[1] === 'number';
}
function onSegment(x: number, y: number, a: Position, b: Position) {
  const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  return Math.abs(cross) <= 1e-10 &&
    x >= Math.min(a[0], b[0]) - 1e-10 && x <= Math.max(a[0], b[0]) + 1e-10 &&
    y >= Math.min(a[1], b[1]) - 1e-10 && y <= Math.max(a[1], b[1]) + 1e-10;
}
function inRing(x: number, y: number, ring: Ring): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if (onSegment(x, y, a, b)) return true;
    if ((a[1] > y) !== (b[1] > y) &&
        x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}
function inPolygon(x: number, y: number, polygon: Polygon) {
  return Boolean(polygon[0] && inRing(x, y, polygon[0]) &&
    !polygon.slice(1).some(hole => inRing(x, y, hole)));
}
function contains(feature: OperatingAreaFeature, x: number, y: number) {
  if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) return false;
  const raw = feature.geometry.coordinates;
  if (!Array.isArray(raw)) return false;
  const polygons = feature.geometry.type === 'Polygon' ? [raw] : raw;
  return polygons.some(polygon => Array.isArray(polygon) && polygon.every(
    (ring: unknown) => Array.isArray(ring) && ring.every(isPosition)
  ) && inPolygon(x, y, polygon as Polygon));
}

export function routeOperatingArea(areas: OperatingAreas, latitude: number, longitude: number): RouteResult {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { status: 'UNROUTED', reason: 'NO_COVERAGE', matchedAreaIds: [] };
  }
  const hits = areas.features.filter(feature =>
    feature.properties?.directoryStatus === 'CURRENT' &&
    Boolean(feature.properties.organisationId?.trim()) &&
    contains(feature, longitude, latitude)
  );
  const ids = [...new Set(hits.map(feature => feature.properties.organisationId!))].sort();
  // The statewide WIRES layer includes an "Unserviced area" polygon;
  // it must not supersede a separately licensed, local operating-area group.
  const local = ids.filter(id => id !== 'wires');
  let match: OperatingAreaFeature | undefined;
  if (local.length === 1) {
    match = hits.find(feature => feature.properties.organisationId === local[0]);
  } else if (local.length === 0) {
    const serviced = hits.filter(feature => feature.properties.organisationId === 'wires' &&
      !/unserviced/i.test(feature.properties.areaLabel ?? ''));
    match = serviced[0];
  }
  if (!match) {
    return { status: 'UNROUTED', reason: local.length > 1 ? 'AMBIGUOUS_COVERAGE' : 'NO_COVERAGE',
      matchedAreaIds: ids };
  }
  return {
    status: 'MATCHED', organisationId: match.properties.organisationId!,
    areaLabel: match.properties.areaLabel ?? match.properties.organisationName ?? 'Licensed operating area',
    matchedAreaIds: ids
  };
}
