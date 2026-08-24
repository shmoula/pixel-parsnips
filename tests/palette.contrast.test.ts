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
  { name: 'lease readout',      where: 'HUD.tsx lease span',         fg: PALETTE.stone,     bg: PALETTE.bar },
  { name: 'modal body',         where: 'CreditsModal.tsx paragraphs',fg: PALETTE.parchment, bg: PALETTE.soil },
  { name: 'modal heading',      where: 'CreditsModal.tsx h2',        fg: PALETTE.gold,      bg: PALETTE.soil },
  { name: 'section label',      where: 'CreditsModal.tsx h3',        fg: PALETTE.parchment, bg: PALETTE.soil, alpha: 0.7 },
  { name: 'stat-row label',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.parchment, bg: PALETTE.ink, alpha: 0.7 },
  { name: 'stat-row value',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.gold,     bg: PALETTE.ink },
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
 *    on `farm-chip` ≈ 2.81:1
 *  - idle/de-emphasized `farm-stone/60` button chrome (e.g. GameMenu gear,
 *    HUD undo) on `farm-chip` ≈ 2.21:1 — a deliberately de-emphasized-until-
 *    hover pattern
 *  - Shop "New buildings unlock in Season N" `farm-stone` on `farm-chip/60`
 *    ≈ 3.75:1 (approximate — the /60 alpha over the panel shifts the real
 *    rendered value)
 *
 * These are pre-existing and/or on foregrounds 025 deliberately did not
 * change (the plan protects `red`/`stone` as foregrounds, per the 025 lift).
 * They're flagged here for the author's Phase A visual-review pass to decide
 * whether to fix the foreground/treatment or accept them as exceptions. The
 * point of this comment is that the gate is honest about its boundary rather
 * than silently passing over surfaces that fail.
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
