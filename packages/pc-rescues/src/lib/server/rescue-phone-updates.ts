import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { publishRescueChange } from './realtime';
import type { ValidPhoneUpdate } from '../../../../core/rescue-phone-update';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const table = Resource.RescueHubData.name;

export type PhoneUpdate = ValidPhoneUpdate & {
  id: string;
  rescueId: string;
  organisationId: string;
  type: 'PHONE_UPDATE';
  actorUserId: string;
  createdAt: string;
};

export async function listRescuePhoneUpdates(rescueId: string, organisationId: string): Promise<PhoneUpdate[]> {
  const items: PhoneUpdate[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const response = await db.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `RESCUE#${rescueId}`,
        ':prefix': 'EVENT#'
      },
      ScanIndexForward: false,
      ExclusiveStartKey: cursor
    }));
    for (const item of response.Items ?? []) {
      if (item.type === 'PHONE_UPDATE' && item.organisationId === organisationId) {
        items.push(item as PhoneUpdate);
      }
    }
    cursor = response.LastEvaluatedKey;
  } while (cursor);
  return items;
}

/** Keep callback details at the incident, before or after an animal is registered.
 * The rescue ownership check and append-only event are one transaction.
 */
export async function addRescuePhoneUpdate(
  rescueId: string, organisationId: string, actorUserId: string, input: ValidPhoneUpdate
): Promise<PhoneUpdate> {
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const event: PhoneUpdate = {
    id, rescueId, organisationId, actorUserId, type: 'PHONE_UPDATE',
    ...input, createdAt
  };
  await db.send(new TransactWriteCommand({ TransactItems: [
    { ConditionCheck: {
      TableName: table,
      Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
      ConditionExpression: 'attribute_exists(pk) AND organisationId = :org',
      ExpressionAttributeValues: { ':org': organisationId }
    }},
    { Put: {
      TableName: table,
      Item: { pk: `RESCUE#${rescueId}`, sk: `EVENT#${createdAt}#${id}`, entity: 'rescue_event', ...event },
      ConditionExpression: 'attribute_not_exists(pk)'
    }}
  ] }));
  await publishRescueChange();
  return event;
}
