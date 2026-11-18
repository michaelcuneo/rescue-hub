import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentAnimalPin } from './current-animal-pin.ts';

const rescue = { latitude: -32.93, longitude: 151.77, location: 'Original injury' };
test('uses report pin before any independently captured checkpoint', () => {
  assert.deepEqual(currentAnimalPin(rescue), {
    latitude: -32.93, longitude: 151.77, label: 'Original injury', kind: 'reported'
  });
});
test('shows one latest valid animal checkpoint, not a second report marker', () => {
  const pin = currentAnimalPin({
    ...rescue,
    latestAnimalGps: { animalId: 'a1', latitude: -32.92, longitude: 151.75,
      phase: 'CARER_HANDOVER', recordedAt: '2026-11-18T01:00:00Z', location: 'Fictional carer' }
  });
  assert.equal(pin.kind, 'checkpoint');
  assert.equal(pin.label, 'Fictional carer');
  assert.deepEqual([pin.latitude, pin.longitude], [-32.92, 151.75]);
});
test('final release wins over older GPS without inventing a line or route', () => {
  const pin = currentAnimalPin({
    ...rescue, animalStatus: 'RELEASED',
    latestAnimalGps: { latitude: -32.92, longitude: 151.74, recordedAt: '2026-11-17T00:00:00Z' },
    releaseSites: [{ latitude: -32.95, longitude: 151.71,
      location: 'Fictional release site', releasedAt: '2026-11-18T00:00:00Z' }]
  });
  assert.equal(pin.kind, 'release');
  assert.equal(pin.label, 'Fictional release site');
});
test('ignores invalid GPS in favour of the original report point', () => {
  assert.equal(currentAnimalPin({
    ...rescue, latestAnimalGps: { latitude: 0, longitude: 0, phase: 'CHECKPOINT' }
  }).kind, 'reported');
});
