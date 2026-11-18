/**
 * Quiet, translucent organisation-coverage geometry for all desktop maps.
 * Operational animal/status markers remain vivid and render ABOVE polygons.
 * This affects presentation only, never geographical matching or routing.
 *
 * Hunter areas stay slightly more legible to distinguish them from neighbours.
 */
const HUNTER = ['==', ['get', 'organisationId'], 'native-animal-trust-fund'] as const;

export const OPERATING_AREA_FILL_OPACITY = [
  'case', HUNTER, 0.055, 0.025
] as const;

export const OPERATING_AREA_LINE_OPACITY = [
  'case', HUNTER, 0.42, 0.28
] as const;

export const OPERATING_AREA_LINE_WIDTH = [
  'case', HUNTER, 1.4, 0.85
] as const;
