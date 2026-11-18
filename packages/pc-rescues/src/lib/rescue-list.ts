/**
 * Shared display-only rescue list organisation.
 * Filters use the original report time rather than updatedAt: an old case
 * must not look new just because somebody added a care note.
 */
export type RescuePeriod = 'all' | 'today' | 'seven_days' | 'older';
export type RescueOrder = 'oldest' | 'newest';

export type DatedRescue = {
  id: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export const RESCUE_LIST_PAGE_SIZE = 25;

export function rescueCreatedAt(item: Pick<DatedRescue, 'createdAt' | 'updatedAt'>): number {
  const value = item.createdAt || item.updatedAt;
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function localMidnight(time: number, daysBack = 0): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysBack);
  return date.getTime();
}

export function matchesRescuePeriod(
  item: Pick<DatedRescue, 'createdAt' | 'updatedAt'>,
  period: RescuePeriod,
  now = Date.now()
): boolean {
  if (period === 'all') return true;
  const day = rescueReportedNSWDay(item);
  if (!day) return false;
  const today = rescueTodayNSW(now);
  if (period === 'today') return day === today;
  const start = shiftRescueDay(today, -6);
  return period === 'seven_days' ? day >= start && day <= today : day < start;
}

export function rescueDayGroup(
  item: Pick<DatedRescue, 'createdAt' | 'updatedAt'>,
  now = Date.now()
): string {
  const timestamp = rescueCreatedAt(item);
  if (!timestamp) return 'Date not recorded';
  if (timestamp >= localMidnight(now)) return 'Today';
  if (timestamp >= localMidnight(now, 1)) return 'Yesterday';
  if (timestamp >= localMidnight(now, 6)) return 'Previous 7 days';
  return 'Older reports';
}

export function sortRescueRecords<T extends DatedRescue>(
  items: readonly T[],
  order: RescueOrder
): T[] {
  const multiplier = order === 'oldest' ? 1 : -1;
  return [...items].sort((a, b) =>
    multiplier * (rescueCreatedAt(a) - rescueCreatedAt(b)) || a.id.localeCompare(b.id)
  );
}

/** This is a waiting-time indicator, not a clinical urgency assessment. */
export function isWaitingFourHours(item: DatedRescue, now = Date.now()): boolean {
  const timestamp = rescueCreatedAt(item);
  return timestamp > 0 && now - timestamp >= 4 * 60 * 60 * 1000;
}


/** Dispatch boards follow NSW calendar dates, regardless of the viewer's device timezone. */
export function rescueNSWDay(value?: string | number | Date | null): string | null {
  if (value == null || value === '') return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(timestamp);
  const field = (name: string) => parts.find(part => part.type === name)?.value;
  return `${field('year')}-${field('month')}-${field('day')}`;
}

export function rescueTodayNSW(now = Date.now()): string {
  return rescueNSWDay(now)!;
}

/** Uses UTC noon to avoid DST transitions while navigating a calendar date. */
export function shiftRescueDay(day: string, amount: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount, 12)).toISOString().slice(0, 10);
}

export function rescueDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, date, 12)));
}

/** Determines the day a rescue was reported, never the day its record last changed. */
export function rescueReportedNSWDay(item: Pick<DatedRescue, 'createdAt' | 'updatedAt'>): string | null {
  return rescueNSWDay(item.createdAt ?? item.updatedAt);
}

/** Operations shows COMPLETED cases only when they were completed on the
 * current NSW calendar day, regardless of the original report date.
 * Older rows may not have completedAt; use updatedAt for legacy records.
 */
export function completedOnNSWDay(
  item: { status?: string | null; completedAt?: string | null; updatedAt?: string | null },
  day: string
): boolean {
  return item.status === 'COMPLETED'
    && rescueNSWDay(item.completedAt ?? item.updatedAt) === day;
}

