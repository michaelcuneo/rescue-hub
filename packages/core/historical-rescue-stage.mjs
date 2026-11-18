/**
 * Strict deployment-target guard for the manual synthetic history seeder.
 * Keep separate from AWS dependencies so the safety rules can be tested.
 */
const SEEDABLE_STAGES = new Set(['michael', 'michaelcuneo', 'demo']);

export function assertHistoricalSeedTarget(stage, connectedStage, tableName) {
  if (!SEEDABLE_STAGES.has(stage)) {
    throw new Error('Historical seeding is permitted only for explicitly named synthetic-data stages: michael, michaelcuneo or demo.');
  }
  if (connectedStage && connectedStage !== stage) {
    throw new Error(`Connected SST stage "${connectedStage}" does not match --stage "${stage}".`);
  }
  if (typeof tableName !== 'string' || !tableName.trim()) {
    throw new Error('RescueHubData is not linked. Run via npx sst shell for the intended stage.');
  }
  if (/(^|[-_])(prod|production)([-_]|$)/i.test(tableName)) {
    throw new Error(`Refusing to seed a production DynamoDB table: ${tableName}`);
  }
  // SST physical names include the stage as a delimited segment.
  // Avoid substring matches such as "notmichael" or "dev-old".
  const stageSegment = new RegExp(`(^|[-_])${stage}([-_]|$)`, 'i');
  if (!stageSegment.test(tableName)) {
    throw new Error(`Linked DynamoDB table "${tableName}" does not belong to stage "${stage}".`);
  }
}
