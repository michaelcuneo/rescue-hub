import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESCUE_PIN_GROUPS, classifyRescuePin, pinForRescue } from './rescue-pin-groups.ts';

test('animal groups retain the mobile marker palette', () => {
  assert.equal(RESCUE_PIN_GROUPS.REPTILE_NON_VENOMOUS.color, '#16634A');
  assert.equal(RESCUE_PIN_GROUPS.REPTILE_VENOMOUS.color, '#743C7D');
  assert.equal(RESCUE_PIN_GROUPS.BIRD.color, '#205C94');
  assert.equal(Object.keys(RESCUE_PIN_GROUPS).length, 10);
});

test('category classification is shared by mobile and desktop', () => {
  const cases = [
    ['Carpet python', 'REPTILE_NON_VENOMOUS'],
    ['Eastern brown snake', 'REPTILE_VENOMOUS'],
    ['Eastern grey kangaroo', 'MACROPOD'],
    ['Kookaburra', 'BIRD'],
    ['Powerful owl', 'RAPTOR'],
    ['Sugar glider', 'POSSUM_GLIDER'],
    ['Bare-nosed wombat', 'WOMBAT'],
    ['Grey-headed flying fox', 'BAT_FLYING_FOX'],
    ['Australian fur seal', 'MARINE'],
    ['Echidna', 'OTHER']
  ];
  for (const [type, expected] of cases) {
    const group = classifyRescuePin({ type });
    assert.equal(group, expected, type);
    assert.equal(pinForRescue({ type }).color, RESCUE_PIN_GROUPS[group].color);
  }
});

test('species detail participates in category classification', () => {
  assert.equal(classifyRescuePin({ type: 'Snake', breed: 'Eastern brown snake' }), 'REPTILE_VENOMOUS');
  assert.equal(pinForRescue({ type: 'Green tree frog' }).initials, 'GT');
});
