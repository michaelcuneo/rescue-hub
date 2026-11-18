#!/usr/bin/env node
/**
 * Local development stress fixtures: 200 deterministic fictional historic rescues.
 * Dry-run by default. NEVER invoked during SST deployment or server start.
 *
 * npx sst shell --stage michael -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage michael
 * Or use --stage demo for the deployed demonstration database.
 * Append --write to commit records after interactive confirmation.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Resource } from 'sst';

const stageFlag = process.argv.indexOf('--stage');
const stage = stageFlag >= 0 ? process.argv[stageFlag + 1] : undefined;
const write = process.argv.includes('--write');
const enrich = process.argv.includes('--enrich');
if (enrich && !write) throw new Error('--enrich requires --write and interactive confirmation.');
if (!['michael', 'demo'].includes(stage) || (process.env.SST_STAGE && process.env.SST_STAGE !== stage)) {
  throw new Error('Historical seed supports only stages michael and demo; the linked SST_STAGE must match.');
}
const table = Resource.RescueHubData?.name;
if (!table || !table.toLowerCase().includes(stage.toLowerCase())) {
  throw new Error('Refusing to seed: linked RescueHubData table name does not contain the requested stage.');
}
if (process.argv.some(a => /^--(delete|force|overwrite)$/.test(a))) {
  throw new Error('Destructive/overwriting seed operations are not available.');
}
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
import { buildHistoricalRescueFixtures, buildTodayCompletedFixtures } from '../../core/historical-rescue-fixtures.mjs';

const historicalFixtures = buildHistoricalRescueFixtures();
const todayFixtures = buildTodayCompletedFixtures();
const fixtures = [...historicalFixtures, ...todayFixtures];
const outcomes = fixtures.reduce((a, item) => {
  const label = item.event.outcome === 'RELEASED'
    ? item.event.releaseReason : item.event.outcome;
  a[label] = (a[label] || 0) + 1;
  return a;
}, {});
console.log('Synthetic Rescue Hub historical archive dataset');
console.log('SST stage:', stage, 'table:', table);
console.log('Historical rescues:', historicalFixtures.length, '| completed today (NSW):', todayFixtures.length);
console.log('Total:', fixtures.length, '| outcomes:', JSON.stringify(outcomes));
console.log('Historical date range:', historicalFixtures[0].rescue.createdAt, 'to', historicalFixtures.at(-1).rescue.createdAt);
console.log('All incidents are fictional and carry demo=true + historicalSeed=true.');
console.log('Each synthetic animal includes pickup, vet and optional carer/release milestones (no inferred route).');
if (!write) {
  console.log('DRY RUN ONLY. Append --write to insert missing records, or --write --enrich to add milestones to earlier seeded records.');
  process.exit(0);
}
if (!stdin.isTTY) throw new Error('Interactive confirmation requires a real terminal.');
const rl = createInterface({ input: stdin, output: stdout });
let answer;
try { answer = await rl.question('Type ' + (enrich ? 'ENRICH' : 'SEED') + ' 208 ' + stage + ' to approve the synthetic dataset: '); }
finally { rl.close(); }
if (answer !== (enrich ? 'ENRICH' : 'SEED') + ' 208 ' + stage) throw new Error('Cancelled: nothing written.');

let inserted = 0, skipped = 0, enriched = 0;
for (const { rescue, animal, event, checkpoints } of fixtures) {
  const old = await db.send(new GetCommand({
    TableName: table, Key: { pk: rescue.pk, sk: rescue.sk }, ConsistentRead: true
  }));
  const put = item => ({
    Put: {
      TableName: table, Item: item,
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
    }
  });
  if (old.Item) {
    if (old.Item.historicalSeed !== true) throw new Error('Unexpected existing non-seed ID ' + rescue.id);
    if (!enrich || old.Item.latestAnimalGps) { skipped++; continue; }
    const existingAnimal = await db.send(new GetCommand({
      TableName: table, Key: { pk: animal.pk, sk: 'META' }, ConsistentRead: true
    }));
    if (!existingAnimal.Item || existingAnimal.Item.historicalSeed !== true ||
      existingAnimal.Item.rescueId !== rescue.id)
      throw new Error('Refusing to enrich an unrecognised animal record ' + animal.id);
    const location = rescue.latestAnimalGps;
    // Conditional, all-or-nothing enrichment. The historical event and real
    // outcome are not overwritten, and a concurrently modified record fails.
    await db.send(new TransactWriteCommand({
      TransactItems: [
        { Update: {
          TableName: table, Key: { pk: rescue.pk, sk: 'META' },
          UpdateExpression: 'SET latestAnimalGps = :gps',
          ConditionExpression: 'historicalSeed = :yes AND attribute_not_exists(latestAnimalGps)',
          ExpressionAttributeValues: { ':gps': location, ':yes': true }
        }},
        { Update: {
          TableName: table, Key: { pk: animal.pk, sk: 'META' },
          UpdateExpression: 'SET lastGpsLatitude = :lat, lastGpsLongitude = :lon, lastGpsAt = :at, lastGpsPhase = :phase',
          ConditionExpression: 'historicalSeed = :yes AND rescueId = :rescue',
          ExpressionAttributeValues: {
            ':yes': true, ':rescue': rescue.id,
            ':lat': location.latitude, ':lon': location.longitude,
            ':at': location.recordedAt, ':phase': location.phase
          }
        }},
        ...checkpoints.map(put)
      ]
    }));
    enriched++;
    continue;
  }
  // Initial seeding includes the full, immutable milestone history in one
  // transaction. No automatic deployment hook or destructive backfill.
  await db.send(new TransactWriteCommand({
    TransactItems: [rescue, animal, event, ...checkpoints].map(put)
  }));
  inserted++;
  if (inserted % 25 === 0) console.log('Inserted', inserted, 'of', fixtures.length);
}
console.log('Finished:', inserted, 'inserted;', enriched, 'safely enriched;', skipped, 'previously seeded and left unchanged.');
console.log('Open Administration > Rescues > Map for recorded injury/vet/care/release locations.');
console.log('Open Operations > Completed for the eight cases completed today in NSW.');
