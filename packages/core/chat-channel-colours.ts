import { RESCUE_PIN_GROUPS } from './rescue-pin-groups';

// Animal chat groups use the same colours as Operations map legend markers.
// Other channels and direct messages intentionally remain neutral.
const BY_CHANNEL: Record<string, readonly [string, string?]> = {
  reptiles: [RESCUE_PIN_GROUPS.REPTILE_NON_VENOMOUS.color, RESCUE_PIN_GROUPS.REPTILE_VENOMOUS.color],
  birds: [RESCUE_PIN_GROUPS.BIRD.color],
  raptors: [RESCUE_PIN_GROUPS.RAPTOR.color],
  macropods: [RESCUE_PIN_GROUPS.MACROPOD.color],
  'possums-gliders': [RESCUE_PIN_GROUPS.POSSUM_GLIDER.color],
  wombats: [RESCUE_PIN_GROUPS.WOMBAT.color],
  'bats-flying-foxes': [RESCUE_PIN_GROUPS.BAT_FLYING_FOX.color],
  marine: [RESCUE_PIN_GROUPS.MARINE.color],
  'other-wildlife': [RESCUE_PIN_GROUPS.OTHER.color]
};

export function chatChannelColours(id: string, isDirect = false): readonly [string, string?] | null {
  return isDirect ? null : BY_CHANNEL[id] ?? null;
}
