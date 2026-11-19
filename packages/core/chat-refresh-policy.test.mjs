import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_REFRESH_CONNECTED_MS, CHAT_REFRESH_DISCONNECTED_MS,
  CHAT_MEMBER_REFRESH_MS, shouldPollChat } from './chat-refresh-policy.ts';

test('hidden tabs never poll chat', () => {
  assert.equal(shouldPollChat({
    visible: false, realtimeConnected: false, now: 1_000_000, lastSnapshotAt: 0
  }), false);
});
test('healthy realtime does not duplicate every 15-second polling', () => {
  assert.ok(CHAT_REFRESH_CONNECTED_MS >= 90_000);
  assert.ok(CHAT_MEMBER_REFRESH_MS >= 60_000);
  const input = { visible: true, realtimeConnected: true, now: 90_000, lastSnapshotAt: 0 };
  assert.equal(shouldPollChat(input), false);
  assert.equal(shouldPollChat({ ...input, now: CHAT_REFRESH_CONNECTED_MS }), true);
});
test('disconnected visible clients retain a timely fallback', () => {
  const input = { visible: true, realtimeConnected: false, now: CHAT_REFRESH_DISCONNECTED_MS - 1,
    lastSnapshotAt: 0 };
  assert.equal(shouldPollChat(input), false);
  assert.equal(shouldPollChat({ ...input, now: CHAT_REFRESH_DISCONNECTED_MS }), true);
});
