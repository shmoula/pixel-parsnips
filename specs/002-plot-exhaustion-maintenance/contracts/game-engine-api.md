# Contract: Game Engine API (v2 — Plot Exhaustion Delta)

**Feature**: 002-plot-exhaustion-maintenance
**Date**: 2026-03-17
**Base**: Extends `specs/001-farming-tycoon-game/contracts/game-engine-api.md`

This document records only the **changes and additions** to the 001 engine API
contract. All unchanged functions retain their 001 signatures and post-conditions.

---

## Changed: `plantSeed(state, plotId, cropId): PlantResult`

One new error code added to the result union. Signature unchanged.

```typescript
type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'invalid_plot' };
```

**New error code**:
- `plot_exhausted` — target plot has `exhaustedSinceDay !== null`; planting is
  blocked regardless of seed inventory

**Evaluation order**: `invalid_plot` → `plot_occupied` → `plot_exhausted` → `no_seed`

---

## Changed: `processTurn(state, weatherRoll?): TurnResult`

Sequence extended with two new steps. All existing steps unchanged.

**Updated sequence**:

1. Decrement `daysRemaining` on all occupied plots *(unchanged)*
2. Select weather *(unchanged)*
3. Harvest all plots where `daysRemaining === 0`; accumulate `HarvestEvent[]` *(unchanged)*
   - **NEW sub-step 3a**: For each harvested plot, increment `consecutiveHarvests`.
   - **NEW sub-step 3b**: If `consecutiveHarvests >= EXHAUSTION_THRESHOLD`:
     - Set `exhaustedSinceDay = state.currentDay + 1` (the day after increment)
     - Reset `consecutiveHarvests = 0`
     - Record `plotId` in `exhaustedPlots[]` for the log
4. Add `totalHarvestIncome` to `coinBalance` *(unchanged)*
5. Check bankruptcy *(unchanged)*
6. Deduct `LAND_LEASE_FEE` *(unchanged)*
7. Compute and deduct tax *(unchanged)*
8. Increment `currentDay` *(unchanged)*
   - **NEW step 8.5**: For each Exhausted plot, if
     `currentDay - exhaustedSinceDay >= EXHAUSTION_RECOVERY_DAYS`:
     clear `exhaustedSinceDay = null`, `consecutiveHarvests = 0`
9. Update `peakBalance` *(unchanged)*
10. Build and store `DailyLogEntry` in `lastDailyLog`; include `exhaustedPlots[]` *(extended)*

**Updated `TurnResult`**:

```typescript
interface TurnResult {
  state: GameState;
  log: DailyLogEntry;    // Now includes exhaustedPlots: number[]
  isBankrupt: boolean;
}
```

---

## New: `buyFertilizer(state, quantity): BuyResult`

Purchases Fertilizer units from the shop.

```typescript
function buyFertilizer(
  state: GameState,
  quantity: number
): BuyResult   // same type as buySeed — { ok: true; state } | { ok: false; error: 'insufficient_funds'; cost; balance }
```

**Pre-conditions**:
- `state.phase === 'playing'`
- `quantity >= 1`

**Success post-conditions** (`ok: true`):
- `coinBalance` reduced by `FERTILIZER_COST * quantity`
- `fertilizerInventory` increased by `quantity`
- `peakBalance` unchanged (purchase reduces balance)

**Error codes**:
- `insufficient_funds` — `coinBalance < FERTILIZER_COST * quantity`

---

## New: `applyFertilizer(state, plotId): FertilizerResult`

Applies one Fertilizer unit from inventory to an Exhausted plot, immediately
restoring it to an empty, plantable state.

```typescript
type FertilizerResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_fertilizer' | 'plot_not_exhausted' | 'invalid_plot' };

function applyFertilizer(
  state: GameState,
  plotId: number
): FertilizerResult
```

**Pre-conditions**:
- `state.phase === 'playing'`

**Evaluation order**: `invalid_plot` → `plot_not_exhausted` → `no_fertilizer`

**Success post-conditions** (`ok: true`):
- `fertilizerInventory` decremented by 1
- Target plot: `cropId = null`, `dayPlanted = null`, `daysRemaining = null`,
  `exhaustedSinceDay = null`, `consecutiveHarvests = 0`

**Error codes**:
- `invalid_plot` — `plotId` out of range `[0, PLOT_COUNT)`
- `plot_not_exhausted` — target plot's `exhaustedSinceDay === null`
- `no_fertilizer` — `fertilizerInventory === 0`

---

## Updated: `useGameEngine` Hook

Two new actions and one new derived helper added. All existing members unchanged.

```typescript
interface GameEngineHook {
  // --- Existing members (unchanged) ---
  state: GameState;
  nextDay: () => void;
  plantSeed: (plotId: number, cropId: CropId) => boolean;
  buySeed: (cropId: CropId, quantity: number) => boolean;
  buyUpgrade: () => boolean;
  restart: () => void;
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;
  getOccupiedPlotCount: () => number;

  // --- NEW ---
  buyFertilizer: (quantity: number) => boolean;
  applyFertilizer: (plotId: number) => boolean;
  getFertilizerCount: () => number;       // Returns state.fertilizerInventory
}
```

**New write triggers** (additions to localStorage save-on-action):
- `buyFertilizer()` succeeds
- `applyFertilizer()` succeeds
