import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatChannelColours } from './chat-channel-colours.ts';
import { RESCUE_PIN_GROUPS } from './rescue-pin-groups.ts';

test('all animal chat colours exactly match the map legend', () => {
  const cases = {
    birds: 'BIRD', raptors: 'RAPTOR', macropods: 'MACROPOD',
    'possums-gliders': 'POSSUM_GLIDER', wombats: 'WOMBAT',
    'bats-flying-foxes': 'BAT_FLYING_FOX', marine: 'MARINE',
    'other-wildlife': 'OTHER'
  };
  for (const [id, group] of Object.entries(cases)) {
    assert.equal(chatChannelColours(id)?.[0], RESCUE_PIN_GROUPS[group].color);
  }
  assert.deepEqual(chatChannelColours('reptiles'), [
    RESCUE_PIN_GROUPS.REPTILE_NON_VENOMOUS.color,
    RESCUE_PIN_GROUPS.REPTILE_VENOMOUS.color
  ]);
});
test('generic and direct chats remain neutral', () => {
  for (const name of ['administration', 'qa', 'trading-post', 'team-transport']) {
    assert.equal(chatChannelColours(name), null);
  }
  assert.equal(chatChannelColours('birds', true), null);
});
