import * as SecureStore from 'expo-secure-store';

const API_URL = (process.env.EXPO_PUBLIC_RESCUE_HUB_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'rescuehub_session';

export type User = {
  id: string;
  name: string;
  email: string;
  organisationId?: string;
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
};

function endpoint(path: string) {
  if (!API_URL) throw new Error('Set EXPO_PUBLIC_RESCUE_HUB_API_URL to your Rescue Hub HTTPS origin.');
  return `${API_URL}${path}`;
}

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
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Request failed: ${response.status}`);
  return payload as T;
}

export async function login(email: string, password: string) {
  const result = await request<{ token: string; user: User; membership: MembershipConfig }>(
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
    return await request<{ user: User; membership: MembershipConfig }>('/api/mobile/me');
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

export async function registerDevice(pushToken: string, platform: 'ios' | 'android', deviceName?: string) {
  return request<{ ok: true }>('/api/mobile/device', {
    method: 'POST',
    body: JSON.stringify({ pushToken, platform, deviceName })
  });
}

export async function getRescues() {
  return request<{ items: Rescue[] }>('/api/mobile/rescues');
}

export async function claimRescue(id: string) {
  return request<{ rescue: Rescue }>(`/api/mobile/rescues/${encodeURIComponent(id)}/claim`, {
    method: 'POST'
  });
}

export type Animal = {
  id: string; rescueId: string; species: string; description?: string;
  status: 'IN_RESCUE' | 'IN_TRANSIT' | 'AT_VET' | 'IN_CARE' | 'RELEASED' | 'EUTHANISED' | 'DECEASED';
  currentCustodianUserId?: string; currentLocation?: string; pendingTransferId?: string;
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
export async function requestAnimalTransfer(id: string, recipientUserId: string, location: string, notes: string) {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'TRANSFER', recipientUserId, location, notes })
  });
}
export async function acceptAnimalTransfer(id: string) {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'ACCEPT_TRANSFER' })
  });
}
export async function recordAnimalOutcome(id: string, status: 'RELEASED' | 'EUTHANISED' | 'DECEASED', notes: string) {
  return request<{ animal: Animal }>(`/api/mobile/animals/${encodeURIComponent(id)}/events`, {
    method: 'POST', body: JSON.stringify({ kind: 'OUTCOME', status, notes })
  });
}
