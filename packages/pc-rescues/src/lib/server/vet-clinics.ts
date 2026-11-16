import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';
import { getAnimal, type AnimalRecord } from './animals';
import { validateVetClinic } from '../../../../core/vet-access';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const table = Resource.RescueHubData.name;
export type VetClinic = {
  id: string; organisationId: string; name: string; address: string;
  latitude: number; longitude: number; active: boolean;
};
const clinicKey = (org: string, id: string) =>
  ({ pk: `ORG#${org}#VET_CLINICS`, sk: `CLINIC#${id}` });
const validId = (id: string) => /^[a-f0-9-]{36}$/i.test(id);

export async function getVetClinic(org: string, id: string): Promise<VetClinic | null> {
  if (!org || !validId(id)) return null;
  const res = await db.send(new GetCommand({ TableName: table, Key: clinicKey(org, id), ConsistentRead: true }));
  return res.Item?.active === true && res.Item.organisationId === org ? res.Item as VetClinic : null;
}
export async function listVetClinics(org: string): Promise<VetClinic[]> {
  const clinics: VetClinic[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table, KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `ORG#${org}#VET_CLINICS`, ':prefix': 'CLINIC#' },
      ExclusiveStartKey: cursor
    }));
    clinics.push(...(page.Items ?? []).filter(x => x.active === true && x.organisationId === org).map(x => x as VetClinic));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return clinics.sort((a, b) => a.name.localeCompare(b.name));
}
export async function createVetClinic(org: string, raw: Parameters<typeof validateVetClinic>[0]) {
  const clinic = validateVetClinic(raw);
  const id = crypto.randomUUID();
  const item: VetClinic = { ...clinic, id, organisationId: org, active: true };
  await db.send(new PutCommand({
    TableName: table, Item: { ...clinicKey(org,id), ...item, entity: 'vet_clinic', createdAt: new Date().toISOString() },
    ConditionExpression: 'attribute_not_exists(pk)'
  }));
  return item;
}
/** Query explicit handover links, NOT all animal records. Every returned
 * animal is re-authorised against current clinic and veterinary custody.
 * Links are retained as an audit breadcrumb after collection.
 */
export async function listVetClinicAnimals(org: string, clinicId: string) {
  const animals: AnimalRecord[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: { ':pk': `VET_CLINIC#${org}#${clinicId}`, ':prefix': 'ANIMAL#' },
      ExclusiveStartKey: cursor
    }));
    for (const item of page.Items ?? []) {
      if (typeof item.animalId !== 'string') continue;
      const animal = await getAnimal(item.animalId);
      if (animal?.organisationId === org && animal.vetClinicId === clinicId &&
          animal.status === 'AT_VET' && animal.physicalCustodianType === 'VET')
        animals.push(animal);
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return animals.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
}
