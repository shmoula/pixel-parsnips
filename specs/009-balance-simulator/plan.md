# Balance Simulator (009) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible Monte Carlo simulation CLI that measures game difficulty by running many randomized games against the real engine under a swappable `EconomyConfig`.

**Architecture:** Extract every tunable balance number into an injectable `EconomyConfig` object that the real engine functions read (via an optional trailing `config` parameter defaulting to `DEFAULT_ECONOMY`). Thread a seedable `rng` into `processTurn` so runs are reproducible. Build a standalone `scripts/sim/` TypeScript CLI (run with `tsx`) that imports the real engine, plays full games with strategy bots, and reports aggregate metrics.

**Tech Stack:** TypeScript ~5.6, the existing pure engine in `src/engine/`, Vitest for tests, `tsx` (new dev dependency) to run the CLI.

---

## File Structure

**Engine (modified — all changes are back-compatible via optional trailing params):**
- Create `src/engine/economy.ts` — `EconomyConfig` interface + `DEFAULT_ECONOMY` (built from existing constants; no value duplication).
- Modify `src/engine/gameEngine.ts` — `initialGameState`, `computeSeedCost`, `buySeed`, `buyUpgrade`, `plantSeed`, `buyFertilizer`, `applyFertilizer`, `processTurn` gain optional `config` param; `processTurn` also gains optional `rng`.
- Modify `src/engine/seasons.ts` — `getSeasonForDay` gains optional `config` param and reads `config.seasons` + `config.endless`.

**Simulator (new — `scripts/sim/`, pure TS, no React/DOM):**
- Create `scripts/sim/rng.ts` — seedable PRNG.
- Create `scripts/sim/economyPresets.ts` — named configs (`baseline`).
- Create `scripts/sim/strategies.ts` — strategy bots.
- Create `scripts/sim/runner.ts` — `playRun`, `monteCarlo`.
- Create `scripts/sim/metrics.ts` — outcome aggregation.
- Create `scripts/sim/report.ts` — stdout table formatting.
- Create `scripts/sim/run.ts` — CLI entry + argv parsing.

**Tests (new):**
- Create `tests/engine/economy.test.ts`
- Add to `tests/engine/gameEngine.test.ts` and `tests/engine/seasons.test.ts`
- Create `tests/sim/rng.test.ts`, `tests/sim/strategies.test.ts`, `tests/sim/metrics.test.ts`, `tests/sim/runner.test.ts`

**Config:**
- Modify `package.json` — add `tsx` devDependency + `"sim"` script.

---

## Task 1: `EconomyConfig` type + `DEFAULT_ECONOMY`

**Files:**
- Create: `src/engine/economy.ts`
- Test: `tests/engine/economy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/engine/economy.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import {
  STARTING_BALANCE, PLOT_COUNT, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from '../../src/engine/constants';
import { SEASON_TABLE } from '../../src/engine/seasons';

describe('DEFAULT_ECONOMY', () => {
  it('mirrors the current live constants exactly', () => {
    expect(DEFAULT_ECONOMY.startingBalance).toBe(STARTING_BALANCE);
    expect(DEFAULT_ECONOMY.startingPlots).toBe(PLOT_COUNT);
    expect(DEFAULT_ECONOMY.maxPlots).toBe(PLOT_COUNT);
    expect(DEFAULT_ECONOMY.taxRate).toBe(TAX_RATE);
    expect(DEFAULT_ECONOMY.fertilizerCost).toBe(FERTILIZER_COST);
    expect(DEFAULT_ECONOMY.exhaustionThreshold).toBe(EXHAUSTION_THRESHOLD);
    expect(DEFAULT_ECONOMY.exhaustionRecoveryDays).toBe(EXHAUSTION_RECOVERY_DAYS);
    expect(DEFAULT_ECONOMY.streakBonusPerLevel).toBe(STREAK_BONUS_PER_LEVEL);
    expect(DEFAULT_ECONOMY.streakBonusCap).toBe(STREAK_BONUS_CAP);
    expect(DEFAULT_ECONOMY.crops).toBe(CROP_DEFINITIONS);
    expect(DEFAULT_ECONOMY.upgrades).toBe(UPGRADE_TIER_DEFINITIONS);
    expect(DEFAULT_ECONOMY.seasons).toBe(SEASON_TABLE);
  });

  it('encodes the endless formula coefficients used today', () => {
    // day 81 → season 5: lease 30+2*(5-4)=32, target 600+200=800, disaster 0.37
    expect(DEFAULT_ECONOMY.endless.leaseBase).toBe(30);
    expect(DEFAULT_ECONOMY.endless.leasePerSeason).toBe(2);
    expect(DEFAULT_ECONOMY.endless.disasterBase).toBe(0.35);
    expect(DEFAULT_ECONOMY.endless.disasterPerSeason).toBe(0.02);
    expect(DEFAULT_ECONOMY.endless.disasterCap).toBe(0.50);
    expect(DEFAULT_ECONOMY.endless.targetBase).toBe(600);
    expect(DEFAULT_ECONOMY.endless.targetPerSeason).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/economy.test.ts`
Expected: FAIL — `Cannot find module '../../src/engine/economy'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/engine/economy.ts
import type { CropId, CropDefinition, UpgradeTierDefinition } from './types';
import {
  STARTING_BALANCE, PLOT_COUNT, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from './constants';
import { SEASON_TABLE, type SeasonConfig } from './seasons';

export interface EndlessFormula {
  leaseBase: number; leasePerSeason: number;
  disasterBase: number; disasterPerSeason: number; disasterCap: number;
  targetBase: number; targetPerSeason: number;
}

export interface EconomyConfig {
  startingBalance: number;
  startingPlots: number; // 010 activates plot gating; in 009 == maxPlots
  maxPlots: number;
  plotPrices: number[];  // unused in 009; 010 reads it
  taxRate: number;
  crops: Record<string, CropDefinition>;
  upgrades: UpgradeTierDefinition[];
  seasons: SeasonConfig[];
  endless: EndlessFormula;
  exhaustionThreshold: number;
  exhaustionRecoveryDays: number;
  fertilizerCost: number;
  streakBonusPerLevel: number;
  streakBonusCap: number;
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  startingBalance: STARTING_BALANCE,
  startingPlots: PLOT_COUNT,
  maxPlots: PLOT_COUNT,
  plotPrices: [],
  taxRate: TAX_RATE,
  crops: CROP_DEFINITIONS,
  upgrades: UPGRADE_TIER_DEFINITIONS,
  seasons: SEASON_TABLE,
  endless: {
    leaseBase: 30, leasePerSeason: 2,
    disasterBase: 0.35, disasterPerSeason: 0.02, disasterCap: 0.50,
    targetBase: 600, targetPerSeason: 200,
  },
  exhaustionThreshold: EXHAUSTION_THRESHOLD,
  exhaustionRecoveryDays: EXHAUSTION_RECOVERY_DAYS,
  fertilizerCost: FERTILIZER_COST,
  streakBonusPerLevel: STREAK_BONUS_PER_LEVEL,
  streakBonusCap: STREAK_BONUS_CAP,
};
```

Note: `CropId` import is unused here — drop it if the linter complains; keep `CropDefinition`/`UpgradeTierDefinition`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/economy.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/economy.ts tests/engine/economy.test.ts
git commit -m "feat(009): add EconomyConfig type and DEFAULT_ECONOMY"
```

---

## Task 2: Thread config into `getSeasonForDay`

**Files:**
- Modify: `src/engine/seasons.ts`
- Test: `tests/engine/seasons.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/engine/seasons.test.ts`)

```ts
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('getSeasonForDay with injected config', () => {
  it('defaults to DEFAULT_ECONOMY and is unchanged', () => {
    expect(getSeasonForDay(21).target).toBe(250);
    expect(getSeasonForDay(81).leasePerDay).toBe(32); // endless season 5
  });

  it('reads finite-season values from a custom config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      seasons: DEFAULT_ECONOMY.seasons.map(s =>
        s.number === 2 ? { ...s, target: 999 } : s),
    };
    expect(getSeasonForDay(21, custom).target).toBe(999);
  });

  it('reads endless coefficients from a custom config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      endless: { ...DEFAULT_ECONOMY.endless, targetBase: 1000, targetPerSeason: 500 },
    };
    // day 81 → season 5 → target 1000 + 500*(5-4) = 1500
    expect(getSeasonForDay(81, custom).target).toBe(1500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: FAIL — `getSeasonForDay` takes 1 arg / custom values ignored.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/seasons.ts`, add the import at top:

```ts
import { DEFAULT_ECONOMY, type EconomyConfig } from './economy';
```

Replace the `getSeasonForDay` function body with:

```ts
export function getSeasonForDay(day: number, config: EconomyConfig = DEFAULT_ECONOMY): SeasonConfig {
  for (const s of config.seasons) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Endless Season N (N ≥ 5)
  const e = config.endless;
  const n = 5 + Math.floor((day - 81) / 20);
  const startDay = 81 + 20 * (n - 5);
  return {
    number: n,
    name: 'Deep Winter',
    startDay,
    endDay: startDay + 19,
    leasePerDay: e.leaseBase + e.leasePerSeason * (n - 4),
    disasterTotalPct: Math.min(e.disasterBase + e.disasterPerSeason * (n - 4), e.disasterCap),
    target: e.targetBase + e.targetPerSeason * (n - 4),
  };
}
```

Note: `economy.ts` imports `SEASON_TABLE` from `seasons.ts`, and `seasons.ts` now imports `DEFAULT_ECONOMY` from `economy.ts`. This is a cycle but it resolves: `SEASON_TABLE` is a module-level const evaluated before `getSeasonForDay` is ever called, and `DEFAULT_ECONOMY` is only read at call time. If the bundler warns, break it by importing the `EconomyConfig` *type* only and passing config explicitly — but the default param needs the value. Verify tests pass; if the cycle misbehaves at runtime, see Task 2b fallback below.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: PASS (all existing + 3 new tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/seasons.ts tests/engine/seasons.test.ts
git commit -m "feat(009): getSeasonForDay reads from EconomyConfig"
```

### Task 2b (only if the import cycle breaks at runtime)

If Step 4 fails with a runtime error about `DEFAULT_ECONOMY` being undefined, move `DEFAULT_ECONOMY`'s `seasons` to reference a locally-declared `SEASON_TABLE` by relocating `SEASON_TABLE` into `economy.ts` and re-exporting it from `seasons.ts`:
- Cut the `SEASON_TABLE` const from `seasons.ts`, paste into `economy.ts`, export it there.
- In `seasons.ts` add `export { SEASON_TABLE } from './economy';`.
Re-run Step 4. Commit with the same message.

---

## Task 3: Thread config into `computeSeedCost` + `buySeed`

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing test** (append to `tests/engine/gameEngine.test.ts`)

```ts
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('config injection — seeds', () => {
  it('computeSeedCost uses crop cost from a custom config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      crops: { ...DEFAULT_ECONOMY.crops, radish: { ...DEFAULT_ECONOMY.crops.radish, baseSeedCost: 99 } },
    };
    expect(computeSeedCost('radish', 0, custom)).toBe(99);
    expect(computeSeedCost('radish', 0)).toBe(5); // default unchanged
  });

  it('buySeed deducts the custom seed cost', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      crops: { ...DEFAULT_ECONOMY.crops, radish: { ...DEFAULT_ECONOMY.crops.radish, baseSeedCost: 40 } },
    };
    const s = initialGameState();
    const r = buySeed(s, 'radish', 2, custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(s.coinBalance - 80);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "config injection — seeds"`
Expected: FAIL — extra arg ignored / cost still 5.

- [ ] **Step 3: Write minimal implementation**

In `src/engine/gameEngine.ts`, add near the top imports:

```ts
import { DEFAULT_ECONOMY, type EconomyConfig } from './economy';
```

Replace `computeSeedCost`:

```ts
export function computeSeedCost(
  cropId: CropId, upgradeTier: UpgradeTier, config: EconomyConfig = DEFAULT_ECONOMY,
): number {
  const crop = config.crops[cropId];
  if (upgradeTier === 0) return crop.baseSeedCost;
  const def = config.upgrades[upgradeTier - 1];
  return coins(crop.baseSeedCost * (1 - def.cumulativeDiscount));
}
```

Replace `buySeed` signature line and the `computeSeedCost` call inside it:

```ts
export function buySeed(
  state: GameState, cropId: CropId, quantity: number, config: EconomyConfig = DEFAULT_ECONOMY,
): BuyResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'invalid_quantity' };
  }
  const unitCost = computeSeedCost(cropId, state.upgradeTier, config);
  // ...rest of the body is unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts`
Expected: PASS (new tests + all existing).

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(009): computeSeedCost and buySeed read from EconomyConfig"
```

---

## Task 4: Thread config into `initialGameState`, `buyUpgrade`, `plantSeed`

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('config injection — state/upgrade/plant', () => {
  it('initialGameState uses startingBalance from config', () => {
    const custom = { ...DEFAULT_ECONOMY, startingBalance: 500 };
    expect(initialGameState(custom).coinBalance).toBe(500);
    expect(initialGameState().coinBalance).toBe(100);
  });

  it('buyUpgrade uses the custom upgrade cost', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      upgrades: DEFAULT_ECONOMY.upgrades.map((u, i) => i === 0 ? { ...u, cost: 10 } : u),
    };
    const s = initialGameState();
    const r = buyUpgrade(s, custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(s.coinBalance - 10);
  });

  it('plantSeed uses growthDays from config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      crops: { ...DEFAULT_ECONOMY.crops, radish: { ...DEFAULT_ECONOMY.crops.radish, growthDays: 7 } },
    };
    let s = initialGameState();
    s = buySeed(s, 'radish', 1, custom).ok ? (buySeed(s, 'radish', 1, custom) as { state: typeof s }).state : s;
    const r = plantSeed(s, 0, 'radish', custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.plots[0].daysRemaining).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "config injection — state/upgrade/plant"`
Expected: FAIL — args ignored.

- [ ] **Step 3: Write minimal implementation**

`initialGameState` — change signature and the two reads:

```ts
export function initialGameState(config: EconomyConfig = DEFAULT_ECONOMY): GameState {
  const plots: PlotState[] = Array.from({ length: config.maxPlots }, (_, i) => ({
    id: i, cropId: null, dayPlanted: null, daysRemaining: null,
    consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
  }));
  return {
    schemaVersion: SCHEMA_VERSION,
    currentDay: 1,
    coinBalance: config.startingBalance,
    plots,
    seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
    upgradeTier: 0,
    lastDailyLog: null,
    phase: 'playing',
    peakBalance: config.startingBalance,
    fertilizerInventory: 0,
    flashDroughtDaysRemaining: 0,
    endlessMode: false,
    disastersSurvived: 0,
    harvestStreak: 0,
    peakHarvestStreak: 0,
  };
}
```

`buyUpgrade` — change signature and reads:

```ts
export function buyUpgrade(state: GameState, config: EconomyConfig = DEFAULT_ECONOMY): UpgradeResult {
  const maxTier = config.upgrades.length;
  if (state.upgradeTier >= maxTier) {
    return { ok: false, error: 'max_tier_reached' };
  }
  const nextTier = (state.upgradeTier + 1) as UpgradeTier;
  const def = config.upgrades[nextTier - 1];
  if (state.coinBalance < def.cost) {
    return { ok: false, error: 'insufficient_funds' };
  }
  return { ok: true, state: { ...state, upgradeTier: nextTier, coinBalance: state.coinBalance - def.cost } };
}
```

`plantSeed` — change signature, the `PLOT_COUNT` bound, and the `crop` lookup:

```ts
export function plantSeed(
  state: GameState, plotId: number, cropId: CropId, config: EconomyConfig = DEFAULT_ECONOMY,
): PlantResult {
  if (plotId < 0 || plotId >= config.maxPlots) {
    return { ok: false, error: 'invalid_plot' };
  }
  // ...occupied / exhausted / pest / no_seed guards unchanged...
  const crop = config.crops[cropId];
  // ...rest unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(009): initialGameState/buyUpgrade/plantSeed read from EconomyConfig"
```

---

## Task 5: Thread config into `buyFertilizer` + `applyFertilizer`

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('config injection — fertilizer', () => {
  it('buyFertilizer uses fertilizerCost from config', () => {
    const custom = { ...DEFAULT_ECONOMY, fertilizerCost: 12 };
    const s = initialGameState();
    const r = buyFertilizer(s, 2, custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(s.coinBalance - 24);
  });

  it('applyFertilizer rejects an out-of-range plot using config.maxPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, maxPlots: 12 };
    const r = applyFertilizer(initialGameState(), 99, custom);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_plot');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "config injection — fertilizer"`
Expected: FAIL — arg ignored.

- [ ] **Step 3: Write minimal implementation**

`buyFertilizer`:

```ts
export function buyFertilizer(state: GameState, quantity: number, config: EconomyConfig = DEFAULT_ECONOMY): BuyResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'invalid_quantity' };
  }
  const totalCost = config.fertilizerCost * quantity;
  // ...rest unchanged...
```

`applyFertilizer` — change signature and the bound check:

```ts
export function applyFertilizer(state: GameState, plotId: number, config: EconomyConfig = DEFAULT_ECONOMY): FertilizerResult {
  if (plotId < 0 || plotId >= config.maxPlots) {
    return { ok: false, error: 'invalid_plot' };
  }
  // ...rest unchanged...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(009): fertilizer functions read from EconomyConfig"
```

---

## Task 6: Thread config + rng into `processTurn`

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

`processTurn`'s current signature is
`processTurn(state, weatherRoll?, pestDestructionOverride?, weatherRollOverride?)`.
Add `config` and `rng` as the 5th and 6th **trailing** params so all 120 existing
positional calls keep working.

- [ ] **Step 1: Write the failing test**

```ts
describe('config injection + rng — processTurn', () => {
  it('uses tax rate from config', () => {
    // 12 radishes ready to harvest at day 1 with weather sunny (x1.0)
    let s = initialGameState();
    for (let i = 0; i < 12; i++) {
      s = (buySeed(s, 'radish', 1) as { state: typeof s }).state;
      s = (plantSeed(s, i, 'radish') as { state: typeof s }).state;
    }
    const custom = { ...DEFAULT_ECONOMY, taxRate: 0.50 };
    const { state: after } = processTurn(s, 'sunny', undefined, undefined, custom);
    // income 12*12=144 + opening 100 - 0 streak; lease 15; tax 50% of (balance-lease)
    const preTax = 100 + 144 - 15;
    expect(after.coinBalance).toBe(preTax - Math.floor(preTax * 0.50));
  });

  it('is deterministic for a fixed rng seed (same weather sequence)', () => {
    const rngA = () => 0.5; // constant roll → same weather band every call
    const rngB = () => 0.5;
    const s = initialGameState();
    const a = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, rngA);
    const b = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, rngB);
    expect(a.log.weatherId).toBe(b.log.weatherId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "config injection + rng — processTurn"`
Expected: FAIL — extra args ignored; tax still 5%.

- [ ] **Step 3: Write minimal implementation**

Change the signature:

```ts
export function processTurn(
  state: GameState,
  weatherRoll?: WeatherId,
  pestDestructionOverride?: number[],
  weatherRollOverride?: number,
  config: EconomyConfig = DEFAULT_ECONOMY,
  rng: () => number = Math.random,
): TurnResult {
```

Then, inside `processTurn`, make these substitutions:

1. Season lookup — pass config:
   `const season = getSeasonForDay(state.currentDay, config);`
2. Weather random roll — use `rng` and config-driven bands:
   `const roll = weatherRollOverride ?? rng();`
   (the `getDisasterBandsForSeason(season)` call is unchanged — it derives widths from `season.disasterTotalPct`, which already comes from config via the season lookup.)
3. Pest destruction random roll — replace `Math.random()` with `rng()`:
   `const isDestroyed = pestDestructionOverride !== undefined ? pestDestructionOverride.includes(plot.id) : rng() < 0.5;`
4. Harvest yield — read crop from config:
   `const crop = config.crops[plot.cropId];`
5. Tax — read rate from config (replace the two `TAX_RATE` usages in the log + deduction):
   `const taxRate = config.taxRate;`
   `const taxDeducted = coins(coinBalance * taxRate);`
   and set `taxRate: config.taxRate` in both `DailyLogEntry` builds (the bankruptcy-path log keeps `taxDeducted: 0` but should report `taxRate: config.taxRate`).
6. Exhaustion threshold + recovery — read from config:
   `if (newConsecutiveHarvests >= config.exhaustionThreshold) {`
   `if (currentDay - plot.exhaustedSinceDay >= config.exhaustionRecoveryDays) {`
7. Streak — pass config caps into `computeStreakUpdate` (update that helper to take them):
   change `computeStreakUpdate(streakBefore, peakBefore, hadHarvest)` to also accept
   `(bonusCap: number, bonusPerLevel: number)` and compute
   `Math.min(streakBefore, bonusCap) * bonusPerLevel`; call it with
   `config.streakBonusCap, config.streakBonusPerLevel`.

Leave the existing `TAX_RATE`, `EXHAUSTION_*`, `STREAK_*` imports in place only if still
referenced elsewhere; otherwise remove unused imports to satisfy the linter.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/gameEngine.test.ts`
Expected: PASS (new + all 120 existing processTurn tests).

- [ ] **Step 5: Run the full engine suite + lint**

Run: `npx vitest run tests/engine && npm run lint`
Expected: all green (proves the refactor is behavior-preserving).

- [ ] **Step 6: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(009): processTurn reads from EconomyConfig and injectable rng"
```

---

## Task 7: Add `tsx` dev dependency + `sim` script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install tsx**

Run: `npm install --save-dev tsx`
Expected: `package.json` gains `tsx` under `devDependencies`; lockfile updates.

- [ ] **Step 2: Add the sim script**

In `package.json` `"scripts"`, add:

```json
"sim": "tsx scripts/sim/run.ts",
```

- [ ] **Step 3: Verify tsx runs TS**

Run: `npx tsx -e "console.log('tsx works')"`
Expected: prints `tsx works`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(009): add tsx dev dependency and sim script"
```

---

## Task 8: Seedable RNG

**Files:**
- Create: `scripts/sim/rng.ts`
- Test: `tests/sim/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/rng.test.ts
import { describe, it, expect } from 'vitest';
import { makeRng } from '../../scripts/sim/rng';

describe('makeRng', () => {
  it('produces values in [0,1)', () => {
    const r = makeRng(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('is deterministic for the same seed', () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });
  it('differs across seeds', () => {
    const a = makeRng(1), b = makeRng(2);
    expect(a()).not.toEqual(b());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/rng.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/sim/rng.ts
/** mulberry32 — small fast seedable PRNG returning () => number in [0,1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/rng.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/rng.ts tests/sim/rng.test.ts
git commit -m "feat(009): seedable mulberry32 rng for the simulator"
```

---

## Task 9: Economy presets

**Files:**
- Create: `scripts/sim/economyPresets.ts`

- [ ] **Step 1: Write the implementation** (no test needed — pure data; covered by runner tests)

```ts
// scripts/sim/economyPresets.ts
import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';

/** The current live economy — the baseline to measure against. */
export const baseline: EconomyConfig = DEFAULT_ECONOMY;

/** Registry of named configs the CLI can select with --configs. */
export const PRESETS: Record<string, EconomyConfig> = {
  baseline,
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors. (If `scripts/` is excluded from that tsconfig, run `npx tsx -e "import('./scripts/sim/economyPresets.ts').then(m=>console.log(Object.keys(m.PRESETS)))"` → prints `[ 'baseline' ]`.)

- [ ] **Step 3: Commit**

```bash
git add scripts/sim/economyPresets.ts
git commit -m "feat(009): baseline economy preset"
```

---

## Task 10: Strategy bots

**Files:**
- Create: `scripts/sim/strategies.ts`
- Test: `tests/sim/strategies.test.ts`

The strategy interface: a function that, given the current state and config, mutates
play for ONE turn by returning the sequence of engine calls to apply. To keep it
simple and pure, a strategy returns a new `GameState` representing all
buy/plant/upgrade actions for the day (the runner then calls `processTurn`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/strategies.test.ts
import { describe, it, expect } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import { STRATEGIES } from '../../scripts/sim/strategies';

describe('strategies', () => {
  it('exposes the four named bots', () => {
    expect(Object.keys(STRATEGIES).sort())
      .toEqual(['parsnipOnly', 'pumpkinOnly', 'radishOnly', 'smartMixed']);
  });

  it('radishOnly plants radishes and spends coins', () => {
    const s = initialGameState();
    const after = STRATEGIES.radishOnly(s, DEFAULT_ECONOMY);
    expect(after.coinBalance).toBeLessThan(s.coinBalance);
    expect(after.plots.some(p => p.cropId === 'radish')).toBe(true);
  });

  it('never plants more than the affordable / available plots', () => {
    const s = initialGameState();
    const after = STRATEGIES.radishOnly(s, DEFAULT_ECONOMY);
    expect(after.coinBalance).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/strategies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/sim/strategies.ts
import {
  buySeed, plantSeed, buyUpgrade, computeSeedCost,
} from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import type { EconomyConfig } from '../../src/engine/economy';
import type { GameState, CropId } from '../../src/engine/types';

export type Strategy = (state: GameState, config: EconomyConfig) => GameState;

/** Plant `crop` on every plantable plot while a seed + lease buffer is affordable. */
function fillBoard(state: GameState, config: EconomyConfig, pick: (s: GameState) => CropId): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  for (let i = 0; i < config.maxPlots; i++) {
    const plot = s.plots[i];
    if (plot.cropId !== null || plot.exhaustedSinceDay !== null || plot.pestDamaged) continue;
    const crop = pick(s);
    const cost = computeSeedCost(crop, s.upgradeTier, config);
    if (s.coinBalance - cost < lease) break;
    const b = buySeed(s, crop, 1, config);
    if (!b.ok) break;
    s = b.state;
    const pl = plantSeed(s, i, crop, config);
    if (pl.ok) s = pl.state;
  }
  return s;
}

/** Buy upgrades while comfortably affordable (keeps a 80-coin working buffer). */
function maybeUpgrade(state: GameState, config: EconomyConfig): GameState {
  let s = state;
  while (s.upgradeTier < config.upgrades.length) {
    const cost = config.upgrades[s.upgradeTier].cost;
    if (s.coinBalance - cost <= 80) break;
    const r = buyUpgrade(s, config);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

const single = (crop: CropId): Strategy => (state, config) =>
  fillBoard(maybeUpgrade(state, config), config, () => crop);

const smartMixed: Strategy = (state, config) => {
  const s = maybeUpgrade(state, config);
  return fillBoard(s, config, (cur) => {
    if (cur.coinBalance > 250) return 'pumpkin';
    if (cur.coinBalance > 60) return 'parsnip';
    return 'radish';
  });
};

export const STRATEGIES: Record<string, Strategy> = {
  radishOnly: single('radish'),
  parsnipOnly: single('parsnip'),
  pumpkinOnly: single('pumpkin'),
  smartMixed,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/strategies.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/strategies.ts tests/sim/strategies.test.ts
git commit -m "feat(009): strategy bots for the simulator"
```

---

## Task 11: Runner (`playRun` + `monteCarlo`)

**Files:**
- Create: `scripts/sim/runner.ts`
- Test: `tests/sim/runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/runner.test.ts
import { describe, it, expect } from 'vitest';
import { playRun, monteCarlo } from '../../scripts/sim/runner';
import { baseline } from '../../scripts/sim/economyPresets';
import { STRATEGIES } from '../../scripts/sim/strategies';

describe('runner', () => {
  it('playRun returns a terminal outcome', () => {
    const o = playRun(baseline, STRATEGIES.smartMixed, 1);
    expect(['won', 'bankrupt', 'targetMissed']).toContain(o.result);
    expect(o.endedDay).toBeGreaterThan(0);
    expect(o.peakBalance).toBeGreaterThanOrEqual(baseline.startingBalance);
  });

  it('is reproducible for the same seed', () => {
    const a = playRun(baseline, STRATEGIES.smartMixed, 7);
    const b = playRun(baseline, STRATEGIES.smartMixed, 7);
    expect(a).toEqual(b);
  });

  it('monteCarlo returns one outcome per trial', () => {
    const outcomes = monteCarlo(baseline, STRATEGIES.radishOnly, 50, 99);
    expect(outcomes).toHaveLength(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/runner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/sim/runner.ts
import { initialGameState, processTurn, clearPestDamage } from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import { makeRng } from './rng';
import type { Strategy } from './strategies';
import type { EconomyConfig } from '../../src/engine/economy';

export type RunResult = 'won' | 'bankrupt' | 'targetMissed';

export interface Outcome {
  result: RunResult;
  endedDay: number;
  peakBalance: number;
  finalBalance: number;
  seasonReached: number;
}

const MAX_DAYS = 80; // finite arc; endless not simulated for difficulty measurement

export function playRun(config: EconomyConfig, strategy: Strategy, seed: number): Outcome {
  const rng = makeRng(seed);
  let state = initialGameState(config);

  for (let guard = 0; guard < 1000; guard++) {
    if (state.phase === 'bankrupt' || state.phase === 'season_failed' || state.phase === 'season_4_won') break;
    if (state.phase === 'season_passed') { state = { ...state, phase: 'playing' }; continue; }
    if (state.currentDay > MAX_DAYS) break;

    // Clear any pest-damaged plots (free) so the board stays usable.
    for (const p of state.plots) {
      if (p.pestDamaged) {
        const r = clearPestDamage(state, p.id);
        if (r.ok) state = r.state;
      }
    }
    // Strategy makes all buy/plant/upgrade decisions for the day.
    state = strategy(state, config);
    // Advance the day with the seeded rng + config.
    state = processTurn(state, undefined, undefined, undefined, config, rng).state;
  }

  const result: RunResult =
    state.phase === 'season_4_won' ? 'won'
    : state.phase === 'bankrupt' ? 'bankrupt'
    : 'targetMissed';

  return {
    result,
    endedDay: state.currentDay,
    peakBalance: state.peakBalance,
    finalBalance: state.coinBalance,
    seasonReached: getSeasonForDay(state.currentDay, config).number,
  };
}

export function monteCarlo(
  config: EconomyConfig, strategy: Strategy, trials: number, masterSeed: number,
): Outcome[] {
  const out: Outcome[] = [];
  for (let i = 0; i < trials; i++) out.push(playRun(config, strategy, masterSeed + i));
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/runner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/runner.ts tests/sim/runner.test.ts
git commit -m "feat(009): playRun + monteCarlo runner against the real engine"
```

---

## Task 12: Metrics

**Files:**
- Create: `scripts/sim/metrics.ts`
- Test: `tests/sim/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sim/metrics.test.ts
import { describe, it, expect } from 'vitest';
import { aggregate } from '../../scripts/sim/metrics';
import type { Outcome } from '../../scripts/sim/runner';

const mk = (result: Outcome['result'], peak: number): Outcome => ({
  result, endedDay: 80, peakBalance: peak, finalBalance: peak, seasonReached: 4,
});

describe('aggregate', () => {
  it('computes rates and peak stats', () => {
    const outcomes = [mk('won', 1000), mk('bankrupt', 100), mk('targetMissed', 400), mk('won', 800)];
    const m = aggregate(outcomes, 600);
    expect(m.trials).toBe(4);
    expect(m.winPct).toBeCloseTo(50);
    expect(m.bankruptPct).toBeCloseTo(25);
    expect(m.targetMissPct).toBeCloseTo(25);
    expect(m.avgPeak).toBe(575); // (1000+100+400+800)/4
    expect(m.medianPeak).toBe(600); // median of [100,400,800,1000]
    expect(m.overshoot).toBeCloseTo(575 / 600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sim/metrics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/sim/metrics.ts
import type { Outcome } from './runner';

export interface Metrics {
  trials: number;
  winPct: number;
  bankruptPct: number;
  targetMissPct: number;
  avgPeak: number;
  medianPeak: number;
  p10Peak: number;
  p90Peak: number;
  overshoot: number; // avgPeak / finalTarget
}

function pct(part: number, total: number): number { return total === 0 ? 0 : (100 * part) / total; }

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export function aggregate(outcomes: Outcome[], finalTarget: number): Metrics {
  const n = outcomes.length;
  const peaks = outcomes.map(o => o.peakBalance).sort((a, b) => a - b);
  const avgPeak = n === 0 ? 0 : peaks.reduce((s, v) => s + v, 0) / n;
  const median = n === 0 ? 0
    : n % 2 ? peaks[(n - 1) / 2]
    : (peaks[n / 2 - 1] + peaks[n / 2]) / 2;
  return {
    trials: n,
    winPct: pct(outcomes.filter(o => o.result === 'won').length, n),
    bankruptPct: pct(outcomes.filter(o => o.result === 'bankrupt').length, n),
    targetMissPct: pct(outcomes.filter(o => o.result === 'targetMissed').length, n),
    avgPeak: Math.round(avgPeak),
    medianPeak: median,
    p10Peak: percentile(peaks, 10),
    p90Peak: percentile(peaks, 90),
    overshoot: finalTarget === 0 ? 0 : avgPeak / finalTarget,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sim/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/sim/metrics.ts tests/sim/metrics.test.ts
git commit -m "feat(009): outcome metrics aggregation"
```

---

## Task 13: Report + CLI entry

**Files:**
- Create: `scripts/sim/report.ts`
- Create: `scripts/sim/run.ts`

- [ ] **Step 1: Write the report formatter** (no unit test — visual output; exercised by the smoke run in Task 14)

```ts
// scripts/sim/report.ts
import type { Metrics } from './metrics';

export interface Row { config: string; strategy: string; metrics: Metrics; }

export function formatTable(rows: Row[]): string {
  const header = ['config', 'strategy', 'win%', 'bankrupt%', 'miss%', 'avgPeak', 'medPeak', 'overshoot'];
  const lines = rows.map(r => [
    r.config, r.strategy,
    r.metrics.winPct.toFixed(1),
    r.metrics.bankruptPct.toFixed(1),
    r.metrics.targetMissPct.toFixed(1),
    String(r.metrics.avgPeak),
    String(r.metrics.medianPeak),
    r.metrics.overshoot.toFixed(2) + 'x',
  ]);
  const widths = header.map((h, i) =>
    Math.max(h.length, ...lines.map(l => l[i].length)));
  const fmt = (cols: string[]) => cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  return [fmt(header), widths.map(w => '-'.repeat(w)).join('  '), ...lines.map(fmt)].join('\n');
}
```

- [ ] **Step 2: Write the CLI entry**

```ts
// scripts/sim/run.ts
import { PRESETS } from './economyPresets';
import { STRATEGIES } from './strategies';
import { monteCarlo } from './runner';
import { aggregate } from './metrics';
import { formatTable, type Row } from './report';

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const configNames = arg('--configs', Object.keys(PRESETS).join(',')).split(',');
const stratNames = arg('--strategies', Object.keys(STRATEGIES).join(',')).split(',');
const trials = parseInt(arg('--trials', '2000'), 10);
const seed = parseInt(arg('--seed', '42'), 10);

const rows: Row[] = [];
for (const c of configNames) {
  const config = PRESETS[c];
  if (!config) { console.error(`Unknown config: ${c}`); process.exit(1); }
  const finalTarget = config.seasons[config.seasons.length - 1].target;
  for (const sName of stratNames) {
    const strat = STRATEGIES[sName];
    if (!strat) { console.error(`Unknown strategy: ${sName}`); process.exit(1); }
    const outcomes = monteCarlo(config, strat, trials, seed);
    rows.push({ config: c, strategy: sName, metrics: aggregate(outcomes, finalTarget) });
  }
}

console.log(`\nMonte Carlo — ${trials} trials/seed=${seed}\n`);
console.log(formatTable(rows));
console.log('');
```

- [ ] **Step 3: Run the CLI**

Run: `npm run sim -- --strategies smartMixed,parsnipOnly,pumpkinOnly --trials 500`
Expected: a printed table; `smartMixed` on `baseline` shows ~95–98 win% and overshoot ~3–4x; `pumpkinOnly` ~100 bankrupt%.

- [ ] **Step 4: Commit**

```bash
git add scripts/sim/report.ts scripts/sim/run.ts
git commit -m "feat(009): simulator report + CLI entry (npm run sim)"
```

---

## Task 14: Baseline smoke test + final verification

**Files:**
- Test: `tests/sim/runner.test.ts` (append)

- [ ] **Step 1: Write the failing test** (locks in the known baseline difficulty so future engine changes can't silently break the measurement)

```ts
import { monteCarlo } from '../../scripts/sim/runner';
import { aggregate } from '../../scripts/sim/metrics';
import { baseline } from '../../scripts/sim/economyPresets';
import { STRATEGIES } from '../../scripts/sim/strategies';

describe('baseline difficulty smoke', () => {
  it('confirms the current economy is trivially easy for smartMixed', () => {
    const outcomes = monteCarlo(baseline, STRATEGIES.smartMixed, 500, 42);
    const m = aggregate(outcomes, baseline.seasons[3].target);
    expect(m.winPct).toBeGreaterThan(90);   // ~97% observed
    expect(m.overshoot).toBeGreaterThan(2); // ~4x observed
  });

  it('confirms pumpkinOnly is the cash-flow death trap', () => {
    const outcomes = monteCarlo(baseline, STRATEGIES.pumpkinOnly, 200, 42);
    const m = aggregate(outcomes, baseline.seasons[3].target);
    expect(m.bankruptPct).toBeGreaterThan(95);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes)**

Run: `npx vitest run tests/sim/runner.test.ts -t "baseline difficulty smoke"`
Expected: PASS (this is a characterization test — it should pass immediately against the real engine; if it fails, the simulator or refactor diverged from the known behavior and must be fixed before proceeding).

- [ ] **Step 3: Full suite + lint**

Run: `npm test && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add tests/sim/runner.test.ts
git commit -m "test(009): lock in baseline difficulty characterization"
```

---

## Self-Review Notes

- **Spec coverage:** EconomyConfig (T1) ✓; engine threading incl. rng (T2–T6) ✓; tsx + script (T7) ✓; rng (T8), presets (T9), strategies (T10), runner (T11), metrics (T12), report+CLI (T13) ✓; reproducibility (T8/T11) ✓; success-criteria smoke reproducing ~97%/4x (T14) ✓; behavior-preserving game (T6 step 5, T14 step 3) ✓.
- **Out of scope (correctly deferred to 010):** plot-buying strategy behavior, `plotPrices`/`startingPlots` activation, per-season pass-rate breakdown (basic metrics suffice for 009; 010 may extend `metrics.ts`).
- **Type consistency:** `EconomyConfig`, `Strategy`, `Outcome`, `Metrics`, `Row` names used consistently across tasks; `STRATEGIES`/`PRESETS` registries referenced identically in runner/CLI/tests.
- **Known risk:** the `economy.ts` ↔ `seasons.ts` import cycle (T2) — Task 2b gives the concrete fallback if it misbehaves at runtime.
