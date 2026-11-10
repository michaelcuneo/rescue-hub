import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { publishRescueChange } from './realtime';
import type { Rescue } from './graphql';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = Resource.RescueHubData.name;

export class RescuePickupConflict extends Error {}

/**
 * Claiming reserves an assignment. This action records physical collection and
 * removes the pin from operational maps, without closing the case or animal.
 * Transport pickup additionally requires its linked animal to be collected.
 */
export async function confirmRescuePickup(rescue: Rescue, rescuerUserId: string, notes = ''): Promise<Rescue> {
  if (rescue.status !== 'ASSIGNED' || rescue.assignedUserId !== rescuerUserId || rescue.pickedUpAt)
    throw new RescuePickupConflict('Only the assigned rescuer can confirm collection of an uncollected animal.');
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  const cleanNotes = notes.trim();
  if (cleanNotes.length > 1000) throw new RescuePickupConflict('Collection notes exceed 1000 characters.');
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table,
        Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' },
        UpdateExpression: 'SET pickedUpAt = :now, updatedAt = :now',
        ConditionExpression: 'organisationId = :org AND #status = :assigned AND assignedUserId = :user AND attribute_not_exists(pickedUpAt)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':org': rescue.organisationId, ':assigned': 'ASSIGNED', ':user': rescuerUserId, ':now': now
        }
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `RESCUE#${rescue.id}`, sk: `EVENT#${now}#${eventId}`,
          entity: 'rescue_event', id: eventId, rescueId: rescue.id, organisationId: rescue.organisationId,
          type: rescue.transportAnimalId ? 'TRANSPORT_ANIMAL_COLLECTED' : 'ANIMAL_COLLECTED',
          actorUserId: rescuerUserId, notes: cleanNotes, createdAt: now,
          ...(rescue.transportAnimalId ? { animalId: rescue.transportAnimalId } : {})
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }}
    ] }));
  } catch (error) {
    if (error instanceof Error && (error.name === 'TransactionCanceledException' || error.name === 'ConditionalCheckFailedException'))
      throw new RescuePickupConflict('This rescue was already collected or assigned to someone else. Refresh its status.');
    throw error;
  }
  const current = await db.send(new GetCommand({
    TableName: table, Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' }, ConsistentRead: true
  }));
  if (!current.Item) throw new Error('Pickup was saved but could not be retrieved.');
  await publishRescueChange();
  return current.Item as Rescue;
}
