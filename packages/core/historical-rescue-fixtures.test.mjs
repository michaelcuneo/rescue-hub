import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHistoricalRescueFixtures, buildTodayCompletedFixtures } from './historical-rescue-fixtures.mjs';

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

test('eight synthetic Dispatch completions use today NSW and old report dates', () => {
  const now = Date.parse('2026-11-18T02:00:00.000Z');
  const rows = buildTodayCompletedFixtures(now);
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map(row => row.rescue.id)).size, 8);
  for (const { rescue, animal, event } of rows) {
    assert.equal(rescue.status, 'COMPLETED');
    assert.equal(rescue.completedAt, new Date(now).toISOString());
    assert.equal(rescue.historicalSeed, true);
    assert.equal(rescue.demoTodaySeed, true);
    assert.match(rescue.id, /^demo-today-completed-2026-11-18-/);
    assert.ok(Date.parse(rescue.createdAt) < Date.parse(rescue.completedAt));
    assert.equal(animal.rescueId, rescue.id);
    assert.equal(event.originalRescueId, rescue.id);
    assert.equal(event.animalId, animal.id);
    assert.equal(event.outcome, animal.status);
    assert.equal(rescue.gsi1pk, 'STATUS#COMPLETED');
    assert.equal(rescue.gsi2sk, rescue.createdAt + '#' + rescue.id);
  }
  const outcomes = rows.reduce((result, row) => {
    const key = row.event.releaseReason ?? row.event.outcome;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(outcomes, {
    RELOCATION: 2, ORIGINAL_SITE: 2, EUTHANISED: 3, DECEASED: 1
  });
  assert.deepEqual(rows, buildTodayCompletedFixtures(now));
});

test('NSW next-day completion fixtures rotate the IDs without reusing yesterday', () => {
  const beforeMidnight = buildTodayCompletedFixtures(Date.parse('2026-11-18T12:59:00.000Z'));
  const afterMidnight = buildTodayCompletedFixtures(Date.parse('2026-11-18T13:01:00.000Z'));
  assert.match(beforeMidnight[0].rescue.id, /2026-11-18/);
  assert.match(afterMidnight[0].rescue.id, /2026-11-19/);
  assert.notEqual(beforeMidnight[0].rescue.pk, afterMidnight[0].rescue.pk);
});
