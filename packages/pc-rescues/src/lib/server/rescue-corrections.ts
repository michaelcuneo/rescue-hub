import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getRescue, type Rescue } from './graphql';
import { publishRescueChange } from './realtime';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const table = Resource.RescueHubData.name;
export class RescueCorrectionConflict extends Error {}

/** The MOP observation is never edited. A qualified claimed responder may
 * replace the operational species/condition, with a full audit of both values.
 */
export async function correctReportedRescue(
  rescue: Rescue, userId: string, input: { type: string; injury: string }
) {
  const type = input.type.trim(), injury = input.injury.trim();
  if (type.length < 2 || type.length > 120 || injury.length > 2000)
    throw new RescueCorrectionConflict('Provide a valid animal identification and condition.');
  if (!rescue.organisationId || rescue.assignedUserId !== userId ||
      rescue.status !== 'ASSIGNED')
    throw new RescueCorrectionConflict('Only the assigned rescuer can correct an active rescue.');
  if (type === rescue.type && injury === (rescue.injury ?? '')) return rescue;
  const now = new Date().toISOString(), id = crypto.randomUUID();
  await db.send(new TransactWriteCommand({ TransactItems: [
    { Update: {
      TableName: table, Key: { pk: `RESCUE#${rescue.id}`, sk: 'META' },
      UpdateExpression: 'SET #type = :type, injury = :injury, updatedAt = :now',
      ConditionExpression: 'organisationId = :org AND assignedUserId = :user AND #status = :assigned AND #type = :oldType AND (injury = :oldInjury OR (attribute_not_exists(injury) AND :oldInjury = :blank))',
      ExpressionAttributeNames: { '#type': 'type', '#status': 'status' },
      ExpressionAttributeValues: {
        ':type': type, ':injury': injury, ':now': now,
        ':org': rescue.organisationId, ':user': userId, ':assigned': 'ASSIGNED',
        ':oldType': rescue.type, ':oldInjury': rescue.injury ?? '', ':blank': ''
      }
    }},
    { Put: {
      TableName: table,
      Item: {
        pk: `RESCUE#${rescue.id}`, sk: `EVENT#${now}#${id}`,
        entity: 'rescue_event', id, rescueId: rescue.id, organisationId: rescue.organisationId,
        actorUserId: userId, type: 'PUBLIC_OBSERVATION_CORRECTED',
        previousAnimal: rescue.type, correctedAnimal: type,
        previousCondition: rescue.injury ?? '', correctedCondition: injury, createdAt: now
      },
      ConditionExpression: 'attribute_not_exists(pk)'
    }}
  ] })).catch(error => {
    if (error instanceof Error && error.name === 'TransactionCanceledException')
      throw new RescueCorrectionConflict('Rescue was changed by another user. Refresh before correcting the report.');
    throw error;
  });
  await publishRescueChange();
  return getRescue(rescue.id);
}
