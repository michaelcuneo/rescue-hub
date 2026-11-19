import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

/**
 * Atomic, distributed quotas for billable AWS Places requests.
 * DynamoDB conditional updates work across every Lambda instance. Failed
 * counters never permit a request (fail closed), and stale TTL records have
 * time-bucketed keys so delayed expiry cannot suppress a new window.
 */
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
export type GeocodingOperation = 'search' | 'reverse';

export class GeocodingLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Address lookup limit reached. Please try again later.');
    this.name = 'GeocodingLimitError';
  }
}
export class GeocodingLimitUnavailableError extends Error {
  constructor() {
    super('Address lookup is temporarily unavailable.');
    this.name = 'GeocodingLimitUnavailableError';
  }
}

export function geocodingQuotaRules(operation: GeocodingOperation) {
  // These are conservative demo-stage defaults, not national rollout quotas.
  return operation === 'search'
    ? { perUserMinute: 20, perUserDay: 450, stageDay: 6000 }
    : { perUserMinute: 80, perUserDay: 1500, stageDay: 12000 };
}

export async function reserveGeocodingRequest(userId: string, operation: GeocodingOperation) {
  if (!userId || userId.length > 256) throw new GeocodingLimitUnavailableError();
  const now = Math.floor(Date.now() / 1000);
  const limits = geocodingQuotaRules(operation);
  const minuteWindow = Math.floor(now / 60);
  const dayWindow = Math.floor(now / 86400);

  // Request counts are intentionally conservative: a partially completed
  // reservation remains charged, rather than allowing overspending on failure.
  const rules = [
    { key: `USER#${operation}#${userId}#M#${minuteWindow}`, limit: limits.perUserMinute, ttl: (minuteWindow + 2) * 60, retry: (minuteWindow + 1) * 60 - now },
    { key: `USER#${operation}#${userId}#D#${dayWindow}`, limit: limits.perUserDay, ttl: (dayWindow + 2) * 86400, retry: (dayWindow + 1) * 86400 - now },
    { key: `STAGE#${operation}#D#${dayWindow}`, limit: limits.stageDay, ttl: (dayWindow + 2) * 86400, retry: (dayWindow + 1) * 86400 - now }
  ];
  for (const rule of rules) {
    try {
      await dynamo.send(new UpdateCommand({
        TableName: Resource.RescueHubGeocodingCache.name,
        Key: { pk: 'GEOCODING_QUOTA', sk: rule.key },
        UpdateExpression: 'SET #n = if_not_exists(#n, :zero) + :one, #ttl = :ttl',
        ConditionExpression: 'attribute_not_exists(#n) OR #n < :max',
        ExpressionAttributeNames: { '#n': 'requests', '#ttl': 'expiresAt' },
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':max': rule.limit, ':ttl': rule.ttl }
      }));
    } catch (error) {
      if (error instanceof Error && error.name === 'ConditionalCheckFailedException')
        throw new GeocodingLimitError(Math.max(1, rule.retry));
      console.error('Geocoding quota storage failed:', error instanceof Error ? error.name : 'Error');
      throw new GeocodingLimitUnavailableError();
    }
  }
}
