# Plot Progression & Economy Rebalance (010) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a buy-your-plots progression system (start with 4 plots, unlock up to 12 at escalating cost) and rebalance the crop/lease/tax/target numbers, with the final values tuned using the 009 simulator.

**Architecture:** All balance numbers already flow through `EconomyConfig` (009). 010 activates the dormant `startingPlots`/`maxPlots`/`plotPrices` fields, adds a single `unlockedPlots` scalar to `GameState` plus a pure `buyPlot` engine function, bumps the save schema 6→7 with a migration, extends the simulator to model plot-buying, tunes the numbers, then promotes the tuned config into `DEFAULT_ECONOMY` and wires a locked-plot UI.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind, Vitest. Builds on the 009 engine refactor and `scripts/sim/` simulator.

**Dependency:** Spec 009 must be fully implemented first. This plan assumes every engine function takes an optional trailing `config: EconomyConfig = DEFAULT_ECONOMY`, that `initialGameState(config)` builds `config.maxPlots` plots, and that `processTurn(state, weatherRoll?, pestOverride?, weatherRollOverride?, config?, rng?)` exists.

---

## File Structure

**Engine:**
- Modify `src/engine/types.ts` — add `unlockedPlots` to `GameState`; add `'plot_locked'` to `PlantResult`; add `BuyPlotResult`.
- Modify `src/engine/gameEngine.ts` — set `unlockedPlots` in `initialGameState`; lock guard in `plantSeed`; new `buyPlot`.
- Modify `src/engine/constants.ts` — bump `SCHEMA_VERSION` to 7; add `STARTING_PLOTS`, `PLOT_PRICES`; (in the promote task) rebalanced crop/tax numbers.
- Modify `src/engine/economy.ts` — (promote task) `DEFAULT_ECONOMY.startingPlots`/`plotPrices` + new `SEASON_TABLE` values.
- Modify `src/engine/useGameEngine.ts` — migration v6→v7; `buyPlot` action; `getNextPlotPrice` selector.

**Simulator:**
- Modify `scripts/sim/economyPresets.ts` — freeze `baseline` literal; add `proposed`.
- Modify `scripts/sim/strategies.ts` — `smartMixed` buys plots.
- Modify `scripts/sim/metrics.ts` — per-season clear-rate.
- Create `specs/010-plot-progression-rebalance/tuning-results.md` — recorded sim output.

**UI:**
- Modify `src/components/PlotCard.tsx` — `LockedPlot` branch.
- Modify `src/components/FarmGrid.tsx` — pass lock props.
- Modify `src/components/GameBoard.tsx` — wire `buyPlot`/price through.

**Tests:** add to `tests/engine/gameEngine.test.ts`, `tests/engine/useGameEngine.test.ts`, `tests/components/` (new `PlotCard.test.tsx` if absent), `tests/sim/strategies.test.ts`, `tests/sim/metrics.test.ts`.

---

## Task 1: `unlockedPlots` state + types + `initialGameState`

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('unlockedPlots', () => {
  it('initialGameState starts at config.startingPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12 };
    const s = initialGameState(custom);
    expect(s.unlockedPlots).toBe(4);
    expect(s.plots).toHaveLength(12); // array is full size; some locked
  });

  it('defaults to all plots unlocked under DEFAULT_ECONOMY', () => {
    expect(initialGameState().unlockedPlots).toBe(DEFAULT_ECONOMY.maxPlots);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "unlockedPlots"`
Expected: FAIL — `unlockedPlots` is `undefined`.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/types.ts`, add to the `GameState` interface (next to `plots`):

```ts
  /** Number of plots currently usable (indices 0..unlockedPlots-1). Plots beyond are locked. */
  unlockedPlots: number;
```

Add `'plot_locked'` to the `PlantResult` error union and add the new result type:

```ts
export type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'plot_pest_damaged' | 'plot_locked' | 'invalid_plot' };

export type BuyPlotResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'max_plots_reached' | 'insufficient_funds' };
```

In `src/engine/gameEngine.ts` `initialGameState`, add the field to the returned object:

```ts
    unlockedPlots: config.startingPlots,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "unlockedPlots"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(010): add unlockedPlots state field and plot result types"
```

---

## Task 2: `plantSeed` rejects locked plots

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('plantSeed locked plots', () => {
  it('returns plot_locked for an index >= unlockedPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12 };
    let s = initialGameState(custom);
    s = (buySeed(s, 'radish', 1, custom) as { state: typeof s }).state;
    const r = plantSeed(s, 5, 'radish', custom); // plot 5 is locked (only 0..3 unlocked)
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('plot_locked');
  });

  it('allows planting on an unlocked plot', () => {
    const custom = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12 };
    let s = initialGameState(custom);
    s = (buySeed(s, 'radish', 1, custom) as { state: typeof s }).state;
    const r = plantSeed(s, 0, 'radish', custom);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "plantSeed locked plots"`
Expected: FAIL — plot 5 plants successfully (no lock guard).

- [ ] **Step 3: Write minimal implementation**

In `plantSeed`, immediately after the existing `invalid_plot` bound check
(`if (plotId < 0 || plotId >= config.maxPlots) ...`), add:

```ts
  if (plotId >= state.unlockedPlots) {
    return { ok: false, error: 'plot_locked' };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "plantSeed locked plots"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(010): plantSeed rejects locked plots"
```

---

## Task 3: `buyPlot` engine function

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('buyPlot', () => {
  const cfg = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12, plotPrices: [40, 70, 110, 160, 220, 300, 400, 520] };

  it('unlocks the next plot at the configured price', () => {
    const s = { ...initialGameState(cfg), coinBalance: 1000 };
    const r = buyPlot(s, cfg);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.unlockedPlots).toBe(5);
      expect(r.state.coinBalance).toBe(960); // 1000 - 40 (first price)
    }
  });

  it('uses the next price in the escalating list', () => {
    const s = { ...initialGameState(cfg), coinBalance: 1000, unlockedPlots: 6 };
    const r = buyPlot(s, cfg);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(1000 - 110); // index 6-4 = 2 → 110
  });

  it('rejects when funds are insufficient', () => {
    const s = { ...initialGameState(cfg), coinBalance: 10 };
    const r = buyPlot(s, cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('insufficient_funds');
  });

  it('rejects when already at maxPlots', () => {
    const s = { ...initialGameState(cfg), coinBalance: 9999, unlockedPlots: 12 };
    const r = buyPlot(s, cfg);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('max_plots_reached');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "buyPlot"`
Expected: FAIL — `buyPlot` is not defined.

- [ ] **Step 3: Write minimal implementation**

Add `BuyPlotResult` to the type imports at the top of `gameEngine.ts`, then add:

```ts
// ── buyPlot ───────────────────────────────────────────────────────────────────

/** Unlocks the next farm plot at its escalating price. Pure — no mutations. */
export function buyPlot(state: GameState, config: EconomyConfig = DEFAULT_ECONOMY): BuyPlotResult {
  if (state.unlockedPlots >= config.maxPlots) {
    return { ok: false, error: 'max_plots_reached' };
  }
  const price = config.plotPrices[state.unlockedPlots - config.startingPlots];
  if (price === undefined || state.coinBalance < price) {
    return { ok: false, error: 'insufficient_funds' };
  }
  return {
    ok: true,
    state: {
      ...state,
      coinBalance: state.coinBalance - price,
      unlockedPlots: state.unlockedPlots + 1,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "buyPlot"`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(010): add buyPlot engine function"
```

---

## Task 4: Schema bump 6→7 + migration

**Files:**
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/engine/useGameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('v6 → v7 migration', () => {
  it('adds unlockedPlots = maxPlots to a v6 save (existing runs keep all plots)', () => {
    const v6Save = {
      schemaVersion: 6,
      state: {
        phase: 'playing', plots: new Array(12).fill(null).map((_, i) => ({
          id: i, cropId: null, dayPlanted: null, daysRemaining: null,
          consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
        })),
        currentDay: 5, coinBalance: 200, seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
        upgradeTier: 0, lastDailyLog: null, peakBalance: 200, fertilizerInventory: 0,
        flashDroughtDaysRemaining: 0, endlessMode: false, disastersSurvived: 0,
        harvestStreak: 0, peakHarvestStreak: 0, schemaVersion: 6,
      },
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify(v6Save));
    const loaded = loadStateForTest(); // see note
    expect(loaded.unlockedPlots).toBe(12);
    expect(loaded.schemaVersion).toBe(7);
  });
});
```

Note: `loadState` is module-private. Either export it from `useGameEngine.ts` for testing,
or assert via the hook with `renderHook(() => useGameEngine())` and read `result.current.state.unlockedPlots`. Pick whichever matches the existing `useGameEngine.test.ts` style; if that file already renders the hook, reuse that pattern and drop the `loadStateForTest` helper.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "v6 → v7"`
Expected: FAIL — `unlockedPlots` undefined / schema still 6.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/constants.ts`, change:

```ts
export const SCHEMA_VERSION = 7;
```

In `src/engine/useGameEngine.ts` `migrateState`, replace the schema-6 "current" branch
with a v6→v7 migration and add a v7 "current" branch. Also add `unlockedPlots` to the
older chained branches so any old save funnels to a complete v7 shape:

```ts
  // Schema 7 — current
  if (parsed.schemaVersion === SCHEMA_VERSION && isGameStateShape(parsed.state)) {
    return parsed.state as unknown as GameState;
  }

  // Schema 6 → 7 — add unlockedPlots (existing runs keep all plots unlocked)
  if (parsed.schemaVersion === 6 && isGameStateShape(parsed.state)) {
    console.info('[PixelParsnips] Migrating save from v6 to v7 (Plot Progression).');
    const st = parsed.state as Record<string, unknown>;
    return {
      ...(st as unknown as Omit<GameState, 'unlockedPlots'>),
      schemaVersion: SCHEMA_VERSION,
      unlockedPlots: Array.isArray(st.plots) ? st.plots.length : DEFAULT_ECONOMY.maxPlots,
    };
  }
```

For the existing 5→, 4→, 3→ branches, add `unlockedPlots: DEFAULT_ECONOMY.maxPlots,` to
each returned object (right next to `schemaVersion: SCHEMA_VERSION,`). Add the import:

```ts
import { DEFAULT_ECONOMY } from './economy';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/useGameEngine.test.ts`
Expected: PASS (new migration test + existing migration tests).

- [ ] **Step 5: Run full engine suite**

Run: `npx vitest run tests/engine`
Expected: green. (`initialGameState` now stamps schema 7; any test asserting schema 6 must be updated to 7 — fix those assertions to `7` if present.)

- [ ] **Step 6: Commit**

```bash
git add src/engine/constants.ts src/engine/useGameEngine.ts tests/engine/useGameEngine.test.ts
git commit -m "feat(010): bump schema to 7 with v6→v7 plot-progression migration"
```

---

## Task 5: Simulator presets — freeze `baseline`, add `proposed`

**Files:**
- Modify: `scripts/sim/economyPresets.ts`
- Test: `tests/sim/runner.test.ts` (the 009 baseline characterization must still pass)

- [ ] **Step 1: Rewrite the presets module**

Freeze `baseline` as an explicit literal (so promoting the live numbers later does not
move the comparison point), and add the `proposed` literal with plot progression and the
starting rebalanced numbers. These numbers are a **starting point** — Task 8 tunes them.

```ts
// scripts/sim/economyPresets.ts
import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';

/** Frozen snapshot of the original (pre-010) live economy — the comparison baseline. */
export const baseline: EconomyConfig = {
  ...DEFAULT_ECONOMY,
  startingPlots: 12,
  maxPlots: 12,
  plotPrices: [],
  taxRate: 0.05,
  crops: {
    radish:  { id: 'radish',  name: 'Radish',  growthDays: 1, baseSeedCost: 5,  baseYield: 12 },
    parsnip: { id: 'parsnip', name: 'Parsnip', growthDays: 2, baseSeedCost: 10, baseYield: 28 },
    pumpkin: { id: 'pumpkin', name: 'Pumpkin', growthDays: 3, baseSeedCost: 20, baseYield: 65 },
  },
  seasons: [
    { number: 1, name: 'Spring Thaw',     startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 150 },
    { number: 2, name: 'Summer Heat',     startDay: 21, endDay: 40, leasePerDay: 20, disasterTotalPct: 0.20, target: 250 },
    { number: 3, name: 'Autumn Pressure', startDay: 41, endDay: 60, leasePerDay: 25, disasterTotalPct: 0.28, target: 400 },
    { number: 4, name: 'Winter Crunch',   startDay: 61, endDay: 80, leasePerDay: 30, disasterTotalPct: 0.35, target: 600 },
  ],
};

/** Candidate 010 economy — plot progression + compressed margins. TUNED in Task 8. */
export const proposed: EconomyConfig = {
  ...baseline,
  startingPlots: 4,
  maxPlots: 12,
  plotPrices: [40, 70, 110, 160, 220, 300, 400, 520],
  taxRate: 0.06,
  crops: {
    radish:  { id: 'radish',  name: 'Radish',  growthDays: 1, baseSeedCost: 5,  baseYield: 9  },
    parsnip: { id: 'parsnip', name: 'Parsnip', growthDays: 2, baseSeedCost: 11, baseYield: 24 },
    pumpkin: { id: 'pumpkin', name: 'Pumpkin', growthDays: 3, baseSeedCost: 22, baseYield: 55 },
  },
  seasons: [
    { number: 1, name: 'Spring Thaw',     startDay:  1, endDay: 20, leasePerDay: 18, disasterTotalPct: 0.15, target: 180 },
    { number: 2, name: 'Summer Heat',     startDay: 21, endDay: 40, leasePerDay: 26, disasterTotalPct: 0.20, target: 400 },
    { number: 3, name: 'Autumn Pressure', startDay: 41, endDay: 60, leasePerDay: 36, disasterTotalPct: 0.28, target: 700 },
    { number: 4, name: 'Winter Crunch',   startDay: 61, endDay: 80, leasePerDay: 48, disasterTotalPct: 0.35, target: 1100 },
  ],
};

export const PRESETS: Record<string, EconomyConfig> = { baseline, proposed };
```

- [ ] **Step 2: Verify the 009 baseline characterization still passes**

Run: `npx vitest run tests/sim/runner.test.ts -t "baseline difficulty smoke"`
Expected: PASS — `baseline` still reproduces ~97% win / ~4x overshoot (the frozen literal equals the original numbers).

- [ ] **Step 3: Commit**

```bash
git add scripts/sim/economyPresets.ts
git commit -m "feat(010): freeze baseline preset, add proposed economy preset"
```

---

## Task 6: `smartMixed` buys plots

**Files:**
- Modify: `scripts/sim/strategies.ts`
- Test: `tests/sim/strategies.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buyPlot as _b } from '../../src/engine/gameEngine'; // ensure buyPlot exists
import { proposed } from '../../scripts/sim/economyPresets';

describe('smartMixed plot buying', () => {
  it('buys a plot when flush with cash and the board is full', () => {
    // Start from proposed (4 plots), give lots of coins, fill the 4 plots first.
    let s = { ...initialGameState(proposed), coinBalance: 2000 };
    s = STRATEGIES.smartMixed(s, proposed);
    expect(s.unlockedPlots).toBeGreaterThan(4); // expanded beyond the starting 4
  });

  it('does not buy plots in the baseline (no plots to buy)', () => {
    const s = STRATEGIES.smartMixed(initialGameState(), DEFAULT_ECONOMY);
    expect(s.unlockedPlots).toBe(DEFAULT_ECONOMY.maxPlots);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/strategies.test.ts -t "smartMixed plot buying"`
Expected: FAIL — `unlockedPlots` stays 4.

- [ ] **Step 3: Write minimal implementation**

In `scripts/sim/strategies.ts`, import `buyPlot` and add a plot-buying helper, then call it
inside `smartMixed` before filling the board:

```ts
import {
  buySeed, plantSeed, buyUpgrade, buyPlot, computeSeedCost,
} from '../../src/engine/gameEngine';
```

```ts
/** Buy plots while the board is fully utilized and we can afford the next plot
 *  with a healthy buffer (don't spend the lease cushion on land). */
function maybeBuyPlots(state: GameState, config: EconomyConfig): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  while (s.unlockedPlots < config.maxPlots) {
    const boardFull = s.plots
      .slice(0, s.unlockedPlots)
      .every(p => p.cropId !== null || p.exhaustedSinceDay !== null || p.pestDamaged);
    if (!boardFull) break;
    const price = config.plotPrices[s.unlockedPlots - config.startingPlots];
    if (price === undefined || s.coinBalance - price < lease * 2) break;
    const r = buyPlot(s, config);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}
```

Update `smartMixed` to call it after planting (so it expands once the current board is
worked), and loop plant→buy→plant so a freshly-bought plot also gets seeded this turn:

```ts
const smartMixed: Strategy = (state, config) => {
  let s = maybeUpgrade(state, config);
  const pick = (cur: GameState): CropId =>
    cur.coinBalance > 250 ? 'pumpkin' : cur.coinBalance > 60 ? 'parsnip' : 'radish';
  // Fill, then expand, then fill the new plot(s); a couple of rounds converge.
  for (let round = 0; round < 3; round++) {
    s = fillBoard(s, config, pick);
    const expanded = maybeBuyPlots(s, config);
    if (expanded.unlockedPlots === s.unlockedPlots) { s = expanded; break; }
    s = expanded;
  }
  return s;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/strategies.test.ts`
Expected: PASS (new + existing strategy tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/strategies.ts tests/sim/strategies.test.ts
git commit -m "feat(010): smartMixed strategy buys plots when flush"
```

---

## Task 7: Per-season clear-rate metric

**Files:**
- Modify: `scripts/sim/metrics.ts`
- Test: `tests/sim/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('reports per-season clear rate', () => {
  const outcomes = [
    { result: 'won' as const,          endedDay: 80, peakBalance: 1, finalBalance: 1, seasonReached: 4 },
    { result: 'bankrupt' as const,     endedDay: 30, peakBalance: 1, finalBalance: 1, seasonReached: 2 },
    { result: 'targetMissed' as const, endedDay: 60, peakBalance: 1, finalBalance: 1, seasonReached: 3 },
  ];
  const m = aggregate(outcomes, 600);
  // cleared season 1 = reached season > 1 OR won → runs 1 & 3 cleared S1 (2/3)
  expect(m.clearedSeasonPct[0]).toBeCloseTo(66.7, 0); // season 1
  expect(m.clearedSeasonPct[3]).toBeCloseTo(33.3, 0); // season 4 (only the win)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/metrics.test.ts -t "per-season"`
Expected: FAIL — `clearedSeasonPct` undefined.

- [ ] **Step 3: Write minimal implementation**

Add to the `Metrics` interface: `clearedSeasonPct: number[]; // index 0..3 = seasons 1..4`.
In `aggregate`, before the return, compute:

```ts
  const clearedSeasonPct = [1, 2, 3, 4].map(season =>
    pct(outcomes.filter(o => o.result === 'won' || o.seasonReached > season).length, n),
  );
```

and add `clearedSeasonPct,` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/metrics.ts tests/sim/metrics.test.ts
git commit -m "feat(010): per-season clear-rate metric"
```

---

## Task 8: Tune the `proposed` numbers with the simulator

**Files:**
- Modify: `scripts/sim/economyPresets.ts` (numbers only)
- Create: `specs/010-plot-progression-rebalance/tuning-results.md`

This is an analysis task, not TDD. Goal band for skilled play (the `smartMixed` bot is a
difficulty **floor**): **win 15–35% for the bot** (≈50–65% for a skilled human),
**overshoot 1.0–1.3×**, single-crop strategies mostly failing, season-1 bankruptcy not
spiking.

- [ ] **Step 1: Run the comparison**

Run: `npm run sim -- --configs baseline,proposed --strategies smartMixed,parsnipOnly,pumpkinOnly,radishOnly --trials 2000 --seed 42`
Expected: a table. Record it.

- [ ] **Step 2: Adjust one lever at a time and re-run**

Tuning rules (from the game-balancing skill — change ONE system per iteration, 10–20% steps):
- If `smartMixed` win > 40%: raise late targets (S3/S4) ~15%, or raise lease, or trim pumpkin yield by 1–2.
- If `smartMixed` win < 10% or S1 bankruptcy is high: lower S1 lease toward 16, or raise `startingBalance` to ~120, or widen early plot prices.
- If a single-crop strategy still wins: compress that crop's margin (raise seed cost or cut yield by 1–2).
- Re-run after each single change. Stop when the band is hit.

- [ ] **Step 3: Record the final table and chosen numbers**

Write `specs/010-plot-progression-rebalance/tuning-results.md` containing: the final
`npm run sim` table, the final `proposed` numbers, and a one-paragraph rationale.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim/economyPresets.ts specs/010-plot-progression-rebalance/tuning-results.md
git commit -m "chore(010): tune proposed economy via simulator, record results"
```

---

## Task 9: Promote the tuned economy into `DEFAULT_ECONOMY`

**Files:**
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/economy.ts`
- Test: many engine tests assert the OLD default numbers — update them.

This flips the **game** to the new economy. The frozen `baseline` preset preserves
old-number coverage for the simulator, so only default-behavior game tests change.

- [ ] **Step 1: Apply the tuned numbers to constants**

In `src/engine/constants.ts`:
- Add `export const STARTING_PLOTS = 4;` and `export const PLOT_PRICES = [/* tuned */];`.
- Update `CROP_DEFINITIONS` yields/costs and `TAX_RATE` to the tuned `proposed` values.

In `src/engine/economy.ts`:
- Update the `SEASON_TABLE` literal to the tuned `proposed` season numbers.
- In `DEFAULT_ECONOMY`, set `startingPlots: STARTING_PLOTS` and `plotPrices: PLOT_PRICES`
  (import them from `./constants`).

- [ ] **Step 2: Run the suite and update broken default-expectation assertions**

Run: `npm test`
Expected: failures in tests that hard-coded the old defaults (e.g. `seasons.test.ts`
target/lease assertions; `gameEngine.test.ts` harvest-income/tax math; any
`initialGameState().unlockedPlots === 12` expectation now 4). For each failure, update the
expected value to the new economy's arithmetic. Do NOT weaken assertions — recompute them.

Tip: tests that must stay on the OLD numbers should pass `baseline` explicitly via the
config param; convert them where that was the intent.

- [ ] **Step 3: Re-run until green**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 4: Verify the shipped default hits the target band**

Run: `npm run sim -- --configs proposed --strategies smartMixed,parsnipOnly --trials 2000`
Confirm `smartMixed` win 15–35%, overshoot ≈1.0–1.3×. (DEFAULT_ECONOMY now equals `proposed`.)

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts src/engine/economy.ts tests/
git commit -m "feat(010): promote tuned economy to DEFAULT_ECONOMY and update default-expectation tests"
```

---

## Task 10: `LockedPlot` UI branch

**Files:**
- Modify: `src/components/PlotCard.tsx`
- Test: `tests/components/PlotCard.test.tsx` (create if absent)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/PlotCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlotCard } from '../../src/components/PlotCard';
import type { PlotState } from '../../src/engine/types';

const emptyPlot = (id: number): PlotState => ({
  id, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
});

describe('LockedPlot', () => {
  it('shows a Buy button on the next purchasable plot and calls onBuyPlot', async () => {
    const onBuyPlot = vi.fn();
    render(
      <PlotCard plot={emptyPlot(4)} locked isNextPurchasable plotPrice={40} canAffordPlot
        onBuyPlot={onBuyPlot} />,
    );
    const btn = screen.getByRole('button', { name: /buy plot/i });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onBuyPlot).toHaveBeenCalledWith(4);
  });

  it('disables the Buy button when unaffordable', () => {
    render(
      <PlotCard plot={emptyPlot(4)} locked isNextPurchasable plotPrice={40} canAffordPlot={false}
        onBuyPlot={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /buy plot/i })).toBeDisabled();
  });

  it('renders a plain lock (no button) for a non-next locked plot', () => {
    render(<PlotCard plot={emptyPlot(7)} locked isNextPurchasable={false} />);
    expect(screen.queryByRole('button', { name: /buy plot/i })).toBeNull();
    expect(screen.getByLabelText(/locked plot 8/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/PlotCard.test.tsx`
Expected: FAIL — `locked` prop not handled.

- [ ] **Step 3: Write minimal implementation**

In `PlotCard.tsx`, extend `PlotCardProps` and add a `LockedPlot` component + an early
branch (locked beats empty; pest/exhausted can't occur on a locked plot, but keep the
locked check first for safety):

```tsx
interface PlotCardProps {
  plot: PlotState;
  currentDay?: number;
  fertilizerInventory?: number;
  locked?: boolean;
  isNextPurchasable?: boolean;
  plotPrice?: number;
  canAffordPlot?: boolean;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
  onClearPestDamage?: (plotId: number) => void;
  onBuyPlot?: (plotId: number) => void;
}

function LockedPlot({ plot, isNextPurchasable, plotPrice, canAffordPlot, onBuyPlot }: {
  plot: PlotState; isNextPurchasable?: boolean; plotPrice?: number;
  canAffordPlot?: boolean; onBuyPlot?: (plotId: number) => void;
}) {
  return (
    <div
      aria-label={`Locked plot ${plot.id + 1}`}
      className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border-2 border-[#3D2510]/80 bg-[#160F07] opacity-80 select-none p-1"
    >
      <span className="text-2xl opacity-60">🔒</span>
      {isNextPurchasable && plotPrice !== undefined ? (
        <button
          type="button"
          aria-label={`Buy plot ${plot.id + 1} for ${plotPrice} coins`}
          disabled={!canAffordPlot}
          onClick={() => onBuyPlot?.(plot.id)}
          className="mt-1 font-pixel text-[10px] px-1.5 py-0.5 rounded bg-farm-gold text-farm-ink hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Buy plot · {plotPrice}🪙
        </button>
      ) : (
        <span className="mt-1 font-pixel text-[9px] text-farm-stone/60">Locked</span>
      )}
    </div>
  );
}
```

Add at the very top of the `PlotCard` function body, before the pest check:

```tsx
  if (locked) {
    return (
      <LockedPlot
        plot={plot}
        isNextPurchasable={isNextPurchasable}
        plotPrice={plotPrice}
        canAffordPlot={canAffordPlot}
        onBuyPlot={onBuyPlot}
      />
    );
  }
```

(Update the `PlotCard` destructuring to include the new props.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/PlotCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlotCard.tsx tests/components/PlotCard.test.tsx
git commit -m "feat(010): LockedPlot UI branch in PlotCard"
```

---

## Task 11: `FarmGrid` passes lock props

**Files:**
- Modify: `src/components/FarmGrid.tsx`
- Test: `tests/components/` (extend FarmGrid test if present, else cover via GameBoard)

- [ ] **Step 1: Write the failing test** (add to a FarmGrid or GameBoard test)

```tsx
it('renders locked plots beyond unlockedPlots and a single Buy button', () => {
  // 12 empty plots, only 4 unlocked, next price 40, affordable
  const plots = Array.from({ length: 12 }, (_, id) => ({
    id, cropId: null, dayPlanted: null, daysRemaining: null,
    consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
  }));
  render(<FarmGrid plots={plots} unlockedPlots={4} nextPlotPrice={40} canAffordPlot onBuyPlot={() => {}} />);
  expect(screen.getAllByLabelText(/locked plot/i)).toHaveLength(8);
  expect(screen.getAllByRole('button', { name: /buy plot/i })).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components -t "renders locked plots"`
Expected: FAIL — props not threaded; no locked plots.

- [ ] **Step 3: Write minimal implementation**

Extend `FarmGridProps` and the `plots.map` to compute lock state per plot:

```tsx
interface FarmGridProps {
  plots: PlotState[];
  currentDay?: number;
  fertilizerInventory?: number;
  unlockedPlots?: number;
  nextPlotPrice?: number | null;
  canAffordPlot?: boolean;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
  onClearPestDamage?: (plotId: number) => void;
  onBuyPlot?: (plotId: number) => void;
  selectedCrop?: CropId | null;
}
```

Destructure the new props (default `unlockedPlots = plots.length`), and in the map:

```tsx
          {plots.map(plot => {
            const locked = plot.id >= (unlockedPlots ?? plots.length);
            const isNextPurchasable = plot.id === (unlockedPlots ?? plots.length);
            return (
              <PlotCard
                key={plot.id}
                plot={plot}
                currentDay={currentDay}
                fertilizerInventory={fertilizerInventory}
                locked={locked}
                isNextPurchasable={locked && isNextPurchasable}
                plotPrice={nextPlotPrice ?? undefined}
                canAffordPlot={canAffordPlot}
                onPlant={onPlant}
                onApplyFertilizer={onApplyFertilizer}
                onClearPestDamage={onClearPestDamage}
                onBuyPlot={onBuyPlot}
              />
            );
          })}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components -t "renders locked plots"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FarmGrid.tsx tests/components/
git commit -m "feat(010): FarmGrid renders locked plots and the next Buy control"
```

---

## Task 12: `useGameEngine` — `buyPlot` action + `getNextPlotPrice`

**Files:**
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/engine/useGameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('buyPlot unlocks a plot and getNextPlotPrice returns the next cost', () => {
  // Render the hook (match the file's existing renderHook style), seed enough coins,
  // call buyPlot, assert unlockedPlots increments and price advances.
  const { result } = renderHook(() => useGameEngine());
  act(() => { result.current.restart(); });
  // With DEFAULT_ECONOMY now == proposed (start 4), next price is plotPrices[0].
  const firstPrice = result.current.getNextPlotPrice();
  expect(typeof firstPrice).toBe('number');
  act(() => { /* give coins via a test hook or buy after harvesting; if no hook, assert price math only */ });
});
```

Note: if `useGameEngine` has no way to inject coins in tests, assert `getNextPlotPrice()`
returns `DEFAULT_ECONOMY.plotPrices[0]` at a fresh start and that `buyPlot()` returns
`false` when unaffordable. Keep the test aligned with the file's existing patterns.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "buyPlot"`
Expected: FAIL — `buyPlot`/`getNextPlotPrice` not on the hook.

- [ ] **Step 3: Write minimal implementation**

Import `buyPlot as engineBuyPlot` and `DEFAULT_ECONOMY`. Add to `GameEngineHook`:

```ts
  buyPlot: () => boolean;
  getNextPlotPrice: () => number | null;
```

Add the callbacks (mirroring the existing action pattern):

```ts
  const buyPlot = useCallback((): boolean => {
    const result = engineBuyPlot(stateRef.current);
    if (!result.ok) return false;
    setState(result.state);
    return true;
  }, []);

  const getNextPlotPrice = useCallback((): number | null => {
    const s = state;
    if (s.unlockedPlots >= DEFAULT_ECONOMY.maxPlots) return null;
    return DEFAULT_ECONOMY.plotPrices[s.unlockedPlots - DEFAULT_ECONOMY.startingPlots] ?? null;
  }, [state]);
```

Return both from the hook.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/useGameEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/useGameEngine.ts tests/engine/useGameEngine.test.ts
git commit -m "feat(010): expose buyPlot and getNextPlotPrice from useGameEngine"
```

---

## Task 13: Wire plot progression through `GameBoard`

**Files:**
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/App.tsx` (only if it constructs `GameBoard` props — verify)

- [ ] **Step 1: Add props + handler**

Extend `GameBoardProps` with:

```ts
  onBuyPlot: () => boolean;
  getNextPlotPrice: () => number | null;
```

Compute derived values in the component body and pass to `FarmGrid`:

```tsx
  const nextPlotPrice = getNextPlotPrice();
  const canAffordPlot = nextPlotPrice !== null && state.coinBalance >= nextPlotPrice;
```

```tsx
          <FarmGrid
            plots={state.plots}
            currentDay={state.currentDay}
            fertilizerInventory={getFertilizerCount()}
            unlockedPlots={state.unlockedPlots}
            nextPlotPrice={nextPlotPrice}
            canAffordPlot={canAffordPlot}
            onBuyPlot={() => { onBuyPlot(); }}
            onPlant={handlePlot}
            onApplyFertilizer={onApplyFertilizer}
            onClearPestDamage={onClearPestDamage}
            selectedCrop={selectedCrop}
          />
```

- [ ] **Step 2: Thread the props from the hook to GameBoard**

In `src/App.tsx` (or wherever `<GameBoard .../>` is rendered), pass
`onBuyPlot={engine.buyPlot}` and `getNextPlotPrice={engine.getNextPlotPrice}`.
Run `grep -n "GameBoard" src/App.tsx` to confirm the call site and props object.

- [ ] **Step 3: Verify build + types**

Run: `npm run lint && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/GameBoard.tsx src/App.tsx
git commit -m "feat(010): wire plot purchasing through GameBoard"
```

---

## Task 14: Full verification + manual playthrough + docs

**Files:**
- Modify: `CLAUDE.md` recent-changes note and/or `UI.md` if it documents the grid (optional, follow repo habit).

- [ ] **Step 1: Full suite + lint**

Run: `npm test && npm run lint`
Expected: all green.

- [ ] **Step 2: Manual playthrough**

Run: `npm run dev`, open the app. Verify:
- New game shows 4 active plots and 8 locked (🔒); exactly one shows `Buy plot · N🪙`.
- The Buy button is disabled when you can't afford it, enabled when you can; clicking it
  unlocks the next plot, deducts coins, and the next lock now shows the next price.
- Locked plots cannot be planted.
- A full run feels tense (you must expand and mix crops) rather than trivial.

- [ ] **Step 3: Confirm difficulty band one final time**

Run: `npm run sim -- --strategies smartMixed --trials 2000`
Expected: matches the tuned band recorded in `tuning-results.md`.

- [ ] **Step 4: Update docs note**

Add a one-line entry under Recent Changes in `CLAUDE.md`:
`- 010-plot-progression-rebalance: plot purchasing + simulator-tuned economy (schema 7).`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs(010): record plot-progression rebalance in project notes"
```

---

## Self-Review Notes

- **Spec coverage:** `unlockedPlots`+types (T1) ✓; `plantSeed` lock (T2) ✓; `buyPlot` (T3) ✓; schema 6→7 + migration keeping old saves at 12 plots (T4) ✓; `proposed` numbers incl. plot prices (T5) ✓; simulator models plot-buying (T6) ✓; per-season metric for tuning (T7) ✓; tuned via sim, results recorded (T8) ✓; promote to `DEFAULT_ECONOMY` (T9) ✓; LockedPlot UI / FarmGrid / hook / GameBoard wiring (T10–T13) ✓; old saves load (T4), shipped default in target band (T9 step 4, T14 step 3), no regressions (T9, T14) ✓.
- **Placeholder scan:** the only deliberately-deferred values are the tuned numbers (T8 sets them by procedure) and exact assertion updates (T9 step 2, recomputed against the new arithmetic, not weakened). No code step lacks code.
- **Type consistency:** `BuyPlotResult` (errors `max_plots_reached`/`insufficient_funds`), `unlockedPlots`, `plot_locked`, hook methods `buyPlot`/`getNextPlotPrice`, and PlotCard/FarmGrid props (`locked`/`isNextPurchasable`/`plotPrice`/`canAffordPlot`/`onBuyPlot`) are named identically across engine, hook, and UI tasks.
- **Ordering risk:** engine plot mechanics (T1–T4) precede the simulator tuning (T6–T8) so the bot can exercise `buyPlot`; promotion (T9) happens only after the band is hit, and the frozen `baseline` preset (T5) protects the 009 characterization test from drifting when defaults change.
