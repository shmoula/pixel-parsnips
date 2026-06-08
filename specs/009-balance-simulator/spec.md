# 009 — Balance Simulator (Delivery A)

**Status:** Design approved, awaiting spec review
**Date:** 2026-06-08
**Depends on:** nothing
**Depended on by:** 010-plot-progression-rebalance

## Problem

The game is trivially easy. Across 2,000 simulated runs of the current economy, a
cash-flow-aware "smart mixed" strategy wins **97%** of the time and ends with an
average peak balance of **~2,393 — roughly 4× the final season target of 600**.
Single-crop strategies expose accidental imbalances (pumpkin-only bankrupts 100%
of the time on lease before its first harvest; parsnip-only silently wins 75%).

We have no repeatable way to measure how a proposed set of balance numbers actually
plays out. Tuning is currently done by editing constants by hand and eyeballing —
slow, unscientific, and easy to over- or under-correct (we did exactly this and
swung from 97% win to 0% win in two passes).

## Goal

A reusable **Monte Carlo simulation system** that runs many randomized games against
the **real game engine** under a swappable set of balance numbers, and reports how
hard the game is (win rate, bankruptcy rate, target-miss rate, wealth overshoot,
per-season pass rates). This is the measurement tool used to set the numbers in
spec 010 and any future balance work.

Non-goals: no automatic parameter search/optimizer (manual sweep only); no in-app
debug UI; no changes to player-facing mechanics or numbers (that is spec 010).

## Approach

### 1. `EconomyConfig` — single source of truth for tunable numbers

Today every balance number is a hard-coded module constant (`constants.ts`,
`seasons.ts`). The simulator cannot swap numbers without editing source. We extract
all tunable values into an injectable config object that the **real engine** reads.
Because the simulator and the game run the identical engine, the simulator is always
faithful — no parallel reimplementation that can drift.

New file `src/engine/economy.ts`:

```ts
export interface EconomyConfig {
  startingBalance: number;
  startingPlots: number;          // forward-compat for 010; in 009 == maxPlots
  maxPlots: number;               // 12
  plotPrices: number[];           // forward-compat for 010; unused in 009
  taxRate: number;
  crops: Record<CropId, { growthDays: number; baseSeedCost: number; baseYield: number }>;
  upgrades: UpgradeTierDefinition[];
  seasons: SeasonConfig[];        // finite arc (seasons 1–4)
  endless: {                      // formula coefficients for day ≥ 81
    leaseBase: number; leasePerSeason: number;
    disasterBase: number; disasterPerSeason: number; disasterCap: number;
    targetBase: number; targetPerSeason: number;
  };
  exhaustionThreshold: number;
  exhaustionRecoveryDays: number;
  fertilizerCost: number;
  streakBonusPerLevel: number;
  streakBonusCap: number;
}
```

- `DEFAULT_ECONOMY` is built from the **current live constants** so behavior is
  unchanged after the refactor (009 is behavior-preserving for the game).
- The `startingPlots`/`maxPlots`/`plotPrices` fields are present now so the schema
  is stable, but 009 keeps `startingPlots === maxPlots` and never reads `plotPrices`.
  Spec 010 activates them.
- Existing constants in `constants.ts`/`seasons.ts` remain exported (used to *build*
  `DEFAULT_ECONOMY`), so nothing else breaks.

### 2. Thread config + rng through the engine

Every engine function that reads a balance number gains an optional trailing
parameter `config: EconomyConfig = DEFAULT_ECONOMY`:
`plantSeed`, `buySeed`, `computeSeedCost`, `buyUpgrade`, `buyFertilizer`,
`applyFertilizer`, `processTurn`, `initialGameState`, and the `seasons.ts` helpers
`getSeasonForDay` / `getDisasterBandsForSeason`.

Because the param is optional with a default, **all existing call sites and tests
keep working unchanged** (`useGameEngine` calls stay as-is and get `DEFAULT_ECONOMY`).

`processTurn` additionally gains an optional `rng: () => number = Math.random`,
used in place of the two current `Math.random()` calls (weather-band roll and the
per-plot pest-destruction roll). This makes a full Monte Carlo run reproducible from
a single master seed. The existing `weatherRoll` / `pestDestructionOverride` /
`weatherRollOverride` test hooks stay.

### 3. The simulator — `scripts/sim/`

| Module | Responsibility |
|---|---|
| `economyPresets.ts` | Named configs. `baseline` = current live numbers (== `DEFAULT_ECONOMY`). Authors add more (e.g. `proposed`) here. |
| `rng.ts` | Small seedable PRNG (e.g. mulberry32) → `() => number`; derives per-trial streams from a master seed. |
| `strategies.ts` | Strategy bots. Each is `(state, config) => Decision[]` for one turn (which seeds to buy/plant, upgrades to buy). Bots: `radishOnly`, `parsnipOnly`, `pumpkinOnly`, `smartMixed`. `smartMixed` is cash-flow-aware (radish when near-broke for liquidity, parsnip mid, pumpkin when safe) and buys upgrades when comfortably affordable. *(Plot-buying behavior is added by spec 010.)* |
| `runner.ts` | `playRun(config, strategy, rng)` → plays one full game to a terminal phase, returns the outcome. `monteCarlo(config, strategy, trials, masterSeed)` → array of outcomes. |
| `metrics.ts` | Aggregates outcomes: win %, bankrupt %, target-miss %, avg/median/p10/p90 peak balance, overshoot ratio (peak ÷ final target), per-season pass rate, avg end-day. |
| `report.ts` | Formats a comparison table (rows = config×strategy) to stdout. |
| `run.ts` | CLI entry + argv parsing. |

CLI:

```bash
npm run sim -- --configs baseline,proposed --strategies smartMixed,parsnipOnly --trials 2000 --seed 42
```

Defaults when flags omitted: all presets × all strategies, 2000 trials, fixed seed.

### 4. Runner via `tsx` (one new dev dependency)

`scripts/sim/` is TypeScript importing the engine. Add `tsx` as a devDependency and
`"sim": "tsx scripts/sim/run.ts"` to `package.json`. (User approved this single dep.)

## Components & boundaries

- `src/engine/economy.ts` — config type + `DEFAULT_ECONOMY`. No logic, just data + the type.
- Engine modules — gain optional config/rng params; otherwise unchanged. Each function
  still does one thing and is independently testable with an injected config.
- `scripts/sim/*` — pure, no React, no DOM. `runner` depends only on the engine and a
  strategy fn; `metrics`/`report` depend only on plain outcome data. Each module is
  understandable and testable in isolation.

## Testing

- **Engine refactor (TDD, behavior-preserving):** existing engine tests must stay
  green unchanged. Add tests proving (a) passing `DEFAULT_ECONOMY` explicitly equals
  the default, (b) a custom config changes the relevant number (e.g. higher
  `taxRate` deducts more), (c) `processTurn` with a fixed `rng` is deterministic and
  reproducible.
- **Simulator:** unit-test `rng` (same seed → same sequence), `metrics` (hand-checked
  aggregates on a tiny fixture), and a `monteCarlo` smoke test (same seed → identical
  report; `baseline` reproduces the known "smart ~97% win" ballpark).
- `npm test && npm run lint` green.

## Success criteria

- `npm run sim` prints a comparison table for the current economy that reproduces the
  known result: `smartMixed` on `baseline` ≈ 95–98% win, ~4× overshoot.
- Runs are reproducible (same `--seed` → identical numbers).
- The game itself is byte-for-byte unchanged in behavior (009 ships no balance change).
- Adding a new candidate economy = adding one entry to `economyPresets.ts`.

## Risks / notes

- Keeping the optional-trailing-param signatures back-compatible is essential — verify
  no existing positional call site breaks (especially the `processTurn` test hooks).
- `smartMixed` is intentionally a *good-but-not-optimal* bot; its win rate is a lower
  bound on skilled human play. Reports should be read as "floor difficulty," not ceiling.
