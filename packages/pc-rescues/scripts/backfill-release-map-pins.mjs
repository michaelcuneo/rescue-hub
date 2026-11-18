#!/usr/bin/env node
/**
 * Optional one-time archive projection repair for older real release records.
 * Reads existing permanent animal GPS; never manufactures an address or point.
 * Dry-run by default. Only explicitly named michael/demo SST stages.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const at = process.argv.indexOf('--stage');
const stage = at >= 0 ? process.argv[at + 1] : '';
const write = process.argv.includes('--write');
if (!['michael', 'demo'].includes(stage) ||
  (process.env.SST_STAGE && process.env.SST_STAGE !== stage))
  throw new Error('Only michael or demo with matching SST stage is allowed.');
const table = Resource.RescueHubData?.name;
if (!table || !table.toLowerCase().includes(stage))
  throw new Error('Refusing archive projection backfill: linked table does not identify the requested stage.');
if (process.argv.some(arg => ['--force', '--delete', '--overwrite'].includes(arg)))
  throw new Error('Destructive options are unsupported.');

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
const valid = (lat, lon) => typeof lat === 'number' && typeof lon === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180 && (lat !== 0 || lon !== 0);

async function* listRescues() {
  let key;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table, IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: { ':pk': 'RESCUES' },
      ExclusiveStartKey: key
    }));
    for (const row of page.Items ?? []) if (row.entity === 'rescue' && row.id && row.organisationId) yield row;
    key = page.LastEvaluatedKey;
  } while (key);
}
async function listAnimals(rescue) {
  const animals = [];
  let key;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table, IndexName: 'gsi2',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: { ':pk': 'RESCUE_ANIMALS#' + rescue.id },
      ExclusiveStartKey: key
    }));
    animals.push(...(page.Items ?? []).filter(row =>
      row.entity === 'animal' && row.organisationId === rescue.organisationId &&
      row.rescueId === rescue.id && row.status === 'RELEASED'));
    key = page.LastEvaluatedKey;
  } while (key);
  return animals;
}

let checked = 0, suitable = 0, skipped = 0, conflicts = 0;
console.log('Rescue Hub release map projection backfill / stage:', stage, '/ table:', table);
if (write) {
  if (!stdin.isTTY) throw new Error('Writes require an interactive terminal.');
  const rl = createInterface({ input: stdin, output: stdout });
  let answer;
  try { answer = await rl.question('Type BACKFILL RELEASES ' + stage + ': '); }
  finally { rl.close(); }
  if (answer !== 'BACKFILL RELEASES ' + stage) throw new Error('No changes made.');
}
for await (const rescue of listRescues()) {
  checked++;
  // Existing projections may contain several animals; never replace them.
  if (Array.isArray(rescue.releaseSites) && rescue.releaseSites.length) { skipped++; continue; }
  const animals = await listAnimals(rescue);
  const sites = animals.filter(animal => valid(animal.releaseLatitude, animal.releaseLongitude))
    .map(animal => ({
      animalId: animal.id,
      latitude: animal.releaseLatitude,
      longitude: animal.releaseLongitude,
      reason: animal.releaseReason === 'RELOCATION' ? 'RELOCATION' : 'ORIGINAL_SITE',
      location: typeof animal.releaseLocation === 'string' ? animal.releaseLocation : '',
      releasedAt: typeof animal.releasedAt === 'string' ? animal.releasedAt : animal.updatedAt
    }));
  if (!sites.length) { skipped++; continue; }
  suitable++;
  if (!write) continue;
  try {
    await db.send(new UpdateCommand({
      TableName: table, Key: { pk: rescue.pk, sk: rescue.sk },
      UpdateExpression: 'SET releaseSites = :sites',
      ConditionExpression: 'attribute_exists(pk) AND organisationId = :org AND attribute_not_exists(releaseSites)',
      ExpressionAttributeValues: { ':sites': sites, ':org': rescue.organisationId }
    }));
  } catch (error) {
    if (error instanceof Error && error.name === 'ConditionalCheckFailedException') {
      conflicts++;
      continue;
    }
    throw error;
  }
}
console.log(JSON.stringify({
  stage, checked, suitable, skipped, conflicts, writesAttempted: write,
  message: write ? 'Projection repair finished; immutable animal records unchanged.' :
    'DRY RUN: no changes written. Append --write to project verified historical release GPS.'
}, null, 2));
