---
description: "Task list for Pixel Parsnips — Farming Tycoon Game"
---

# Tasks: Pixel Parsnips — Farming Tycoon Game

**Input**: Design documents from `/specs/001-farming-tycoon-game/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Constitution Principle II mandates TDD. Test tasks are included and MUST
precede the implementation tasks they cover within each user story phase.

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

All paths relative to repo root. Single SPA project: `src/`, `tests/`.

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Bootstrap toolchain; no game logic yet.

- [ ] T001 Bootstrap Vite + React + TypeScript project at repo root (`npm create vite@latest . -- --template react-ts && npm install`)
- [ ] T002 [P] Install and configure Tailwind CSS 3 with `farm` color palette and `pixel` font in `tailwind.config.ts` and `src/index.css`
- [ ] T003 [P] Install and configure Vitest 1.x + React Testing Library + `vitest-axe` in `vite.config.ts` and `tests/setup.ts` (import `vitest-axe/extend-expect` in setup to enable `toHaveNoViolations`)
- [ ] T004 [P] Configure ESLint with `typescript-eslint` and Prettier; add `"complexity": ["error", 10]` to enforce cyclomatic complexity gate per constitution §I; enable `noUnusedLocals: true` and `strict: true` in `tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, constants, and initial state that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 [P] Define all TypeScript interfaces and union types in `src/engine/types.ts` (`GameState`, `PlotState`, `CropId`, `WeatherId`, `UpgradeTier`, `SeedInventory`, `HarvestEvent`, `DailyLogEntry`, `TurnResult`, `PlantResult`, `BuyResult`, `UpgradeResult`)
- [ ] T006 [P] Define all game constants and `coins()` helper in `src/engine/constants.ts` (`CROP_DEFINITIONS`, `WEATHER_DEFINITIONS`, `UPGRADE_TIER_DEFINITIONS`, `LAND_LEASE_FEE`, `TAX_RATE`, `PLOT_COUNT`, `STARTING_BALANCE`, `MAX_UPGRADE_TIER`, `SCHEMA_VERSION`)
- [ ] T007 Implement `initialGameState()` factory function in `src/engine/gameEngine.ts` (depends on T005, T006)
- [ ] T008 [P] Create `src/App.tsx` root component skeleton that renders a placeholder `<div>` (wired up in US1)
- [ ] T009 [P] Create `src/main.tsx` Vite entry point mounting `<App />` into `#root`

**Checkpoint**: `npm run dev` starts; blank page loads without errors; `npx tsc --noEmit` passes.

---

## Phase 3: User Story 1 — Plant, Grow & Harvest Crops (Priority: P1) 🎯 MVP

**Goal**: Player can buy a seed, plant it, advance one day, and see coins increase from harvest.

**Independent Test**: Buy one Radish seed from the shop, plant it in an empty plot, click
"Next Day" once, verify the plot empties and coin balance increases by 12 coins (1.0× multiplier placeholder).

### Tests for User Story 1 (TDD — write BEFORE implementation) ⚠️

> **NOTE: Write these tests first; confirm they FAIL before implementing**

- [ ] T010 [P] [US1] Write failing tests for `plantSeed()` (empty plot success, occupied plot error, no-seed error, invalid-plot error) in `tests/engine/gameEngine.test.ts`
- [ ] T011 [P] [US1] Write failing tests for `processTurn()` crop-growth and harvest steps (1× multiplier placeholder, no drains yet) in `tests/engine/gameEngine.test.ts`

### Implementation for User Story 1

- [ ] T012 [US1] Implement `plantSeed()` pure function in `src/engine/gameEngine.ts` (depends on T010; make T010 tests pass)
- [ ] T013 [US1] Implement `processTurn(state: GameState, weatherRoll: WeatherId = 'sunny'): TurnResult` — crop advancement and harvest steps only (default 'sunny' = 1.0× enables deterministic US1/US2/US3 tests; lease/tax/bankruptcy stubs return unchanged balance) in `src/engine/gameEngine.ts` (depends on T011, T012)
- [ ] T014 [US1] Implement `useGameEngine` hook skeleton with `state`, `nextDay()`, and `plantSeed()` in `src/engine/useGameEngine.ts` (depends on T013)
- [ ] T015 [P] [US1] Create `PlotCard` component displaying crop type, emoji/icon, "Planted Day N" label, and days-remaining badge per FR-006 (empty state shows empty-plot placeholder) in `src/components/PlotCard.tsx`
- [ ] T016 [US1] Create `FarmGrid` component rendering 12 `PlotCard` instances in a responsive grid in `src/components/FarmGrid.tsx` (depends on T015)
- [ ] T017 [P] [US1] Create `HUD` component displaying Current Day, Coin Balance, Land Lease fee (15 coins/day), and Tax rate (5%) using `farm-gold` and `farm-sky` palette tokens per FR-017 in `src/components/HUD.tsx`
- [ ] T018 [US1] Create `GameBoard` layout component composing `HUD`, `FarmGrid`, and "Next Day" button (button disabled during processing per FR-001) in `src/components/GameBoard.tsx` (depends on T016, T017)
- [ ] T019 [US1] Update `App.tsx` to instantiate `useGameEngine` and render `<GameBoard>`, passing state and actions as props

**Checkpoint**: Plant a Radish, click "Next Day", verify balance increases by 12 coins and plot empties. "Next Day" button dims during the turn.

---

## Phase 4: User Story 2 — Economic Drains & Bankruptcy (Priority: P2)

**Goal**: Land Lease and Tax are deducted each turn; game triggers Bankruptcy screen when balance < lease fee.

**Independent Test**: Set game state to 10 coins (below 15-coin lease fee), click "Next Day",
confirm Bankruptcy screen shows days survived and peak balance with a working Restart button.

### Tests for User Story 2 (TDD — write BEFORE implementation) ⚠️

- [ ] T020 [P] [US2] Write failing tests for `processTurn()` lease deduction, tax deduction, exact-balance edge case, and bankruptcy trigger — pass `weatherRoll='sunny'` in all calls to isolate drain logic from weather variance in `tests/engine/gameEngine.test.ts`

### Implementation for User Story 2

- [ ] T021 [US2] Extend `processTurn()` to add steps 4–6 of FR-002 sequence: lease deduction, tax deduction, bankruptcy check in `src/engine/gameEngine.ts` (depends on T020; make T020 tests pass)
- [ ] T022 [P] [US2] Write failing smoke test for `BankruptcyScreen` rendering (days survived, peak balance, Restart button present) in `tests/components/GameBoard.test.tsx`
- [ ] T023 [US2] Create `BankruptcyScreen` component displaying days survived, peak balance, and Restart button in `src/components/BankruptcyScreen.tsx` (depends on T022)
- [ ] T024 [US2] Add `restart()` action to `useGameEngine` hook; resets state to `initialGameState()` in `src/engine/useGameEngine.ts`
- [ ] T025 [US2] Update `App.tsx` to render `<BankruptcyScreen>` when `state.phase === 'bankrupt'`, passing `daysPlayed`, `peakBalance`, and `restart` props

**Checkpoint**: Run below 15-coin threshold → Bankruptcy screen appears → click Restart → Day 1 fresh start confirmed.

---

## Phase 5: User Story 3 — Shop: Buy Seeds & Upgrade Tools (Priority: P3)

**Goal**: Player can purchase seeds and permanent tool upgrades from the persistent shop side-panel.

**Independent Test**: Open shop (always visible), buy one Pumpkin seed with 100 coins, verify
seed appears in inventory, balance decreases by 20 coins, and plot can accept the seed for planting.

### Tests for User Story 3 (TDD — write BEFORE implementation) ⚠️

- [ ] T026 [P] [US3] Write failing tests for `computeSeedCost()` (tier 0 = full price, tier 1 = −20%, tier 2 = −40%, tier 3 = −60%) in `tests/engine/gameEngine.test.ts`
- [ ] T027 [P] [US3] Write failing tests for `buySeed()` (success, insufficient funds, balance decremented, inventory incremented) in `tests/engine/gameEngine.test.ts`
- [ ] T028 [P] [US3] Write failing tests for `buyUpgrade()` (success, insufficient funds, max tier blocked) in `tests/engine/gameEngine.test.ts`

### Implementation for User Story 3

- [ ] T029 [US3] Implement `computeSeedCost()`, `buySeed()`, and `buyUpgrade()` pure functions in `src/engine/gameEngine.ts` (depends on T026–T028; make all three test suites pass)
- [ ] T030 [US3] Add `buySeed()`, `buyUpgrade()`, `getSeedPrice()`, and `getNextUpgradeCost()` to `useGameEngine` hook in `src/engine/useGameEngine.ts` (depends on T029)
- [ ] T031 [P] [US3] Create `SeedCard` component displaying seed name, growth duration, base yield, current price, seed-count badge, and Buy button (disabled + message when insufficient funds per FR-014) in `src/components/SeedCard.tsx`
- [ ] T032 [P] [US3] Create `UpgradeCard` component displaying tier label, cost, cumulative discount, and Buy/Maxed button in `src/components/UpgradeCard.tsx`
- [ ] T033 [US3] Create `Shop` persistent side-panel component composing three `SeedCard` instances and all three `UpgradeCard` tiers (purchased tiers styled as "Owned" and non-interactive; next purchasable tier shows cost; future tiers dimmed) in `src/components/Shop.tsx` (depends on T031, T032)
- [ ] T034 [US3] Update `GameBoard` to include `<Shop>` as a persistent side-panel alongside `<FarmGrid>` per FR-010

**Checkpoint**: Buy Radish seed → see it in inventory badge → plant → advance day → coins increase. Buy Tier 1 upgrade → verify all seed prices drop 20%.

---

## Phase 6: User Story 4 — Weather System & Daily Log (Priority: P4)

**Goal**: Each turn generates a random weather event (uniform 20%) that multiplies harvest yields; a daily log panel summarises the completed day.

**Independent Test**: Inject `'perfect_sun'` weather into `processTurn()`, harvest one Radish (base 12), verify adjusted yield is 18 coins. Check daily log panel shows weather name, ×1.5, line-item harvest, lease, tax, and net change.

### Tests for User Story 4 (TDD — write BEFORE implementation) ⚠️

- [ ] T035 [P] [US4] Write failing tests for `processTurn()` uniform weather selection (all 5 events reachable via `weatherRoll` injection) and yield multiplier application in `tests/engine/gameEngine.test.ts`
- [ ] T036 [P] [US4] Write failing tests for `DailyLogEntry` construction: correct `totalHarvestIncome`, `taxDeducted`, `netChange`, and `closingBalance` values in `tests/engine/gameEngine.test.ts`

### Implementation for User Story 4

- [ ] T037 [US4] Extend `processTurn()` to add step 2 of FR-002: uniform random weather selection (or injected `weatherRoll`) in `src/engine/gameEngine.ts` (depends on T035)
- [ ] T038 [US4] Extend `processTurn()` to apply weather multiplier during harvest step and build complete `DailyLogEntry` including all accounting fields in `src/engine/gameEngine.ts` (depends on T036, T037)
- [ ] T039 [US4] Expose `lastDailyLog` from `useGameEngine` hook in `src/engine/useGameEngine.ts`
- [ ] T040 [P] [US4] Create `DailyLog` component with `aria-label="Daily summary"` section displaying weather badge, harvest line-items, lease row, tax row, and net-change row in `src/components/DailyLog.tsx`
- [ ] T041 [US4] Update `GameBoard` to include `<DailyLog>` panel (renders null when `lastDailyLog` is null on Day 1) in `src/components/GameBoard.tsx`

**Checkpoint**: Inject `'drought'` weather via test, harvest one Pumpkin (65 × 0.5 = 32 coins floor), daily log shows "Drought ×0.5", adjusted yield 32, correct lease and tax rows.

---

## Phase 7: Session Persistence (Cross-Cutting)

**Purpose**: localStorage save/load covering FR-023 and FR-024.

### Tests for Persistence (TDD — write BEFORE implementation) ⚠️

- [ ] T042 [P] Write failing tests for `useGameEngine` localStorage save (state written after `nextDay`, `plantSeed`, `buySeed`, `buyUpgrade`, `restart`) and load on mount (valid save restored; schema-mismatch starts fresh) in `tests/engine/useGameEngine.test.ts`

### Implementation

- [ ] T043 Implement localStorage persistence in `useGameEngine.ts`: save to `pixel-parsnips-state` key after every action; restore on mount with `SCHEMA_VERSION` guard; log console notice on schema mismatch (depends on T042; make T042 tests pass)

**Checkpoint**: Plant a crop and refresh the browser; verify the crop is still visible and balance unchanged.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: HUD completeness, accessibility, coverage gate, build verification.

- [ ] T044 [P] Write 100-turn automated stress test: loop `processTurn` 100 times from `initialGameState`, assert no exceptions thrown, coin values are integers (no floating point), and displayed balance matches daily log closing balance on every turn (SC-002, SC-003) in `tests/engine/gameEngine.test.ts`
- [ ] T045 [P] Add `aria-label` attributes to all interactive elements: "Next Day" button, all Buy buttons, PlotCard click targets, Restart button for WCAG 2.1 AA in relevant component files
- [ ] T046 [P] Write hook integration tests covering full turn sequence (plant → nextDay → harvest income → lease → tax → updated balance) in `tests/engine/useGameEngine.test.ts`
- [ ] T047 [P] Write smoke tests verifying `GameBoard` renders HUD, FarmGrid, Shop panel, and DailyLog without crashing, and assert `expect(container).toHaveNoViolations()` (via `vitest-axe`) to enforce WCAG 2.1 AA gate per constitution §III in `tests/components/GameBoard.test.tsx`
- [ ] T048 Run Vitest coverage (`npm run test -- --coverage`); fix gaps until `src/engine/` ≥ 95% line coverage and overall ≥ 80%
- [ ] T049 Run ESLint (`npx eslint src tests`) and fix all reported errors
- [ ] T050 Run TypeScript check (`npx tsc --noEmit`) and resolve any type errors
- [ ] T051 Run production build (`npm run build`); verify `dist/` is generated without errors and bundle is < 200 KB
- [ ] T052 Create `.github/workflows/ci.yml` running Vitest + ESLint + TypeScript check + Lighthouse CI on every PR; record initial performance baseline (TTI target < 2 s; > 10% regression blocks merge per constitution §IV)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no other story dependencies
- **US2 (Phase 4)**: Depends on Phase 3 (extends `processTurn`)
- **US3 (Phase 5)**: Depends on Phase 2 — parallel with US2
- **US4 (Phase 6)**: Depends on Phase 3 (extends `processTurn`) — parallel with US2/US3
- **Persistence (Phase 7)**: Depends on Phase 3 (hook exists); runs after US1
- **Polish (Phase 8)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Foundational complete → implements `plantSeed` + partial `processTurn`
- **US2 (P2)**: US1 complete → extends `processTurn` with drains + bankruptcy
- **US3 (P3)**: Foundational complete → entirely new functions; can run parallel to US2
- **US4 (P4)**: US1 complete → extends `processTurn` with weather; can run parallel to US2/US3

### Within Each User Story

1. Tests MUST be written and confirmed FAILING before implementation starts
2. Pure engine functions before hook integration
3. Hook before components
4. Leaf components (PlotCard, SeedCard) before parent components (FarmGrid, Shop)
5. Components before App.tsx wiring

### Parallel Opportunities

```bash
# Phase 1 — all 4 tasks are independent:
T001 (bootstrap) → then T002, T003, T004 in parallel

# Phase 2 — T005 and T006 in parallel (no dependency between types and constants):
T005 [P] types.ts
T006 [P] constants.ts
→ then T007, T008 [P], T009 [P]

# Phase 3 — tests in parallel, then implementations:
T010 [P] plantSeed tests
T011 [P] processTurn harvest tests
→ T012 (depends on T010) then T013 (depends on T011, T012)
→ T015 [P] and T017 [P] in parallel; then T016 (depends on T015)
→ T018 (depends on T016, T017) → T019

# Phase 5 — all three test tasks in parallel:
T026 [P] computeSeedCost tests
T027 [P] buySeed tests
T028 [P] buyUpgrade tests
→ T029 (depends on T026–T028)
→ T031 [P], T032 [P] components in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (plant, grow, harvest)
4. **STOP AND VALIDATE**: Plant a Radish, advance day, confirm harvest income
5. Demo: minimal loop works end-to-end

### Incremental Delivery

1. Setup + Foundational → scaffold ready
2. US1 → harvest loop works (MVP ✅)
3. US2 → economic pressure + bankruptcy works
4. US3 (parallel-capable with US2) → full shop works
5. US4 (parallel-capable) → weather variance + daily log works
6. Persistence → game survives browser refresh
7. Polish → coverage gate, a11y, build verification

### Parallel Team Strategy

With two developers after Foundational is complete:

- **Dev A**: US1 → US2 (core loop → drains)
- **Dev B**: US3 (shop, parallel to US2)
- Both converge on US4 → Persistence → Polish

---

## Notes

- `[P]` tasks write to different files — run in parallel safely
- `[Story]` label maps each task to its user story for traceability
- TDD: confirm tests **FAIL** before implementing; commit failing tests separately
- Use `processTurn(state, 'sunny')` in US1/US2/US3 tests to hold multiplier at 1.0× until US4 adds real weather
- Commit after each checkpoint; each checkpoint should be a deployable game increment
- Run `npx tsc --noEmit && npx eslint src tests` before every commit
