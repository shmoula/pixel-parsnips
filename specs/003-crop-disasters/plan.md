# Implementation Plan: Negative Weather Events — Crop Disasters

**Branch**: `003-crop-disasters` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)

## Summary

Introduce three disaster-class weather events (Blight, Pest Infestation, Flash Drought) to the existing weather system by replacing the discrete uniform weather selector with a continuous probability-band selector. Each disaster attacks a different game dimension: Blight reduces harvest yield to 10%, Pest Infestation destroys random crops before harvest and leaves plots in an acknowledgment-required state, and Flash Drought doubles the growth time of crops planted in the next two calendar days.

## Technical Context

**Language/Version**: TypeScript 5.4 + React 18
**Primary Dependencies**: Vite 5, Tailwind CSS 3
**Storage**: localStorage (key: `pixel-parsnips-state`; schema version bumps 2 → 3)
**Testing**: Vitest (`npm test`)
**Target Platform**: Browser (SPA)
**Project Type**: Web application (game)
**Performance Goals**: Single-player browser game; no latency targets
**Constraints**: Pure engine functions (no mutation); all state changes return new state objects
**Scale/Scope**: 12 plots, 5+3 weather events, 1 save slot

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ PASS | `spec.md` complete; clarifications resolved |
| II. Incremental & Independent Delivery | ✅ PASS | US1 (Blight), US2+US3 (Pest), US4 (Flash Drought) are independently testable and deliverable |
| III. Quality Gates | ✅ PASS | Spec explicitly requests tests; Red-Green-Refactor required per constitution |
| IV. Simplicity (YAGNI) | ✅ PASS | No new abstractions. `pestDestructionOverride` justified by FR-012. `WEATHER_PROBABILITY_BANDS` replaces `WEATHER_IDS` with a simpler concept. |
| V. Observability | ✅ PASS | `DailyLogEntry` extended to record all disaster outcomes; `console.info` on schema migration |

**Post-Phase 1 re-check**: All principles still pass. No new complexity introduced beyond what the spec requires.

## Project Structure

### Documentation (this feature)

```text
specs/003-crop-disasters/
├── plan.md              # This file
├── research.md          # Phase 0 — design decisions
├── data-model.md        # Phase 1 — type changes
├── quickstart.md        # Phase 1 — test recipes
├── contracts/
│   ├── game-engine-api.md      # processTurn, plantSeed, clearPestDamage signatures
│   ├── localstorage-schema.md  # v3 schema diff
│   └── ui-components.md        # PlotCard, FarmGrid, GameBoard, DailyLog changes
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── engine/
│   ├── types.ts          # WeatherId, PlotState, GameState, DailyLogEntry, result types
│   ├── constants.ts      # WEATHER_DEFINITIONS, WEATHER_PROBABILITY_BANDS, SCHEMA_VERSION
│   ├── gameEngine.ts     # processTurn, plantSeed, clearPestDamage (new)
│   └── useGameEngine.ts  # clearPestDamage hook action (new)
└── components/
    ├── PlotCard.tsx       # PestDamagedPlot sub-component; drought-penalised indicator
    ├── FarmGrid.tsx       # new props threaded through
    ├── GameBoard.tsx      # Flash Drought banner; onClearPestDamage wiring
    └── DailyLog.tsx       # Disaster event sections; disaster badge styling

tests/
├── engine/
│   └── gameEngine.test.ts   # New describe blocks for disaster events
└── components/
    └── GameBoard.test.tsx    # Smoke tests for new UI states (if applicable)
```

**Structure Decision**: Single-project layout (unchanged from feature 001/002). All changes are within existing directories; no new directories created.

## Complexity Tracking

> No constitution violations. Table intentionally empty.

## Implementation Phases

### Phase 1 — Engine: Types, Constants, Weather Selection

**Scope**: `src/engine/types.ts`, `src/engine/constants.ts`, `src/engine/gameEngine.ts` (weather selection only)

Changes:
1. Extend `WeatherId` union with `'blight' | 'pest_infestation' | 'flash_drought'`
2. Add `pestDamaged: boolean` and `droughtPenalised: boolean` to `PlotState`
3. Add `flashDroughtDaysRemaining: number` to `GameState`
4. Add `pestDestroyedPlots: number[]` and `flashDroughtDaysAfter: number` to `DailyLogEntry`
5. Add `'plot_pest_damaged'` to `PlantResult` error union
6. Add `ClearPestDamageResult` type
7. Add three new entries to `WEATHER_DEFINITIONS`
8. Replace `WEATHER_IDS` with `WEATHER_PROBABILITY_BANDS`
9. Bump `SCHEMA_VERSION` to 3
10. Update `initialGameState()` to include new fields
11. Update weather selection in `processTurn` from index-based to probability-band lookup

**Tests**: Weather selection tests updated to use `Math.random` spy with continuous values instead of index values.

---

### Phase 2 — Engine: Blight

**Scope**: `src/engine/gameEngine.ts` — `processTurn` step 2 / step 10

Changes:
- When `weatherId === 'blight'`, apply `0.1` multiplier to harvests (already handled by `WEATHER_DEFINITIONS['blight'].multiplier = 0.1` + existing harvest logic — no code change needed beyond Phase 1)
- Verify `log.weatherId === 'blight'` and `log.weatherMultiplier === 0.1` in log

**Tests (Red-Green-Refactor)**:
- Blight radish: `floor(12 * 0.1) = 1` coin
- Blight pumpkin (3 turns): `floor(65 * 0.1) = 6` coins
- No crops maturing on Blight day: `log.totalHarvestIncome === 0`, log records Blight
- DailyLogEntry fields correct

---

### Phase 3 — Engine: Pest Infestation

**Scope**: `src/engine/gameEngine.ts` — new step 2a in `processTurn`; new `clearPestDamage` function; `plantSeed` guard

Changes:
1. Add step 2a to `processTurn`: destroy plots (deterministic override or 50% random per occupied plot); set `pestDamaged: true`, clear crop fields on destroyed plots
2. Add `pestDestroyedPlots` to `DailyLogEntry` build
3. Add `plot_pest_damaged` guard to `plantSeed`
4. Implement `clearPestDamage(state, plotId): ClearPestDamageResult`

**Tests (Red-Green-Refactor)**:
- Pest infestation with `pestDestructionOverride=[0,2]`: only plots 0 and 2 destroyed
- Destroyed plots have `pestDamaged=true`, `cropId=null`
- Untouched plots are unaffected
- `log.pestDestroyedPlots` matches override list
- No crops → `log.pestDestroyedPlots === []`, no crash
- Crops maturing this turn: included in destruction roll (destroyed with no yield)
- `plantSeed` returns `plot_pest_damaged` on a pestDamaged plot
- `clearPestDamage` success: `pestDamaged=false`, plot plantable
- `clearPestDamage` errors: `invalid_plot`, `plot_not_pest_damaged`
- `pestDamaged` survives JSON round-trip
- Day advance does NOT clear `pestDamaged` (must remain until player acknowledges)

---

### Phase 4 — Engine: Flash Drought

**Scope**: `src/engine/gameEngine.ts` — step 2b and step 8.6 in `processTurn`; `plantSeed` growth penalty; `initialGameState`

Changes:
1. Add step 2b: when `weatherId === 'flash_drought'`, `flashDroughtDaysRemaining += 2`
2. Add step 8.6: if `weatherId !== 'flash_drought'` and `flashDroughtDaysRemaining > 0`, decrement `flashDroughtDaysRemaining` by 1 (skip decrement on the turn Flash Drought fires, so both N+1 and N+2 planting days receive the penalty)
3. Modify `plantSeed`: if `flashDroughtDaysRemaining > 0`, `daysRemaining = Math.ceil(crop.growthDays * 2)`, `droughtPenalised = true`
4. On harvest: `droughtPenalised = false` (reset with other crop fields)

**Tests (Red-Green-Refactor)**:
- Flash Drought on day N: `flashDroughtDaysRemaining = 2` after turn
- Plant on day N+1: `daysRemaining === 2` for radish (doubled), `droughtPenalised=true`
- Plant on day N+2 (counter=1): still doubled
- Plant on day N+3 (counter=0): normal growth, `droughtPenalised=false`
- Second Flash Drought while counter > 0: counter increases by 2 (stacks)
- Flash drought counter does not affect current-day harvest yield
- `flashDroughtDaysRemaining` survives JSON round-trip
- `log.flashDroughtDaysAfter` reflects post-decrement counter value
- Radish growth doubled: `ceil(1 * 2) = 2`; Pumpkin: `ceil(3 * 2) = 6`

---

### Phase 5 — UI: PlotCard (Pest Damage + Drought Indicator)

**Scope**: `src/components/PlotCard.tsx`

Changes:
1. Add `PestDamagedPlot` sub-component (🐛 emoji, "Pest Damage" label, "Clear Plot" button)
2. Add `onClearPestDamage?: (plotId: number) => void` prop
3. Render `PestDamagedPlot` when `plot.pestDamaged === true` (highest priority render branch)
4. Add drought icon to growing crop render when `plot.droughtPenalised === true`

---

### Phase 6 — UI: FarmGrid, GameBoard, DailyLog

**Scope**: `src/components/FarmGrid.tsx`, `src/components/GameBoard.tsx`, `src/components/DailyLog.tsx`

Changes:
1. **FarmGrid**: thread `onClearPestDamage` through to `PlotCard` (drought indicator uses `plot.droughtPenalised` directly; no `flashDroughtDaysRemaining` prop needed)
2. **GameBoard**:
   - Add `onClearPestDamage` prop; wire to `useGameEngine.clearPestDamage`
   - Render Flash Drought banner when `state.flashDroughtDaysRemaining > 0`
3. **DailyLog**:
   - Disaster badge styling (red/amber) for blight/pest/flash_drought weather IDs
   - Pest destroyed plots section (when `log.pestDestroyedPlots.length > 0`)
   - Flash Drought announcement section (when `log.weatherId === 'flash_drought'`)

---

### Phase 7 — Hook & Persistence

**Scope**: `src/engine/useGameEngine.ts`

Changes:
1. Import `clearPestDamage as engineClearPestDamage`
2. Add `clearPestDamage` action to hook (same pattern as `applyFertilizer`)
3. Wire `clearPestDamage` through `App.tsx` → `GameBoard`
4. Verify `saveState`/`loadState` with `SCHEMA_VERSION = 3`
