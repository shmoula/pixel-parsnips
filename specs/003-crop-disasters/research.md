# Research: 003-crop-disasters

**Branch**: `003-crop-disasters` | **Date**: 2026-03-19

## Summary

No external unknowns. All decisions were resolved by inspecting the existing codebase. This document records the key design choices and the reasoning behind each.

---

## Decision 1: Weather selection mechanism

**Decision**: Replace `WEATHER_IDS[Math.floor(Math.random() * n)]` with a single `Math.random()` roll mapped to probability bands.

**Rationale**: The existing index-based selection gives each of the 5 weather types exactly 20%. The new feature requires non-uniform probabilities for disaster events (5% each). A continuous uniform roll on [0.0, 1.0) trivially supports arbitrary probability bands without restructuring the weather registry.

**Mapping**:
```
[0.00, 0.05)  → 'blight'
[0.05, 0.10)  → 'pest_infestation'
[0.10, 0.15)  → 'flash_drought'
[0.15, 0.32)  → 'drought'       (0.17 share of remaining 0.85)
[0.32, 0.49)  → 'overcast'
[0.49, 0.66)  → 'sunny'
[0.66, 0.83)  → 'warm_breeze'
[0.83, 1.00)  → 'perfect_sun'
```

**Alternatives considered**:
- Keep index-based selection with a 20-slot lookup array (disaster events occupy 1 slot each). Rejected: fragile — adding/removing events requires rebalancing slot counts.
- Weighted array of `{id, probability}` with a cumulative sum scan. Viable but more complex than a simple if/else chain; YAGNI.

**Test injection**: The existing `weatherRoll?: WeatherId` parameter still works unchanged — a supplied value bypasses the random roll entirely.

---

## Decision 2: Pest Infestation destruction roll injection

**Decision**: Add a third optional parameter `pestDestructionOverride?: number[]` to `processTurn`. When provided, exactly those plot IDs are destroyed; when omitted, each occupied plot is independently rolled at 50%.

**Rationale**: The spec requires deterministic test control (FR-012, Q2 clarification). The simplest injectable contract is an explicit list of plot IDs, consistent with the existing `weatherRoll` pattern (pass a value → skip randomness).

**Alternatives considered**:
- A random seed parameter. More flexible but requires a seeded PRNG which adds a dependency. Explicit IDs are simpler and sufficient.
- A `boolean[]` parallel to `state.plots`. More verbose than a plot ID list for no benefit.

---

## Decision 3: FlashDrought counter placement

**Decision**: Add `flashDroughtDaysRemaining: number` directly to `GameState` (top-level field, default 0).

**Rationale**: No new entity is needed — a single integer counter on GameState is the minimum sufficient representation. The counter decrements in `processTurn` (step 8.6, after day increment) and is read in `plantSeed` to apply the growth penalty.

**Counter lifecycle**:
- Flash Drought event occurs on day N → `flashDroughtDaysRemaining = +2` (stacks if already > 0)
- After step 8 (day increment) each turn → counter decrements by 1 if > 0
- `plantSeed` checks `flashDroughtDaysRemaining > 0`; if true, doubles `daysRemaining` and sets `droughtPenalised = true` on the plot

**Alternatives considered**:
- Track "drought ends on day X" as an absolute day number. Equivalent but slightly more complex at call sites that read the countdown UI display.

---

## Decision 4: Pest Damage state on PlotState

**Decision**: Add `pestDamaged: boolean` flag to `PlotState` (default `false`).

**Rationale**: The `pestDamaged` flag is independent of `exhaustedSinceDay` and `cropId`. A simple boolean is the minimum needed to block planting and render the acknowledgment UI.

**Interaction with other states**: A plot can be `pestDamaged: true` and `exhaustedSinceDay: null` simultaneously (normal case). A pestDamaged plot will never have `cropId !== null` (the crop was removed). The `pestDamaged` guard in `plantSeed` fires after the `exhaustedSinceDay` guard.

---

## Decision 5: Drought-penalised crop indicator

**Decision**: Add `droughtPenalised: boolean` to `PlotState` (default `false`). Set to `true` at planting time when `flashDroughtDaysRemaining > 0`. Never reset (persists until crop is harvested and plot cleared).

**Rationale**: The UI needs to know, for each growing crop, whether it was planted during an active drought window so it can render the per-plot indicator (FR-018). Storing the flag on the plot avoids recomputing this from planting day vs. drought history.

---

## Decision 6: DailyLogEntry extensions

**Decision**: Extend `DailyLogEntry` with:
- `pestDestroyedPlots: number[]` — IDs of plots destroyed this turn (empty array if no Pest Infestation)
- `flashDroughtDaysAfter: number` — value of `flashDroughtDaysRemaining` after this turn's processing (0 if no active drought)

**Rationale**: Mirrors the existing `exhaustedPlots: number[]` pattern. Always-present fields (never null/undefined) keep log consumers simple.

---

## Decision 7: Schema version bump

**Decision**: `SCHEMA_VERSION` bumps from `2` to `3`.

**Rationale**: New fields are added to `PlotState` (`pestDamaged`, `droughtPenalised`) and `GameState` (`flashDroughtDaysRemaining`). Existing saves lack these fields and would produce undefined-access bugs if loaded without migration. Per project convention, old saves are discarded on schema mismatch and a new game is started.

---

## Decision 8: New engine function — clearPestDamage

**Decision**: Expose a pure `clearPestDamage(state, plotId): ClearPestDamageResult` function in `gameEngine.ts`.

**Rationale**: Follows the same pattern as `applyFertilizer` — a player-triggered action that modifies a plot's state. Keeping it pure (no mutation) maintains consistency with all other engine functions and makes it trivially testable.
