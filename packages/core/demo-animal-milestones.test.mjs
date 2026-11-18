import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSyntheticAnimalMilestones, DEMO_CARER_LOCATIONS } from './demo-animal-milestones.mjs';
const rescue = { id: 'demo-case', latitude: -32.93, longitude: 151.77,
  location: 'Fictional report site', assignedUserId: 'demo-user',
  pickedUpAt: '2026-11-15T00:00:00Z', historicalSeed: true };
const animal = { id: 'demo-animal', organisationId: 'demo-org', historicalSeed: true };
const event = { historicalSeed: true, outcome: 'RELEASED',
  latitude: -32.94, longitude: 151.75, location: 'Fictional habitat',
  createdAt: '2026-11-18T00:00:00Z' };
test('creates reproducible injury-to-vet-to-carer-to-release milestones without a route', () => {
  const a = buildSyntheticAnimalMilestones(rescue, animal, event);
  assert.deepEqual(a, buildSyntheticAnimalMilestones(rescue, animal, event));
  assert.deepEqual(a.checkpoints.map(item => item.phase),
    ['PICKUP', 'VET_ARRIVAL', 'CARER_HANDOVER', 'RELEASE_SITE']);
  assert.equal(a.projection.phase, 'RELEASE_SITE');
  assert.equal(a.projection.latitude, -32.94);
  assert.ok(a.checkpoints.every(item => item.syntheticJourney && item.historicalSeed));
});
test('euthanasia retains the last recorded vet point without inventing care or release', () => {
  const a = buildSyntheticAnimalMilestones(rescue, animal,
    { ...event, outcome: 'EUTHANISED' });
  assert.deepEqual(a.checkpoints.map(item => item.phase), ['PICKUP', 'VET_ARRIVAL']);
});
test('does not generate synthetic GPS for non-demo data', () => {
  assert.throws(() => buildSyntheticAnimalMilestones({ ...rescue, historicalSeed: false }, animal, event));
});
test('presenter location is labelled a demo substitute', () => {
  assert.match(DEMO_CARER_LOCATIONS.at(-1).address, /28 Mitchell St.*demo placeholder/);
});
