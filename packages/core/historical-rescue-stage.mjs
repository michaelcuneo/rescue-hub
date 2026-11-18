/**
 * Strict deployment-target guard for the manual synthetic history seeder.
 * Keep separate from AWS dependencies so the safety rules can be tested.
 */
const SEEDABLE_STAGES = new Set(['michael', 'dev']);

export function assertHistoricalSeedTarget(stage, connectedStage, tableName) {
  if (!SEEDABLE_STAGES.has(stage)) {
    throw new Error('Historical seeding is permitted only for explicitly named local development stages: michael or dev.');
  }
  if (connectedStage && connectedStage !== stage) {
    throw new Error(`Connected SST stage "${connectedStage}" does not match --stage "${stage}".`);
  }
  if (typeof tableName !== 'string' || !tableName.trim()) {
    throw new Error('RescueHubData is not linked. Run via npx sst shell for the intended stage.');
  }
  if (/(^|[-_])(demo|prod|production)([-_]|$)/i.test(tableName)) {
    throw new Error(`Refusing to seed a demo or production DynamoDB table: ${tableName}`);
  }
  // SST physical names include the stage as a delimited segment.
  // Avoid substring matches such as "notmichael" or "dev-old".
  const stageSegment = new RegExp(`(^|[-_])${stage}([-_]|$)`, 'i');
  if (!stageSegment.test(tableName)) {
    throw new Error(`Linked DynamoDB table "${tableName}" does not belong to stage "${stage}".`);
  }
}
