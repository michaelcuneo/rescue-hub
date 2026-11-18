import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OPERATING_AREA_FILL_OPACITY, OPERATING_AREA_LINE_OPACITY,
  OPERATING_AREA_LINE_WIDTH
} from './operating-area-visual.ts';

const root = resolve(import.meta.dirname, '..', 'pc-rescues', 'src', 'lib', 'components');

function forOrganisation(expression, organisationId) {
  const [, condition, yes, no] = expression;
  assert.deepEqual(condition.slice(0, 1), ['==']);
  return organisationId === 'native-animal-trust-fund' ? yes : no;
}

test('region overlays are translucent and substantially fainter than rescue pins', () => {
  for (const id of ['native-animal-trust-fund', 'wires', 'other']) {
    const fill = forOrganisation(OPERATING_AREA_FILL_OPACITY, id);
    const outline = forOrganisation(OPERATING_AREA_LINE_OPACITY, id);
    const width = forOrganisation(OPERATING_AREA_LINE_WIDTH, id);
    assert.ok(fill >= 0 && fill <= 0.06, `${id} fill too strong`);
    assert.ok(outline > 0.2 && outline < 0.5, `${id} outline too strong`);
    assert.ok(width > 0 && width <= 1.5, `${id} outline too thick`);
  }
  assert.ok(forOrganisation(OPERATING_AREA_FILL_OPACITY, 'wires') <
    forOrganisation(OPERATING_AREA_FILL_OPACITY, 'native-animal-trust-fund'));
});

test('Operations, admin areas, and rescue-history maps share the overlay strength', () => {
  for (const file of ['MapBox.svelte', 'AdminOperatingAreas.svelte', 'AdminRescueHistoryMap.svelte']) {
    const source = readFileSync(resolve(root, file), 'utf8');
    assert.match(source, /core\/operating-area-visual/);
    assert.match(source, /'fill-opacity': OPERATING_AREA_FILL_OPACITY/);
    assert.match(source, /'line-opacity': OPERATING_AREA_LINE_OPACITY/);
    assert.match(source, /'line-width': OPERATING_AREA_LINE_WIDTH/);
  }
});

test('boundary hit testing and rescue pins are retained', () => {
  const source = readFileSync(resolve(root, 'MapBox.svelte'), 'utf8');
  assert.match(source, /nsw-operating-areas-fill/);
  assert.match(source, /const areaHit = hit\(map, event.point/);
  assert.match(source, /installRescueLayers/);
});

test('dark basemap labels use pale type and blurred halo; light labels remain unchanged', async () => {
  const { OPERATING_AREA_LABEL_PAINT: darkPaint } = await import('./operating-area-visual.ts');
  assert.equal(darkPaint['text-color'], '#edf4f6');
  assert.ok(darkPaint['text-opacity'] > 0.45 && darkPaint['text-opacity'] <= 0.7);
  assert.equal(darkPaint['text-halo-blur'], 1.3);
  const operations = readFileSync(resolve(root, 'MapBox.svelte'), 'utf8');
  const history = readFileSync(resolve(root, 'AdminRescueHistoryMap.svelte'), 'utf8');
  const adminAreas = readFileSync(resolve(root, 'AdminOperatingAreas.svelte'), 'utf8');
  assert.match(operations, /paint: get\(resolvedTheme\) === 'dark' \? OPERATING_AREA_LABEL_PAINT : \{/);
  assert.match(history, /paint: \$resolvedTheme === 'dark' \? OPERATING_AREA_LABEL_PAINT : \{/);
  for (const source of [operations, history]) {
    assert.match(source, /'text-color': '#173d2c'/);
    assert.match(source, /'text-halo-color': '#ffffff'/);
    assert.match(source, /'text-halo-width': 1\.5/);
  }
  // Older Mapbox-based operating-areas panel has no dark basemap switch.
  assert.doesNotMatch(adminAreas, /OPERATING_AREA_LABEL_PAINT/);
  assert.match(adminAreas, /'text-color': '#173d2c'/);
  assert.match(adminAreas, /'text-halo-color': 'rgba\(255,255,255,0\.94\)'/);
});
