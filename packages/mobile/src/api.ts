import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

const API_URL = (process.env.EXPO_PUBLIC_RESCUE_HUB_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'rescuehub_session';

export type User = {
  id: string;
  name: string;
  email: string;
  organisationId?: string;
  roles?: string[];
  membershipTypeId?: string;
  teamIds: string[];
  availabilityStatus: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  availabilityPolicy?: AvailabilityPolicy;
};

export type AvailabilityMode = 'ON' | 'OFF' | 'SCHEDULE';
export type Weekday = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';
export type AvailabilityWindow = { start: string; end: string };
export type AvailabilityPolicy = {
  mode: AvailabilityMode;
  timezone: string;
  week: Record<Weekday, { enabled: boolean; windows: AvailabilityWindow[] }>;
};

export type MembershipConfig = {
  organisationId: string;
  membershipTypes: Array<{ id: string; name: string; description: string; active: boolean }>;
  teams: Array<{
    id: string;
    name: string;
    description: string;
    capabilityCode?: string;
    receivesAllRescues: boolean;
    active: boolean;
  }>;
};

export type Rescue = {
  id: string;
  type: string;
  breed?: string;
  location?: string;
  injury?: string;
  latitude: number;
  longitude: number;
  status: string;
  assignedUserId?: string | null;
  transportAnimalId?: string | null;
  transportSourceRescueId?: string | null;
  custodyRole?: 'CUSTODIAN';
  stageLabel?: string;
};

function endpoint(path: string) {
  if (!API_URL) throw new Error('Set EXPO_PUBLIC_RESCUE_HUB_API_URL to your Rescue Hub HTTPS origin.');
  return `${API_URL}${path}`;
}

/** A JSON-only API client that reports outdated deployments without exposing raw HTML errors. */
async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const token = authenticated ? await SecureStore.getItemAsync(TOKEN_KEY) : null;
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {})
    }
  });

  // SvelteKit returns plain text for unsupported HTTP methods and some gateways
  // return HTML for missing routes. Neither should become a JSON Parse error.
  const contentType = response.headers.get('content-type') ?? '';
  const body = await response.text();
  let payload: unknown = null;
  if (contentType.toLowerCase().includes('json') || body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) {
    try { payload = JSON.parse(body); }
    catch { /* A malformed response is handled below. */ }
  }

  const data = payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
  const errorMessage = typeof data?.error === 'string' ? data.error : null;

  if (!response.ok) {
    if ((response.status === 404 || response.status === 405) &&
        (path === '/api/mobile/availability' || path === '/api/mobile/map-config')) {
      throw new Error('The connected Rescue Hub demo server does not yet support this feature. Deploy the latest demo backend.');
    }
    if (errorMessage) throw new Error(errorMessage);
    throw new Error(`Rescue Hub request failed (${response.status}) for ${path}.`);
  }
  if (!data) {
    throw new Error(`Rescue Hub returned a non-JSON response for ${path}. Check that the mobile app is connected to the current demo backend.`);
  }
  return data as T;
}

export type PublicWildlifeReport = {
  id: string;
  animal: string;
  condition: string;
  latitude: number;
  longitude: number;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'CONVERTED';
  createdAt: string;
  rescueId?: string;
  allowMessages?: boolean;
  allowPhoneContact?: boolean;
};

export type ReporterMessage = { id: string; reportId: string; senderUserId: string; senderRole: 'REPORTER' | 'RESCUER'; text: string; createdAt: string };
export async function getRescuerReporterContact(rescueId: string) {
  return request<{ contact: { reportId: string; allowMessages: boolean; allowPhoneContact: boolean; contactPhone: string | null } | null }>(`/api/mobile/rescues/${encodeURIComponent(rescueId)}/reporter-contact`);
}
export async function getReporterConversation(reportId: string) {
  return request<{ items: ReporterMessage[]; role: 'REPORTER' | 'RESCUER'; rescueId: string | null; contactPhone: string | null }>(`/api/public/reports/${encodeURIComponent(reportId)}/messages`);
}
export async function sendReporterMessage(reportId: string, text: string) {
  return request<{ message: ReporterMessage }>(`/api/public/reports/${encodeURIComponent(reportId)}/messages`, { method: 'POST', body: JSON.stringify({ text }) });
}

export async function signupReporter(name: string, email: string, password: string) {
  return request<{ ok: true; message: string }>('/api/public/signup', {
    method: 'POST', body: JSON.stringify({ name, email, password })
  }, false);
}

export async function verifyReporter(email: string, code: string) {
  const result = await request<{ ok: true; token: string; user: User }>('/api/public/verify', {
    method: 'POST', body: JSON.stringify({ email, code })
  }, false);
  await SecureStore.setItemAsync(TOKEN_KEY, result.token);
  return { user: result.user, membership: null };
}

export async function submitPublicReport(
  animal: string, condition: string, latitude: number, longitude: number,
  options: { allowMessages?: boolean; allowPhoneContact?: boolean; contactPhone?: string } = {}
) {
  return request<{ report: PublicWildlifeReport }>('/api/public/reports', {
    method: 'POST', body: JSON.stringify({ animal, condition, latitude, longitude, ...options })
  });
}

export async function myPublicReports() {
  return request<{ items: PublicWildlifeReport[] }>('/api/public/reports');
}

export type SocialProvider = 'google' | 'apple' | 'facebook';

export async function availableSocialProviders() {
  return request<{ providers: SocialProvider[] }>('/api/public/providers', {}, false);
}

function base64Url(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const value = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += alphabet.charAt((value >>> 18) & 63) +
      alphabet.charAt((value >>> 12) & 63) +
      (i + 1 < bytes.length ? alphabet.charAt((value >>> 6) & 63) : '=') +
      (i + 2 < bytes.length ? alphabet.charAt(value & 63) : '=');
  }
  return output.split('+').join('-').split('/').join('_').replace(/=+$/, '');
}

export async function loginSocialReporter(provider: SocialProvider) {
  if (Constants.appOwnership === 'expo') {
    throw new Error('Apple, Google and Facebook sign-in require the installed Rescue Hub development build, not Expo Go.');
  }
  if (!API_URL.startsWith('https://')) throw new Error('Configure the Rescue Hub HTTPS API URL first.');
  const verifier = base64Url(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64
  });
  const challenge = digest.split('+').join('-').split('/').join('_').replace(/=+$/, '');
  const start = `${API_URL}/auth/social/${provider}?mobile=1&code_challenge=${encodeURIComponent(challenge)}`;
  const callback = 'rescuehub://auth';
  const result = await WebBrowser.openAuthSessionAsync(start, callback);
  if (result.type !== 'success') return null;
  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('The sign-in provider did not return a mobile handoff code.');
  const session = await request<{ token: string; user: User; membership: null }>(
    '/api/public/mobile-session', { method: 'POST', body: JSON.stringify({ code, verifier }) }, false
  );
  await SecureStore.setItemAsync(TOKEN_KEY, session.token);
  return { user: session.user, membership: null };
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: User; membership: MembershipConfig | null }>(
    '/api/mobile/session',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false
  );
  await SecureStore.setItemAsync(TOKEN_KEY, result.token);
  return result;
}

export async function restoreSession() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) return null;
  try {
    return await request<{ user: User; membership: MembershipConfig | null }>('/api/mobile/me');
  } catch {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    return null;
  }
}

export async function logout() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function setAvailability(status: User['availabilityStatus']) {
  return request<{ ok: true; status: User['availabilityStatus']; policy: AvailabilityPolicy }>('/api/mobile/availability', {
    method: 'POST',
    body: JSON.stringify({ status })
  });
}

export async function getAvailability() {
  return request<{ policy: AvailabilityPolicy; status: User['availabilityStatus'] }>('/api/mobile/availability');
}

export async function saveAvailability(policy: AvailabilityPolicy) {
  return request<{ ok: true; policy: AvailabilityPolicy; status: User['availabilityStatus'] }>('/api/mobile/availability', {
    method: 'PUT', body: JSON.stringify(policy)
  });
}

export async function getMapConfiguration() {
  return request<{ token: string; style: string; operatingAreasUrl: string }>('/api/mobile/map-config');
}

export async function getRealtimeConfig() {
  return request<{ url: string; apiKey: string }>('/api/realtime');
}

export async function getPushDeviceStatus() {
  return request<{ registeredDevices: number }>('/api/mobile/device');
}

export async function registerDevice(pushToken: string, platform: 'ios' | 'android', deviceName?: string) {
  return request<{ ok: true }>('/api/mobile/device', {
    method: 'POST',
    body: JSON.stringify({ pushToken, platform, deviceName })
  });
}

export type RescueFeedDiagnostics = {
  source: 'appsync' | 'dynamodb-fallback';
  organisationRescues: number;
  pendingRescues: number;
  qualifiedPending: number;
  visibleRescues: number;
  canBrowse: boolean;
  organisationId: string;
  teamIds: string[];
};
export async function getRescues() {
  return request<{ items: Rescue[]; feed?: RescueFeedDiagnostics; truncated?: boolean }>('/api/mobile/rescues');
}

export async function correctReportedRescue(id: string, type: string, injury: string) {
  return request<{ rescue: Rescue }>(`/api/mobile/rescues/${encodeURIComponent(id)}/correction`, { method: 'PATCH', body: JSON.stringify({ type, injury }) });
}
export async function claimRescue(id: string) {
  return request<{ rescue: Rescue }>(`/api/mobile/rescues/${encodeURIComponent(id)}/claim`, {
    method: 'POST'
  });
}
export async function unclaimRescue(id: string, reason = '') {
  return request<{ rescue: Rescue }>(`/api/mobile/rescues/${encodeURIComponent(id)}/unclaim`, {
    method: 'POST', body: JSON.stringify({ reason })
  });
}

export type Animal = {
  id: string; rescueId: string; species: string; description?: string;
  status: 'IN_RESCUE' | 'IN_TRANSIT' | 'AT_VET' | 'IN_CARE' | 'RELEASED' | 'EUTHANISED' | 'DECEASED';
  currentCustodianUserId?: string; currentLocation?: string; pendingTransferId?: string; activeTransportRescueId?: string;
  vetStage?: 'AWAITING_ASSESSMENT' | 'ASSESSED_AWAITING_TRANSPORT';
  version?: number; createdAt: string; updatedAt: string;
};
export async function correctAnimalIdentification(id: string, species: string, description: string) {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({ species, description })
  });
}
export type AnimalEvent = {
  id: string; type: string; actorUserId: string; notes?: string;
  createdAt: string; occurredAt?: string; outcome?: string;
  toUserId?: string; fromUserId?: string;
  callerName?: string; callerRole?: string; source?: string; transportRescueId?: string;
};
export async function getRescueAnimals(rescueId: string) {
  return request<{ items: Animal[] }>(`/api/mobile/rescues/${encodeURIComponent(rescueId)}/animals`);
}
export async function registerAnimal(rescueId: string, species: string, description?: string) {
  return request<{ animal: Animal }>(`/api/mobile/rescues/${encodeURIComponent(rescueId)}/animals`, {
    method: 'POST', body: JSON.stringify({ species, description })
  });
}
export async function getAnimalHistory(id: string) {
  return request<{ animal: Animal; events: AnimalEvent[] }>(`/api/mobile/animals/${encodeURIComponent(id)}`);
}
export async function addAnimalNote(id: string, type: string, notes: string) {
  return request<{ ok: true }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'NOTE', type, notes })
  });
}
export async function requestAnimalTransfer(id: string, recipientUserId: string, location: string, notes: string, purpose: 'CARE' | 'TRANSPORT' = 'CARE') {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'TRANSFER', recipientUserId, location, notes, purpose })
  });
}
export async function acceptAnimalTransfer(id: string) {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'ACCEPT_TRANSFER' })
  });
}
export async function recordVetDropoff(id: string, location: string, notes = '') {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'VET_DROPOFF', location, notes })
  });
}

export async function recordVetAssessment(id: string, notes = '') {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'VET_ASSESSED', notes })
  });
}

export async function recordAnimalOutcome(id: string, status: 'RELEASED' | 'EUTHANISED' | 'DECEASED', notes: string) {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'OUTCOME', status, notes })
  });
}
