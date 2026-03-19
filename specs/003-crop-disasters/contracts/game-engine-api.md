# Contract: Game Engine API — 003-crop-disasters

**File**: `src/engine/gameEngine.ts`
**Date**: 2026-03-19

This document describes the changed and new function signatures introduced by this feature. Unchanged functions (`buySeed`, `buyUpgrade`, `buyFertilizer`, `applyFertilizer`, `computeSeedCost`) are not listed.

---

## processTurn (modified)

```ts
export function processTurn(
  state: GameState,
  weatherRoll?: WeatherId,
  pestDestructionOverride?: number[]
): TurnResult
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `state` | `GameState` | ✅ | Current game state. Not mutated. |
| `weatherRoll` | `WeatherId` | optional | Inject a specific weather event. When provided, bypasses the random continuous-uniform selection. Use in tests. |
| `pestDestructionOverride` | `number[]` | optional | When weather resolves to `'pest_infestation'`, destroy exactly these plot IDs instead of rolling randomly. Use in tests to make pest outcomes deterministic. Ignored for all other weather events. |

### Revised processing sequence

```
Step 1  — Decrement daysRemaining on all occupied plots (unchanged)
Step 2  — Resolve weather: inject weatherRoll if provided; else roll Math.random()
             and map to WeatherId via WEATHER_PROBABILITY_BANDS
Step 2a — [NEW] If 'pest_infestation':
             For each occupied plot:
               if pestDestructionOverride provided → destroy listed IDs
               else → destroy with independent 50% chance
             Destroyed plots: cropId=null, daysRemaining=null, dayPlanted=null,
                              droughtPenalised=false, pestDamaged=true
Step 2b — [NEW] If 'flash_drought':
             flashDroughtDaysRemaining += 2
Step 3  — Harvest all plots where daysRemaining === 0 (unchanged, pestDamaged=true
             plots are already empty so they will not be harvested)
           Sub-step 3a — increment consecutiveHarvests (unchanged)
           Sub-step 3b — trigger exhaustion (unchanged)
           [NEW] Harvested plot: reset droughtPenalised=false
Step 4  — Add harvest income to balance (unchanged)
Step 5  — Bankruptcy check (unchanged)
Step 6  — Deduct land lease fee (unchanged)
Step 7  — Compute and deduct tax (unchanged)
Step 8  — Increment currentDay (unchanged)
Step 8.5 — Natural recovery — clear exhaustion (unchanged)
Step 8.6 — [NEW] If weatherId !== 'flash_drought' and flashDroughtDaysRemaining > 0: decrement by 1 (skip on the turn Flash Drought fires so both N+1 and N+2 planting days receive the penalty)
Step 9  — Update peakBalance (unchanged)
Step 10 — Build DailyLogEntry:
             weatherId, weatherMultiplier (unchanged)
             pestDestroyedPlots: IDs from step 2a ([] if not pest turn)
             flashDroughtDaysAfter: flashDroughtDaysRemaining after step 8.6
             (all other fields unchanged)
```

### TurnResult (unchanged shape, log fields extended)

```ts
interface TurnResult {
  state: GameState;
  log: DailyLogEntry;   // now includes pestDestroyedPlots, flashDroughtDaysAfter
  isBankrupt: boolean;
}
```

---

## plantSeed (modified)

```ts
export function plantSeed(
  state: GameState,
  plotId: number,
  cropId: CropId
): PlantResult
```

### Changes

1. New guard added (after `plot_exhausted`, before `no_seed`):
   - If `plot.pestDamaged === true` → return `{ ok: false, error: 'plot_pest_damaged' }`

2. On successful plant, if `state.flashDroughtDaysRemaining > 0`:
   - `daysRemaining = Math.ceil(crop.growthDays * 2)`
   - `droughtPenalised = true`

3. On successful plant, if `state.flashDroughtDaysRemaining === 0`:
   - `daysRemaining = crop.growthDays` (unchanged)
   - `droughtPenalised = false` (unchanged default)

### Guard order (complete)

1. `invalid_plot`
2. `plot_occupied`
3. `plot_exhausted`
4. `plot_pest_damaged` ← new
5. `no_seed`

---

## clearPestDamage (new)

```ts
export function clearPestDamage(
  state: GameState,
  plotId: number
): ClearPestDamageResult
```

### Description

Player-triggered acknowledgment of a pest-damaged plot. Clears the `pestDamaged` flag and returns the plot to a normal empty, plantable state. No coin cost.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `state` | `GameState` | Current game state. Not mutated. |
| `plotId` | `number` | ID of the plot to clear. |

### Return type

```ts
export type ClearPestDamageResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'plot_not_pest_damaged' | 'invalid_plot' };
```

### Guard order

1. `invalid_plot` (plotId < 0 or >= PLOT_COUNT)
2. `plot_not_pest_damaged` (plot.pestDamaged === false)

### Effect on success

```ts
plot = { ...plot, pestDamaged: false }
// All other plot fields unchanged (cropId remains null, consecutiveHarvests preserved)
```

---

## Hook: useGameEngine (extended)

**File**: `src/engine/useGameEngine.ts`

New entry in `GameEngineHook` interface:

```ts
clearPestDamage: (plotId: number) => boolean;
```

Behaviour mirrors `applyFertilizer`: calls `engineClearPestDamage`, saves state on success, returns `true` on success / `false` on failure.
