import { json } from '@sveltejs/kit';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getAnimal } from '$lib/server/animals';
import { validateAnimalGpsPosition, isActiveAnimalForGps } from '../../../../../../../../core/animal-gps';
import type { RequestHandler } from './$types';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const table = Resource.RescueHubData.name;

/** Explicit foreground, current-custodian animal GPS checkpoints.
 * No background location tracking, and no reporting/public access.
 * Append-only GPS events remain tied to the animal's ORIGINAL rescue.
 */
export const POST: RequestHandler = async ({ locals, params, request }) => {
  const user = locals.user;
  if (!user?.enabled || user.status !== 'ACTIVE' || !user.organisationId ||
    user.roles.includes('PUBLIC_REPORTER') || user.roles.includes('VET_STAFF'))
    return json({ error: 'An active animal custodian is required.' }, { status: 403 });
  const animal = await getAnimal(params.id);
  if (!animal || animal.organisationId !== user.organisationId ||
    animal.currentCustodianUserId !== user.id || !isActiveAnimalForGps(animal.status))
    return json({ error: 'Only the active physical custodian can record this animal’s GPS.' }, { status: 403 });
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input) return json({ error: 'A GPS checkpoint is required.' }, { status: 400 });
  let point: ReturnType<typeof validateAnimalGpsPosition>;
  try { point = validateAnimalGpsPosition(input); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid GPS.' }, { status: 400 }); }
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  try {
    await db.send(new TransactWriteCommand({
      TransactItems: [
        { Update: {
          TableName: table, Key: { pk: `ANIMAL#${animal.id}`, sk: 'META' },
          UpdateExpression: 'SET lastGpsLatitude = :lat, lastGpsLongitude = :lon, lastGpsAt = :at, lastGpsPhase = :phase',
          ConditionExpression: 'organisationId = :org AND currentCustodianUserId = :user AND #status IN (:rescue,:transit,:vet,:care)',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':org': animal.organisationId, ':user': user.id,
            ':rescue': 'IN_RESCUE', ':transit': 'IN_TRANSIT', ':vet': 'AT_VET', ':care': 'IN_CARE',
            ':lat': point.latitude, ':lon': point.longitude, ':at': now, ':phase': point.phase
          }
        }},
        { Update: {
          TableName: table, Key: { pk: `RESCUE#${animal.rescueId}`, sk: 'META' },
          UpdateExpression: 'SET latestAnimalGps = :point',
          ConditionExpression: 'attribute_exists(pk) AND organisationId = :org',
          ExpressionAttributeValues: { ':org': animal.organisationId,
            ':point': {
              animalId: animal.id, latitude: point.latitude, longitude: point.longitude,
              recordedAt: now, phase: point.phase
            } }
        }},
        { Put: {
          TableName: table,
          Item: {
            pk: `ANIMAL#${animal.id}`, sk: `EVENT#${now}#${eventId}`,
            id: eventId, entity: 'animal_event', animalId: animal.id,
            organisationId: animal.organisationId, sourceRescueId: animal.rescueId,
            type: 'GPS_CHECKPOINT', phase: point.phase,
            latitude: point.latitude, longitude: point.longitude,
            accuracy: point.accuracy, actorUserId: user.id, createdAt: now
          },
          ConditionExpression: 'attribute_not_exists(pk)'
        }}
      ]
    }));
    return json({ ok: true, recordedAt: now, point });
  } catch (error) {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      return json({ error: 'Custody or animal status changed. Stop tracking and refresh.' }, { status: 409 });
    console.error('Animal GPS checkpoint failed', error);
    return json({ error: 'Could not save the GPS checkpoint.' }, { status: 503 });
  }
};
