import { Resource } from 'sst';

// SST generates this custom Linkable type during sst dev/deploy. CI installs
// dependencies without an SST stage, so validate its linked runtime shape
// instead of depending on an uncommitted generated sst-env.d.ts.
export function getRealtimeResource(): { url: string; apiKey: string } {
  const links = Resource as unknown as Record<string, unknown>;
  const value = links.RescueHubRealtime;
  if (!value || typeof value !== 'object') {
    throw new Error('RescueHubRealtime is not linked to the web server.');
  }
  const realtime = value as Record<string, unknown>;
  if (typeof realtime.url !== 'string' || !realtime.url.startsWith('https://') ||
      typeof realtime.apiKey !== 'string' || !realtime.apiKey) {
    throw new Error('RescueHubRealtime has no valid URL or subscription key.');
  }
  return { url: realtime.url, apiKey: realtime.apiKey };
}
