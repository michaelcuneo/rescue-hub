/**
 * Weekly rescue availability. Days and windows are interpreted in the user's
 * configured IANA timezone at the instant a decision is made. No scheduler or
 * stale persisted "is available" boolean is involved.
 */
export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Weekday = (typeof DAYS)[number];
export type AvailabilityMode = 'ON' | 'OFF' | 'BUSY' | 'SCHEDULE';
export type AvailabilityWindow = { start: string; end: string };
export type AvailabilityDay = { enabled: boolean; windows: AvailabilityWindow[] };
export type AvailabilityPolicy = {
  mode: AvailabilityMode;
  timezone: string;
  week: Record<Weekday, AvailabilityDay>;
};

const MAX_WINDOWS = 8;
const MAX_TIMEZONE_LENGTH = 80;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const END_TIME = /^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/;

export function defaultAvailabilityPolicy(status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' = 'OFFLINE'): AvailabilityPolicy {
  return {
    mode: status === 'AVAILABLE' ? 'ON' : 'OFF',
    timezone: 'Australia/Sydney',
    week: Object.fromEntries(DAYS.map((day, index) => [
      day, { enabled: index < 5, windows: [{ start: '09:00', end: '17:00' }] }
    ])) as AvailabilityPolicy['week']
  };
}

function minutes(time: string) {
  const [hours, mins] = time.split(':').map(Number);
  return hours * 60 + mins;
}

export function validateAvailabilityPolicy(raw: unknown): AvailabilityPolicy {
  if (!raw || typeof raw !== 'object') throw new Error('Availability settings are required.');
  const value = raw as Record<string, unknown>;
  if (!['ON', 'OFF', 'BUSY', 'SCHEDULE'].includes(String(value.mode))) {
    throw new Error('Choose ON, OFF, BUSY or SCHEDULE.');
  }
  if (typeof value.timezone !== 'string' || !value.timezone || value.timezone.length > MAX_TIMEZONE_LENGTH) {
    throw new Error('Choose a valid timezone.');
  }
  try { new Intl.DateTimeFormat('en-AU', { timeZone: value.timezone }); }
  catch { throw new Error('Choose a valid IANA timezone.'); }

  if (!value.week || typeof value.week !== 'object' || Array.isArray(value.week)) {
    throw new Error('Weekly availability must contain all seven days.');
  }
  const inputWeek = value.week as Record<string, unknown>;
  if (Object.keys(inputWeek).some((day) => !DAYS.includes(day as Weekday))) {
    throw new Error('Unrecognised weekday in availability schedule.');
  }

  const week = {} as AvailabilityPolicy['week'];
  for (const day of DAYS) {
    const rawDay = inputWeek[day];
    if (!rawDay || typeof rawDay !== 'object' || Array.isArray(rawDay)) {
      throw new Error(`Missing availability settings for ${day}.`);
    }
    const entry = rawDay as Record<string, unknown>;
    if (typeof entry.enabled !== 'boolean' || !Array.isArray(entry.windows) || entry.windows.length > MAX_WINDOWS) {
      throw new Error(`Invalid availability windows for ${day}.`);
    }
    const windows: AvailabilityWindow[] = entry.windows.map((rawWindow) => {
      if (!rawWindow || typeof rawWindow !== 'object') throw new Error(`Invalid time on ${day}.`);
      const window = rawWindow as Record<string, unknown>;
      if (typeof window.start !== 'string' || !TIME.test(window.start) ||
          typeof window.end !== 'string' || !END_TIME.test(window.end) ||
          minutes(window.start) === minutes(window.end)) {
        throw new Error(`Use valid start and end times (HH:mm) on ${day}.`);
      }
      return { start: window.start, end: window.end };
    });
    if (entry.enabled && !windows.length) throw new Error(`Add a time window or disable ${day}.`);
    // No overlapping windows on a single day, including overnight ranges.
    const intervals = windows.map(({ start, end }) => {
      const from = minutes(start);
      let to = minutes(end);
      if (to < from) to += 1440;
      return { from, to };
    }).sort((a, b) => a.from - b.from);
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i].from < intervals[i - 1].to) {
        throw new Error(`Overlapping availability windows on ${day}.`);
      }
    }
    week[day] = { enabled: entry.enabled, windows };
  }
  return { mode: value.mode as AvailabilityMode, timezone: value.timezone, week };
}

export function readAvailabilityPolicy(raw: unknown): AvailabilityPolicy | null {
  if (raw === undefined || raw === null) return null;
  try { return validateAvailabilityPolicy(raw); }
  catch { return null; } // Fail closed if an existing policy is corrupt.
}

export function effectiveAvailability(
  user: { availabilityStatus?: 'AVAILABLE' | 'BUSY' | 'OFFLINE'; availabilityPolicy?: unknown },
  now: Date = new Date()
): 'AVAILABLE' | 'OFFLINE' | 'BUSY' {
  if (user.availabilityPolicy === undefined || user.availabilityPolicy === null) {
    return user.availabilityStatus ?? 'OFFLINE'; // Legacy accounts retain their previous manual mode.
  }
  const policy = readAvailabilityPolicy(user.availabilityPolicy);
  if (!policy) return 'OFFLINE';
  if (policy.mode === 'ON') return 'AVAILABLE';
  if (policy.mode === 'OFF') return 'OFFLINE';
  if (policy.mode === 'BUSY') return 'BUSY';

  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: policy.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now).map((part) => [part.type, part.value])
  );
  const dayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(String(values.weekday));
  if (dayIndex < 0) return 'OFFLINE';
  const minute = Number(values.hour) * 60 + Number(values.minute);
  const matches = (day: AvailabilityDay, priorDay = false) => day.enabled && day.windows.some(({ start, end }) => {
    const from = minutes(start);
    const to = minutes(end);
    return priorDay ? to < from && minute < to : minute >= from && (to > from ? minute < to : true);
  });

  if (matches(policy.week[DAYS[dayIndex]])) return 'AVAILABLE';
  if (matches(policy.week[DAYS[(dayIndex + 6) % 7]], true)) return 'AVAILABLE';
  return 'OFFLINE';
}
