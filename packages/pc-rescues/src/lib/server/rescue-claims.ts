import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { Rescue } from './graphql';
import { listRescueAnimals } from './animals';

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

export class RescueCannotUnclaimError extends Error {}

/**
 * Release an uncollected assignment back to the organisation's pending queue.
 * Animal custody must never be orphaned by releasing the incident assignment.
 * The animalCount guard serialises against concurrent animal registration.
 */
export async function unclaimRescue(
  rescueId: string, organisationId: string, userId: string, reason = ''
): Promise<Rescue> {
  // Older rescue records may have animals from before animalCount was introduced.
  const registered = await listRescueAnimals(rescueId, organisationId);
  if (registered.length) {
    throw new RescueCannotUnclaimError(
      'An animal is already registered to this rescue. Arrange an acknowledged handover instead of releasing the claim.'
    );
  }

  const table = Resource.RescueHubData.name;
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table,
        Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
        UpdateExpression: 'SET #status = :pending, gsi1pk = :statusKey, updatedAt = :now REMOVE assignedUserId',
        ConditionExpression: 'organisationId = :org AND #status = :assigned AND assignedUserId = :user AND (attribute_not_exists(animalCount) OR animalCount = :zero)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':org': organisationId, ':assigned': 'ASSIGNED', ':pending': 'PENDING',
          ':user': userId, ':now': now, ':statusKey': 'STATUS#PENDING', ':zero': 0
        }
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `RESCUE#${rescueId}`, sk: `EVENT#${now}#${eventId}`,
          entity: 'rescue_event', id: eventId, rescueId, organisationId,
          type: 'RESCUE_UNCLAIMED', actorUserId: userId,
          notes: reason.trim().slice(0, 500), createdAt: now
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }}
    ] }));
  } catch (error) {
    if (error instanceof Error &&
        ['TransactionCanceledException', 'ConditionalCheckFailedException'].includes(error.name)) {
      throw new RescueCannotUnclaimError(
        'This rescue was changed or an animal was registered. Reopen it to check the current assignment.'
      );
    }
    throw error;
  }

  const result = await db.send(new GetCommand({
    TableName: table,
    Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
    ConsistentRead: true
  }));
  if (!result.Item) throw new Error('Claim was released but the rescue could not be loaded.');
  return result.Item as Rescue;
}
