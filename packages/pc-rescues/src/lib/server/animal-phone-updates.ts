import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getRescue } from './graphql';
import { publishRescueChange } from './realtime';
import type { AnimalRecord } from './animals';
import type { ValidPhoneUpdate } from '../../../../core/rescue-phone-update';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const table = Resource.RescueHubData.name;

export class AnimalPhoneConflict extends Error {}

export type AnimalPhoneEvent = ValidPhoneUpdate & {
  id: string; animalId: string; organisationId: string;
  type: 'PHONE_UPDATE'; source: 'PHONE'; actorUserId: string;
  createdAt: string; transportRescueId?: string;
};

export async function listAnimalPhoneUpdates(animalId: string, organisationId: string) {
  const result: AnimalPhoneEvent[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: {
        ':pk': `ANIMAL#${animalId}`, ':sk': 'EVENT#'
      },
      ScanIndexForward: false,
      ExclusiveStartKey: cursor
    }));
    for (const item of page.Items ?? []) {
      if (item.type === 'PHONE_UPDATE' && item.organisationId === organisationId)
        result.push(item as AnimalPhoneEvent);
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return result;
}

export async function recordAnimalPhoneUpdate(
  animal: AnimalRecord, actorUserId: string, input: ValidPhoneUpdate
): Promise<AnimalPhoneEvent> {
  if (['RELEASED', 'EUTHANISED', 'DECEASED'].includes(animal.status))
    throw new AnimalPhoneConflict('The animal has a final outcome. Its history is read-only.');
  if (input.animalId && input.animalId !== animal.id)
    throw new AnimalPhoneConflict('Select the correct animal record.');
  if (input.requestTransport && animal.status !== 'AT_VET')
    throw new AnimalPhoneConflict('Vet pickup jobs require an animal currently recorded at a veterinary facility.');
  if (input.requestTransport && animal.activeTransportRescueId)
    throw new AnimalPhoneConflict('An active transport request already exists for this animal.');

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const transportRescueId = input.requestTransport ? crypto.randomUUID() : undefined;
  const event: AnimalPhoneEvent = {
    ...input, id, animalId: animal.id, organisationId: animal.organisationId,
    type: 'PHONE_UPDATE', source: 'PHONE', actorUserId, createdAt: now,
    ...(transportRescueId ? { transportRescueId } : {})
  };
  const writes: Array<Record<string, unknown>> = [
    { Update: {
      TableName: table,
      Key: { pk: `ANIMAL#${animal.id}`, sk: 'META' },
      UpdateExpression: input.requestTransport
        ? 'SET activeTransportRescueId = :transport, vetStage = :ready, version = :next, updatedAt = :now'
        : 'SET version = :next, updatedAt = :now',
      ConditionExpression:
        'attribute_exists(pk) AND organisationId = :org AND version = :v AND NOT (#status IN (:released, :euthanised, :deceased))' +
        (input.requestTransport ? ' AND #status = :vet AND attribute_not_exists(activeTransportRescueId) AND attribute_not_exists(pendingTransferId)' : ''),
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':org': animal.organisationId, ':v': animal.version,
        ':next': animal.version + 1, ':now': now,
        ':released': 'RELEASED', ':euthanised': 'EUTHANISED', ':deceased': 'DECEASED',
        ...(input.requestTransport ? {
          ':vet': 'AT_VET', ':ready': 'ASSESSED_AWAITING_TRANSPORT',
          ':transport': transportRescueId
        } : {})
      }
    }},
    { Put: {
      TableName: table,
      Item: {
        pk: `ANIMAL#${animal.id}`,
        sk: `EVENT#${now}#${id}`,
        entity: 'animal_event', ...event
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }}
  ];

  if (transportRescueId) {
    const original = await getRescue(animal.rescueId);
    if (!original || original.organisationId !== animal.organisationId)
      throw new AnimalPhoneConflict('The original rescue cannot be verified for this animal.');
    if (!Number.isFinite(original.latitude) || !Number.isFinite(original.longitude))
      throw new AnimalPhoneConflict('Transport pickup location is unavailable.');
    writes.push({ Put: {
      TableName: table,
      Item: {
        pk: `RESCUE#${transportRescueId}`, sk: 'META', entity: 'rescue',
        id: transportRescueId, organisationId: animal.organisationId,
        type: animal.species, breed: 'Transport',
        injury: 'Transport pickup requested following veterinary telephone update',
        location: animal.currentLocation || original.location || 'Veterinary facility; confirm pickup location',
        latitude: original.latitude, longitude: original.longitude,
        status: 'PENDING', transportAnimalId: animal.id,
        transportSourceRescueId: original.id,
        createdAt: now, updatedAt: now,
        gsi1pk: 'STATUS#PENDING', gsi1sk: `${now}#${transportRescueId}`,
        gsi2pk: 'RESCUES', gsi2sk: `${now}#${transportRescueId}`
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }});
  }
  try {
    await db.send(new TransactWriteCommand({ TransactItems: writes }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      throw new AnimalPhoneConflict('This animal was updated or already has a transport request. Refresh and try again.');
    throw error;
  }
  await publishRescueChange();
  return event;
}
