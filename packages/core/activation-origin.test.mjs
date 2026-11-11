import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const load = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const server = load('../pc-rescues/src/hooks.server.ts');
const page = load('../pc-rescues/src/routes/activate/+page.svelte');
const config = load('../pc-rescues/svelte.config.js');

test('activation HTML keeps real Origin for same-site native POST', () => {
  // Referrer-Policy: no-referrer changes Origin to null on navigate-mode POST.
  assert.match(server, /response\.headers\.set\('referrer-policy', 'origin'\)/);
  assert.match(page, /<meta name="referrer" content="origin"\s*\/>/);
  assert.doesNotMatch(server, /response\.headers\.set\('referrer-policy', 'no-referrer'\)/);
  assert.doesNotMatch(page, /<meta name="referrer" content="no-referrer"/);
});

test('no CSRF bypass for our own origin; only external Apple OAuth callback is allowed', () => {
  assert.match(config, /trustedOrigins:\s*\[\s*'https:\/\/appleid\.apple\.com'\s*\]/);
  assert.doesNotMatch(config, /trustedOrigins:\s*\[\s*['"]\*['"]/);
});

test('invitation token is removed from the URL before form rendering', () => {
  const activation = load('../pc-rescues/src/routes/activate/+page.server.ts');
  assert.match(activation, /throw redirect\(303, '\/activate'\)/);
});
