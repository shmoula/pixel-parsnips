import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/theme/palette';
import { contrastRatio } from './helpers/contrast';

/** WCAG AA for normal-size text. Every pair below is body or caption text. */
const AA = 4.5;

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
  { name: 'exhausted label',    where: 'PlotCard.tsx exhausted tile',   fg: PALETTE.parchment,       bg: PALETTE.exhaustedMid, alpha: 0.8 },

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
 *    ≈ 3.45:1 (the /60 alpha composites over the page, so the rendered value is
 *    lighter than a flat stone-on-chip)
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
 * enforced in PAIRS instead: the "Pest Damage" label (was farm-red/90 on the pest
 * tile, 2.89:1) and the exhausted tile's "Nd remaining" (was farm-stone/80, 2.89:1).
 * Both were invisible to this gate until 028 tokenised the play surface.
 */

describe('palette contrast (WCAG AA, normal text)', () => {
  it.each(PAIRS)('$name ($where) clears 4.5:1', ({ fg, bg, alpha }) => {
    expect(contrastRatio(fg, bg, alpha ?? 1)).toBeGreaterThanOrEqual(AA);
  });
});

describe('contrast helper', () => {
  it('matches known reference ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
  });
});
