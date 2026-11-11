import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileRescueSnapshots } from './rescue-feed-reconciliation.ts';

test('new DynamoDB rescue is visible even when AppSync returns old non-empty data', () => {
  const result = reconcileRescueSnapshots(
    [{ id: 'old', status: 'PENDING', updatedAt: '2026-11-10T00:00:00Z' }],
    [{ id: 'old', status: 'PENDING', updatedAt: '2026-11-10T00:00:00Z' },
     { id: 'phone-report-cane-toad', status: 'PENDING', updatedAt: '2026-11-11T04:00:00Z' }]
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'phone-report-cane-toad');
});
test('freshest update wins, including status updates', () => {
  const result = reconcileRescueSnapshots(
    [{ id: 'a', status: 'ASSIGNED', updatedAt: '2026-11-11T04:01:00Z' }],
    [{ id: 'a', status: 'PENDING', updatedAt: '2026-11-11T04:00:00Z' }]
  );
  assert.equal(result[0].status, 'ASSIGNED');
});
test('equal timestamps trust the dispatch index, no duplicate IDs', () => {
  const result = reconcileRescueSnapshots(
    [{ id: 'a', status: 'PENDING', updatedAt: '2026-11-11T04:00:00Z' }],
    [{ id: 'a', status: 'ASSIGNED', updatedAt: '2026-11-11T04:00:00Z' }]
  );
  assert.deepEqual(result.map(r => r.status), ['ASSIGNED']);
});
test('either source alone still works', () => {
  assert.equal(reconcileRescueSnapshots([], [{ id: 'a' }]).length, 1);
  assert.equal(reconcileRescueSnapshots([{ id: 'b' }], []).length, 1);
});
