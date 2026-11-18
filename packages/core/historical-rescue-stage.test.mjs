import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertHistoricalSeedTarget } from './historical-rescue-stage.mjs';

for (const stage of ['michael', 'michaelcuneo', 'demo']) {
  test('permits only correctly linked synthetic stage: ' + stage, () => {
    assert.doesNotThrow(() =>
      assertHistoricalSeedTarget(stage, stage, 'rescue-hub-' + stage + '-RescueHubDataTable'));
  });
}
test('rejects stages outside the explicit allowlist', () => {
  for (const stage of ['production', 'prod', 'dev', 'test', '', undefined]) {
    assert.throws(() => assertHistoricalSeedTarget(stage, stage, 'rescue-hub-dev-RescueHubDataTable'));
  }
});
test('rejects mismatched connected SST stage', () => {
  assert.throws(() =>
    assertHistoricalSeedTarget('michaelcuneo', 'michael',
      'rescue-hub-michaelcuneo-RescueHubDataTable'), /does not match/);
});
test('rejects missing and incorrectly scoped DynamoDB tables', () => {
  for (const table of [undefined, '', 'rescue-hub-michael-RescueHubDataTable',
    'rescue-hub-notmichaelcuneo-RescueHubDataTable',
    'rescue-hub-michaelcuneo-RescueHubDataTable-production']) {
    assert.throws(() => assertHistoricalSeedTarget('michaelcuneo', 'michaelcuneo', table));
  }
});
test('does not conflate michael and michaelcuneo', () => {
  assert.throws(() =>
    assertHistoricalSeedTarget('michael', 'michael',
      'rescue-hub-michaelcuneo-RescueHubDataTable'), /does not belong/);
});
