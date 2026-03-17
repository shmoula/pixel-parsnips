---
description: "Task list for Pixel Parsnips — Plot Exhaustion Maintenance"
---

# Tasks: Plot Exhaustion Maintenance

**Input**: Design documents from `/specs/002-plot-exhaustion-maintenance/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: plan.md Constitution Check §III mandates TDD for all engine pure functions.
Test tasks are included and MUST precede the implementation tasks they cover within
each user story phase (Red–Green–Refactor).

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story. This is an incremental feature on top of 001; the project
toolchain (Vite, Tailwind, Vitest) is already configured.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no blocking dependency)
- **[Story]**: Which user story this task belongs to (US1–US3)
- Include exact file paths in all descriptions

## Path Conventions

All paths relative to repo root. Single SPA: `src/`, `tests/`.

---

## Phase 1: Setup (Data Model & Constants)

**Purpose**: Update the type system and constants for schema v2. BLOCKS all user stories —
no engine or UI work may begin until `npx tsc --noEmit` passes cleanly.

- [x] T001 Extend `PlotState` with `consecutiveHarvests: number` and `exhaustedSinceDay: number | null`; extend `GameState` with `fertilizerInventory: number`; extend `DailyLogEntry` with `exhaustedPlots: number[]`; add `FertilizerResult` union type in `src/engine/types.ts`
- [x] T002 [P] Add `SCHEMA_VERSION = 2`, `EXHAUSTION_THRESHOLD = 3`, `EXHAUSTION_RECOVERY_DAYS = 3`, `FERTILIZER_COST = 30` in `src/engine/constants.ts`
- [x] T003 Update `initialGameState()` in `src/engine/gameEngine.ts` to set `consecutiveHarvests: 0`, `exhaustedSinceDay: null` on each plot, and `fertilizerInventory: 0` on `GameState` (depends on T001, T002)

**Checkpoint**: `npx tsc --noEmit` passes; `npm run lint` clean; new fields visible in initial state object.

---

## Phase 2: Foundational (Schema Migration Guard)

**Purpose**: Ensure old v1 saves are correctly discarded when the game loads with schema v2.
This single change is a prerequisite for correct behavior in all stories.

**⚠️ CRITICAL**: Must complete before any user story ships to production; prevents corrupted
state from v1 saves silently producing `undefined` for the new required fields.

- [x] T004 Update the schema migration `console.info` log in `src/engine/useGameEngine.ts` to emit `"[PixelParsnips] Save data schema upgraded from v1 to v2 — starting a new game."` when a loaded save's `schemaVersion !== SCHEMA_VERSION`

**Checkpoint**: Load the game with a manually injected v1 localStorage payload; confirm the
console emits the migration message and the game starts fresh.

---

## Phase 3: User Story 1 — Plot Becomes Exhausted After Repeated Use (Priority: P1) 🎯 MVP

**Goal**: After 3 consecutive harvests on the same plot, the plot enters "Exhausted" state
and planting is blocked. Natural recovery clears Exhaustion after 3 in-game days.

**Independent Test**: Plant Radish on plot 0 three times (advancing 1 day per harvest).
After the 3rd harvest, `plots[0].exhaustedSinceDay` must be non-null. Attempting `plantSeed`
on plot 0 must return `{ ok: false, error: 'plot_exhausted' }`. Advance 3 more days;
`plots[0].exhaustedSinceDay` must return to `null`.

### Tests for User Story 1 ⚠️ Write FIRST — confirm FAIL before T008

- [x] T005 Write failing unit tests for `processTurn` exhaustion trigger (sub-steps 3a/3b): test that `consecutiveHarvests` increments on each harvest, that the 3rd harvest sets `exhaustedSinceDay`, resets `consecutiveHarvests` to 0, and populates `exhaustedPlots[]` in the log in `tests/engine/gameEngine.test.ts`
- [x] T006 Write failing unit tests for `processTurn` natural recovery (step 8.5): test that an exhausted plot clears after exactly `EXHAUSTION_RECOVERY_DAYS` turns, and not before, in `tests/engine/gameEngine.test.ts`
- [x] T007 Write failing unit test for `plantSeed` returning `{ ok: false, error: 'plot_exhausted' }` when target plot has `exhaustedSinceDay !== null` in `tests/engine/gameEngine.test.ts`

### Implementation for User Story 1

- [x] T008 Extend `processTurn` in `src/engine/gameEngine.ts` with sub-step 3a (increment `consecutiveHarvests` per harvested plot) and sub-step 3b (when `consecutiveHarvests >= EXHAUSTION_THRESHOLD`: set `exhaustedSinceDay = state.currentDay + 1`, reset `consecutiveHarvests = 0`, append `plotId` to `exhaustedPlots[]`) — makes T005 GREEN
- [x] T009 Extend `processTurn` in `src/engine/gameEngine.ts` with step 8.5 (after day increment: for each exhausted plot, clear `exhaustedSinceDay` and `consecutiveHarvests` when `currentDay - exhaustedSinceDay >= EXHAUSTION_RECOVERY_DAYS`) — makes T006 GREEN
- [x] T010 Extend `plantSeed` in `src/engine/gameEngine.ts` to return `{ ok: false, error: 'plot_exhausted' }` when the target plot has `exhaustedSinceDay !== null`; evaluate this guard after `plot_occupied` and before `no_seed` in `src/engine/gameEngine.ts` — makes T007 GREEN
- [x] T011 Update `PlotCard.tsx` in `src/components/PlotCard.tsx` to render an "Exhausted" state when `plot.exhaustedSinceDay !== null`: hide the plant-seed button, display an "Exhausted" label with a "Wait or buy Fertilizer in the shop" hint message

**Checkpoint**: T005–T007 tests all GREEN. In the browser: plant Radish 3× on one plot, clicking
"Next Day" each time — on the 4th planting attempt the plot shows "Exhausted" and blocks input.
Advance 3 more days; plot resets to empty.

---

## Phase 4: User Story 2 — Buy and Use Fertilizer to Instantly Restore a Plot (Priority: P2)

**Goal**: Player buys Fertilizer (30 coins) from the shop, then clicks an Exhausted plot and
uses the Fertilizer to immediately restore it without waiting.

**Independent Test**: Exhaust plot 0. Verify `buyFertilizer` succeeds (balance decreases by 30,
`fertilizerInventory` increases by 1). Verify `applyFertilizer(state, 0)` succeeds: plot is
immediately empty, `fertilizerInventory` back to 0. Verify `applyFertilizer` on a non-exhausted
plot returns `plot_not_exhausted`. Verify with empty inventory it returns `no_fertilizer`.

### Tests for User Story 2 ⚠️ Write FIRST — confirm FAIL before T015

- [x] T012 Write failing unit tests for `buyFertilizer` in `tests/engine/gameEngine.test.ts`: test success (balance decreases, inventory increases), insufficient funds (returns `insufficient_funds` error), quantity > 1 purchase
- [x] T013 Write failing unit tests for `applyFertilizer` in `tests/engine/gameEngine.test.ts`: test success (plot cleared, inventory decremented), `no_fertilizer` error, `plot_not_exhausted` error, `invalid_plot` error, confirm `consecutiveHarvests` resets to 0 on application

### Implementation for User Story 2

- [x] T014 Implement `buyFertilizer(state: GameState, quantity: number): BuyResult` as a pure function in `src/engine/gameEngine.ts`: deduct `FERTILIZER_COST * quantity` from `coinBalance`, increase `fertilizerInventory` by `quantity`; return `insufficient_funds` if balance too low — makes T012 GREEN
- [x] T015 Implement `applyFertilizer(state: GameState, plotId: number): FertilizerResult` as a pure function in `src/engine/gameEngine.ts`: validate `invalid_plot`, `plot_not_exhausted`, `no_fertilizer` (in that order); on success: clear `exhaustedSinceDay`, `consecutiveHarvests`, all crop fields, decrement `fertilizerInventory` — makes T013 GREEN
- [x] T016 Add `buyFertilizer`, `applyFertilizer`, and `getFertilizerCount` to the `useGameEngine` hook in `src/engine/useGameEngine.ts`; add localStorage save triggers for both actions (consistent with existing `buySeed`/`buyUpgrade` pattern); write hook integration tests in `tests/engine/useGameEngine.test.ts` verifying that (a) calling `buyFertilizer` updates React state and writes the updated `fertilizerInventory` to localStorage, and (b) calling `applyFertilizer` on an exhausted plot clears it in React state and persists the change to localStorage
- [x] T017 [P] Add Fertilizer shop item to `src/components/Shop.tsx`: show item name "Fertilizer", cost 30 coins, current inventory count from `getFertilizerCount()`; buy button disabled when `coinBalance < FERTILIZER_COST`
- [x] T018 Update `src/components/PlotCard.tsx` to show a "Use Fertilizer" button when plot is Exhausted and `fertilizerInventory > 0`; replace hint with "Buy Fertilizer in the shop" when `fertilizerInventory === 0`; button calls `applyFertilizer(plot.id)` via the hook

**Checkpoint**: T012–T013 tests GREEN. In the browser: exhaust a plot → shop shows Fertilizer at 30 coins → buy one → click exhausted plot → "Use Fertilizer" button appears → click it → plot immediately empty and plantable; `fertilizerInventory` returns to 0.

---

## Phase 5: User Story 3 — Natural Recovery Countdown Visibility (Priority: P3)

**Goal**: Each Exhausted plot displays the exact number of in-game days remaining until
natural recovery, decrementing each day.

**Independent Test**: Exhaust a plot; confirm `PlotCard` renders "3 days remaining". Advance
one day; confirm "2 days remaining". Advance two more; confirm plot is empty (no countdown).

### Tests for User Story 3 ⚠️ Write FIRST — confirm FAIL before T020

- [x] T019 Write failing snapshot/render test in `tests/components/GameBoard.test.tsx` confirming `PlotCard` renders the correct "N days remaining" string for a given `exhaustedSinceDay` and `currentDay` pair (test with N=3, N=2, N=1)

### Implementation for User Story 3

- [x] T020 Update `src/components/PlotCard.tsx` to compute and display `daysUntilRecovery = EXHAUSTION_RECOVERY_DAYS - (currentDay - plot.exhaustedSinceDay!)` as "N days remaining" text beneath the "Exhausted" label; import `EXHAUSTION_RECOVERY_DAYS` from `src/engine/constants.ts` — makes T019 GREEN
- [x] T021 [P] Update `src/components/DailyLog.tsx` to list newly exhausted plots from `lastDailyLog.exhaustedPlots[]` (e.g. "Plot #3 became exhausted.") to satisfy Constitution Principle V (Observability)

**Checkpoint**: T019 test GREEN. Exhausted plots show live countdown in browser; DailyLog
panel shows exhaustion events on the day they occur.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge case coverage, accessibility, and final quality gate.

- [x] T022 Add edge case tests in `tests/engine/gameEngine.test.ts`: (a) all 12 plots simultaneously exhausted — no crash; (b) `applyFertilizer` immediately re-enables planting with a fresh counter; (c) full save/reload round-trip preserves `consecutiveHarvests`, `exhaustedSinceDay`, and `fertilizerInventory` after `JSON.parse(JSON.stringify(state))`; add render assertion in `tests/components/GameBoard.test.tsx` confirming `PlotCard` does NOT display the `consecutiveHarvests` value anywhere in the DOM for any plot state (FR-014)
- [x] T023 [P] Add `aria-label` to the "Use Fertilizer" button in `src/components/PlotCard.tsx` (e.g. `aria-label="Use Fertilizer on this plot"`); ensure exhausted state is conveyed via text not color alone (axe-core check via `toHaveNoViolations`)
- [x] T024 [P] Add `aria-label` to the Fertilizer buy button in `src/components/Shop.tsx` (e.g. `aria-label="Buy 1 Fertilizer for 30 coins"`); ensure disabled state is communicated to screen readers with `aria-disabled`
- [x] T025 Run `npm test && npm run lint` to confirm all constitution gates pass: all tests green, no lint errors, no axe violations, TypeScript strict mode clean

**Checkpoint**: All tests pass. Lint clean. `npm run build` succeeds. Manual smoke-test: full
exhaustion cycle (exhaust → wait → recover) and fertilizer cycle (exhaust → buy → apply)
both work end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — run after T003 passes `tsc --noEmit`
- **US1 (Phase 3)**: Depends on Phase 1 + 2 completion — BLOCKS US2 and US3 (Fertilizer and countdown both require the exhaustion engine)
- **US2 (Phase 4)**: Depends on Phase 3 completion (needs exhausted plots to exist)
- **US3 (Phase 5)**: Depends on Phase 3 completion (needs `exhaustedSinceDay` field); independent of US2
- **Polish (Phase 6)**: Depends on US1 + US2 + US3

### User Story Dependencies

- **US1 (P1)**: Foundational only — engine exhaustion logic is self-contained
- **US2 (P2)**: Depends on US1 (Fertilizer is meaningless without Exhausted plots existing)
- **US3 (P3)**: Depends on US1 (countdown requires `exhaustedSinceDay`); independent of US2

### Within Each Story

- Tests MUST be written first and confirmed FAILING before implementation
- Engine pure functions before hook wiring
- Hook wiring before UI components
- Core implementation before edge cases / accessibility

### Parallel Opportunities

Within Phase 1: T001 and T002 touch different files — run in parallel.
Within Phase 3: T005, T006, T007 all write to `tests/engine/gameEngine.test.ts` — write sequentially (or as separate describe-blocks in one sitting); T008–T010 are sequential engine changes.
Within Phase 4: T012 and T013 both write to `tests/engine/gameEngine.test.ts` — write sequentially; T017 (Shop.tsx) and T018 (PlotCard.tsx) are different files — implement in parallel.
Within Phase 6: T022, T023, T024 are independent — run in parallel.

---

## Parallel Examples

### Phase 1

```text
Task A: "Extend types in src/engine/types.ts" (T001)
Task B: "Add constants to src/engine/constants.ts" (T002)  ← parallel with A
Then: T003 (depends on both)
```

### Phase 3 (US1 — RED phase)

```text
T005 → T006 → T007 (sequential — same file: tests/engine/gameEngine.test.ts)
Then: T008, T009, T010 (GREEN phase — sequential engine changes)
Then: T011 (UI — independent of T008–T010 ordering)
```

### Phase 4 (US2 — RED phase)

```text
T012 → T013 (sequential — same file: tests/engine/gameEngine.test.ts)
Then: T014 → T015 → T016 (sequential engine/hook + hook integration tests)
Then: T017 (Shop.tsx) and T018 (PlotCard.tsx)  ← parallel UI tasks (different files)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Data Model & Constants
2. Complete Phase 2: Migration Guard
3. Complete Phase 3: US1 exhaustion engine + PlotCard blocked state
4. **STOP and VALIDATE**: exhaustion triggers, recovery, planting blocked — all testable
5. Demo: farm with exhaustion mechanic working end-to-end

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Exhaustion works, plots block → **MVP ship**
3. Phase 4 (US2) → Fertilizer available → players have relief valve
4. Phase 5 (US3) → Countdown visible → mechanic is fully legible
5. Phase 6 → Polish + quality gate → PR-ready

### Parallel Team Strategy (if applicable)

After Phase 3 completes:
- Developer A: Phase 4 (US2 — Fertilizer)
- Developer B: Phase 5 (US3 — Countdown visibility)
Both are independent of each other and can merge separately.

---

## Notes

- `[P]` tasks touch different files or independent test suites — safe to run concurrently
- `[Story]` label maps each task to its user story for traceability and independent demo
- `consecutiveHarvests` is **never** rendered in the UI — see FR-014 and research.md §6
- `exhaustedSinceDay` is set to `newCurrentDay` (post-increment), not pre-increment — see research.md §2
- Schema v1 saves are silently discarded; no data migration transforms — see research.md §8
- All coin arithmetic uses the existing `coins(n)` helper (`Math.floor`) from `src/engine/constants.ts`
