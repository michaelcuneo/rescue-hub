import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = Resource.RescueHubData.name;

export type AnimalStatus = 'IN_RESCUE' | 'IN_TRANSIT' | 'AT_VET' | 'IN_CARE' | 'RELEASED' | 'EUTHANISED' | 'DECEASED';
export type AnimalRecord = {
  id: string; rescueId: string; organisationId: string; species: string; description?: string;
  status: AnimalStatus; currentCustodianUserId?: string; currentLocation?: string;
  pendingTransferId?: string; version: number; createdAt: string; updatedAt: string;
};
export class AnimalConflict extends Error {}
const key = (id: string) => ({ pk: `ANIMAL#${id}`, sk: 'META' });
const terminal = new Set<AnimalStatus>(['RELEASED', 'EUTHANISED', 'DECEASED']);

export async function getAnimal(id: string): Promise<AnimalRecord | null> {
  const result = await db.send(new GetCommand({ TableName: table, Key: key(id), ConsistentRead: true }));
  return result.Item ? result.Item as AnimalRecord : null;
}
export async function listRescueAnimals(rescueId: string, organisationId: string) {
  const items: AnimalRecord[] = [];
  let nextKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: table, IndexName: 'gsi2', KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: { ':pk': `RESCUE_ANIMALS#${rescueId}` }, ExclusiveStartKey: nextKey
    }));
    items.push(...(result.Items ?? []).filter((item) => item.organisationId === organisationId).map((item) => item as AnimalRecord));
    nextKey = result.LastEvaluatedKey;
  } while (nextKey);
  return items;
}
export async function listAnimalEvents(id: string) {
  const items: Record<string, unknown>[] = [];
  let nextKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `ANIMAL#${id}`, ':prefix': 'EVENT#' },
      ExclusiveStartKey: nextKey
    }));
    items.push(...(result.Items ?? []));
    nextKey = result.LastEvaluatedKey;
  } while (nextKey);
  return items;
}
export async function createAnimal(input: {
  rescueId: string; organisationId: string; species: string; description?: string;
  custodianUserId: string; location?: string;
}) {
  const id = crypto.randomUUID(), now = new Date().toISOString(), eventId = crypto.randomUUID();
  const animal: AnimalRecord = {
    id, rescueId: input.rescueId, organisationId: input.organisationId,
    species: input.species, description: input.description, status: 'IN_RESCUE',
    currentCustodianUserId: input.custodianUserId, currentLocation: input.location,
    version: 1, createdAt: now, updatedAt: now
  };
  await db.send(new TransactWriteCommand({ TransactItems: [
    { ConditionCheck: {
      TableName: table, Key: { pk: `RESCUE#${input.rescueId}`, sk: 'META' },
      ConditionExpression: 'organisationId = :org AND assignedUserId = :user',
      ExpressionAttributeValues: { ':org': input.organisationId, ':user': input.custodianUserId }
    }},
    { Put: { TableName: table, Item: { ...key(id), ...animal, entity: 'animal',
      gsi2pk: `RESCUE_ANIMALS#${input.rescueId}`, gsi2sk: `${now}#${id}` },
      ConditionExpression: 'attribute_not_exists(pk)' }},
    { Put: { TableName: table, Item: {
      pk: `ANIMAL#${id}`, sk: `EVENT#${now}#${eventId}`, entity: 'animal_event',
      id: eventId, animalId: id, organisationId: input.organisationId,
      type: 'ANIMAL_REGISTERED', actorUserId: input.custodianUserId, createdAt: now
    } }}
  ] }));
  return animal;
}

export async function recordAnimalEvent(animal: AnimalRecord, actorUserId: string, input: {
  type: 'OBSERVATION' | 'VET_ASSESSMENT' | 'TREATMENT' | 'FEEDING' | 'WEIGHT' | 'REVIEW';
  notes: string; occurredAt?: string; source?: 'PHONE' | 'DIRECT'; reportedByName?: string; coordinatorOverride?: boolean;
}) {
  if (terminal.has(animal.status)) throw new AnimalConflict('Animal has a final outcome.');
  if (animal.pendingTransferId) throw new AnimalConflict('Resolve the pending custody transfer first.');
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  await db.send(new TransactWriteCommand({ TransactItems: [
    { ConditionCheck: {
      TableName: table, Key: key(animal.id),
      ConditionExpression: input.coordinatorOverride
        ? 'version = :version AND organisationId = :org AND NOT (#status IN (:released, :euthanised, :deceased))'
        : 'version = :version AND organisationId = :org AND currentCustodianUserId = :user AND attribute_not_exists(pendingTransferId) AND NOT (#status IN (:released, :euthanised, :deceased))',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':version': animal.version, ':org': animal.organisationId, ':user': actorUserId,
        ':released': 'RELEASED', ':euthanised': 'EUTHANISED', ':deceased': 'DECEASED'
      }
    }},
    { Put: { TableName: table, Item: {
      pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${eventId}`,
      entity: 'animal_event', id: eventId, animalId: animal.id, organisationId: animal.organisationId,
      type: input.type, notes: input.notes, occurredAt: input.occurredAt ?? now,
      actorUserId, createdAt: now, source: input.source ?? 'DIRECT', reportedByName: input.reportedByName
    }, ConditionExpression: 'attribute_not_exists(pk)' }}
  ] })).catch((error) => {
    if (error instanceof Error && error.name === 'TransactionCanceledException') throw new AnimalConflict('Animal custody or status changed. Refresh and retry.');
    throw error;
  });
}

export async function getPendingAnimalTransfer(animal: AnimalRecord) {
  if (!animal.pendingTransferId) return null;
  let nextKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      FilterExpression: 'id = :id',
      ExpressionAttributeValues: {
        ':pk': `ANIMAL#${animal.id}`, ':prefix': 'EVENT#', ':id': animal.pendingTransferId
      }, ExclusiveStartKey: nextKey
    }));
    if (result.Items?.[0]) return result.Items[0];
    nextKey = result.LastEvaluatedKey;
  } while (nextKey);
  return null;
}

export async function changeAnimalState(animal: AnimalRecord, actorUserId: string, input: {
  kind: 'TRANSFER' | 'ACCEPT_TRANSFER' | 'OUTCOME';
  recipientUserId?: string; location?: string; status?: AnimalStatus; notes?: string;
}) {
  if (terminal.has(animal.status)) throw new AnimalConflict('Animal already has a final outcome.');
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  let update = '', condition = 'version = :version AND organisationId = :org AND NOT (#guardStatus IN (:released, :euthanised, :deceased))', values: Record<string, unknown> = {
    ':version': animal.version, ':org': animal.organisationId, ':now': now, ':next': animal.version + 1, ':released': 'RELEASED', ':euthanised': 'EUTHANISED', ':deceased': 'DECEASED'
  };
  let type = '', extra: Record<string, unknown> = {};
  if (input.kind === 'TRANSFER') {
    if (animal.pendingTransferId) throw new AnimalConflict('A transfer is already pending.');
    if (!input.recipientUserId || input.recipientUserId === actorUserId || actorUserId !== animal.currentCustodianUserId) throw new AnimalConflict('Current custodian must nominate a different recipient.');
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    type = 'TRANSFER_REQUESTED';
    update = 'SET pendingTransferId = :transfer, updatedAt = :now, version = :next';
    values[':transfer'] = eventId;
    extra = { fromUserId: actorUserId, toUserId: input.recipientUserId, destination: input.location ?? '', notes: input.notes ?? '' };
  } else if (input.kind === 'ACCEPT_TRANSFER') {
    if (!animal.pendingTransferId) throw new AnimalConflict('No transfer is pending.');
    const transfer = await getPendingAnimalTransfer(animal);
    if (!transfer || transfer.toUserId !== actorUserId) throw new AnimalConflict('Only the nominated recipient can accept custody.');
    condition += ' AND pendingTransferId = :transferId';
    values[':transferId'] = animal.pendingTransferId;
    type = 'TRANSFER_ACCEPTED';
    update = 'SET currentCustodianUserId = :user, currentLocation = :location, #status = :care, updatedAt = :now, version = :next REMOVE pendingTransferId';
    values = { ...values, ':user': actorUserId, ':location': String(transfer.destination ?? ''), ':care': 'IN_CARE' };
    extra = { transferId: animal.pendingTransferId, fromUserId: transfer.fromUserId, toUserId: actorUserId };
  } else {
    if (animal.pendingTransferId) throw new AnimalConflict('Resolve pending transfer before final outcome.');
    if (!input.status || !terminal.has(input.status)) throw new AnimalConflict('An explicit final outcome is required.');
    if (actorUserId !== animal.currentCustodianUserId) throw new AnimalConflict('Only current custodian can record outcome.');
    if (!input.notes?.trim()) throw new AnimalConflict('Outcome notes are required.');
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    type = 'FINAL_OUTCOME';
    update = 'SET #status = :care, updatedAt = :now, version = :next';
    values[':care'] = input.status;
    extra = { outcome: input.status, location: input.location ?? '', notes: input.notes };
  }
  const event = {
    pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${eventId}`,
    entity: 'animal_event', id: eventId, animalId: animal.id, organisationId: animal.organisationId,
    type, actorUserId, createdAt: now, ...extra
  };
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Update: { TableName: table, Key: key(animal.id), UpdateExpression: update,
      ConditionExpression: condition, ExpressionAttributeNames: { '#guardStatus': 'status', ...(update.includes('#status') ? { '#status': 'status' } : {}) },
      ExpressionAttributeValues: values }},
    { Put: { TableName: table, Item: event, ConditionExpression: 'attribute_not_exists(pk)' }}
  ] })).catch((error) => {
    if (error instanceof Error && error.name === 'TransactionCanceledException') throw new AnimalConflict('Animal changed since it was loaded. Refresh and retry.');
    throw error;
  });
  return getAnimal(animal.id);
}
