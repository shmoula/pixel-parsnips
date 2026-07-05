# UX Audit Fixes (017) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the critical/high UX findings from the 2026-07-05 audit — broken mobile tutorial anchoring, skip-chip overlap, misleading tax labeling, buried exhaustion events, the fertilizer trap, the empty-plot dead click, silent bankruptcy slides, disaster underreporting, mobile plot-card clipping, and season-target misframing — per `specs/017-ux-audit-fixes/spec.md`.

**Architecture:** All changes are presentation, feedback, and guardrails in the React component layer, plus two engine-adjacent fixes: making `useGameEngine.nextDay` StrictMode-safe (it currently runs the impure `processTurn` inside a `setState` updater, which React double-invokes in dev — the root of the pest-log/farm-state mismatch) and richer copy derived from log fields that already exist. No schema bump, no balance changes.

**Tech Stack:** React 18.3 + TypeScript ~5.6, Tailwind 3.4, Vitest + @testing-library/react + vitest-axe (jsdom). Tests live in `tests/` mirroring `src/`.

**Working branch:** `016-ux-ui-polish-2` — commit directly to it, no new branch.

**Conventions used below:**
- Run a single test file: `npx vitest run tests/components/DailyLog.test.tsx`
- Run everything: `npm test && npm run lint`
- Component tests use the existing `makeLog(over)` / `makePlot(over)`-style fixture helpers already present in each test file; new tests follow the same style.
- Append the project's standard `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer to every commit below.

---

### Task 1: StrictMode-safe `nextDay` + pest-log regression test (FR-019 root cause)

The pest banner reported 1 destroyed plot while 4 were damaged. The engine's logging (`src/engine/gameEngine.ts:310-333`) is correct; the bug vector is `nextDay` calling the impure `processTurn` (it consumes `Math.random`) **inside** a `setState` updater, which React StrictMode double-invokes with divergent rng — the kept result and the discarded one disagree. Every other action in the hook (`plant`, `buySeed`, …) already uses the safe `stateRef.current` + `setState(result.state)` pattern.

**Files:**
- Modify: `src/engine/useGameEngine.ts:281-285`
- Test: `tests/engine/gameEngine.test.ts` (append), `tests/engine/useGameEngine.strictmode.test.tsx` (create)

- [ ] **Step 1: Add the engine regression test (guards FR-019 at the source)**

Append to `tests/engine/gameEngine.test.ts` (uses the existing `withSeeds` helper and imports already at the top of that file):

```ts
// ── 017 FR-019 — pest log must account for every destroyed plot ───────────────

describe('processTurn — pest destruction logging (017 FR-019)', () => {
  it('logs every pest-destroyed plot and matches farm state', () => {
    let s = withSeeds(initialGameState(), { radish: 3 });
    for (const plotId of [0, 1, 2]) {
      const r = plantSeed(s, plotId, 'radish');
      if (!r.ok) throw new Error(`plant failed on plot ${plotId}`);
      s = r.state;
    }
    const { log, state: after } = processTurn(s, 'pest_infestation', [0, 1, 2]);
    expect(log.pestDestroyedPlots).toEqual([0, 1, 2]);
    expect(after.plots.filter(p => p.pestDamaged).map(p => p.id)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run it — expect PASS (regression guard; the engine itself is correct)**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "pest destruction logging"`
Expected: PASS.

- [ ] **Step 3: Write the failing StrictMode test for the hook**

Create `tests/engine/useGameEngine.strictmode.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { SCHEMA_VERSION } from '../../src/engine/constants';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useGameEngine.nextDay — StrictMode safety (017 FR-019)', () => {
  it('runs processTurn exactly once per nextDay call under StrictMode', () => {
    // Day 5 is a market-cadence day: with rng pinned to 0.9 the market fire
    // check consumes exactly ONE Math.random draw per processTurn run
    // (0.9 >= fireChance 0.5 → no event, no further draws). Weather is
    // overridden, so rng draws come only from that market check.
    const seeded = { ...initialGameState(), currentDay: 5 };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: seeded }),
    );
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const { result } = renderHook(() => useGameEngine(), { wrapper: StrictMode });
    randomSpy.mockClear(); // discard any draws from mount/initial render

    act(() => {
      result.current.nextDay('sunny');
    });

    expect(result.current.state.currentDay).toBe(6);
    expect(randomSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: Run it — expect FAIL (called 2 times: StrictMode double-invokes the updater)**

Run: `npx vitest run tests/engine/useGameEngine.strictmode.test.tsx`
Expected: FAIL with `expected "spy" to be called 1 times, but got 2 times`.

- [ ] **Step 5: Fix `nextDay` to use the stateRef pattern**

In `src/engine/useGameEngine.ts`, replace:

```ts
  const nextDay = useCallback((weatherOverride?: WeatherId) => {
    setState(prev => {
      return processTurn(prev, weatherOverride).state;
    });
  }, []);
```

with:

```ts
  const nextDay = useCallback((weatherOverride?: WeatherId) => {
    // processTurn is impure (rng); calling it inside a setState updater lets
    // StrictMode's double-invocation produce divergent results (e.g. the pest
    // log disagreeing with farm state). Read via stateRef like every other
    // action in this hook and set the computed result directly.
    setState(processTurn(stateRef.current, weatherOverride).state);
  }, []);
```

(`stateRef` already exists in this hook and is kept in sync for exactly this purpose — see `plant` a few lines below.)

- [ ] **Step 6: Run both tests — expect PASS**

Run: `npx vitest run tests/engine/useGameEngine.strictmode.test.tsx tests/engine/gameEngine.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/useGameEngine.ts tests/engine/useGameEngine.strictmode.test.tsx tests/engine/gameEngine.test.ts
git commit -m "fix(engine): make nextDay StrictMode-safe; pest-log regression test (017 FR-019)"
```

---

### Task 2: DisasterBanner — full pest accounting + no-loss framing (FR-019, FR-020 edge cases)

**Files:**
- Modify: `src/components/DisasterBanner.tsx:24-35` (`bodyLines`)
- Test: `tests/components/DisasterBanner.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/DisasterBanner.test.tsx`, following that file's existing `makeLog`-style fixture (reuse its helper; shown here assuming it is named `makeLog` — adapt the name to the file's actual helper):

```tsx
describe('DisasterBanner — accurate damage accounting (017 FR-019/FR-020)', () => {
  it('lists all destroyed plots when pests destroy several', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [0, 2, 3] })}
      />,
    );
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('3 plots destroyed by pests: #1, #3, #4.');
  });

  it('keeps the single-plot phrasing for one destroyed plot', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [1] })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Plot #2 destroyed by pests.');
  });

  it('does not overstate a pest event that destroyed nothing', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [] })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The pests found nothing to eat — no crops were growing.',
    );
  });

  it('notes that blight cost nothing when no harvests were due', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'blight', harvests: [] })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nothing was due for harvest — no coins were lost.',
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/DisasterBanner.test.tsx`
Expected: the four new tests FAIL (current output has one line per plot, no zero/no-loss lines).

- [ ] **Step 3: Implement `bodyLines`**

In `src/components/DisasterBanner.tsx`, replace the `bodyLines` function with:

```tsx
function bodyLines(log: DailyLogEntry): string[] {
  switch (log.weatherId) {
    case 'blight':
      return log.harvests.length === 0
        ? [WEATHER_DEFINITIONS.blight.description, 'Nothing was due for harvest — no coins were lost.']
        : [WEATHER_DEFINITIONS.blight.description];
    case 'pest_infestation': {
      const plots = log.pestDestroyedPlots;
      if (plots.length === 0) return ['The pests found nothing to eat — no crops were growing.'];
      if (plots.length === 1) return [`Plot #${plots[0] + 1} destroyed by pests.`];
      return [`${plots.length} plots destroyed by pests: ${plots.map(id => `#${id + 1}`).join(', ')}.`];
    }
    case 'flash_drought':
      return ['Crops planted in the next 2 days grow at half speed.'];
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run — expect PASS (whole file, to catch regressions in existing banner tests)**

Run: `npx vitest run tests/components/DisasterBanner.test.tsx`
Expected: PASS. If a pre-existing test asserted one-line-per-plot output for multi-plot pests, update that assertion to the new consolidated single line (`"2 plots destroyed by pests: #1, #2."`).

- [ ] **Step 5: Commit**

```bash
git add src/components/DisasterBanner.tsx tests/components/DisasterBanner.test.tsx
git commit -m "fix(disaster): report every destroyed plot; honest no-loss framing (017 FR-019/FR-020)"
```

---

### Task 3: DaySummaryModal — no "Quiet day" headline on disaster days (FR-020)

**Files:**
- Modify: `src/components/DaySummaryModal.tsx:19`
- Test: `tests/components/DaySummaryModal.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/components/DaySummaryModal.test.tsx` (reuse its existing log fixture helper):

```tsx
describe('DaySummaryModal — quiet-day framing (017 FR-020)', () => {
  it('suppresses "Quiet day" when the day was a disaster', () => {
    render(
      <DaySummaryModal
        log={makeLog({ weatherId: 'pest_infestation', harvests: [], totalHarvestIncome: 0 })}
        onClose={() => {}}
        animateReveal={false}
      />,
    );
    expect(screen.queryByText(/quiet day/i)).toBeNull();
  });

  it('still shows "Quiet day" on ordinary no-harvest days', () => {
    render(
      <DaySummaryModal
        log={makeLog({ weatherId: 'overcast', harvests: [], totalHarvestIncome: 0 })}
        onClose={() => {}}
        animateReveal={false}
      />,
    );
    expect(screen.getByText(/quiet day — no harvests/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — expect the first new test to FAIL**

Run: `npx vitest run tests/components/DaySummaryModal.test.tsx`

- [ ] **Step 3: Implement**

In `src/components/DaySummaryModal.tsx`, `DISASTER_WEATHER_IDS` is already imported indirectly via `DisasterBanner`'s module — import it explicitly and extend the quiet-day predicate. Replace:

```ts
import { DisasterBanner } from './DisasterBanner';
```
```ts
  const isQuietDay = log.harvests.length === 0 && log.totalHarvestIncome === 0;
```

with:

```ts
import { DisasterBanner } from './DisasterBanner';
import { DISASTER_WEATHER_IDS } from './DailyLog';
```
```ts
  const isQuietDay =
    log.harvests.length === 0 &&
    log.totalHarvestIncome === 0 &&
    !DISASTER_WEATHER_IDS.has(log.weatherId);
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/DaySummaryModal.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/DaySummaryModal.tsx tests/components/DaySummaryModal.test.tsx
git commit -m "fix(summary): no contradictory quiet-day headline on disaster days (017 FR-020)"
```

---

### Task 4: DailyLog — tax basis label + first-tax explainer (FR-006, FR-007)

The engine computes `taxDeducted = floor(taxRate × post-lease balance)` (`src/engine/gameEngine.ts:443-445`), and the log already carries `closingBalance`, so the basis is recomputable as `closingBalance + taxDeducted`. Day 1 always levies tax with current constants, so "first tax of the run" == day 1.

**Files:**
- Modify: `src/components/DailyLog.tsx:42-47` (tax row inside `LogAccountingRows`)
- Test: `tests/components/DailyLog.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/DailyLog.test.tsx` (its `makeLog` sets `taxRate: 0.05`, `taxDeducted: 4`, `closingBalance: 81`, `day: 5`):

```tsx
describe('DailyLog — tax legibility (017 FR-006/FR-007)', () => {
  it('states the tax basis so the amount is recomputable', () => {
    // basis = closingBalance + taxDeducted = 81 + 4 = 85
    render(<DailyLog log={makeLog({ taxRate: 0.06, taxDeducted: 4, closingBalance: 81 })} />);
    expect(screen.getByText(/tax \(6% of 85🪙 savings\)/i)).toBeInTheDocument();
  });

  it('shows the one-time tax explainer on day 1', () => {
    render(<DailyLog log={makeLog({ day: 1, taxDeducted: 4 })} />);
    expect(screen.getByText(/each night you pay/i)).toBeInTheDocument();
  });

  it('does not repeat the explainer after day 1', () => {
    render(<DailyLog log={makeLog({ day: 2, taxDeducted: 4 })} />);
    expect(screen.queryByText(/each night you pay/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/DailyLog.test.tsx`

- [ ] **Step 3: Implement the tax row + explainer**

In `src/components/DailyLog.tsx`, replace the tax block inside `LogAccountingRows`:

```tsx
      {log.taxDeducted > 0 && (
        <div className="flex justify-between text-farm-stone">
          <span>Tax ({Math.round(log.taxRate * 100)}%)</span>
          <span className="text-farm-red">−{log.taxDeducted}🪙</span>
        </div>
      )}
```

with:

```tsx
      {log.taxDeducted > 0 && (
        <div className="flex justify-between text-farm-stone">
          <span>
            Tax ({Math.round(log.taxRate * 100)}% of {log.closingBalance + log.taxDeducted}🪙 savings)
          </span>
          <span className="text-farm-red">−{log.taxDeducted}🪙</span>
        </div>
      )}
      {log.taxDeducted > 0 && log.day === 1 && (
        <p className="text-[10px] leading-snug text-farm-stone/80">
          Each night you pay {Math.round(log.taxRate * 100)}% of the coins you hold (after lease)
          as tax — earn faster than the kingdom collects.
        </p>
      )}
```

- [ ] **Step 4: Run — expect PASS (whole file; update any pre-existing test that asserted the bare `Tax (5%)` label to the new basis format)**

Run: `npx vitest run tests/components/DailyLog.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/DailyLog.tsx tests/components/DailyLog.test.tsx
git commit -m "fix(summary): tax line states its savings basis; day-1 explainer (017 FR-006/FR-007)"
```

---

### Task 5: DailyLog — exhaustion callout block (FR-011)

**Files:**
- Modify: `src/components/DailyLog.tsx:127-137` (exhaustion rows), imports
- Test: `tests/components/DailyLog.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

```tsx
describe('DailyLog — exhaustion callout (017 FR-011)', () => {
  it('renders exhausted plots as a distinct labelled callout, not plain rows', () => {
    render(<DailyLog log={makeLog({ exhaustedPlots: [0, 1, 3] })} />);
    const callout = screen.getByLabelText(/plots exhausted/i);
    expect(callout).toHaveTextContent('3 plots need rest');
    expect(callout).toHaveTextContent('#1, #2, #4');
  });

  it('uses singular phrasing for one plot', () => {
    render(<DailyLog log={makeLog({ exhaustedPlots: [2] })} />);
    expect(screen.getByLabelText(/plots exhausted/i)).toHaveTextContent('A plot needs rest');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/DailyLog.test.tsx -t "exhaustion callout"`

- [ ] **Step 3: Implement**

In `src/components/DailyLog.tsx`, add to the imports from constants:

```ts
import { WEATHER_DEFINITIONS, EXHAUSTION_RECOVERY_DAYS } from '../engine/constants';
```

Replace the exhaustion block:

```tsx
      {/* Exhaustion events */}
      {log.exhaustedPlots.length > 0 && (
        <div className="flex flex-col gap-1">
          {log.exhaustedPlots.map(plotId => (
            <div key={plotId} className="flex items-center gap-1 text-farm-stone">
              <span aria-hidden="true">🪨</span>
              <span>Plot #{plotId + 1} became exhausted.</span>
            </div>
          ))}
        </div>
      )}
```

with:

```tsx
      {/* Exhaustion events — distinct amber callout (017 FR-011) */}
      {log.exhaustedPlots.length > 0 && (
        <div
          role="note"
          aria-label="Plots exhausted"
          className="flex flex-col gap-0.5 px-2 py-1.5 rounded bg-farm-gold/10 border border-farm-gold/50"
        >
          <span className="font-pixel text-farm-gold">
            🪨 {log.exhaustedPlots.length === 1
              ? 'A plot needs rest'
              : `${log.exhaustedPlots.length} plots need rest`}
          </span>
          <span className="text-farm-stone">
            {log.exhaustedPlots.map(id => `#${id + 1}`).join(', ')} — back in{' '}
            {EXHAUSTION_RECOVERY_DAYS} days, or use Fertilizer.
          </span>
        </div>
      )}
```

- [ ] **Step 4: Run — expect PASS (update any pre-existing "became exhausted" assertion to the callout copy)**

Run: `npx vitest run tests/components/DailyLog.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/DailyLog.tsx tests/components/DailyLog.test.tsx
git commit -m "feat(summary): exhaustion events as a distinct callout (017 FR-011)"
```

---

### Task 6: PlotCard — honest exhausted-plot guidance (FR-012, FR-013)

Rules: recovers tomorrow → say "Ready tomorrow", never solicit a purchase (an owned-fertilizer button may remain, visually subdued). Longer rest → state the wait and present fertilizer as a costed trade-off.

**Files:**
- Modify: `src/components/PlotCard.tsx:137-185` (`ExhaustedPlot`), imports
- Test: `tests/components/PlotCard.test.tsx` (append); also update `tests/components/GameBoard.test.tsx:336-360` (asserts old `Nd remaining` copy)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/PlotCard.test.tsx` (reuse its existing plot fixture helper; an exhausted plot is one with `exhaustedSinceDay` set — pass `currentDay` so `daysUntilRecovery = EXHAUSTION_RECOVERY_DAYS − (currentDay − exhaustedSinceDay)`):

```tsx
describe('PlotCard — exhausted guidance (017 FR-012/FR-013)', () => {
  const exhausted = (daysAgo: number) =>
    makePlot({ exhaustedSinceDay: 10 - daysAgo, cropId: null });

  it('says "Ready tomorrow" and does not solicit fertilizer at 1 day left', () => {
    render(<PlotCard plot={exhausted(2)} currentDay={10} fertilizerInventory={0} />);
    expect(screen.getByText(/ready tomorrow/i)).toBeInTheDocument();
    expect(screen.queryByText(/fertilizer/i)).toBeNull();
  });

  it('presents fertilizer as a costed trade-off at 3 days left (none owned)', () => {
    render(<PlotCard plot={exhausted(0)} currentDay={10} fertilizerInventory={0} />);
    expect(screen.getByText(/resting · 3d/i)).toBeInTheDocument();
    expect(screen.getByText(/30🪙 skips the wait/i)).toBeInTheDocument();
  });

  it('offers "skip the wait" as the action when fertilizer is owned and rest is long', () => {
    render(<PlotCard plot={exhausted(0)} currentDay={10} fertilizerInventory={1} />);
    expect(screen.getByRole('button', { name: /use fertilizer/i })).toHaveTextContent(/skip 3d/i);
  });

  it('keeps an owned-fertilizer action available but subdued at 1 day left', () => {
    render(<PlotCard plot={exhausted(2)} currentDay={10} fertilizerInventory={1} />);
    expect(screen.getByRole('button', { name: /use fertilizer/i })).toHaveTextContent(/use anyway/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/PlotCard.test.tsx -t "exhausted guidance"`

- [ ] **Step 3: Implement `ExhaustedPlot`**

In `src/components/PlotCard.tsx`, extend the constants import:

```ts
import { EXHAUSTION_RECOVERY_DAYS, CROP_DEFINITIONS, FERTILIZER_COST } from '../engine/constants';
```

Replace the `ExhaustedPlot` component body with:

```tsx
// T016 + 017 FR-012/FR-013 — cracked earth; honest recovery guidance
function ExhaustedPlot({ plot, daysUntilRecovery, hasFertilizer, onApplyFertilizer }: {
  plot: PlotState;
  daysUntilRecovery: number;
  hasFertilizer: boolean;
  onApplyFertilizer?: (plotId: number) => void;
}) {
  const readyTomorrow = daysUntilRecovery <= 1;
  const ariaState = readyTomorrow
    ? 'ready tomorrow'
    : `${daysUntilRecovery} days until recovery`;
  return (
    <div
      aria-label={`Plot ${plot.id + 1}: Resting — ${ariaState}`}
      className="
        flex flex-col items-center justify-center
        w-full aspect-square overflow-hidden rounded-lg border-2
        border-farm-red/60
        select-none p-1 opacity-75
      "
      style={{
        background: [
          'repeating-linear-gradient(20deg, #3a2010 0px, #3a2010 8px, #2a1208 9px, #2a1208 10px)',
          'repeating-linear-gradient(-30deg, transparent 0px, transparent 12px, #1a0a02 13px, #1a0a02 14px)',
        ].join(', '),
        filter: 'grayscale(0.4)',
      }}
    >
      <span className="text-xl">🪨</span>
      {readyTomorrow ? (
        <span className="text-xs font-pixel text-farm-parchment/80 mt-0.5 text-center">
          Ready tomorrow
        </span>
      ) : (
        <span className="text-xs font-pixel text-farm-stone/80 mt-0.5 text-center">
          Resting · {daysUntilRecovery}d
        </span>
      )}
      {hasFertilizer && (
        <button
          type="button"
          aria-label="Use Fertilizer on this plot"
          onClick={() => onApplyFertilizer?.(plot.id)}
          className={
            readyTomorrow
              ? // Available but never recommended when recovery is free tomorrow
                'mt-1 font-pixel text-[10px] px-1.5 py-0.5 rounded border border-farm-stone/40 text-farm-stone hover:text-farm-parchment active:scale-95 transition-all cursor-pointer'
              : 'mt-1 font-pixel text-xs px-1.5 py-0.5 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink active:scale-95 transition-all cursor-pointer'
          }
        >
          {readyTomorrow ? '🌿 use anyway' : `🌿 skip ${daysUntilRecovery}d`}
        </button>
      )}
      {!hasFertilizer && !readyTomorrow && (
        <span className="text-[10px] text-farm-stone/70 mt-0.5 text-center px-1">
          🌿 {FERTILIZER_COST}🪙 skips the wait
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update the stale copy assertions in `tests/components/GameBoard.test.tsx:336-360`**

Replace the four assertions on the old copy:

```tsx
    expect(screen.getByText(/3d remaining/i)).toBeInTheDocument();   // → /resting · 3d/i
    expect(screen.getByText(/2d remaining/i)).toBeInTheDocument();   // → /resting · 2d/i
    expect(screen.getByText(/1d remaining/i)).toBeInTheDocument();   // → /ready tomorrow/i
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument(); // → /resting|ready tomorrow/i not present
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run tests/components/PlotCard.test.tsx tests/components/GameBoard.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/PlotCard.tsx tests/components/PlotCard.test.tsx tests/components/GameBoard.test.tsx
git commit -m "fix(plots): honest exhaustion recovery guidance, no fertilizer trap (017 FR-012/FR-013)"
```

---

### Task 7: Mobile plot-card fit — 3-column grid + inline drought badge (FR-021, FR-022)

At 375/390px the 4-column grid yields 74–78px cards that clip the time badge, the 52px progress ring, and long state copy. Three columns yields ~101–106px cards; Task 6 already shortened the exhausted copy. The drought icon moves inside the time badge to remove a row.

**Files:**
- Modify: `src/components/FarmGrid.tsx:82`, `src/components/PlotCard.tsx` (`GrowingCropCard`)
- Test: `tests/components/FarmGrid.test.tsx` (append), `tests/components/PlotCard.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/FarmGrid.test.tsx`:

```tsx
describe('FarmGrid — mobile columns (017 FR-021)', () => {
  it('uses 3 columns below sm and 4/6 above', () => {
    const { container } = render(<FarmGrid plots={makePlots()} />);
    const grid = container.querySelector('[data-onboarding="farm-grid"]');
    expect(grid?.className).toContain('grid-cols-3');
    expect(grid?.className).toContain('sm:grid-cols-4');
    expect(grid?.className).toContain('md:grid-cols-6');
  });
});
```

(Reuse the file's existing plots fixture; if it has none, build `Array.from({length: 12}, (_, id) => makePlot({ id }))`.)

Append to `tests/components/PlotCard.test.tsx`:

```tsx
describe('PlotCard — drought marker inline (017 FR-021)', () => {
  it('renders the flash-drought marker inside the time badge row, not as an extra row', () => {
    render(
      <PlotCard
        plot={makePlot({ cropId: 'pumpkin', daysRemaining: 4, dayPlanted: 1, droughtPenalised: true })}
        currentDay={2}
      />,
    );
    const badge = screen.getByText(/4d left/i);
    expect(badge).toHaveTextContent('☀️🔥');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/FarmGrid.test.tsx tests/components/PlotCard.test.tsx`

- [ ] **Step 3: Implement the grid change**

In `src/components/FarmGrid.tsx`, replace:

```tsx
        <div data-onboarding="farm-grid" className="grid grid-cols-4 gap-2 md:grid-cols-6">
```

with:

```tsx
        <div data-onboarding="farm-grid" className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
```

- [ ] **Step 4: Implement the inline drought marker**

In `src/components/PlotCard.tsx` (`GrowingCropCard`), replace the badge + trailing drought row:

```tsx
      {isReady ? (
        <span className="mt-1 font-pixel text-[9px] px-2 py-0.5 rounded bg-farm-grass text-farm-parchment">
          HARVEST
        </span>
      ) : (
        <span className="mt-1 font-pixel text-[9px] px-2 py-0.5 rounded bg-farm-gold/20 border border-farm-gold/50 text-farm-gold">
          {daysRemaining}d left
        </span>
      )}
      {plot.droughtPenalised && (
        <span
          aria-label="Growth slowed by Flash Drought"
          title="Growth slowed by Flash Drought"
          className="text-xs mt-0.5"
        >
          ☀️🔥
        </span>
      )}
```

with:

```tsx
      {isReady ? (
        <span className="mt-1 font-pixel text-[9px] px-2 py-0.5 rounded bg-farm-grass text-farm-parchment">
          HARVEST
        </span>
      ) : (
        <span className="mt-1 font-pixel text-[9px] px-2 py-0.5 rounded bg-farm-gold/20 border border-farm-gold/50 text-farm-gold">
          {daysRemaining}d left
          {plot.droughtPenalised && (
            <span aria-label="Growth slowed by Flash Drought" title="Growth slowed by Flash Drought">
              {' '}☀️🔥
            </span>
          )}
        </span>
      )}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run tests/components/FarmGrid.test.tsx tests/components/PlotCard.test.tsx`

- [ ] **Step 6: Manual clip check in the browser (SC-008)**

Start the dev server (`.claude/launch.json` → `dev`), resize to 375×812 and 390×844, and for each plot state (growing pumpkin with drought marker, exhausted 1d/3d with and without fertilizer, pest-damaged, locked, purchasable) verify content bounds:

```js
// preview_eval — badge must not clip its card
(() => { const card = document.querySelector('[role=img][aria-label*="Pumpkin"]');
  const badge = [...card.querySelectorAll('span')].find(s => /left/.test(s.textContent));
  const c = card.getBoundingClientRect(), b = badge.getBoundingClientRect();
  return { ok: b.bottom <= c.bottom && b.right <= c.right }; })()
```

Expected: `ok: true` at both sizes; no horizontal page scroll (`document.body.scrollWidth <= window.innerWidth`).

- [ ] **Step 7: Commit**

```bash
git add src/components/FarmGrid.tsx src/components/PlotCard.tsx tests/components/FarmGrid.test.tsx tests/components/PlotCard.test.tsx
git commit -m "fix(mobile): 3-col farm grid + inline drought badge so plot cards never clip (017 FR-021/FR-022)"
```

---

### Task 8: HUD — season goal framed as a deadline (FR-008, FR-009)

The balance chip becomes two lines: coins on top, `GOAL {target} BY DAY {seasonLen}` beneath (mobile: `GOAL {target}·D{seasonLen}`). The green "target met" styling is removed — coins stay gold unless in danger. The existing late-season red warning moves into the goal line.

**Files:**
- Modify: `src/components/HUD.tsx:45-54` (`getBalanceTextClass`), `src/components/HUD.tsx:138-152` (balance chip)
- Test: `tests/components/HUD.test.tsx` (update test at :28, append new)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/HUD.test.tsx` (reuse its existing default-props helper):

```tsx
describe('HUD — season goal deadline framing (017 FR-008/FR-009)', () => {
  it('presents the target as a deadline, not a completed fraction', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={130} />);
    // Season 1 target is 105, season length 20
    expect(screen.getByText(/goal 105 by day 20/i)).toBeInTheDocument();
    expect(screen.queryByText(/130 \/ 105/)).toBeNull();
  });

  it('does not style the balance as achieved while the season is undecided', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={130} />);
    const coins = screen.getByLabelText(/coins: 130/i);
    expect(coins.className).not.toContain('text-[#5FB54A]');
  });
});
```

Update the existing test at `tests/components/HUD.test.tsx:28` ("renders the season target alongside the coin balance") to assert the new format: coins value present and `GOAL … BY DAY …` line present, instead of the `X / Y target` fraction.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/HUD.test.tsx`

- [ ] **Step 3: Implement**

In `src/components/HUD.tsx`:

(a) Simplify `getBalanceTextClass` — delete the `targetMet` parameter and its branch:

```ts
function getBalanceTextClass(danger: DangerLevel): string {
  // Lighter than farm-red so the "critical" balance keeps a ≥4.5:1 contrast
  // ratio against the dark #261808 chip (WCAG AA / Lighthouse a11y).
  if (danger === 'critical') return 'text-[#EB6A5C]';
  if (danger === 'low') return 'text-yellow-300';
  return 'text-farm-gold';
}
```

and update its call site: `const balanceTextClass = getBalanceTextClass(dangerLevel);` (the `targetMet` variable stays — the season-transition logic elsewhere doesn't use it here, but keep the computation only if still referenced; otherwise delete it).

(b) Replace the balance chip markup:

```tsx
        <div data-onboarding="balance-chip" className={`flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border ${balanceBorderClass}`}>
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <span
            className={`font-pixel text-sm ${balanceTextClass}`}
            aria-label={`Coins: ${coinBalance}, season target: ${season.target}`}
          >
            <span className="sm:hidden">{coinBalance} / {season.target}</span>
            <span className="hidden sm:inline">{coinBalance} / {season.target} target</span>
            {showWarning && (
              <span className="ml-1 text-farm-red">
                  — {daysRemainingInSeason} {daysRemainingInSeason === 1 ? 'day' : 'days'} left
                </span>
            )}
          </span>
        </div>
```

with:

```tsx
        <div data-onboarding="balance-chip" className={`flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border ${balanceBorderClass}`}>
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <div className="flex flex-col justify-center leading-tight">
            <span
              className={`font-pixel text-sm ${balanceTextClass}`}
              aria-label={`Coins: ${coinBalance}. Season goal: ${season.target} coins by day ${seasonLen} of the season.`}
            >
              {coinBalance}
            </span>
            <span className="font-pixel text-[8px] text-farm-parchment/70 uppercase tracking-widest">
              <span className="sm:hidden">Goal {season.target}·D{seasonLen}</span>
              <span className="hidden sm:inline">Goal {season.target} by day {seasonLen}</span>
              {showWarning && (
                <span className="text-farm-red"> — {daysRemainingInSeason}d left</span>
              )}
            </span>
          </div>
        </div>
```

- [ ] **Step 4: Run — expect PASS (fix any other HUD tests asserting the old aria-label `Coins: X, season target: Y`)**

Run: `npx vitest run tests/components/HUD.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "fix(hud): season goal reads as an end-of-season deadline (017 FR-008/FR-009)"
```

---

### Task 9: Advance-day control — truthful "Skip day" label (FR-018)

**Files:**
- Modify: `src/components/HUD.tsx:36-43`, `src/components/BottomActionBar.tsx:10-16`
- Test: `tests/components/BottomActionBar.test.tsx` (append), `tests/components/HUD.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/BottomActionBar.test.tsx`:

```tsx
it('labels the advance control "Skip day" when nothing is planted (017 FR-018)', () => {
  render(<BottomActionBar {...base} canAdvanceProductively={false} />);
  expect(screen.getByRole('button', { name: /skip day — nothing planted/i })).toHaveTextContent(/skip day/i);
  expect(screen.queryByText(/plant seeds first/i)).toBeNull();
});
```

Append the same-shaped test to `tests/components/HUD.test.tsx` for the desktop button (`canAdvanceProductively={false}`).

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/BottomActionBar.test.tsx tests/components/HUD.test.tsx`

- [ ] **Step 3: Implement in both files**

In `src/components/HUD.tsx` replace:

```ts
function getNextDayLabel(canAdvanceProductively: boolean): string {
  // Accessible name must contain the button's visible text (axe label-content-name-mismatch).
  return canAdvanceProductively ? 'Advance to next day' : 'Plant seeds first — nothing planted yet';
}

function getNextDayText(canAdvanceProductively: boolean): string {
  return canAdvanceProductively ? 'Next Day' : 'Plant seeds first';
}
```

with:

```ts
function getNextDayLabel(canAdvanceProductively: boolean): string {
  // Accessible name must contain the button's visible text (axe label-content-name-mismatch).
  return canAdvanceProductively ? 'Advance to next day' : 'Skip day — nothing planted';
}

function getNextDayText(canAdvanceProductively: boolean): string {
  return canAdvanceProductively ? 'Next Day' : 'Skip day';
}
```

In `src/components/BottomActionBar.tsx` make the identical replacement in `nextDayLabel`/`nextDayText`.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/BottomActionBar.test.tsx tests/components/HUD.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx src/components/BottomActionBar.tsx tests/components/BottomActionBar.test.tsx tests/components/HUD.test.tsx
git commit -m "fix(hud): advance control says what it does — Skip day (017 FR-018)"
```

---

### Task 10: EmptyDayConfirm — costed copy + ruinous re-arm (FR-015, FR-016)

**Files:**
- Modify: `src/components/GameBoard.tsx:43-70` (`EmptyDayConfirm`), `:122-123` + `:166-170` (`handleNextDay`), imports
- Test: `tests/components/GameBoard.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/GameBoard.test.tsx` (reuse the file's existing state fixture + render helper; drive clicks with the file's established pattern — `fireEvent`/`userEvent` on the advance button, nothing planted):

```tsx
describe('GameBoard — empty-day guardrails (017 FR-015/FR-016)', () => {
  it('states the concrete cost of an empty day in the confirmation', () => {
    // Season 1 (day 3): lease 15; balance 100 → tax ≈ floor((100−15)×0.06) = 5
    renderBoard({ currentDay: 3, coinBalance: 100, nothingPlanted: true });
    fireEvent.click(screen.getByRole('button', { name: /skip day/i }));
    const dialog = screen.getByRole('dialog', { name: /advance empty day/i });
    expect(dialog).toHaveTextContent(/15🪙 lease/i);
    expect(dialog).toHaveTextContent(/~5🪙 tax/i);
    expect(dialog).toHaveTextContent(/earn nothing/i);
  });

  it('re-arms the confirmation when another empty day could not be survived', () => {
    // balance 40, lease 15, tax floor(25×0.06)=1 → after: 24; 24 ≥ 15 → NOT ruinous
    // balance 31, lease 15, tax floor(16×0.06)=0 → after: 16; 16 ≥ 15 → NOT ruinous
    // balance 30, lease 15, tax 0 → after: 15; 15 ≥ 15 → NOT ruinous
    // balance 29, lease 15, tax 0 → after: 14; 14 < 15 → RUINOUS
    renderBoard({ currentDay: 3, coinBalance: 29, nothingPlanted: true, hasConfirmedEmptyDayAlready: true });
    fireEvent.click(screen.getByRole('button', { name: /skip day/i }));
    expect(screen.getByRole('dialog', { name: /advance empty day/i })).toBeInTheDocument();
  });
});
```

If the file has no `renderBoard` helper with those knobs, follow its existing GameBoard render pattern and set up the state inline; `hasConfirmedEmptyDayAlready` is exercised by confirming one empty day first (click Skip day → Advance), then attempting a second.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/GameBoard.test.tsx -t "empty-day guardrails"`

- [ ] **Step 3: Implement**

In `src/components/GameBoard.tsx`:

(a) Add imports:

```ts
import { TAX_RATE } from '../engine/constants';
import { getSeasonForDay } from '../engine/seasons';
```

(b) Replace `EmptyDayConfirm` with a costed version:

```tsx
function EmptyDayConfirm({ leaseCost, taxEstimate, onCancel, onAdvance }: {
  leaseCost: number;
  taxEstimate: number;
  onCancel: () => void;
  onAdvance: () => void;
}) {
  return (
    <div role="dialog" aria-label="Advance empty day" className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-6">
      <div className="max-w-xs w-full bg-farm-soil border border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4 text-center">
        <p className="font-pixel text-xs text-farm-parchment leading-relaxed">
          Nothing's planted — skip the day?
        </p>
        <p className="font-pixel text-[10px] text-farm-stone leading-relaxed">
          You'll pay {leaseCost}🪙 lease and ~{taxEstimate}🪙 tax, and earn nothing.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAdvance}
            className="font-pixel text-xs px-4 py-2 rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-farm-soil"
          >
            Skip day
          </button>
        </div>
      </div>
    </div>
  );
}
```

(c) Inside `GameBoard`, above `handleNextDay`, derive the costs and the ruinous check, and re-arm:

```ts
  const season = getSeasonForDay(state.currentDay);
  const leaseCost = season.leasePerDay;
  const taxEstimate = Math.max(0, Math.floor((state.coinBalance - leaseCost) * TAX_RATE));
  // FR-016: an empty day is "ruinous" when its cost leaves less than one more day's lease.
  const emptyDayIsRuinous = state.coinBalance - leaseCost - taxEstimate < leaseCost;

  function handleNextDay() {
    if (isProcessing) return;
    if (!canAdvance && (!hasConfirmedEmptyDay || emptyDayIsRuinous)) {
      setShowEmptyConfirm(true);
      return;
    }
    doAdvance();
  }
```

(d) Pass the new props at the render site:

```tsx
      {showEmptyConfirm && (
        <EmptyDayConfirm
          leaseCost={leaseCost}
          taxEstimate={taxEstimate}
          onCancel={() => setShowEmptyConfirm(false)}
          onAdvance={() => {
            setShowEmptyConfirm(false);
            setHasConfirmedEmptyDay(true);
            doAdvance();
          }}
        />
      )}
```

- [ ] **Step 4: Run — expect PASS (update any pre-existing test asserting the old "advance anyway?" copy or the `Advance` button name — it is now `Skip day`)**

Run: `npx vitest run tests/components/GameBoard.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/GameBoard.tsx tests/components/GameBoard.test.tsx
git commit -m "feat(guardrails): costed empty-day confirm that re-arms when ruinous (017 FR-015/FR-016)"
```

---

### Task 11: Unwinnable-run banner + restart wiring (FR-017)

Unwinnable = nothing growing AND no seeds owned AND balance below the cheapest (discounted) seed. Fired as a persistent `role="alert"` banner above the farm with a two-tap "Start new run" escape hatch.

**Files:**
- Modify: `src/components/GameBoard.tsx` (new `UnwinnableBanner`, props, render), `src/App.tsx:73-88` (pass `onRestart`)
- Test: `tests/components/GameBoard.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

```tsx
describe('GameBoard — unwinnable-run notice (017 FR-017)', () => {
  it('warns when no seeds are affordable, none owned, and nothing grows', () => {
    renderBoard({ coinBalance: 3, nothingPlanted: true, noSeedsOwned: true });
    const alert = screen.getByRole('alert', { name: /run cannot recover/i });
    expect(alert).toHaveTextContent(/can't afford seeds/i);
    expect(within(alert).getByRole('button', { name: /start new run/i })).toBeInTheDocument();
  });

  it('does not fire while a crop is still growing', () => {
    renderBoard({ coinBalance: 3, cropGrowing: true, noSeedsOwned: true });
    expect(screen.queryByRole('alert', { name: /run cannot recover/i })).toBeNull();
  });

  it('does not fire while the player still owns a seed', () => {
    renderBoard({ coinBalance: 3, nothingPlanted: true, seedInventory: { radish: 1, parsnip: 0, pumpkin: 0 } });
    expect(screen.queryByRole('alert', { name: /run cannot recover/i })).toBeNull();
  });

  it('requires a second tap to restart', () => {
    const onRestart = vi.fn();
    renderBoard({ coinBalance: 3, nothingPlanted: true, noSeedsOwned: true, onRestart });
    const btn = screen.getByRole('button', { name: /start new run/i });
    fireEvent.click(btn);
    expect(onRestart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /tap again to confirm/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/GameBoard.test.tsx -t "unwinnable"`

- [ ] **Step 3: Implement**

In `src/components/GameBoard.tsx`:

(a) Add the banner component next to `FlashDroughtBanner`:

```tsx
function UnwinnableBanner({ onRestart }: { onRestart: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <div
      role="alert"
      aria-label="Run cannot recover"
      className="flex flex-wrap items-center justify-between gap-2 font-pixel text-xs text-farm-red bg-farm-red/20 border border-farm-red/70 px-3 py-2 rounded"
    >
      <span>
        💸 Out of options — you can't afford seeds and nothing is growing. Skip days to the end,
        or start over.
      </span>
      <button
        type="button"
        onClick={() => (armed ? onRestart() : setArmed(true))}
        className="font-pixel text-xs px-3 py-1.5 min-h-[44px] md:min-h-0 rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-farm-soil"
      >
        {armed ? 'Tap again to confirm' : 'Start new run'}
      </button>
    </div>
  );
}
```

(b) Add `onRestart` to `GameBoardProps`:

```ts
  /** Reset to a fresh run (unwinnable-state escape hatch, 017 FR-017). */
  onRestart: () => void;
```

and to the destructured parameters.

(c) Derive the condition inside `GameBoard` (after `canAdvance`):

```ts
  const anySeedOwned = Object.values(state.seedInventory).some(n => n > 0);
  // Radish is always the cheapest seed; discounts scale all seeds equally.
  const isUnwinnable = !canAdvance && !anySeedOwned && state.coinBalance < getSeedPrice('radish');
```

(d) Render it above `FlashDroughtBanner` inside `<main>`:

```tsx
          {isUnwinnable && <UnwinnableBanner onRestart={onRestart} />}
          <FlashDroughtBanner daysRemaining={state.flashDroughtDaysRemaining} />
```

(e) In `src/App.tsx`, pass the prop:

```tsx
        onBuyPlot={engine.buyPlot}
        getNextPlotPrice={engine.getNextPlotPrice}
        onRestart={restart}
```

- [ ] **Step 4: Run — expect PASS (add `onRestart: vi.fn()` to the GameBoard test file's default props so older tests still typecheck)**

Run: `npx vitest run tests/components/GameBoard.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/GameBoard.tsx src/App.tsx tests/components/GameBoard.test.tsx
git commit -m "feat(guardrails): unwinnable-run notice with restart escape hatch (017 FR-017)"
```

---

### Task 12: Empty-plot tap always responds (FR-014)

**Files:**
- Modify: `src/components/GameBoard.tsx:172-176` (`handlePlot`), banner render near `:209-213`
- Test: `tests/components/GameBoard.test.tsx` (append)

- [ ] **Step 1: Write the failing tests**

```tsx
describe('GameBoard — empty-plot tap feedback (017 FR-014)', () => {
  it('guides toward the shop when the player owns no seeds', () => {
    renderBoard({ noSeedsOwned: true });
    fireEvent.click(screen.getByRole('button', { name: /empty plot 1/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/you need seeds — grab some in the shop/i);
  });

  it('prompts seed selection when seeds are owned but none selected', () => {
    renderBoard({ seedInventory: { radish: 2, parsnip: 0, pumpkin: 0 } });
    fireEvent.click(screen.getByRole('button', { name: /empty plot 1/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/pick a seed first/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/GameBoard.test.tsx -t "empty-plot tap"`

- [ ] **Step 3: Implement**

In `src/components/GameBoard.tsx`:

(a) Add state + a helper near the other `useState` calls:

```ts
  // 017 FR-014 — transient guidance after a seedless plot tap
  const [seedHint, setSeedHint] = useState<string | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  function showSeedHint(message: string) {
    setSeedHint(message);
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setSeedHint(null), 4000);
  }

  useEffect(() => () => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
  }, []);
```

(b) Replace `handlePlot`:

```ts
  function handlePlot(plotId: number) {
    if (!selectedCrop) {
      const ownsSeeds = Object.values(state.seedInventory).some(n => n > 0);
      showSeedHint(
        ownsSeeds
          ? "Pick a seed first — tap 'Plant' on a seed you own."
          : 'You need seeds — grab some in the shop.',
      );
      if (!isDesktop) setIsShopOpen(true);
      return;
    }
    onPlantSeed(plotId, selectedCrop);
    // Selection persists across plants; the effect below clears it when inventory empties.
  }
```

(c) Render the hint next to the existing planting banner (inside `<main>`, before `FarmGrid`):

```tsx
          {seedHint && !selectedCrop && (
            <p role="status" className="font-pixel text-xs text-farm-gold bg-farm-gold/10 border border-farm-gold/30 px-3 py-2 rounded">
              🌱 {seedHint}
            </p>
          )}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/GameBoard.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/GameBoard.tsx tests/components/GameBoard.test.tsx
git commit -m "feat(farm): seedless plot taps guide the player instead of doing nothing (017 FR-014)"
```

---

### Task 13: Onboarding — live anchor tracking + bubble clamp (FR-001, FR-002)

Replace the fixed re-measure timers in `useAnchorRect` with a `requestAnimationFrame` measuring loop that runs only while a step is anchored — it tracks transforms (the sheet's 300ms slide), scrolls, resizes, and reduced-motion instant appearance uniformly. Add an off-screen fallback to `bubbleStyle` so the bubble is always visible even mid-animation.

**Files:**
- Modify: `src/components/OnboardingOverlay.tsx:39-50` (`bubbleStyle`), `:71-101` (`useAnchorRect`)
- Test: `tests/components/OnboardingOverlay.test.tsx` (append; check its existing timer usage first)

- [ ] **Step 1: Read the existing test file's setup**

Open `tests/components/OnboardingOverlay.test.tsx` and note how it stubs anchors and timers. If it awaits the old `REMEASURE_DELAYS` with fake timers, those tests will be replaced by the frame-based helper below.

- [ ] **Step 2: Write the failing test**

Append (adapting fixture names to the file's existing helpers):

```tsx
describe('OnboardingOverlay — live anchor tracking (017 FR-001/FR-002)', () => {
  let rafQueue: FrameRequestCallback[] = [];

  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  const flushFrame = () => {
    const q = rafQueue;
    rafQueue = [];
    q.forEach(cb => act(() => cb(0)));
  };

  function stubAnchor(rect: Partial<DOMRect>) {
    const el = document.createElement('div');
    el.setAttribute('data-onboarding', 'shop-radish');
    el.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 100, height: 40, ...rect }) as DOMRect;
    // findVisibleAnchor requires a non-empty client rect list
    el.getClientRects = () => [{}] as unknown as DOMRectList;
    document.body.appendChild(el);
    return el;
  }

  it('follows the anchor when it moves after mount (e.g. sheet slide-up)', () => {
    const el = stubAnchor({ top: 900, bottom: 940, left: 10, right: 110 });
    const { container } = render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={() => {}} onSkip={() => {}} onDismissPayoff={() => {}} />,
    );
    flushFrame(); // initial measure: anchor off-screen at top 900

    // Sheet finishes animating: anchor now on-screen
    el.getBoundingClientRect = () =>
      ({ x: 10, y: 300, top: 300, bottom: 340, left: 10, right: 110, width: 100, height: 40 }) as DOMRect;
    flushFrame(); // next frame picks up the new position

    const ring = container.querySelector('.ring-farm-gold') as HTMLElement;
    expect(ring.style.top).toBe('294px'); // rect.top − 6
  });
});
```

- [ ] **Step 3: Run — expect FAIL (old implementation only re-measures at fixed timeouts)**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx -t "live anchor"`

- [ ] **Step 4: Implement `useAnchorRect` as a frame loop**

In `src/components/OnboardingOverlay.tsx`, delete the `REMEASURE_DELAYS` constant and replace `useAnchorRect` with:

```ts
/** True when two rects are identical enough to skip a state update. */
function sameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * Continuously tracks the anchor's rect with a requestAnimationFrame loop while
 * a step is anchored. This follows transform transitions (the mobile shop
 * sheet's 300ms slide-up), scrolls, and resizes without event bookkeeping —
 * fixed re-measure timers missed the sheet's final position (017 FR-001/FR-002).
 * setRect bails out via sameRect, so idle frames cause no re-renders.
 */
function useAnchorRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = findVisibleAnchor(selector);
      const next = el ? el.getBoundingClientRect() : null;
      setRect(prev => (sameRect(prev, next) ? prev : next));
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}
```

(The old body's `window.addEventListener('resize'/'scroll')` and `ResizeObserver` blocks are deleted with it.)

- [ ] **Step 5: Add the off-screen fallback to `bubbleStyle`**

Replace `bubbleStyle` with:

```ts
function bubbleStyle(rect: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Anchor entirely off-screen (e.g. mid-animation or scrolled away): pin the
  // bubble above the bottom action bar so the instruction stays readable.
  if (rect.bottom <= 0 || rect.top >= vh) {
    return { left: '50%', bottom: 88, transform: 'translateX(-50%)' };
  }
  const left = Math.min(
    Math.max(EDGE_MARGIN, rect.left),
    Math.max(EDGE_MARGIN, vw - BUBBLE_WIDTH - EDGE_MARGIN),
  );
  const fitsBelow = rect.bottom + 10 + BUBBLE_HEIGHT + EDGE_MARGIN <= vh;
  return fitsBelow
    ? { left, top: rect.bottom + 10 }
    : { left, top: rect.top - 10, transform: 'translateY(-100%)' };
}
```

- [ ] **Step 6: Run the whole overlay test file — expect PASS; port any timer-based re-measure tests to `flushFrame`**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/components/OnboardingOverlay.tsx tests/components/OnboardingOverlay.test.tsx
git commit -m "fix(onboarding): rAF anchor tracking + off-screen bubble fallback (017 FR-001/FR-002)"
```

---

### Task 14: Skip chip clear of the bottom bar (FR-003)

**Files:**
- Modify: `src/components/OnboardingOverlay.tsx:103-117` (`SkipChip`)
- Test: `tests/components/OnboardingOverlay.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

```tsx
it('positions the skip chip above the mobile bottom bar (017 FR-003)', () => {
  render(
    <OnboardingOverlay step="welcome" harvestIncome={0} netIncome={0}
      onStart={() => {}} onSkip={() => {}} onDismissPayoff={() => {}} />,
  );
  const skip = screen.getByRole('button', { name: /skip tutorial/i });
  expect(skip.className).toContain('bottom-20');
  expect(skip.className).toContain('md:bottom-3');
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx -t "skip chip"`

- [ ] **Step 3: Implement**

In `SkipChip`, change the positioning classes:

```tsx
      className="fixed bottom-20 right-3 md:bottom-3 z-[60] font-pixel text-[10px] px-3 py-1.5 rounded
                 pointer-events-auto
                 bg-farm-ink/90 text-farm-parchment border border-farm-stone/40
                 hover:bg-farm-ink"
```

(`bottom-20` = 80px clears the ~60px fixed bottom bar on mobile; desktop has no bottom bar, so `md:bottom-3` restores the corner position.)

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingOverlay.tsx tests/components/OnboardingOverlay.test.tsx
git commit -m "fix(onboarding): skip chip no longer overlaps the bottom action bar (017 FR-003)"
```

---

### Task 15: Shop sheet — explicit open/close instead of toggle (FR-004)

The bottom bar's shop button currently *toggles* — any double-fire closes the sheet immediately after opening (the audit caught this stranding the buy step). Since the bar is hidden while the sheet is open, "toggle" is semantically wrong anyway: the button can only ever mean *open*; the backdrop means *close*.

**Files:**
- Modify: `src/components/GameBoard.tsx:154-156` (toggle → open/close), `:229-236` (backdrop), `:309-315` (bar props); `src/components/BottomActionBar.tsx` (prop rename)
- Test: `tests/components/BottomActionBar.test.tsx` (rename), `tests/components/GameBoard.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/components/GameBoard.test.tsx`:

```tsx
it('shop button opens (never closes) the sheet — double taps are safe (017 FR-004)', () => {
  renderBoard({ mobile: true });
  const shopBtn = screen.getByRole('button', { name: /open shop/i });
  fireEvent.click(shopBtn);
  fireEvent.click(shopBtn); // second (ghost) tap must not close it
  // The sheet wrapper is open when it lacks the translate-y-full class
  const sheet = screen.getByLabelText('Shop').parentElement as HTMLElement;
  expect(sheet.className).not.toContain('translate-y-full');
});
```

(Note: once the sheet opens the real bar unmounts; in jsdom the second click on the detached node is a no-op — which is exactly the safe behavior this test pins down. If `renderBoard` lacks a `mobile` knob, the `useMediaQuery` hook must be mocked to return `false` following the file's existing pattern for mobile tests.)

- [ ] **Step 2: Run — expect FAIL or flaky-pass; proceed to make the semantics explicit**

Run: `npx vitest run tests/components/GameBoard.test.tsx -t "double taps"`

- [ ] **Step 3: Implement**

In `src/components/GameBoard.tsx`, replace:

```ts
  function toggleShop() {
    setIsShopOpen(prev => !prev);
  }
```

with:

```ts
  // 017 FR-004 — the bar's shop button can only OPEN (the bar hides while the
  // sheet is up); the backdrop CLOSES. A toggle here let double-fired events
  // close the sheet right after opening, stranding the tutorial's buy step.
  const openShop = () => setIsShopOpen(true);
  const closeShop = () => setIsShopOpen(false);
```

Update the backdrop `onClick={toggleShop}` → `onClick={closeShop}`, and the bar:

```tsx
      <BottomActionBar
        hidden={isShopOpen}
        onOpenShop={openShop}
        onNextDay={handleNextDay}
        isProcessing={isProcessing}
        canAdvanceProductively={canAdvance}
      />
```

In `src/components/BottomActionBar.tsx`, rename the prop `onToggleShop` → `onOpenShop` (interface, destructuring, and the button's `onClick`).

- [ ] **Step 4: Update `tests/components/BottomActionBar.test.tsx`** — rename `onToggleShop` to `onOpenShop` in the base props (line 6) and the "calls onToggleShop and onNextDay" test (lines 19-24).

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run tests/components/BottomActionBar.test.tsx tests/components/GameBoard.test.tsx`

- [ ] **Step 6: Commit**

```bash
git add src/components/GameBoard.tsx src/components/BottomActionBar.tsx tests/components/BottomActionBar.test.tsx tests/components/GameBoard.test.tsx
git commit -m "fix(shop): explicit open/close semantics kill the sheet self-close race (017 FR-004)"
```

---

### Task 16: Buy-radishes progress line (FR-005)

**Files:**
- Modify: `src/hooks/useOnboarding.ts:25-29` (export `emptyPlotCount`), `src/components/OnboardingOverlay.tsx` (new prop + render), `src/components/GameBoard.tsx:282-292` (pass prop)
- Test: `tests/components/OnboardingOverlay.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

```tsx
it('shows buy progress during the buy-radishes step (017 FR-005)', () => {
  render(
    <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
      buyProgress={{ owned: 2, needed: 4 }}
      onStart={() => {}} onSkip={() => {}} onDismissPayoff={() => {}} />,
  );
  expect(screen.getByText('2 of 4 bought')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL (prop does not exist)**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx -t "buy progress"`

- [ ] **Step 3: Export the plot counter**

In `src/hooks/useOnboarding.ts`, change the function's declaration to an export (JSDoc stays):

```ts
/** Count of unlocked, plantable (empty / not pest / not exhausted) plots. */
export function emptyPlotCount(state: GameState): number {
```

- [ ] **Step 4: Add the prop and render it in `OnboardingOverlay`**

In the `Props` interface:

```ts
  /** Seed-buying progress for the buy-radishes step: how many bought of how many needed. */
  buyProgress?: { owned: number; needed: number } | null;
```

Destructure `buyProgress = null` in the component signature. Inside the anchored-bubble block, under the copy paragraph:

```tsx
            <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">{anchor.copy}</p>
            {step === 'buy-radishes' && buyProgress && (
              <p className="font-pixel text-[10px] text-farm-gold mt-1">
                {buyProgress.owned} of {buyProgress.needed} bought
              </p>
            )}
```

- [ ] **Step 5: Pass it from `GameBoard`**

Add the import:

```ts
import { useOnboarding } from '../hooks/useOnboarding';
import { emptyPlotCount } from '../hooks/useOnboarding';
```

(or merge into one import), and extend the overlay render:

```tsx
        <OnboardingOverlay
          step={onboarding.step}
          harvestIncome={getHarvestIncome(state)}
          netIncome={getNetIncome(state)}
          isShopOpen={isShopOpen}
          buyProgress={
            onboarding.step === 'buy-radishes'
              ? { owned: state.seedInventory.radish, needed: Math.max(1, emptyPlotCount(state)) }
              : null
          }
          onStart={onboarding.onStart}
          onSkip={onboarding.onSkip}
          onDismissPayoff={onboarding.onDismissPayoff}
        />
```

- [ ] **Step 6: Run — expect PASS**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx tests/components/GameBoard.test.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useOnboarding.ts src/components/OnboardingOverlay.tsx src/components/GameBoard.tsx tests/components/OnboardingOverlay.test.tsx
git commit -m "feat(onboarding): live buy progress in the radish step (017 FR-005)"
```

---

### Task 17: Full verification sweep (SC-001 … SC-009)

**Files:** none (verification only; fix regressions where found)

- [ ] **Step 1: Full suite + lint**

Run: `npm test && npm run lint`
Expected: all green. Fix any straggler assertions on changed copy (`Plant seeds first`, `X / Y target`, `Nd remaining`, `became exhausted`, `advance anyway`, `onToggleShop`).

- [ ] **Step 2: Manual browser pass — fresh-save mobile tutorial (SC-001, SC-002)**

Start the dev server, viewport 375×812, `localStorage.clear()`, reload. Play the full tutorial by tapping only. Verify at each step: bubble + ring fully on screen (especially after the sheet opens on the buy step); Skip chip sits above the bottom bar and overlaps nothing; the buy step shows "N of 4 bought"; the sheet never closes by itself. Repeat once with `prefers-reduced-motion` emulated (spec edge case).

- [ ] **Step 3: Manual browser pass — economy legibility (SC-003, SC-009)**

Desktop 1280×800. Day 1 summary must read `Tax (6% of N🪙 savings)` with the explainer paragraph, and the shown tax must equal `floor(0.06 × N)`. HUD shows `🪙 130` over `GOAL 105 BY DAY 20` with no green success styling; at 375px the chip reads `GOAL 105·D20`.

- [ ] **Step 4: Manual browser pass — guardrails (SC-004, SC-005, SC-006)**

Tap an empty plot with no seed selected → hint appears (and the sheet opens on mobile). Exhaust plots (harvest radishes 3 days running): summary shows the amber "plots need rest" callout; a 1-day-left plot says "Ready tomorrow" with no fertilizer solicitation. Skip days with nothing planted: the confirm states lease + tax; once balance approaches ruin, the confirm re-fires even after an earlier confirmation; drop below 4🪙 with nothing growing → the unwinnable banner appears and its restart needs two taps.

- [ ] **Step 5: Manual browser pass — disasters (SC-007)**

In the dev console stub `Math.random = () => 0.07` and advance with ≥2 crops growing, then restore. The banner must list every destroyed plot and match the pest-damaged cards on the board; the modal must not say "Quiet day".

- [ ] **Step 6: Manual browser pass — plot-card fit (SC-008)**

375×812 and 390×844: run the Task 7 Step 6 measurement snippet against a growing card with the drought marker, an exhausted card in both copy states, and the pest card. Expected `ok: true` everywhere, no horizontal scroll.

- [ ] **Step 7: Commit any verification fixes**

```bash
git add -A && git commit -m "test(017): verification sweep fixes"
```

(Skip the commit if the sweep found nothing.)
