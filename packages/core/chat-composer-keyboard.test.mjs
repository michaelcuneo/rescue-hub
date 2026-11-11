import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSendChatOnKey } from './chat-composer-keyboard.ts';

test('plain Enter sends while Shift Enter makes a newline', () => {
  assert.equal(shouldSendChatOnKey({ key:'Enter' }), true);
  assert.equal(shouldSendChatOnKey({ key:'Enter', shiftKey:true }), false);
  assert.equal(shouldSendChatOnKey({ key:'Enter', repeat:true }), false);
});
test('IME confirmation and modified shortcuts never submit', () => {
  assert.equal(shouldSendChatOnKey({ key:'Enter', isComposing:true }), false);
  assert.equal(shouldSendChatOnKey({ key:'Enter', ctrlKey:true }), false);
  assert.equal(shouldSendChatOnKey({ key:'Enter', metaKey:true }), false);
  assert.equal(shouldSendChatOnKey({ key:'Enter', altKey:true }), false);
  assert.equal(shouldSendChatOnKey({ key:'a' }), false);
});
