# Farm Buildings (019) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-tier tool ladder and add the G8 infrastructure track as one unified Buildings system — five one-time purchases (Toolshed, Compost Bin, Irrigation Well, Scarecrow, Farm Stand) with a Season-2 gate, teaser cell, schema 9 migration, unified `shop_purchased` analytics, a `?dev=buildings-s1` playtest flag, and a sim-gated retune.

**Architecture:** Pure-function engine extensions behind `EconomyConfig` (approach A from the spec): building definitions + tunable magnitudes live in config, ownership is a `Record<BuildingId, boolean>` on `GameState`, and each effect is a one-line hook at the mechanic it modifies. UI is a new `BuildingCard` + Buildings shelf in the existing Shop section pattern. The ladder removal is one atomic swap task (engine + hook + UI deletions + migration) — everything before it is additive, everything after it is layering.

**Tech Stack:** TypeScript ~5.6, React 18.3, Vite 5.4, Tailwind 3.4, Vitest (+ @testing-library/react), tsx-based Monte Carlo sim (`npm run sim`). No new dependencies.

**Verification loop for every task:** `npx vitest run <task test files>` while iterating, then `npm test && npm run lint` before each commit.

---

## File map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/engine/types.ts` | `BuildingId`, `BuildingDefinition`, `GameState.buildings`, `BuyBuildingResult`, `DailyLogEntry.buildingsApplied`; delete ladder types (Task 6) |
| Modify | `src/engine/constants.ts` | `BUILDING_DEFINITIONS`, magnitude + base-knob constants, `NO_BUILDINGS`, `SCHEMA_VERSION` 9; delete `UPGRADE_TIER_DEFINITIONS`/`MAX_UPGRADE_TIER` (Task 6) |
| Modify | `src/engine/economy.ts` | `BuildingsConfig`, new `EconomyConfig` fields; delete `upgrades` (Task 6) |
| Modify | `src/engine/gameEngine.ts` | `buyBuilding`, 4 effect hooks, `computeSeedCost` re-signature; delete `buyUpgrade` (Task 6) |
| Modify | `src/engine/useGameEngine.ts` | v9 migration + hardening, config threading, `buyBuilding` action, `getBuildingCards`, effective-recovery getter; delete ladder methods (Task 6) |
| Create | `src/devFlags.ts` | `?dev=` parsing (DEV builds only) + `resolveEconomy()` |
| Create | `src/components/BuildingCard.tsx` | Buyable + owned card variants for buildings |
| Modify | `src/components/Shop.tsx` | Buildings shelf + teaser cell; Active Buffs tray lists buildings; delete Tools section (Task 6/8) |
| Delete | `src/components/UpgradeCard.tsx` | Replaced by BuildingCard (Task 6) |
| Modify | `src/components/GameBoard.tsx`, `src/App.tsx` | Prop plumbing swap |
| Modify | `src/components/PlotCard.tsx`, `src/components/FarmGrid.tsx` | `recoveryDays` prop (Compost countdown) |
| Modify | `src/components/DisasterBanner.tsx` | Mitigation sub-lines from `buildingsApplied` |
| Modify | `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts` | `shop_purchased` event + detector |
| Modify | `scripts/sim/strategies.ts` | `maybeBuyBuildings` replaces `maybeUpgrade` |
| Modify | `scripts/sim/economyPresets.ts` | Freeze old presets, add `buildings019` |
| Create | `specs/019-farm-buildings/tuning-results.md` | Sweep record (Task 12) |
| Modify | `README.md`, `backlog.md` | Dev-flag docs, G8 bookkeeping |
| Create | `tests/engine/gameEngine.buildings.test.ts`, `tests/engine/useGameEngine.buildings.test.ts`, `tests/devFlags.test.ts`, `tests/components/BuildingCard.test.tsx`, `tests/components/Shop.buildings.test.tsx` | New test surfaces |

---

### Task 1: Building types, constants, config, initial state (additive)

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/economy.ts`
- Modify: `src/engine/gameEngine.ts` (initialGameState only)
- Modify: `src/engine/useGameEngine.ts` (hardening only)
- Test: `tests/engine/gameEngine.buildings.test.ts` (create), `tests/engine/economy.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/gameEngine.buildings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { BUILDING_DEFINITIONS, NO_BUILDINGS } from '../../src/engine/constants';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { GameState } from '../../src/engine/types';

/** Returns a state with the given buildings marked owned. */
export function withBuildings(
  state: GameState,
  owned: Partial<GameState['buildings']>,
): GameState {
  return { ...state, buildings: { ...state.buildings, ...owned } };
}

describe('initialGameState — buildings (019)', () => {
  it('starts with no buildings owned', () => {
    expect(initialGameState().buildings).toEqual(NO_BUILDINGS);
    expect(Object.values(initialGameState().buildings).every(v => v === false)).toBe(true);
  });
});

describe('DEFAULT_ECONOMY.buildings (019)', () => {
  it('defines exactly the five buildings with unique ids', () => {
    const ids = BUILDING_DEFINITIONS.map(d => d.id);
    expect(ids).toEqual(['toolshed', 'compost_bin', 'irrigation_well', 'scarecrow', 'farm_stand']);
    expect(new Set(ids).size).toBe(5);
  });

  it('gates only the toolshed to season 1', () => {
    const byId = Object.fromEntries(BUILDING_DEFINITIONS.map(d => [d.id, d.unlockSeason]));
    expect(byId.toolshed).toBe(1);
    for (const id of ['compost_bin', 'irrigation_well', 'scarecrow', 'farm_stand']) {
      expect(byId[id]).toBe(2);
    }
  });

  it('carries the base disaster knobs and building magnitudes', () => {
    expect(DEFAULT_ECONOMY.pestDestructionChance).toBe(0.5);
    expect(DEFAULT_ECONOMY.flashDroughtWindowDays).toBe(2);
    expect(DEFAULT_ECONOMY.buildings.seedDiscount).toBe(0.4);
    expect(DEFAULT_ECONOMY.buildings.exhaustionRecoveryDays).toBe(2);
    expect(DEFAULT_ECONOMY.buildings.droughtWindowDays).toBe(1);
    expect(DEFAULT_ECONOMY.buildings.pestDestructionChance).toBe(0.25);
    expect(DEFAULT_ECONOMY.buildings.yieldMultiplier).toBe(1.1);
    expect(DEFAULT_ECONOMY.buildings.definitions).toBe(BUILDING_DEFINITIONS);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/engine/gameEngine.buildings.test.ts`
Expected: FAIL — `NO_BUILDINGS` / `BUILDING_DEFINITIONS` not exported, `buildings` missing.

- [ ] **Step 3: Add types**

In `src/engine/types.ts`, after the `UpgradeTier` line (keep the ladder types for now — they go in Task 6):

```ts
export type BuildingId =
  | 'toolshed'
  | 'compost_bin'
  | 'irrigation_well'
  | 'scarecrow'
  | 'farm_stand';

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  emoji: string;
  cost: number;
  /** Plain-language card copy, not percentages alone. */
  description: string;
  /** First season the building is purchasable; 1 = from day 1. */
  unlockSeason: number;
}
```

In the `GameState` interface, after `market: MarketState;`:

```ts
  /** One-time farm buildings owned this run (019). All false on a new run. */
  buildings: Record<BuildingId, boolean>;
```

In the engine-result-types section:

```ts
export type BuyBuildingResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'invalid_id' | 'already_owned' | 'not_unlocked' | 'insufficient_funds' };
```

- [ ] **Step 4: Add constants**

In `src/engine/constants.ts` — import `BuildingDefinition` and `BuildingId` in the type import at the top, then after the `MARKET_*` scalars:

```ts
export const PEST_DESTRUCTION_CHANCE = 0.5;
export const FLASH_DROUGHT_WINDOW_DAYS = 2;
export const BUILDING_SEED_DISCOUNT = 0.4;
export const BUILDING_EXHAUSTION_RECOVERY_DAYS = 2;
export const BUILDING_DROUGHT_WINDOW_DAYS = 1;
export const BUILDING_PEST_DESTRUCTION_CHANCE = 0.25;
export const BUILDING_YIELD_MULTIPLIER = 1.1;
```

After the crop definitions block:

```ts
// ── Building definitions (019) ────────────────────────────────────────────────

export const BUILDING_DEFINITIONS: BuildingDefinition[] = [
  { id: 'toolshed',        name: 'Toolshed',        emoji: '🛠️', cost: 150, description: 'Seeds cost 40% less',                    unlockSeason: 1 },
  { id: 'compost_bin',     name: 'Compost Bin',     emoji: '🍂', cost: 150, description: 'Exhausted plots rest 2 days instead of 3', unlockSeason: 2 },
  { id: 'irrigation_well', name: 'Irrigation Well', emoji: '⛲', cost: 180, description: 'Flash droughts pass in 1 day instead of 2', unlockSeason: 2 },
  { id: 'scarecrow',       name: 'Scarecrow',       emoji: '🎃', cost: 220, description: 'Pests destroy half as many plots',          unlockSeason: 2 },
  { id: 'farm_stand',      name: 'Farm Stand',      emoji: '🧺', cost: 300, description: 'All harvests sell for 10% more',            unlockSeason: 2 },
];

/** Canonical "nothing owned" record — spread it, never mutate it. */
export const NO_BUILDINGS: Record<BuildingId, boolean> = {
  toolshed: false,
  compost_bin: false,
  irrigation_well: false,
  scarecrow: false,
  farm_stand: false,
};
```

- [ ] **Step 5: Extend `EconomyConfig`**

In `src/engine/economy.ts` — add to the imports from `./constants`: `PEST_DESTRUCTION_CHANCE, FLASH_DROUGHT_WINDOW_DAYS, BUILDING_SEED_DISCOUNT, BUILDING_EXHAUSTION_RECOVERY_DAYS, BUILDING_DROUGHT_WINDOW_DAYS, BUILDING_PEST_DESTRUCTION_CHANCE, BUILDING_YIELD_MULTIPLIER, BUILDING_DEFINITIONS`; add `BuildingDefinition` to the type import from `./types`. Then:

```ts
export interface BuildingsConfig {
  definitions: BuildingDefinition[];
  /** Toolshed: flat seed-cost discount (0..1). */
  seedDiscount: number;
  /** Compost Bin: natural recovery period when owned (base: EconomyConfig.exhaustionRecoveryDays). */
  exhaustionRecoveryDays: number;
  /** Irrigation Well: drought-window days added per event when owned (base: flashDroughtWindowDays). */
  droughtWindowDays: number;
  /** Scarecrow: per-plot pest destruction chance when owned (base: pestDestructionChance). */
  pestDestructionChance: number;
  /** Farm Stand: multiplicative yield factor when owned. */
  yieldMultiplier: number;
}
```

`EconomyConfig` gains three fields (keep `upgrades` for now):

```ts
  /** Base per-plot destruction chance on a Pest Infestation turn (no Scarecrow). */
  pestDestructionChance: number;
  /** Base days added to the drought window per Flash Drought event (no Well). */
  flashDroughtWindowDays: number;
  buildings: BuildingsConfig;
```

`DEFAULT_ECONOMY` gains:

```ts
  pestDestructionChance: PEST_DESTRUCTION_CHANCE,
  flashDroughtWindowDays: FLASH_DROUGHT_WINDOW_DAYS,
  buildings: {
    definitions: BUILDING_DEFINITIONS,
    seedDiscount: BUILDING_SEED_DISCOUNT,
    exhaustionRecoveryDays: BUILDING_EXHAUSTION_RECOVERY_DAYS,
    droughtWindowDays: BUILDING_DROUGHT_WINDOW_DAYS,
    pestDestructionChance: BUILDING_PEST_DESTRUCTION_CHANCE,
    yieldMultiplier: BUILDING_YIELD_MULTIPLIER,
  },
```

- [ ] **Step 6: Seed initial state + harden loads**

`src/engine/gameEngine.ts` — add `NO_BUILDINGS` to the `./constants` import; in `initialGameState`'s returned object, after `market: EMPTY_MARKET,`:

```ts
    buildings: { ...NO_BUILDINGS },
```

`src/engine/useGameEngine.ts` — add `NO_BUILDINGS` to the `./constants` import (it currently imports `UPGRADE_TIER_DEFINITIONS, MAX_UPGRADE_TIER, SCHEMA_VERSION`), add a normalizer next to `normalizeMarket`:

```ts
/** Normalize a raw `buildings` value from a save: missing/malformed → all false. */
function normalizeBuildings(raw: unknown): GameState['buildings'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...NO_BUILDINGS };
  const r = raw as Record<string, unknown>;
  return {
    toolshed: r.toolshed === true,
    compost_bin: r.compost_bin === true,
    irrigation_well: r.irrigation_well === true,
    scarecrow: r.scarecrow === true,
    farm_stand: r.farm_stand === true,
  };
}
```

and in `hardenCurrentSchema`, add to the returned object (next to `market`):

```ts
    buildings: normalizeBuildings(st.buildings),
```

Also import `GameState`'s `BuildingId` type where needed (`import type { ..., BuildingId } from './types';` — only if TS asks for it).

- [ ] **Step 7: Run tests to verify they pass, then the full suite**

Run: `npx vitest run tests/engine/gameEngine.buildings.test.ts` → PASS.
Run: `npm test && npm run lint` → all green. If `tests/engine/economy.test.ts` asserts the exact shape of `DEFAULT_ECONOMY`, extend its expectations with the three new fields (mirror the `market` assertions there).

- [ ] **Step 8: Commit**

```bash
git add src/engine tests/engine
git commit -m "019: T1 building types, constants, config, initial state (additive)"
```

---

### Task 2: `buyBuilding` engine function + season gate

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.buildings.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `tests/engine/gameEngine.buildings.test.ts`; add `buyBuilding` to its gameEngine import and `BuildingId` to a type import)

```ts
import { buyBuilding } from '../../src/engine/gameEngine';
import type { BuildingId } from '../../src/engine/types';

describe('buyBuilding (019)', () => {
  const rich = (day: number): GameState => ({ ...initialGameState(), currentDay: day, coinBalance: 1000 });

  it('buys the toolshed on day 1, deducting its cost', () => {
    const r = buyBuilding(rich(1), 'toolshed');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.buildings.toolshed).toBe(true);
      expect(r.state.coinBalance).toBe(1000 - 150);
    }
  });

  it('rejects an unknown id with invalid_id', () => {
    const r = buyBuilding(rich(1), 'barn' as BuildingId);
    expect(r).toEqual({ ok: false, error: 'invalid_id' });
  });

  it('rejects an owned building with already_owned (beats not_unlocked)', () => {
    const owned = withBuildings(rich(1), { scarecrow: true });
    expect(buyBuilding(owned, 'scarecrow')).toEqual({ ok: false, error: 'already_owned' });
  });

  it('gates season-2 buildings: day 20 rejects, day 21 accepts', () => {
    expect(buyBuilding(rich(20), 'scarecrow')).toEqual({ ok: false, error: 'not_unlocked' });
    expect(buyBuilding(rich(21), 'scarecrow').ok).toBe(true);
  });

  it('not_unlocked beats insufficient_funds', () => {
    const broke = { ...rich(1), coinBalance: 0 };
    expect(buyBuilding(broke, 'scarecrow')).toEqual({ ok: false, error: 'not_unlocked' });
  });

  it('rejects with insufficient_funds when unlocked but too poor', () => {
    const broke = { ...rich(21), coinBalance: 100 };
    expect(buyBuilding(broke, 'scarecrow')).toEqual({ ok: false, error: 'insufficient_funds' });
  });

  it('is always unlocked in the endless-season range (day 81+)', () => {
    expect(buyBuilding(rich(85), 'farm_stand').ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/engine/gameEngine.buildings.test.ts`
Expected: FAIL — `buyBuilding` is not exported.

- [ ] **Step 3: Implement** (in `src/engine/gameEngine.ts`, after `buyPlot`; add `BuildingId, BuyBuildingResult` to the type import)

```ts
// ── buyBuilding (019) ─────────────────────────────────────────────────────────

/**
 * Purchases a one-time farm building. Pure — no mutations.
 * Guard precedence (load-bearing): invalid_id → already_owned → not_unlocked →
 * insufficient_funds.
 */
export function buyBuilding(
  state: GameState,
  id: BuildingId,
  config: EconomyConfig = DEFAULT_ECONOMY,
): BuyBuildingResult {
  const def = config.buildings.definitions.find(d => d.id === id);
  if (!def) {
    return { ok: false, error: 'invalid_id' };
  }
  if (state.buildings[id]) {
    return { ok: false, error: 'already_owned' };
  }
  if (getSeasonForDay(state.currentDay, config).number < def.unlockSeason) {
    return { ok: false, error: 'not_unlocked' };
  }
  if (state.coinBalance < def.cost) {
    return { ok: false, error: 'insufficient_funds' };
  }
  return {
    ok: true,
    state: {
      ...state,
      coinBalance: state.coinBalance - def.cost,
      buildings: { ...state.buildings, [id]: true },
    },
  };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/engine/gameEngine.buildings.test.ts` → PASS. Then `npm test && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.buildings.test.ts
git commit -m "019: T2 buyBuilding with season gate and guard precedence"
```

---

### Task 3: Scarecrow + Irrigation Well hooks, base-knob extraction, `buildingsApplied`

**Files:**
- Modify: `src/engine/types.ts` (DailyLogEntry)
- Modify: `src/engine/gameEngine.ts` (processTurn)
- Test: `tests/engine/gameEngine.buildings.test.ts`; fixture updates in `tests/analytics/useAnalyticsEvents.test.tsx` and any component test building a `DailyLogEntry` literal

- [ ] **Step 1: Write the failing tests** (append; add `processTurn, plantSeed, buySeed` to imports as needed)

```ts
/** Plants a radish on plot 0 of a rich state (buys the seed first). */
function planted(state: GameState): GameState {
  const bought = buySeed({ ...state, coinBalance: 1000 }, 'radish', 1);
  if (!bought.ok) throw new Error('seed buy failed');
  const p = plantSeed(bought.state, 0, 'radish');
  if (!p.ok) throw new Error('plant failed');
  return p.state;
}

describe('Scarecrow — pest destruction chance (019)', () => {
  // rng() = 0.3 sits between the scarecrow chance (0.25) and the base (0.5):
  // destroyed without a scarecrow, spared with one.
  it('destroys the plot at the base 50% chance without a scarecrow', () => {
    const { state } = processTurn(planted(initialGameState()), 'pest_infestation', undefined, undefined, DEFAULT_ECONOMY, () => 0.3);
    expect(state.plots[0].pestDamaged).toBe(true);
  });

  it('spares the plot at the 25% chance with a scarecrow', () => {
    const s = withBuildings(planted(initialGameState()), { scarecrow: true });
    const { state } = processTurn(s, 'pest_infestation', undefined, undefined, DEFAULT_ECONOMY, () => 0.3);
    expect(state.plots[0].pestDamaged).toBe(false);
  });
});

describe('Irrigation Well — drought window (019)', () => {
  it('adds +2 days without the well', () => {
    const { state } = processTurn(planted(initialGameState()), 'flash_drought');
    expect(state.flashDroughtDaysRemaining).toBe(2);
  });

  it('adds +1 day with the well', () => {
    const s = withBuildings(planted(initialGameState()), { irrigation_well: true });
    const { state } = processTurn(s, 'flash_drought');
    expect(state.flashDroughtDaysRemaining).toBe(1);
  });

  it('buying the well mid-window does not shorten an active counter', () => {
    const midWindow = { ...initialGameState(), coinBalance: 1000, currentDay: 21, flashDroughtDaysRemaining: 2 };
    const r = buyBuilding(midWindow, 'irrigation_well');
    expect(r.ok && r.state.flashDroughtDaysRemaining).toBe(2);
  });
});

describe('buildingsApplied log field (019)', () => {
  it('records scarecrow on an owned pest turn', () => {
    const s = withBuildings(planted(initialGameState()), { scarecrow: true });
    const { log } = processTurn(s, 'pest_infestation', [], undefined);
    expect(log.buildingsApplied).toEqual(['scarecrow']);
  });

  it('records irrigation_well on an owned drought turn', () => {
    const s = withBuildings(planted(initialGameState()), { irrigation_well: true });
    const { log } = processTurn(s, 'flash_drought');
    expect(log.buildingsApplied).toEqual(['irrigation_well']);
  });

  it('is empty on disaster turns without the matching building, and on sunny turns', () => {
    expect(processTurn(planted(initialGameState()), 'pest_infestation', []).log.buildingsApplied).toEqual([]);
    const owned = withBuildings(planted(initialGameState()), { scarecrow: true, irrigation_well: true });
    expect(processTurn(owned, 'sunny').log.buildingsApplied).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/engine/gameEngine.buildings.test.ts` → FAIL (`buildingsApplied` missing; scarecrow test fails on the hardcoded 0.5).

- [ ] **Step 3: Implement**

`src/engine/types.ts` — add to `DailyLogEntry` after `marketAnnounced`:

```ts
  /** Disaster mitigations in effect this turn: subset of {irrigation_well, scarecrow}.
   *  Logged (not derived from live state) so reopening "Last Turn" after buying a
   *  building can't show a mitigation that didn't happen. */
  buildingsApplied: BuildingId[];
```

(add `BuildingId` to the file's own references — it is defined above in the same file).

`src/engine/gameEngine.ts`, inside `processTurn`:

Replace the pest roll line (`: rng() < 0.5;`) with:

```ts
        : rng() < (state.buildings.scarecrow
            ? config.buildings.pestDestructionChance
            : config.pestDestructionChance);
```

Replace the flash-drought increment (`? state.flashDroughtDaysRemaining + 2`) with:

```ts
    ? state.flashDroughtDaysRemaining
      + (state.buildings.irrigation_well
          ? config.buildings.droughtWindowDays
          : config.flashDroughtWindowDays)
```

After the Step 2b block, assemble the applied list:

```ts
  // 019: disaster mitigations in effect this turn (for the Day Summary banner)
  const buildingsApplied: BuildingId[] = [];
  if (weatherId === 'pest_infestation' && state.buildings.scarecrow) buildingsApplied.push('scarecrow');
  if (weatherId === 'flash_drought' && state.buildings.irrigation_well) buildingsApplied.push('irrigation_well');
```

Add `buildingsApplied,` to **both** `DailyLogEntry` object literals (the bankruptcy-path log and the end-of-turn log). Add `BuildingId` to the gameEngine type import.

- [ ] **Step 4: Fix `DailyLogEntry` fixtures across tests**

Run: `grep -rln "flashDroughtDaysAfter" tests/` — every file constructing a log literal (at minimum `tests/analytics/useAnalyticsEvents.test.tsx`'s `makeLog`, plus any component tests like `DisasterBanner.test.tsx` / `DailyLog.test.tsx` / `DaySummaryModal.test.tsx` that build logs) gains `buildingsApplied: [],` in the literal.

- [ ] **Step 5: Run tests to verify pass** — `npx vitest run tests/engine/gameEngine.buildings.test.ts` → PASS, then `npm test && npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/engine tests
git commit -m "019: T3 scarecrow + irrigation well hooks, buildingsApplied log field"
```

---

### Task 4: Compost Bin hook (natural recovery 3 → 2)

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.buildings.test.ts`

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe('Compost Bin — natural recovery (019)', () => {
  /** A state whose plot 0 went exhausted on day `since`, currently at day `now`. */
  const exhaustedState = (now: number, since: number): GameState => {
    const s = initialGameState();
    return {
      ...s,
      currentDay: now,
      coinBalance: 1000,
      plots: s.plots.map(p => (p.id === 0 ? { ...p, exhaustedSinceDay: since } : p)),
    };
  };

  it('recovers after 3 days without the compost bin', () => {
    // day 6 → turn completes into day 7; 7 - 4 = 3 >= 3 recovers
    const { state } = processTurn(exhaustedState(6, 4), 'sunny');
    expect(state.plots[0].exhaustedSinceDay).toBeNull();
    // day 5 → day 6; 6 - 4 = 2 < 3 stays exhausted
    const early = processTurn(exhaustedState(5, 4), 'sunny');
    expect(early.state.plots[0].exhaustedSinceDay).toBe(4);
  });

  it('recovers after 2 days with the compost bin (immediate benefit mid-rest)', () => {
    const owned = withBuildings(exhaustedState(5, 4), { compost_bin: true });
    const { state } = processTurn(owned, 'sunny'); // day 5 → 6; 6 - 4 = 2 >= 2 recovers
    expect(state.plots[0].exhaustedSinceDay).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — the compost case FAILS (still 3 days).

- [ ] **Step 3: Implement** — in `processTurn` Step 8.5, replace the comparison line
`if (currentDay - plot.exhaustedSinceDay >= config.exhaustionRecoveryDays) {` with:

```ts
  const effectiveRecoveryDays = state.buildings.compost_bin
    ? config.buildings.exhaustionRecoveryDays
    : config.exhaustionRecoveryDays;
```

(placed just above the `recoveredPlots` map) and use `>= effectiveRecoveryDays` in the check.

- [ ] **Step 4: Run tests to verify pass** — buildings file, then `npm test && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.buildings.test.ts
git commit -m "019: T4 compost bin shortens natural recovery to 2 days"
```

---

### Task 5: Farm Stand hook (+10% yields)

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.buildings.test.ts`

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe('Farm Stand — yield multiplier (019)', () => {
  it('multiplies harvest yield by 1.1 with a single floor at the end', () => {
    // radish 12 × sunny 1.0 × 1.1 = 13.2 → 13
    const s = withBuildings(planted(initialGameState()), { farm_stand: true });
    const { log } = processTurn(s, 'sunny');
    expect(log.harvests[0].adjustedYield).toBe(13);
  });

  it('stacks multiplicatively with weather and market', () => {
    // radish 12 × warm_breeze 1.2 × shortage 1.4 × 1.1 = 22.176 → 22
    const base = withBuildings(planted(initialGameState()), { farm_stand: true });
    const s: GameState = {
      ...base,
      market: { active: { cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }, pending: null },
    };
    const { log } = processTurn(s, 'warm_breeze');
    expect(log.harvests[0].adjustedYield).toBe(22);
  });

  it('leaves yields untouched without the farm stand', () => {
    const { log } = processTurn(planted(initialGameState()), 'sunny');
    expect(log.harvests[0].adjustedYield).toBe(12);
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — in `processTurn` Step 3, replace the yield line:

```ts
    const stallMod = state.buildings.farm_stand ? config.buildings.yieldMultiplier : 1;
    const adjustedYield = coins(crop.baseYield * weather.multiplier * marketMod * stallMod);
```

(`stallMod` computed once above the `harvestedPlots` map, since it doesn't vary per plot.)

- [ ] **Step 4: Run tests to verify pass** — buildings file, then `npm test && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.buildings.test.ts
git commit -m "019: T5 farm stand +10% yield multiplier"
```

---

### Task 6: The ladder swap — remove tool tiers, Toolshed discount, schema 9, migrations, sim bots

This is the atomic task: everything referencing `upgradeTier` changes together so the tree stays green. Work through the checklist file by file, then fix remaining compile errors surfaced by `npx tsc -b --noEmit` before running tests.

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/constants.ts`, `src/engine/economy.ts`, `src/engine/gameEngine.ts`, `src/engine/useGameEngine.ts`
- Modify: `src/components/Shop.tsx`, `src/components/GameBoard.tsx`, `src/App.tsx`
- Delete: `src/components/UpgradeCard.tsx`
- Modify: `scripts/sim/strategies.ts`
- Test: create `tests/engine/useGameEngine.buildings.test.ts`; modify `tests/engine/gameEngine.test.ts`, `tests/engine/useGameEngine.test.ts`, `tests/engine/economy.test.ts`, `tests/sim/strategies.test.ts`, component tests that pass upgrade props

- [ ] **Step 1: Write the failing migration + toolshed tests**

Create `tests/engine/useGameEngine.buildings.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState, computeSeedCost } from '../../src/engine/gameEngine';
import { SCHEMA_VERSION, NO_BUILDINGS } from '../../src/engine/constants';

const STORAGE_KEY = 'pixel-parsnips-state';

/** A minimal v8 envelope: schema-8 state still carrying upgradeTier, no buildings. */
function v8State(upgradeTier: number): Record<string, unknown> {
  const { buildings: _b, ...rest } = initialGameState() as unknown as Record<string, unknown>;
  return { ...rest, schemaVersion: 8, upgradeTier };
}

beforeEach(() => localStorage.clear());

describe('schema 8 → 9 migration (019 — ladder to buildings)', () => {
  it.each([
    [0, false],
    [1, true],
    [2, true],
    [3, true],
  ])('maps upgradeTier %i to toolshed=%s and drops the field', (tier, ownsToolshed) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 8, state: v8State(tier) }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.buildings).toEqual({ ...NO_BUILDINGS, toolshed: ownsToolshed });
    expect('upgradeTier' in (result.current.state as unknown as Record<string, unknown>)).toBe(false);
  });

  it('hardens a malformed buildings field on a current-schema save to all-false', () => {
    const st = { ...(initialGameState() as unknown as Record<string, unknown>), buildings: 'garbage' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: st }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.buildings).toEqual(NO_BUILDINGS);
  });
});

describe('computeSeedCost — toolshed (019)', () => {
  it('charges base price without the toolshed and 40% off with it', () => {
    expect(computeSeedCost('pumpkin', { ...NO_BUILDINGS })).toBe(20);
    expect(computeSeedCost('pumpkin', { ...NO_BUILDINGS, toolshed: true })).toBe(12);
    expect(computeSeedCost('radish', { ...NO_BUILDINGS, toolshed: true })).toBe(3); // floor(5 × 0.6)
  });
});
```

Run: `npx vitest run tests/engine/useGameEngine.buildings.test.ts` → FAIL (v8 is the current schema; `computeSeedCost` still takes a tier).

- [ ] **Step 2: Engine + constants + economy removals**

`src/engine/constants.ts`:
- `SCHEMA_VERSION` 8 → **9**.
- Delete `MAX_UPGRADE_TIER` and the entire `UPGRADE_TIER_DEFINITIONS` block; drop `UpgradeTierDefinition` from the type import.

`src/engine/types.ts`:
- Delete `UpgradeTier`, `UpgradeTierDefinition`, `UpgradeResult`.
- Delete `upgradeTier: UpgradeTier;` from `GameState`.

`src/engine/economy.ts`:
- Delete the `upgrades: UpgradeTierDefinition[];` field, its `DEFAULT_ECONOMY` entry, and the `UPGRADE_TIER_DEFINITIONS` / `UpgradeTierDefinition` imports.

`src/engine/gameEngine.ts`:
- Delete `upgradeTier: 0,` from `initialGameState`.
- Delete the whole `buyUpgrade` function and its `UpgradeResult`/`UpgradeTier` imports.
- Replace `computeSeedCost`:

```ts
/** Returns the current purchase price for one seed, applying the Toolshed discount. */
export function computeSeedCost(
  cropId: CropId,
  buildings: GameState['buildings'],
  config: EconomyConfig = DEFAULT_ECONOMY,
): number {
  const crop = config.crops[cropId];
  if (!buildings.toolshed) return crop.baseSeedCost;
  return coins(crop.baseSeedCost * (1 - config.buildings.seedDiscount));
}
```

- In `buySeed`, the unit-cost line becomes `const unitCost = computeSeedCost(cropId, state.buildings, config);`.

- [ ] **Step 3: `useGameEngine` — migration chain + API swap**

- Remove the `UPGRADE_TIER_DEFINITIONS, MAX_UPGRADE_TIER` import and `engineBuyUpgrade`.
- Add the ladder mapper next to `normalizeBuildings`:

```ts
/** v8 → v9: any owned tool tier becomes the Toolshed; the tier field is dropped. */
function migrateLadderToBuildings(st: Record<string, unknown>): Record<string, unknown> {
  const tier = typeof st.upgradeTier === 'number' ? st.upgradeTier : 0;
  const { upgradeTier: _dropped, ...rest } = st;
  return { ...rest, buildings: { ...NO_BUILDINGS, toolshed: tier >= 1 } };
}
```

- In `migrateState`, add the v8 branch **above** the v7 branch, and thread the mapper through every older branch (each already spreads `st` — wrap that spread):

```ts
  // Schema 8 → 9 — collapse the tool ladder into the Toolshed building (019)
  if (parsed.schemaVersion === 8) {
    console.info('[PixelParsnips] Migrating save from v8 to v9 (Farm Buildings — tool tiers become the Toolshed; T1 owners gain a little, T3 owners lose the last 20%).');
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
    });
  }
```

For v7/v6/v5/v4/v3 branches: wrap the existing spread, e.g. the v7 branch becomes
`...migrateLadderToBuildings(st),` instead of `...st,` (keep each branch's other added fields).
Note `hardenCurrentSchema` already normalizes `buildings` (Task 1), which double-covers the mapper's output.

- Remove the `buyUpgrade` and `getNextUpgradeCost` callbacks and their entries in `GameEngineHook` + the returned object.
- `getSeedPrice` becomes:

```ts
  const getSeedPrice = useCallback(
    (cropId: CropId): number => computeSeedCost(cropId, state.buildings),
    [state.buildings]
  );
```

- [ ] **Step 4: UI deletions**

- Delete `src/components/UpgradeCard.tsx` (`git rm src/components/UpgradeCard.tsx`).
- `src/components/Shop.tsx`: remove the `UpgradeCard` import, the `UPGRADE_TIER_DEFINITIONS` import, the `upgradeTier` / `onBuyUpgrade` / `getNextUpgradeCost` props, the `ownedTiers`/`nextTier`/`futureTiers` computation, and both the "Active Buffs" and "Tools" sections (the tray returns with buildings in Task 8). The Shop is Seeds + Supplies only after this step.
- `src/components/GameBoard.tsx`: remove the `onBuyUpgrade` / `getNextUpgradeCost` props (interface + destructuring) and the `upgradeTier={state.upgradeTier}` / `onBuyUpgrade` / `getNextUpgradeCost` lines in the `<Shop … />` invocation.
- `src/App.tsx`: remove `onBuyUpgrade={engine.buyUpgrade}` and `getNextUpgradeCost={engine.getNextUpgradeCost}`.

- [ ] **Step 5: Sim strategies swap** (`scripts/sim/strategies.ts`)

- Replace the `buyUpgrade, computeSeedCost` imports with `buyBuilding, computeSeedCost`; add `BuildingId` to the type import.
- `fillBoard`'s cost line becomes `const cost = computeSeedCost(crop, s.buildings, config);`.
- Replace `maybeUpgrade` entirely:

```ts
/** Priority order for building purchases; a retune candidate (Task 12). */
const BUILDING_PRIORITY: BuildingId[] = [
  'toolshed', 'compost_bin', 'irrigation_well', 'scarecrow', 'farm_stand',
];

/** Buy buildings in priority order while comfortably affordable (lease ×2 buffer).
 *  Locked or unknown buildings are skipped, not waited for. */
export function maybeBuyBuildings(
  state: GameState,
  config: EconomyConfig,
  ids: BuildingId[] = BUILDING_PRIORITY,
): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  for (const id of ids) {
    if (s.buildings[id]) continue;
    const def = config.buildings.definitions.find(d => d.id === id);
    if (!def) continue;
    if (s.coinBalance - def.cost < lease * 2) continue;
    const r = buyBuilding(s, id, config);
    if (r.ok) s = r.state;
  }
  return s;
}
```

- `single` becomes: `fillBoard(maybeBuyBuildings(state, config, ['toolshed']), config, () => crop)`.
- `smartMixed`'s first line becomes `let s = maybeBuyBuildings(state, config);`.

- [ ] **Step 6: Write the strategy unit tests** (append to `tests/sim/strategies.test.ts`, matching its import style)

```ts
import { maybeBuyBuildings } from '../../scripts/sim/strategies';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('maybeBuyBuildings (019)', () => {
  it('buys in priority order while the lease buffer holds', () => {
    const rich = { ...initialGameState(), currentDay: 21, coinBalance: 340 };
    const s = maybeBuyBuildings(rich, DEFAULT_ECONOMY);
    // 340 → toolshed (150) leaves 190 ≥ 22×2; → compost (150) leaves 40 < 44 stops there
    expect(s.buildings.toolshed).toBe(true);
    expect(s.buildings.compost_bin).toBe(true);
    expect(s.buildings.irrigation_well).toBe(false);
  });

  it('skips locked buildings in season 1 instead of waiting', () => {
    const rich = { ...initialGameState(), currentDay: 1, coinBalance: 1000 };
    const s = maybeBuyBuildings(rich, DEFAULT_ECONOMY);
    expect(s.buildings.toolshed).toBe(true);
    expect(s.buildings.scarecrow).toBe(false);
  });

  it('honors a restricted id list (single-crop bots buy toolshed only)', () => {
    const rich = { ...initialGameState(), currentDay: 21, coinBalance: 5000 };
    const s = maybeBuyBuildings(rich, DEFAULT_ECONOMY, ['toolshed']);
    expect(s.buildings.toolshed).toBe(true);
    expect(Object.entries(s.buildings).filter(([, v]) => v)).toHaveLength(1);
  });
});
```

- [ ] **Step 7: Sweep the remaining references green**

Run `npx tsc -b --noEmit` and `grep -rn "upgradeTier\|buyUpgrade\|UPGRADE_TIER\|MAX_UPGRADE_TIER\|UpgradeCard\|getNextUpgradeCost" src tests scripts` — fix every hit:
- `tests/engine/gameEngine.test.ts`: delete the `buyUpgrade` describe blocks; rewrite `computeSeedCost` cases to the new signature (tier-discount expectations are superseded by the Toolshed cases in `useGameEngine.buildings.test.ts` — keep one base-price assertion here). Remove `upgradeTier` from any state literals.
- `tests/engine/useGameEngine.test.ts` and other tests with `upgradeTier` in fixtures: drop the field (or spread `initialGameState()`); replace `result.current.buyUpgrade()` assertions with `buyBuilding`-based equivalents where the test's point is "action returns true/false", otherwise delete.
- `tests/engine/economy.test.ts`: remove `upgrades` assertions.
- Component tests passing `upgradeTier`/`onBuyUpgrade`/`getNextUpgradeCost` props (check `GameBoard.test.tsx`): remove those props; delete any "Tools section" render assertions.

- [ ] **Step 8: Run the full suite** — `npm test && npm run lint` → all green, including the Step-1 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "019: T6 collapse tool ladder into Toolshed building (schema 9)"
```

---

### Task 7: Dev flags + `resolveEconomy` + config threading in the hook

**Files:**
- Create: `src/devFlags.ts`
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/devFlags.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/devFlags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDevFlags, resolveEconomy } from '../src/devFlags';
import { DEFAULT_ECONOMY } from '../src/engine/economy';

describe('parseDevFlags', () => {
  it('parses a comma list in dev mode', () => {
    expect(parseDevFlags('?dev=buildings-s1,foo', true)).toEqual(new Set(['buildings-s1', 'foo']));
  });

  it('returns empty outside dev mode regardless of the URL', () => {
    expect(parseDevFlags('?dev=buildings-s1', false)).toEqual(new Set());
  });

  it('returns empty when the param is absent or blank', () => {
    expect(parseDevFlags('', true)).toEqual(new Set());
    expect(parseDevFlags('?dev=', true)).toEqual(new Set());
  });
});

describe('resolveEconomy', () => {
  it('returns DEFAULT_ECONOMY untouched without the flag', () => {
    expect(resolveEconomy(new Set())).toBe(DEFAULT_ECONOMY);
  });

  it('maps every building to unlockSeason 1 with buildings-s1', () => {
    const eco = resolveEconomy(new Set(['buildings-s1']));
    expect(eco.buildings.definitions.every(d => d.unlockSeason === 1)).toBe(true);
    // and does not mutate the default
    expect(DEFAULT_ECONOMY.buildings.definitions.some(d => d.unlockSeason === 2)).toBe(true);
  });
});
```

Run: `npx vitest run tests/devFlags.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `src/devFlags.ts`**

```ts
import { DEFAULT_ECONOMY, type EconomyConfig } from './engine/economy';

/**
 * Dev-only feature switches parsed from `?dev=flag1,flag2`.
 * `parseDevFlags` is the pure core (unit-testable); `getDevFlags` binds it to the
 * real URL and build mode. Production builds always see an empty set.
 */
export function parseDevFlags(search: string, isDev: boolean): Set<string> {
  if (!isDev) return new Set();
  const raw = new URLSearchParams(search).get('dev') ?? '';
  return new Set(raw.split(',').map(f => f.trim()).filter(Boolean));
}

export function getDevFlags(): Set<string> {
  return parseDevFlags(
    typeof location !== 'undefined' ? location.search : '',
    import.meta.env.DEV,
  );
}

/** The economy the UI runs on: DEFAULT_ECONOMY unless a dev flag overrides it.
 *  `buildings-s1` unlocks every building in season 1 for manual playtesting. */
export function resolveEconomy(flags: Set<string> = getDevFlags()): EconomyConfig {
  if (!flags.has('buildings-s1')) return DEFAULT_ECONOMY;
  return {
    ...DEFAULT_ECONOMY,
    buildings: {
      ...DEFAULT_ECONOMY.buildings,
      definitions: DEFAULT_ECONOMY.buildings.definitions.map(d => ({ ...d, unlockSeason: 1 })),
    },
  };
}
```

- [ ] **Step 3: Thread the resolved economy through `useGameEngine`**

In `src/engine/useGameEngine.ts`:

```ts
import { resolveEconomy } from '../devFlags';

/** Resolved once per session; the URL can't change mid-session without a reload. */
const ECONOMY = resolveEconomy();
```

Pass `ECONOMY` as the config argument to **every** engine call in the hook:
`initialGameState(ECONOMY)` (in `loadState`'s fallbacks, `restart`, `endRunVictory`),
`processTurn(stateRef.current, weatherOverride, undefined, undefined, ECONOMY)`,
`plantSeed(…, ECONOMY)`, `engineBuySeed(…, ECONOMY)`, `engineBuyFertilizer(…, ECONOMY)`,
`engineApplyFertilizer(…, ECONOMY)`, `engineClearPestDamage(…, ECONOMY)`,
`engineBuyPlot(…, ECONOMY)`, `engineGetNextPlotPrice(state, ECONOMY)`,
`computeSeedCost(cropId, state.buildings, ECONOMY)`.
Migrations keep using `DEFAULT_ECONOMY` constants (a dev flag must not alter how saves migrate).

- [ ] **Step 4: Run** — `npx vitest run tests/devFlags.test.ts` → PASS, then `npm test && npm run lint` (hook behavior is unchanged when no flag is set, so the suite stays green).

- [ ] **Step 5: Commit**

```bash
git add src/devFlags.ts src/engine/useGameEngine.ts tests/devFlags.test.ts
git commit -m "019: T7 dev flags + resolveEconomy, config-driven useGameEngine"
```

---

### Task 8: Buildings UI — BuildingCard, shelf, teaser, owned tray

**Files:**
- Create: `src/components/BuildingCard.tsx`
- Modify: `src/components/Shop.tsx`, `src/components/GameBoard.tsx`, `src/App.tsx`, `src/engine/useGameEngine.ts`
- Test: `tests/components/BuildingCard.test.tsx`, `tests/components/Shop.buildings.test.tsx` (create both)

- [ ] **Step 1: Hook API** — in `src/engine/useGameEngine.ts` add imports (`buyBuilding as engineBuyBuilding`, `getSeasonForDay` is already imported, types `BuildingId, BuildingDefinition`), the interface entries, and the callbacks:

```ts
export interface BuildingCardData {
  def: BuildingDefinition;
  owned: boolean;
  unlocked: boolean;
}
```

`GameEngineHook` gains:

```ts
  buyBuilding: (id: BuildingId) => boolean;
  getBuildingCards: () => BuildingCardData[];
```

Implementation (next to `buyPlot`):

```ts
  const buyBuilding = useCallback((id: BuildingId): boolean => {
    const result = engineBuyBuilding(stateRef.current, id, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('buy_building');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const getBuildingCards = useCallback((): BuildingCardData[] => {
    const season = getSeasonForDay(state.currentDay, ECONOMY).number;
    return ECONOMY.buildings.definitions.map(def => ({
      def,
      owned: state.buildings[def.id],
      unlocked: season >= def.unlockSeason,
    }));
  }, [state.currentDay, state.buildings]);
```

Add both to the returned object.

- [ ] **Step 2: Write the failing component tests**

Create `tests/components/BuildingCard.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuildingCard } from '../../src/components/BuildingCard';
import { BUILDING_DEFINITIONS } from '../../src/engine/constants';

const scarecrow = BUILDING_DEFINITIONS.find(d => d.id === 'scarecrow')!;

describe('BuildingCard', () => {
  it('renders name, description, and a buy button with the price', () => {
    const onBuy = vi.fn();
    render(<BuildingCard def={scarecrow} owned={false} canAfford={true} onBuy={onBuy} />);
    expect(screen.getByText('Scarecrow')).toBeInTheDocument();
    expect(screen.getByText('Pests destroy half as many plots')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Buy Scarecrow for 220 coins/ }));
    expect(onBuy).toHaveBeenCalledWith('scarecrow');
  });

  it('disables the buy button when unaffordable', () => {
    render(<BuildingCard def={scarecrow} owned={false} canAfford={false} onBuy={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Buy Scarecrow/ })).toBeDisabled();
  });

  it('renders the compact owned variant without a button', () => {
    render(<BuildingCard def={scarecrow} owned={true} canAfford={false} onBuy={vi.fn()} />);
    expect(screen.getByText('Scarecrow')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
```

Create `tests/components/Shop.buildings.test.tsx` (Shop props mirror the existing `ShopProps` — fill required ones minimally):

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Shop } from '../../src/components/Shop';
import { BUILDING_DEFINITIONS } from '../../src/engine/constants';
import type { BuildingCardData } from '../../src/engine/useGameEngine';

function shopProps(buildingCards: BuildingCardData[]) {
  return {
    coinBalance: 500,
    seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
    fertilizerInventory: 0,
    selectedCrop: null,
    getSeedPrice: () => 5,
    onBuySeed: vi.fn(),
    onSelectCrop: vi.fn(),
    onBuyFertilizer: vi.fn(),
    marketActive: null,
    buildingCards,
    onBuyBuilding: vi.fn(),
  };
}

const cards = (season: number): BuildingCardData[] =>
  BUILDING_DEFINITIONS.map(def => ({ def, owned: false, unlocked: season >= def.unlockSeason }));

describe('Shop — buildings shelf (019)', () => {
  it('season 1: shows the toolshed and one teaser cell, no gated buildings', () => {
    render(<Shop {...shopProps(cards(1))} />);
    expect(screen.getByText('Toolshed')).toBeInTheDocument();
    expect(screen.getByText(/New stock arrives in Season 2/)).toBeInTheDocument();
    expect(screen.queryByText('Scarecrow')).toBeNull();
  });

  it('season 2: shows all five, teaser gone', () => {
    render(<Shop {...shopProps(cards(2))} />);
    expect(screen.getByText('Scarecrow')).toBeInTheDocument();
    expect(screen.queryByText(/New stock arrives/)).toBeNull();
  });

  it('owned buildings move to the Active Buffs tray and off the shelf', () => {
    const owned = cards(2).map(c => (c.def.id === 'toolshed' ? { ...c, owned: true } : c));
    render(<Shop {...shopProps(owned)} />);
    const tray = screen.getByLabelText('Active Buffs');
    expect(tray).toContainElement(screen.getByText('Toolshed'));
  });

  it('hides the shelf entirely when everything is owned', () => {
    const allOwned = cards(2).map(c => ({ ...c, owned: true }));
    render(<Shop {...shopProps(allOwned)} />);
    expect(screen.queryByLabelText('Buildings')).toBeNull();
  });
});
```

Run both → FAIL (components/props missing).

- [ ] **Step 3: Implement `src/components/BuildingCard.tsx`** (styling mirrors the deleted UpgradeCard)

```tsx
import type { BuildingDefinition, BuildingId } from '../engine/types';
import { Coin } from './Coin';

interface BuildingCardProps {
  def: BuildingDefinition;
  owned: boolean;
  canAfford: boolean;
  onBuy: (id: BuildingId) => void;
}

export function BuildingCard({ def, owned, canAfford, onBuy }: BuildingCardProps) {
  // Compact tray-item style for owned buildings (Active Buffs section)
  if (owned) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-farm-grass/20 border border-farm-grass/40">
        <span className="text-farm-grass text-sm">✓</span>
        <span aria-hidden="true" className="text-sm">{def.emoji}</span>
        <p className="font-pixel text-body text-farm-parchment">{def.name}</p>
        <p className="text-body text-farm-stone ml-auto">{def.description}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded bg-farm-parchment border border-farm-stone">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">{def.emoji}</span>
        <div>
          <p className="font-pixel text-body text-farm-ink">{def.name}</p>
          <p className="text-body text-farm-stone">{def.description}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Buy ${def.name} for ${def.cost} coins`}
        disabled={!canAfford}
        onClick={() => onBuy(def.id)}
        className="
          px-2 py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-body
          bg-farm-gold text-farm-ink
          hover:bg-farm-grass hover:text-farm-parchment
          active:scale-95 active:brightness-90
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all shrink-0
        "
      >
        {def.cost}<Coin />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Shop shelf + teaser + tray** — in `src/components/Shop.tsx`:

Imports: `import { BuildingCard } from './BuildingCard';`, `import type { BuildingCardData } from '../engine/useGameEngine';`, `import type { BuildingId } from '../engine/types';`.

`ShopProps` gains:

```ts
  buildingCards: BuildingCardData[];
  onBuyBuilding: (id: BuildingId) => void;
```

Inside the component, compute:

```tsx
  const ownedBuildings = buildingCards.filter(c => c.owned);
  const shelfBuildings = buildingCards.filter(c => !c.owned && c.unlocked);
  const hasLockedBuildings = buildingCards.some(c => !c.owned && !c.unlocked);
```

Restore the Active Buffs tray (after the Supplies section, where it lived pre-Task-6), now for buildings:

```tsx
      {ownedBuildings.length > 0 && (
        <section aria-label="Active Buffs">
          <p className="font-pixel text-caption text-farm-gold/60 tracking-widest uppercase mb-2">Active Buffs</p>
          <div className="flex flex-col gap-1">
            {ownedBuildings.map(c => (
              <BuildingCard key={c.def.id} def={c.def} owned={true} canAfford={false} onBuy={() => {}} />
            ))}
          </div>
        </section>
      )}
```

Then the Buildings shelf (where the Tools section used to be):

```tsx
      {(shelfBuildings.length > 0 || hasLockedBuildings) && (
        <section aria-label="Buildings">
          <Awning />
          <p className="font-pixel text-[9px] text-farm-gold/60 tracking-widest uppercase mb-2">Buildings</p>
          <div className="flex flex-col gap-2">
            {shelfBuildings.map(c => (
              <BuildingCard
                key={c.def.id}
                def={c.def}
                owned={false}
                canAfford={coinBalance >= c.def.cost}
                onBuy={onBuyBuilding}
              />
            ))}
            {hasLockedBuildings && (
              <div className="flex items-center justify-center p-3 rounded bg-[#261808]/60 border border-dashed border-[#5C3D1E] text-farm-stone text-body">
                🔒 New stock arrives in Season 2
              </div>
            )}
          </div>
          <ShelfLedge />
        </section>
      )}
```

- [ ] **Step 5: Wire the props** — `GameBoard.tsx` props interface gains `buildingCards: BuildingCardData[];` and `onBuyBuilding: (id: BuildingId) => boolean;`, destructure and forward both into `<Shop … buildingCards={buildingCards} onBuyBuilding={onBuyBuilding} …>`. `App.tsx` passes `buildingCards={engine.getBuildingCards()}` and `onBuyBuilding={engine.buyBuilding}` to `<GameBoard …>`.

- [ ] **Step 6: Run** — both new component test files → PASS; `npm test && npm run lint` green (update `GameBoard.test.tsx` fixtures with the two new required props).

- [ ] **Step 7: Commit**

```bash
git add src/components src/engine/useGameEngine.ts src/App.tsx tests/components
git commit -m "019: T8 buildings shelf, teaser cell, owned tray in the shop"
```

---

### Task 9: Compost countdown fix in PlotCard

**Files:**
- Modify: `src/components/PlotCard.tsx`, `src/components/FarmGrid.tsx`, `src/components/GameBoard.tsx`, `src/App.tsx`, `src/engine/useGameEngine.ts`
- Test: `tests/components/PlotCard.test.tsx`

- [ ] **Step 1: Write the failing test** (append to `tests/components/PlotCard.test.tsx`, following its existing render helpers — it renders `PlotCard` with an exhausted plot; add a case passing `recoveryDays={2}`)

```tsx
it('shows the compost-shortened countdown when recoveryDays is 2', () => {
  // plot exhausted on day 4, current day 5 → 2 - (5 - 4) = 1 day until recovery
  render(
    <PlotCard
      plot={{ ...basePlot, exhaustedSinceDay: 4 }}
      currentDay={5}
      recoveryDays={2}
    />,
  );
  expect(screen.getByLabelText(/1 day until recovery/)).toBeInTheDocument();
});
```

(Reuse the file's existing `basePlot`/render pattern; if it names things differently, adapt the fixture, not the assertion.)

- [ ] **Step 2: Run to verify failure** — the prop doesn't exist yet.

- [ ] **Step 3: Implement**

- `PlotCard.tsx`: add `recoveryDays?: number;` to `PlotCardProps` (and to the inner `LockedPlot`-adjacent exhausted branch's props if split); default it near the top: `recoveryDays = EXHAUSTION_RECOVERY_DAYS`. The countdown line becomes `daysUntilRecovery={recoveryDays - (currentDay - plot.exhaustedSinceDay)}`.
- `FarmGrid.tsx`: add `recoveryDays?: number;` to `FarmGridProps`, destructure, forward to each `<PlotCard … recoveryDays={recoveryDays} />`.
- `useGameEngine.ts`: expose the effective value —

```ts
  const getRecoveryDays = useCallback(
    () => (state.buildings.compost_bin
      ? ECONOMY.buildings.exhaustionRecoveryDays
      : ECONOMY.exhaustionRecoveryDays),
    [state.buildings.compost_bin]
  );
```

add `getRecoveryDays: () => number;` to `GameEngineHook` and the return.
- `GameBoard.tsx`: accept `recoveryDays: number;`, forward to `<FarmGrid recoveryDays={recoveryDays} …>`. `App.tsx`: `recoveryDays={engine.getRecoveryDays()}`.

- [ ] **Step 4: Run** — PlotCard tests PASS; `npm test && npm run lint` green.

- [ ] **Step 5: Commit**

```bash
git add src/components src/engine/useGameEngine.ts src/App.tsx tests/components/PlotCard.test.tsx
git commit -m "019: T9 plot recovery countdown honors compost bin"
```

---

### Task 10: DisasterBanner mitigation sub-lines

**Files:**
- Modify: `src/components/DisasterBanner.tsx`
- Test: `tests/components/DisasterBanner.test.tsx`

- [ ] **Step 1: Write the failing tests** (append; the file already builds `DailyLogEntry` fixtures — they gained `buildingsApplied: []` in Task 3)

```tsx
it('appends the scarecrow line on a mitigated pest turn', () => {
  render(<DisasterBanner log={{ ...pestLog, buildingsApplied: ['scarecrow'] }} />);
  expect(screen.getByText(/Your Scarecrow thinned the swarm/)).toBeInTheDocument();
});

it('derives the drought window from the log and appends the well line', () => {
  const log = { ...droughtLog, flashDroughtDaysAfter: 1, buildingsApplied: ['irrigation_well' as const] };
  render(<DisasterBanner log={log} />);
  expect(screen.getByText(/next 1 day grow at half speed/)).toBeInTheDocument();
  expect(screen.getByText(/Your Irrigation Well shortened the drought/)).toBeInTheDocument();
});

it('shows no mitigation lines when buildingsApplied is empty', () => {
  render(<DisasterBanner log={{ ...droughtLog, flashDroughtDaysAfter: 2, buildingsApplied: [] }} />);
  expect(screen.getByText(/next 2 days grow at half speed/)).toBeInTheDocument();
  expect(screen.queryByText(/Irrigation Well/)).toBeNull();
});
```

(`pestLog` / `droughtLog` = the file's existing fixtures for those weather ids; create them from its log-builder if absent.)

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement** — in `DisasterBanner.tsx`, `bodyLines` becomes:

```ts
function bodyLines(log: DailyLogEntry): string[] {
  const lines: string[] = (() => {
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
      case 'flash_drought': {
        const days = log.flashDroughtDaysAfter;
        return [`Crops planted in the next ${days} day${days === 1 ? '' : 's'} grow at half speed.`];
      }
      default:
        return [];
    }
  })();

  // 019 — mitigation sub-lines for owned buildings that softened this disaster
  if (log.buildingsApplied.includes('scarecrow')) {
    lines.push('🎃 Your Scarecrow thinned the swarm — fewer plots were hit.');
  }
  if (log.buildingsApplied.includes('irrigation_well')) {
    lines.push('⛲ Your Irrigation Well shortened the drought.');
  }
  return lines;
}
```

(The drought line now reads the actual window from the log — correct for stacked droughts and for the Well.)

- [ ] **Step 4: Run** — DisasterBanner tests PASS; full suite + lint green.

- [ ] **Step 5: Commit**

```bash
git add src/components/DisasterBanner.tsx tests/components/DisasterBanner.test.tsx
git commit -m "019: T10 disaster banner mitigation sub-lines from buildingsApplied"
```

---

### Task 11: Unified `shop_purchased` analytics

**Files:**
- Modify: `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`, `tests/analytics/events.test.ts` (if it asserts `EVENT_VERSIONS` keys)

- [ ] **Step 1: Write the failing tests** (append to `tests/analytics/useAnalyticsEvents.test.tsx`, reusing its `renderHook` + mocked `track` pattern)

```tsx
describe('useAnalyticsEvents shop_purchased (019)', () => {
  it('fires for a seed purchase with prev-state pricing', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    const bought: GameState = {
      ...base,
      coinBalance: base.coinBalance - 10,
      seedInventory: { ...base.seedInventory, radish: 2 },
    };
    rerender({ state: bought });
    expect(track).toHaveBeenCalledWith('shop_purchased', expect.objectContaining({
      item_type: 'seed', item_id: 'radish', quantity: 2, cost: 10, coin_balance_after: bought.coinBalance,
    }));
  });

  it('fires for a building purchase with the definition cost', () => {
    const base = { ...initialGameState(), currentDay: 21 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    const bought: GameState = { ...base, buildings: { ...base.buildings, scarecrow: true } };
    rerender({ state: bought });
    expect(track).toHaveBeenCalledWith('shop_purchased', expect.objectContaining({
      item_type: 'building', item_id: 'scarecrow', quantity: 1, cost: 220, season_number: 2,
    }));
  });

  it('stays silent when inventory decreases (planting)', () => {
    const base = { ...initialGameState(), seedInventory: { radish: 2, parsnip: 0, pumpkin: 0 } } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();
    rerender({ state: { ...base, seedInventory: { ...base.seedInventory, radish: 1 } } });
    expect(track).not.toHaveBeenCalledWith('shop_purchased', expect.anything());
  });

  it('fires for a fertilizer purchase', () => {
    const base = initialGameState() as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    rerender({ state: { ...base, fertilizerInventory: 1 } });
    expect(track).toHaveBeenCalledWith('shop_purchased', expect.objectContaining({
      item_type: 'fertilizer', item_id: 'fertilizer', quantity: 1, cost: 30,
    }));
  });
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

`src/analytics/events.ts` — `EventPropsMap` gains:

```ts
  shop_purchased: {
    item_type: 'seed' | 'fertilizer' | 'building';
    item_id: string;
    quantity: number;
    cost: number;
    day: number;
    season_number: number;
    coin_balance_after: number;
  };
```

`EVENT_VERSIONS` gains `shop_purchased: 1,`.

`src/analytics/useAnalyticsEvents.ts` — add imports (`computeSeedCost` from the engine, `DEFAULT_ECONOMY` from economy, `CropId` type) and the detector:

```ts
const CROP_IDS: CropId[] = ['radish', 'parsnip', 'pumpkin'];

/** shop_purchased — any per-commit increase in a shop-panel inventory is a purchase.
 *  Costs reconstruct from prev-state prices (each action commits separately, so the
 *  prev state is exactly the state the purchase was priced against). Decreases
 *  (planting, applying fertilizer) and run resets stay silent. */
function detectShopPurchased(prev: GameState, state: GameState): void {
  const common = {
    day: state.currentDay,
    season_number: getSeasonForDay(state.currentDay).number,
    coin_balance_after: state.coinBalance,
  };
  for (const cropId of CROP_IDS) {
    const delta = state.seedInventory[cropId] - prev.seedInventory[cropId];
    if (delta > 0) {
      track('shop_purchased', {
        item_type: 'seed',
        item_id: cropId,
        quantity: delta,
        cost: computeSeedCost(cropId, prev.buildings) * delta,
        ...common,
      });
    }
  }
  const fertDelta = state.fertilizerInventory - prev.fertilizerInventory;
  if (fertDelta > 0) {
    track('shop_purchased', {
      item_type: 'fertilizer',
      item_id: 'fertilizer',
      quantity: fertDelta,
      cost: DEFAULT_ECONOMY.fertilizerCost * fertDelta,
      ...common,
    });
  }
  for (const def of DEFAULT_ECONOMY.buildings.definitions) {
    if (state.buildings[def.id] && !prev.buildings[def.id]) {
      track('shop_purchased', {
        item_type: 'building',
        item_id: def.id,
        quantity: 1,
        cost: def.cost,
        ...common,
      });
    }
  }
}
```

Call it from the effect in `useAnalyticsEvents` alongside the other detectors:
`detectShopPurchased(prev, state);`

- [ ] **Step 4: Run** — analytics tests PASS; full suite + lint green (extend `tests/analytics/events.test.ts` if it enumerates `EVENT_VERSIONS`).

- [ ] **Step 5: Commit**

```bash
git add src/analytics tests/analytics
git commit -m "019: T11 unified shop_purchased analytics event"
```

---

### Task 12: Sim presets + the retune campaign

**Files:**
- Modify: `scripts/sim/economyPresets.ts`, possibly `src/engine/constants.ts` (promoted numbers), `scripts/sim/strategies.ts` (priority order if retuned)
- Create: `specs/019-farm-buildings/tuning-results.md`

- [ ] **Step 1: Freeze the historical presets and add the candidate**

In `scripts/sim/economyPresets.ts`, `baseline` gains (inside its object literal):

```ts
  // 019: frozen pre-buildings baseline — no buildings purchasable, ladder-era economics
  // are approximated by definitions: [] (bots can't buy anything, incl. the toolshed).
  buildings: { ...DEFAULT_ECONOMY.buildings, definitions: [] },
```

(`proposed` spreads `baseline`, so it inherits the freeze — that keeps the 010 preset meaning "010 as shipped, without buildings".) Then add:

```ts
/** 019 candidate — the live economy with the full building catalog enabled. */
export const buildings019: EconomyConfig = {
  ...proposed,
  buildings: DEFAULT_ECONOMY.buildings,
};

export const PRESETS: Record<string, EconomyConfig> = { baseline, proposed, buildings019 };
```

- [ ] **Step 2: Baseline the band**

Run (500 trials for iteration speed, 2000 for the final gate):

```bash
npm run sim -- --configs proposed,buildings019 --strategies smartMixed --trials 500
npm run sim -- --configs buildings019 --strategies radishOnly,parsnipOnly,pumpkinOnly --trials 500
```

Record both tables. `proposed` is the no-buildings control (~16–18% win / ~1.05×).

- [ ] **Step 3: Tune until `smartMixed` on `buildings019` sits in 15–35% win / ≈1.0–1.3× overshoot**

Lever order (spec-mandated): building **costs** in `BUILDING_DEFINITIONS` first, then `BUILDING_SEED_DISCOUNT`, then mitigation magnitudes (`BUILDING_*`), then the bot's `BUILDING_PRIORITY` order. Crop yields and season targets are off-limits. Iterate: edit constants → rerun the sweep command → note the row. Sanity checks each round: single-crop bots stay near 0%, and overshoot stays ≤ ~1.3×.

- [ ] **Step 4: Promote + record**

The candidate numbers already live in `src/engine/constants.ts` (they *are* `DEFAULT_ECONOMY`), so promotion = leaving the final tuned values in constants and confirming `buildings019` equals the live economy. Write `specs/019-farm-buildings/tuning-results.md` in the same shape as `specs/010-plot-progression-rebalance/tuning-results.md`: starting priors, each sweep row (config / strategy / win% / overshoot / notes), the final promoted numbers, and the final 2000-trial gate table:

```bash
npm run sim -- --configs proposed,buildings019 --strategies smartMixed --trials 2000
```

- [ ] **Step 5: Full suite** — `npm test && npm run lint` (constants changes ripple into tests that assert exact prices — update the Task 1 economy assertions if final numbers moved).

- [ ] **Step 6: Commit**

```bash
git add scripts/sim src/engine/constants.ts specs/019-farm-buildings/tuning-results.md tests
git commit -m "019: T12 sim presets + retune, smartMixed gated in band"
```

---

### Task 13: Docs, backlog bookkeeping, final verification

**Files:**
- Modify: `README.md`, `backlog.md`
- Manual QA via the dev server

- [ ] **Step 1: README** — in the development section (near the `npm run dev` list), add:

```markdown
### Dev flags

Append `?dev=<flags>` to the local dev URL (comma-separated; ignored in production builds):

- `buildings-s1` — unlock all farm buildings in Season 1 for playtesting
  (e.g. `http://localhost:5173/?dev=buildings-s1`).
```

- [ ] **Step 2: Backlog** — ⚠️ `backlog.md` may carry unrelated uncommitted edits; check `git diff backlog.md` first and keep unrelated hunks out of the commit (commit only if the diff is yours, otherwise surface it). Updates:
- G8 row → `✅ … **DONE (<date>).** Shipped as [019-farm-buildings](specs/019-farm-buildings/spec.md) — unified Buildings track; absorbed the 3-tier tool ladder (collapsed into 🛠️ Toolshed); Farm Stand = renamed Market Stall; Season-2 gate + day-1 teaser; schema 8→9; sim-gated (<final numbers>).`
- Open Decision #3 → resolved: G8 shipped first, G9 still open.
- Add to Game Feel & Polish: `F8 | **Farm-scene building sprites** — owned 019 buildings get pixel sprites anchored on the 018 backdrop | Low | S–M | 019 follow-up | Pure presentation; shop cards + banner lines shipped in 019.`
- Phase 3 line: mark G8 shipped.

- [ ] **Step 3: Manual QA** (dev server, browser):
1. `npm run dev`, open `/?dev=buildings-s1` — all five buildings buyable day 1; buy Scarecrow, verify it moves to Active Buffs.
2. Open `/` (no flag) — Buildings shelf shows Toolshed + "🔒 New stock arrives in Season 2"; buy Toolshed, seed prices drop 40%.
3. In a run with a Flash Drought and the Well owned, check the banner reads "next 1 day" + the Well sub-line.
4. Load a pre-019 save (set `pixel-parsnips-state` to a v8 envelope with `upgradeTier: 3` in devtools) — reloads with Toolshed owned, console shows the v8→v9 migration note.

- [ ] **Step 4: Final gate** — `npm test && npm run lint` → green.

- [ ] **Step 5: Commit**

```bash
git add README.md backlog.md
git commit -m "019: T13 dev-flag docs + backlog bookkeeping for G8 ship"
```

---

## Plan self-review notes

- **Spec coverage:** buildings catalog + semantics (T1–T5), gate + teaser (T2, T8), dev flag (T7), schema 9 + migration + hardening (T1, T6), ladder removal incl. sim bots (T6), config threading (T7), shop UI + tray (T8), compost countdown correction (T9 — spec amended accordingly), banner feedback (T10), analytics (T11), retune + tuning-results (T12), README/backlog (T13). Out-of-scope items (sprites, G9, blight, refunds) have no tasks by design.
- **Numbers referenced in tests** (150/220/300 costs, 0.4 discount, lease 22 in S2) mirror the priors in constants; if Task 12 retunes them, the exact-value tests updated in T12 Step 5 are the single place they bite.
- **Type names are consistent across tasks:** `BuildingId`, `BuildingDefinition`, `BuildingsConfig`, `BuyBuildingResult`, `BuildingCardData`, `NO_BUILDINGS`, `buildingsApplied`, `maybeBuyBuildings`, `resolveEconomy`, `ECONOMY`.
