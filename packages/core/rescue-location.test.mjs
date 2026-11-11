import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validRescueCoordinates, rescueDirectionsUrl, chooseReverseGeocode,
  formatRescueCoordinates, isPlaceholderRescueLocation, locationFallback,
  addressPrecisionLabel
} from './rescue-location.ts';

const point = { latitude: -32.929, longitude: 151.779 };

test('directions use the original pin, never a geocoded street number', () => {
  const url = rescueDirectionsUrl(point);
  assert.ok(url);
  const parsed = new URL(url);
  assert.equal(parsed.hostname, 'www.google.com');
  assert.equal(parsed.searchParams.get('destination'), '-32.929000,151.779000');
  assert.equal(parsed.searchParams.get('travelmode'), 'driving');
  assert.equal(formatRescueCoordinates(point), '-32.92900, 151.77900');
  assert.equal(validRescueCoordinates({ latitude: 100, longitude: 151.8 }), false);
  assert.equal(rescueDirectionsUrl({ latitude: NaN, longitude: 151.8 }), null);
});

test('an address at the pin may display as a mapped address', () => {
  const result = chooseReverseGeocode({
    features: [{ properties: { feature_type: 'address', full_address: '123 Hunter Street, Newcastle NSW 2300, Australia' },
      geometry: { coordinates: [151.77901, -32.92901] } }]
  }, point);
  assert.equal(result.address, '123 Hunter Street, Newcastle NSW 2300, Australia');
  assert.equal(result.precision, 'ADDRESS');
});

test('never mistake a distant street number for the exact rescue location', () => {
  const data = { features: [
    { properties: { feature_type: 'address', full_address: '999 Unknown Street' }, geometry: { coordinates: [151.9, -32.8] } },
    { properties: { feature_type: 'street', full_address: 'Hunter Street, Newcastle NSW' }, geometry: { coordinates: [151.781, -32.930] } },
    { properties: { feature_type: 'place', full_address: 'Newcastle, NSW, Australia' }, geometry: { coordinates: [151.779, -32.93] } }
  ] };
  const result = chooseReverseGeocode(data, point);
  assert.deepEqual(result, { address: 'Hunter Street, Newcastle NSW', precision: 'STREET' });
  assert.match(addressPrecisionLabel(result.precision), /approximate/);
});

test('rural pin can use nearby address but must label it as approximate', () => {
  const result = chooseReverseGeocode({ features: [
    { properties: { feature_type: 'address', full_address: '1 Old Road, Hunter NSW' },
      geometry: { coordinates: [151.781, -32.929] } }
  ] }, point);
  assert.equal(result.precision, 'NEARBY_ADDRESS');
});

test('no address results or malformed data do not fabricate a street', () => {
  assert.deepEqual(chooseReverseGeocode({ features: [] }, point), { address: null, precision: 'UNAVAILABLE' });
  assert.deepEqual(chooseReverseGeocode({ features: [{ properties: { feature_type: 'address', name: '' } }] }, point),
    { address: null, precision: 'UNAVAILABLE' });
  assert.equal(isPlaceholderRescueLocation('Public wildlife report (pin location)'), true);
  assert.equal(locationFallback('Current map location'), 'Street address not identified');
  assert.equal(locationFallback('Shortland, NSW'), 'Shortland, NSW');
});
