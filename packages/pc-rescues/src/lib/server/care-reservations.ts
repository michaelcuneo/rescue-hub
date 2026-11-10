import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getAnimal, type AnimalRecord } from './animals';
import { getRescue } from './graphql';
import { publishRescueChange } from './realtime';
import { canClaimAnimalCare, type ValidDeliveryDestination } from '../../../../core/care-delivery';

const table = Resource.RescueHubData.name;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
export class CareReservationConflict extends Error {}

/** A public care offer contains only the animal, facility and job reference.
 * Private carer delivery coordinates are never stored on the offer or rescue.
 */
export type AvailableCareOffer = {
  animalId: string; organisationId: string; species: string;
  clinic: string; transportRescueId: string; createdAt: string;
};

export async function listAvailableCareOffers(organisationId: string): Promise<AvailableCareOffer[]> {
  const found: AvailableCareOffer[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `ORG#${organisationId}#CARE_OFFERS`, ':prefix': 'ANIMAL#' },
      ExclusiveStartKey: cursor
    }));
    for (const row of page.Items ?? []) {
      if (row.organisationId !== organisationId || typeof row.animalId !== 'string') continue;
      found.push({
        animalId: String(row.animalId),
        organisationId,
        species: String(row.species ?? 'Wildlife'),
        clinic: String(row.clinic ?? 'Veterinary facility'),
        transportRescueId: String(row.transportRescueId),
        createdAt: String(row.createdAt)
      });
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return found;
}

export async function listMyCareReservations(organisationId: string, userId: string) {
  const items: Array<{ animalId: string; species: string; transportRescueId: string; claimedAt: string }> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':prefix': 'CARE_RESERVATION#' },
      ExclusiveStartKey: cursor
    }));
    for (const row of page.Items ?? []) if (row.organisationId === organisationId) items.push({
      animalId: String(row.animalId), species: String(row.species),
      transportRescueId: String(row.transportRescueId), claimedAt: String(row.claimedAt)
    });
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}

export async function claimAnimalCare(
  animalId: string,
  organisationId: string,
  carerUserId: string,
  destination: ValidDeliveryDestination
) {
  const animal = await getAnimal(animalId);
  if (!animal || animal.organisationId !== organisationId ||
      !canClaimAnimalCare(animal.status, animal.vetStage, animal.reservedCarerUserId, animal.pendingTransferId) ||
      !animal.activeTransportRescueId) {
    throw new CareReservationConflict('This animal is no longer available for a carer to claim.');
  }
  const job = await getRescue(animal.activeTransportRescueId);
  if (!job || job.transportAnimalId !== animal.id || job.organisationId !== organisationId ||
      job.status !== 'PENDING' || job.assignedUserId || !job.awaitingCarer) {
    throw new CareReservationConflict('The linked transport request is unavailable.');
  }
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table,
        Key: { pk: `ANIMAL#${animal.id}`, sk: 'META' },
        UpdateExpression: 'SET reservedCarerUserId = :carer, updatedAt = :now, version = :next',
        ConditionExpression: 'organisationId = :org AND #status = :vet AND vetStage = :ready AND version = :v AND activeTransportRescueId = :job AND attribute_not_exists(reservedCarerUserId) AND attribute_not_exists(pendingTransferId)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':carer': carerUserId, ':now': now, ':next': animal.version + 1,
          ':org': organisationId, ':vet': 'AT_VET',
          ':ready': 'ASSESSED_AWAITING_TRANSPORT', ':v': animal.version, ':job': job.id
        }
      }},
      { Update: {
        TableName: table,
        Key: { pk: `RESCUE#${job.id}`, sk: 'META' },
        UpdateExpression: 'REMOVE awaitingCarer',
        ConditionExpression: 'organisationId = :org AND #status = :pending AND awaitingCarer = :yes AND transportAnimalId = :animal AND attribute_not_exists(assignedUserId)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':org': organisationId, ':pending': 'PENDING', ':yes': true, ':animal': animal.id
        }
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `ANIMAL#${animal.id}`, sk: 'CARE_DELIVERY',
          entity: 'private_care_destination', animalId: animal.id, organisationId,
          carerUserId, ...destination, createdAt: now, updatedAt: now
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `USER#${carerUserId}`, sk: `CARE_RESERVATION#${animal.id}`,
          entity: 'care_reservation', organisationId, animalId: animal.id,
          species: animal.species, transportRescueId: job.id,
          claimedAt: now
        }, ConditionExpression: 'attribute_not_exists(pk)'
      }},
      { Delete: {
        TableName: table,
        Key: { pk: `ORG#${organisationId}#CARE_OFFERS`, sk: `ANIMAL#${animal.id}` },
        ConditionExpression: 'attribute_exists(pk)'
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${eventId}`,
          entity: 'animal_event', id: eventId, animalId: animal.id,
          organisationId, type: 'CARER_SELF_CLAIMED',
          actorUserId: carerUserId, transportRescueId: job.id,
          deliveryMode: destination.mode, createdAt: now
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }}
    ] }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      throw new CareReservationConflict('Another carer has already claimed this animal. Refresh the care offers.');
    throw error;
  }
  await publishRescueChange();
  return { animalId: animal.id, transportRescueId: job.id, reservedCarerUserId: carerUserId };
}

/** Carer can revise a one-time delivery position before physical pickup.
 * This is an explicit action, never background GPS tracking.
 */
export async function updateCareDestination(
  animalId: string, organisationId: string, carerUserId: string,
  destination: ValidDeliveryDestination
) {
  const animal = await getAnimal(animalId);
  if (!animal || animal.organisationId !== organisationId ||
      animal.reservedCarerUserId !== carerUserId || !animal.activeTransportRescueId ||
      !['AT_VET'].includes(animal.status)) {
    throw new CareReservationConflict('Delivery location can only be updated before the animal is collected.');
  }
  const job = await getRescue(animal.activeTransportRescueId);
  if (!job || job.organisationId !== organisationId || job.transportAnimalId !== animal.id ||
      !['PENDING','ASSIGNED'].includes(job.status) || job.pickedUpAt) {
    throw new CareReservationConflict('The transporter has already collected this animal.');
  }
  const now = new Date().toISOString(), id = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table,
        Key: { pk: `ANIMAL#${animal.id}`, sk: 'CARE_DELIVERY' },
        UpdateExpression: 'SET #mode = :mode, address = :address, latitude = :lat, longitude = :lng, updatedAt = :now',
        ConditionExpression: 'organisationId = :org AND carerUserId = :user',
        ExpressionAttributeNames: { '#mode': 'mode' },
        ExpressionAttributeValues: {
          ':mode': destination.mode, ':address': destination.address,
          ':lat': destination.latitude, ':lng': destination.longitude,
          ':now': now, ':org': organisationId, ':user': carerUserId
        }
      }},
      { ConditionCheck: {
        TableName: table,
        Key: { pk: `RESCUE#${job.id}`, sk: 'META' },
        ConditionExpression: '#status = :current AND attribute_not_exists(pickedUpAt) AND transportAnimalId = :animal',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':current': job.status, ':animal': animal.id }
      }},
      { Put: {
        TableName: table,
        Item: {
          pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${id}`,
          entity: 'animal_event', type: 'CARE_DELIVERY_DESTINATION_UPDATED',
          id, animalId: animal.id, organisationId, actorUserId: carerUserId,
          deliveryMode: destination.mode, createdAt: now
        },
        ConditionExpression: 'attribute_not_exists(pk)'
      }}
    ] }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      throw new CareReservationConflict('Pickup or delivery details changed. Refresh before updating your destination.');
    throw error;
  }
  await publishRescueChange();
  return { animalId: animal.id, updatedAt: now };
}

/** Only the reserving carer, actual transport claimant or organisation
 * coordinator may retrieve the private destination after a claim.
 */
export async function getCareDestination(animal: AnimalRecord, user: {
  id: string; organisationId?: string; roles: string[];
}) {
  if (animal.organisationId !== user.organisationId) return null;
  const coordinator = user.roles.some(role =>
    ['ORG_ADMIN', 'DISPATCHER', 'PLATFORM_ADMIN', 'AUTHORITY_ADMIN'].includes(role));
  const transport = animal.activeTransportRescueId
    ? await getRescue(animal.activeTransportRescueId) : null;
  const assigned = transport?.organisationId === animal.organisationId &&
    transport.status === 'ASSIGNED' && transport.assignedUserId === user.id;
  if (!coordinator && animal.reservedCarerUserId !== user.id &&
      animal.currentCustodianUserId !== user.id && !assigned) return null;
  const record = await db.send(new GetCommand({
    TableName: table,
    Key: { pk: `ANIMAL#${animal.id}`, sk: 'CARE_DELIVERY' },
    ConsistentRead: true
  }));
  const item = record.Item;
  if (!item || item.animalId !== animal.id || item.organisationId !== animal.organisationId) return null;
  if (!coordinator && !assigned && item.carerUserId !== user.id) return null;
  return {
    carerUserId: String(item.carerUserId),
    mode: String(item.mode),
    address: String(item.address),
    latitude: Number(item.latitude),
    longitude: Number(item.longitude)
  };
}
