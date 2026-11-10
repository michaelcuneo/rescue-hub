import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, type TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { publishRescueChange } from './realtime';
import { getAnimal } from './animals';
import { getCareDestination } from './care-reservations';
import type { Rescue } from './graphql';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = Resource.RescueHubData.name;

export class RescuePickupConflict extends Error {}

/**
 * Claiming reserves an assignment. This action records physical collection and
 * removes the pin from operational maps, without closing the case or animal.
 * Physical transport pickup transfers custody to the collector atomically;
 * a later acknowledged handover to a carer remains necessary.
 */
export async function confirmRescuePickup(rescue: Rescue, rescuerUserId: string, notes = ''): Promise<Rescue> {
  if (rescue.status !== 'ASSIGNED' || rescue.assignedUserId !== rescuerUserId || rescue.pickedUpAt)
    throw new RescuePickupConflict('Only the assigned rescuer can confirm collection of an uncollected animal.');
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  const cleanNotes = notes.trim();
  if (cleanNotes.length > 1000) throw new RescuePickupConflict('Collection notes exceed 1000 characters.');
  const changes: NonNullable<TransactWriteCommandInput['TransactItems']> = [
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
    ];
  if (rescue.transportAnimalId) {
    const animal = await getAnimal(rescue.transportAnimalId);
    if (!animal || animal.organisationId !== rescue.organisationId ||
        animal.status !== 'AT_VET' || animal.activeTransportRescueId !== rescue.id ||
        animal.pendingTransferId || !animal.reservedCarerUserId) {
      throw new RescuePickupConflict('Linked animal is not ready for pickup from the veterinary facility.');
    }
    // The carer destination is kept in a private animal record, never the map job.
    const destination = await getCareDestination(animal, {
      id: rescuerUserId, organisationId: animal.organisationId, roles: []
    });
    // Before claiming physical pickup the server may not yet identify this
    // person as current custodian; the assigned transport claim grants access.
    if (!destination || destination.carerUserId !== animal.reservedCarerUserId)
      throw new RescuePickupConflict('The receiving carer has not confirmed delivery instructions.');
    const animalEventId = crypto.randomUUID();
    changes.push({ Update: {
      TableName: table,
      Key: { pk: `ANIMAL#${animal.id}`, sk: 'META' },
      UpdateExpression: 'SET currentCustodianUserId = :user, currentLocation = :location, #status = :transit, gsi1pk = :custodian, updatedAt = :now, version = :next REMOVE vetStage',
      ConditionExpression: 'organisationId = :org AND version = :version AND #status = :vet AND activeTransportRescueId = :job AND attribute_not_exists(pendingTransferId)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':user': rescuerUserId, ':location': rescue.location ?? 'Veterinary facility',
        ':transit': 'IN_TRANSIT', ':custodian': `CUSTODIAN#${animal.organisationId}#${rescuerUserId}`,
        ':now': now, ':next': animal.version + 1, ':org': animal.organisationId,
        ':version': animal.version, ':vet': 'AT_VET', ':job': rescue.id
      }
    }}, { Put: {
      TableName: table,
      Item: {
        pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${animalEventId}`,
        entity: 'animal_event', id: animalEventId, animalId: animal.id,
        organisationId: animal.organisationId, actorUserId: rescuerUserId, createdAt: now,
        type: 'TRANSPORT_PICKUP_CONFIRMED', sourceRescueId: rescue.transportSourceRescueId,
        transportRescueId: rescue.id, previousCustodianUserId: animal.currentCustodianUserId ?? '',
        currentCustodianUserId: rescuerUserId, location: rescue.location ?? ''
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }});
  }
  try {
    await db.send(new TransactWriteCommand({ TransactItems: changes }));
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
