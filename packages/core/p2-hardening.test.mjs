import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAT_REFRESH_CONNECTED_MS, CHAT_REFRESH_DISCONNECTED_MS,
  shouldPollChat } from './chat-refresh-policy.ts';

const base = resolve(import.meta.dirname, '..');
const read = (p) => readFileSync(resolve(base, p), 'utf8');

test('realtime chat polling is sparse, visibility-aware and de-duplicated', () => {
  const chat = read('pc-rescues/src/routes/chats/+page.svelte');
  assert.ok(CHAT_REFRESH_CONNECTED_MS >= 90_000);
  assert.ok(CHAT_REFRESH_DISCONNECTED_MS <= 30_000);
  assert.equal(shouldPollChat({ visible: false, realtimeConnected: false,
    now: 999_999, lastSnapshotAt: 0 }), false);
  assert.match(chat, /visibilitychange/);
  assert.match(chat, /onStatus: connected =>/);
  assert.match(chat, /CHAT_EVENT_COALESCE_MS/);
  assert.match(chat, /refreshInFlight/);
  assert.match(chat, /Promise\.allSettled\(tasks\)/);
  assert.doesNotMatch(chat, /\}, 15000\)/);
});

test('chat mentions announce empty results and support safe keyboard navigation', () => {
  const chat = read('pc-rescues/src/routes/chats/+page.svelte');
  assert.match(chat, /No people or animal records match this mention/);
  assert.match(chat, /aria-live="polite"/);
  assert.match(chat, /aria-activedescendant/);
  assert.match(chat, /activeMentionIndex/);
  assert.match(chat, /mentionGeneration\+\+/);
  assert.match(chat, /mentionQueryActive && mentionLoading/);
});

test('zoom and focus protections preserve theme colours, visible scrolling and readable text', () => {
  const css = read('pc-rescues/src/routes/global.css');
  const topbar = read('pc-rescues/src/lib/components/AppTopbar.svelte');
  const chat = read('pc-rescues/src/routes/chats/+page.svelte');
  const admin = read('pc-rescues/src/routes/admin/+page.svelte');
  assert.doesNotMatch(css, /::-webkit-scrollbar\s*\{\s*display:\s*none/);
  assert.doesNotMatch(css, /max-height:\s*100vh/);
  assert.match(topbar, /overflow-x:auto/);
  assert.match(topbar, /font-size:13px; padding:7px 8px; flex-shrink:0/);
  assert.match(chat, /@media \(max-width: 760px\)/);
  assert.match(chat, /prefers-reduced-motion/);
  assert.match(css, /forced-colors: active/);
  assert.match(admin, /--ink: var\(--rh-text\)/);
  assert.match(css, /--rh-background:\s*#edf1f4/);
  assert.match(css, /--rh-background:\s*#0c0f12/);
});

test('demo has read-only smoke workflow, health probe and monitoring infrastructure', () => {
  const yml = read('../.github/workflows/browser-smoke.yml');
  const tests = read('../tests/browser/rescue-demo.spec.mjs');
  const probe = read('pc-rescues/src/routes/api/healthz/+server.ts');
  const monitor = read('infra/monitoring.ts');
  assert.match(yml, /workflow_dispatch:/);
  assert.doesNotMatch(yml, /\npush:/);
  assert.match(tests, /\/documentation/);
  assert.match(tests, /Invite a person/);
  assert.match(tests, /chat-mention-options/);
  assert.match(tests, /RESCUE_E2E_EMAIL/);
  assert.match(probe, /status: 'ok'/);
  assert.match(monitor, /new aws\.cloudwatch\.Dashboard/);
  assert.match(monitor, /new aws\.cloudwatch\.MetricAlarm/);
});
