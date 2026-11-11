import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyboardOverlap, keyboardScrollDelta } from './keyboard-geometry.ts';

test('keyboard overlay pushes a low form input upwards', () => {
  assert.equal(keyboardScrollDelta({
    viewportTop: 70, viewportBottom: 780, keyboardTop: 480,
    fieldTop: 510, fieldBottom: 560, clearance: 24
  }), 104);
});
test('resized viewport avoids double scrolling on iOS or Android', () => {
  assert.equal(keyboardScrollDelta({
    viewportTop: 70, viewportBottom: 460, keyboardTop: 480,
    fieldTop: 330, fieldBottom: 380, clearance: 24
  }), 0);
});
test('switching focus from a lower field to an upper field scrolls back down', () => {
  assert.equal(keyboardScrollDelta({
    viewportTop: 100, viewportBottom: 480, keyboardTop: 480,
    fieldTop: 60, fieldBottom: 100, clearance: 24
  }), -64);
});
test('oversized multiline field aligns its top instead of impossible bottom visibility', () => {
  assert.equal(keyboardScrollDelta({
    viewportTop: 100, viewportBottom: 460, keyboardTop: 430,
    fieldTop: 270, fieldBottom: 780, clearance: 24
  }), 146);
});
test('keyboard overlap is zero if layout has already been resized', () => {
  assert.equal(keyboardOverlap(420, 470), 0);
  assert.equal(keyboardOverlap(780, 470), 310);
  assert.equal(keyboardOverlap(780, null), 0);
});
test('invalid geometry does not cause wild scroll offsets', () => {
  assert.equal(keyboardScrollDelta({
    viewportTop: 100, viewportBottom: 100, fieldTop: 200, fieldBottom: 260
  }), 0);
});
