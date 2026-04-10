# Tasks: UI Polish & Accessibility

**Input**: Design documents from `/specs/005-ui-polish/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅

**Tests**: No test tasks generated — feature spec does not request new tests. Existing test suite must remain green throughout.

**Organization**: Tasks grouped by user story (US1–US9) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on each other)
- **[Story]**: Which user story this task belongs to (US1–US9)

---

## Phase 1: Setup

**Purpose**: Establish a green baseline before any changes

- [x] T001 Run existing test suite to confirm green baseline: `npm test && npm run lint`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New constants that US3 (low-balance warning) depends on

**⚠️ CRITICAL**: US3 cannot begin until T002 is complete

- [x] T002 Add `LOW_BALANCE_WARNING_THRESHOLD = 45` and `LOW_BALANCE_CRITICAL_THRESHOLD = 15` to `src/engine/constants.ts` (co-locate with `LAND_LEASE_FEE`)

**Checkpoint**: Constants ready — US1, US2 can already begin in parallel; US3 now also unblocked

---

## Phase 3: User Story 1 — Critical Readability & Mobile Visibility (Priority: P1) 🎯 MVP

**Goal**: All critical HUD text is legible on any device; lease cost and tax always visible on mobile without interaction; Shop button has higher visual prominence.

**Independent Test**: Open game on a mobile viewport. Without resizing or tapping, confirm coin balance, lease cost ("−15🪙/day"), and tax rate ("5% tax") are all visible and readable. Empty game on a fresh load.

### Implementation for User Story 1

- [x] T003 [US1] Raise font sizes in `src/components/HUD.tsx`: coin balance `text-sm` → `text-[18px]`, day counter → `text-[18px]`, lease/tax labels `text-[9px]` → `text-[14px]`, button text `text-[10px]`/`text-[9px]` → `text-[14px]`
- [x] T004 [US1] Remove `hidden sm:flex` wrapper from lease/tax display in `src/components/HUD.tsx`; render as compact always-visible sub-label beneath coin balance chip (e.g., `−15🪙/day · 5% tax`) on all viewports
- [x] T005 [US1] Increase Shop button visual weight in `src/components/HUD.tsx`: larger padding, accent border, or seed-count badge so it reads as the primary action button on mobile

**Checkpoint**: US1 fully functional — mobile HUD readable and all financial info always visible

---

## Phase 4: User Story 2 — Empty Plot Touch Affordance (Priority: P1)

**Goal**: A first-time mobile player sees empty farm plots and immediately understands they are tappable.

**Independent Test**: View the farm grid on a touch device in idle state (no seed selected). Each empty plot shows a visible indicator (e.g., faint "+" or "🌱") without needing to hover or tap first.

### Implementation for User Story 2

- [x] T006 [P] [US2] Add a persistent low-opacity affordance indicator to empty plots in `src/components/PlotCard.tsx`: always visible at `opacity-30`, increases to `opacity-100` on `hover:`/`focus:`; indicator disappears only when plot has a growing crop or is in exhaustion recovery — pest-damaged plots retain the indicator since clearing them is a player action

**Checkpoint**: US2 fully functional — empty plots visibly invite interaction at rest on all devices

---

## Phase 5: User Story 3 — Low-Balance Danger Warning (Priority: P2)

**Goal**: Players approaching bankruptcy see a clear escalating visual warning on the coin balance chip.

**Independent Test**: Set coin balance to 40 coins (below warning threshold of 45) → amber warning appears. Set to 15 coins (critical threshold) → red pulsing danger state appears. Increase balance above 45 → warning disappears.

### Implementation for User Story 3

- [x] T007 [US3] Add two-tier warning state to coin balance chip in `src/components/HUD.tsx`: when `coinBalance ≤ LOW_BALANCE_WARNING_THRESHOLD` apply amber styling and a ⚠️ icon; when `coinBalance ≤ LOW_BALANCE_CRITICAL_THRESHOLD` escalate to `text-farm-red` with `animate-pulse`

**Checkpoint**: US3 fully functional — coin display provides early and critical danger signals before bankruptcy

---

## Phase 6: User Story 4 — First-Run Onboarding Hint (Priority: P2)

**Goal**: Day 1 players with no seeds planted see a contextual hint directing them to the shop before they drain their balance.

**Independent Test**: Start a fresh game (Day 1, empty inventory, no crops). Hint banner "🌱 Visit the Shop to buy seeds before advancing the day" is visible. Plant one seed → hint disappears.

### Implementation for User Story 4

- [ ] T008 [US4] In `src/components/GameBoard.tsx`, derive `showOnboardingHint` from `state.currentDay === 1 && state.plots.every(p => p.cropId === null && !p.exhaustedSinceDay) && Object.values(state.seedInventory).every(n => n === 0)`; render hint banner between HUD and FarmGrid when true

**Checkpoint**: US4 fully functional — Day 1 onboarding hint visible at start, auto-dismisses after first plant

---

## Phase 7: User Story 5 — Buy-to-Plant State Clarity (Priority: P2)

**Goal**: When a player selects a seed to plant, both the farm grid container and individual empty plots change appearance to clearly invite a tap.

**Independent Test**: Buy a seed (selectedCrop becomes non-null). Farm grid container shows a ring/border glow AND each empty plot shows an invitation highlight simultaneously. Tap a plot or cancel → both visual cues disappear.

### Implementation for User Story 5

- [ ] T009 [US5] Add `isPlantingMode: boolean` prop to `src/components/FarmGrid.tsx`; when true, apply a `ring-2 ring-farm-gold` (or similar) border/glow to the grid container element
- [ ] T010 [US5] In `src/components/GameBoard.tsx`, derive `isPlantingMode = selectedCrop !== null` and pass it as a prop to `FarmGrid`
- [ ] T011 [P] [US5] Add `isPlantingMode: boolean` prop to `src/components/PlotCard.tsx`; when true and the plot is empty, apply a bright invitation highlight (e.g., `ring-1 ring-farm-gold bg-farm-gold/10`) in addition to the existing affordance indicator from T006; FarmGrid will pass this prop through to each PlotCard once T009 and T010 are complete

**Checkpoint**: US5 fully functional — planting mode gives clear two-layer visual feedback (grid + plot level)

---

## Phase 8: User Story 6 — Disaster Event Drama (Priority: P3)

**Goal**: Day Summary after a disaster event has a visually distinct presentation that conveys the severity of the loss.

**Independent Test**: Trigger a blight, pest infestation, or flash drought. Open the Day Summary modal — a prominent disaster headline (e.g., "⚠️ Pest Infestation!") appears before the line items, and the modal background has a red tint. Compare with a sunny-day summary — the difference is immediately apparent.

### Implementation for User Story 6

- [ ] T012 [P] [US6] In `src/components/DailyLog.tsx`, derive `isDisaster` from `weatherId` being one of `['blight', 'pest_infestation', 'flash_drought']`; when true, render a prominent `font-pixel text-[14px] text-farm-red` headline (e.g., "⚠️ Pest Infestation!") above the line-item section
- [ ] T013 [P] [US6] In `src/components/DaySummaryModal.tsx`, derive `isDisaster` from `log.weatherId`; when true, apply `bg-farm-red/10` tinted overlay to the modal container background

**Checkpoint**: US6 fully functional — disaster day summaries are emotionally impactful and visually distinct from calm days

---

## Phase 9: User Story 7 — Bankruptcy Post-Mortem Insight (Priority: P3)

**Goal**: The bankruptcy screen displays one run-specific insight derived from how the player actually lost.

**Independent Test**: Trigger bankruptcy after: (a) pest attack on final turn — insight mentions pests; (b) many empty days — insight mentions empty days; (c) very short run (≤5 days) — insight mentions buying seeds early.

### Implementation for User Story 7

- [ ] T014 [US7] In `src/App.tsx`, thread `lastLog={state.lastDailyLog}` as a prop to `BankruptcyScreen` component
- [ ] T015 [US7] Update `BankruptcyScreen` props interface in `src/components/BankruptcyScreen.tsx` to accept `lastLog: DailyLogEntry | null`
- [ ] T016 [US7] In `src/components/BankruptcyScreen.tsx`, implement the priority insight rule set and render the result below existing stats:
  1. `lastLog?.pestDestroyedPlots.length > 0` → "Pests destroyed your final crops. Harvest early when pest risk is high."
  2. `lastLog?.weatherId === 'flash_drought'` → "A flash drought ended your run. Avoid planting during drought events."
  3. `daysPlayed <= 5` → "Your run was very short. Try buying seeds before advancing the day."
  4. `peakBalance < 50` → "Balance never recovered. Focus on fast Radishes early to build a buffer."
  5. Default → "Try diversifying between fast Radishes and higher-yield Pumpkins."

**Checkpoint**: US7 fully functional — bankruptcy screen provides run-specific, actionable insight to drive re-engagement

---

## Phase 10: User Story 8 — Accessibility: Reduced Motion (Priority: P3)

**Goal**: Players with OS reduced-motion enabled experience the game with no transform-based animations.

**Independent Test**: Enable "Reduce Motion" in OS accessibility settings and load the game. Shop panel must not slide in (appears/disappears instantly or via opacity). Coin danger pulse must not animate. All `active:scale-95` effects must be suppressed.

### Implementation for User Story 8

- [ ] T017 [P] [US8] Add `@media (prefers-reduced-motion: reduce)` block to `src/index.css` that sets `animation-duration: 0.01ms !important`, `animation-iteration-count: 1 !important`, and `transition-duration: 0.01ms !important` for all elements
- [ ] T018 [P] [US8] Add `motion-reduce:transition-none` to the shop bottom-sheet slide classes (`transition-transform duration-300`) in `src/components/GameBoard.tsx`
- [ ] T019 [P] [US8] Add `motion-reduce:animate-none` to any `animate-pulse` class added for the critical balance warning in `src/components/HUD.tsx`

**Checkpoint**: US8 fully functional — game is safe and accessible for users with vestibular sensitivities

---

## Phase 11: User Story 9 — Visual Polish & Consistency (Priority: P4)

**Goal**: The game is visually consistent at all screen sizes: no breakpoint gaps, readable upgrade text, save confirmation, prominent drought banner, and shop button prominence.

**Independent Test**: Check at 4 viewport widths (320px, 640px, 1024px, 1440px). Trigger actions for save confirmation. Activate Flash Drought. Review owned upgrade cards.

### Implementation for User Story 9

- [ ] T020 [P] [US9] Fix FarmGrid sm breakpoint in `src/components/FarmGrid.tsx`: change `grid-cols-4` to `grid-cols-4 sm:grid-cols-6` so 6-column layout activates at 640px
- [ ] T021 [P] [US9] Fix owned-tier upgrade card text contrast in `src/components/UpgradeCard.tsx`: change `text-farm-ink` to `text-farm-parchment` on owned-tier label and discount text (lines 25–26)
- [ ] T022 [US9] In `src/components/GameBoard.tsx`, add `lastSavedAt` state (number | null) and update it to `Date.now()` inside all action callbacks: `onNextDay`, `onPlantSeed`, `onBuySeed`, `onBuyUpgrade`
- [ ] T023 [US9] In `src/components/GameBoard.tsx`, add `showSaveConfirm` boolean state driven by a `useEffect` watching `lastSavedAt` (set true, clear after 2000ms); render "Saved ✓" chip in HUD area when true; omit fade transition when reduced-motion is active
- [ ] T024 [US9] Increase Flash Drought warning banner visual weight in `src/components/GameBoard.tsx`: change font from `text-xs` to `text-[14px]`, increase background from `bg-farm-red/10` to `bg-farm-red/20`, add a `⚠️` icon to the left of the text

**Checkpoint**: US9 fully functional — game looks polished and consistent at all breakpoints

---

## Phase 12: Final Polish

**Purpose**: Verify complete implementation, no regressions

- [ ] T025 Run full test suite and confirm all existing tests pass: `npm test`
- [ ] T026 [P] Run linter and resolve any issues: `npm run lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — T002 constants unblock US3
- **Phase 3 (US1)**: Can start after Phase 1 (independent of T002)
- **Phase 4 (US2)**: Can start after Phase 1 (independent, different file from US1)
- **Phase 5 (US3)**: Requires T002 (constants) from Phase 2
- **Phase 6 (US4)**: Can start after Phase 1 (different file from all above)
- **Phase 7 (US5)**: Can start after Phase 1; T011 depends on T009 and T010
- **Phase 8 (US6)**: Can start after Phase 1; T012 and T013 are parallel
- **Phase 9 (US7)**: T015 and T016 depend on T014
- **Phase 10 (US8)**: T017, T018, T019 are all parallel (different files)
- **Phase 11 (US9)**: T022 → T023 → T024 sequential (same file); T020, T021 parallel
- **Phase 12 (Polish)**: Depends on all desired stories complete

### User Story Dependencies (within stories)

- **US5**: T009 and T011 are parallel (independent files — FarmGrid and PlotCard each add their own prop interface); T010 depends on both (GameBoard wires the prop through once both component interfaces exist)
- **US7**: T014 → T015 → T016 (prop threading before implementation)
- **US9**: T022 → T023 (state before effect), T024 independent of T022/T023 but same file

### HUD.tsx Modification Order

Multiple stories modify `src/components/HUD.tsx`. Recommended order to avoid merge conflicts:
1. T003, T004, T005 (US1 — font sizes and layout)
2. T007 (US3 — warning state, reads new constants)
3. T019 (US8 — motion-reduce on pulse class added in T007)

### GameBoard.tsx Modification Order

Multiple stories modify `src/components/GameBoard.tsx`. Recommended order:
1. T008 (US4 — onboarding hint)
2. T010 (US5 — isPlantingMode prop pass-through)
3. T018 (US8 — motion-reduce on shop slide)
4. T022, T023, T024 (US9 — autosave indicator, Flash Drought)

---

## Parallel Opportunities

### P1 Stories (US1 + US2): Can be worked in parallel
```
Parallel batch:
  T003-T005 [US1] → src/components/HUD.tsx
  T006      [US2] → src/components/PlotCard.tsx
```

### P3 Stories (US6 + US7 + US8): Largely parallel across files
```
Parallel batch:
  T012 [US6] → src/components/DailyLog.tsx
  T013 [US6] → src/components/DaySummaryModal.tsx
  T017 [US8] → src/index.css
  T014 [US7] → src/App.tsx (prop threading only)
```

### US9 Parallel Start
```
Parallel batch:
  T020 [US9] → src/components/FarmGrid.tsx
  T021 [US9] → src/components/UpgradeCard.tsx
Then sequential:
  T022 → T023 → T024 → src/components/GameBoard.tsx
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Baseline check
2. Complete Phase 3: US1 (HUD readability + mobile visibility)
3. Complete Phase 4: US2 (touch affordance)
4. **STOP and VALIDATE**: Game readable on mobile, empty plots have visible affordance
5. Ship P1 fixes independently

### Incremental Delivery

1. Phase 1 → Phase 3 (US1) → Phase 4 (US2): P1 complete, ship ✅
2. Phase 2 (constants) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5): P2 complete, ship ✅
3. Phase 8 (US6) → Phase 9 (US7) → Phase 10 (US8): P3 complete, ship ✅
4. Phase 11 (US9) → Phase 12: P4 complete, ship ✅

---

## Notes

- [P] tasks = different files, no blocking dependencies on each other within same phase
- HUD.tsx is modified by US1, US3, and US8 — work them sequentially in that priority order
- GameBoard.tsx is modified by US4, US5, US8, US9 — sequential within each phase
- No new component files created; all changes are edits to existing files
- No GameState schema changes; no new npm dependencies
- Commit after each user story phase for clean git history and easy revert per story
