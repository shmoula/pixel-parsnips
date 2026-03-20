# Data Model: Game UI Visual Revamp

**Branch**: `004-game-ui-revamp` | **Date**: 2026-03-19

## Overview

This feature is a **pure UI/visual layer revamp**. The game engine (`src/engine/`) and its types (`types.ts`) are unchanged. This document defines the new **UI-local state** and **derived display values** introduced by the revamp.

---

## New UI State

### `DaySummaryModalState` (local to `GameBoard`)

Tracks whether the Day Summary modal is open and which log entry to display.

| Field | Type | Description |
|-------|------|-------------|
| `isOpen` | `boolean` | Whether the modal is currently visible |
| `log` | `DailyLogEntry \| null` | The log entry to display; null when modal is closed |

**Transitions**:
- `isOpen: false → true`: triggered by "Next Day" click (after turn processes) or "Last Turn" click
- `isOpen: true → false`: triggered by modal close button or Escape key
- `log` is always the `lastDailyLog` from `GameState` at the moment the modal opens

**Location**: `useState` in `GameBoard.tsx`

---

### `isShopOpen` (local to `GameBoard`, mobile only)

Controls the bottom sheet visibility of the shop panel on narrow viewports.

| Field | Type | Description |
|-------|------|-------------|
| `isShopOpen` | `boolean` | Whether the shop bottom sheet is currently visible |

**Transitions**: toggled by a "Shop" button in the HUD or a floating trigger button. On desktop (`md:` and above) this state is ignored — the shop is always rendered as a sidebar.

**Location**: `useState` in `GameBoard.tsx`

---

## New Derived Display Values

### `GrowthStage` (derived in `PlotCard`)

Computed from `PlotState` and `CropDefinition` — not stored in game state.

| Value | Condition | Visual |
|-------|-----------|--------|
| `'sprout'` | `daysElapsed < growthDays / 3` (and `growthDays >= 3`) | 🌱 sprout icon |
| `'small'` | `daysElapsed < 2 * growthDays / 3` (and `growthDays >= 3`) | 🌿 small plant icon |
| `'full'` | `daysElapsed >= 2 * growthDays / 3`, or `growthDays < 3` with `daysElapsed >= 1` | crop emoji (radish/parsnip/pumpkin) |
| `'ready'` | `daysRemaining === 0` | crop emoji + green ring |

**Collapse rules for short crops**:
- `growthDays === 1`: always `'full'` (1 day = planted and ready same day)
- `growthDays === 2`: `daysElapsed === 0` → `'sprout'`; `daysElapsed >= 1` → `'full'`
- `growthDays >= 3`: equal-thirds thresholds above

Where: `daysElapsed = growthDays - (daysRemaining ?? growthDays)`

**Computation location**: Pure helper function `getGrowthStage(plot: PlotState, cropDef: CropDefinition): GrowthStage` in `PlotCard.tsx` (or extracted to a shared util if reused).

---

### `progressFraction` (derived in `PlotCard` / `ProgressRing`)

The fill fraction for the circular progress ring around a growing crop.

```
progressFraction = 1 − (daysRemaining / growthDays)
```

- `0.0` = just planted (empty ring)
- `1.0` = ready to harvest (full ring)

**Used by**: `ProgressRing` component prop `progress: number` (0–1).

---

### `netProfit` (derived in `SeedCard`)

Displayed on each seed card in the shop.

```
netProfit = baseYield − seedCost
```

Where `seedCost = getSeedPrice(cropId)` (already accounts for upgrade discount).

**Note**: Net profit is a display-only value. It does not account for weather multipliers (which are unknown at purchase time). The label makes this clear: "Est. profit".

---

## Existing Entities Referenced (Unchanged)

These are defined in `src/engine/types.ts` and `src/engine/constants.ts`. No modifications.

| Entity | Key fields relevant to UI |
|--------|--------------------------|
| `PlotState` | `cropId`, `daysRemaining`, `dayPlanted`, `exhaustedSinceDay`, `pestDamaged`, `droughtPenalised` |
| `CropDefinition` | `growthDays`, `baseSeedCost`, `baseYield` |
| `UpgradeTierDefinition` | `tier`, `label`, `cost`, `cumulativeDiscount` — `isOwned` derived from `GameState.upgradeTier >= def.tier` |
| `DailyLogEntry` | All fields — displayed as-is in `DailyLog` / `DaySummaryModal` |
| `GameState` | `upgradeTier` — used to split shop items into "purchasable" vs "Active Buffs" |
