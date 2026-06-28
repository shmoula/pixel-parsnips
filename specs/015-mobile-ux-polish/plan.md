# Mobile UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mobile-only layout/UX defects in spec 015 — overscroll white flash, uneven plot heights, overflowing/wrapping HUD, tiny touch targets, mis-placed primary actions, and a stranded onboarding hint — without changing the desktop layout or any gameplay.

**Architecture:** All changes are scoped to small screens with Tailwind responsive prefixes (`sm:`, `md:`). To keep the jsdom test suite green, full desktop text stays in the DOM and is hidden via CSS on mobile (jsdom ignores CSS, so existing `getByText`/`toHaveTextContent` assertions still pass). The primary actions (Shop + Next Day) move to a new fixed bottom bar rendered as a sibling of the HUD (it cannot be a child of the HUD, whose `backdrop-blur-sm` would trap `position: fixed`). Onboarding anchor resolution is hardened to pick the visible element among responsive duplicates and to re-measure after the shop sheet finishes animating.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + @testing-library/react + vitest-axe.

---

## File Structure

- `src/index.css` — global background/viewport-height fixes (Task 1).
- `src/components/HUD.tsx` — season label helper usage, chip compaction + tap-to-reveal (Task 3), Next-Day desktop-only + Shop button removal (Task 7).
- `src/engine/seasons.ts` — `shortSeasonLabel()` helper (Task 2).
- `src/components/SeedCard.tsx`, `src/components/UpgradeCard.tsx`, `src/components/Shop.tsx` — 44px touch targets (Task 4).
- `src/components/PlotCard.tsx` — equal cell heights + full-tile buy-plot button (Task 5).
- `src/hooks/useOnboarding.ts` is unaffected; `src/components/OnboardingOverlay.tsx` — visible-anchor selection + re-measure (Task 6).
- `src/components/BottomActionBar.tsx` — NEW mobile action bar (Task 7); wired in `src/components/GameBoard.tsx`.
- Tests live under `tests/components/*.test.tsx` (mirrors `src/components`).

## Conventions (read before starting)

- Run a single test file: `npx vitest run tests/components/HUD.test.tsx`
- Run everything: `npm test` ; lint: `npm run lint`
- Preview verification uses the Claude Preview tools against `npm run dev` at viewport 375×812. Pixel-level checks (44px targets, equal heights, no white overscroll) are verified in the preview because jsdom has no layout engine.
- Keep all existing desktop text in the DOM; gate visibility with `hidden sm:inline` / `sm:hidden` etc.

---

## Task 1: Unify background + dynamic viewport height

**Files:**
- Modify: `src/index.css:7-11`

- [ ] **Step 1: Apply the background to `html` and switch to `100dvh`**

Replace the `body { ... }` block (lines 7-11) with:

```css
html {
  background-color: #140e06;
}

body {
  margin: 0;
  min-height: 100dvh;
  background-color: #140e06;
  background-image: repeating-linear-gradient(0deg, #3D2010 0px, #3D2010 2px, #4A2F1A 2px, #4A2F1A 6px);
}
```

(Setting a solid `#140e06` base on `html` means the overscroll/rubber-band area matches the dark game canvas instead of flashing white. `body` keeps the soil-stripe gradient over that base.)

- [ ] **Step 2: Verify in preview (no unit test — CSS only)**

Run dev server, resize to mobile (375×812), scroll/overscroll past the bottom of the board, and screenshot. Expected: the area below the content is dark `#140e06`, never white.

- [ ] **Step 3: Lint + commit**

Run: `npm run lint`
Expected: PASS

```bash
git add src/index.css
git commit -m "fix(mobile): unify overscroll background and use 100dvh"
```

---

## Task 2: `shortSeasonLabel` helper

**Files:**
- Modify: `src/engine/seasons.ts` (add an exported function near the other exports)
- Test: `tests/engine/seasons.shortLabel.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/engine/seasons.shortLabel.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shortSeasonLabel } from '../../src/engine/seasons';

describe('shortSeasonLabel', () => {
  it('returns the first word, uppercased', () => {
    expect(shortSeasonLabel('Spring Thaw')).toBe('SPRING');
    expect(shortSeasonLabel('Summer Heat')).toBe('SUMMER');
    expect(shortSeasonLabel('Autumn Pressure')).toBe('AUTUMN');
    expect(shortSeasonLabel('Winter Crunch')).toBe('WINTER');
  });

  it('maps the endless "Deep Winter" to WINTER', () => {
    expect(shortSeasonLabel('Deep Winter')).toBe('WINTER');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/engine/seasons.shortLabel.test.ts`
Expected: FAIL — `shortSeasonLabel` is not exported.

- [ ] **Step 3: Implement the helper**

Add to `src/engine/seasons.ts` (after the `getSeasonForDay` export):

```ts
/**
 * Short, uppercased season label for compact mobile chips.
 * First word of the name, with the endless "Deep Winter" collapsed to "WINTER".
 */
export function shortSeasonLabel(name: string): string {
  if (name === 'Deep Winter') return 'WINTER';
  return name.split(' ')[0].toUpperCase();
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run tests/engine/seasons.shortLabel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/seasons.ts tests/engine/seasons.shortLabel.test.ts
git commit -m "feat(mobile): add shortSeasonLabel helper"
```

---

## Task 3: HUD chip compaction + tap-to-reveal (mobile)

**Files:**
- Modify: `src/components/HUD.tsx` (imports, component body, Day chip, Balance chip, Reputation chip, inner chip wrapper)
- Test: `tests/components/HUD.test.tsx` (add toggle tests; existing tests must stay green)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/HUD.test.tsx`:

```tsx
describe('HUD — mobile compaction', () => {
  it('shows the short season label and the full name in the DOM', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    // short label (mobile) and full name (desktop span) both present
    expect(screen.getByText('SPRING')).toBeInTheDocument();
    expect(screen.getByText(/Season 1 · Spring Thaw/)).toBeInTheDocument();
  });

  it('toggles the season chip aria-expanded on click', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByRole('button', { name: /season 1: spring thaw/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    chip.click();
    expect(chip).toHaveAttribute('aria-expanded', 'true');
  });

  it('toggles the reputation chip aria-expanded on click', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByRole('button', { name: /reputation/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    chip.click();
    expect(chip).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: FAIL — season/reputation are still `<div>`s (no `button` role, no `aria-expanded`).

- [ ] **Step 3: Add imports + local state**

In `src/components/HUD.tsx`:
- Add `useState` to the React import (the file currently has no React import; add at top): `import { useState } from 'react';`
- Update the seasons import to include the helper:
  `import { getSeasonForDay, shortSeasonLabel, type SeasonConfig } from '../engine/seasons';`
- Inside `HUD(...)`, after the existing derived consts (around line 91), add:

```tsx
  const [seasonExpanded, setSeasonExpanded] = useState(false);
  const [repExpanded, setRepExpanded] = useState(false);
  const seasonLen = season.endDay - season.startDay + 1;
  const seasonShort = shortSeasonLabel(season.name);
```

- [ ] **Step 4: Replace the Day chip** (current lines 107-114) with a tappable button:

```tsx
        <button
          type="button"
          aria-label={`Season ${season.number}: ${season.name}`}
          aria-expanded={seasonExpanded}
          onClick={() => setSeasonExpanded(v => !v)}
          className="flex flex-col leading-tight px-2.5 py-1 bg-[#261808] border border-[#5C3D1E]/60 rounded text-left"
        >
          <span className="font-pixel text-[8px] text-farm-parchment/70 uppercase tracking-widest">
            <span className="sm:hidden">{seasonExpanded ? `Season ${season.number} · ${season.name}` : seasonShort}</span>
            <span className="hidden sm:inline">Season {season.number} · {season.name}</span>
          </span>
          <span className="font-pixel text-[10px] text-farm-gold">
            <span className="sm:hidden">D{dayIntoSeason}/{seasonLen}</span>
            <span className="hidden sm:inline">Day {dayIntoSeason} / {seasonLen}</span>
          </span>
        </button>
```

- [ ] **Step 5: Compact the Balance chip** — in the balance `<span>` (current lines 117-127), change the text so " target" is desktop-only. Replace:

```tsx
            {coinBalance} / {season.target} target
```

with:

```tsx
            {coinBalance} / {season.target}<span className="hidden sm:inline"> target</span>
```

(Leave the `data-onboarding="balance-chip"` wrapper and the `showWarning` block untouched.)

- [ ] **Step 6: Replace the Reputation chip** (current lines 139-148) with a tappable button whose title text is hidden on mobile until expanded:

```tsx
        <button
          type="button"
          aria-label={`Reputation: ${reputation.title}`}
          aria-expanded={repExpanded}
          title={`Reputation: ${reputation.title}. Your standing grows as you survive more days this run.`}
          onClick={() => setRepExpanded(v => !v)}
          className="flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60"
        >
          <span className="text-base leading-none" aria-hidden="true">🎖️</span>
          <span className={`font-pixel text-[10px] text-farm-parchment/90 whitespace-nowrap ${repExpanded ? 'inline' : 'hidden'} sm:inline`}>
            {reputation.title}
          </span>
        </button>
```

- [ ] **Step 7: Allow the chip group to wrap** — on the inner chip container (current line 106) add `flex-wrap`:

```tsx
      <div className="flex flex-wrap items-stretch gap-2">
```

- [ ] **Step 8: Run the HUD tests**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS (new toggle tests + all existing season/balance/reputation tests).

- [ ] **Step 9: Verify in preview**

Mobile 375×812: the status row fits without horizontal overflow even with a streak active; tapping the season chip reveals "Spring Thaw", tapping the medal reveals the tier title. (To force a streak, you can plant→harvest a radish, or just confirm the row width at day 1.)

- [ ] **Step 10: Lint + commit**

```bash
npm run lint
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(mobile): compact HUD chips with tap-to-reveal"
```

---

## Task 4: 44px touch targets in the shop

**Files:**
- Modify: `src/components/SeedCard.tsx:162-195`, `src/components/UpgradeCard.tsx:43-50`, `src/components/Shop.tsx:108-123`, `src/components/HUD.tsx` (Last Turn button)
- Test: `tests/components/SeedCard.test.tsx` (add a class assertion)

- [ ] **Step 1: Write the failing test**

Append to `tests/components/SeedCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SeedCard } from '../../src/components/SeedCard';

describe('SeedCard — mobile touch targets', () => {
  it('gives the BUY button a 44px minimum height on mobile', () => {
    render(
      <SeedCard cropId="radish" price={5} seedCount={0}
        onBuy={vi.fn()} onSelect={vi.fn()} canAfford={true} isSelected={false} />,
    );
    const buy = screen.getByRole('button', { name: /buy radish seed/i });
    expect(buy.className).toContain('min-h-[44px]');
    expect(buy.className).toContain('md:min-h-0');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/components/SeedCard.test.tsx`
Expected: FAIL — class not present.

- [ ] **Step 3: Add `min-h-[44px] md:min-h-0` to each control**

In `src/components/SeedCard.tsx`, the BUY button `className` (line ~167) — change the first line `mt-1 w-full py-1 rounded font-pixel text-xs` to:

```
mt-1 w-full py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-xs
```

In the same file, the Plant/Select button `className` (line ~186) — change `w-full py-1 rounded font-pixel text-xs transition-colors` to:

```
w-full py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-xs transition-colors
```

In `src/components/Shop.tsx`, the fertilizer buy button (line ~114) — change `w-full font-pixel text-xs py-1.5 rounded` to:

```
w-full font-pixel text-xs py-1.5 min-h-[44px] md:min-h-0 rounded
```

In `src/components/UpgradeCard.tsx`, the next-tier buy button (line ~43) — change `px-2 py-1 rounded font-pixel text-xs` to:

```
px-2 py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-xs
```

In `src/components/HUD.tsx`, the Last Turn button (line ~173) — change `font-pixel text-[9px] px-2 py-1.5 rounded uppercase tracking-widest` to:

```
font-pixel text-[9px] px-2 py-1.5 min-h-[44px] md:min-h-0 rounded uppercase tracking-widest
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/SeedCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify in preview**

Mobile: open the shop sheet, use `preview_inspect` on a BUY button and the fertilizer button — confirm rendered height ≥44px; confirm on desktop (≥768px) they return to compact.

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add src/components/SeedCard.tsx src/components/Shop.tsx src/components/UpgradeCard.tsx src/components/HUD.tsx tests/components/SeedCard.test.tsx
git commit -m "feat(mobile): enforce 44px touch targets in shop + HUD"
```

---

## Task 5: Equal plot-cell heights + full-tile buy-plot button

**Files:**
- Modify: `src/components/PlotCard.tsx` (all variant boxes + `LockedPlot`)
- Test: `tests/components/PlotCard.buyPlot.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/components/PlotCard.buyPlot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlotCard } from '../../src/components/PlotCard';
import type { PlotState } from '../../src/engine/types';

const lockedPlot: PlotState = {
  id: 4, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null,
};

describe('PlotCard — buy-plot tile', () => {
  it('renders the next purchasable plot as a single full-tile button', () => {
    render(
      <PlotCard plot={lockedPlot} locked isNextPurchasable plotPrice={30}
        canAffordPlot onBuyPlot={vi.fn()} />,
    );
    const tile = screen.getByRole('button', { name: /buy plot · 30/i });
    expect(tile.className).toContain('aspect-square');
    expect(tile.className).toContain('overflow-hidden');
  });

  it('calls onBuyPlot with the plot id when tapped', () => {
    const onBuyPlot = vi.fn();
    render(
      <PlotCard plot={lockedPlot} locked isNextPurchasable plotPrice={30}
        canAffordPlot onBuyPlot={onBuyPlot} />,
    );
    screen.getByRole('button', { name: /buy plot · 30/i }).click();
    expect(onBuyPlot).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/components/PlotCard.buyPlot.test.tsx`
Expected: FAIL — current buy-plot is an inner button inside a div, not a full-tile `aspect-square` button.

- [ ] **Step 3: Rework `LockedPlot`** (lines 61-86) so the purchasable state is the whole tile and clips overflow:

```tsx
function LockedPlot({ plot, isNextPurchasable, plotPrice, canAffordPlot, onBuyPlot }: {
  plot: PlotState; isNextPurchasable?: boolean; plotPrice?: number;
  canAffordPlot?: boolean; onBuyPlot?: (plotId: number) => void;
}) {
  if (isNextPurchasable && plotPrice !== undefined) {
    return (
      <button
        type="button"
        aria-label={`Buy plot · ${plotPrice}🪙, plot ${plot.id + 1}`}
        disabled={!canAffordPlot}
        onClick={() => onBuyPlot?.(plot.id)}
        className="flex flex-col items-center justify-center gap-1 w-full aspect-square overflow-hidden rounded-lg border-2 border-farm-gold/60 bg-[#160F07] p-1 select-none hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-2xl opacity-70">🔒</span>
        <span className="font-pixel text-[9px] leading-none text-farm-gold text-center">Buy · {plotPrice}🪙</span>
      </button>
    );
  }
  return (
    <div
      aria-label={`Locked plot ${plot.id + 1}`}
      className="flex flex-col items-center justify-center gap-1 w-full aspect-square overflow-hidden rounded-lg border-2 border-[#3D2510]/80 bg-[#160F07] opacity-80 select-none p-1"
    >
      <span className="text-2xl opacity-60">🔒</span>
      <span className="font-pixel text-[9px] text-farm-stone">Locked</span>
    </div>
  );
}
```

- [ ] **Step 4: Add `overflow-hidden` to the other variant boxes** so no content can grow a cell taller than its square. In `src/components/PlotCard.tsx`, add `overflow-hidden` to the className of:
  - `PestDamagedPlot` root (line ~95-100, the `w-full aspect-square rounded-lg border-2 ...` block)
  - `ExhaustedPlot` root (line ~130-135 block, add `overflow-hidden`)
  - `GrowingCropCard` root (the array at lines ~190-197; add `'overflow-hidden'` to the joined list)
  - the empty-plot `<button>` (line ~264-272; add `overflow-hidden` to its className)

Each gains `overflow-hidden` alongside the existing `w-full aspect-square` so the aspect ratio is authoritative.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/components/PlotCard.buyPlot.test.tsx`
Expected: PASS

Then run the existing plot tests to confirm no regressions:

Run: `npx vitest run tests/components/GameBoard.test.tsx tests/components/PlotCard.test.tsx tests/components/FarmGrid.test.tsx`
Expected: PASS

- [ ] **Step 6: Verify in preview**

Mobile: use `preview_eval` to read the bounding-box heights of all cells in a row that contains the "Buy plot" tile. Expected: every cell in the row is the same height (no 82 vs 74 mismatch). Confirm the same for a row mixing growing/ready/empty plots.

- [ ] **Step 7: Lint + commit**

```bash
npm run lint
git add src/components/PlotCard.tsx tests/components/PlotCard.buyPlot.test.tsx
git commit -m "fix(mobile): equal plot-cell heights and full-tile buy-plot button"
```

---

## Task 6: Onboarding anchor robustness (visible match + re-measure)

**Files:**
- Modify: `src/components/OnboardingOverlay.tsx` (`useAnchorRect` + a `findVisibleAnchor` helper)
- Test: `tests/components/OnboardingOverlay.test.tsx` (add re-measure + visible-match tests)

This fixes the stranded `buy-radishes` hint (anchor measured while the shop sheet is still sliding up) and prepares for the responsive duplicate anchors introduced in Task 7.

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/OnboardingOverlay.test.tsx`:

```tsx
import { vi as vitest } from 'vitest';

describe('OnboardingOverlay — anchor robustness', () => {
  it('re-measures the anchor after mount (covers the shop-sheet slide)', () => {
    vitest.useFakeTimers();
    const anchor = document.createElement('div');
    anchor.setAttribute('data-onboarding', 'shop-radish');
    document.body.appendChild(anchor);
    const spy = vitest.spyOn(anchor, 'getBoundingClientRect');

    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    const initialCalls = spy.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    vitest.advanceTimersByTime(400);
    expect(spy.mock.calls.length).toBeGreaterThan(initialCalls);

    spy.mockRestore();
    document.body.removeChild(anchor);
    vitest.useRealTimers();
  });

  it('prefers a visible anchor when duplicates exist', () => {
    const hidden = document.createElement('button');
    hidden.setAttribute('data-onboarding', 'next-day');
    // jsdom: getClientRects() returns [] by default → treated as not visible
    const visible = document.createElement('button');
    visible.setAttribute('data-onboarding', 'next-day');
    visible.getClientRects = () => [{ width: 10, height: 10 } as DOMRect] as unknown as DOMRectList;
    document.body.append(hidden, visible);

    const { container } = render(
      <OnboardingOverlay step="advance" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    // Ring renders against the chosen (visible) anchor without throwing.
    expect(container.querySelector('.ring-farm-gold')).toBeTruthy();

    document.body.removeChild(hidden);
    document.body.removeChild(visible);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx`
Expected: FAIL — the re-measure test sees only the single mount-time call (no timed re-measure yet).

- [ ] **Step 3: Add `findVisibleAnchor` and re-measure timers to `useAnchorRect`**

In `src/components/OnboardingOverlay.tsx`, add above `useAnchorRect`:

```tsx
/** Among all elements matching the selector, prefer one that is actually rendered. */
function findVisibleAnchor(selector: string): Element | null {
  const els = Array.from(document.querySelectorAll(selector));
  return els.find(el => el.getClientRects().length > 0) ?? els[0] ?? null;
}

/** Delays (ms) at which we re-measure after the anchor changes, covering the
 *  shop bottom-sheet's 300ms slide-up animation. */
const REMEASURE_DELAYS = [120, 260, 360];
```

Replace the body of `useAnchorRect` (lines 43-60) with:

```tsx
function useAnchorRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    const measure = () => {
      const el = findVisibleAnchor(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const timers = REMEASURE_DELAYS.map(d => window.setTimeout(measure, d));
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);
  return rect;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx`
Expected: PASS (new tests + all existing OnboardingOverlay tests).

- [ ] **Step 5: Verify in preview**

Fresh run (clear localStorage via `preview_eval: localStorage.clear(); location.reload()`), start tutorial, tap Shop. Expected: after the sheet finishes opening, the "grab 4, one for each open plot" bubble + highlight ring sit over the radish card (not off-screen).

- [ ] **Step 6: Lint + commit**

```bash
npm run lint
git add src/components/OnboardingOverlay.tsx tests/components/OnboardingOverlay.test.tsx
git commit -m "fix(mobile): re-measure + visible-anchor selection for onboarding hints"
```

---

## Task 7: Sticky bottom action bar (Shop + Next Day) on mobile

**Files:**
- Create: `src/components/BottomActionBar.tsx`
- Test: `tests/components/BottomActionBar.test.tsx` (create)
- Modify: `src/components/GameBoard.tsx` (render the bar; stop passing `onToggleShop` to HUD; add bottom padding)
- Modify: `src/components/HUD.tsx` (remove the mobile Shop button + `onToggleShop` prop; make Next Day desktop-only)
- Modify: `tests/components/HUD.test.tsx` (drop `onToggleShop` + shop-button assertion)
- Modify: `tests/components/GameBoard.test.tsx` (Next Day now appears twice)

- [ ] **Step 1: Write the failing BottomActionBar test**

Create `tests/components/BottomActionBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomActionBar } from '../../src/components/BottomActionBar';

const base = {
  onToggleShop: vi.fn(),
  onNextDay: vi.fn(),
  isProcessing: false,
  canAdvanceProductively: true,
};

describe('BottomActionBar', () => {
  it('renders the Shop and Next Day controls with onboarding anchors', () => {
    const { container } = render(<BottomActionBar {...base} />);
    expect(container.querySelector('[data-onboarding="shop-button"]')).toBeTruthy();
    expect(container.querySelector('[data-onboarding="next-day"]')).toBeTruthy();
  });

  it('calls onToggleShop and onNextDay', () => {
    const onToggleShop = vi.fn();
    const onNextDay = vi.fn();
    render(<BottomActionBar {...base} onToggleShop={onToggleShop} onNextDay={onNextDay} />);
    screen.getByRole('button', { name: /open shop/i }).click();
    expect(onToggleShop).toHaveBeenCalledOnce();
    screen.getByRole('button', { name: /advance to next day/i }).click();
    expect(onNextDay).toHaveBeenCalledOnce();
  });

  it('disables Next Day while processing', () => {
    render(<BottomActionBar {...base} isProcessing={true} />);
    expect(screen.getByRole('button', { name: /advance to next day/i })).toBeDisabled();
  });

  it('warns to plant first when advancing is unproductive', () => {
    render(<BottomActionBar {...base} canAdvanceProductively={false} />);
    expect(screen.getByRole('button', { name: /plant seeds first/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/components/BottomActionBar.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create `src/components/BottomActionBar.tsx`**

```tsx
interface BottomActionBarProps {
  onToggleShop: () => void;
  onNextDay: () => void;
  isProcessing: boolean;
  canAdvanceProductively: boolean;
}

function nextDayLabel(canAdvance: boolean): string {
  return canAdvance ? 'Advance to next day' : 'Plant seeds first — nothing planted yet';
}

function nextDayText(canAdvance: boolean): string {
  return canAdvance ? 'Next Day' : 'Plant seeds first';
}

/**
 * Mobile-only fixed action bar. Rendered as a sibling of the HUD (NOT inside it —
 * the HUD's backdrop-blur would trap position:fixed). Hidden at md and up, where
 * Next Day lives in the HUD and the shop is an always-visible sidebar.
 */
export function BottomActionBar({
  onToggleShop,
  onNextDay,
  isProcessing,
  canAdvanceProductively,
}: BottomActionBarProps) {
  return (
    <div
      className="
        md:hidden fixed bottom-0 left-0 right-0 z-50
        flex items-stretch gap-2 px-3 pt-2
        bg-[#0E0A04]/95 backdrop-blur-sm border-t border-[#5C3D1E]/50
      "
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        data-onboarding="shop-button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          flex-1 min-h-[44px] font-pixel text-[10px] rounded uppercase tracking-widest
          bg-farm-gold text-farm-ink ring-1 ring-farm-gold/50
          hover:brightness-110 active:scale-95 transition-all
        "
      >
        🌾 Shop
      </button>
      <button
        type="button"
        data-onboarding="next-day"
        aria-label={nextDayLabel(canAdvanceProductively)}
        onClick={onNextDay}
        disabled={isProcessing}
        className="
          flex-[1.4] min-h-[44px] font-pixel text-[11px] rounded uppercase tracking-widest
          bg-farm-grass text-farm-parchment
          hover:bg-farm-gold hover:text-farm-ink
          active:enabled:scale-95 disabled:opacity-50 transition-all
        "
      >
        {nextDayText(canAdvanceProductively)} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the BottomActionBar test**

Run: `npx vitest run tests/components/BottomActionBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit the new component**

```bash
git add src/components/BottomActionBar.tsx tests/components/BottomActionBar.test.tsx
git commit -m "feat(mobile): add fixed BottomActionBar (Shop + Next Day)"
```

- [ ] **Step 6: Make the HUD Next Day desktop-only and remove the mobile Shop button**

In `src/components/HUD.tsx`:
- Remove `onToggleShop` from `HUDProps` (delete line `onToggleShop: () => void;` and its doc comment) and from the destructured params.
- Wrap/flag the HUD Next Day button as desktop-only: on the Next Day `<button>` (the `data-onboarding="next-day"` one, ~line 183), add `hidden md:inline-flex` to its className (prepend to the class list). It remains in the DOM for desktop and for jsdom unit tests.
- Delete the entire mobile Shop `<button>` block (current lines 200-214, the `md:hidden ... 🌾 Shop` button).

- [ ] **Step 7: Update HUD tests for the removed prop/button**

In `tests/components/HUD.test.tsx`:
- Remove `onToggleShop: vi.fn(),` from `baseProps` (line 7).
- Remove `onToggleShop={vi.fn()}` from the `renderHUD` helper (line 105) and from the inline render (line 131).
- In the "marks the shop, next-day, and balance anchors" test, delete the `shop-button` assertion line; keep the `next-day` and `balance-chip` assertions. Rename the test to `'marks the next-day and balance anchors'`.

- [ ] **Step 8: Wire the bar into GameBoard + add bottom padding**

In `src/components/GameBoard.tsx`:
- Import the bar: `import { BottomActionBar } from './BottomActionBar';`
- Remove `onToggleShop={toggleShop}` from the `<HUD ... />` props (line ~176).
- Give the content area room for the fixed bar on mobile: change the wrapper `className="flex flex-col md:flex-row gap-4 p-4"` (line ~190) to `className="flex flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4"`.
- Render the bar near the end of the root `<div>` (e.g. right before the closing `</div>` at line ~287, after the modals):

```tsx
      <BottomActionBar
        onToggleShop={toggleShop}
        onNextDay={handleNextDay}
        isProcessing={isProcessing}
        canAdvanceProductively={canAdvance}
      />
```

- [ ] **Step 9: Update the GameBoard "Next Day" test (now two instances)**

In `tests/components/GameBoard.test.tsx`, replace the body of the `'"Next Day" button is rendered and enabled initially'` test (lines ~148-154) with:

```tsx
  it('"Next Day" button is rendered in both HUD and bottom bar, enabled initially', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    // Nothing planted → both copies show the empty-day safeguard label.
    const buttons = screen.getAllByRole('button', { name: /plant seeds first/i });
    expect(buttons).toHaveLength(2);
    buttons.forEach(b => expect(b).not.toBeDisabled());
  });
```

- [ ] **Step 10: Run the affected suites**

Run: `npx vitest run tests/components/HUD.test.tsx tests/components/GameBoard.test.tsx tests/components/BottomActionBar.test.tsx`
Expected: PASS, including the GameBoard WCAG/axe checks (duplicate accessible names are not a violation).

- [ ] **Step 11: Full suite + lint**

Run: `npm test`
Expected: PASS
Run: `npm run lint`
Expected: PASS

- [ ] **Step 12: Verify in preview**

Mobile 375×812:
- Shop (left) and Next Day (right) sit in a fixed bottom bar, both ≥44px, reachable by thumb; tapping Shop opens the sheet, Next Day advances.
- The last plot row is not covered by the bar (bottom padding works).
- Onboarding: open-shop ring/bubble highlights the bottom-bar Shop button; advance step highlights the bottom-bar Next Day (visible-anchor selection from Task 6 picks the on-screen one).
Desktop ≥768px: unchanged — Next Day + Last Turn top-right, no bottom bar, shop sidebar visible.

- [ ] **Step 13: Commit**

```bash
git add src/components/HUD.tsx src/components/GameBoard.tsx tests/components/HUD.test.tsx tests/components/GameBoard.test.tsx
git commit -m "feat(mobile): move Shop + Next Day into fixed bottom action bar"
```

---

## Final verification

- [ ] `npm test` — all suites pass.
- [ ] `npm run lint` — clean.
- [ ] Preview pass at 375×812 covering every spec item: no white overscroll; equal plot heights; HUD one-row fit with streak active + tap-to-reveal; all targets ≥44px; bottom bar reachable with Shop/Next Day in the new order; onboarding buy-radishes hint visible.
- [ ] Preview spot-check at ≥768px: desktop layout visually unchanged.

## Self-review notes (coverage map)

- Spec #1 (white bg / dvh) → Task 1.
- Spec #2 (equal plot heights, buy-plot label) → Task 5.
- Spec #3 (swap/relocate Next Day↔Shop) → Task 7 (bottom bar, Shop left / Next Day right).
- Spec #4 (onboarding hint) → Task 6.
- Spec #5 (HUD overflow) → Task 3 (`flex-wrap` + compaction).
- Spec #6 (HUD compaction, season short-label + tap reveal) → Tasks 2 + 3.
- Spec #7 (44px touch targets) → Task 4 (shop/HUD) + Task 5 (buy-plot tile) + Task 7 (bar buttons).
- Out of scope (dead vertical space rework) → intentionally not addressed.
