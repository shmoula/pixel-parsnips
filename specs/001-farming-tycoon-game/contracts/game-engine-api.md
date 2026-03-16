# Contract: Game Engine API

**Feature**: 001-farming-tycoon-game
**Date**: 2026-03-16
**Source files**: `src/engine/gameEngine.ts`, `src/engine/useGameEngine.ts`

This document defines the public API surface of the game engine. UI components
MUST only interact with game logic through the `useGameEngine` hook. Direct
imports from `gameEngine.ts` are permitted only in test files.

---

## Pure Engine Functions (`src/engine/gameEngine.ts`)

All functions are **pure** (no side effects, no React dependencies). They
take a `GameState` and return a new `GameState` or a typed result. They MUST NOT
mutate their inputs.

---

### `initialGameState(): GameState`

Returns the canonical starting state for a new game run.

```typescript
function initialGameState(): GameState
```

**Post-conditions**:
- `currentDay === 1`
- `coinBalance === STARTING_BALANCE`
- All 12 plots are empty
- `seedInventory` all zeroes
- `upgradeTier === 0`
- `lastDailyLog === null`
- `phase === 'playing'`
- `peakBalance === STARTING_BALANCE`

---

### `plantSeed(state, plotId, cropId): PlantResult`

Plants one seed from inventory into an empty plot.

```typescript
type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'invalid_plot' };

function plantSeed(
  state: GameState,
  plotId: number,
  cropId: CropId
): PlantResult
```

**Pre-conditions**:
- `state.phase === 'playing'`

**Success post-conditions** (`ok: true`):
- `seedInventory[cropId]` decremented by 1
- Target plot now occupied with `cropId`, `dayPlanted = currentDay`,
  `daysRemaining = CROP_DEFINITIONS[cropId].growthDays`
- All other state unchanged

**Error codes**:
- `no_seed` — `seedInventory[cropId] === 0`
- `plot_occupied` — target plot already has a crop
- `invalid_plot` — `plotId` out of range `[0, PLOT_COUNT)`

---

### `buySeed(state, cropId, quantity): BuyResult`

Purchases seeds from the shop.

```typescript
type BuyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds'; cost: number; balance: number };

function buySeed(
  state: GameState,
  cropId: CropId,
  quantity: number
): BuyResult
```

**Success post-conditions** (`ok: true`):
- `coinBalance` reduced by `computeSeedCost(cropId, state.upgradeTier) * quantity`
- `seedInventory[cropId]` increased by `quantity`
- `peakBalance` unchanged (purchase reduces balance)

---

### `buyUpgrade(state): UpgradeResult`

Purchases the next tool upgrade tier.

```typescript
type UpgradeResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds' | 'max_tier_reached' };

function buyUpgrade(state: GameState): UpgradeResult
```

**Success post-conditions** (`ok: true`):
- `upgradeTier` incremented by 1
- `coinBalance` reduced by `UPGRADE_TIER_DEFINITIONS[newTier - 1].cost`

**Error codes**:
- `max_tier_reached` — `state.upgradeTier === MAX_UPGRADE_TIER`
- `insufficient_funds` — balance < next tier cost

---

### `processTurn(state, weatherRoll?): TurnResult`

Executes the full end-of-turn sequence (FR-002).

```typescript
interface TurnResult {
  state: GameState;
  log: DailyLogEntry;
  isBankrupt: boolean;
}

function processTurn(
  state: GameState,
  weatherRoll?: WeatherId    // Omit in production; inject in tests
): TurnResult
```

**Sequence** (must execute in this order):
1. Decrement `daysRemaining` on all occupied plots
2. Select weather (random if `weatherRoll` omitted; use provided value otherwise)
3. Harvest all plots where `daysRemaining === 0`; accumulate `HarvestEvent[]`
4. Add `totalHarvestIncome` to `coinBalance`
5. Check bankruptcy: if `coinBalance < LAND_LEASE_FEE` → set
   `phase = 'bankrupt'`, return immediately with `isBankrupt: true`
6. Deduct `LAND_LEASE_FEE` from `coinBalance`
7. Compute and deduct tax: `coins(coinBalance * TAX_RATE)`
8. Increment `currentDay`
9. Update `peakBalance` if `coinBalance > peakBalance`
10. Build and store `DailyLogEntry` in `lastDailyLog`

**Post-conditions** (non-bankrupt path):
- `currentDay` is previous value + 1
- `lastDailyLog` captures the completed day's full accounting
- `coinBalance === openingBalance + totalHarvestIncome - landLeaseDeducted - taxDeducted`

---

### `computeSeedCost(cropId, upgradeTier): number`

Returns the current purchase price for one seed of the given type.

```typescript
function computeSeedCost(cropId: CropId, upgradeTier: UpgradeTier): number
```

- Returns `coins(baseSeedCost * (1 - cumulativeDiscount))`
- Discount is `0` when `upgradeTier === 0`

---

## React Hook (`src/engine/useGameEngine.ts`)

The hook is the **only** interface UI components use. It wraps the pure engine
functions, manages React state, and synchronises to localStorage.

```typescript
interface GameEngineHook {
  // --- State (read-only) ---
  state: GameState;

  // --- Actions (return true on success, false on failure) ---
  nextDay: () => void;
  plantSeed: (plotId: number, cropId: CropId) => boolean;
  buySeed: (cropId: CropId, quantity: number) => boolean;
  buyUpgrade: () => boolean;
  restart: () => void;

  // --- Derived helpers ---
  getSeedPrice: (cropId: CropId) => number;
  getNextUpgradeCost: () => number | null;  // null if max tier reached
  getOccupiedPlotCount: () => number;
}

function useGameEngine(): GameEngineHook
```

**Behaviour**:
- On mount: loads state from localStorage (falling back to `initialGameState()`
  on schema mismatch or missing key).
- After every action: saves updated state to localStorage.
- `nextDay()` calls `processTurn` and updates React state atomically.
- `restart()` calls `initialGameState()` and clears localStorage key.
- All action functions are referentially stable (wrapped in `useCallback`).
