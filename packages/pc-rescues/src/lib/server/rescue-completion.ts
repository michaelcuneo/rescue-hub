import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { listRescueAnimals } from './animals';
import { publishRescueChange } from './realtime';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = Resource.RescueHubData.name;
const terminal = new Set(['RELEASED', 'EUTHANISED', 'DECEASED']);

/**
 * Reconciles the original operational job after every recorded final outcome.
 * Does not delete animal records, events, attachments or history.
 * A multiple-animal incident only closes when every animal is finalised.
 * The animalCount check prevents completing a rescue during registration.
 */
export async function completeRescueIfAllAnimalsFinal(
  rescueId: string, organisationId: string, actorUserId: string
): Promise<boolean> {
  const indexed = await listRescueAnimals(rescueId, organisationId);
  if (!indexed.length) return false;
  // GSI queries are eventually consistent. Resolve each permanent animal
  // directly with consistent reads before deciding whether the case can close.
  const animals = await Promise.all(indexed.map(async animal => {
    const current = await db.send(new GetCommand({
      TableName: table, Key: { pk: `ANIMAL#${animal.id}`, sk: 'META' }, ConsistentRead: true
    }));
    return current.Item;
  }));
  if (animals.some(animal => !animal || animal.organisationId !== organisationId ||
      !terminal.has(String(animal.status)))) return false;
  const meta = await db.send(new GetCommand({
    TableName: table, Key: { pk: `RESCUE#${rescueId}`, sk: 'META' }, ConsistentRead: true
  }));
  const rescue = meta.Item;
  if (!rescue || rescue.organisationId !== organisationId ||
      !['ASSIGNED', 'PENDING'].includes(String(rescue.status))) return false;
  const count = Number(rescue.animalCount ?? 0);
  if (count && count !== animals.length) return false;

  const now = new Date().toISOString(), eventId = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: {
        TableName: table, Key: { pk: `RESCUE#${rescueId}`, sk: 'META' },
        UpdateExpression: 'SET #status = :completed, gsi1pk = :index, updatedAt = :now',
        ConditionExpression: 'organisationId = :org AND #status = :previous AND (attribute_not_exists(animalCount) OR animalCount = :count)',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':completed': 'COMPLETED', ':index': 'STATUS#COMPLETED',
          ':now': now, ':org': organisationId, ':previous': rescue.status, ':count': animals.length
        }
      }},
      { Put: {
        TableName: table, Item: {
          pk: `RESCUE#${rescueId}`, sk: `EVENT#${now}#${eventId}`,
          entity: 'rescue_event', id: eventId, rescueId, organisationId,
          type: 'ALL_ANIMAL_OUTCOMES_FINAL', actorUserId, createdAt: now,
          animalCount: animals.length
        }, ConditionExpression: 'attribute_not_exists(pk)'
      }}
    ] }));
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException') return false;
    throw error;
  }
  await publishRescueChange();
  return true;
}
