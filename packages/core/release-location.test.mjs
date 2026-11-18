import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAnimalReleasePoint, isValidReleasePoint, formatReleaseCoordinates } from './release-location.ts';

const incident = { latitude: -32.937, longitude: 151.721 };

test('remote bushland release uses a GPS pin without a street address', () => {
  const actual = validateAnimalReleasePoint({
    latitude: -32.821, longitude: 151.534, releaseReason: 'RELOCATION', location: ''
  }, incident);
  assert.deepEqual(actual, {
    latitude: -32.821, longitude: 151.534, releaseReason: 'RELOCATION',
    location: 'GPS -32.821000, 151.534000'
  });
});
test('release at original rescue site is explicit and keeps both coordinates', () => {
  const actual = validateAnimalReleasePoint({
    ...incident, releaseReason: 'ORIGINAL_SITE', location: 'Original rescue site'
  }, incident);
  assert.equal(actual.releaseReason, 'ORIGINAL_SITE');
  assert.equal(actual.latitude, incident.latitude);
  assert.equal(actual.longitude, incident.longitude);
});
test('releasing away from original point requires relocation classification', () => {
  assert.throws(() => validateAnimalReleasePoint({
    latitude: -32.80, longitude: 151.60, releaseReason: 'ORIGINAL_SITE'
  }, incident), /relocation/i);
});
test('reject one coordinate, zero island, invalid labels and non-finite coordinates', () => {
  for (const raw of [
    { latitude: -32.9, releaseReason: 'RELOCATION' },
    { latitude: 0, longitude: 0, releaseReason: 'RELOCATION' },
    { latitude: 91, longitude: 151.7, releaseReason: 'RELOCATION' },
    { latitude: NaN, longitude: 151.7, releaseReason: 'RELOCATION' },
    { latitude: -32.9, longitude: Infinity, releaseReason: 'RELOCATION' },
    { latitude: -32.9, longitude: 151.7, releaseReason: 'UNKNOWN' },
    { latitude: -32.9, longitude: 151.7, releaseReason: 'RELOCATION', location: 'x'.repeat(251) }
  ]) assert.throws(() => validateAnimalReleasePoint(raw, incident));
  assert.equal(isValidReleasePoint({ latitude: -32.9, longitude: 151.7 }), true);
  assert.equal(formatReleaseCoordinates(incident), '-32.937000, 151.721000');
});
