# Data Model: Plot Exhaustion Maintenance

**Feature**: 002-plot-exhaustion-maintenance
**Date**: 2026-03-17
**Base**: Extends `specs/001-farming-tycoon-game/data-model.md`

This document records only the **changes and additions** to the 001 data model.
All unchanged types, definition records, and derived values remain as documented
in the 001 data model.

---

## Changed: `PlotState`

Two fields added. All existing fields unchanged.

```typescript
interface PlotState {
  id: number;                      // [UNCHANGED] 0-based index; range 0–11
  cropId: CropId | null;           // [UNCHANGED] null = empty plot
  dayPlanted: number | null;       // [UNCHANGED] game day when seed was planted
  daysRemaining: number | null;    // [UNCHANGED] days until harvest

  // --- NEW ---
  consecutiveHarvests: number;     // How many times in a row this plot has been
                                   // harvested without restoration. Range: 0–2
                                   // (resets to 0 when exhaustion triggers or
                                   // when plot is restored). NEVER rendered in UI.
  exhaustedSinceDay: number | null; // The in-game day (post-increment) when this
                                   // plot became Exhausted. null = not exhausted.
}
```

**Validation rules** (additions):
- `consecutiveHarvests` is always `>= 0`. Maximum observable value is
  `EXHAUSTION_THRESHOLD - 1` (2) because it resets to 0 at the moment exhaustion
  triggers.
- `exhaustedSinceDay` is `null` unless the plot is in Exhausted state.
- A plot CANNOT be simultaneously occupied (`cropId !== null`) and Exhausted
  (`exhaustedSinceDay !== null`). These are mutually exclusive states.
- An empty plot (`cropId === null`, `exhaustedSinceDay === null`) with
  `consecutiveHarvests > 0` is valid (idle gap between harvests).

**Updated state transitions**:

```
[empty, consec=N]
     │
     └─ plantSeed() ──► [occupied, daysRemaining = growthDays, consec=N]
                                      │
                               advanceDay() called
                                      │
                               daysRemaining decrements by 1
                                      │
                           daysRemaining === 0?
                            YES ──► harvest
                                      │
                              consec + 1 < THRESHOLD?
                               YES ──► [empty, consec=N+1]
                               NO  ──► [exhausted, consec=0, exhaustedSinceDay=currentDay]
                            NO  ──► [still occupied, consec=N]

[exhausted, exhaustedSinceDay=D]
     │
     ├─ advanceDay() and currentDay - D >= RECOVERY_DAYS
     │        └──► [empty, consec=0, exhaustedSinceDay=null]
     │
     └─ applyFertilizer()
              └──► [empty, consec=0, exhaustedSinceDay=null]
```

---

## Changed: `GameState`

One field added. All existing fields unchanged.

```typescript
interface GameState {
  schemaVersion: number;           // [CHANGED] Must equal SCHEMA_VERSION (now 2)
  currentDay: number;              // [UNCHANGED]
  coinBalance: number;             // [UNCHANGED]
  plots: PlotState[];              // [UNCHANGED — PlotState itself extended above]
  seedInventory: SeedInventory;    // [UNCHANGED]
  upgradeTier: UpgradeTier;        // [UNCHANGED]
  lastDailyLog: DailyLogEntry | null; // [UNCHANGED — DailyLogEntry itself extended below]
  phase: 'playing' | 'bankrupt';   // [UNCHANGED]
  peakBalance: number;             // [UNCHANGED]

  // --- NEW ---
  fertilizerInventory: number;     // Count of Fertilizer units held. Integer >= 0.
}
```

**Validation rules** (addition):
- `fertilizerInventory` is always a non-negative integer.

---

## Changed: `DailyLogEntry`

One field added. All existing fields unchanged.

```typescript
interface DailyLogEntry {
  // ... all existing fields unchanged ...

  // --- NEW ---
  exhaustedPlots: number[];        // plotId values of plots that became Exhausted
                                   // this turn. Empty array if none.
}
```

---

## New Constants

```typescript
// src/engine/constants.ts (additions)

export const SCHEMA_VERSION = 2;              // [CHANGED from 1]

export const EXHAUSTION_THRESHOLD = 3;        // Consecutive harvests before Exhaustion
export const EXHAUSTION_RECOVERY_DAYS = 3;    // In-game days for natural recovery
export const FERTILIZER_COST = 30;            // Coins per Fertilizer unit
```

---

## New Derived Values

| Value | Formula |
|-------|---------|
| Days until plot recovery | `EXHAUSTION_RECOVERY_DAYS - (currentDay - plot.exhaustedSinceDay!)` |
| Plot is exhausted | `plot.exhaustedSinceDay !== null` |
| Plot is plantable | `plot.cropId === null && plot.exhaustedSinceDay === null` |
| Exhaustion recovers this turn | `currentDay - plot.exhaustedSinceDay! >= EXHAUSTION_RECOVERY_DAYS` |

---

## `initialGameState()` Defaults (additions)

```typescript
// Each PlotState initialized with:
consecutiveHarvests: 0,
exhaustedSinceDay: null,

// GameState top-level:
fertilizerInventory: 0,
```
