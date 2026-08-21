# 023 — Analytics Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the analytics gaps found in the 2026-08-20 coverage audit — enrich two events, add four state-derived lifecycle events, provision three dashboards, retire one.

**Architecture:** All emission stays in the existing render-diff hook `src/analytics/useAnalyticsEvents.ts`, which compares the previous and current `GameState` on every commit and calls `track()`. No engine changes, no new component call sites, no new files in `src/`. Property shaping for `day_completed` lives in the pure builder `buildDayCompletedProps` in `src/analytics/events.ts`, which is unit-testable without React. Dashboards are provisioned through the PostHog MCP against EU project 216788.

**Tech Stack:** TypeScript ~5.6, React 18.3, Vitest + jsdom + @testing-library/react, `posthog-js` (mocked in tests), PostHog MCP (`exec` CLI).

**Spec:** [spec.md](spec.md)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/analytics/events.ts` | Modify | `EventPropsMap` (event → property types), `EVENT_VERSIONS`, pure prop builders |
| `src/analytics/useAnalyticsEvents.ts` | Modify | All state-derived detectors; one small function per event |
| `src/App.tsx:63` | Modify | Drop the unused second argument to `useAnalyticsEvents` |
| `tests/analytics/events.test.ts` | Modify | Builder unit tests; `makeLog` helper |
| `tests/analytics/useAnalyticsEvents.test.tsx` | Modify | Detector tests; `makeLog` helper |
| `tests/analytics/farmEvents.test.tsx` | Modify | `makeLog` helper + call-site signature |

No new source files. The hook is ~190 lines and gains four ~10-line detectors; it stays within the one-function-per-event structure it already uses.

### Conventions to follow

- Every detector is a module-level function taking `(prev, state, ...guards)` and returning `void`.
- Detectors are called from the single `useEffect` in `useAnalyticsEvents`, in the order listed there.
- Event property names are `snake_case`; TypeScript fields elsewhere are `camelCase`.
- Adding properties to an existing event bumps that event's entry in `EVENT_VERSIONS`. `ANALYTICS_SCHEMA_VERSION` stays `1`.

### Two traps specific to this codebase

1. **Test files are not typechecked.** `tsconfig.app.json` sets `"exclude": ["tests"]`, so `npm run build` will not catch a malformed test fixture. The three analytics `makeLog` helpers are currently missing the required `pestPlotsAtRisk` field and get away with it. Task 1 fixes them, because the new code reads that field at runtime and would otherwise emit `undefined`.
2. **`buildDayCompletedProps` is asserted with an exact `toEqual`.** Adding properties breaks that test by design. Task 1 updates it in the same commit.

---

## Task 1: Enrich `day_completed` with ten curated properties

**Files:**
- Modify: `src/analytics/events.ts`
- Test: `tests/analytics/events.test.ts`

- [ ] **Step 1: Fix the `makeLog` helper so it satisfies `DailyLogEntry`**

In `tests/analytics/events.test.ts`, add the missing required field and the optional 022 fields to the helper's defaults:

```ts
function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 3,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests: [{ cropId: 'radish', baseYield: 4, weatherMultiplier: 1, adjustedYield: 4 }],
    totalHarvestIncome: 12,
    openingBalance: 100,
    landLeaseDeducted: 5,
    taxRate: 0.06,
    taxDeducted: 7,
    netChange: 0,
    closingBalance: 100,
    exhaustedPlots: [2],
    pestDestroyedPlots: [],
    pestPlotsAtRisk: 0,
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 1,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    buildingsApplied: [],
    ...over,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Replace the existing `describe('buildDayCompletedProps', ...)` block in `tests/analytics/events.test.ts` with:

```ts
describe('buildDayCompletedProps', () => {
  it('maps DailyLogEntry fields to snake_case counts', () => {
    const props = buildDayCompletedProps(makeLog(), 1, 'playing');
    expect(props).toEqual({
      day: 3,
      season_number: 1,
      weather_id: 'sunny',
      harvest_count: 1,
      net_change: 0,
      tax_deducted: 7,
      lease_deducted: 5,
      exhausted_plot_count: 1,
      phase_after: 'playing',
      streak_after: 1,
      streak_bonus: 0,
      pest_destroyed_count: 0,
      pest_plots_at_risk: 0,
      flash_drought_days_after: 0,
      market_event_kind: null,
      market_crop_id: null,
      buildings_applied: [],
      event_buff_count: 0,
      contract_active: false,
    });
  });

  it('surfaces disaster, market, building and 022 system state', () => {
    const props = buildDayCompletedProps(
      makeLog({
        pestDestroyedPlots: [0, 3],
        pestPlotsAtRisk: 4,
        flashDroughtDaysAfter: 2,
        streakAfter: 3,
        streakBonus: 15,
        marketActive: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.5, daysRemaining: 2 },
        buildingsApplied: ['irrigation_well'],
        eventBuffsApplied: [{ eventId: 'bountiful_spring', multiplier: 1.25, harvestsAffected: 2 }],
        contractProgress: { cropId: 'radish', done: 1, total: 3, deadlineDay: 9 },
      }),
      2,
      'playing',
    );
    expect(props).toMatchObject({
      pest_destroyed_count: 2,
      pest_plots_at_risk: 4,
      flash_drought_days_after: 2,
      streak_after: 3,
      streak_bonus: 15,
      market_event_kind: 'shortage',
      market_crop_id: 'pumpkin',
      buildings_applied: ['irrigation_well'],
      event_buff_count: 1,
      contract_active: true,
    });
  });

  it('treats absent optional 022 fields as empty rather than undefined', () => {
    const props = buildDayCompletedProps(makeLog({ eventBuffsApplied: undefined, contractProgress: undefined }), 1, 'playing');
    expect(props.event_buff_count).toBe(0);
    expect(props.contract_active).toBe(false);
  });
});
```

Also extend the schema test in the same file:

```ts
  it('versions the 023 enriched events', () => {
    expect(EVENT_VERSIONS.day_completed).toBe(2);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: FAIL — the exact-`toEqual` case reports the ten missing properties, and `EVENT_VERSIONS.day_completed` is `1`, not `2`.

- [ ] **Step 4: Widen the event type**

In `src/analytics/events.ts`, extend the import to pull the two new types (`BuildingId`, `MarketEventKind`) and `CropId`:

```ts
import type {
  BuildingId,
  CropId,
  DailyLogEntry,
  FarmEventChoiceId,
  FarmEventId,
  GameState,
  MarketEventKind,
  WeatherId,
} from '../engine/types';
```

Replace the `day_completed` entry in `EventPropsMap` with:

```ts
  day_completed: {
    day: number;
    season_number: number;
    weather_id: WeatherId;
    harvest_count: number;
    net_change: number;
    tax_deducted: number;
    lease_deducted: number;
    exhausted_plot_count: number;
    phase_after: GameState['phase'];
    /** 023 — 008 harvest streak. */
    streak_after: number;
    streak_bonus: number;
    /** 023 — 003 disasters. */
    pest_destroyed_count: number;
    pest_plots_at_risk: number;
    flash_drought_days_after: number;
    /** 023 — 012 market events. */
    market_event_kind: MarketEventKind | null;
    market_crop_id: CropId | null;
    /** 023 — 019 building effect, not just purchase. */
    buildings_applied: BuildingId[];
    /** 023 — 022 buff uptake and contract pressure. */
    event_buff_count: number;
    contract_active: boolean;
  };
```

- [ ] **Step 5: Extend the builder**

Replace `buildDayCompletedProps` in `src/analytics/events.ts` with:

```ts
export function buildDayCompletedProps(
  log: DailyLogEntry,
  seasonNumber: number,
  phaseAfter: GameState['phase'],
): EventPropsMap['day_completed'] {
  return {
    day: log.day,
    season_number: seasonNumber,
    weather_id: log.weatherId,
    harvest_count: log.harvests.length,
    net_change: log.netChange,
    tax_deducted: log.taxDeducted,
    lease_deducted: log.landLeaseDeducted,
    exhausted_plot_count: log.exhaustedPlots.length,
    phase_after: phaseAfter,
    streak_after: log.streakAfter,
    streak_bonus: log.streakBonus,
    pest_destroyed_count: log.pestDestroyedPlots.length,
    pest_plots_at_risk: log.pestPlotsAtRisk,
    flash_drought_days_after: log.flashDroughtDaysAfter,
    market_event_kind: log.marketActive?.kind ?? null,
    market_crop_id: log.marketActive?.cropId ?? null,
    buildings_applied: log.buildingsApplied,
    event_buff_count: log.eventBuffsApplied?.length ?? 0,
    contract_active: log.contractProgress != null,
  };
}
```

- [ ] **Step 6: Bump the event version**

In `EVENT_VERSIONS`, change `day_completed: 1,` to `day_completed: 2,`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: PASS, all cases.

- [ ] **Step 8: Fix the other two `makeLog` helpers**

`tests/analytics/useAnalyticsEvents.test.tsx` and `tests/analytics/farmEvents.test.tsx` each define their own `makeLog` missing `pestPlotsAtRisk`. Add `pestPlotsAtRisk: 0,` immediately after the `pestDestroyedPlots: [],` line in both.

- [ ] **Step 9: Run the full analytics suite**

Run: `npx vitest run tests/analytics`
Expected: PASS. Existing `day_completed` assertions use `expect.objectContaining`, so the widened bag does not break them.

- [ ] **Step 10: Commit**

```bash
git add src/analytics/events.ts tests/analytics/
git commit -m "feat(analytics): enrich day_completed with disaster, market, streak and building props (023)"
```

---

## Task 2: Add `day` and `season_number` to `plot_unlocked`

**Files:**
- Modify: `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`, `tests/analytics/events.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/analytics/useAnalyticsEvents.test.tsx`, inside `describe('useAnalyticsEvents plot_unlocked + first-plot milestone', ...)`, add:

```ts
  it('carries the run day and season on plot_unlocked', () => {
    const base = { ...initialGameState(), currentDay: 6 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();

    rerender({ state: buyPlotOrThrow(base) });

    const plotCall = track.mock.calls.find(([n]) => n === 'plot_unlocked');
    expect(plotCall![1]).toMatchObject({ day: 6, season_number: 1 });
  });
```

And in `tests/analytics/events.test.ts`, extend the 023 version test:

```ts
    expect(EVENT_VERSIONS.plot_unlocked).toBe(2);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.ts tests/analytics/events.test.ts`
Expected: FAIL — `day` and `season_number` are undefined on the call, and `plot_unlocked` is version 1.

- [ ] **Step 3: Widen the event type**

In `src/analytics/events.ts`, replace the `plot_unlocked` entry:

```ts
  plot_unlocked: {
    unlocked_plots_after: number;
    price: number;
    coin_balance_after: number;
    /** 023 — restores the "median day of first plot unlock" KPI. */
    day: number;
    season_number: number;
  };
```

And bump `plot_unlocked: 1,` to `plot_unlocked: 2,` in `EVENT_VERSIONS`.

- [ ] **Step 4: Emit the new properties**

In `src/analytics/useAnalyticsEvents.ts`, replace the `track('plot_unlocked', ...)` call inside `detectPlotUnlocked` with:

```ts
  track('plot_unlocked', {
    unlocked_plots_after: state.unlockedPlots,
    price,
    coin_balance_after: state.coinBalance,
    day: state.currentDay,
    season_number: getSeasonForDay(state.currentDay).number,
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/analytics`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/events.ts src/analytics/useAnalyticsEvents.ts tests/analytics/
git commit -m "feat(analytics): add day and season_number to plot_unlocked (023)"
```

---

## Task 3: `endless_mode_entered`

**Files:**
- Modify: `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics/useAnalyticsEvents.test.tsx`:

```ts
describe('useAnalyticsEvents endless_mode_entered', () => {
  it('fires once when the player continues past the season 4 victory', () => {
    // Day 70 is in season 4 — seasons run ~24 days, so a season-4 win cannot
    // happen earlier. Verify with getSeasonForDay if the season table changes.
    const base = { ...initialGameState(), currentDay: 70, phase: 'season_4_won' } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();

    const continued: GameState = { ...base, phase: 'playing', endlessMode: true, currentDay: 71, coinBalance: 500 };
    rerender({ state: continued });

    expect(track).toHaveBeenCalledWith(
      'endless_mode_entered',
      expect.objectContaining({ day: 71, season_number: 4, coin_balance: 500 }),
    );

    track.mockClear();
    rerender({ state: { ...continued, currentDay: 72 } });
    expect(track).not.toHaveBeenCalledWith('endless_mode_entered', expect.anything());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t endless`
Expected: FAIL — `endless_mode_entered` is never called.

- [ ] **Step 3: Declare the event**

In `src/analytics/events.ts`, add to `EventPropsMap`:

```ts
  /** 023 — the player chose to keep farming after winning season 4. */
  endless_mode_entered: { day: number; season_number: number; coin_balance: number };
```

And to `EVENT_VERSIONS`:

```ts
  endless_mode_entered: 1,
```

- [ ] **Step 4: Add the detector**

In `src/analytics/useAnalyticsEvents.ts`, add above `useAnalyticsEvents`:

```ts
/** endless_mode_entered — the one-way flip set by endRunVictory's "Continue".
 *  Self-resetting: a new run returns endlessMode to false, so no guard is needed. */
function detectEndlessMode(prev: GameState, state: GameState): void {
  if (prev.endlessMode || !state.endlessMode) return;
  track('endless_mode_entered', {
    day: state.currentDay,
    season_number: getSeasonForDay(state.currentDay).number,
    coin_balance: state.coinBalance,
  });
}
```

Then call it in the effect, after `detectSeasonCompleted(prev, state);`:

```ts
    detectEndlessMode(prev, state);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t endless`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/events.ts src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): track endless mode entry (023)"
```

---

## Task 4: `run_abandoned`

Read the spec's warning before starting: every property comes from `prev`, because by the time the reset is visible the current state is already a fresh day-1 run. Reading `state` here would emit an identical day-1 abandon for every run and look plausible while being wrong.

**Files:**
- Modify: `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/analytics/useAnalyticsEvents.test.tsx`:

```ts
describe('useAnalyticsEvents run_abandoned', () => {
  it('fires with the outgoing run values when a playable run is restarted', () => {
    const mid = { ...initialGameState(), currentDay: 12, coinBalance: 240 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: mid },
    });
    track.mockClear();

    rerender({ state: initialGameState() });

    expect(track).toHaveBeenCalledWith(
      'run_abandoned',
      expect.objectContaining({ days_played: 12, coin_balance: 240, season_number: 1 }),
    );
  });

  it('does not fire when restarting after the run already ended', () => {
    const dead = { ...initialGameState(), currentDay: 9, phase: 'bankrupt' } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: dead },
    });
    track.mockClear();

    rerender({ state: initialGameState() });

    expect(track).not.toHaveBeenCalledWith('run_abandoned', expect.anything());
  });

  it('does not fire when a season advances mid-run', () => {
    const base = { ...initialGameState(), currentDay: 7 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();

    rerender({ state: { ...base, currentDay: 8 } });

    expect(track).not.toHaveBeenCalledWith('run_abandoned', expect.anything());
  });
});
```

`season_number: 1` in the first case is the season containing day 12 — seasons run roughly 24 days, so day 12 is still season 1. Re-confirm against `getSeasonForDay` if the season table ever changes.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t run_abandoned`
Expected: FAIL on the first case — `run_abandoned` is never called. The two negative cases pass trivially.

- [ ] **Step 3: Declare the event**

In `src/analytics/events.ts`, add to `EventPropsMap`:

```ts
  /** 023 — a still-playable run was restarted. Properties describe the OUTGOING run. */
  run_abandoned: { days_played: number; season_number: number; coin_balance: number };
```

And to `EVENT_VERSIONS`:

```ts
  run_abandoned: 1,
```

- [ ] **Step 4: Emit inside the existing reset branch**

In `src/analytics/useAnalyticsEvents.ts`, replace the new-run reset block inside `detectRunLifecycle` with:

```ts
  // New-run reset — a fresh initialGameState (day 1, playing) starts a new run.
  if (state.phase === 'playing' && state.currentDay === 1 && prev.currentDay !== 1) {
    // A still-playable outgoing run means the player quit rather than finished;
    // a terminal prev.phase is the ordinary restart after run_ended. Read prev:
    // `state` is already the fresh day-1 run.
    if (prev.phase === 'playing') {
      track('run_abandoned', {
        days_played: prev.currentDay,
        season_number: getSeasonForDay(prev.currentDay).number,
        coin_balance: prev.coinBalance,
      });
    }
    firedMilestones.clear();
    runEndedFired.current = false;
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t run_abandoned`
Expected: PASS, all three cases.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/events.ts src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): track mid-run abandons (023)"
```

---

## Task 5: `first_plant_placed`

**Files:**
- Modify: `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/analytics/useAnalyticsEvents.test.tsx`:

```ts
describe('useAnalyticsEvents first_plant_placed', () => {
  function withPlantedPlot(state: GameState, cropId: 'radish' | 'parsnip' | 'pumpkin'): GameState {
    const plots = state.plots.map((p, i) =>
      i === 0 ? { ...p, cropId, dayPlanted: state.currentDay, daysRemaining: 3 } : p,
    );
    return { ...state, plots };
  }

  it('fires once for the first plant of a run', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    rerender({ state: withPlantedPlot(base, 'radish') });

    expect(track).toHaveBeenCalledWith('first_plant_placed', { day: 1, crop_id: 'radish' });
  });

  it('does not fire again for later plants in the same run', () => {
    const base = initialGameState();
    const planted = withPlantedPlot(base, 'radish');
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    rerender({ state: planted });
    track.mockClear();

    const second = { ...planted, plots: planted.plots.map((p, i) => (i === 1 ? { ...p, cropId: 'parsnip' as const, dayPlanted: 1, daysRemaining: 4 } : p)) };
    rerender({ state: second });

    expect(track).not.toHaveBeenCalledWith('first_plant_placed', expect.anything());
  });

  it('re-arms after a new run starts', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    rerender({ state: { ...withPlantedPlot(base, 'radish'), currentDay: 5 } });
    rerender({ state: initialGameState() });
    track.mockClear();

    rerender({ state: withPlantedPlot(initialGameState(), 'pumpkin') });

    expect(track).toHaveBeenCalledWith('first_plant_placed', { day: 1, crop_id: 'pumpkin' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t first_plant_placed`
Expected: FAIL — `first_plant_placed` is never called.

- [ ] **Step 3: Declare the event**

In `src/analytics/events.ts`, add to `EventPropsMap`:

```ts
  /** 023 — activation funnel: first seed in the ground this run. */
  first_plant_placed: { day: number; crop_id: CropId };
```

And to `EVENT_VERSIONS`:

```ts
  first_plant_placed: 1,
```

- [ ] **Step 4: Add the per-run guard holder**

In `src/analytics/useAnalyticsEvents.ts`, add next to the existing `RunEndedGuard` interface:

```ts
/** Once-per-run guards for the activation "firsts". Reset by detectRunLifecycle. */
interface RunFirsts {
  plant: boolean;
  harvest: boolean;
}
```

- [ ] **Step 5: Add the detector**

```ts
/** first_plant_placed — the first plot to go from empty to planted this run. */
function detectFirstPlant(prev: GameState, state: GameState, firsts: RunFirsts): void {
  if (firsts.plant) return;
  for (let i = 0; i < state.plots.length; i += 1) {
    const after = state.plots[i];
    const before = prev.plots[i];
    if (after.cropId !== null && (before === undefined || before.cropId === null)) {
      firsts.plant = true;
      track('first_plant_placed', { day: state.currentDay, crop_id: after.cropId });
      return;
    }
  }
}
```

- [ ] **Step 6: Wire the ref, the reset, and the call**

Add the ref inside `useAnalyticsEvents`, beside the existing refs:

```ts
  const runFirstsRef = useRef<RunFirsts>({ plant: false, harvest: false });
```

Add the parameter to `detectRunLifecycle`'s signature (`firsts: RunFirsts`) and clear both flags in its reset branch, alongside the existing resets:

```ts
    firedMilestones.clear();
    runEndedFired.current = false;
    firsts.plant = false;
    firsts.harvest = false;
```

In the effect, pass the ref through and call the new detector **after** `detectRunLifecycle`, so a restart clears the guard before the new run's first plant can be seen:

```ts
    detectRunLifecycle(prev, state, firedMilestonesRef.current, runEndedFiredRef.current, runFirstsRef.current);
    detectShopPurchased(prev, state);
    detectFarmEvents(prev, state);
    detectFirstPlant(prev, state, runFirstsRef.current);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t first_plant_placed`
Expected: PASS, all three cases.

- [ ] **Step 8: Commit**

```bash
git add src/analytics/events.ts src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): track first plant of a run (023)"
```

---

## Task 6: `first_harvest_collected`

**Files:**
- Modify: `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/analytics/useAnalyticsEvents.test.tsx`:

```ts
describe('useAnalyticsEvents first_harvest_collected', () => {
  const harvest = { cropId: 'radish' as const, baseYield: 4, weatherMultiplier: 1, adjustedYield: 4 };

  it('fires on the first day whose log contains a harvest', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });

    // A harvestless day must not trigger it.
    rerender({ state: { ...base, currentDay: 2, lastDailyLog: makeLog(1) } });
    expect(track).not.toHaveBeenCalledWith('first_harvest_collected', expect.anything());

    const withHarvest = { ...makeLog(2), harvests: [harvest] };
    rerender({ state: { ...base, currentDay: 3, coinBalance: 130, lastDailyLog: withHarvest } });

    expect(track).toHaveBeenCalledWith('first_harvest_collected', {
      day: 2,
      coin_balance_after: 130,
      harvest_count: 1,
    });
  });

  it('does not fire on later harvest days in the same run', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    rerender({ state: { ...base, currentDay: 2, lastDailyLog: { ...makeLog(1), harvests: [harvest] } } });
    track.mockClear();

    rerender({ state: { ...base, currentDay: 3, lastDailyLog: { ...makeLog(2), harvests: [harvest] } } });

    expect(track).not.toHaveBeenCalledWith('first_harvest_collected', expect.anything());
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t first_harvest_collected`
Expected: FAIL — the event is never called.

- [ ] **Step 3: Declare the event**

In `src/analytics/events.ts`, add to `EventPropsMap`:

```ts
  /** 023 — activation funnel: the run's first harvest payout. */
  first_harvest_collected: { day: number; coin_balance_after: number; harvest_count: number };
```

And to `EVENT_VERSIONS`:

```ts
  first_harvest_collected: 1,
```

- [ ] **Step 4: Add the detector**

In `src/analytics/useAnalyticsEvents.ts`:

```ts
/** first_harvest_collected — the first new daily log this run that contains a harvest. */
function detectFirstHarvest(prev: GameState, state: GameState, firsts: RunFirsts): void {
  if (firsts.harvest) return;
  const log = state.lastDailyLog;
  if (log === null || log === prev.lastDailyLog || log.harvests.length === 0) return;
  firsts.harvest = true;
  track('first_harvest_collected', {
    day: log.day,
    coin_balance_after: state.coinBalance,
    harvest_count: log.harvests.length,
  });
}
```

Call it in the effect, immediately after `detectFirstPlant`:

```ts
    detectFirstHarvest(prev, state, runFirstsRef.current);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx -t first_harvest_collected`
Expected: PASS, both cases.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/events.ts src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): track first harvest of a run (023)"
```

---

## Task 7: Drop the dead `_endOfRunRecap` parameter

`useAnalyticsEvents` takes a second argument it never reads — leftover wiring from spec 007. `run_ended` derives the medal itself through `deriveMedal`.

**Files:**
- Modify: `src/analytics/useAnalyticsEvents.ts`, `src/App.tsx:63`
- Test: all `useAnalyticsEvents(` call sites under `tests/`

- [ ] **Step 1: Change the signature**

In `src/analytics/useAnalyticsEvents.ts`:

```ts
export function useAnalyticsEvents(state: GameState): void {
```

- [ ] **Step 2: Update the production call site**

In `src/App.tsx`, line 63:

```tsx
  useAnalyticsEvents(engine.state);
```

- [ ] **Step 3: Update every test call site**

Run: `grep -rn "useAnalyticsEvents(state, null)" tests/`
Replace each occurrence with `useAnalyticsEvents(state)`. There are 18 call sites across the analytics tests; a scripted edit is fine:

```bash
grep -rl "useAnalyticsEvents(state, null)" tests/ | xargs sed -i '' 's/useAnalyticsEvents(state, null)/useAnalyticsEvents(state)/g'
```

- [ ] **Step 4: Verify nothing still passes two arguments**

Run: `grep -rn "useAnalyticsEvents(.*," src/ tests/`
Expected: no output.

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run tests/analytics && npm run build`
Expected: PASS, then a successful build. The build is what proves `App.tsx` typechecks — tests are excluded from `tsc`.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/useAnalyticsEvents.ts src/App.tsx tests/
git commit -m "refactor(analytics): drop unused endOfRunRecap parameter (023)"
```

---

## Task 8: Full verification gate

**Files:** none modified.

- [ ] **Step 1: Run the whole suite**

Run: `npm test`
Expected: PASS. Baseline before this plan was 837 tests across 70 files; this plan adds roughly 12 cases, so expect ~849 passing and zero failures.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors. Seven pre-existing warnings in `src/components/HarvestCelebration.tsx` and `coverage/sorter.js` are expected and must not grow.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Confirm the event surface**

Run: `grep -c ": [0-9]," src/analytics/events.ts`
Expected: 21 — the 17 pre-existing events plus the four added here, all present in `EVENT_VERSIONS`.

- [ ] **Step 5: Commit any straggling fixes**

If steps 1–4 required changes, commit them:

```bash
git add -A
git commit -m "test(analytics): verification gate fixes (023)"
```

---

## Task 9: Provision the "Pixel Parsnips — Narrative Events" dashboard

This is the dashboard spec 022 scoped and never built. Everything below is PostHog MCP work against **EU project 216788**; no repository files change.

**MCP procedure** — the tool schemas are large and drift, so inspect before calling, per the server's own instructions:

```
exec: search insight-create
exec: info insight-create
exec: schema insight-create query
exec: info dashboard-create
```

- [ ] **Step 1: Confirm the events exist before building tiles**

Run: `exec: call read-data-schema {"query":{"kind":"events"}}`
Expected: `farm_event_fired`, `farm_event_choice`, `contract_completed` present. `contract_expired` will be **absent** — it has never fired in production. Build its tile anyway; the spec records this as expected, not as a defect.

- [ ] **Step 2: Create the dashboard**

Name: `Pixel Parsnips — Narrative Events`
Description: `Farm-event lifecycle: fires, choice split, auto-declines, contract funnel, season windows, and choice-to-outcome. Provisioned from spec 023-analytics-coverage (tiles specified in 022-narrative-events).`

- [ ] **Step 3: Create the six tiles**

| # | Tile name | Query |
|---|---|---|
| 1 | Event fires by id | Trends, `farm_event_fired` total count, breakdown `event_id`, last 90 days |
| 2 | Choice split A vs B | Trends, `farm_event_choice` total count, breakdown `choice`, last 90 days |
| 3 | Auto-decline rate | Trends, `farm_event_choice` total count, breakdown `auto`, last 90 days |
| 4 | Contract funnel | Funnel, `farm_event_fired` → `farm_event_choice` → `contract_completed`, 14-day window |
| 5 | Fires by season | Trends, `farm_event_fired` total count, breakdown `season`, last 90 days |
| 6 | Choice to outcome | Trends, `run_ended` total count, breakdown `outcome`, last 90 days, described as the comparison series for tile 2 |

Add each insight to the dashboard as it is created.

- [ ] **Step 4: Record the IDs in the spec**

Append the dashboard id and the six insight short-ids to the "Phase C" section of `specs/023-analytics-coverage/spec.md`, matching how 020 recorded id 834144.

- [ ] **Step 5: Commit the spec update**

```bash
git add specs/023-analytics-coverage/spec.md
git commit -m "docs(spec): record Narrative Events dashboard ids (023)"
```

---

## Task 10: Provision the "Pixel Parsnips — Economy & Systems" dashboard

Covers `shop_purchased` — the project's highest-volume event, with no tile anywhere today — plus the systems Task 1 unblocked.

- [ ] **Step 1: Confirm the enriched properties are arriving**

Only meaningful after Tasks 1–2 are deployed. Run:

```
exec: call read-data-schema {"query":{"kind":"event_properties","event_name":"day_completed"}}
```

Expected: `streak_after`, `pest_destroyed_count`, `market_event_kind`, `buildings_applied` and the rest are listed. If they are absent, the build has not shipped yet — provision tiles 5–8 anyway and note they stay empty until the next deploy.

- [ ] **Step 2: Create the dashboard**

Name: `Pixel Parsnips — Economy & Systems`
Description: `Shop and building economy plus the gameplay systems surfaced by day_completed v2: disasters, market events and harvest streaks. Provisioned from spec 023-analytics-coverage.`

- [ ] **Step 3: Create the eight tiles**

| # | Tile name | Query |
|---|---|---|
| 1 | Purchases over time | Trends, `shop_purchased` total count, breakdown `item_type`, last 90 days |
| 2 | Top items bought | Trends, `shop_purchased` total count, breakdown `item_id`, last 90 days |
| 3 | Building adoption | Trends, `shop_purchased` unique users, filtered `item_type = building`, breakdown `item_id`, last 90 days |
| 4 | Spend per purchase | Trends, `shop_purchased` median of `cost`, breakdown `item_type`, last 90 days |
| 5 | Disaster incidence | Trends, `day_completed` total count, filtered `pest_destroyed_count > 0`, last 90 days |
| 6 | Pest severity | Trends, `day_completed` median of `pest_destroyed_count`, filtered `pest_plots_at_risk > 0`, last 90 days |
| 7 | Market exposure | Trends, `day_completed` total count, breakdown `market_event_kind`, last 90 days |
| 8 | Streak health | Trends, `day_completed` median of `streak_after`, last 90 days |

- [ ] **Step 4: Record the IDs in the spec, then commit**

```bash
git add specs/023-analytics-coverage/spec.md
git commit -m "docs(spec): record Economy & Systems dashboard ids (023)"
```

---

## Task 11: Extend the "Pixel Parsnips — Core" dashboard (id 798528)

Two tiles are **updated in place** so their dashboard slots and existing links survive; two are new.

- [ ] **Step 1: Update the activation funnel in place**

Insight short-id `3Tcoqzoj` ("Activation funnel — loaded → started → milestone").
New funnel steps: `page_loaded` → `play_started` → `first_plant_placed` → `first_harvest_collected` → `day_completed`.
Rename to `Activation funnel — loaded → started → planted → harvested → day 1`.
Update the description to note that the three-step version was replaced in 023 and that pre-023 sessions cannot reach steps 3–4.

- [ ] **Step 2: Update expansion pacing in place**

Insight short-id `BYWNR0xz`. Change the aggregation to **median of `day`** on `plot_unlocked`, delivering the 017 KPI "median day of first plot unlock" directly. Remove the plots-reached proxy caveat from the description and note that only `event_version = 2` events carry `day`.

- [ ] **Step 3: Create the run-endings tile**

Name: `Run endings — completed vs abandoned`
Query: Trends, two series — `run_ended` total count broken down by `outcome`, and `run_abandoned` total count — last 90 days. Add to dashboard 798528.

- [ ] **Step 4: Create the endless-adoption tile**

Name: `Endless mode adoption`
Query: Trends, two series — `endless_mode_entered` total count, and `run_ended` total count filtered to `outcome = won` — last 90 days. The ratio is the share of winners who kept playing. Add to dashboard 798528.

- [ ] **Step 5: Record the IDs in the spec, then commit**

```bash
git add specs/023-analytics-coverage/spec.md
git commit -m "docs(spec): record Core dashboard extensions (023)"
```

---

## Task 12: Retire the starter dashboard

**This step is irreversible and must not be performed autonomously.**

- [ ] **Step 1: Confirm with the user**

Show what will be deleted: dashboard **795789**, "Your starter dashboard", whose tiles chart `$pageview`, autocapture and session data — all disabled in `track.ts`, so every tile renders empty. Ask for an explicit yes before continuing. If the user declines, stop here and leave the dashboard in place; the rest of the plan stands on its own.

- [ ] **Step 2: Delete it**

Only after an explicit yes, delete dashboard 795789 through the PostHog MCP.

- [ ] **Step 3: Note the outcome in the spec, then commit**

Record in Phase D whether it was deleted, and on what date, or that the user declined.

```bash
git add specs/023-analytics-coverage/spec.md
git commit -m "docs(spec): record starter dashboard retirement (023)"
```

---

## Task 13: Update the backlog

**Files:**
- Modify: `backlog.md`

- [ ] **Step 1: Add the A2 row**

In the "Backlog — Analytics & Instrumentation" table, add a row following the A0/A1 style:

```markdown
| A2 | ✅ **Coverage closure** — enriched `day_completed` (disasters, market, streak, buildings, 022 buffs) + `plot_unlocked` day/season, four lifecycle events (`endless_mode_entered`, `run_abandoned`, `first_plant_placed`, `first_harvest_collected`), Narrative Events + Economy & Systems dashboards, Core extensions | Medium | M | 2026-08-20 coverage audit → **shipped as [023-analytics-coverage](specs/023-analytics-coverage/spec.md)** | **DONE.** Closes the 022 "dashboard pending" item and gives every emitted event a tile. |
```

- [ ] **Step 2: Mark the 022 dashboard item resolved**

In the G11 row, replace `PostHog dashboard pending (main-session step).` with `PostHog dashboard shipped in [023-analytics-coverage](specs/023-analytics-coverage/spec.md).`

- [ ] **Step 3: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): record 023 analytics coverage as A2"
```

---

## Self-Review Notes (already applied)

- **Spec coverage.** Phase A → Tasks 1–2. Phase B → Tasks 3–6 plus the Task 7 cleanup. Phase C → Tasks 9–11. Phase D → Task 12. Testing section → Tasks 1–6 inline plus the Task 8 gate. Backlog upkeep → Task 13.
- **Spec correction made while planning.** `run_abandoned` originally carried `phase_before`, which the emit condition pins to `'playing'` — a constant property. Dropped from both spec and plan.
- **Type consistency.** `RunFirsts` is introduced in Task 5 and reused unchanged in Task 6. `detectRunLifecycle` gains its fifth parameter in Task 5, which is the same task that adds the ref, so no task references a signature that does not yet exist. Task 4 edits that function's body before Task 5 changes its signature — the tasks are ordered so this is safe when executed in sequence.
- **Ordering dependency.** `detectFirstPlant` and `detectFirstHarvest` must be called after `detectRunLifecycle` in the effect, so a restart clears the guards before the new run's first plant or harvest is evaluated. Both tasks state this.
- **Known limitation, carried from the spec.** Tiles cannot be validated against real traffic (~15 people, nearly all the developer). Tasks 9–11 provision them; proving them needs a seed pass.
