import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { Rescue, RescueStatus } from './graphql';
import { mapRescueItems, sydneyMidnightUtc } from './admin-data';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;
const PAGE_SIZE = 25;
const QUERY_BATCH_SIZE = 100;
// A text search can be sparse. A bounded read budget keeps one HTTP request
// responsive; the returned cursor always permits continuing deeper.
const MAX_EVALUATED_PER_REQUEST = 2000;

export type ArchiveStatus = RescueStatus | 'active' | 'all';
export type ArchivePeriod = 'all' | 'today' | 'seven_days' | 'older' | 'selected_day';
export type ArchiveOrder = 'oldest' | 'newest';
export type ArchiveFilters = {
  query: string;
  status: ArchiveStatus;
  period: ArchivePeriod;
  day: string;
  order: ArchiveOrder;
  organisationId: string | null;
};
export type ArchivePage = {
  items: Rescue[];
  nextToken: string | null;
  examined: number;
  hasMore: boolean;
};

type Cursor = {
  v: 1;
  fingerprint: string;
  lastKey: Record<string, unknown>;
};

export class ArchiveRequestError extends Error {}

// Archive searches may match a responder's name, including a responder who
// joined years ago. Fetch the complete projected name directory (not the
// first 1 MB from listUsers) and reuse it briefly within warm Lambda instances.
const responderNameCache = new Map<string, {
  expiresAt: number;
  names: Map<string, string>;
}>();

export async function listArchiveResponderNames(organisationId: string | null): Promise<Map<string, string>> {
  const cacheKey = organisationId ?? 'ALL';
  const cache = responderNameCache.get(cacheKey);
  if (cache && cache.expiresAt > Date.now()) return cache.names;

  const names = new Map<string, string>();
  let cursor: Record<string, any> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :users',
      ExpressionAttributeValues: { ':users': 'USERS' },
      ExpressionAttributeNames: { '#name': 'name' },
      ProjectionExpression: 'id, #name, organisationId',
      ExclusiveStartKey: cursor
    }));
    for (const row of result.Items ?? []) {
      if (typeof row.id !== 'string' || typeof row.name !== 'string') continue;
      if (organisationId && row.organisationId !== organisationId) continue;
      names.set(row.id, row.name);
    }
    cursor = result.LastEvaluatedKey;
  } while (cursor);

  responderNameCache.set(cacheKey, { names, expiresAt: Date.now() + 60_000 });
  return names;
}

function utcDayShift(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(`${day}T12:00:00Z`))
    && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day;
}

function todayNSW(): string {
  const values = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const part = (name: string) => values.find(p => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function parseArchiveFilters(params: URLSearchParams, permittedOrganisation: string | null): ArchiveFilters {
  const status = params.get('status') ?? 'all';
  const period = params.get('period') ?? 'all';
  const order = params.get('order') ?? 'newest';
  const day = params.get('date') || todayNSW();
  const query = (params.get('q') ?? '').trim().replace(/^#/, '').replace(/\s+/g, ' ').toLocaleLowerCase('en-AU');
  const org = (params.get('organisation') ?? 'all').trim();
  if (!['all', 'active', 'PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED'].includes(status))
    throw new ArchiveRequestError('Invalid rescue status filter.');
  if (!['all', 'today', 'seven_days', 'older', 'selected_day'].includes(period))
    throw new ArchiveRequestError('Invalid report date filter.');
  if (!['newest', 'oldest'].includes(order))
    throw new ArchiveRequestError('Invalid archive sort order.');
  if (query.length > 140 || /[\u0000-\u001f\u007f]/.test(query))
    throw new ArchiveRequestError('Search must be 140 characters or less.');
  if (!validDay(day) || day > todayNSW()) throw new ArchiveRequestError('Invalid NSW report date.');
  if (org.length > 180) throw new ArchiveRequestError('Invalid organisation.');
  if (permittedOrganisation && org !== 'all' && org !== permittedOrganisation)
    throw new ArchiveRequestError('Organisation is not accessible.');
  return {
    query,
    status: status as ArchiveStatus,
    period: period as ArchivePeriod,
    day,
    order: order as ArchiveOrder,
    organisationId: permittedOrganisation ?? (org === 'all' ? null : org)
  };
}

function dateRange(filters: ArchiveFilters): { start?: string; end?: string } {
  const today = todayNSW();
  if (filters.period === 'all') return {};
  if (filters.period === 'today') return {
    start: sydneyMidnightUtc(today), end: sydneyMidnightUtc(utcDayShift(today, 1))
  };
  if (filters.period === 'seven_days') return {
    start: sydneyMidnightUtc(utcDayShift(today, -6)),
    end: sydneyMidnightUtc(utcDayShift(today, 1))
  };
  if (filters.period === 'older') return {
    end: sydneyMidnightUtc(utcDayShift(today, -6))
  };
  return {
    start: sydneyMidnightUtc(filters.day), end: sydneyMidnightUtc(utcDayShift(filters.day, 1))
  };
}

function fingerprint(filters: ArchiveFilters): string {
  return createHash('sha256').update(JSON.stringify({
    ...filters,
    // Rolling windows must not accidentally reuse yesterday's cursor.
    currentDay: todayNSW()
  })).digest('hex');
}

function readCursor(token: string | undefined, expected: string, index: 'gsi1' | 'gsi2', partition: string): Record<string, unknown> | undefined {
  if (!token) return undefined;
  if (token.length > 4096) throw new ArchiveRequestError('Invalid archive cursor.');
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as Cursor;
    const key = decoded.lastKey;
    const indexPk = index === 'gsi1' ? 'gsi1pk' : 'gsi2pk';
    const indexSk = index === 'gsi1' ? 'gsi1sk' : 'gsi2sk';
    if (decoded.v !== 1 || decoded.fingerprint !== expected || !key || typeof key !== 'object' ||
        typeof key.pk !== 'string' || !key.pk.startsWith('RESCUE#') ||
        key.sk !== 'META' || key[indexPk] !== partition ||
        typeof key[indexSk] !== 'string') throw new Error('Invalid cursor');
    return key;
  } catch {
    throw new ArchiveRequestError('Archive cursor expired or does not match these filters. Restart the search.');
  }
}

function cursorFor(row: Record<string, any>, index: 'gsi1' | 'gsi2', fingerprintValue: string): string {
  const indexPk = index === 'gsi1' ? 'gsi1pk' : 'gsi2pk';
  const indexSk = index === 'gsi1' ? 'gsi1sk' : 'gsi2sk';
  const cursor: Cursor = {
    v: 1,
    fingerprint: fingerprintValue,
    lastKey: {
      pk: row.pk, sk: row.sk,
      [indexPk]: row[indexPk], [indexSk]: row[indexSk]
    }
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function recordMatches(row: Record<string, any>, filters: ArchiveFilters, peopleNames: Map<string, string>): boolean {
  if (filters.organisationId && row.organisationId !== filters.organisationId) return false;
  if (filters.status === 'active') {
    if (row.status !== 'PENDING' && row.status !== 'ASSIGNED') return false;
  } else if (filters.status !== 'all' && row.status !== filters.status) return false;
  if (!filters.query) return true;
  const name = typeof row.assignedUserId === 'string' ? (peopleNames.get(row.assignedUserId) ?? '') : '';
  // Case-insensitive text matching. Search never relies on the first
  // 200 results and continues through the entire selected index.
  const haystack = [
    row.id, row.type, row.breed, row.location, row.injury,
    row.status, row.animalStatus, row.assignedUserId,
    row.organisationId, name
  ].filter(Boolean).join(' ').toLocaleLowerCase('en-AU');
  // A multi-word search matches all entered terms, even across fields.
  return filters.query.split(' ').every(word => haystack.includes(word));
}

export async function searchRescueArchive(
  filters: ArchiveFilters, token?: string, peopleNames: Map<string, string> = new Map()
): Promise<ArchivePage> {
  const index: 'gsi1' | 'gsi2' =
    ['PENDING', 'ASSIGNED', 'COMPLETED', 'CANCELLED'].includes(filters.status) ? 'gsi1' : 'gsi2';
  const partition = index === 'gsi1' ? `STATUS#${filters.status}` : 'RESCUES';
  const pk = index === 'gsi1' ? 'gsi1pk' : 'gsi2pk';
  const sk = index === 'gsi1' ? 'gsi1sk' : 'gsi2sk';
  const range = dateRange(filters);
  const fp = fingerprint(filters);
  let key = readCursor(token, fp, index, partition);
  const results: Record<string, any>[] = [];
  let examined = 0;
  let hasMore = false;
  let lastRead: Record<string, any> | undefined;

  // Invariant: lastRead is the last item *examined*, not DynamoDB's
  // LastEvaluatedKey, so no records are skipped when a batch overfills.
  while (results.length < PAGE_SIZE && examined < MAX_EVALUATED_PER_REQUEST) {
    const names: Record<string, string> = { '#pk': pk };
    const values: Record<string, unknown> = { ':pk': partition };
    let expression = '#pk = :pk';
    if (range.start || range.end) {
      names['#sk'] = sk;
      if (range.start && range.end) {
        expression += ' AND #sk BETWEEN :start AND :end';
        values[':start'] = `${range.start}#`;
        values[':end'] = `${range.end}#`;
      } else {
        expression += range.start ? ' AND #sk >= :start' : ' AND #sk < :end';
        if (range.start) values[':start'] = `${range.start}#`;
        if (range.end) values[':end'] = `${range.end}#`;
      }
    }
    const page = await db.send(new QueryCommand({
      TableName: tableName,
      IndexName: index,
      KeyConditionExpression: expression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ScanIndexForward: filters.order === 'oldest',
      Limit: Math.min(QUERY_BATCH_SIZE, MAX_EVALUATED_PER_REQUEST - examined),
      ExclusiveStartKey: key
    }));
    const rows = (page.Items ?? []) as Record<string, any>[];
    let finishedBatch = true;
    for (const [position, row] of rows.entries()) {
      examined++;
      lastRead = row;
      if (recordMatches(row, filters, peopleNames)) results.push(row);
      if (results.length === PAGE_SIZE) {
        finishedBatch = false;
        // If this was the final DynamoDB row and DynamoDB returned no cursor,
        // the result set really is complete; don't show a phantom next page.
        hasMore = position < rows.length - 1 || Boolean(page.LastEvaluatedKey);
        break;
      }
    }
    if (!finishedBatch) break;
    if (!page.LastEvaluatedKey || !rows.length) {
      hasMore = false;
      break;
    }
    hasMore = true;
    key = page.LastEvaluatedKey;
  }

  return {
    items: mapRescueItems(results),
    examined,
    hasMore,
    nextToken: hasMore && lastRead ? cursorFor(lastRead, index, fp) : null
  };
}
