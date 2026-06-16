# Farm Reputation Tier (G13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cosmetic, current-run reputation title to the HUD that escalates with `currentDay` via a front-loaded day-based ladder.

**Architecture:** A new pure engine module (`src/engine/reputation.ts`) exposes a total `getReputationTier(currentDay)` function plus a `REPUTATION_TIERS` table, mirroring the existing `medals.ts` shape. The HUD renders a new always-visible chip, computing its title inline from the `currentDay` prop it already receives — no new props, no state, no persistence.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vitest + @testing-library/react.

---

### Task 1: Reputation engine module

**Files:**
- Create: `src/engine/reputation.ts`
- Test: `tests/engine/reputation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/reputation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getReputationTier, REPUTATION_TIERS } from '../../src/engine/reputation';

describe('getReputationTier', () => {
  it('maps boundary days to the correct title', () => {
    const cases: Array<[number, string]> = [
      [1, 'Struggling Smallholder'],
      [3, 'Struggling Smallholder'],
      [4, 'Hopeful Homesteader'],
      [7, 'Hopeful Homesteader'],
      [8, 'Apprentice Farmer'],
      [13, 'Apprentice Farmer'],
      [14, 'Seasoned Grower'],
      [20, 'Seasoned Grower'],
      [21, 'Respected Agronomist'],
      [40, 'Respected Agronomist'],
      [41, 'Master of the Harvest'],
      [80, 'Master of the Harvest'],
      [81, 'Legendary Cultivator'],
    ];
    for (const [day, title] of cases) {
      expect(getReputationTier(day).title).toBe(title);
    }
  });

  it('returns the top tier for a large Endless day', () => {
    expect(getReputationTier(500).title).toBe('Legendary Cultivator');
    expect(getReputationTier(500).tier).toBe(7);
  });

  it('returns Tier 1 defensively for day < 1 and never throws', () => {
    expect(() => getReputationTier(0)).not.toThrow();
    expect(getReputationTier(0).tier).toBe(1);
    expect(getReputationTier(-5).tier).toBe(1);
  });

  it('has a contiguous, ascending ladder with no gaps or overlaps', () => {
    for (let i = 1; i < REPUTATION_TIERS.length; i++) {
      expect(REPUTATION_TIERS[i].minDay).toBeGreaterThan(REPUTATION_TIERS[i - 1].minDay);
      expect(REPUTATION_TIERS[i].tier).toBe(REPUTATION_TIERS[i - 1].tier + 1);
    }
    expect(REPUTATION_TIERS[0].minDay).toBe(1);
    expect(REPUTATION_TIERS[0].tier).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/reputation.test.ts`
Expected: FAIL — cannot resolve `../../src/engine/reputation` (module not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/engine/reputation.ts`:

```ts
export interface ReputationTier {
  /** 1-based tier index, matching the ladder table. */
  tier: number;
  /** Display title shown in the HUD. */
  title: string;
  /** First day (inclusive) at which this tier applies. */
  minDay: number;
}

/**
 * Reputation ladder, ascending by minDay. The last entry is open-ended:
 * any day at or beyond its minDay resolves to it.
 */
export const REPUTATION_TIERS: readonly ReputationTier[] = [
  { tier: 1, minDay: 1, title: 'Struggling Smallholder' },
  { tier: 2, minDay: 4, title: 'Hopeful Homesteader' },
  { tier: 3, minDay: 8, title: 'Apprentice Farmer' },
  { tier: 4, minDay: 14, title: 'Seasoned Grower' },
  { tier: 5, minDay: 21, title: 'Respected Agronomist' },
  { tier: 6, minDay: 41, title: 'Master of the Harvest' },
  { tier: 7, minDay: 81, title: 'Legendary Cultivator' },
];

/**
 * Returns the reputation tier for the given run day. Total over all numbers:
 * picks the highest tier whose minDay <= currentDay; days below the first
 * threshold (not expected in normal play) return Tier 1. Pure — no I/O.
 */
export function getReputationTier(currentDay: number): ReputationTier {
  let result = REPUTATION_TIERS[0];
  for (const t of REPUTATION_TIERS) {
    if (currentDay >= t.minDay) result = t;
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/reputation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/reputation.ts tests/engine/reputation.test.ts
git commit -m "feat(011): reputation tier ladder + pure derivation"
```

---

### Task 2: HUD reputation chip

**Files:**
- Modify: `src/components/HUD.tsx` (import at top; derive tier near `const season = ...` at line 67; add chip inside the left-cluster `<div>` that closes at line 122)
- Test: `tests/components/HUD.test.tsx` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/components/HUD.test.tsx`:

```ts
describe('HUD — reputation chip', () => {
  it('shows "Struggling Smallholder" on Day 1', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByLabelText(/reputation/i);
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/Struggling Smallholder/i);
  });

  it('shows "Seasoned Grower" on Day 14', () => {
    render(<HUD {...baseProps} currentDay={14} coinBalance={100} harvestStreak={0} />);
    expect(screen.getByLabelText(/reputation/i)).toHaveTextContent(/Seasoned Grower/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: FAIL — `getByLabelText(/reputation/i)` finds no element (chip not rendered yet).

- [ ] **Step 3: Add the import**

In `src/components/HUD.tsx`, add to the import block at the top (after the existing `seasons` import on line 2):

```ts
import { getReputationTier } from '../engine/reputation';
```

- [ ] **Step 4: Derive the tier**

In `src/components/HUD.tsx`, immediately after `const season = getSeasonForDay(currentDay);` (line 67), add:

```ts
  const reputation = getReputationTier(currentDay);
```

- [ ] **Step 5: Render the chip**

In `src/components/HUD.tsx`, inside the left-cluster `<div className="flex items-stretch gap-2">` (opens at line 89), add the chip as the last child — directly after the harvest-streak block's closing `)}` (line 121) and before that `<div>`'s closing tag (line 122):

```tsx
        <div
          aria-label={`Reputation: ${reputation.title}`}
          className="flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60"
        >
          <span className="text-base leading-none" aria-hidden="true">🎖️</span>
          <span className="font-pixel text-[10px] text-farm-parchment/90 whitespace-nowrap">
            {reputation.title}
          </span>
        </div>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS (existing HUD tests + 2 new reputation tests).

- [ ] **Step 7: Run full suite and lint**

Run: `npm test && npm run lint`
Expected: all tests PASS, lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(011): reputation tier HUD chip"
```

---

### Task 3: Manual verification & docs

**Files:**
- Modify: `backlog.md` (G13 row, line 34)

- [ ] **Step 1: Manual smoke test**

Run: `npm run dev`, open the app. Confirm the 🎖️ chip reads "Struggling Smallholder" on Day 1, sits in the left HUD cluster, and updates to "Hopeful Homesteader" at Day 4 and "Seasoned Grower" at Day 14 as you advance days. Confirm the header wraps gracefully on a narrow viewport.

- [ ] **Step 2: Mark G13 done in the backlog**

In `backlog.md`, update the G13 row (line 34): change the leading `**Farm Reputation tier (HUD title)**` cell to `✅ **Farm Reputation tier (HUD title)**` and append to the Notes cell: ` **DONE (2026-06-16).** Shipped as [011-farm-reputation-tier](specs/011-farm-reputation-tier/spec.md) — current-run, day-based front-loaded 7-tier ladder; pure display via new src/engine/reputation.ts; always-visible HUD chip; no state/schema change.`

- [ ] **Step 3: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): mark G13 done (011 reputation tier)"
```

---

## Self-Review Notes

- **Spec coverage:** ladder table → Task 1 `REPUTATION_TIERS`; pure/total `getReputationTier` → Task 1; defensive `day < 1` → Task 1 test + impl; new dedicated always-visible chip with `aria-label` → Task 2; engine + HUD tests → Tasks 1 & 2; verification (`npm test && npm run lint` + manual) → Tasks 2 & 3. No persistence/schema/economy work — correctly absent.
- **Placeholder scan:** none — every code/command step is concrete.
- **Type consistency:** `ReputationTier` (`tier`, `title`, `minDay`), `REPUTATION_TIERS`, and `getReputationTier` are named identically across the module, its tests, and the HUD usage.
