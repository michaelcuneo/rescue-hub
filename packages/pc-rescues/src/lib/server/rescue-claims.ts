import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { Rescue } from './graphql';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});

export class RescueAlreadyClaimedError extends Error {
  constructor() { super('This rescue is no longer available. Refresh the list.'); }
}

/** Claim and append an audit event atomically. Never use the unconditional assignRescue mutation for self-claims. */
export async function claimRescue(rescueId: string, organisationId: string, userId: string): Promise<Rescue> {
  const table = Resource.RescueHubData.name;
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: table,
            Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
            UpdateExpression: 'SET #status = :assigned, assignedUserId = :user, updatedAt = :now, gsi1pk = :statusKey',
            ConditionExpression: 'organisationId = :org AND #status = :pending AND attribute_not_exists(assignedUserId)',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: {
              ':org': organisationId, ':pending': 'PENDING', ':assigned': 'ASSIGNED',
              ':user': userId, ':now': now, ':statusKey': 'STATUS#ASSIGNED'
            }
          }
        },
        {
          Put: {
            TableName: table,
            Item: {
              pk: `RESCUE#${rescueId}`, sk: `EVENT#${now}#${eventId}`,
              entity: 'rescue_event', id: eventId, rescueId, organisationId,
              type: 'RESCUE_CLAIMED', actorUserId: userId, createdAt: now
            },
            ConditionExpression: 'attribute_not_exists(pk)'
          }
        }
      ]
    }));
  } catch (error) {
    if (error instanceof Error && (error.name === 'TransactionCanceledException' || error.name === 'ConditionalCheckFailedException')) {
      throw new RescueAlreadyClaimedError();
    }
    throw error;
  }
  const result = await db.send(new GetCommand({
    TableName: table, Key: { pk: `RESCUE#${rescueId}`, sk: 'META' }, ConsistentRead: true
  }));
  if (!result.Item) throw new Error('Claim saved but rescue could not be read.');
  return result.Item as Rescue;
}
