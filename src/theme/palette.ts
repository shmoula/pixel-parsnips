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

  // ── Play surface (028) ────────────────────────────────────────────────────
  // These were hardcoded in FarmGrid/PlotCard until 028 and were therefore
  // invisible to tests/palette.contrast.test.ts. Values here are pre-lift; the
  // lift is Task 5 of specs/028-farm-scene-coherence/plan.md.

  /** Farm-grid bed behind the plot tiles. */
  field: '#2A1A0E',
  /** Empty, locked, or purchasable plot tile. */
  plot: '#160F07',
  /** Plot with a crop still growing. */
  plotGrowing: '#1A2C10',
  /** Plot whose crop is ready to harvest. */
  plotReady: '#162810',
  /** Plot destroyed by a Pest Infestation. */
  plotPest: '#2A1010',
  /** Plot tile border. */
  plotBorder: '#3D2510',
  /** "Locked" label on an unpurchased tile. */
  plotLockedLabel: '#B8A894',
  /** Hover state for the red "Clear Plot" button. */
  redHover: '#d94040',
  /** Day Summary ground on a disaster turn. */
  disasterGround: '#2A0A0A',
  /** Flat colour painted beneath the PageBackdrop layer. */
  pageFallback: '#140e06',

  // Gradient stops — inline `style` only, never Tailwind classes.
  /** Tilled-row stripes on an empty plot tile. */
  tilledLight: '#2A1A0E',
  tilledDark: '#221408',
  /** Exhausted-plot hatching, light → dark. */
  exhaustedMid: '#3a2010',
  exhaustedDark: '#2a1208',
  exhaustedShadow: '#1a0a02',

  // ── Shop chrome (028) — inline `style` only ───────────────────────────────
  /** Carved sign board behind the "Shop" heading. */
  shopSign: '#5A3A1E',
  /** Sign board border, and the dark end of the ledge gradient. */
  shopSignBorder: '#3D2410',
  /** Light end of the ledge gradient. */
  shopLedge: '#7A4E24',
  /** Decorative corner studs. */
  shopStud: '#2A1808',
  /** Market-stall awning cloth, in stripe order. */
  awningGreen: '#3F7D30',
  awningCream: '#E8D9A8',
  awningRust:  '#A8452A',
  awningBrown: '#6B4A2A',
  /**
   * Awning fallback stripe. Deliberately NOT derived from `soil` — see the
   * comment at its use site in Shop.tsx. It is a token so it is *named*, not so
   * it is coupled: changing `soil` must never change this.
   */
  awningFallback: '#4A2F1A',

  // ── Crop identity (028) — inline `style` only ─────────────────────────────
  // Kept independent of `red`/`grass`/`gold`: these are a crop's identity, and
  // aliasing them would make a semantic-colour change recolour the seed cards.
  cropRadishBg:     '#6E2A24',
  cropRadishBorder: '#C0392B',
  cropParsnipBg:     '#3A5220',
  cropParsnipBorder: '#4E8A2E',
  cropPumpkinBg:     '#7C3E14',
  cropPumpkinBorder: '#C87820',

  /** Estimated-profit mint green, on the tinted seed cards. */
  profitMint: '#BFE6A8',
} as const;
