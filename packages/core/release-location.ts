/**
 * An animal release is a separate geographic event from its original rescue.
 * A wilderness release site is identified by a GPS pin, not a street address.
 * Callers choose ORIGINAL_SITE or RELOCATION explicitly; never infer that an
 * address, suburb or reverse-geocode is the authoritative release position.
 */
export type AnimalReleaseReason = 'ORIGINAL_SITE' | 'RELOCATION';
export type AnimalReleasePoint = {
  latitude: number;
  longitude: number;
  location: string;
  releaseReason: AnimalReleaseReason;
};

type RawRelease = {
  latitude?: unknown;
  longitude?: unknown;
  location?: unknown;
  releaseReason?: unknown;
};
type Coordinates = { latitude: number; longitude: number };

export function isValidReleasePoint(coords: unknown): coords is Coordinates {
  if (!coords || typeof coords !== 'object') return false;
  const point = coords as Record<string, unknown>;
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === 'number' && Number.isFinite(point.longitude) &&
    point.longitude >= -180 && point.longitude <= 180 &&
    !(point.latitude === 0 && point.longitude === 0);
}

export function formatReleaseCoordinates(coords: Coordinates): string {
  return `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
}

function metresBetween(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const haversine = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) *
    Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function validateAnimalReleasePoint(raw: RawRelease, original: Coordinates): AnimalReleasePoint {
  if (!isValidReleasePoint(raw))
    throw new Error('Drop a release pin on the map or use the original rescue location.');
  if (raw.releaseReason !== 'ORIGINAL_SITE' && raw.releaseReason !== 'RELOCATION')
    throw new Error('Choose whether the animal was released at its rescue site or relocated.');
  if (raw.location !== undefined && typeof raw.location !== 'string')
    throw new Error('Release site description must be text.');
  const location = (typeof raw.location === 'string' ? raw.location.trim() : '');
  if (location.length > 250) throw new Error('Release site description must be 250 characters or fewer.');
  if (raw.releaseReason === 'ORIGINAL_SITE' && isValidReleasePoint(original) &&
      metresBetween(raw as Coordinates, original) > 100) {
    throw new Error('This release pin is away from the rescue site. Choose relocation instead.');
  }
  // A human-friendly place name is optional for forests, reserves and bushland.
  return {
    latitude: raw.latitude,
    longitude: raw.longitude,
    releaseReason: raw.releaseReason,
    location: location || `GPS ${formatReleaseCoordinates(raw as Coordinates)}`
  };
}
