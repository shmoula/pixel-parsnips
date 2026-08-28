# 027 — HUD Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant reputation chip and ladder, and surface the per-day lease at every width by merging it with the harvest-streak bonus into one "daily ledger" chip.

**Architecture:** Presentation-only. The reputation ladder (`src/engine/reputation.ts`) is deleted and its titles become the medal's labels, so one ladder names run progression. In the HUD, the standalone streak chip and the desktop-only lease readout collapse into a single `DailyLedgerChip` — both halves are coins-per-day. No engine, schema, save-migration, analytics, or simulator change.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + Testing Library + vitest-axe.

**Branch:** `027-hud-legibility` (already checked out; the spec commits live here).

**Spec:** [spec.md](spec.md) — read the "Measured constraints" section before touching Task 3.

---

## Critical constraints (read before starting)

1. **The ledger chip's mobile form must stay ≤ 81px wide at 375px.** At 82px+ the HUD wraps
   to a third row. Any emoji inside the `sm:hidden` spans costs ~10px and blows the budget.
   Do not add `tracking-widest` to the mobile spans either — it widens them and was not part
   of the measured 81px.

2. **The minus sign is U+2212 `−`, not an ASCII hyphen `-`.** Source and tests must use the
   same character or assertions fail in a way that is hard to see. Copy it from this plan.

3. **`farm-stone` may not be used inside a chip.** `stone` on `chip` measures 3.751 (fails
   WCAG AA). The ledger chip's cost text is `farm-parchment/70` (7.06) and its bonus text is
   `farm-gold` (9.61).

---

## File structure

| File | Change | Responsibility after this plan |
|---|---|---|
| `src/engine/medals.ts` | Modify | The game's only run-progression ladder: tier derivation + titles + taglines |
| `src/engine/reputation.ts` | **Delete** | — (superseded by `medals.ts`) |
| `src/components/MedalBadge.tsx` | Modify | Renders the medal tier; aria-label no longer says "medal" |
| `src/components/HUD.tsx` | Modify | Loses the reputation chip and the streak chip; gains `DailyLedgerChip` |
| `tests/engine/medals.test.ts` | Modify | Locks the new labels |
| `tests/engine/reputation.test.ts` | **Delete** | — |
| `tests/components/MedalBadge.test.tsx` | Modify | Asserts label/tagline aria composition |
| `tests/components/HUD.test.tsx` | Modify | Reputation-gone regression + ledger chip behaviour |
| `tests/components/ExpandableChip.test.tsx` | Modify | Fixture text stops referencing a deleted concept |
| `tests/palette.contrast.test.ts` | Modify | Retires the `lease readout` row; adds three ledger rows |
| `backlog.md` | Modify | Bookkeeping (Task 6) |

---

## Task 1: Medal labels carry the reputation titles

**Files:**
- Modify: `src/engine/medals.ts:29-35` (`MEDAL_LABELS`)
- Modify: `src/components/MedalBadge.tsx:26-29` (aria-label)
- Test: `tests/engine/medals.test.ts:32-40`
- Test: `tests/components/MedalBadge.test.tsx:11-19`

- [ ] **Step 1: Write the failing engine test**

Replace the whole `describe('MEDAL_LABELS / MEDAL_TAGLINES', ...)` block at the end of
`tests/engine/medals.test.ts` with:

```ts
describe('MEDAL_LABELS / MEDAL_TAGLINES', () => {
  it('has an entry for every medal tier', () => {
    const tiers = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;
    for (const t of tiers) {
      expect(MEDAL_LABELS[t]).toBeTruthy();
      expect(MEDAL_TAGLINES[t]).toBeTruthy();
    }
  });

  // 027 — the medal is the game's only progression ladder now. Its labels are the
  // former reputation titles (src/engine/reputation.ts, deleted) rather than metal
  // names, so the run-end screen names progression once instead of twice.
  it('labels each tier with a farming-progression title', () => {
    expect(MEDAL_LABELS).toEqual({
      none: 'Struggling Smallholder',
      bronze: 'Apprentice Farmer',
      silver: 'Seasoned Grower',
      gold: 'Respected Agronomist',
      platinum: 'Legendary Cultivator',
    });
  });

  it('uses no metal names as labels', () => {
    for (const label of Object.values(MEDAL_LABELS)) {
      expect(label).not.toMatch(/bronze|silver|gold|platinum|no medal/i);
    }
  });

  it('keeps the taglines, which still name the season reached', () => {
    expect(MEDAL_TAGLINES.bronze).toBe('Survived Spring Thaw');
    expect(MEDAL_TAGLINES.platinum).toBe('Conquered Season 4');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/medals.test.ts`
Expected: FAIL — `labels each tier with a farming-progression title` reports the received
object still holds `'No Medal'`, `'Bronze'`, `'Silver'`, `'Gold'`, `'Platinum'`.

- [ ] **Step 3: Re-author the labels**

In `src/engine/medals.ts`, replace the `MEDAL_LABELS` constant:

```ts
/**
 * 027 — the medal is the game's single run-progression ladder. These titles were the
 * reputation ladder's (src/engine/reputation.ts, deleted in 027): that ladder measured
 * the same axis as the medal on a second surface, so its 7 tiers were collapsed onto
 * the medal's 5. 'Hopeful Homesteader' and 'Master of the Harvest' did not survive the
 * collapse — the remaining five read as one competence progression.
 */
export const MEDAL_LABELS: Record<Medal, string> = {
  none: 'Struggling Smallholder',
  bronze: 'Apprentice Farmer',
  silver: 'Seasoned Grower',
  gold: 'Respected Agronomist',
  platinum: 'Legendary Cultivator',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/engine/medals.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Write the failing badge test**

In `tests/components/MedalBadge.test.tsx`, add `MEDAL_LABELS` / `MEDAL_TAGLINES` to the
imports and replace the first two `it(...)` blocks:

```tsx
import { MEDAL_LABELS, MEDAL_TAGLINES } from '../../src/engine/medals';
```

```tsx
  it.each(namedTiers)('composes the %s aria-label from its label and tagline', (tier) => {
    render(<MedalBadge medal={tier} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      `${MEDAL_LABELS[tier]} — ${MEDAL_TAGLINES[tier]}`,
    );
  });

  // 027 — the none tier is a real progression title now, not the absence of one, so it
  // takes the same template as every other tier instead of a special-cased string.
  it('uses the progression title for the none tier', () => {
    render(<MedalBadge medal="none" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Struggling Smallholder — Keep going',
    );
  });

  it('never says the word "medal" in the aria-label', () => {
    for (const tier of allTiers) {
      const { unmount } = render(<MedalBadge medal={tier} />);
      expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/medal/i);
      unmount();
    }
  });
```

Note the em dash `—` (U+2014) in the template — it must match the component exactly.

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/components/MedalBadge.test.tsx`
Expected: FAIL — received `"Apprentice Farmer medal — Survived Spring Thaw"` (the stray
word "medal"), and the none tier still returns `"No medal — keep going"`.

- [ ] **Step 7: Fix the aria-label composition**

In `src/components/MedalBadge.tsx`, replace the `ariaLabel` derivation:

```tsx
  const label = MEDAL_LABELS[medal];
  const tagline = MEDAL_TAGLINES[medal];
  // 027 — one template for every tier. `none` is 'Struggling Smallholder' now, a real
  // rung on the ladder, so it no longer needs a special "No medal" string. The word
  // "medal" is dropped because the labels are farmer titles, not metals.
  const ariaLabel = `${label} — ${tagline}`;
```

- [ ] **Step 8: Run both test files to verify they pass**

Run: `npx vitest run tests/components/MedalBadge.test.tsx tests/engine/medals.test.ts`
Expected: PASS. The existing axe test in `MedalBadge.test.tsx` must stay green.

- [ ] **Step 9: Commit**

```bash
git add src/engine/medals.ts src/components/MedalBadge.tsx tests/engine/medals.test.ts tests/components/MedalBadge.test.tsx
git commit -m "refactor(medals): give medal tiers the reputation titles

The reputation ladder measured the same axis as the medal on a second
surface. Folding its titles onto the medal's five tiers lets the ladder
itself be deleted in the next commit."
```

---

## Task 2: Remove the reputation chip and delete the ladder

**Files:**
- Modify: `src/components/HUD.tsx` (import, `getRepTitleClass`, `repExpanded`, the chip JSX)
- Delete: `src/engine/reputation.ts`
- Delete: `tests/engine/reputation.test.ts`
- Test: `tests/components/HUD.test.tsx`
- Test: `tests/components/ExpandableChip.test.tsx`

- [ ] **Step 1: Write the failing regression test**

In `tests/components/HUD.test.tsx`, replace the whole `describe('HUD — reputation chip', ...)`
block with:

```tsx
// 027 — the reputation title restated the day counter that already dominates the HUD,
// so the chip is gone and the ladder now lives on the medal (src/engine/medals.ts).
describe('HUD — 027 reputation chip removed', () => {
  it('renders no reputation chip', () => {
    render(<HUD {...baseProps} currentDay={14} coinBalance={100} />);
    expect(screen.queryByLabelText(/reputation/i)).toBeNull();
  });

  it('renders no reputation title text at any day', () => {
    for (const day of [1, 14, 21, 41, 81]) {
      const { unmount } = render(<HUD {...baseProps} currentDay={day} coinBalance={100} />);
      expect(screen.queryByText(/Smallholder|Homesteader|Apprentice|Grower|Agronomist|Master of the Harvest|Cultivator/i)).toBeNull();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "027 reputation chip removed"`
Expected: FAIL — the chip is still found by `queryByLabelText(/reputation/i)`.

- [ ] **Step 3: Remove the chip from the HUD**

In `src/components/HUD.tsx` make five deletions:

1. Delete the import line:

```tsx
import { getReputationTier } from '../engine/reputation';
```

2. Delete the helper (it has no other caller):

```tsx
function getRepTitleClass(expanded: boolean): string {
  return `font-pixel text-caption text-farm-parchment/90 whitespace-nowrap ${expanded ? 'inline' : 'hidden'} sm:inline`;
}
```

3. Delete this line from the component body:

```tsx
  const reputation = getReputationTier(currentDay);
```

4. Delete these two lines from the component body:

```tsx
  const [repExpanded, setRepExpanded] = useState(false);
```

```tsx
  const repTitleClass = getRepTitleClass(repExpanded);
```

5. Delete the entire reputation chip JSX, the last child inside the `<div className="contents">`:

```tsx
        <ExpandableChip
          expanded={repExpanded}
          onToggle={() => setRepExpanded(v => !v)}
          ariaLabel={`Reputation: ${reputation.title}`}
          title={`Reputation: ${reputation.title}. Your standing grows as you survive more days this run.`}
          className="flex min-h-[44px] md:min-h-0 items-center gap-1.5 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60"
        >
          <span className="sr-only">Reputation: </span>
          <span className="text-base leading-none -translate-y-[0.13em]" aria-hidden="true">🎖️</span>
          <span className={repTitleClass}>
            {reputation.title}
          </span>
        </ExpandableChip>
```

Keep the `useState` import and the `ExpandableChip` import — the season chip still uses both.

- [ ] **Step 4: Fix the two tests that asserted the chip existed**

In `tests/components/HUD.test.tsx`, inside `describe('HUD — mobile compaction', ...)`, delete:

```tsx
  it('toggles the reputation chip aria-expanded on click', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByRole('button', { name: /reputation/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
  });
```

Then inside `describe('HUD — 024 chips are inert at desktop widths', ...)`, replace both tests:

```tsx
  it('does not render the season chip as a button at sm+', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    expect(screen.queryByRole('button', { name: /season 1 · spring thaw/i })).toBeNull();
  });

  it('still shows the season chip content at sm+', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    expect(screen.getByText(/Season 1 · Spring Thaw/)).toBeInTheDocument();
  });
```

- [ ] **Step 5: Delete the ladder and its test**

```bash
git rm src/engine/reputation.ts tests/engine/reputation.test.ts
```

- [ ] **Step 6: Refresh the stale ExpandableChip fixture**

`tests/components/ExpandableChip.test.tsx` uses a reputation chip as its example. The
component is generic, but the fixture should not name a deleted concept. Replace both
occurrences of the `ariaLabel` and its child, and the matching query:

```tsx
      <ExpandableChip expanded={false} onToggle={onToggle} className="chip" ariaLabel="Season 1 · Spring Thaw">
        <span>Spring</span>
      </ExpandableChip>,
```

```tsx
    const chip = screen.getByRole('button', { name: /season 1 · spring thaw/i });
```

In the second test (`renders a non-interactive element at sm and up`) the final assertion
also changes:

```tsx
    expect(screen.getByText('Spring')).toBeInTheDocument();
```

- [ ] **Step 7: Run the full suite and the linter**

Run: `npm test && npm run lint`
Expected: PASS. No file should still import `../engine/reputation`; a leftover import is a
TypeScript build error, so a green run proves the deletion is complete.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(hud): remove the reputation chip and delete its ladder

The title was derived from the day counter already shown in the HUD, so it
re-encoded information rather than adding any. Its titles now live on the
medal, which measured the same axis at run end."
```

---

## Task 3: Daily ledger chip

**Files:**
- Modify: `src/components/HUD.tsx` (add `DailyLedgerChip`; remove the streak chip and the `hidden sm:flex` lease block)
- Test: `tests/components/HUD.test.tsx`

Re-read the "Critical constraints" section above before writing any markup.

- [ ] **Step 1: Write the failing tests**

In `tests/components/HUD.test.tsx`, delete the whole `describe('HUD — harvest streak chip', ...)`
block and the whole `describe('HUD — lease readout', ...)` block, then add:

```tsx
// 027 — lease and the streak bonus are both coins-per-day, so they share one chip. In
// jsdom there is no Tailwind CSS, so `sm:hidden` and `hidden sm:inline` spans are all
// present in the DOM; tests that care about one width query that width's spans directly.
describe('HUD — 027 daily ledger chip', () => {
  /** Concatenated text of the chip's mobile-only spans. */
  function mobileText(chip: HTMLElement): string {
    return [...chip.querySelectorAll('.sm\\:hidden')].map(e => e.textContent).join('');
  }

  it('shows the lease at streak 0, with no bonus half', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(mobileText(chip)).toBe('−15/day');
    expect(chip).toHaveTextContent(/Lease 15/);
  });

  it('adds the bonus half when a streak is live', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    const chip = screen.getByLabelText(/harvest streak: 3 days in a row/i);
    expect(mobileText(chip)).toBe('−15·+15');
  });

  it('caps the displayed bonus at +20', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={7} />);
    const chip = screen.getByLabelText(/harvest streak: 7 days in a row/i);
    expect(mobileText(chip)).toBe('−15·+20');
  });

  it('uses the singular "day" for a 1-day streak', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={1} />);
    expect(screen.getByLabelText(/harvest streak: 1 day in a row/i)).toBeInTheDocument();
  });

  it('keeps emoji out of the mobile form (81px width budget — see spec.md)', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    const chip = screen.getByLabelText(/harvest streak: 3 days in a row/i);
    expect(mobileText(chip)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('shows the end-of-season lease preview in the sm+ form', () => {
    render(<HUD {...baseProps} currentDay={20} coinBalance={300} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip).toHaveTextContent(/rises to 22 next season/);
  });

  it('omits the preview on any day but the last of the season', () => {
    render(<HUD {...baseProps} currentDay={19} coinBalance={300} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip).not.toHaveTextContent(/rises to/);
  });

  it('no longer renders a standalone harvest-streak chip', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(screen.queryByLabelText(/^Harvest streak: \d+ days$/)).toBeNull();
  });

  it('shows the lease at mobile widths — the chip is never width-gated (F7)', () => {
    const { container } = render(<HUD {...baseProps} currentDay={5} coinBalance={100} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    // The pre-027 readout lived in a `hidden sm:flex` wrapper. Nothing in the chip's
    // ancestry may hide it below sm.
    let node: HTMLElement | null = chip;
    while (node && node !== container) {
      expect(node.className).not.toMatch(/(^|\s)hidden(\s|$)/);
      node = node.parentElement;
    }
  });
});
```

The `−` characters above are U+2212. The `·` is U+00B7.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/components/HUD.test.tsx -t "027 daily ledger chip"`
Expected: FAIL — every test errors with "Unable to find a label with the text of:
/lease: 15 coins per day/i", because the chip does not exist yet.

- [ ] **Step 3: Add the component**

In `src/components/HUD.tsx`, add this function immediately after `ContractChip`:

```tsx
/**
 * 027 — the per-day coin ledger: the lease you owe, and the bonus your next harvest
 * will pay. Both halves are coins-per-day (the streak bonus is applied once per day on
 * any harvest day — see `computeStreakUpdate` in gameEngine.ts, not per harvest), which
 * is what makes them one chip rather than two. Replaces the pre-027 standalone streak
 * chip and the desktop-only lease readout, which was invisible below 640px (F7).
 *
 * WIDTH BUDGET: the mobile form must stay ≤81px at 375px or the HUD wraps to a third
 * row. Measured: `−15·+15` is 81px, `−15🔥+15` is 83px and costs a row. That is why the
 * `sm:hidden` spans carry no emoji and no `tracking-widest`. See specs/027-hud-legibility.
 *
 * COLOUR: `farm-stone` is unusable here — it measures 3.751 on `farm-chip` and fails
 * WCAG AA. The cost uses `farm-parchment/70` (7.06) and the bonus `farm-gold` (9.61).
 */
function DailyLedgerChip({
  leasePerDay,
  harvestStreak,
  nextSeasonLease,
}: {
  leasePerDay: number;
  harvestStreak: number;
  /** Next season's lease, previewed on the season's last day (sm+ only); null otherwise. */
  nextSeasonLease: number | null;
}) {
  const streakBonus = Math.min(harvestStreak, 4) * 5;
  const hasStreak = harvestStreak > 0;
  const days = `${harvestStreak} day${harvestStreak === 1 ? '' : 's'}`;

  const description = hasStreak
    ? `Lease: ${leasePerDay} coins per day. Harvest streak: ${days} in a row — the next harvest earns +${streakBonus} coins (capped at +20).`
    : `Lease: ${leasePerDay} coins per day, charged every night.`;

  return (
    <div
      aria-label={description}
      title={description}
      className="flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60 cursor-help"
    >
      <span className="font-pixel text-caption text-farm-parchment/70">
        {/* U+2212 MINUS SIGN, not a hyphen. */}
        <span className="sm:hidden">−{leasePerDay}{hasStreak ? '·' : '/day'}</span>
        <span className="hidden sm:inline uppercase tracking-widest">
          Lease {leasePerDay}<Coin />/day
          {nextSeasonLease !== null && (
            <span className="ml-1 text-farm-gold/70">
              (rises to {nextSeasonLease} next season)
            </span>
          )}
        </span>
      </span>
      {hasStreak && (
        <span className="font-pixel text-caption text-farm-gold">
          <span className="sm:hidden">+{streakBonus}</span>
          <span className="hidden sm:inline">· +{streakBonus}<Coin /></span>
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace the streak chip with the ledger chip**

In the `<div className="contents">` group, delete the streak chip block entirely:

```tsx
        {harvestStreak > 0 && (
          <div
            aria-label={`Harvest streak: ${harvestStreak} days`}
            title={`Harvest streak: ${harvestStreak} day${harvestStreak === 1 ? '' : 's'} in a row. Next harvest earns +${Math.min(harvestStreak, 4) * 5}🪙 bonus (capped at +20).`}
            className="flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60 cursor-help"
          >
            <EmojiIcon className="text-base leading-none">🔥</EmojiIcon>
            <span className="font-pixel text-caption text-farm-gold">×{harvestStreak}</span>
          </div>
        )}
```

and put the ledger chip in its place, before `<ContractChip contract={contract} />`:

```tsx
        <DailyLedgerChip
          leasePerDay={season.leasePerDay}
          harvestStreak={harvestStreak}
          nextSeasonLease={nextSeasonLease}
        />
```

- [ ] **Step 5: Remove the old desktop-only lease readout**

In the right-hand group, delete this wrapper and its contents:

```tsx
        <div className="hidden sm:flex items-center gap-3">
          <span className="font-pixel text-caption text-farm-stone uppercase tracking-widest">
            Lease {season.leasePerDay}<Coin />/day
            {showLeasePreview && nextSeasonLease !== null && (
              <span className="ml-1 text-farm-gold/70">
                (rises to {nextSeasonLease} next season)
              </span>
            )}
          </span>
        </div>
```

`showLeasePreview` now has one remaining use — the line that derives `nextSeasonLease` —
so leave both of these in place, unchanged:

```tsx
  const showLeasePreview = currentDay === season.endDay;
  const nextSeasonLease = showLeasePreview ? getNextSeasonLease(season, endlessMode) : null;
```

- [ ] **Step 6: Check whether `EmojiIcon` is still used**

Run: `grep -n "EmojiIcon" src/components/HUD.tsx`
Expected: the `ContractChip` still uses it (the 📜 glyph), so the import stays. If the grep
shows only the import line, remove the import — an unused import fails `npm run lint`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS, whole file.

- [ ] **Step 8: Run the full suite and the linter**

Run: `npm test && npm run lint`
Expected: PASS everywhere except `tests/palette.contrast.test.ts`, which may still pass at
this point — its `lease readout` row asserts a colour pair that no longer renders. Task 4
retires it. If the whole suite is green, that is expected; do not skip Task 4.

- [ ] **Step 9: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(hud): merge lease and streak bonus into one daily ledger chip

Both are coins-per-day, so they read as one figure rather than two chips.
This also surfaces the lease below 640px for the first time (F7): it lived
in a hidden sm:flex wrapper, so mobile players could not see the per-day
cost before advancing.

The chip's mobile form is emoji-free by necessity — measured at 375px, an
emoji inside it costs ~10px, which pushes the HUD to a third row."
```

---

## Task 4: Contrast gate rows

**Files:**
- Modify: `tests/palette.contrast.test.ts` (the `PAIRS` array)

The file's own rule: *"A row may only change in the same commit that changes the component
it mirrors."* This task is that commit — `HUD.tsx:230` was the only `farm-stone`-on-`farm-bar`
surface in the codebase, and Task 3 removed it.

- [ ] **Step 1: Confirm the retired pair no longer renders**

Run: `grep -rn "farm-stone" src/components/HUD.tsx`
Expected: no output. If any line matches, Task 3 is incomplete — fix it before continuing.

- [ ] **Step 2: Update the PAIRS array**

In `tests/palette.contrast.test.ts`, delete this row:

```ts
  { name: 'lease readout',      where: 'HUD.tsx lease span',         fg: PALETTE.stone,     bg: PALETTE.bar },
```

and add these three in its place:

```ts
  { name: 'ledger cost',        where: 'HUD.tsx DailyLedgerChip',    fg: PALETTE.parchment, bg: PALETTE.chip, alpha: 0.7 },
  { name: 'ledger bonus',       where: 'HUD.tsx DailyLedgerChip',    fg: PALETTE.gold,      bg: PALETTE.chip },
  { name: 'ledger lease preview', where: 'HUD.tsx DailyLedgerChip',  fg: PALETTE.gold,      bg: PALETTE.chip, alpha: 0.7 },
```

- [ ] **Step 3: Run the contrast gate**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: PASS — 12 rows. The three new rows measure 7.06, 9.61 and 5.47 against the 4.5
threshold.

- [ ] **Step 4: Leave a note for 028**

Add this paragraph to the end of the "Known sub-AA surfaces" doc comment, just before the
closing `*/`:

```
 * 027 note for the 028 palette lift: the retired `lease readout` row (`stone` on `bar`)
 * passed at only 4.529 — a 0.029 margin. Any future row on `bar` is similarly fragile,
 * and lightening `bar` will move every one of them. Re-derive, do not eyeball.
```

- [ ] **Step 5: Run the full suite**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/palette.contrast.test.ts
git commit -m "test(contrast): retire the lease-on-bar pair, gate the ledger chip

HUD.tsx was the only farm-stone-on-farm-bar surface, and 027 moved that
text into a chip, where farm-stone measures 3.751 and fails AA. The three
new rows mirror the chip's actual foregrounds."
```

---

## Task 5: Browser width verification

**Files:**
- Modify: `specs/027-hud-legibility/spec.md` (record the measured result)

This cannot be a unit test: jsdom has no layout engine, so `getBoundingClientRect` returns
zeroes and no wrap can be observed. The 81px budget is only meaningful when measured in a
real browser.

- [ ] **Step 1: Start the dev server**

Use the `preview_start` tool with `{name: "dev"}` (never `npm run dev` via Bash). Note the
returned `tabId`.

- [ ] **Step 2: Set the viewport to 375px**

Use `resize_window` with `{preset: "mobile", tabId: "<tabId>"}`.

- [ ] **Step 3: Measure the chip and the row count under worst-case load**

Run this via `javascript_tool`. It injects the widest contract chip the game can produce
alongside the real ledger chip, then counts distinct row offsets in the header.

```js
(() => {
  const h = document.querySelector('header');
  const holder = h.querySelector('.contents');
  const ledger = h.querySelector('[aria-label^="Lease:"]');
  const probe = document.createElement('div');
  probe.className = 'flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60';
  probe.innerHTML = '<span class="text-base leading-none">📜</span><span class="font-pixel text-caption text-farm-gold">10/10 · 12d</span>';
  holder.appendChild(probe);
  const items = [...h.querySelectorAll('*')]
    .filter(e => e.parentElement === h || (e.parentElement && e.parentElement.className === 'contents'))
    .filter(e => e.getBoundingClientRect().width > 0);
  const result = {
    viewport: window.innerWidth,
    ledgerWidth: ledger ? Math.round(ledger.getBoundingClientRect().width) : null,
    rows: new Set(items.map(e => Math.round(e.getBoundingClientRect().top))).size,
  };
  probe.remove();
  return result;
})()
```

Expected: `viewport: 375`, `ledgerWidth` ≤ 81, `rows: 2`.

If `rows` is 3, the chip is over budget. Do not adjust the budget — shorten the chip text
and re-measure.

- [ ] **Step 4: Measure again with a live streak**

The measurement above runs at streak 0 (`−15/day`, the narrower form). To hit the real worst
case, play until a harvest streak is live, or temporarily render `<HUD harvestStreak={7} …>`,
then repeat Step 3. Expected: `ledgerWidth` ≤ 81, `rows: 2`.

- [ ] **Step 5: Take a screenshot for the record**

Use `computer` with `{action: "screenshot", tabId: "<tabId>"}` at 375px with a streak live.

- [ ] **Step 6: Record the measurement in the spec**

Append an "As-built measurement" subsection to the "Measured constraints" section of
`specs/027-hud-legibility/spec.md`, as a three-row table with the columns
**Metric | Budget | Measured**, filled in with the numbers Steps 3 and 4 returned:

- `Ledger chip width, streak 0, 375px` — budget ≤81px — measured: the `ledgerWidth` from Step 3
- `Ledger chip width, streak 7, 375px` — budget ≤81px — measured: the `ledgerWidth` from Step 4
- `Header rows, worst-case contract, 375px` — budget 2 — measured: the `rows` from Step 4

Write the real integers. Do not commit the table with any cell left unfilled.

- [ ] **Step 7: Reset the viewport**

Use `resize_window` with `{preset: "desktop", tabId: "<tabId>"}` so the tab is not left
emulating a phone.

- [ ] **Step 8: Real-device acceptance check**

Open the dev server on a physical phone and confirm three states by eye: day 1, a live
streak, and a streak plus a contract. This is the spec's explicit acceptance step and the
emulated viewport does not substitute for it. Record pass/fail in the commit message.

- [ ] **Step 9: Commit**

```bash
git add specs/027-hud-legibility/spec.md
git commit -m "docs(specs): record 027's as-built HUD measurements"
```

---

## Task 6: Backlog bookkeeping

**Files:**
- Modify: `backlog.md`

> **Base-text warning.** This branch is cut from `master`, whose `backlog.md` predates the
> unmerged `backlog-f9-death-cause-baseline` branch (commits `d1d60d6`, `484f3fe`). That
> branch rewrites the F7 row and adds an F9 section. Expect a conflict in `backlog.md` when
> the two branches meet; resolve by keeping F9 and this task's F7/G13 edits together.

- [ ] **Step 1: Mark F7 done**

Replace the whole `| F7 | …` row with:

```markdown
| F7 | ✅ **Mobile lease visibility** — surface the per-day lease at mobile widths | Low | S | UI.md audit → shipped as [027-hud-legibility](specs/027-hud-legibility/spec.md) | **DONE.** Not shipped as the proposed balance-chip sub-label: the balance chip already carries a caption and a late-season warning, so a third line would grow the HUD on the width that can least afford it, and `farm-stone` fails AA on `farm-chip` (3.751). Shipped instead as a merged **daily ledger chip** — lease and the harvest-streak bonus are both coins-per-day, so they share one chip that replaced both the streak chip and the old `hidden sm:flex` readout. Measured at 375px: the chip's mobile form has a hard 81px budget; an emoji inside it costs ~10px and pushes the HUD to a third row. |
```

- [ ] **Step 2: Note that G13 is superseded**

Append this sentence to the end of the `| G13 | …` row's Notes cell, immediately before the
closing ` |`:

```markdown
 **SUPERSEDED (2026-08-27) by [027-hud-legibility](specs/027-hud-legibility/spec.md):** the HUD chip is removed and `src/engine/reputation.ts` deleted. The title was derived from the day counter the HUD already shows, and its 7-tier ladder duplicated the 5-tier medal on the same axis (disagreeing outright at day 61). Its titles now *are* the medal labels, so the feature lives on at run end rather than being reverted.
```

- [ ] **Step 3: Add the density follow-up**

Insert a new row directly after the `| F8 | …` row:

```markdown
| F10 | **Mobile HUD density at ≤360px** — the header wraps to three rows at 360px under worst-case load, and did so before 027 too. | Low | S–M | [027](specs/027-hud-legibility/spec.md) follow-up | Measured at 360px: the season chip (94px) and balance chip (151px) consume 245 of the 328px available, leaving no room for a third chip beside them. The balance chip is wide because of its `Goal 105·D20` caption, so **that caption is the lever** — the small chips are not. 027 got 375px down to two rows and deliberately did not chase 360px, which needs the balance chip restructured rather than the small chips shrunk. |
```

- [ ] **Step 4: Update the footer provenance line**

Append to the final italic paragraph, before its closing `*`:

```markdown
 Then 2026-08-27: shipped **027-hud-legibility** — reputation chip and ladder removed (G13 superseded, titles folded onto the medal), F7 closed via a merged daily-ledger chip, contrast gate re-pointed at the chip's foregrounds; **F10** added for ≤360px HUD density.
```

- [ ] **Step 5: Verify the table still renders**

Run: `grep -c "^| F" backlog.md`
Expected: one more than before the edit (F10 added). Confirm no row lost its trailing `|`.

- [ ] **Step 6: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): close F7, supersede G13, add F10 HUD density

Records why F7 did not ship in its proposed form (the balance-chip sub-label
fails AA on the chip background and costs a line) and logs the 360px finding
that 027 deliberately left alone."
```

---

## Definition of done

- [ ] `npm test && npm run lint` green.
- [ ] `src/engine/reputation.ts` and `tests/engine/reputation.test.ts` no longer exist.
- [ ] No file imports `../engine/reputation`.
- [ ] `grep -rn "farm-stone" src/components/HUD.tsx` returns nothing.
- [ ] The bankruptcy screen shows a farming title, not a metal name, at every tier.
- [ ] Ledger chip measured ≤81px and the header is 2 rows at 375px worst case, with the
      numbers written into `spec.md`.
- [ ] Real-device check done on a physical phone.
- [ ] No schema, engine, analytics or simulator file was modified. Confirm with
      `git diff --stat master...HEAD` — the only `src/` paths should be `engine/medals.ts`,
      `components/MedalBadge.tsx`, `components/HUD.tsx`, and the deleted `engine/reputation.ts`.
