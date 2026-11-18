#!/usr/bin/env node
/**
 * Local development stress fixtures: 200 deterministic fictional historic rescues.
 * Dry-run by default. NEVER invoked during SST deployment or server start.
 *
 * npx sst shell --stage dev -- node packages/pc-rescues/scripts/seed-historical-rescues.mjs --stage dev
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
if (stage !== 'dev' || process.env.SST_STAGE !== 'dev') {
  throw new Error('Historical seed supports only SST stage dev, with matching --stage dev.');
}
const table = Resource.RescueHubData?.name;
if (!table || !/(^|[-_])dev([-_]|$)/i.test(table)) {
  throw new Error('Refusing to seed: linked RescueHubData table is not explicitly a dev-stage table.');
}
if (process.argv.some(a => /^--(delete|force|overwrite)$/.test(a))) {
  throw new Error('Destructive/overwriting seed operations are not available.');
}
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true }
});
import { buildHistoricalRescueFixtures } from '../../core/historical-rescue-fixtures.mjs';

const fixtures = buildHistoricalRescueFixtures();
const outcomes = fixtures.reduce((a, item) => {
  const label = item.event.outcome === 'RELEASED'
    ? item.event.releaseReason : item.event.outcome;
  a[label] = (a[label] || 0) + 1;
  return a;
}, {});
console.log('Synthetic Rescue Hub historical archive dataset');
console.log('SST stage:', stage, 'table:', table);
console.log('Rescues:', fixtures.length, '| outcomes:', JSON.stringify(outcomes));
console.log('Date range:', fixtures[0].rescue.createdAt, 'to', fixtures.at(-1).rescue.createdAt);
console.log('All incidents are fictional and carry demo=true + historicalSeed=true.');
if (!write) {
  console.log('DRY RUN ONLY. Append --write to insert these 200 deterministic historical records.');
  process.exit(0);
}
if (!stdin.isTTY) throw new Error('Interactive confirmation requires a real terminal.');
const rl = createInterface({ input: stdin, output: stdout });
let answer;
try { answer = await rl.question('Type SEED 200 dev to create the historical dataset: '); }
finally { rl.close(); }
if (answer !== 'SEED 200 dev') throw new Error('Cancelled: nothing written.');

let inserted = 0, skipped = 0;
for (const { rescue, animal, event } of fixtures) {
  const old = await db.send(new GetCommand({
    TableName: table, Key: { pk: rescue.pk, sk: rescue.sk }, ConsistentRead: true
  }));
  if (old.Item) {
    if (old.Item.historicalSeed !== true) throw new Error('Unexpected existing non-seed ID ' + rescue.id);
    skipped++;
    continue;
  }
  // All three records are committed atomically; a partial animal timeline is
  // never created. Existing natural/real records cannot be overwritten.
  await db.send(new TransactWriteCommand({
    TransactItems: [rescue, animal, event].map(item => ({
      Put: {
        TableName: table, Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)'
      }
    }))
  }));
  inserted++;
  if (inserted % 25 === 0) console.log('Inserted', inserted, 'of', fixtures.length);
}
console.log('Finished:', inserted, 'inserted;', skipped, 'previously seeded and left unchanged.');
console.log('Open Administration > Rescues > Map > All rescues to view the history.');
