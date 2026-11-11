import { env } from '$env/dynamic/public';
import { chooseReverseGeocode, validRescueCoordinates, type MappedAddress, type RescueCoordinates } from '../../../../core/rescue-location';

// Short-lived in-process cache prevents repeated Mapbox requests from the same
// Lambda. This is only temporary geocoding: no DynamoDB, disk or durable writes.
const TTL = 10 * 60_000;
const LIMIT = 250;
const cache = new Map<string, { until: number; value: MappedAddress }>();
const inflight = new Map<string, Promise<MappedAddress>>();

function key(coords: RescueCoordinates) {
  return `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`;
}

export async function reverseRescueAddress(
  coords: RescueCoordinates, eventFetch: typeof fetch = fetch
): Promise<MappedAddress> {
  const unavailable: MappedAddress = { address: null, precision: 'UNAVAILABLE' };
  if (!validRescueCoordinates(coords)) return unavailable;
  const id = key(coords);
  const existing = cache.get(id);
  if (existing && existing.until > Date.now()) return existing.value;
  if (inflight.has(id)) return inflight.get(id)!;

  const token = env.PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return unavailable;
  const task = (async () => {
    const query = new URLSearchParams({
      longitude: String(coords.longitude), latitude: String(coords.latitude),
      access_token: token, language: 'en', limit: '5',
      types: 'address,street,locality,place'
    });
    try {
      const response = await eventFetch(`https://api.mapbox.com/search/geocode/v6/reverse?${query}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(4500)
      });
      if (!response.ok) throw new Error(`Mapbox reverse geocode HTTP ${response.status}`);
      const result = chooseReverseGeocode(await response.json(), coords);
      if (cache.size >= LIMIT) cache.delete(cache.keys().next().value!);
      cache.set(id, { value: result, until: Date.now() + TTL });
      return result;
    } catch (error) {
      console.warn('Rescue address lookup unavailable; exact GPS directions remain available.',
        error instanceof Error ? error.message : 'Map service unavailable');
      return unavailable;
    }
  })().finally(() => inflight.delete(id));
  inflight.set(id, task);
  return task;
}
