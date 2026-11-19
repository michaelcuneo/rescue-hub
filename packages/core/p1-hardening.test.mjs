import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('Administration/feedback dialogs share nested focus containment and restoration', () => {
  const action = read('pc-rescues/src/lib/actions/modal-focus.ts');
  const admin = read('pc-rescues/src/routes/admin/+page.svelte');
  const feedback = read('pc-rescues/src/lib/components/FeedbackModal.svelte');
  assert.match(action, /event\.key !== 'Tab'/);
  assert.match(action, /event\.key === 'Escape'/);
  assert.match(action, /\.inert =/);
  assert.match(action, /active\.at\(-1\)/);
  assert.match(action, /previous\.focus\(\{ preventScroll: true \}\)/);
  assert.match(admin, /use:modalFocus=\{\{ onEscape: \(\) => \(showInvite = false\) \}\}/);
  assert.match(admin, /use:modalFocus=\{\{ onEscape: \(\) => \(selectedPersonId = null\) \}\}/);
  assert.match(feedback, /use:modalFocus=\{\{ onEscape: dismiss \}\}/);
});

test('AWS Places uses DynamoDB conditional, fail-closed user and stage limits', () => {
  const limiter = read('pc-rescues/src/lib/server/geocoding-quota.ts');
  const api = read('pc-rescues/src/routes/api/geocoding/search/+server.ts');
  const address = read('pc-rescues/src/routes/api/mobile/rescues/[id]/address/+server.ts');
  const service = read('pc-rescues/src/lib/server/rescue-geocoding.ts');
  assert.match(limiter, /new UpdateCommand/);
  assert.match(limiter, /ConditionExpression: 'attribute_not_exists/);
  assert.match(limiter, /new GeocodingLimitUnavailableError\(\)/);
  assert.match(limiter, /USER#/);
  assert.match(limiter, /STAGE#/);
  assert.match(api, /status: 429/);
  assert.match(api, /'retry-after'/);
  assert.match(address, /reverseRescueAddress\(coordinates, eventFetch, user\.id\)/);
  assert.match(service, /reserveGeocodingRequest\(userId \?\? '', 'reverse'\)/);
  assert.match(service, /reserveGeocodingRequest\(userId \?\? '', 'search'\)/);
});

test('Desktop maps restore the original MapLibre loader for the demo hotfix', () => {
  const layout = read('pc-rescues/src/routes/+layout.svelte');
  assert.equal(layout.includes("import 'maplibre-gl/dist/maplibre-gl.css'"), false);
  for (const path of [
    'pc-rescues/src/lib/components/MapBox.svelte',
    'pc-rescues/src/lib/components/AdminRescueHistoryMap.svelte',
    'pc-rescues/src/lib/components/ReleaseLocationPicker.svelte'
  ]) {
    const code = read(path);
    assert.ok(code.includes('unpkg.com/maplibre-gl@6.18.0'));
    assert.ok(code.includes('/* @vite-ignore */'));
    assert.equal(code.includes('function emergencyStyle('), false);
    assert.ok(code.includes("map.on('error'"));
  }
});

test('Demo stage declares AWS Location spending visibility and alert recipient', () => {
  const sst = read('../sst.config.ts');
  const budget = read('infra/geocoding-budget.ts');
  assert.match(sst, /\$app\.stage === "demo"/);
  assert.match(budget, /new aws\.budgets\.Budget/);
  assert.match(budget, /RESCUE_LOCATION_BUDGET_ALERT_EMAIL/);
  assert.match(budget, /timeUnit: 'MONTHLY'/);
  assert.match(budget, /Amazon Location Service/);
});
