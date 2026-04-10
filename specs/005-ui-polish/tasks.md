# Tasks: UI Polish Core (005-ui-polish-core)

**Input**: Design documents from `specs/005-ui-polish/`  
**Branch**: `005-ui-polish-core`

**Tests**: Not requested — spec contains no TDD requirement. Test files are not generated.

**Organization**: Tasks are grouped by user story. No new dependencies, no schema changes, no new packages. All changes are UI/presentational within existing components.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared dependency)
- **[Story]**: User story this task belongs to

---

## Phase 1: Setup

No project initialization required — all changes are targeted edits to existing files.

- [x] T001 Confirm dev server starts and baseline game loads via `npm run dev`

---

## Phase 2: User Story 1 — Low-Balance Danger Warning (Priority: P1) 🎯 MVP

**Goal**: Coin balance chip in the HUD shows an amber warning state below 45 coins and a red pulsing danger state at or below 15 coins; both auto-clear when balance recovers.

**Independent Test**: Open game, set `coinBalance` to 44, 15, and 60 in localStorage state, reload — confirm chip colour changes at each threshold.

- [x] T002 [US1] Add `balanceWarning` derived tier ('normal' | 'warning' | 'critical') and apply conditional Tailwind classes to coin balance chip in `src/components/HUD.tsx`
  - Normal (>45): existing gold border + gold text (unchanged)
  - Warning (≤45, >15): `border-yellow-600/70 text-yellow-300`
  - Critical (≤15): `border-farm-red/80 text-farm-red animate-pulse`
  - Thresholds: `LAND_LEASE_FEE * 3` and `LAND_LEASE_FEE` (constant already imported)

**Checkpoint**: Coin chip changes colour at both thresholds and recovers to gold when balance rises.

---

## Phase 3: User Story 2 — First-Run Onboarding Hint (Priority: P1)

**Goal**: On Day 1 with no crops planted, a banner appears directing the player to the shop. It disappears automatically once any crop is in a plot.

**Independent Test**: Clear localStorage, load game — hint banner visible. Plant one seed — hint gone.

- [ ] T003 [US2] Derive `showOnboardingHint` boolean and render hint banner between the flash-drought banner and the planting-mode banner in `src/components/GameBoard.tsx`
  - Condition: `state.currentDay === 1 && state.plots.every(p => p.cropId === null && !p.pestDamaged && p.exhaustedSinceDay === null)`
  - Banner text: `🛒 Visit the Shop to buy seeds before advancing the day!`
  - Styling: `bg-farm-sky/10 border border-farm-sky/40 text-farm-sky font-pixel text-xs px-3 py-2 rounded`

**Checkpoint**: Banner visible on fresh Day-1 game; gone after first crop is planted.

---

## Phase 4: User Story 3 — Empty Plot Plant Text Brightness (Priority: P2)

**Goal**: The 🌱 Plant label on every empty plot is fully visible at rest — not hidden until hover.

**Independent Test**: Load game with empty plots, observe without hovering — 🌱 Plant text must be visible on every empty plot.

- [ ] T004 [US3] Remove `opacity-0 group-hover:opacity-100 transition-opacity` from the Plant label span in `EmptyPlot` in `src/components/PlotCard.tsx`
  - Before: `<span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-pixel text-farm-gold">`
  - After: `<span className="text-xs font-pixel text-farm-gold">`
  - Retain `hover:border-farm-gold/50 hover:brightness-125` on the container button (unchanged)

**Checkpoint**: 🌱 Plant text visible on empty plots without hovering.

---

## Phase 5: User Story 4 — Disaster Event Drama (Priority: P2)

**Goal**: Day Summary modal opened after a disaster turn shows a red-tinted background and a bold ⚠️ Disaster! headline above the log entries.

**Independent Test**: Set `lastDailyLog.weatherId` to `'blight'` in state, open Day Summary — modal must be visually distinct from a normal-day summary.

- [ ] T005 [US4] Export `DISASTER_WEATHER_IDS` from `src/components/DailyLog.tsx`
  - Change: `const DISASTER_WEATHER_IDS` → `export const DISASTER_WEATHER_IDS`

- [ ] T006 [US4] Import `DISASTER_WEATHER_IDS`, derive `isDisaster`, apply red-tinted modal background, and prepend disaster headline in `src/components/DaySummaryModal.tsx` (depends on T005)
  - `const isDisaster = DISASTER_WEATHER_IDS.has(log.weatherId);`
  - Modal container: `isDisaster ? 'bg-[#2A0A0A]' : 'bg-farm-soil'`
  - Prepend before `<DailyLog>`:
    ```tsx
    {isDisaster && (
      <div className="flex items-center gap-2 px-3 py-2 rounded bg-farm-red/20 border border-farm-red/50 mb-2">
        <span className="text-xl" aria-hidden="true">⚠️</span>
        <span className="font-pixel text-xs text-farm-red uppercase tracking-widest">Disaster!</span>
      </div>
    )}
    ```

**Checkpoint**: Disaster day modal is red-tinted with ⚠️ headline; normal day modal is unchanged.

---

## Phase 6: User Story 5 — Bankruptcy Post-Mortem Insight (Priority: P2)

**Goal**: Bankruptcy screen shows one contextual insight derived from the player's final turn data, below the stats.

**Independent Test**: Trigger bankruptcy. Insight text must appear and reflect the final turn (pest / blight / early / low-balance).

- [ ] T007 [US5] Add `lastDailyLog?: DailyLogEntry | null` prop and `deriveInsight` pure function to `src/components/BankruptcyScreen.tsx`
  - Import `DailyLogEntry` from `'../engine/types'`
  - Priority-ordered first-match rules (check in this exact order):
    1. `!lastDailyLog` → "Plant early and harvest often to build a coin reserve."
    2. `lastDailyLog.pestDestroyedPlots.length > 0` → "Pests wiped your plots. Clear them quickly and replant to recover income."
    3. `lastDailyLog.weatherId === 'blight'` → "Blight destroyed your crops. Fast-growing radishes reduce blight exposure."
    4. `lastDailyLog.weatherId === 'flash_drought'` → "Flash Drought delayed your harvest. Keep a coin buffer to survive slow turns."
    5. `daysPlayed < 5` → "You went bankrupt early. Start with radishes — they pay out in just 1 day."
    6. `peakBalance < 40` → "Your balance stayed dangerously low. Aim for a buffer of 3× your lease cost."
    7. default → "Keep a reserve above your daily lease cost to survive bad-weather turns."

- [ ] T008 [US5] Render insight block below the stats section in `src/components/BankruptcyScreen.tsx` (depends on T007)
  ```tsx
  <div className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30">
    <span className="font-pixel text-[9px] text-farm-stone uppercase tracking-widest">Insight</span>
    <p className="font-pixel text-xs text-farm-parchment leading-relaxed">{insight}</p>
  </div>
  ```

- [ ] T009 [US5] Pass `lastDailyLog={state.lastDailyLog}` to `<BankruptcyScreen>` in `src/App.tsx` (depends on T007)

**Checkpoint**: Bankruptcy screen shows contextual insight; different run patterns produce different insight text.

---

## Phase 7: User Story 6 — Visual Polish & Consistency (Priority: P3)

**Goal**: Four independent one-to-three-line fixes across four files — upgrade card contrast, flash drought prominence, Shop button weight, and tablet layout redundancy.

**Independent Test**: Load game on mobile + desktop; verify owned upgrade card labels are legible, flash drought banner stands out, Shop button is clearly larger than Last Turn button, no layout gap at 768–1024px.

- [ ] T010 [P] [US6] Remove redundant `sm:grid-cols-4` from farm plots grid in `src/components/FarmGrid.tsx`
  - Before: `className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-6"`
  - After: `className="grid grid-cols-4 gap-2 md:grid-cols-6"`

- [ ] T011 [P] [US6] Fix owned upgrade card label text contrast in `src/components/UpgradeCard.tsx`
  - Before: `<p className="font-pixel text-xs text-farm-ink">{def.label}</p>`
  - After: `<p className="font-pixel text-xs text-farm-parchment">{def.label}</p>`

- [ ] T012 [P] [US6] Strengthen flash drought banner background, border, and typography in `src/components/GameBoard.tsx`
  - Before: `bg-farm-red/10 border border-farm-red/40`
  - After: `bg-farm-red/20 border border-farm-red/70 tracking-wide`

- [ ] T013 [P] [US6] Increase Shop button padding and add ring in `src/components/HUD.tsx`
  - Before: `px-3 py-1.5`
  - After: `px-4 py-2 ring-1 ring-farm-gold/50`

**Checkpoint**: All four changes applied; owned upgrade label legible; flash drought banner prominent; Shop button visually heavier; no layout gaps.

---

## Phase 8: Final Validation

- [ ] T014 Run `npm test && npm run lint` and confirm all checks pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies
- **Phases 2–7**: All stories are independent of each other (each touches distinct files)
  - Exception: T006 depends on T005 (DaySummaryModal imports exported const from DailyLog)
  - Exception: T008 and T009 depend on T007 (prop must exist before render + App.tsx passthrough)
  - Note: US6 T013 (HUD.tsx) should follow US1 T002 (same file); by Phase 7 T002 is long complete

### User Story Dependencies

| Story | Intra-story dependency | Cross-story dependency |
|-------|----------------------|----------------------|
| US1 | None | None |
| US2 | None | None |
| US3 | None | None |
| US4 | T006 after T005 | None |
| US5 | T008/T009 after T007 | None |
| US6 | None within phase | T013 after T002 (same file, different lines) |

### Parallel Opportunities

- T002, T003, T004, T005 can all run in parallel (HUD, GameBoard, PlotCard, DailyLog)
- T010, T011, T012, T013 (US6 phase) can all run in parallel (four different files)
- After T007 completes: T008 and T009 can run in parallel

---

## Parallel Example: Phase 7 (US6)

```
All four US6 tasks touch different files — safe to run simultaneously:

T010: src/components/FarmGrid.tsx      — remove sm:grid-cols-4
T011: src/components/UpgradeCard.tsx   — fix text-farm-ink → text-farm-parchment
T012: src/components/GameBoard.tsx     — strengthen flash drought banner
T013: src/components/HUD.tsx           — increase Shop button padding + ring
```

---

## Implementation Strategy

### MVP (US1 + US2 only — 2 tasks)

1. T001 baseline check
2. T002 HUD warning → validate US1
3. T003 Onboarding hint → validate US2
4. **STOP and validate** — coin warning + onboarding hint working
5. Continue or ship

### Incremental Delivery

1. T001 → baseline
2. T002 → US1 ✓
3. T003 → US2 ✓
4. T004 → US3 ✓
5. T005 → T006 → US4 ✓
6. T007 → T008 + T009 → US5 ✓
7. T010–T013 → US6 ✓
8. T014 → tests + lint pass

---

## Summary

| Phase | Story | Tasks | Files |
|-------|-------|-------|-------|
| 2 | US1 Low-Balance Warning | T002 | HUD.tsx |
| 3 | US2 Onboarding Hint | T003 | GameBoard.tsx |
| 4 | US3 Plant Text | T004 | PlotCard.tsx |
| 5 | US4 Disaster Drama | T005, T006 | DailyLog.tsx, DaySummaryModal.tsx |
| 6 | US5 Bankruptcy Insight | T007, T008, T009 | BankruptcyScreen.tsx, App.tsx |
| 7 | US6 Visual Polish | T010–T013 | FarmGrid.tsx, UpgradeCard.tsx, GameBoard.tsx, HUD.tsx |
| — | Validation | T014 | — |

**Total**: 14 tasks across 8 modified files. No new files. No schema changes.
