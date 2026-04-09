# Data Model: UI Polish & Accessibility

**Feature**: 005-ui-polish  
**Date**: 2026-04-09

---

## Overview

This feature is entirely UI/presentation layer. No changes to `GameState`, localStorage schema, or game engine logic are required. The feature adds two new named constants and threads one existing prop more deeply through the component tree.

---

## New Constants (src/engine/constants.ts)

| Constant | Value | Derivation | Purpose |
|----------|-------|------------|---------|
| `LOW_BALANCE_WARNING_THRESHOLD` | `45` | `3 × LAND_LEASE_FEE` | Triggers amber warning state on coin display |
| `LOW_BALANCE_CRITICAL_THRESHOLD` | `15` | `1 × LAND_LEASE_FEE` (= existing bankruptcy check) | Triggers pulsing red danger state on coin display |

These constants are co-located with the existing `LAND_LEASE_FEE` and `TAX_RATE` constants for discoverability.

---

## Component Prop Changes

### FarmGrid

```typescript
// New prop added
interface FarmGridProps {
  // ... existing props
  isPlantingMode: boolean;   // true when selectedCrop !== null in GameBoard
}
```

The `isPlantingMode` boolean is derived from the existing `selectedCrop` state in `GameBoard` and does not require any new game state.

### PlotCard

```typescript
// New prop added (passed from FarmGrid)
interface PlotCardProps {
  // ... existing props
  isPlantingMode: boolean;   // enables invitation highlight on empty plots
}
```

### BankruptcyScreen

```typescript
// New prop added
interface BankruptcyScreenProps {
  // ... existing props
  lastLog: DailyLogEntry | null;   // used to derive the run insight
}
```

`lastLog` is `GameState.lastDailyLog` at the time of bankruptcy. It is already available in `App.tsx` and requires only prop threading.

---

## Derived State: Run Insight Logic

The bankruptcy insight is computed inline in `BankruptcyScreen` from the following fields (all read-only, no mutation):

| Input | Source | Used for |
|-------|--------|---------|
| `lastLog.pestDestroyedPlots.length` | `DailyLogEntry` | Pest infestation insight |
| `lastLog.weatherId` | `DailyLogEntry` | Flash drought insight |
| `daysPlayed` | existing prop | Short-run insight |
| `peakBalance` | existing prop | Low-recovery insight |

Evaluation is a top-to-bottom priority check (first match wins). No new state field, no persistence, no side effects.

---

## Derived State: Onboarding Hint Visibility

The hint visibility is computed inline in `GameBoard` from existing `GameState` fields:

```typescript
const showOnboardingHint =
  state.currentDay === 1 &&
  state.plots.every(p => p.cropId === null && !p.exhaustedSinceDay) &&
  Object.values(state.seedInventory).every(n => n === 0);
```

Dismissed when the player plants their first seed (plots array updates, re-evaluation returns `false`). No new state field required.

---

## Derived State: Autosave Indicator

A local UI state (not persisted) in `GameBoard`:

```typescript
const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
```

Set to `Date.now()` inside the `onNextDay`, `onPlantSeed`, `onBuySeed`, `onBuyUpgrade` callbacks after the action resolves. A `useEffect` watching `lastSavedAt` drives a 2-second visibility window via a second boolean state `showSaveConfirm`.

---

## No GameState Schema Changes

`schemaVersion` remains at `3`. No migration needed. All UI polish changes are stateless from the persistence layer's perspective.

---

## State Transitions: Planting Mode Visual

```
idle state
  └─ player buys seed
       └─ selectedCrop set (GameBoard local state)
            └─ isPlantingMode = true
                 ├─ FarmGrid: ring/border activated
                 └─ PlotCard (empty): invitation highlight activated
                      └─ player taps empty plot
                           └─ plantSeed() called → selectedCrop cleared
                                └─ isPlantingMode = false
                                     ├─ FarmGrid: ring/border deactivated
                                     └─ PlotCard: invitation highlight deactivated
```

---

## State Transitions: Low-Balance Warning

```
coinBalance > LOW_BALANCE_WARNING_THRESHOLD (45)
  └─ normal gold display

coinBalance ≤ LOW_BALANCE_WARNING_THRESHOLD (45)
  └─ amber warning state (color shift + icon)
       └─ coinBalance ≤ LOW_BALANCE_CRITICAL_THRESHOLD (15)
            └─ red danger state (pulse animation)
                 └─ coinBalance < LAND_LEASE_FEE → bankruptcy
```

Recovery path: if balance rises above threshold (e.g., large harvest), warning state deactivates on next render.
