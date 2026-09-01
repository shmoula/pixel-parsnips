import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/theme/palette';
import { composite, contrastRatio, ratioBetween, rgbToHex } from './helpers/contrast';

/** WCAG AA for normal-size text. Every pair below is body or caption text. */
const AA = 4.5;

/** WCAG 1.4.11 for non-text UI components (a chip border, an icon — no glyphs). */
const AA_NON_TEXT = 3;

/**
 * 025 — the enforced contrast pairs.
 *
 * vitest-axe cannot check these: jsdom never resolves a Tailwind class to a computed
 * colour, so axe's color-contrast rule is silently skipped. This list is the real gate.
 *
 * Each row MIRRORS a combination a component actually renders — `where` names it. A row
 * may only change in the same commit that changes the component it mirrors; editing a row
 * to make a test pass, without touching the UI, defeats the entire point of the file.
 */
const PAIRS: ReadonlyArray<{ name: string; where: string; fg: string; bg: string; alpha?: number }> = [
  { name: 'critical balance',   where: 'HUD.tsx balance chip',       fg: PALETTE.danger,    bg: PALETTE.chip },
  { name: 'low balance',        where: 'HUD.tsx balance chip',       fg: PALETTE.warn,      bg: PALETTE.chip },
  { name: 'gold value',         where: 'HUD.tsx chips',              fg: PALETTE.gold,      bg: PALETTE.chip },
  { name: 'caption',            where: 'HUD.tsx chip captions',      fg: PALETTE.parchment, bg: PALETTE.chip, alpha: 0.7 },
  { name: 'menu row label',     where: 'GameMenuPopover.tsx rows',   fg: PALETTE.parchment, bg: PALETTE.soil, alpha: 0.9 },
  { name: 'ledger cost',        where: 'HUD.tsx DailyLedgerChip',    fg: PALETTE.parchment, bg: PALETTE.chip, alpha: 0.7 },
  { name: 'ledger lease preview', where: 'HUD.tsx DailyLedgerChip',  fg: PALETTE.gold,      bg: PALETTE.chip, alpha: 0.7 },
  { name: 'modal body',         where: 'CreditsModal.tsx paragraphs',fg: PALETTE.parchment, bg: PALETTE.soil },
  { name: 'modal heading',      where: 'CreditsModal.tsx h2',        fg: PALETTE.gold,      bg: PALETTE.soil },
  { name: 'section label',      where: 'CreditsModal.tsx h3',        fg: PALETTE.parchment, bg: PALETTE.soil, alpha: 0.7 },
  { name: 'stat-row label',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.parchment, bg: PALETTE.ink, alpha: 0.7 },
  { name: 'stat-row value',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.gold,     bg: PALETTE.ink },
  { name: 'plot buy-price',     where: 'PlotCard.tsx purchasable tile', fg: PALETTE.gold,            bg: PALETTE.plot },
  { name: 'plot locked label',  where: 'PlotCard.tsx locked tile',      fg: PALETTE.plotLockedLabel, bg: PALETTE.plot },
  { name: 'plant label',        where: 'PlotCard.tsx empty tile',       fg: PALETTE.gold,            bg: PALETTE.tilledLight },
  { name: 'growing tile text',  where: 'PlotCard.tsx growing tile',     fg: PALETTE.parchment,       bg: PALETTE.plotGrowing, alpha: 0.8 },
  { name: 'ready tile text',    where: 'PlotCard.tsx ready tile',       fg: PALETTE.parchment,       bg: PALETTE.plotReady, alpha: 0.8 },
  { name: 'pest label',         where: 'PlotCard.tsx pest tile',        fg: PALETTE.danger,          bg: PALETTE.plotPest },
  // The exhausted-tile label is NOT a flat pair: its wrapper carries opacity-75,
  // so it is gated in its own block below (a flat parchment/80-on-exhaustedMid
  // ratio is optimistic — see there).

  // Seed cards (028) — each crop's tinted card renders three text roles: the crop name
  // (parchment/90), the grow/yield stats (parchment/75) and the est.-profit line (profitMint).
  { name: 'radish card name',   where: 'SeedCard.tsx crop name',        fg: PALETTE.parchment,  bg: PALETTE.cropRadishBg,  alpha: 0.9 },
  { name: 'radish card stats',  where: 'SeedCard.tsx CropStats',        fg: PALETTE.parchment,  bg: PALETTE.cropRadishBg,  alpha: 0.75 },
  { name: 'radish card profit', where: 'SeedCard.tsx est. profit',      fg: PALETTE.profitMint, bg: PALETTE.cropRadishBg },
  { name: 'parsnip card name',  where: 'SeedCard.tsx crop name',        fg: PALETTE.parchment,  bg: PALETTE.cropParsnipBg, alpha: 0.9 },
  { name: 'parsnip card stats', where: 'SeedCard.tsx CropStats',        fg: PALETTE.parchment,  bg: PALETTE.cropParsnipBg, alpha: 0.75 },
  { name: 'parsnip card profit',where: 'SeedCard.tsx est. profit',      fg: PALETTE.profitMint, bg: PALETTE.cropParsnipBg },
  { name: 'pumpkin card name',  where: 'SeedCard.tsx crop name',        fg: PALETTE.parchment,  bg: PALETTE.cropPumpkinBg, alpha: 0.9 },
  { name: 'pumpkin card stats', where: 'SeedCard.tsx CropStats',        fg: PALETTE.parchment,  bg: PALETTE.cropPumpkinBg, alpha: 0.75 },
  { name: 'pumpkin card profit',where: 'SeedCard.tsx est. profit',      fg: PALETTE.profitMint, bg: PALETTE.cropPumpkinBg },

  // Shop chrome (028) — the fertilizer card label on the chip panel, and the carved sign heading.
  { name: 'fertilizer label',   where: 'Shop.tsx fertilizer card',      fg: PALETTE.parchment,  bg: PALETTE.chip, alpha: 0.9 },
  { name: 'shop sign heading',  where: 'Shop.tsx SignHeader h2',        fg: PALETTE.gold,       bg: PALETTE.shopSign },
];

/**
 * Known sub-AA surfaces this gate does NOT enforce (yet).
 *
 * This is a documentation note, not a test — no assertions here, and it must
 * never fail the suite. The PAIRS list above is the real gate; these three
 * foreground-on-chip combinations are surfaces the UI actually renders that
 * fall below the 4.5:1 AA threshold and are deliberately left out of PAIRS:
 *
 *  - `farm-red` late-season warning ("— N days left", HUD.tsx balance caption)
 *    on `farm-chip` ≈ 2.19:1
 *  - idle/de-emphasized `farm-stone/60` button chrome (e.g. GameMenu gear,
 *    HUD undo) on `farm-chip` ≈ 1.94:1 — a deliberately de-emphasized-until-
 *    hover pattern
 *  - Shop "New buildings unlock in Season N" `farm-stone` on `farm-chip/60`
 *    ≈ 2.96:1. The /60 alpha does NOT composite over the page: this block sits
 *    inside Shop.tsx's `<aside>`, whose backdrop is the wood-plank texture (or
 *    the `awningFallback` #4A2F1A solid when the asset is absent). Measured over
 *    that solid fixture, `chip/60` resolves to #4a3119 and stone lands at 2.96:1.
 *  - Shop fertilizer sub-label ("Restores an exhausted plot instantly")
 *    `farm-stone` on `farm-chip` ≈ 2.93:1 — a de-emphasized caption on the
 *    `stone` foreground 028 deliberately does not change
 *
 * These are pre-existing and/or on foregrounds 025 deliberately did not
 * change (the plan protects `red`/`stone` as foregrounds, per the 025 lift).
 * They're flagged here for the author's Phase A visual-review pass to decide
 * whether to fix the foreground/treatment or accept them as exceptions. The
 * point of this comment is that the gate is honest about its boundary rather
 * than silently passing over surfaces that fail.
 *
 * 027 note for the 028 palette lift: the retired `lease readout` row (`stone` on `bar`)
 * passed at only 4.529 — a 0.029 margin. Any future row on `bar` is similarly fragile,
 * and lightening `bar` will move every one of them. Re-derive, do not eyeball.
 *
 * 028 — two play-surface labels that used to belong on this list are now fixed and
 * enforced: the "Pest Damage" label (was farm-red/90 on the pest tile, 2.89:1,
 * now a PAIRS row) and the exhausted tile's "Nd remaining" (was farm-stone/80,
 * 2.89:1, now parchment/80 gated in the rendered-layers block below). Both were
 * invisible to this gate until 028 tokenised the play surface.
 *
 * 029 — the low-balance chip's `border-farm-warn/70` (HUD.tsx, `getBalanceBorderClass`)
 * is a non-text UI component (a chip border, no glyphs), so WCAG 1.4.11 judges it
 * against 3:1, not the 4.5:1 AA text threshold this file enforces, and it is
 * deliberately left out of PAIRS. Measured: `farm-warn` (#F0A830) at 70% alpha over
 * `farm-chip` (#4A3218) is 3.735:1, clearing the 3:1 non-text bar. The text pairing
 * (`text-farm-warn`, full opacity) IS gated above as the "low balance" row, at 5.878:1.
 */

describe('palette contrast (WCAG AA, normal text)', () => {
  it.each(PAIRS)('$name ($where) clears 4.5:1', ({ fg, bg, alpha }) => {
    expect(contrastRatio(fg, bg, alpha ?? 1)).toBeGreaterThanOrEqual(AA);
  });
});

/**
 * 029 — the low-balance chip's border, gated at the 3:1 non-text bar.
 *
 * `border-farm-warn/70` (HUD.tsx, `getBalanceBorderClass`) is a non-text UI component,
 * so WCAG 1.4.11 judges it against 3:1, not the 4.5:1 AA above — which is why it is kept
 * out of PAIRS. But the doc note above only *records* its measured 3.735:1; left un-asserted,
 * a future `warn`/`chip` change could drift it below 3:1 with only stale prose to notice.
 * This is the gate for that border, exactly as the PAIRS list is the gate for the text pairs.
 */
describe('palette contrast (WCAG 1.4.11, non-text UI)', () => {
  it('low-balance chip border (farm-warn/70 on farm-chip) clears 3:1', () => {
    expect(contrastRatio(PALETTE.warn, PALETTE.chip, 0.7)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

/**
 * 028 — the exhausted-tile label, gated as it actually renders.
 *
 * `ExhaustedPlot` (PlotCard.tsx) is the one enforced surface whose wrapper is not
 * opaque: the whole tile carries `opacity-75` (and `grayscale(0.4)`) and composites
 * over FarmGrid's `field` bed. A flat parchment/80-on-exhaustedMid ratio reads 8.69:1,
 * but that is optimistic — the text and its background BOTH darken toward the bed, so
 * the rendered ratio is lower. We model the opacity composite (exactly defined) as the
 * gate; grayscale(0.4) on these near-neutral browns shifts luminance <1% (spot-checked
 * 5.49 → 5.55), so omitting it keeps the assertion on the conservative side. The light
 * gradient band (`exhaustedMid`) is the worst case for the light label.
 */
describe('exhausted-plot label (rendered through opacity-75 over the field bed)', () => {
  const WRAPPER_OPACITY = 0.75;
  const LABEL_ALPHA = 0.8; // text-farm-parchment/80
  it.each(['exhaustedMid', 'exhaustedDark'] as const)(
    '%s band clears 4.5:1 as rendered',
    band => {
      const labelPixel = rgbToHex(composite(PALETTE.parchment, LABEL_ALPHA, PALETTE[band]));
      const fg = composite(labelPixel, WRAPPER_OPACITY, PALETTE.field);
      const bg = composite(PALETTE[band], WRAPPER_OPACITY, PALETTE.field);
      expect(ratioBetween(fg, bg)).toBeGreaterThanOrEqual(AA);
    },
  );
});

describe('contrast helper', () => {
  it('matches known reference ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
  });
});
