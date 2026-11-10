import * as SecureStore from 'expo-secure-store';

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
};

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
  animal: string, condition: string, latitude: number, longitude: number
) {
  return request<{ report: PublicWildlifeReport }>('/api/public/reports', {
    method: 'POST', body: JSON.stringify({ animal, condition, latitude, longitude })
  });
}

export async function myPublicReports() {
  return request<{ items: PublicWildlifeReport[] }>('/api/public/reports');
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
  currentCustodianUserId?: string; currentLocation?: string; pendingTransferId?: string;
  vetStage?: 'AWAITING_ASSESSMENT' | 'ASSESSED_AWAITING_TRANSPORT';
  createdAt: string; updatedAt: string;
};
export type AnimalEvent = {
  id: string; type: string; actorUserId: string; notes?: string;
  createdAt: string; occurredAt?: string; outcome?: string;
  toUserId?: string; fromUserId?: string;
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
