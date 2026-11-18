import type { MappedAddress, RescueCoordinates } from './rescue-location';

// Type-only import works in both SvelteKit and Node's strip-types test runner.
// Keep this small guard local so the module has no runtime imports.
function validGeocodingCoordinates(input: RescueCoordinates): boolean {
  return Number.isFinite(input.latitude) && Number.isFinite(input.longitude) &&
    input.latitude >= -90 && input.latitude <= 90 &&
    input.longitude >= -180 && input.longitude <= 180;
}

/** Wire contract for our independent, G-NAF-derived geocoder. No Mapbox data. */
export type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function addressLabel(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length >= 3 &&
    value.trim().length <= 250 ? value.trim() : null;
}

export function metresBetween(a: RescueCoordinates, b: RescueCoordinates): number {
  if (!validGeocodingCoordinates(a) || !validGeocodingCoordinates(b)) return Infinity;
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** G-NAF points can be nearby properties, never proof of the rescue's street number. */
export function parseGnafReverse(value: unknown, incident: RescueCoordinates): MappedAddress {
  const unavailable: MappedAddress = { address: null, precision: 'UNAVAILABLE' };
  const result = record(value);
  if (!result || result.source !== 'GNAF' || !validGeocodingCoordinates(incident)) return unavailable;
  const address = addressLabel(result.address);
  const point = { latitude: result.latitude as number, longitude: result.longitude as number };
  if (!address || !validGeocodingCoordinates(point)) return unavailable;
  const distance = metresBetween(incident, point);
  // Beyond 300 m, a numbered property is actively misleading for wildlife reports.
  if (distance > 300) return unavailable;
  return { address, precision: 'NEARBY_ADDRESS' };
}

/** Validate backend data before it can supply a saved rescue location. */
export function parseGnafSuggestions(value: unknown): AddressSuggestion[] {
  const response = record(value);
  if (!response || response.source !== 'GNAF' || !Array.isArray(response.results)) return [];
  const seen = new Set<string>();
  const suggestions: AddressSuggestion[] = [];
  for (const item of response.results) {
    const row = record(item);
    const label = addressLabel(row?.label);
    const id = typeof row?.id === 'string' && row.id.length <= 120 ? row.id : null;
    const latitude = row?.latitude as number;
    const longitude = row?.longitude as number;
    if (!id || !label || seen.has(id) || !validGeocodingCoordinates({ latitude, longitude })) continue;
    seen.add(id);
    suggestions.push({ id, label, latitude, longitude });
    if (suggestions.length === 5) break;
  }
  return suggestions;
}
