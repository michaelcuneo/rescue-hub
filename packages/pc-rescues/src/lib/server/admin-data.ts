import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	DynamoDBDocumentClient,
	QueryCommand,
	UpdateCommand
} from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type {
	OrganisationDirectoryEntry,
	Rescue
} from '$lib/server/graphql';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
	marshallOptions: { removeUndefinedValues: true }
});
const tableName = Resource.RescueHubData.name;

export type AuditEvent = {
	id: string;
	organisationId?: string;
	action: string;
	summary: string;
	actorUserId?: string;
	createdAt: string;
	demo?: boolean;
};

async function queryIndex(pk: string, limit = 200) {
	const result = await db.send(new QueryCommand({
		TableName: tableName,
		IndexName: 'gsi2',
		KeyConditionExpression: 'gsi2pk = :pk',
		ExpressionAttributeValues: { ':pk': pk },
		ScanIndexForward: false,
		Limit: limit
	}));

	return result.Items ?? [];
}

export async function listAdminOrganisations(): Promise<OrganisationDirectoryEntry[]> {
	const items = await queryIndex('ORGANISATIONS#NSW', 100);

	return items.map((item) => ({
		id: String(item.id),
		authorityId: String(item.authorityId),
		jurisdiction: String(item.jurisdiction),
		officialName: String(item.officialName),
		displayName: String(item.displayName),
		areaDescription: String(item.areaDescription),
		speciesSpeciality: String(item.speciesSpeciality),
		boundaryStatus: String(item.boundaryStatus),
		aliases: Array.isArray(item.aliases) ? item.aliases.map(String) : [],
		sourceType: String(item.sourceType),
		sourceUrl: String(item.sourceUrl),
		sourceUpdatedAt: String(item.sourceUpdatedAt)
	}));
}

/**
 * Always read every operational case, even when there are thousands of newer
 * closed cases. Historical cases remain bounded here until the dedicated
 * paginated register endpoint is added; never silently omit active work.
 */
export async function listAdminRescues(): Promise<Rescue[]> {
  const activeStatuses = ['PENDING', 'ASSIGNED'];
  const activePages = await Promise.all(activeStatuses.map(async status => {
    const items: Record<string, any>[] = [];
    let cursor: Record<string, any> | undefined;
    do {
      const result = await db.send(new QueryCommand({
        TableName: tableName,
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :status',
        ExpressionAttributeValues: { ':status': `STATUS#${status}` },
        ScanIndexForward: false,
        ExclusiveStartKey: cursor
      }));
      items.push(...(result.Items ?? []));
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    return items;
  }));
  // Keep a recent history snapshot for the dispatch panel; the full archive
  // needs a cursor-based API, not a full-table query on every realtime event.
  const recentHistory = await queryIndex('RESCUES', 200);
  const combined = [...activePages.flat(), ...recentHistory];
  const items = [...new Map(combined.map(item => [String(item.id), item])).values()];
  return mapRescueItems(items);
}

function mapRescueItems(items: Record<string, any>[]): Rescue[] {
  return items.map((item) => ({
		id: String(item.id),
		organisationId: item.organisationId ? String(item.organisationId) : null,
		type: String(item.type),
		breed: item.breed ? String(item.breed) : null,
		location: item.location ? String(item.location) : null,
		latitude: Number(item.latitude),
		longitude: Number(item.longitude),
		injury: item.injury ? String(item.injury) : null,
		status: String(item.status) as Rescue['status'],
		animalStatus: item.animalStatus ? String(item.animalStatus) : null,
		intakeSource: item.intakeSource ? String(item.intakeSource) as Rescue['intakeSource'] : null,
		assignedUserId: item.assignedUserId ? String(item.assignedUserId) : null,
    pickedUpAt: item.pickedUpAt ? String(item.pickedUpAt) : null,
    awaitingCarer: Boolean(item.awaitingCarer),
    transportAnimalId: item.transportAnimalId ? String(item.transportAnimalId) : null,
    transportSourceRescueId: item.transportSourceRescueId ? String(item.transportSourceRescueId) : null,
		createdAt: String(item.createdAt),
		updatedAt: String(item.updatedAt)
	}));
}

/**
 * A Sydney dispatch calendar day spans either 23, 24 or 25 hours when DST
 * switches. Calculate both boundaries independently so the historical query
 * includes every event on that local day.
 */
function sydneyMidnightUtc(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  // Previous-day UTC noon is 22:00/23:00 Sydney, before any 02:00 DST change.
  const noon = new Date(Date.UTC(year, month - 1, date - 1, 12));
  const zoneLabel = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', timeZoneName: 'longOffset'
  }).formatToParts(noon).find(part => part.type === 'timeZoneName')?.value ?? '';
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(zoneLabel);
  if (!match) throw new Error('Cannot determine Sydney UTC offset');
  const offset = (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
  return new Date(Date.UTC(year, month - 1, date) - offset * 60_000).toISOString();
}

export async function listRescuesForNSWDay(day: string): Promise<Rescue[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw new Error('Invalid NSW dispatch date');
  }
  const nextDate = new Date(`${day}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const following = nextDate.toISOString().slice(0, 10);
  const startUtc = sydneyMidnightUtc(day);
  const endUtc = sydneyMidnightUtc(following);
  const rows: Record<string, any>[] = [];
  let cursor: Record<string, any> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: tableName,
      IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk AND gsi2sk BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':pk': 'RESCUES',
        ':start': `${startUtc}#`,
        ':end': `${endUtc}#`
      },
      ScanIndexForward: false,
      ExclusiveStartKey: cursor
    }));
    rows.push(...(result.Items ?? []));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  // The upper bound is exclusive in calendar terms.
  return mapRescueItems(rows.filter(row =>
    typeof row.createdAt === 'string' && row.createdAt >= startUtc && row.createdAt < endUtc
  ));
}

export async function listAdminAuditEvents(): Promise<AuditEvent[]> {
	const items = await queryIndex('AUDIT', 200);

	return items.map((item) => ({
		id: String(item.id),
		organisationId: item.organisationId ? String(item.organisationId) : undefined,
		action: String(item.action),
		summary: String(item.summary),
		actorUserId: item.actorUserId ? String(item.actorUserId) : undefined,
		createdAt: String(item.createdAt),
		demo: Boolean(item.demo)
	}));
}

/** New phone intake and existing online intake use identical rescue records.
 * This field is provenance only; it never changes eligibility or routing.
 */
export async function markPhoneRescueIntake(rescueId: string): Promise<void> {
  await db.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
    ConditionExpression: 'attribute_exists(pk)',
    UpdateExpression: 'SET intakeSource = :channel',
    ExpressionAttributeValues: { ':channel': 'PHONE' }
  }));
}
