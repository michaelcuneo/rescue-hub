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
export async function confirmRescuePickup(
  rescue: Rescue, rescuerUserId: string, notes = '',
  registration?: { species: string; description?: string }
): Promise<Rescue> {
  if (rescue.status !== 'ASSIGNED' || rescue.assignedUserId !== rescuerUserId || rescue.pickedUpAt)
    throw new RescuePickupConflict('Only the assigned rescuer can confirm collection of an uncollected animal.');
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  const cleanNotes = notes.trim();
  const species = registration?.species.trim() ?? '';
  const description = registration?.description?.trim() ?? '';
  if (registration && (!species || species.length > 120 || description.length > 2000))
    throw new RescuePickupConflict('Enter a valid animal species and identifying details.');
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
  // Registration and physical collection are one atomic action for the first
  // animal. Do not create a second animal on a transport collection or where
  // a rescue already has registered animals.
  if (!rescue.transportAnimalId && registration) {
    const animalId = crypto.randomUUID(), animalEventId = crypto.randomUUID();
    changes[0] = { Update: {
      TableName: table, Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' },
      UpdateExpression: 'SET pickedUpAt = :now, updatedAt = :now, quickAnimalId = :animal ADD animalCount :one',
      ConditionExpression: 'organisationId = :org AND #status = :assigned AND assignedUserId = :user AND attribute_not_exists(pickedUpAt) AND attribute_not_exists(quickAnimalId) AND (attribute_not_exists(animalCount) OR animalCount = :zero)',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':org': rescue.organisationId, ':assigned': 'ASSIGNED', ':user': rescuerUserId,
        ':now': now, ':animal': animalId, ':one': 1, ':zero': 0
      }
    }};
    changes.push(
      { Put: { TableName: table, Item: {
        pk: `ANIMAL#${animalId}`, sk: 'META', entity: 'animal', id: animalId,
        rescueId: rescue.id, organisationId: rescue.organisationId, species, description,
        status: 'IN_RESCUE', currentCustodianUserId: rescuerUserId,
        currentLocation: rescue.location ?? '', version: 1, createdAt: now, updatedAt: now,
        gsi2pk: `RESCUE_ANIMALS#${rescue.id}`, gsi2sk: `${now}#${animalId}`,
        gsi1pk: `CUSTODIAN#${rescue.organisationId}#${rescuerUserId}`,
        gsi1sk: `${now}#${animalId}`
      }, ConditionExpression: 'attribute_not_exists(pk)' }},
      { Put: { TableName: table, Item: {
        pk: `ANIMAL#${animalId}`, sk: `EVENT#${now}#${animalEventId}`,
        entity: 'animal_event', id: animalEventId, animalId,
        organisationId: rescue.organisationId, type: 'ANIMAL_REGISTERED',
        actorUserId: rescuerUserId, createdAt: now, sourceRescueId: rescue.id
      }, ConditionExpression: 'attribute_not_exists(pk)' }}
    );
  }
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
