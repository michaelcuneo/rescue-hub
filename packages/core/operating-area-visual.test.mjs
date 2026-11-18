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

test('subtle operating-area names use faint off-white with a blurred dark shadow', async () => {
  const { OPERATING_AREA_LABEL_PAINT: paint } = await import('./operating-area-visual.ts');
  assert.equal(paint['text-color'], '#edf4f6');
  assert.ok(paint['text-opacity'] > 0.45 && paint['text-opacity'] <= 0.7);
  assert.match(paint['text-halo-color'], /^rgba\(\d+,\d+,\d+,0\.[1-9]+\)$/);
  assert.ok(paint['text-halo-width'] <= 1.3);
  assert.ok(paint['text-halo-blur'] >= 1);
  for (const file of ['MapBox.svelte', 'AdminOperatingAreas.svelte', 'AdminRescueHistoryMap.svelte']) {
    const source = readFileSync(resolve(root, file), 'utf8');
    const id = file === 'MapBox.svelte' ? 'nsw-operating-areas-labels'
      : file === 'AdminOperatingAreas.svelte' ? 'admin-operating-areas-labels'
      : 'historical-operating-labels';
    const labelSection = source.slice(source.indexOf(`id: '${id}'`), source.indexOf(`id: '${id}'`) + 600);
    assert.match(labelSection, /paint: OPERATING_AREA_LABEL_PAINT/, `${file} must use subtle label style`);
    assert.doesNotMatch(labelSection, /'text-halo-color': '#ffffff'/);
  }
});
