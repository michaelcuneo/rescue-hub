import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { RescueHubUser } from './auth';
import { publishRescueChange } from './realtime';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const table = Resource.RescueHubData.name;
const reportingWindowMs = 60_000;

export type PublicWildlifeReport = {
  id: string;
  reporterUserId: string;
  animal: string;
  condition: string;
  latitude: number;
  longitude: number;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'CONVERTED';
  createdAt: string;
  updatedAt: string;
  organisationId?: string;
  rescueId?: string;
  routingStatus?: 'MATCHED' | 'UNROUTED' | 'ROUTING_UNAVAILABLE';
  routingReason?: string;
  areaLabel?: string;
  allowMessages?: boolean;
  allowPhoneContact?: boolean;
  contactPhone?: string;
};

export function canReport(user: RescueHubUser | null | undefined): user is RescueHubUser {
  return Boolean(user?.enabled && user.status === 'ACTIVE' && user.emailVerified &&
    user.roles.includes('PUBLIC_REPORTER') && !user.organisationId);
}

export function canTriage(user: RescueHubUser | null | undefined): user is RescueHubUser {
  return Boolean(user?.enabled && user.status === 'ACTIVE' && user.roles.some(role =>
    ['PLATFORM_ADMIN','AUTHORITY_ADMIN','ORG_ADMIN','DISPATCHER'].includes(role)
  ));
}

export async function submitWildlifeReport(
  user: RescueHubUser, input: { animal: string; condition: string; latitude: number; longitude: number; allowMessages?: boolean; allowPhoneContact?: boolean; contactPhone?: string },
  routing: { status: 'MATCHED'; organisationId: string; areaLabel: string } | { status: 'UNROUTED' | 'ROUTING_UNAVAILABLE'; reason: string }
): Promise<PublicWildlifeReport> {
  if (!canReport(user)) throw new Error('A verified public reporter account is required.');
  const animal = input.animal.trim(), condition = input.condition.trim();
  if (animal.length < 2 || animal.length > 120) throw new Error('Describe the animal (2–120 characters).');
  if (condition.length < 5 || condition.length > 2000) throw new Error('Describe what appears wrong (5–2000 characters).');
  const phone = (input.contactPhone ?? '').trim();
  if (input.allowPhoneContact && !/^\\+?[0-9][0-9 ()-]{7,19}$/.test(phone)) {
    throw new Error('Provide a valid contact number if you allow phone calls.');
  }
  const { latitude, longitude } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error('Choose a valid map location.');
  }
  // One report per user per minute limits accidental repeat submissions.
  const lock = { pk: `REPORT_RATE#${user.id}`, sk: 'LATEST' };
  const now = Date.now(), iso = new Date(now).toISOString();
  const id = crypto.randomUUID();
  const report: PublicWildlifeReport = {
    id, reporterUserId: user.id, animal, condition,
    latitude, longitude, status: 'SUBMITTED', createdAt: iso, updatedAt: iso,
    allowMessages: input.allowMessages === true,
    allowPhoneContact: input.allowPhoneContact === true,
    ...(input.allowPhoneContact === true ? { contactPhone: phone } : {}),
    routingStatus: routing.status,
    ...(routing.status === 'MATCHED'
      ? { organisationId: routing.organisationId, areaLabel: routing.areaLabel }
      : { routingReason: routing.reason })
  };
  try {
    // Submit the report and move its rate-limit watermark atomically, so a
    // failed write doesn't leave a legitimate reporter blocked from retrying.
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table,
        Key: lock,
        UpdateExpression: 'SET lastAt = :now, #ttl = :ttl',
        ConditionExpression: 'attribute_not_exists(lastAt) OR lastAt < :limit',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':now': now, ':limit': now - reportingWindowMs,
          ':ttl': Math.floor(now / 1000) + 3600
        }
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `PUBLIC_REPORT#${id}`, sk: 'META', entity: 'public_wildlife_report',
          ...report, gsi1pk: `REPORTER#${user.id}`, gsi1sk: `${iso}#${id}`,
          gsi2pk: 'PUBLIC_REPORTS', gsi2sk: `${iso}#${id}`
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }}
    ] }));
  } catch (error) {
    if (error instanceof Error && ['TransactionCanceledException','ConditionalCheckFailedException'].includes(error.name)) {
      throw new Error('Please wait a minute before submitting another report.');
    }
    throw error;
  }
  await publishRescueChange();
  return report;
}

export async function listMyPublicReports(userId: string): Promise<PublicWildlifeReport[]> {
  const result = await db.send(new QueryCommand({
    TableName: table, IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :key',
    ExpressionAttributeValues: { ':key': `REPORTER#${userId}` },
    ScanIndexForward: false, Limit: 50
  }));
  return (result.Items ?? []).map(item => item as PublicWildlifeReport);
}

export async function listTriageReports(): Promise<PublicWildlifeReport[]> {
  const result = await db.send(new QueryCommand({
    TableName: table, IndexName: 'gsi2',
    KeyConditionExpression: 'gsi2pk = :key',
    ExpressionAttributeValues: { ':key': 'PUBLIC_REPORTS' },
    ScanIndexForward: false, Limit: 200
  }));
  return (result.Items ?? []).map(item => item as PublicWildlifeReport);
}

export async function getPublicReport(id: string): Promise<PublicWildlifeReport | null> {
  const result = await db.send(new GetCommand({
    TableName: table, Key: { pk: `PUBLIC_REPORT#${id}`, sk: 'META' },
    ConsistentRead: true
  }));
  return result.Item ? result.Item as PublicWildlifeReport : null;
}

export async function markPublicReportConverted(id: string, rescueId: string, organisationId: string) {
  await db.send(new UpdateCommand({
    TableName: table, Key: { pk: `PUBLIC_REPORT#${id}`, sk: 'META' },
    ConditionExpression: '#status = :submitted AND attribute_not_exists(rescueId)',
    UpdateExpression: 'SET #status = :converted, rescueId = :rescue, organisationId = :org, updatedAt = :now',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':submitted': 'SUBMITTED', ':converted': 'CONVERTED',
      ':rescue': rescueId, ':org': organisationId, ':now': new Date().toISOString()
    }
  }));
  await publishRescueChange();
}
