/**
 * Species-to-dispatch mapping is shared by browsing, claims and notifications.
 * Unknown, invasive, venomous and specialist cases must never be assigned
 * automatically to general reptile rescuers.
 */
export const SPECIES_CAPABILITIES = [
  'BIRD', 'RAPTOR', 'MACROPOD', 'POSSUM_GLIDER', 'WOMBAT',
  'REPTILE_NON_VENOMOUS', 'REPTILE_VENOMOUS', 'AMPHIBIAN',
  'INVASIVE', 'BAT_FLYING_FOX', 'MARINE', 'MAMMAL',
  'INVERTEBRATE', 'NON_NATIVE', 'OTHER'
] as const;
export type SpeciesCapability = typeof SPECIES_CAPABILITIES[number];

export function classifySpeciesCapability(
  type: string,
  breed = '',
  knownGroup = ''
): SpeciesCapability {
  const name = `${type} ${breed}`.toLowerCase().replace(/[‐‑–—]/g, '-').trim();
  // A cane toad is an invasive amphibian, not a reptile. Route only to
  // a specifically authorised invasive-species response group.
  if (/\bcane[\s-]*toad\b/.test(name)) return 'INVASIVE';
  if (/\b(eagle|hawk|falcon|kite|owl|raptor|osprey|harrier)\b/.test(name)) return 'RAPTOR';
  if (/\b(flying[\s-]*fox|microbat|bat)\b/.test(name)) return 'BAT_FLYING_FOX';
  if (/\b(kangaroo|wallaby|pademelon|wallaroo|quokka)\b/.test(name)) return 'MACROPOD';
  if (/\b(possum|glider)\b/.test(name)) return 'POSSUM_GLIDER';
  if (/\bwombat\b/.test(name)) return 'WOMBAT';
  if (/\b(brown snake|red[\s-]*bellied black snake|tiger snake|death adder|taipan|copperhead|small[\s-]*eyed snake|golden[\s-]*crowned snake|venomous)\b/.test(name))
    return 'REPTILE_VENOMOUS';
  if (/\b(python|keelback|common tree snake|green tree snake|lizard|blue[\s-]*tongue|dragon|skink|gecko|goanna|monitor|echidna)\b/.test(name)) {
    // Echidnas are mammals, despite having spines.
    if (/\bechidna\b/.test(name)) return 'MAMMAL';
    return 'REPTILE_NON_VENOMOUS';
  }
  // An unidentified snake requires the specialist pathway until verified.
  if (/\bsnake\b/.test(name)) return 'REPTILE_VENOMOUS';
  if (/\b(frog|toad|tadpole|newt|salamander)\b/.test(name)) return 'AMPHIBIAN';
  if (/\b(turtle|sea snake|seal|dolphin|whale|dugong|shark|stingray|fish|ray|octopus)\b/.test(name))
    return 'MARINE';
  if (/\b(bird|magpie|lorikeet|kookaburra|pelican|frogmouth|duck|cockatoo|galah|ibis|penguin|parrot)\b/.test(name))
    return 'BIRD';

  switch (knownGroup) {
    case 'Birds': return 'BIRD';
    case 'Reptiles': return 'REPTILE_NON_VENOMOUS';
    case 'Amphibians': return 'AMPHIBIAN';
    case 'Marine and fish': return 'MARINE';
    case 'Invertebrates': return 'INVERTEBRATE';
    case 'Introduced and domestic': return 'NON_NATIVE';
    case 'Mammals': return 'MAMMAL';
    default: return 'OTHER';
  }
}

/** Prefer the specific species name when a generic group is also submitted. */
export function findCatalogueGroup(
  type: string,
  breed: string,
  catalogue: Record<string, readonly string[]>
): string {
  const names = [breed, type].map(s => s.trim().toLowerCase()).filter(Boolean);
  for (const name of names) {
    for (const [group, species] of Object.entries(catalogue)) {
      if (species.some(s => s.toLowerCase() === name)) return group;
    }
  }
  return '';
}
