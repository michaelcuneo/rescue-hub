/**
 * Coordinates are the authoritative incident destination. Reverse geocoding
 * provides orientation only; an estimated street number must never move a pin.
 */
export type RescueCoordinates = { latitude: number; longitude: number };
export type AddressPrecision = 'ADDRESS' | 'NEARBY_ADDRESS' | 'STREET' | 'AREA' | 'UNAVAILABLE';
export type MappedAddress = { address: string | null; precision: AddressPrecision };

export function validRescueCoordinates(input: RescueCoordinates): boolean {
  return Number.isFinite(input.latitude) && Number.isFinite(input.longitude) &&
    input.latitude >= -90 && input.latitude <= 90 &&
    input.longitude >= -180 && input.longitude <= 180;
}

export function rescueDirectionsUrl(input: RescueCoordinates): string | null {
  if (!validRescueCoordinates(input)) return null;
  // Universal URL: works in browsers and opens Google Maps on Android/iOS
  // where installed. Use the precise rescue pin, never geocoded neighbours.
  const destination = `${input.latitude.toFixed(6)},${input.longitude.toFixed(6)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function formatRescueCoordinates(input: RescueCoordinates): string {
  return validRescueCoordinates(input)
    ? `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}`
    : 'GPS unavailable';
}

function distanceMetres(a: RescueCoordinates, b: RescueCoordinates): number {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

type MappedFeature = {
  properties?: { feature_type?: string; full_address?: string; name?: string; place_formatted?: string };
  geometry?: { coordinates?: number[] };
};

/** A pure parser; feed only the Mapbox v6 reverse feature collection.
 * Mapbox temporary geocodes must be displayed on demand, never persisted.
 */
export function chooseReverseGeocode(
  value: unknown,
  incident: RescueCoordinates
): MappedAddress {
  if (!validRescueCoordinates(incident) || !value || typeof value !== 'object')
    return { address: null, precision: 'UNAVAILABLE' };

  const features = (value as { features?: unknown }).features;
  if (!Array.isArray(features)) return { address: null, precision: 'UNAVAILABLE' };

  const parsed: Array<{ address: string; type: string; metres: number }> = [];
  for (const item of features) {
    if (!item || typeof item !== 'object') continue;
    const feature = item as MappedFeature;
    const props = feature.properties;
    const type = props?.feature_type;
    if (!type || !['address', 'street', 'locality', 'place'].includes(type)) continue;
    const fullAddress = typeof props?.full_address === 'string' ? props.full_address.trim() : '';
    const name = typeof props?.name === 'string' ? props.name.trim() : '';
    const context = typeof props?.place_formatted === 'string' ? props.place_formatted.trim() : '';
    const address = (fullAddress || [name, context].filter(Boolean).join(', ')).slice(0, 250);
    if (!address) continue;
    const coords = feature.geometry?.coordinates;
    const point = { longitude: Number(coords?.[0]), latitude: Number(coords?.[1]) };
    const metres = validRescueCoordinates(point) ? distanceMetres(incident, point) : Infinity;
    parsed.push({ address, type, metres });
  }

  const exact = parsed.find(f => f.type === 'address' && f.metres <= 75);
  if (exact) return { address: exact.address, precision: 'ADDRESS' };

  const street = parsed.find(f => f.type === 'street');
  const near = parsed.find(f => f.type === 'address' && f.metres <= 300);
  if (street && street.metres <= 2000) return { address: street.address, precision: 'STREET' };
  if (near) return { address: near.address, precision: 'NEARBY_ADDRESS' };

  const locality = parsed.find(f => f.type === 'locality' || f.type === 'place');
  if (locality) return { address: locality.address, precision: 'AREA' };
  return { address: null, precision: 'UNAVAILABLE' };
}

export function isPlaceholderRescueLocation(input?: string | null): boolean {
  if (!input?.trim()) return true;
  return /^(?:public wildlife report \(pin location\)|current map location|map pin|selected location|gps coordinates?|pin location)$/i.test(input.trim());
}

export function locationFallback(input?: string | null): string {
  return isPlaceholderRescueLocation(input) ? 'Street address not identified' : input!.trim();
}

export function addressPrecisionLabel(precision: AddressPrecision): string {
  switch (precision) {
    case 'ADDRESS': return 'Mapped street address';
    case 'NEARBY_ADDRESS': return 'Nearby address (approximate)';
    case 'STREET': return 'Nearest mapped road (approximate)';
    case 'AREA': return 'Mapped locality (approximate)';
    default: return 'Address unavailable — follow the GPS pin';
  }
}
