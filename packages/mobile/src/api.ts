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
  return request<{ ok: true; status: User['availabilityStatus'] }>('/api/mobile/availability', {
    method: 'POST',
    body: JSON.stringify({ status })
  });
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
