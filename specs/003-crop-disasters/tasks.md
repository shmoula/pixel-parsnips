# Tasks: Negative Weather Events — Crop Disasters

**Input**: Design documents from `/specs/003-crop-disasters/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Tests are included — spec.md explicitly requires deterministic test injection (SC-002, FR-012) and the constitution mandates Red-Green-Refactor when tests are requested.

**Organization**: Tasks grouped by user story. Each phase delivers an independently testable increment.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user story (US1–US4)
- Tests are written **before** implementation within each story phase

---

## Phase 1: Foundational — Types, Constants & Weather Selection

**Purpose**: Core type and constant changes that ALL user stories depend on. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: Blocks all subsequent phases.

- [x] T001 [P] Extend all types in `src/engine/types.ts`: add `'blight' | 'pest_infestation' | 'flash_drought'` to `WeatherId`; add `pestDamaged: boolean` and `droughtPenalised: boolean` to `PlotState`; add `flashDroughtDaysRemaining: number` to `GameState`; add `pestDestroyedPlots: number[]` and `flashDroughtDaysAfter: number` to `DailyLogEntry`; add `'plot_pest_damaged'` to `PlantResult` error union; add new `ClearPestDamageResult` type
- [x] T002 [P] Update `src/engine/constants.ts`: add `blight` (multiplier 0.1), `pest_infestation` (multiplier 1.0), `flash_drought` (multiplier 1.0) to `WEATHER_DEFINITIONS`; replace `WEATHER_IDS` array with `WEATHER_PROBABILITY_BANDS` constant (8-entry array mapping threshold→WeatherId per research.md); bump `SCHEMA_VERSION` to `3`
- [x] T003 Update `initialGameState()` in `src/engine/gameEngine.ts`: set `pestDamaged: false` and `droughtPenalised: false` on each `PlotState`; set `flashDroughtDaysRemaining: 0` on `GameState` (depends on T001)
- [x] T004 Replace weather selection in `processTurn` in `src/engine/gameEngine.ts`: replace `WEATHER_IDS[Math.floor(Math.random() * WEATHER_IDS.length)]` with a continuous `Math.random()` roll mapped to `WeatherId` via `WEATHER_PROBABILITY_BANDS` (iterate bands, return first `id` where `roll < threshold`) (depends on T002)
- [x] T005 Update `'uniform random weather selection'` describe block in `tests/engine/gameEngine.test.ts`: update `vi.spyOn(Math, 'random').mockReturnValue(...)` values to match continuous probability bands (e.g. `0.0` → `'blight'`, `0.07` → `'pest_infestation'`, `0.12` → `'flash_drought'`, `0.20` → `'drought'`, `0.80` → `'warm_breeze'`) (depends on T004)

**Checkpoint**: `npm test` passes; all existing tests green; new weather types compile; game starts with new fields initialised to defaults.

---

## Phase 2: User Story 1 — Surviving a Blight (Priority: P1) 🎯 MVP

**Goal**: Blight event applies a 0.1× yield multiplier to all harvests; daily log labels and styles it as a disaster.

**Independent Test**: Inject `'blight'` as `weatherRoll`; plant and harvest a radish; verify income equals `floor(12 × 0.1) = 1` coin and `log.weatherId === 'blight'`.

> **Red-Green-Refactor**: Write T006 first, confirm tests compile and pass (Blight works automatically once T001-T004 are complete — the existing harvest loop already applies `WeatherDefinition.multiplier` generically).

- [x] T006 [US1] Write Blight engine tests in `tests/engine/gameEngine.test.ts`: `describe('processTurn — Blight disaster (US1)')` covering: radish yield `floor(12 × 0.1) = 1`; pumpkin yield `floor(65 × 0.1) = 6`; zero-harvest Blight day records `log.weatherId='blight'` and `log.weatherMultiplier=0.1`; `log.pestDestroyedPlots === []` and `log.flashDroughtDaysAfter === 0` on Blight turn
- [x] T007 [P] [US1] Update `src/components/DailyLog.tsx`: render disaster weather badge with red/amber styling (`bg-farm-red/20 border border-farm-red/40`) when `log.weatherId` is `'blight'`, `'pest_infestation'`, or `'flash_drought'`; keep existing parchment/20 style for all other weather IDs

**Checkpoint**: `npm test` — all Blight tests pass; DailyLog visually distinguishes disaster days from normal weather.

---

## Phase 3: User Story 2 — Losing Crops to Pest Infestation (Priority: P2)

**Goal**: Pest Infestation destroys random (or injected) occupied plots before harvest; destroyed plots enter `pestDamaged` state; daily log records which plots were hit.

**Independent Test**: Inject `'pest_infestation'` with `pestDestructionOverride=[0, 2]`; plant 3 radishes; verify plots 0 and 2 have `pestDamaged=true` and `cropId=null`; plot 1 is untouched; `log.pestDestroyedPlots === [0, 2]`.

> **Red-Green-Refactor**: Write T008 first; tests will fail (step 2a not yet implemented); implement T009-T010 to make them pass.

- [x] T008 [US2] Write Pest Infestation engine tests in `tests/engine/gameEngine.test.ts`: `describe('processTurn — Pest Infestation (US2)')` covering: deterministic destruction via override (`pestDestructionOverride`); `log.pestDestroyedPlots` matches override list; destroyed plots have `pestDamaged=true`, `cropId=null`, `daysRemaining=null`; untouched plots unaffected; crop maturing this turn included in destruction (destroyed with no yield); no-crash when no crops (`pestDestroyedPlots === []`); `plantSeed` returns `{ ok: false, error: 'plot_pest_damaged' }` on a `pestDamaged` plot; **combo — Pest Infestation during active Flash Drought window**: inject Flash Drought on day N, then Pest Infestation on day N+1 — verify `log.pestDestroyedPlots` is populated AND `log.flashDroughtDaysAfter === 1` (counter decremented from 2) on the same log entry; a drought-penalised crop that is pest-destroyed has `droughtPenalised=false` on the resulting plot state
- [x] T009 [US2] Implement `processTurn` step 2a in `src/engine/gameEngine.ts`: after weather resolution, when `weatherId === 'pest_infestation'`, iterate occupied plots; destroy each plot in `pestDestructionOverride` (if provided) or roll `Math.random() < 0.5` per plot; for destroyed plots set `cropId=null`, `daysRemaining=null`, `dayPlanted=null`, `droughtPenalised=false`, `pestDamaged=true`; collect destroyed IDs into local array; add `pestDestroyedPlots` field to DailyLogEntry build in step 10 (empty array `[]` for non-pest turns) AND also ensure `pestDestroyedPlots: []` and `flashDroughtDaysAfter: 0` (or current counter) are present in the bankruptcy log path (processTurn step 5) (makes T008 tests pass)
- [x] T010 [US2] Add `plot_pest_damaged` guard to `plantSeed` in `src/engine/gameEngine.ts`: after `plot_exhausted` check, before `no_seed` check — if `plot.pestDamaged === true`, return `{ ok: false, error: 'plot_pest_damaged' }` (depends on T009)
- [x] T011 [P] [US2] Update `src/components/DailyLog.tsx`: add pest destroyed plots section — when `log.pestDestroyedPlots.length > 0`, render one row per ID with 🐛 emoji and "Plot #N destroyed by pests."

**Checkpoint**: `npm test` — all Pest Infestation engine tests pass; planting blocked on `pestDamaged` plots; DailyLog shows destroyed plots.

---

## Phase 4: User Story 3 — Acknowledging Pest-Destroyed Plots (Priority: P2)

**Goal**: Pest-damaged plots show a "Pest Damage" indicator; player must click → "Clear Plot" to restore them to a plantable empty state; persistence survives save/reload.

**Independent Test**: Inject pest infestation destroying plot 0; verify `pestDamaged=true`; call `clearPestDamage(state, 0)`; verify `pestDamaged=false`; verify planting now succeeds.

> **Red-Green-Refactor**: Write T012 first; `clearPestDamage` function doesn't exist yet so tests will fail to compile initially — implement T013 to resolve.

- [x] T012 [US3] Write `clearPestDamage` tests in `tests/engine/gameEngine.test.ts`: `describe('clearPestDamage (US3)')` covering: success clears `pestDamaged=false` and makes plot plantable; `plot_not_pest_damaged` error on healthy plot; `invalid_plot` error on out-of-range ID; `invalid_plot` takes priority over `plot_not_pest_damaged`; day advance (`processTurn`) does NOT clear `pestDamaged` — indicator persists until player acknowledges; JSON round-trip preserves `pestDamaged=true`
- [x] T013 [US3] Implement `clearPestDamage(state: GameState, plotId: number): ClearPestDamageResult` in `src/engine/gameEngine.ts`: validate plotId; check `plot.pestDamaged === true`; return `{ ok: true, state: { ...state, plots: state.plots.map(...) } }` with `pestDamaged: false` on target plot (makes T012 tests pass, depends on T009)
- [x] T014 [P] [US3] Add `clearPestDamage` action to `src/engine/useGameEngine.ts`: import `clearPestDamage as engineClearPestDamage`; add `clearPestDamage: (plotId: number) => boolean` to `GameEngineHook` interface; implement callback (same pattern as `applyFertilizer`) (depends on T013)
- [x] T015 [P] [US3] Add `PestDamagedPlot` sub-component to `src/components/PlotCard.tsx`: 🐛 emoji, "Pest Damage" label, "Clear Plot" button; add `onClearPestDamage?: (plotId: number) => void` prop; render `PestDamagedPlot` as highest-priority branch when `plot.pestDamaged === true` (before exhausted check)
- [x] T016 [US3] Thread `onClearPestDamage` prop through `src/components/FarmGrid.tsx` to each `PlotCard` (depends on T015)
- [x] T017 [US3] Add `onClearPestDamage` prop to `src/components/GameBoard.tsx`; pass it to `FarmGrid` (depends on T016)
- [x] T018 [US3] Wire `clearPestDamage` from `useGameEngine` into `src/App.tsx`: pass as `onClearPestDamage` prop to `GameBoard` (depends on T014, T017)

**Checkpoint**: `npm test` — all `clearPestDamage` tests pass; pest-damaged plots display 🐛 indicator in browser; "Clear Plot" button restores plot; save/reload preserves `pestDamaged` state.

---

## Phase 5: User Story 4 — Weathering a Flash Drought (Priority: P3)

**Goal**: Flash Drought sets a 2-day counter; crops planted within the window have doubled growth time and show a per-plot drought indicator; farm-level banner shows remaining days; counter stacks on repeated events.

**Independent Test**: Inject `'flash_drought'`; verify `flashDroughtDaysRemaining=2`; plant radish on next turn; verify `daysRemaining=2` and `droughtPenalised=true`; advance two turns; plant again; verify `daysRemaining=1` (normal) and `droughtPenalised=false`.

> **Red-Green-Refactor**: Write T019 first; tests will fail; implement T020-T023 to make them pass.

- [ ] T019 [US4] Write Flash Drought engine tests in `tests/engine/gameEngine.test.ts`: `describe('processTurn — Flash Drought (US4)')` covering: `flashDroughtDaysRemaining=2` after event; planting on day N+1 doubles `daysRemaining` and sets `droughtPenalised=true`; planting on day N+2 (counter=1) still doubles; planting on day N+3 (counter=0) is normal; second Flash Drought stacks (`+=2`); `log.flashDroughtDaysAfter` equals post-decrement counter; flash drought does not affect current-day harvest yield; radish growth: `ceil(1*2)=2`; pumpkin: `ceil(3*2)=6`; `droughtPenalised` reset to `false` after harvest; JSON round-trip preserves `flashDroughtDaysRemaining` and `droughtPenalised`; **combo — Blight during active Flash Drought window**: inject Flash Drought on day N, then Blight on day N+1 — verify counter decrements to 1 (`log.flashDroughtDaysAfter === 1`), `log.weatherMultiplier === 0.1`, and crops planted on day N+1 still receive the drought penalty (counter was > 0 at planting time); **combo — normal weather during window**: inject Flash Drought on day N, then any non-disaster weather on day N+1 — verify counter decrements correctly and `log.flashDroughtDaysAfter` reflects the post-decrement value
- [ ] T020 [US4] Implement `processTurn` step 2b in `src/engine/gameEngine.ts`: when `weatherId === 'flash_drought'`, add `flashDroughtDaysRemaining += 2` to state accumulation (stacks if already > 0) (makes counter-increment tests pass)
- [ ] T021 [US4] Implement `processTurn` step 8.6 in `src/engine/gameEngine.ts`: after day increment (step 8), if `weatherId !== 'flash_drought'` and `flashDroughtDaysRemaining > 0`, decrement `flashDroughtDaysRemaining` by 1 (skip on the Flash Drought turn itself so both N+1 and N+2 planting days remain penalised); add `flashDroughtDaysAfter: nextFlashDroughtDaysRemaining` to `DailyLogEntry` build in step 10 (depends on T020)
- [ ] T022 [US4] Update `plantSeed` in `src/engine/gameEngine.ts`: when `state.flashDroughtDaysRemaining > 0`, set `daysRemaining: Math.ceil(crop.growthDays * 2)` and `droughtPenalised: true` on the planted plot; otherwise keep `daysRemaining: crop.growthDays` and `droughtPenalised: false` (depends on T021)
- [ ] T023 [US4] Update harvest logic in `processTurn` step 3 in `src/engine/gameEngine.ts`: when clearing a harvested plot, include `droughtPenalised: false` in the cleared plot state (alongside existing `cropId: null`, `dayPlanted: null`, `daysRemaining: null`) (depends on T022)
- [ ] T024 [P] [US4] Update `src/components/PlotCard.tsx`: in the growing-crop render branch, add a small drought indicator (e.g. `☀️🔥` icon with `title="Growth slowed by Flash Drought"`) when `plot.droughtPenalised === true` (depends on T015)
- [ ] T025 [P] [US4] Add Flash Drought banner to `src/components/GameBoard.tsx`: render `"☀️🔥 Flash Drought — crops planted today grow at half speed. N day(s) remaining."` above `FarmGrid` when `state.flashDroughtDaysRemaining > 0` (depends on T017)
- [ ] T026 [P] [US4] Update `src/components/DailyLog.tsx`: add Flash Drought announcement section — when `log.weatherId === 'flash_drought'`, render `"☀️🔥 Flash Drought! Crops planted in the next 2 days grow at half speed."` (depends on T011)

**Checkpoint**: `npm test` — all Flash Drought tests pass; drought banner visible in browser during active window; penalised crops show icon; counter stacks correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, persistence stress test, lint gate.

- [ ] T027 Write save/load persistence tests in `tests/engine/gameEngine.test.ts`: JSON round-trip preserves `flashDroughtDaysRemaining`, `pestDamaged`, and `droughtPenalised` across all plots; schema version is `3`; loading a schema-v2 save discards and returns `initialGameState()` (add to existing `edge cases` describe or new `schema v3 persistence` describe); **UI smoke tests** — add to `tests/components/GameBoard.test.tsx` (or equivalent): (a) when `state.flashDroughtDaysRemaining > 0`, the Flash Drought banner is rendered (FR-010); (b) when a plot has `droughtPenalised: true`, the PlotCard renders the drought icon (FR-018) — these cover the two UI-only requirements that have no other test task
- [ ] T028 Run `npm test && npm run lint` from repo root; fix any TypeScript errors (missing fields in DailyLogEntry initialisations, exhaustive type checks on new WeatherIds in components), ESLint warnings, or test failures before marking complete

**Checkpoint**: All tests green; no lint errors; game is fully playable with all three disaster events; save/load works correctly on schema v3.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Foundational T001-T005)
    ↓ BLOCKS everything
Phase 2 (US1 T006-T007)      ← can start after Phase 1 complete
Phase 3 (US2 T008-T011)      ← can start after Phase 1 complete
Phase 4 (US3 T012-T018)      ← can start after Phase 3 complete (T010 required)
Phase 5 (US4 T019-T026)      ← can start after Phase 1 complete; T024 depends on T015
Phase 6 (Polish T027-T028)   ← after all story phases complete
```

### User Story Dependencies

- **US1 (P1 — Blight)**: After Phase 1 only; no dependency on US2/US3/US4
- **US2 (P2 — Pest Infestation)**: After Phase 1 only; no dependency on US1/US3/US4
- **US3 (P2 — Pest Acknowledgment)**: After US2 complete (needs `pestDamaged` set by T009-T010)
- **US4 (P3 — Flash Drought)**: After Phase 1 only; T024 depends on T015 (same file PlotCard.tsx)

### Within Each Phase

- Tests written **first** (Red step) before corresponding implementation
- `initialGameState()` (T003) before any engine logic
- Weather selection (T004) before any disaster event logic
- Engine changes before UI changes within each story

### Parallel Opportunities

- **T001 || T002**: different files (`types.ts` vs `constants.ts`)
- **T006 || T007**: different files (`gameEngine.test.ts` vs `DailyLog.tsx`) — after Phase 1
- **T008–T011** (US2) can run concurrently with **T006–T007** (US1) — different stories, different concerns
- **T014 || T015**: different files (`useGameEngine.ts` vs `PlotCard.tsx`)
- **T024 || T025 || T026**: different component files, all can run in parallel once their predecessors complete

---

## Parallel Example: Phase 1

```
# T001 and T002 are fully independent — run in parallel:
Task A: Extend all types in src/engine/types.ts
Task B: Update constants in src/engine/constants.ts
```

## Parallel Example: US3 + US4 (after Phase 3)

```
# T014 (useGameEngine hook) and T015 (PlotCard) are independent files:
Task A: Add clearPestDamage to useGameEngine.ts (T014)
Task B: Add PestDamagedPlot to PlotCard.tsx (T015)

# While US3 UI wiring (T016-T018) is in progress, US4 tests can be written:
Task C: Write Flash Drought engine tests (T019)
```

---

## Implementation Strategy

### MVP First (US1 only — Blight)

1. Complete Phase 1 (T001–T005)
2. Complete Phase 2 (T006–T007)
3. **STOP AND VALIDATE**: `npm test`; load game; advance a few turns; confirm Blight day shows 🔴 badge and yields ~10% income

### Incremental Delivery

1. Phase 1 → Foundation ready
2. Phase 2 → US1 (Blight) → Test → Demo
3. Phase 3 → US2 (Pest engine) → Test → Demo
4. Phase 4 → US3 (Pest acknowledgment UI) → Test → Demo
5. Phase 5 → US4 (Flash Drought) → Test → Demo
6. Phase 6 → Polish → Ship

---

## Notes

- `[P]` tasks touch different files and have no unresolved dependencies — safe to parallelise
- `[Story]` label maps each task to its user story for traceability
- The spec's `pestDestroyedPlots` and `flashDroughtDaysAfter` fields on `DailyLogEntry` must be present in **every** `DailyLogEntry` build (including the bankruptcy path in `processTurn` step 5) — check both log-build sites
- `WEATHER_IDS` is referenced in the existing test `'uses Math.random to select weather'` — T005 must update those tests before they will compile cleanly with the new band-based selection
- Avoid modifying `WEATHER_IDS` export until T005 test updates are written; remove it in the same commit as T002 to keep the codebase consistent
