import assert from 'node:assert/strict';
import { test } from 'node:test';
import { metresBetween, parseGnafReverse, parseGnafSuggestions } from './geocoding.ts';

const pin = { latitude: -32.929, longitude: 151.779 };
test('G-NAF nearby properties are always approximate; rescue GPS is unchanged', () => {
  const address = parseGnafReverse({ source: 'GNAF', address: '12 Hunter St, Newcastle NSW 2300',
    latitude: -32.92901, longitude: 151.77901 }, pin);
  assert.deepEqual(address, { address: '12 Hunter St, Newcastle NSW 2300', precision: 'NEARBY_ADDRESS' });
  assert.equal(pin.latitude, -32.929);
});
test('never supply a distant street number or an untrusted geocoding response', () => {
  const distant = { source: 'GNAF', address: '10 Distant Rd', latitude: -32.93, longitude: 151.789 };
  assert.deepEqual(parseGnafReverse(distant, pin), { address: null, precision: 'UNAVAILABLE' });
  assert.deepEqual(parseGnafReverse({ ...distant, source: 'MAPBOX' }, pin),
    { address: null, precision: 'UNAVAILABLE' });
  assert.deepEqual(parseGnafReverse({ source: 'GNAF', address: 'Fake Road', latitude: 400, longitude: 3 }, pin),
    { address: null, precision: 'UNAVAILABLE' });
  assert.ok(metresBetween(pin, { latitude: -32.929, longitude: 151.780 }) > 80);
});
test('only valid, unique G-NAF search results can populate incident drafts', () => {
  const good = { id: 'GNAF-1', label: '123 Hunter Street, Newcastle NSW', latitude: -32.929, longitude: 151.78 };
  const value = { source: 'GNAF', results: [good, good, { ...good, id: 'GNAF-2', latitude: 999 },
    { ...good, id: 'GNAF-3', label: '' }, { ...good, id: 'GNAF-4' }] };
  assert.deepEqual(parseGnafSuggestions(value), [good, { ...good, id: 'GNAF-4' }]);
  assert.deepEqual(parseGnafSuggestions({ ...value, source: 'MAPBOX' }), []);
});
