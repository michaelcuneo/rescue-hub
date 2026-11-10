import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowRescuePin } from './case-map-visibility.ts';

test('new unclaimed rescue appears on operational map', () => {
  assert.equal(shouldShowRescuePin({ status: 'PENDING' }), true);
});
test('claim is not physical pickup: claimed job stays on map', () => {
  assert.equal(shouldShowRescuePin({ status: 'ASSIGNED' }), true);
});
test('physical collection removes job pin without deleting its animal record', () => {
  assert.equal(shouldShowRescuePin({ status: 'ASSIGNED', pickedUpAt: '2026-11-11T08:12:00Z' }), false);
});
test('completed, cancelled, euthanised and released care never produce map pins', () => {
  for (const status of ['COMPLETED', 'CANCELLED', 'EUTHANISED', 'RELEASED']) {
    assert.equal(shouldShowRescuePin({ status }), false, status);
  }
});
test('fresh transport pickup has its own visible pin; collection hides it', () => {
  assert.equal(shouldShowRescuePin({ status: 'PENDING' }), true);
  assert.equal(shouldShowRescuePin({ status: 'ASSIGNED' }), true);
  assert.equal(shouldShowRescuePin({ status: 'ASSIGNED', pickedUpAt: '2026-11-11T08:12:00Z' }), false);
});
