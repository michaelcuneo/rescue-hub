import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'pc-rescues', 'src');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

// Source-level interaction regression tests. These guard the known dismissal
// bugs; browser-level pointer/keyboard automation is still required.
test('Dispatch Intake custom menus dismiss from outside pointer, focus and Escape', () => {
  const component = read('lib/components/DispatcherShell.svelte');
  assert.match(component, /onpointerdown=\{handleIntakeOutsideInteraction\}/);
  assert.match(component, /onfocusin=\{handleIntakeOutsideInteraction\}/);
  assert.match(component, /onkeydown=\{handleIntakeEscape\}/);
  assert.match(component, /speciesField\?\.contains\(event\.target\)/);
  assert.match(component, /addressField\?\.contains\(event\.target\)/);
  assert.match(component, /function dismissAddressSuggestions\(\)/);
  assert.match(component, /addressSearchSequence\+\+/);
  assert.doesNotMatch(component, /<label class="field full" bind:this=\{addressField\}/);
  assert.doesNotMatch(component, /<label class="field" bind:this=\{speciesField\}/);
  assert.match(component, /<label for="dispatch-intake-address">/);
  assert.match(component, /<label for="dispatch-intake-species">/);
});

test('Chat suggestions invalidate slow requests and support keyboard dismissal', () => {
  const chat = read('routes/chats/+page.svelte');
  assert.match(chat, /onpointerdown=\{handleDropdownOutsideInteraction\}/);
  assert.match(chat, /onfocusin=\{handleDropdownOutsideInteraction\}/);
  assert.match(chat, /onkeydown=\{handleDropdownEscape\}/);
  assert.match(chat, /function dismissMentionSuggestions\(\)/);
  assert.match(chat, /mentionGeneration\+\+/);
  assert.match(chat, /generation === mentionGeneration/);
  assert.match(chat, /membersPanel\?\.contains\(event\.target\)/);
  assert.match(chat, /ArrowDown/);
  assert.match(chat, /ArrowUp/);
  assert.match(chat, /aria-activedescendant/);
});

test('Account menu dismisses on outside pointer, focus leave and Escape', () => {
  const menu = read('lib/components/AppTopbar.svelte');
  assert.match(menu, /onpointerdown=\{\(event\) =>/);
  assert.match(menu, /onfocusin=\{\(event\) =>/);
  assert.match(menu, /event\.key === 'Escape' && profileMenu\?\.open/);
  assert.match(menu, /profileMenu\.querySelector\('summary'\)\?\.focus\(\)/);
});
