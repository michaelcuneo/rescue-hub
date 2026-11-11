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
  assert.match(nav, /href="\/"[^>]*>Operations<\/a>/);
  assert.match(nav, /href="\/admin"[^>]*>Administration<\/a>/);
  assert.match(nav, /href="\/documentation"[^>]*>Documentation<\/a>/);
  assert.doesNotMatch(operations, /<header class="topbar">/);
  assert.doesNotMatch(documentation, /<header class="global-header">/);
});

test('appearance uses neutral surfaces and full dark Mapbox tiles', () => {
  const styles = read('routes/global.css');
  const map = read('lib/components/MapBox.svelte');
  const operations = read('lib/components/DispatcherShell.svelte');
  const admin = read('routes/admin/+page.svelte');
  const docs = read('routes/documentation/+page.svelte');

  assert.match(styles, /--rh-background:\s*#11161c/);
  assert.match(styles, /--rh-surface:\s*#1c222b/);
  assert.match(styles, /--rh-border:\s*#424d5b/);
  assert.match(styles, /--rh-text:\s*#f3f6f9/);
  assert.match(map, /mapbox:\/\/styles\/mapbox\/dark-v11/);
  assert.match(map, /\{#key \$resolvedTheme\}/);
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
