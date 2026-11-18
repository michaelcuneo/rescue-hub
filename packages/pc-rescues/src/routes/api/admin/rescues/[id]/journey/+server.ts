import { json } from '@sveltejs/kit';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { hasAdministrativeRole } from '$lib/server/auth';
import { listArchiveResponderNames } from '$lib/server/rescue-archive';
import { listRescueAnimals, listAnimalEvents } from '$lib/server/animals';
import type { RequestHandler } from './$types';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = Resource.RescueHubData.name;
const milestones = new Set([
  'ANIMAL_COLLECTED', 'TRANSPORT_ANIMAL_COLLECTED', 'MISTAKEN_PICKUP_CORRECTED',
  'ANIMAL_REGISTERED', 'TRANSFER_REQUESTED', 'TRANSFER_ACCEPTED',
  'VET_TRANSPORT_STARTED', 'VET_DROPOFF', 'VET_ASSESSED',
  'CARE_STARTED', 'TRANSPORT_PICKUP_CONFIRMED', 'TRANSPORT_HANDOVER_ACCEPTED',
  'FINAL_OUTCOME', 'CARER_CLAIMED', 'CARE_RESERVED', 'REGISTRATION_VOIDED'
]);

/**
 * Admin-only audit detail for ONE selected rescue. The archive pins themselves
 * never rely on this endpoint and remain on the map after physical pickup or
 * completion. Only a genuine recorded GPS release produces an extra map pin.
 * Named care/vet destinations are text, not invented geocoded coordinates.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
  const actor = locals.user;
  if (!actor?.enabled || actor.status !== 'ACTIVE' || !hasAdministrativeRole(actor))
    return json({ error: 'Administration access required.' }, { status: 403 });
  if (!/^[a-z0-9-]{1,160}$/i.test(params.id))
    return json({ error: 'Invalid rescue identifier.' }, { status: 400 });

  try {
    const result = await db.send(new GetCommand({
      TableName: tableName,
      Key: { pk: `RESCUE#${params.id}`, sk: 'META' },
      ConsistentRead: true
    }));
    const rescue = result.Item;
    const isAuthority = actor.roles.includes('PLATFORM_ADMIN') || actor.roles.includes('AUTHORITY_ADMIN');
    if (!rescue || !rescue.organisationId || (!isAuthority && rescue.organisationId !== actor.organisationId))
      return json({ error: 'Rescue not found.' }, { status: 404 });

    const [animals, names, rescueEvents] = await Promise.all([
      listRescueAnimals(params.id, String(rescue.organisationId)),
      listArchiveResponderNames(String(rescue.organisationId)),
      (async () => {
        const rows: Record<string, unknown>[] = [];
        let cursor: Record<string, unknown> | undefined;
        do {
          const response = await db.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
            ExpressionAttributeValues: { ':pk': `RESCUE#${params.id}`, ':prefix': 'EVENT#' },
            ExclusiveStartKey: cursor
          }));
          rows.push(...(response.Items ?? []));
          cursor = response.LastEvaluatedKey;
        } while (cursor);
        return rows;
      })()
    ]);
    const nameFor = (id: unknown): string | null =>
      typeof id === 'string' && id ? names.get(id) ?? 'Former or unlisted volunteer' : null;
    const nonEmpty = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() ? value.trim() : null;
    const safeGps = (lat: unknown, lon: unknown): { latitude: number; longitude: number } | null =>
      typeof lat === 'number' && typeof lon === 'number' &&
      Number.isFinite(lat) && Number.isFinite(lon) &&
      Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
      (lat !== 0 || lon !== 0) ? { latitude: lat, longitude: lon } : null;

    const gpsPoints: Array<{
      id: string; animalId: string; type: string; phase: string;
      latitude: number; longitude: number; at: string; accuracy: number | null
    }> = [];
    const history: Array<{
      id: string; type: string; at: string; animalId: string | null;
      actorName: string | null; fromName: string | null; toName: string | null;
      destination: string | null; outcome: string | null
    }> = [];
    const addEvent = (row: Record<string, unknown>, animalId: string | null) => {
      if (!milestones.has(String(row.type))) return;
      history.push({
        id: String(row.id ?? row.sk ?? ''),
        type: String(row.type),
        at: String(row.occurredAt ?? row.createdAt ?? ''),
        animalId,
        actorName: nameFor(row.actorUserId),
        fromName: nameFor(row.fromUserId ?? row.previousCustodianUserId),
        toName: nameFor(row.toUserId ?? row.currentCustodianUserId),
        destination: nonEmpty(row.destination ?? row.location ?? row.clinicName),
        outcome: nonEmpty(row.outcome)
      });
    };
    for (const event of rescueEvents) addEvent(event, null);

    const animalDetails = await Promise.all(animals.map(async animal => {
      const events = await listAnimalEvents(animal.id);
      for (const event of events) {
        addEvent(event, animal.id);
        if (event.type === 'GPS_CHECKPOINT') {
          const point = safeGps(event.latitude, event.longitude);
          if (point) gpsPoints.push({
            id: String(event.id ?? event.sk ?? ''),
            animalId: animal.id, type: 'GPS_CHECKPOINT',
            phase: typeof event.phase === 'string' ? event.phase : 'CHECKPOINT',
            ...point,
            at: String(event.createdAt ?? ''),
            accuracy: typeof event.accuracy === 'number' ? event.accuracy : null
          });
        }
      }
      // Release GPS comes from the permanent animal record. The append-only
      // outcome event also supports older records where META lacked fields.
      const final = events.find(row => row.type === 'FINAL_OUTCOME' && row.outcome === 'RELEASED');
      const gps = safeGps(animal.releaseLatitude ?? final?.latitude, animal.releaseLongitude ?? final?.longitude);
      const releaseReason = nonEmpty(animal.releaseReason ?? final?.releaseReason);
      return {
        id: animal.id, species: animal.species, status: animal.status,
        currentLocation: nonEmpty(animal.currentLocation),
        custodianName: nameFor(animal.currentCustodianUserId),
        physicalCustodianName: nonEmpty(animal.physicalCustodianName),
        releasedAt: nonEmpty(animal.releasedAt ?? final?.createdAt),
        releaseLocation: nonEmpty(animal.releaseLocation ?? final?.location),
        releaseReason,
        releasePoint: gps
      };
    }));

    history.sort((a, b) => a.at.localeCompare(b.at));
    gpsPoints.sort((a, b) => a.at.localeCompare(b.at));
    const collected = rescueEvents.find(event =>
      event.type === 'ANIMAL_COLLECTED' || event.type === 'TRANSPORT_ANIMAL_COLLECTED');
    return json({
      rescueId: params.id,
      assignedResponderName: nameFor(rescue.assignedUserId),
      pickupAt: nonEmpty(rescue.pickedUpAt ?? collected?.createdAt),
      pickedUpByName: nameFor(collected?.actorUserId),
      // No separately measured pickup GPS is saved by today's pickup workflow.
      // Do not misrepresent the original incident point as verified pickup GPS.
      pickupGpsRecorded: false,
      animals: animalDetails,
      gpsPoints,
      history
    }, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    console.error('Unable to load rescue journey audit', error);
    return json({ error: 'Unable to load rescue custody history.' }, { status: 503 });
  }
};
