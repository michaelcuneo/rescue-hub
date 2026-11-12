import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, TransactWriteCommand, type TransactWriteCommandInput } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { publishRescueChange } from './realtime';
import { getRescue } from './graphql';
import { transportCloseStatus } from '../../../../core/care-delivery';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = Resource.RescueHubData.name;

export type AnimalStatus = 'IN_RESCUE' | 'IN_TRANSIT' | 'AT_VET' | 'IN_CARE' | 'RELEASED' | 'EUTHANISED' | 'DECEASED';
export type AnimalRecord = {
  id: string; rescueId: string; organisationId: string; species: string; description?: string;
  status: AnimalStatus; currentCustodianUserId?: string; currentLocation?: string;
  physicalCustodianType?: 'RESCUER' | 'VET'; physicalCustodianName?: string;
  vetStage?: 'AWAITING_ASSESSMENT' | 'ASSESSED_AWAITING_TRANSPORT';
  pendingTransferId?: string; activeTransportRescueId?: string; reservedCarerUserId?: string; version: number; createdAt: string; updatedAt: string;
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
/** Indexed active animal custody for the signed-in user, including cases they did not originally claim. */
export async function listCustodianAnimals(organisationId: string, userId: string): Promise<AnimalRecord[]> {
  const items: AnimalRecord[] = [];
  let nextKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new QueryCommand({
      TableName: table,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `CUSTODIAN#${organisationId}#${userId}` },
      ExclusiveStartKey: nextKey
    }));
    items.push(...(result.Items ?? []).filter(item =>
      item.organisationId === organisationId && item.currentCustodianUserId === userId
    ).map(item => item as AnimalRecord));
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
  custodianUserId: string; location?: string; quickRegistration?: boolean;
}) {
  const id = crypto.randomUUID(), now = new Date().toISOString(), eventId = crypto.randomUUID();
  const animal: AnimalRecord = {
    id, rescueId: input.rescueId, organisationId: input.organisationId,
    species: input.species, description: input.description, status: 'IN_RESCUE',
    currentCustodianUserId: input.custodianUserId, currentLocation: input.location,
    version: 1, createdAt: now, updatedAt: now
  };
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Update: {
      TableName: table, Key: { pk: `RESCUE#${input.rescueId}`, sk: 'META' },
      UpdateExpression: input.quickRegistration
        ? 'SET quickAnimalId = :animal ADD animalCount :one'
        : 'ADD animalCount :one',
      ConditionExpression: 'organisationId = :org AND assignedUserId = :user AND #status = :assigned' +
        (input.quickRegistration ? ' AND attribute_not_exists(quickAnimalId)' : ''),
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':org': input.organisationId, ':user': input.custodianUserId,
        ':assigned': 'ASSIGNED', ':one': 1,
        ...(input.quickRegistration ? { ':animal': id } : {})
      }
    }},
    { Put: { TableName: table, Item: { ...key(id), ...animal, entity: 'animal',
      gsi2pk: `RESCUE_ANIMALS#${input.rescueId}`, gsi2sk: `${now}#${id}`,
      gsi1pk: `CUSTODIAN#${input.organisationId}#${input.custodianUserId}`,
      gsi1sk: `${now}#${id}` },
      ConditionExpression: 'attribute_not_exists(pk)' }},
    { Put: { TableName: table, Item: {
      pk: `ANIMAL#${id}`, sk: `EVENT#${now}#${eventId}`, entity: 'animal_event',
      id: eventId, animalId: id, organisationId: input.organisationId,
      type: 'ANIMAL_REGISTERED', actorUserId: input.custodianUserId, createdAt: now
    } }}
  ] }));
  await publishRescueChange();
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
  await publishRescueChange();
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
  kind: 'TRANSFER' | 'ACCEPT_TRANSFER' | 'OUTCOME' | 'SELF_CARE' | 'VET_TRANSPORT_STARTED' | 'VET_DROPOFF' | 'VET_ASSESSED';
  recipientUserId?: string; location?: string; latitude?: number; longitude?: number; status?: AnimalStatus; notes?: string; purpose?: 'CARE' | 'TRANSPORT';
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
    if (animal.reservedCarerUserId && input.purpose !== 'TRANSPORT' && input.recipientUserId !== animal.reservedCarerUserId)
      throw new AnimalConflict('The receiving carer has already been reserved. Transfer care to that carer.');
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    type = 'TRANSFER_REQUESTED';
    update = 'SET pendingTransferId = :transfer, updatedAt = :now, version = :next';
    values[':transfer'] = eventId;
    extra = { fromUserId: actorUserId, toUserId: input.recipientUserId, destination: input.location ?? '', purpose: input.purpose === 'TRANSPORT' ? 'TRANSPORT' : 'CARE', notes: input.notes ?? '' };
  } else if (input.kind === 'ACCEPT_TRANSFER') {
    if (!animal.pendingTransferId) throw new AnimalConflict('No transfer is pending.');
    const transfer = await getPendingAnimalTransfer(animal);
    if (!transfer || transfer.toUserId !== actorUserId) throw new AnimalConflict('Only the nominated recipient can accept custody.');
    if (animal.reservedCarerUserId && transfer.purpose === 'CARE' && animal.reservedCarerUserId !== actorUserId)
      throw new AnimalConflict('This animal was already reserved by another carer.');
    condition += ' AND pendingTransferId = :transferId';
    values[':transferId'] = animal.pendingTransferId;
    type = 'TRANSFER_ACCEPTED';
    update = 'SET currentCustodianUserId = :user, currentLocation = :location, #status = :care, gsi1pk = :custodianKey, updatedAt = :now, version = :next REMOVE pendingTransferId, vetStage, activeTransportRescueId, reservedCarerUserId';
    values = { ...values, ':user': actorUserId, ':location': String(transfer.destination ?? ''), ':care': transfer.purpose === 'TRANSPORT' ? 'IN_TRANSIT' : 'IN_CARE', ':custodianKey': `CUSTODIAN#${animal.organisationId}#${actorUserId}` };
    extra = { transferId: animal.pendingTransferId, fromUserId: transfer.fromUserId, toUserId: actorUserId };
  } else if (input.kind === 'SELF_CARE') {
    if (actorUserId !== animal.currentCustodianUserId || animal.pendingTransferId ||
        !['IN_RESCUE', 'IN_TRANSIT'].includes(animal.status))
      throw new AnimalConflict('Only the collecting custodian can start personal care.');
    const parent = await getRescue(animal.rescueId);
    if (!parent?.pickedUpAt) throw new AnimalConflict('Confirm physical collection first.');
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    values[':care'] = 'IN_CARE';
    type = 'CARE_STARTED';
    update = 'SET #status = :care, updatedAt = :now, version = :next';
    extra = { notes: input.notes ?? '', location: animal.currentLocation ?? '' };
  } else if (input.kind === 'VET_TRANSPORT_STARTED') {
    if (actorUserId !== animal.currentCustodianUserId || animal.pendingTransferId)
      throw new AnimalConflict('Only the current custodian can record veterinary transport.');
    const clinic = input.location?.trim();
    if (!clinic || clinic.length > 250)
      throw new AnimalConflict('Provide the destination veterinary facility.');
    const parent = await getRescue(animal.rescueId);
    if (!parent || !parent.pickedUpAt || parent.organisationId !== animal.organisationId)
      throw new AnimalConflict('Confirm physical collection before starting transport to the veterinary facility.');
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    values[':transit'] = 'IN_TRANSIT';
    values[':location'] = `En route to ${clinic}`;
    type = 'VET_TRANSPORT_STARTED';
    update = 'SET #status = :transit, currentLocation = :location, physicalCustodianType = :physical, updatedAt = :now, version = :next REMOVE physicalCustodianName';
    values[':physical'] = 'RESCUER';
    extra = { destination: clinic, notes: input.notes ?? '' };
  } else if (input.kind === 'VET_DROPOFF' || input.kind === 'VET_ASSESSED') {
    if (actorUserId !== animal.currentCustodianUserId) {
      throw new AnimalConflict('Only the responsible rescuer or custodian can record a vet milestone.');
    }
    if (animal.pendingTransferId) throw new AnimalConflict('Complete the pending handover first.');
    if (input.kind === 'VET_DROPOFF' && !input.location?.trim()) {
      throw new AnimalConflict('Record the veterinary facility or location.');
    }
    if (input.kind === 'VET_ASSESSED' && animal.status !== 'AT_VET') {
      throw new AnimalConflict('Record the veterinary drop-off before marking an assessment.');
    }
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    if (input.kind === 'VET_DROPOFF') {
      type = 'VET_DROPOFF';
      update = 'SET #status = :vet, vetStage = :stage, currentLocation = :location, physicalCustodianType = :physical, physicalCustodianName = :clinic, updatedAt = :now, version = :next';
      values = { ...values, ':vet': 'AT_VET', ':stage': 'AWAITING_ASSESSMENT', ':location': input.location!.trim(), ':physical': 'VET', ':clinic': input.location!.trim() };
      extra = { location: input.location!.trim(), notes: input.notes ?? '' };
    } else {
      type = 'VET_ASSESSED';
      update = 'SET vetStage = :stage, updatedAt = :now, version = :next';
      values[':stage'] = 'ASSESSED_AWAITING_TRANSPORT';
      extra = { notes: input.notes ?? '', location: animal.currentLocation ?? '' };
    }
  } else {
    if (animal.pendingTransferId) throw new AnimalConflict('Resolve pending transfer before final outcome.');
    if (!input.status || !terminal.has(input.status)) throw new AnimalConflict('An explicit final outcome is required.');
    if (actorUserId !== animal.currentCustodianUserId) throw new AnimalConflict('Only current custodian can record outcome.');
    if (!input.notes?.trim()) throw new AnimalConflict('Outcome notes are required.');
    if (input.status === 'RELEASED') {
      if (!input.location?.trim() || input.location.length > 250)
        throw new AnimalConflict('Record the actual release location.');
      if ((input.latitude === undefined) !== (input.longitude === undefined) ||
          (input.latitude !== undefined && (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90 ||
          !Number.isFinite(input.longitude) || input.longitude! < -180 || input.longitude! > 180)))
        throw new AnimalConflict('Release coordinates must be valid GPS coordinates.');
      const originalRescue = await getRescue(animal.rescueId);
      if (!originalRescue?.pickedUpAt)
        throw new AnimalConflict('Confirm physical collection before releasing the animal.');
    }
    condition += ' AND currentCustodianUserId = :actor AND attribute_not_exists(pendingTransferId)';
    values[':actor'] = actorUserId;
    type = 'FINAL_OUTCOME';
    update = input.status === 'RELEASED'
      ? 'SET #status = :care, currentLocation = :location, updatedAt = :now, version = :next REMOVE activeTransportRescueId'
      : 'SET #status = :care, updatedAt = :now, version = :next REMOVE activeTransportRescueId';
    values[':care'] = input.status;
    if (input.status === 'RELEASED') values[':location'] = input.location!.trim();
    extra = { outcome: input.status, location: input.location ?? '', notes: input.notes,
      ...(input.status === 'RELEASED' ? { releaseReason: 'RELOCATION',
        originalRescueId: animal.rescueId,
        ...(input.latitude !== undefined ? { latitude: input.latitude, longitude: input.longitude } : {}) } : {}) };
  }
  const event = {
    pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${eventId}`,
    entity: 'animal_event', id: eventId, animalId: animal.id, organisationId: animal.organisationId,
    type, actorUserId, createdAt: now, ...extra
  };
  const writes: NonNullable<TransactWriteCommandInput['TransactItems']> = [
    { Update: { TableName: table, Key: key(animal.id), UpdateExpression: update,
      ConditionExpression: condition, ExpressionAttributeNames: { '#guardStatus': 'status', ...(update.includes('#status') ? { '#status': 'status' } : {}) },
      ExpressionAttributeValues: values }},
    { Put: { TableName: table, Item: event, ConditionExpression: 'attribute_not_exists(pk)' }}
  ];
  // Completing a real custody handover also closes the outstanding pickup
  // offer. We never treat a mere phone call or job claim as a handover.
  if ((input.kind === 'ACCEPT_TRANSFER' || input.kind === 'OUTCOME') && animal.activeTransportRescueId) {
    const pickup = await getRescue(animal.activeTransportRescueId);
    if (!pickup || pickup.organisationId !== animal.organisationId ||
        pickup.transportAnimalId !== animal.id ||
        !['PENDING', 'ASSIGNED'].includes(pickup.status)) {
      throw new AnimalConflict('Linked transport request is no longer active. Refresh the record before accepting custody.');
    }
    // A carer, not the transporter, accepts custody. Complete the collected
    // transport job upon actual receipt; an uncollected offer is cancelled.
    const transportCollected = pickup.status === 'ASSIGNED' && !!pickup.pickedUpAt;
    const endStatus = transportCloseStatus(input.kind, pickup.status, pickup.pickedUpAt);
    const jobEventId = crypto.randomUUID();
    writes.push({ Update: {
      TableName: table,
      Key: { pk: `RESCUE#${pickup.id}`, sk: 'META' },
      UpdateExpression: 'SET #status = :end, gsi1pk = :gsi, updatedAt = :now',
      ConditionExpression: '#status = :prior AND organisationId = :org AND transportAnimalId = :animal' +
        (transportCollected ? ' AND attribute_exists(pickedUpAt) AND assignedUserId = :transporter' : ''),
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':end': endStatus, ':gsi': `STATUS#${endStatus}`, ':now': now,
        ':prior': pickup.status, ':org': animal.organisationId, ':animal': animal.id,
        ...(transportCollected ? { ':transporter': pickup.assignedUserId } : {})
      }
    }}, { Put: {
      TableName: table,
      Item: {
        pk: `RESCUE#${pickup.id}`, sk: `EVENT#${now}#${jobEventId}`,
        entity: 'rescue_event', id: jobEventId,
        rescueId: pickup.id, organisationId: animal.organisationId, animalId: animal.id,
        actorUserId, type: endStatus === 'COMPLETED' ? 'TRANSPORT_HANDOVER_ACCEPTED' :
          input.kind === 'OUTCOME' ? 'TRANSPORT_REQUEST_CANCELLED_ON_FINAL_OUTCOME' : 'TRANSPORT_REQUEST_CANCELLED_ON_HANDOVER',
        createdAt: now
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }});
  }
  await db.send(new TransactWriteCommand({ TransactItems: writes })).catch((error) => {
    if (error instanceof Error && error.name === 'TransactionCanceledException') throw new AnimalConflict('Animal changed since it was loaded. Refresh and retry.');
    throw error;
  });
  await publishRescueChange();
  if (input.kind === 'OUTCOME') {
    // The final animal record is already committed. A failed projection must
    // never make the caller resubmit an irreversible outcome.
    const { completeRescueIfAllAnimalsFinal } = await import('./rescue-completion');
    await completeRescueIfAllAnimalsFinal(animal.rescueId, animal.organisationId, actorUserId)
      .catch(error => console.error('Original rescue completion reconciliation failed:', error));
  }
  return getAnimal(animal.id);
}

/** Correct an animal identification without modifying the original caller report.
 * An atomic version check and append-only event preserve the audit trail.
 */
export async function correctAnimalIdentification(
  animal: AnimalRecord, actorUserId: string, input: { species: string; description: string }
): Promise<AnimalRecord> {
  if (terminal.has(animal.status)) throw new AnimalConflict('A finalised animal cannot be edited.');
  const species = input.species.trim(), description = input.description.trim();
  if (!species || species.length > 120 || description.length > 2000)
    throw new AnimalConflict('Species (1–120) and description (up to 2000) are required.');
  if (animal.species === species && (animal.description ?? '') === description) return animal;
  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Update: {
      TableName: table, Key: key(animal.id),
      UpdateExpression: 'SET species = :species, description = :description, updatedAt = :now, version = :next',
      ConditionExpression: 'version = :version AND organisationId = :org AND NOT (#status IN (:released, :euthanised, :deceased))',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':species': species, ':description': description, ':now': now, ':next': animal.version + 1,
        ':version': animal.version, ':org': animal.organisationId,
        ':released': 'RELEASED', ':euthanised': 'EUTHANISED', ':deceased': 'DECEASED'
      }
    }},
    { Put: {
      TableName: table, Item: {
        pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${eventId}`,
        entity: 'animal_event', id: eventId, animalId: animal.id,
        organisationId: animal.organisationId, type: 'IDENTIFICATION_CORRECTED',
        actorUserId, createdAt: now,
        previousSpecies: animal.species, species,
        previousDescription: animal.description ?? '', description
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }}
  ] })).catch(error => {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      throw new AnimalConflict('Animal changed since it was loaded. Refresh before correcting its identification.');
    throw error;
  });
  await publishRescueChange();
  const updated = await getAnimal(animal.id);
  if (!updated) throw new AnimalConflict('Animal record unavailable after correction.');
  return updated;
}
