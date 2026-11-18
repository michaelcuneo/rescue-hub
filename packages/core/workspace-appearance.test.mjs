import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'pc-rescues', 'src');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('operations, administration and documentation use one persistent top bar', () => {
  const layout = read('routes/+layout.svelte');
  const nav = read('lib/components/AppTopbar.svelte');
  const operations = read('lib/components/DispatcherShell.svelte');
  const documentation = read('routes/documentation/+page.svelte');

  assert.match(layout, /<AppTopbar viewer=\{data\.viewer\}/);
  assert.match(layout, /'\/admin', '\/documentation'/);
  assert.match(nav, /href=\{operationsHref\}[^>]*>Operations<\/a>/);
  assert.match(nav, /const operationsHref = \$derived\(viewer\?\.operationsHref \?\? '\/'\)/);
  assert.match(read('routes/+layout.server.ts'), /operationsHref: desktopOperationsHref\(active, demoMode\)/);
  assert.match(nav, /href="\/admin"[^>]*>Administration<\/a>/);
  assert.match(nav, /href="\/documentation"[^>]*>Documentation<\/a>/);
  assert.doesNotMatch(operations, /<header class="topbar">/);
  assert.doesNotMatch(documentation, /<header class="global-header">/);
});

test('appearance uses neutral surfaces and dark MapLibre tiles in Operations', () => {
  const styles = read('routes/global.css');
  const map = read('lib/components/MapBox.svelte');
  const operations = read('lib/components/DispatcherShell.svelte');
  const admin = read('routes/admin/+page.svelte');
  const docs = read('routes/documentation/+page.svelte');

  assert.match(styles, /--rh-background:\s*#0c0f12/);
  assert.match(styles, /--rh-surface:\s*#171b20/);
  assert.match(styles, /--rh-border:\s*#343e48/);
  assert.match(styles, /--rh-text:\s*#f2f4f6/);
  assert.match(map, /https:\/\/tiles\.openfreemap\.org\/styles\/dark/);
  assert.match(map, /resolvedTheme\.subscribe/);
  assert.match(map, /map\.setStyle\(theme === 'dark' \? DARK_STYLE : LIGHT_STYLE\)/);
  assert.match(map, /background:var\(--rh-surface\)/);
  assert.match(operations, /background: var\(--rh-surface\)/);
  assert.match(admin, /--ink: var\(--rh-text\)/);
  assert.match(docs, /--ink:var\(--rh-text\)/);
});

test('mobile navigation remains visible on every primary screen', () => {
  const nav = read('lib/components/AppTopbar.svelte');
  const css = read('routes/global.css');
  assert.match(nav, /grid-template-rows:34px 34px/);
  assert.match(nav, /grid-column:1 \/ -1; grid-row:2/);
  assert.match(css, /--rh-content-top: 106px/);
});


test('Administration buttons inherit readable theme tokens without overriding specialised button states', () => {
  const admin = read('routes/admin/+page.svelte');
  const styles = read('routes/global.css');
  // A plain HTML button otherwise uses browser-default ButtonText, which can
  // disappear against the neutral admin surfaces in either colour scheme.
  assert.match(admin, /:where\(\.admin-shell\) button\s*\{\s*color:\s*var\(--rh-text\);\s*background:\s*var\(--rh-surface-soft\);/);
  assert.match(admin, /\.primary-action\s*\{[^}]*background:\s*var\(--forest\);[^}]*color:\s*white;/s);
  assert.match(admin, /\.people-filters button\.chosen\s*\{[^}]*background:\s*var\(--forest\);\s*color:\s*white;/);
  assert.match(admin, /nav button\s*\{[^}]*background:transparent;[^}]*color:var\(--rh-muted\);/s);
  assert.match(styles, /--rh-text:\s*#17232f/);
  assert.match(styles, /--rh-text:\s*#f3f6f9/);
});


test('dark workspace uses accessible neutral layers without altering the light palette', () => {
  const styles = read('routes/global.css');
  const dark = styles.slice(styles.indexOf(":root[data-theme='dark'] {"));
  const light = styles.slice(0, styles.indexOf("/* Rescue Hub dark:"));
  const pick = (name) => {
    const match = new RegExp('^\s*--rh-' + name + ':\s*(#[0-9a-f]{6});', 'm').exec(dark);
    assert.ok(match, 'missing dark token: ' + name);
    return match[1];
  };
  const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = (hex) => rgb(hex).reduce((sum, value, i) =>
    sum + value * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  // AAA text contrast on base, panel, input and raised surfaces.
  for (const surface of ['background', 'surface', 'surface-soft', 'raised', 'field']) {
    assert.ok(contrast(pick('text'), pick(surface)) >= 7, 'text contrast on ' + surface);
  }
  for (const surface of ['surface', 'surface-soft', 'raised']) {
    assert.ok(contrast(pick('subtle'), pick(surface)) >= 7, 'secondary contrast on ' + surface);
  }
  assert.ok(contrast(pick('on-primary'), pick('primary')) >= 7, 'primary action contrast');
  assert.ok(contrast(pick('on-primary'), pick('primary-hover')) >= 7, 'hover action contrast');
  assert.ok(contrast(pick('accent'), pick('surface')) >= 7, 'linked text contrast');
  assert.match(light, /--rh-background:\s*#edf1f4/);
  assert.match(light, /--rh-primary:\s*#195b43/);
  assert.match(styles, /data-theme='dark'] \.chat-layout :is\(\.sender-name, \.older, \.animal-ref\)/);
  assert.match(styles, /data-theme='dark'] \.settings-page \.commit-link/);
  assert.match(styles, /data-theme='dark'] \.people-dialog \.primary-action/);
  assert.match(styles, /data-theme='dark'] \.maplibregl-ctrl-group/);
});
