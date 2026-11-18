import type { MappedAddress, RescueCoordinates } from './rescue-location';

/** Provider-independent contract for AWS Location today, G-NAF later. */
export type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function coordinates(input: RescueCoordinates): boolean {
  return Number.isFinite(input.latitude) && Number.isFinite(input.longitude) &&
    Math.abs(input.latitude) <= 90 && Math.abs(input.longitude) <= 180;
}

function australianAddress(record: Record<string, unknown>): boolean {
  const address = object(record.Address);
  const country = object(address?.Country);
  // Country is returned by AWS Places v2, unlike the user's exact GPS location.
  return country?.Code2 === 'AU' || country?.Code3 === 'AUS';
}

function position(value: unknown): RescueCoordinates | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const point = { longitude: value[0] as number, latitude: value[1] as number };
  return coordinates(point) ? point : null;
}

function labelOf(record: Record<string, unknown>): string | null {
  const label = object(record.Address)?.Label ?? record.Title;
  return typeof label === 'string' && label.trim().length >= 3 &&
    label.trim().length <= 250 ? label.trim() : null;
}

export function metresBetween(a: RescueCoordinates, b: RescueCoordinates): number {
  if (!coordinates(a) || !coordinates(b)) return Infinity;
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function resultRows(value: unknown): Record<string, unknown>[] {
  const result = object(value);
  return Array.isArray(result?.ResultItems) ? result.ResultItems.flatMap(row => {
    const data = object(row);
    return data ? [data] : [];
  }) : [];
}

/** Reverse hints describe only a nearby location; a property never replaces the incident GPS pin. */
export function parseAwsReverse(value: unknown, incident: RescueCoordinates): MappedAddress {
  const unavailable: MappedAddress = { address: null, precision: 'UNAVAILABLE' };
  if (!coordinates(incident)) return unavailable;
  const features = resultRows(value).flatMap(row => {
    if (!australianAddress(row)) return [];
    const label = labelOf(row);
    const point = position(row.Position);
    if (!label || !point) return [];
    const metres = metresBetween(incident, point);
    if (metres > 300) return [];
    return [{ label, type: row.PlaceType, metres }];
  }).sort((a, b) => a.metres - b.metres);

  const property = features.find(item => ['PointAddress', 'InterpolatedAddress',
    'SecondaryAddress', 'InferredSecondaryAddress'].includes(String(item.type)));
  if (property) return { address: property.label, precision: 'NEARBY_ADDRESS' };
  const street = features.find(item => item.type === 'Street' || item.type === 'Intersection');
  if (street) return { address: street.label, precision: 'STREET' };
  const area = features.find(item => ['Locality', 'District', 'SubDistrict', 'PostalCode']
    .includes(String(item.type)));
  if (area) return { address: area.label, precision: 'AREA' };
  return unavailable;
}

/**
 * SearchText requires exactly one of BiasPosition, BoundingBox or Circle.
 * When a map centre is available, bias results to that point; otherwise
 * search across the full Australian territory (including remote islands).
 * Country filtering still excludes nearby non-Australian addresses.
 */
export function buildAwsSearchTextRequest(
  term: string, bias?: RescueCoordinates
): Record<string, unknown> {
  const useBias = bias && coordinates(bias) &&
    !(bias.latitude === 0 && bias.longitude === 0);
  return {
    QueryText: term.trim(),
    MaxResults: 5,
    Filter: {
      IncludeCountries: ['AUS'],
      ...(!useBias ? { BoundingBox: [95, -55, 170, 0] } : {})
    },
    ...(useBias ? { BiasPosition: [bias.longitude, bias.latitude] } : {})
  };
}

/** Validate AWS Places v2 SearchText response before using it for rescue intake pins. */
export function parseAwsSearchText(value: unknown): AddressSuggestion[] {
  const items: AddressSuggestion[] = [];
  const seen = new Set<string>();
  for (const row of resultRows(value)) {
    if (!australianAddress(row)) continue;
    const label = labelOf(row);
    const point = position(row.Position);
    const id = row.PlaceId;
    if (!label || !point || typeof id !== 'string' || !id || id.length > 500 ||
        seen.has(id)) continue;
    seen.add(id);
    items.push({ id, label, ...point });
    if (items.length >= 5) break;
  }
  return items;
}
