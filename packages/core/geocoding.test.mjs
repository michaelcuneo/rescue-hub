import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAwsSearchTextRequest, metresBetween, parseAwsReverse, parseAwsSearchText } from './geocoding.ts';

const pin = { latitude: -32.929, longitude: 151.779 };
function item(id, label, latitude, longitude, type = 'PointAddress', country = 'AU') {
  return {
    PlaceId: id, PlaceType: type,
    Address: { Label: label, Country: { Code2: country } },
    Position: [longitude, latitude]
  };
}

test('Reverse geocoding never relocates the rescue pin or implies a property is exact', () => {
  const result = parseAwsReverse({ ResultItems: [
    item('1', '12 Hunter Street, Newcastle NSW', -32.92901, 151.77901)
  ] }, pin);
  assert.deepEqual(result, { address: '12 Hunter Street, Newcastle NSW',
    precision: 'NEARBY_ADDRESS' });
  assert.deepEqual(pin, { latitude: -32.929, longitude: 151.779 });
});

test('Distant properties and foreign addresses are not accepted as nearby', () => {
  const far = item('1', '123 Far Away Rd', -32.9, 151.80);
  assert.deepEqual(parseAwsReverse({ ResultItems: [far] }, pin),
    { address: null, precision: 'UNAVAILABLE' });
  assert.deepEqual(parseAwsReverse({ ResultItems: [
    item('2', 'Not in Australia', -32.929, 151.779, 'PointAddress', 'NZ')
  ] }, pin), { address: null, precision: 'UNAVAILABLE' });
  assert.ok(metresBetween(pin, { latitude: -32.929, longitude: 151.780 }) > 80);
});

test('Street results are labelled approximate; missing coordinates are rejected', () => {
  assert.deepEqual(parseAwsReverse({ ResultItems: [
    item('st', 'Hunter Street', -32.929, 151.779, 'Street')
  ] }, pin), { address: 'Hunter Street', precision: 'STREET' });
  assert.deepEqual(parseAwsReverse({ ResultItems: [
    { PlaceId: '2', PlaceType: 'Street', Address: { Label: 'Unknown Street',
      Country: { Code2: 'AU' } } }
  ] }, pin), { address: null, precision: 'UNAVAILABLE' });
});

test('SearchText returns only valid Australian results with coordinates', () => {
  const good = item('a', '12 Hunter Street, Newcastle NSW', -32.929, 151.779);
  assert.deepEqual(parseAwsSearchText({ ResultItems: [
    good, good, item('b', 'Near NZ', -32.9, 151.8, 'Street', 'NZ'),
    item('c', 'No point', -32.9, 999),
    item('d', 'Hunter Street, Newcastle NSW', -32.929, 151.78, 'Street')
  ] }), [
    { id: 'a', label: good.Address.Label, latitude: -32.929, longitude: 151.779 },
    { id: 'd', label: 'Hunter Street, Newcastle NSW', latitude: -32.929, longitude: 151.78 }
  ]);
  assert.deepEqual(parseAwsSearchText({ ResultItems: [] }), []);
});

test('SearchText requests always include exactly one valid geo constraint', () => {
  const local = buildAwsSearchTextRequest('  hunter street ', pin);
  assert.deepEqual(local, {
    QueryText: 'hunter street', MaxResults: 5,
    Filter: { IncludeCountries: ['AUS'] },
    BiasPosition: [151.779, -32.929]
  });
  const national = buildAwsSearchTextRequest('sydney', undefined);
  assert.deepEqual(national.Filter, {
    IncludeCountries: ['AUS'], BoundingBox: [95, -55, 170, 0]
  });
  assert.equal('BiasPosition' in national, false);
  assert.equal('BiasPosition' in buildAwsSearchTextRequest('Sydney', {
    latitude: 0, longitude: 0
  }), false);
});
