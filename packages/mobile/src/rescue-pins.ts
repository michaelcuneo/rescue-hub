import type { Rescue } from './api';

// Category colours used by the circular rescue markers, separate from workflow status.
export const RESCUE_PIN_GROUPS = {
  REPTILE_NON_VENOMOUS: { label: 'Reptiles', color: '#16634A' },
  REPTILE_VENOMOUS: { label: 'Venomous reptiles', color: '#743C7D' },
  MACROPOD: { label: 'Macropods', color: '#A64D28' },
  BIRD: { label: 'Birds', color: '#205C94' },
  RAPTOR: { label: 'Raptors', color: '#394F81' },
  POSSUM_GLIDER: { label: 'Possums & gliders', color: '#6E4696' },
  WOMBAT: { label: 'Wombats', color: '#79512D' },
  BAT_FLYING_FOX: { label: 'Bats & flying foxes', color: '#963B65' },
  MARINE: { label: 'Marine', color: '#126B7C' },
  OTHER: { label: 'Other', color: '#455665' }
} as const;

export type RescuePinGroup = keyof typeof RESCUE_PIN_GROUPS;

// Keep classification consistent with the backend dispatch-capability rules.
// Colour is informational; the API remains authoritative for team eligibility.
export function classifyRescuePin(rescue: Pick<Rescue, 'type' | 'breed'>): RescuePinGroup {
  const value = `${rescue.type} ${rescue.breed ?? ''}`.toLowerCase();

  if (/eagle|hawk|falcon|kite|owl|raptor/.test(value)) return 'RAPTOR';
  if (/flying fox|flying-fox|microbat|\bbat\b/.test(value)) return 'BAT_FLYING_FOX';
  if (/kangaroo|wallaby|pademelon|wallaroo/.test(value)) return 'MACROPOD';
  if (/possum|glider/.test(value)) return 'POSSUM_GLIDER';
  if (/wombat/.test(value)) return 'WOMBAT';
  if (/brown snake|red[- ]bellied|tiger snake|death adder|taipan|venomous/.test(value)) {
    return 'REPTILE_VENOMOUS';
  }
  if (/snake|lizard|blue[- ]?tongue|dragon|skink|gecko|python/.test(value)) {
    return 'REPTILE_NON_VENOMOUS';
  }
  if (/turtle|sea snake|seal|dolphin|whale|marine/.test(value)) return 'MARINE';
  if (/bird|magpie|lorikeet|kookaburra|pelican|frogmouth|duck|cockatoo|galah|ibis/.test(value)) {
    return 'BIRD';
  }
  return 'OTHER';
}

export function pinForRescue(rescue: Rescue) {
  const group = classifyRescuePin(rescue);
  const name = rescue.type.trim().split(/\s+/).filter(Boolean);
  const initials = name.slice(0, 2).map(word => word[0]).join('').toUpperCase() || '?';
  return { group, color: RESCUE_PIN_GROUPS[group].color, initials };
}
