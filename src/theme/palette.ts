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
  bar: '#2A1B0A',
  /** HUD chip and menu-row body. */
  chip: '#4A3218',
  /** Chip and panel border. */
  chipBorder: '#7A5228',
  /** Chip and row hover — a step lighter than `chip`, so it must move with it. */
  chipHover: '#614020',
  /** Flat colour behind the tiled soil texture on PageBackdrop. */
  page: '#241806',
  /** Critical-balance red, kept readable on `chip` (see the contrast test). */
  danger: '#F59A90',

  // ── Play surface (028) ────────────────────────────────────────────────────
  // These were hardcoded in FarmGrid/PlotCard until 028 and were therefore
  // invisible to tests/palette.contrast.test.ts. Task 5 lifted the healthy-soil
  // tokens (field, plot, plotGrowing, plotReady, plotBorder, tilledLight/Dark)
  // out of near-black; the pest, exhausted, disaster and page-fallback tokens
  // below are deliberately kept dark as "something is wrong here" / backdrop
  // states. See specs/028-farm-scene-coherence/plan.md.

  /**
   * Farm-grid bed behind the plot tiles. A step lighter/warmer than `chip`
   * (which is `#4A3218`) on purpose: §B3's separation principle requires the HUD
   * chrome and the play surface to stay on distinguishable tones, and the 028
   * prototype flattened the hierarchy when both sat at `#4A3218`. It stays
   * lighter than the empty-plot tile (`plot`, `#3A2712`) so the tiles read as
   * cells recessed into the bed. Not contrast-gated — no text is painted on the
   * bed — so it is free to move for this visual reason.
   */
  field: '#573B1B',
  /** Empty, locked, or purchasable plot tile. */
  plot: '#3A2712',
  /** Plot with a crop still growing. */
  plotGrowing: '#2E4A1C',
  /** Plot whose crop is ready to harvest. */
  plotReady: '#33551F',
  /** Plot destroyed by a Pest Infestation. */
  plotPest: '#2A1010',
  /** Plot tile border. */
  plotBorder: '#6B4A2A',
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
  tilledLight: '#4A3218',
  tilledDark: '#3A2712',
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
