# Data Model: Pixel Parsnips — Farming Tycoon Game

**Feature**: 001-farming-tycoon-game
**Date**: 2026-03-16
**Source files**: `src/engine/types.ts`, `src/engine/constants.ts`

---

## Core Types

### `CropId`

```typescript
type CropId = 'radish' | 'parsnip' | 'pumpkin';
```

Discriminated union of all valid crop identifiers. Used as keys in `CROP_DEFINITIONS`
and throughout game state.

---

### `WeatherId`

```typescript
type WeatherId = 'drought' | 'overcast' | 'sunny' | 'warm_breeze' | 'perfect_sun';
```

Discriminated union of all weather event identifiers.

---

### `UpgradeTier`

```typescript
type UpgradeTier = 0 | 1 | 2 | 3;
```

`0` = no upgrade purchased. `1–3` = upgrade tier owned. Each tier compounds a
20% discount on all seed base costs.

---

## Definition Records (Constants — not mutable state)

### `CropDefinition`

```typescript
interface CropDefinition {
  id: CropId;
  name: string;          // Display name, e.g. "Radish"
  growthDays: number;    // Days from planting to harvest (1, 2, or 3)
  baseSeedCost: number;  // Coins to buy one seed (before upgrade discount)
  baseYield: number;     // Coins earned on harvest (before weather multiplier)
}
```

Populated in `CROP_DEFINITIONS` constant. **Never mutated.**

| id | name | growthDays | baseSeedCost | baseYield |
|----|------|-----------|-------------|----------|
| `radish` | Radish | 1 | 5 | 12 |
| `parsnip` | Parsnip | 2 | 10 | 28 |
| `pumpkin` | Pumpkin | 3 | 20 | 65 |

---

### `WeatherDefinition`

```typescript
interface WeatherDefinition {
  id: WeatherId;
  name: string;          // Display name, e.g. "Perfect Sun"
  multiplier: number;    // Applied to baseYield on harvest day
  description: string;  // Flavour text shown in daily log
}
```

| id | name | multiplier | description |
|----|------|-----------|-------------|
| `drought` | Drought | 0.5 | "Scorching heat withers the crops." |
| `overcast` | Overcast | 0.8 | "Little sun today." |
| `sunny` | Sunny | 1.0 | "A normal farming day." |
| `warm_breeze` | Warm Breeze | 1.2 | "Ideal growing conditions." |
| `perfect_sun` | Perfect Sun | 1.5 | "Bumper harvest!" |

---

### `UpgradeTierDefinition`

```typescript
interface UpgradeTierDefinition {
  tier: 1 | 2 | 3;
  label: string;           // Tool name, e.g. "Rusty Trowel"
  cost: number;            // Coins to purchase
  cumulativeDiscount: number; // e.g. 0.2 = 20% off all seed base costs
}
```

| tier | label | cost | cumulativeDiscount |
|------|-------|------|--------------------|
| 1 | Rusty Trowel | 50 | 0.20 |
| 2 | Iron Hoe | 120 | 0.40 |
| 3 | Golden Spade | 250 | 0.60 |

---

## Mutable Game State

### `PlotState`

```typescript
interface PlotState {
  id: number;                  // 0-based index; range 0–11
  cropId: CropId | null;       // null = empty plot
  dayPlanted: number | null;   // Game day when seed was planted
  daysRemaining: number | null; // Days until harvest; decrements each turn
}
```

**Validation rules**:
- `cropId`, `dayPlanted`, and `daysRemaining` are either all `null` (empty) or
  all non-null (occupied).
- `daysRemaining` is always `≥ 0`; a plot with `daysRemaining === 0` is harvested
  at the start of the next turn's end-of-turn sequence.

**State transitions**:

```
[empty]  ──plantSeed()──►  [occupied, daysRemaining = growthDays]
                                         │
                                  advanceDay() called
                                         │
                                         ▼
                            daysRemaining decrements by 1
                                         │
                              daysRemaining === 0?
                               YES ──► harvest ──► [empty]
                               NO  ──► [still occupied]
```

---

### `SeedInventory`

```typescript
interface SeedInventory {
  radish: number;   // Count of radish seeds in inventory
  parsnip: number;  // Count of parsnip seeds in inventory
  pumpkin: number;  // Count of pumpkin seeds in inventory
}
```

**Validation rules**: All values are non-negative integers.

---

### `HarvestEvent`

```typescript
interface HarvestEvent {
  plotId: number;
  cropId: CropId;
  baseYield: number;          // Coins before weather multiplier
  weatherMultiplier: number;  // e.g. 1.5 for perfect_sun
  adjustedYield: number;      // Math.floor(baseYield * weatherMultiplier)
}
```

One entry per harvested crop within a single turn. Collected into `DailyLogEntry`.

---

### `DailyLogEntry`

```typescript
interface DailyLogEntry {
  day: number;                  // The day that was just completed
  weatherId: WeatherId;
  weatherMultiplier: number;
  harvests: HarvestEvent[];     // May be empty if nothing harvested
  totalHarvestIncome: number;   // Sum of all adjustedYield values
  openingBalance: number;       // Coins before any changes this turn
  landLeaseDeducted: number;    // Always equals LAND_LEASE_FEE constant
  taxRate: number;              // Always equals TAX_RATE constant
  taxDeducted: number;          // Math.floor((openingBalance + totalHarvestIncome - landLeaseDeducted) * taxRate)
  netChange: number;            // totalHarvestIncome - landLeaseDeducted - taxDeducted
  closingBalance: number;       // openingBalance + netChange
}
```

Only the **most recent** `DailyLogEntry` is stored in `GameState`. Historical logs
are not retained (avoids unbounded growth in localStorage).

---

### `GameState`

```typescript
interface GameState {
  schemaVersion: number;          // Must equal SCHEMA_VERSION constant
  currentDay: number;             // Starts at 1; increments each turn
  coinBalance: number;            // Current coin balance; integer; ≥ 0
  plots: PlotState[];             // Array of exactly PLOT_COUNT (12) elements
  seedInventory: SeedInventory;   // Per-type seed counts
  upgradeTier: UpgradeTier;       // 0–3; affects seed prices
  lastDailyLog: DailyLogEntry | null; // null on Day 1 before first turn
  phase: 'playing' | 'bankrupt';  // 'bankrupt' = game-over state
  peakBalance: number;            // Highest coinBalance ever reached this run
}
```

**Validation rules**:
- `plots` MUST have exactly `PLOT_COUNT` elements; their `id` values are
  contiguous `0` to `PLOT_COUNT - 1`.
- `coinBalance` is always `≥ 0` (bankruptcy triggers when balance < lease fee,
  before deduction is attempted).
- `currentDay` starts at `1` and increments by `1` per `nextDay` call.
- `phase` transitions from `'playing'` → `'bankrupt'` exactly once per run.

---

## Key Constants

```typescript
// src/engine/constants.ts

export const SCHEMA_VERSION = 1;
export const STARTING_BALANCE = 100;   // coins
export const PLOT_COUNT = 12;
export const LAND_LEASE_FEE = 15;      // coins, flat, per turn
export const TAX_RATE = 0.05;          // 5% of balance after lease deduction
export const MAX_UPGRADE_TIER = 3;

// Helper: integer rounding for all coin math
export const coins = (n: number): number => Math.floor(n);
```

---

## Derived Values (computed, never stored)

| Value | Formula |
|-------|---------|
| Seed price | `coins(baseSeedCost * (1 - UPGRADE_TIER_DEFINITIONS[upgradeTier - 1]?.cumulativeDiscount ?? 0))` |
| Adjusted yield | `coins(baseYield * weatherMultiplier)` |
| Tax amount | `coins(balanceAfterLease * TAX_RATE)` |
| Occupied plot count | `plots.filter(p => p.cropId !== null).length` |
| Available plot count | `PLOT_COUNT - occupiedPlotCount` |
