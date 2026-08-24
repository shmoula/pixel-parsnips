/**
 * 025 — every colour the game paints, in one place.
 *
 * Imported by tailwind.config.ts (so the tokens derive from here, not the other
 * way round) and by tests/palette.contrast.test.ts (so a contrast assertion reads
 * the same value the UI ships). Change a value here and both follow.
 */
export const PALETTE = {
  soil: '#5E3D22',
  grass: '#357028',
  sky: '#6BBFFF',
  gold: '#F5C842',
  red: '#C0392B',
  stone: '#8C7B6B',
  parchment: '#F5ECD7',
  ink: '#241C14',        // warm brown over the old flat neutral

  /** HUD header bar. */
  bar: '#1C1208',
  /** HUD chip and menu-row body. */
  chip: '#33220E',
  /** Chip and panel border. */
  chipBorder: '#7A5228',
  /** Chip and row hover. */
  chipHover: '#4A3016',
  /** Flat colour behind the tiled soil texture on PageBackdrop. */
  page: '#241806',
  /** Critical-balance red, kept readable on `chip` (see the contrast test). */
  danger: '#EB6A5C',
} as const;
