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
  const timestamp = rescueCreatedAt(item);
  if (!timestamp) return false;
  if (period === 'today') return timestamp >= localMidnight(now);
  const weekStart = localMidnight(now, 6);
  return period === 'seven_days' ? timestamp >= weekStart : timestamp < weekStart;
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
