import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import type { Rescue } from './graphql';
import { getAnimal, listAnimalEvents } from './animals';
import { canCorrectMistakenPickup } from '../../../../core/pickup-correction';
import { publishRescueChange } from './realtime';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
export class PickupCorrectionConflict extends Error {}

/** Return a mistakenly confirmed pickup to pending ONLY when it remains an
 * untouched first registration. Never delete the animal or its history:
 * the animal is marked VOIDED, audit events are appended, and its active
 * custody/list indexes are removed. A real collected animal requires handover.
 */
export async function correctMistakenPickup(
  rescue: Rescue, userId: string, reason: string
): Promise<Rescue> {
  const note = reason.trim();
  if (note.length < 10 || note.length > 500)
    throw new PickupCorrectionConflict('Explain why the pickup was recorded in error (10–500 characters).');
  const original = await db.send(new GetCommand({ TableName: Resource.RescueHubData.name,
    Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' }, ConsistentRead: true }));
  const currentRescue = original.Item as Rescue | undefined;
  if (!currentRescue || currentRescue.assignedUserId !== userId ||
      !currentRescue.quickAnimalId || !currentRescue.organisationId)
    throw new PickupCorrectionConflict('This pickup cannot be corrected automatically. Contact dispatch to arrange a documented handover.');
  const animal = await getAnimal(currentRescue.quickAnimalId);
  if (!animal) throw new PickupCorrectionConflict('The registered animal could not be verified. Contact dispatch.');
  const events = await listAnimalEvents(animal.id);
  if (!canCorrectMistakenPickup(currentRescue, animal, userId, events.map(e => String(e.type ?? ''))))
    throw new PickupCorrectionConflict(
      'This animal has care or handover history, or was not an untouched first pickup. Contact dispatch to arrange an acknowledged handover.'
    );
  const now = new Date().toISOString(), table = Resource.RescueHubData.name;
  const rescueEventId = crypto.randomUUID(), animalEventId = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table, Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' },
        UpdateExpression: 'SET #status = :pending, gsi1pk = :index, updatedAt = :now, animalCount = :zero REMOVE assignedUserId, pickedUpAt, quickAnimalId',
        ConditionExpression: 'organisationId = :org AND #status = :assigned AND assignedUserId = :actor AND quickAnimalId = :animal AND animalCount = :one AND attribute_exists(pickedUpAt) AND attribute_not_exists(transportAnimalId)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':org': rescue.organisationId, ':assigned': 'ASSIGNED', ':pending': 'PENDING',
          ':actor': userId, ':animal': animal.id, ':one': 1, ':zero': 0,
          ':index': 'STATUS#PENDING', ':now': now
        }
      }},
      { Update: {
        TableName: table, Key: { pk: `ANIMAL#${animal.id}`, sk: 'META' },
        UpdateExpression: 'SET #status = :voided, registrationVoidedAt = :now, version = :next, updatedAt = :now REMOVE gsi1pk, gsi1sk, gsi2pk, gsi2sk',
        ConditionExpression: 'organisationId = :org AND rescueId = :rescue AND version = :version AND #status = :initial AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId) AND attribute_not_exists(activeTransportRescueId) AND attribute_not_exists(reservedCarerUserId) AND attribute_not_exists(registrationVoidedAt)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':org': rescue.organisationId, ':rescue': rescue.id, ':version': 1,
          ':next': 2, ':initial': 'IN_RESCUE', ':voided': 'VOIDED',
          ':actor': userId, ':now': now
        }
      }},
      { Put: { TableName: table, Item: {
        pk: `RESCUE#${rescue.id}`, sk: `EVENT#${now}#${rescueEventId}`,
        entity: 'rescue_event', id: rescueEventId, rescueId: rescue.id,
        organisationId: rescue.organisationId, animalId: animal.id,
        type: 'MISTAKEN_PICKUP_CORRECTED', actorUserId: userId,
        notes: note, createdAt: now
      }, ConditionExpression: 'attribute_not_exists(pk)' }},
      { Put: { TableName: table, Item: {
        pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${animalEventId}`,
        entity: 'animal_event', id: animalEventId, animalId: animal.id,
        organisationId: rescue.organisationId, sourceRescueId: rescue.id,
        type: 'REGISTRATION_VOIDED', actorUserId: userId,
        notes: note, createdAt: now
      }, ConditionExpression: 'attribute_not_exists(pk)' }}
    ] }));
  } catch (error) {
    if (error instanceof Error && ['TransactionCanceledException','ConditionalCheckFailedException'].includes(error.name))
      throw new PickupCorrectionConflict('The animal changed while correcting the pickup. Refresh and contact dispatch if care has begun.');
    throw error;
  }
  await publishRescueChange();
  const updated = await db.send(new GetCommand({ TableName: table,
    Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' }, ConsistentRead: true }));
  if (!updated.Item) throw new Error('Correction saved but the rescue could not be reloaded.');
  return updated.Item as Rescue;
}
