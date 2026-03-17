# Implementation Plan: Plot Exhaustion Maintenance

**Branch**: `002-plot-exhaustion-maintenance` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-plot-exhaustion-maintenance/spec.md`

## Summary

Extend the existing Pixel Parsnips farming game with a plot-wear mechanic: after
3 consecutive harvests on the same plot, that plot enters an "Exhausted" state and
cannot be planted for 3 in-game days. Players may bypass the wait by purchasing and
applying a Fertilizer item from the shop. The change spans the engine's data model
(two new `PlotState` fields, one new `GameState` field), three engine functions
(extended `processTurn`, extended `plantSeed`, new `applyFertilizer`), one new shop
function (`buyFertilizer`), updated hook surface, and UI updates to `PlotCard` and
`Shop`. `SCHEMA_VERSION` is bumped from 1 to 2; old saves are silently discarded.

## Technical Context

**Language/Version**: TypeScript 5.4 + React 18 (unchanged from 001)
**Primary Dependencies**: React 18, Tailwind CSS 3, Vite 5 (unchanged from 001)
**Storage**: localStorage (browser — session persistence; schema version bumped to 2)
**Testing**: Vitest 1.x + React Testing Library 14 (unchanged from 001)
**Target Platform**: Modern evergreen browsers (unchanged from 001)
**Project Type**: Single-page application (unchanged from 001)
**Performance Goals**: Turn processing < 50 ms (exhaustion checks add O(12) scan — negligible)
**Constraints**: All state updates immutable; game logic isolated in `gameEngine.ts` pure
functions; consecutive harvest counter is internal state, never rendered in the UI (FR-014)
**Scale/Scope**: Adds ~200 LOC to engine + ~100 LOC to components; no new files required
beyond updated contracts and data model docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Specification-First ✅

| Rule | Status | Notes |
|------|--------|-------|
| spec.md exists before any implementation | ✅ Pass | `specs/002-plot-exhaustion-maintenance/spec.md` complete and clarified |
| User stories have priorities and independent acceptance scenarios | ✅ Pass | P1/P2/P3 stories; each independently testable |
| Implementation without approved spec blocked | ✅ Pass | This plan is generated from the approved spec |

### II. Incremental & Independent Delivery ✅

| Rule | Status | Notes |
|------|--------|-------|
| Each story independently implementable | ✅ Pass | P1 (exhaustion engine) stands alone; P2 (fertilizer) layers on top; P3 (countdown UI) is display-only |
| No story introduces breaking dependency on an incomplete story | ✅ Pass | P2 and P3 are additive; P1 can ship without them |
| Stories ordered by priority | ✅ Pass | Tasks will follow P1 → P2 → P3 |

### III. Quality Gates ✅

| Rule | Status | Notes |
|------|--------|-------|
| Constitution Check completed before Phase 0 | ✅ Pass | This document |
| Tests written before implementation (TDD) | ✅ Pass | All new engine functions (`processTurn` extension, `plantSeed` extension, `applyFertilizer`, `buyFertilizer`) follow Red–Green–Refactor |
| Gate violations documented in Complexity Tracking | ✅ Pass | No violations; table omitted |

### IV. Simplicity (YAGNI) ✅

| Rule | Status | Notes |
|------|--------|-------|
| No abstractions introduced without two concrete use cases | ✅ Pass | Two new fields added directly to existing interfaces; no new abstractions |
| Complexity justified | ✅ Pass | Each new field and function solves exactly one spec requirement |
| No premature generalization | ✅ Pass | `buyFertilizer` is a dedicated function, not a generalised shop item system |

### V. Observability ✅

| Rule | Status | Notes |
|------|--------|-------|
| User-facing operations emit structured log entries | ✅ Pass | Exhaustion events visible in `DailyLogEntry.exhaustedPlots`; Fertilizer use does not advance day so no log entry needed |
| Silent failures prohibited | ✅ Pass | `plantSeed` returns `'plot_exhausted'` error; `applyFertilizer` returns typed errors |

**No constitution violations.** Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/002-plot-exhaustion-maintenance/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (delta from 001 data model)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── game-engine-api.md    # Updated engine API (applyFertilizer, buyFertilizer, plantSeed delta)
│   └── localstorage-schema.md # Updated schema (version 2)
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

All changes are additive to the existing `src/` layout from 001. No new files or
directories are required; existing files are extended.

```text
src/
├── components/
│   ├── PlotCard.tsx         # UPDATED — exhausted state display + "Use Fertilizer" action
│   └── Shop.tsx             # UPDATED — Fertilizer shop item added
├── engine/
│   ├── types.ts             # UPDATED — PlotState (2 new fields), GameState (1 new field)
│   ├── constants.ts         # UPDATED — SCHEMA_VERSION=2, FERTILIZER_COST, EXHAUSTION_THRESHOLD,
│   │                        #           EXHAUSTION_RECOVERY_DAYS
│   ├── gameEngine.ts        # UPDATED — processTurn (exhaustion trigger + recovery),
│   │                        #           plantSeed (new error code), applyFertilizer (new),
│   │                        #           buyFertilizer (new)
│   └── useGameEngine.ts     # UPDATED — applyFertilizer action, buyFertilizer action,
│                            #           getFertilizerCount derived helper

tests/
└── engine/
    └── gameEngine.test.ts   # UPDATED — tests for all new and modified engine functions
```

**Structure Decision**: All changes fit within the existing single-project SPA layout
established in 001. The strict `engine/` boundary (pure functions only) is preserved.
