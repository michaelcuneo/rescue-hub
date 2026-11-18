import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoricalRescueFixtures } from './historical-rescue-fixtures.mjs';

const rows = buildHistoricalRescueFixtures();

test('exactly 200 unique historical rescue cases with linked animal and final event', () => {
  assert.equal(rows.length, 200);
  assert.equal(new Set(rows.map(row => row.rescue.id)).size, 200);
  for (const { rescue, animal, event } of rows) {
    assert.equal(rescue.demo, true);
    assert.equal(rescue.historicalSeed, true);
    assert.equal(rescue.status, 'COMPLETED');
    assert.equal(rescue.gsi1pk, 'STATUS#COMPLETED');
    assert.equal(rescue.gsi2pk, 'RESCUES');
    assert.equal(rescue.gsi2sk, rescue.createdAt + '#' + rescue.id);
    assert.equal(animal.rescueId, rescue.id);
    assert.equal(animal.id, rescue.quickAnimalId);
    assert.equal(event.originalRescueId, rescue.id);
    assert.equal(event.animalId, animal.id);
    assert.equal(event.outcome, animal.status);
    assert.equal(event.type, 'FINAL_OUTCOME');
    assert.ok(Date.parse(rescue.createdAt) < Date.parse(rescue.completedAt));
    assert.ok(Date.parse(rescue.completedAt) <= Date.parse('2026-11-18T00:00:00Z'));
    assert.ok(rescue.latitude >= -90 && rescue.latitude <= 90);
    assert.ok(rescue.longitude >= -180 && rescue.longitude <= 180);
  }
});

test('historical cases include relocation, original-site returns, euthanasia and death', () => {
  const count = key => rows.filter(row => row.event.releaseReason === key || row.event.outcome === key).length;
  assert.equal(count('RELOCATION'), 80);
  assert.equal(count('ORIGINAL_SITE'), 80);
  assert.equal(count('EUTHANISED'), 30);
  assert.equal(count('DECEASED'), 10);
  for (const { rescue, animal, event } of rows) {
    if (event.outcome !== 'RELEASED') continue;
    assert.equal(event.latitude, animal.releaseLatitude);
    assert.equal(event.longitude, animal.releaseLongitude);
    assert.equal(rescue.historicalReleaseLatitude, event.latitude);
    if (event.releaseReason === 'ORIGINAL_SITE') {
      assert.equal(event.latitude, rescue.latitude);
      assert.equal(event.longitude, rescue.longitude);
    } else {
      assert.notDeepEqual([event.latitude, event.longitude], [rescue.latitude, rescue.longitude]);
    }
  }
});

test('seed generation is reproducible and distributed across dates and locations', () => {
  assert.deepEqual(buildHistoricalRescueFixtures(), rows);
  assert.ok(new Set(rows.map(row => row.rescue.createdAt.slice(0, 10))).size > 170);
  assert.ok(new Set(rows.map(row => row.rescue.location)).size >= 20);
  assert.ok(rows[0].rescue.createdAt.startsWith('2024-'));
  assert.ok(rows.at(-1).rescue.createdAt.startsWith('2026-'));
});
