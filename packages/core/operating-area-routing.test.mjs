import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeOperatingArea } from './operating-area-routing.ts';

const square = (minLon, minLat, maxLon, maxLat) =>
  [[minLon,minLat],[maxLon,minLat],[maxLon,maxLat],[minLon,maxLat],[minLon,minLat]];
const feature = (org, coordinates, label = org) => ({
  type: 'Feature', geometry: { type: 'Polygon', coordinates },
  properties: { organisationId: org, areaLabel: label, directoryStatus: 'CURRENT' }
});
const areas = features => ({ type: 'FeatureCollection', features });

test('picks local organisation from longitude/latitude GIS, never species', () => {
  const result = routeOperatingArea(areas([
    feature('wires', [square(150,-34,153,-31)]),
    feature('native-animal-trust-fund', [square(151,-33,152,-32)])
  ]), -32.9, 151.7);
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.organisationId, 'native-animal-trust-fund');
});
test('overlapping local authorities remain ambiguous rather than silently assigned', () => {
  const result = routeOperatingArea(areas([
    feature('local-a', [square(150,-34,153,-31)]),
    feature('local-b', [square(151,-33,152,-32)])
  ]), -32.9, 151.7);
  assert.deepEqual(result, { status:'UNROUTED', reason:'AMBIGUOUS_COVERAGE', matchedAreaIds:['local-a','local-b'] });
});
test('holes exclude points even inside an outer polygon', () => {
  const result = routeOperatingArea(areas([feature('local-a', [
    square(150,-34,153,-31),square(151,-33,152,-32)
  ])]), -32.9, 151.7);
  assert.equal(result.status, 'UNROUTED');
});
test('outside coverage is not assigned to a default or neighbouring organisation', () => {
  const result = routeOperatingArea(areas([feature('local-a', [square(150,-34,153,-31)])]), -28, 145);
  assert.deepEqual(result, { status:'UNROUTED', reason:'NO_COVERAGE', matchedAreaIds:[] });
});
test('multipolygon second component matches', () => {
  const result = routeOperatingArea(areas([{
    ...feature('local-a',[]),
    geometry:{type:'MultiPolygon',coordinates:[[square(150,-34,151,-33)],[square(152,-32,153,-31)]]}
  }]),-31.5,152.5);
  assert.equal(result.status,'MATCHED');
});
test('non-current and unserviced layers do not imply operational coverage', () => {
  const inactive = feature('inactive',[square(150,-34,153,-31)]);
  inactive.properties.directoryStatus = 'LEGACY_OR_SHARED';
  const result = routeOperatingArea(areas([inactive,feature('wires',[square(150,-34,153,-31)],'Unserviced area')]),-32.9,151.7);
  assert.equal(result.status,'UNROUTED');
});
