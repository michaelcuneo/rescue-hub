/** Authenticated address hints live in this page only. Never persist them in storage. */
export type RescueAddressResult = {
  address: string | null;
  precision: 'ADDRESS' | 'NEARBY_ADDRESS' | 'STREET' | 'AREA' | 'UNAVAILABLE';
  location: string;
  coordinates: string;
  directionsUrl: string | null;
};
const results = new Map<string, { until: number; request: Promise<RescueAddressResult | null> }>();
const TTL_MS = 2 * 60_000;
const MAX_ENTRIES = 200;

export function clearRescueAddressCache() {
  results.clear();
}
export function getRescueAddress(
  id: string, latitude: number, longitude: number
): Promise<RescueAddressResult | null> {
  const key = `${id}:${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
  const now = Date.now();
  const cached = results.get(key);
  if (cached && cached.until > now) return cached.request;
  if (cached) results.delete(key);
  const request = fetch(`/api/mobile/rescues/${encodeURIComponent(id)}/address`, {
    cache: 'no-store'
  }).then(async response => {
    if (!response.ok) throw new Error(`Address HTTP ${response.status}`);
    return await response.json() as RescueAddressResult;
  }).catch(() => {
    results.delete(key);
    return null;
  });
  if (results.size >= MAX_ENTRIES) results.delete(results.keys().next().value!);
  results.set(key, { until: now + TTL_MS, request });
  return request;
}
