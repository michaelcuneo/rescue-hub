import { env } from '$env/dynamic/public';
import { chooseReverseGeocode, validRescueCoordinates, type MappedAddress, type RescueCoordinates } from '../../../../core/rescue-location';

// Mapbox temporary geocoding results must not be cached or persisted.

export async function reverseRescueAddress(
  coords: RescueCoordinates, eventFetch: typeof fetch = fetch
): Promise<MappedAddress> {
  const unavailable: MappedAddress = { address: null, precision: 'UNAVAILABLE' };
  if (!validRescueCoordinates(coords)) return unavailable;
  const token = env.PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token) return unavailable;
  return (async () => {
    const query = new URLSearchParams({
      longitude: String(coords.longitude), latitude: String(coords.latitude),
      access_token: token, language: 'en', country: 'au'
    });
    try {
      const response = await eventFetch(`https://api.mapbox.com/search/geocode/v6/reverse?${query}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(4500)
      });
      if (!response.ok) throw new Error(`Mapbox reverse geocode HTTP ${response.status}`);
      return chooseReverseGeocode(await response.json(), coords);
    } catch (error) {
      console.warn('Rescue address lookup unavailable; exact GPS directions remain available.',
        error instanceof Error ? error.message : 'Map service unavailable');
      return unavailable;
    }
  })();
}
