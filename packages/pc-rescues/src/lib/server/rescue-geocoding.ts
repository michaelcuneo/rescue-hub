import { env } from '$env/dynamic/private';
import {
  parseGnafReverse, parseGnafSuggestions, type AddressSuggestion
} from '../../../../core/geocoding';
import { validRescueCoordinates, type MappedAddress, type RescueCoordinates } from '../../../../core/rescue-location';

/** Only our independently licensed G-NAF service is permitted here.
 * No Mapbox fallback: it would leak Mapbox-derived addresses onto MapLibre.
 */
async function geocoderRequest(
  path: '/reverse' | '/search', query: URLSearchParams, eventFetch: typeof fetch
): Promise<unknown | null> {
  const base = env.RESCUE_GEOCODER_URL?.trim();
  const token = env.RESCUE_GEOCODER_TOKEN?.trim();
  if (!base || !token) return null;
  try {
    const url = new URL(base);
    if (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
      throw new Error('Geocoder must use HTTPS outside local development');
    }
    url.pathname = url.pathname.replace(/\/$/, '') + path;
    url.search = query.toString();
    const response = await eventFetch(url.toString(), {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4500),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Independent G-NAF geocoder unavailable; GPS pin remains authoritative.',
      error instanceof Error ? error.message : 'Service unavailable');
    return null;
  }
}

export async function reverseRescueAddress(
  coords: RescueCoordinates, eventFetch: typeof fetch = fetch
): Promise<MappedAddress> {
  if (!validRescueCoordinates(coords)) return { address: null, precision: 'UNAVAILABLE' };
  const query = new URLSearchParams({
    latitude: String(coords.latitude), longitude: String(coords.longitude)
  });
  return parseGnafReverse(await geocoderRequest('/reverse', query, eventFetch), coords);
}

export async function searchRescueAddresses(
  term: string, eventFetch: typeof fetch = fetch
): Promise<AddressSuggestion[]> {
  if (term.trim().length < 3 || term.length > 120) return [];
  const query = new URLSearchParams({ q: term.trim(), limit: '5' });
  return parseGnafSuggestions(await geocoderRequest('/search', query, eventFetch));
}
