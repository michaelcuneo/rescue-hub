import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRescuePinCollection } from './rescue-pin-geojson.ts';

const rescue = Object.freeze({
  id: 'rescue-1', type: 'Eastern Water Dragon', status: 'PENDING',
  longitude: 151.778, latitude: -32.925, color: '#16634A', initials: 'EW'
});
test('Mapbox feature is a fixed geographic coordinate in longitude,latitude order', () => {
  const features = createRescuePinCollection([rescue]);
  assert.deepEqual(features.features[0].geometry.coordinates, [151.778, -32.925]);
  assert.equal(features.features[0].id, rescue.id);
  assert.equal(features.features[0].properties.initials, 'EW');
  assert.equal(rescue.longitude, 151.778);
});
test('selection/status rerenders do not move the location or mutate inputs', () => {
  const before = createRescuePinCollection([rescue]);
  const after = createRescuePinCollection([{ ...rescue, status:'ASSIGNED' }]);
  assert.deepEqual(after.features[0].geometry, before.features[0].geometry);
  assert.notEqual(after.features[0].properties.status, before.features[0].properties.status);
});
test('out-of-range coordinates, non-finite values and repeated IDs are excluded', () => {
  const points = createRescuePinCollection([
    rescue, rescue,
    { ...rescue, id:'bad-lat', latitude:-99 },
    { ...rescue, id:'bad-lng', longitude:181 },
    { ...rescue, id:'bad-nan', longitude:NaN },
    { ...rescue, id:'rescue-2', longitude:150.1, latitude:-33.1 }
  ]);
  assert.deepEqual(points.features.map(feature => feature.id), ['rescue-1', 'rescue-2']);
  assert.deepEqual(points.features[1].geometry.coordinates, [150.1, -33.1]);
});
test('rescue markers must use the Mapbox render pipeline, not CSS-transformed DOM markers', () => {
  const code = readFileSync(new URL('../mobile/src/RescueMap.tsx', import.meta.url), 'utf8');
  assert.match(code, /map\.addSource\('rescue-pins'/);
  assert.match(code, /map\.addLayer\(\{id:'rescue-pins-base'/);
  assert.doesNotMatch(code, /transition\s*:\s*transform/);
  assert.doesNotMatch(code, /new mapboxgl\.Marker\(\{element\}\)/);
});
