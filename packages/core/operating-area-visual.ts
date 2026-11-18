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

/**
 * Organisation names are background context, not rescue labels.
 * Pale off-white glyphs, reduced opacity, and a diffuse charcoal halo read
 * as a soft drop shadow instead of black type with a stark white outline.
 * These Mapbox Style paint properties also work in MapLibre.
 */
export const OPERATING_AREA_LABEL_PAINT = {
  'text-color': '#edf4f6',
  'text-opacity': 0.64,
  'text-halo-color': 'rgba(12,20,26,0.50)',
  'text-halo-width': 1.1,
  'text-halo-blur': 1.3
} as const;
