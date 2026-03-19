# Tasks: Game UI Visual Revamp

**Input**: Design documents from `/specs/004-game-ui-revamp/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅

**Tests**: Not explicitly requested in spec — no test tasks generated. Existing engine tests must remain passing throughout.

**Organization**: Tasks grouped by user story to enable independent implementation and delivery.

---

## Phase 1: Setup

**Purpose**: Verify baseline and add the one shared asset (SVG filter) that multiple story phases will reference.

- [x] T001 Verify existing test suite passes: run `npm test && npm run lint` from repo root
- [x] T002 Add hidden SVG `<filter id="pp-grain">` (`feTurbulence fractalNoise baseFrequency="0.65" numOctaves="3"` + `feColorMatrix saturate 0` + `feBlend multiply`) with `aria-hidden="true"` to `src/App.tsx` just before the root component return

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New components that multiple user-story phases depend on. Must exist (even as shells) before the stories that import them are implemented.

⚠️ **CRITICAL**: US2 imports `DaySummaryModal`; US3 imports `ProgressRing`. Complete this phase first.

- [x] T003 [P] Create `src/components/ProgressRing.tsx` — SVG circular progress ring component. Props: `progress: number` (0–1), `size?: number` (default 56), `strokeWidth?: number` (default 4), `children: React.ReactNode`. Render: outer `relative inline-flex items-center justify-center` div, SVG with `rotate(-90)` track circle + progress circle using `strokeDasharray`/`strokeDashoffset`, children centered absolutely inside. Ring color: `text-farm-gold` while growing (progress < 1), `text-farm-grass` when ready (progress === 1).
- [x] T004 [P] Create `src/components/DaySummaryModal.tsx` — portal modal wrapping `DailyLog`. Props: `log: DailyLogEntry`, `onClose: () => void`. Render via `ReactDOM.createPortal` into `document.body`. Structure: backdrop `fixed inset-0 bg-black/60 flex items-center justify-center z-50` (click closes), inner card `bg-farm-soil rounded-2xl p-4 max-w-sm w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto overscroll-contain` (click stops propagation). Close button at top-right. Escape key handler via `useEffect`. Auto-focus close button on mount. Empty-state handling: when `log.harvests.length === 0` and `log.totalHarvestIncome === 0`, show a `<p className="font-pixel text-xs text-farm-stone text-center py-2">Quiet day — no harvests.</p>` above the accounting rows.

**Checkpoint**: `ProgressRing` and `DaySummaryModal` exist and render without errors.

---

## Phase 3: User Story 1 — Responsive Layout (Priority: P1) 🎯 MVP

**Goal**: The game layout works correctly on all screen sizes from 320 px to 1440 px. On mobile, the shop is a bottom sheet; on desktop, it is a sidebar.

**Independent Test**: Open the game on a 375×667 px Chrome DevTools mobile viewport. Verify: farm grid fills the screen, a "Shop" toggle button is visible in the HUD, tapping it reveals the shop as a slide-up panel, and no horizontal scrolling occurs.

- [x] T005 [US1] Add `isShopOpen: boolean` state to `src/components/GameBoard.tsx` (default `false`). Add `toggleShop` handler. Pass `isShopOpen`, `toggleShop`, and `onNextDay`/`onLastTurn` stubs to `HUD`.
- [x] T006 [US1] Restructure `src/components/GameBoard.tsx` layout: **remove the `<footer>` element and its Next Day button entirely** (this is the only task that removes the footer — T010 does not repeat this). Change the content area from `flex flex-1 gap-4 p-4 overflow-hidden` to `flex flex-1 flex-col md:flex-row gap-4 p-4 overflow-hidden`. The `<main>` farm area takes `flex-1 min-w-0`. The Shop panel is conditionally rendered as a bottom sheet on mobile.
- [x] T007 [US1] Add bottom-sheet wrapper around `<Shop>` in `src/components/GameBoard.tsx`: fixed `bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out rounded-t-2xl md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto md:rounded-none md:translate-y-0`. Apply `translate-y-0` when `isShopOpen`, `translate-y-full` when closed. Add semi-transparent backdrop `fixed inset-0 bg-black/40 z-30 transition-opacity md:hidden` visible only when sheet is open. Max height `max-h-[70vh] overflow-y-auto overscroll-contain` on the sheet content.
- [x] T008 [US1] Add a "🌾 Shop" toggle button to `src/components/HUD.tsx` visible only on mobile (`md:hidden`). Receives `onToggleShop: () => void` prop. Style: `font-pixel text-xs px-3 py-1 rounded bg-farm-gold text-farm-ink`.

**Checkpoint**: On 375 px viewport, farm grid is visible, shop opens/closes as a bottom sheet, no overflow. On desktop, layout unchanged.

---

## Phase 4: User Story 2 — Structured HUD + Next Day Button (Priority: P1)

**Goal**: "Next Day" button lives in the HUD. Clicking it processes the turn, then shows the Day Summary as a modal. A "Last Turn" button reopens the modal.

**Independent Test**: Load the game on desktop. Verify: HUD shows Day (☀️), Balance (🪙), Lease, Tax, Next Day button, and Last Turn button — all without scrolling. Click Next Day → modal appears with turn results → dismiss → game continues. Click Last Turn → modal reopens.

- [x] T009 [US2] Refactor `src/components/HUD.tsx`: add props `onNextDay: () => void`, `onLastTurn: () => void`, `isProcessing: boolean`, `hasLastTurn: boolean`. Restructure layout: left group `flex items-center gap-3` containing ☀️ Day chip and 🪙 Balance chip; right group `flex items-center gap-3 ml-auto` containing Lease and Tax; then `flex items-center gap-2` for Last Turn button (`font-pixel text-xs px-2 py-1 rounded bg-farm-soil/60 text-farm-stone border border-farm-stone/40 disabled:opacity-30`) and Next Day button (`font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink disabled:opacity-50 transition-colors`). Day chip: `☀️` icon + `text-farm-gold font-pixel`. Balance chip: `🪙` icon large (`text-xl`) + balance value.
- [x] T010 [US2] Update `src/components/GameBoard.tsx`: add `daySummary: DailyLogEntry | null` and `isSummaryOpen: boolean` state. Refactor `handleNextDay`: call `onNextDay()` synchronously, then open modal with `state.lastDailyLog` (the engine updates state before this callback completes — access via updated state ref or restructure to receive the log from the callback). Pass `onNextDay={handleNextDay}`, `onLastTurn={() => setIsSummaryOpen(true)}`, `isProcessing`, `hasLastTurn={lastDailyLog !== null}` to `HUD`. Note: the `<footer>` was already removed in T006; do not attempt to remove it again.
- [x] T011 [US2] Render `<DaySummaryModal>` in `src/components/GameBoard.tsx` when `isSummaryOpen && daySummary !== null`. Pass `log={daySummary}` and `onClose={() => setIsSummaryOpen(false)}`.
- [x] T012 [US2] Remove the `{lastDailyLog && <DailyLog log={lastDailyLog} />}` block from the right-column sidebar in `src/components/GameBoard.tsx`. The `DailyLog` component is now rendered only inside `DaySummaryModal`.

**Checkpoint**: Next Day button visible in HUD. Clicking it shows modal with turn results. Last Turn reopens it. Static summary box is gone from sidebar.

---

## Phase 5: User Story 3 — Visual Plot States & Growth Stages (Priority: P2)

**Goal**: Each plot communicates its state visually. Growing crops show three distinct stages. Progress is shown via a circular ring, not a text badge.

**Independent Test**: Seed a Pumpkin (3-day crop). Advance days. Verify: Day 1 shows sprout 🌱 with partial amber ring; Day 2 shows small plant 🌿 with ~66% amber ring; Day 3 shows pumpkin 🎃 with full green ring. Exhausted plot looks cracked/gray. Empty plot shows "Plant here" on hover.

- [x] T013 [P] [US3] Add `getGrowthStage(plot: PlotState, growthDays: number): 'sprout' | 'small' | 'full' | 'ready'` pure helper at the top of `src/components/PlotCard.tsx`. Logic: if `daysRemaining === 0` → `'ready'`; if `growthDays === 1` → `'full'`; if `growthDays === 2` → `daysElapsed === 0 ? 'sprout' : 'full'`; if `growthDays >= 3` → equal-thirds thresholds where `daysElapsed = growthDays − daysRemaining`. Where `daysElapsed = growthDays - (plot.daysRemaining ?? growthDays)`.
- [x] T014 [P] [US3] Add `GROWTH_STAGE_EMOJI` map to `src/components/PlotCard.tsx`: `sprout: '🌱'`, `small: '🌿'`, `full/ready: crop-specific emoji from CROP_EMOJI`. Update `GrowingCropCard` to: (a) import `CROP_DEFINITIONS` from constants, (b) call `getGrowthStage`, (c) compute `progress = 1 − (daysRemaining / growthDays)`, (d) wrap the stage emoji in `<ProgressRing progress={progress} size={52}>`, (e) remove the text `${daysLeft}d left` badge, (f) apply `border-farm-gold` card border while growing, `border-farm-grass ring-2 ring-farm-grass` when ready.
- [x] T015 [P] [US3] Update `EmptyPlot` button in `src/components/PlotCard.tsx`: add `group` class. Replace flat dashed border (`border-dashed border-farm-stone`) with inset shadow (`shadow-inner border border-farm-soil/60`). Change background from `bg-farm-parchment` to a dark tilled soil style (`bg-[#2A1A0E]`). Add hover CTA: `<span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-pixel text-farm-gold mt-1">🌱 Plant</span>`. Remove the `🟫` emoji + "Empty" label.
- [x] T016 [P] [US3] Update `ExhaustedPlot` in `src/components/PlotCard.tsx`: change background to a cracked-earth CSS gradient using Tailwind arbitrary value `bg-[repeating-linear-gradient(20deg,#3a2010_0px,#3a2010_8px,#2a1208_9px,#2a1208_10px)]` layered with `bg-[repeating-linear-gradient(-30deg,transparent_0px,transparent_12px,#1a0a02_13px,#1a0a02_14px)]` — or apply via inline `style` prop. Change border to `border-farm-red/60`. Apply overall `opacity-75 grayscale-[0.4]` filter. Keep the `Use Fertilizer` button. Remove text-heavy "Exhausted" label, keep the `daysUntilRecovery` count as small text.
- [x] T017 [US3] Update `src/components/FarmGrid.tsx` (depends on T002 for SVG filter): wrap the `<section>` in a `<div className="relative rounded-xl overflow-hidden p-3 bg-[#2A1A0E] [filter:url(#pp-grain)] shadow-inner">`. Add non-interactive decorative fence border: `<div aria-hidden="true" className="absolute inset-0 rounded-xl border-4 border-[#5C3D1E] pointer-events-none" />` (outermost visual frame). Add 2–3 pebble SVG shapes as absolutely-positioned `aria-hidden` elements in the corners of the container (simple `<circle>` shapes in `#5C3D1E`). Also add 1–2 small grass-tuft SVG shapes (`aria-hidden`) mid-edge to supplement the pebbles — this satisfies FR-016 in full so T025 does not need to revisit this file.

**Checkpoint**: All five plot states render with correct visual treatments. Pumpkin crop transitions through 3 growth stages over 3 days.

---

## Phase 6: User Story 4 — Shop Sidebar Improvements (Priority: P2)

**Goal**: Shop shows net profit per seed, active selection has a high-contrast border, BUY button is tactile, owned tools are in a separate Active Buffs tray (hidden when none owned).

**Independent Test**: Open shop with upgradeTier ≥ 1. Verify: owned tools appear in "Active Buffs" section (not in main Tools list). Select Parsnip seed — gold border persists on card. Net profit `Est. profit: +18🪙` visible. Click BUY — button shows pressed effect.

- [x] T018 [P] [US4] Update `src/components/SeedCard.tsx`: (a) add `netProfit = crop.baseYield - price` computed value; (b) add `<p className="text-xs text-farm-grass font-pixel">Est. profit: +{netProfit}🪙</p>` below the yield/grow-days row; (c) change active border from `border-farm-grass` to `border-farm-gold ring-2 ring-farm-gold`; (d) rename BUY button label from `{price}🪙` to `BUY {price}🪙`; (e) add `active:scale-95 active:brightness-90 transition-transform` to the BUY button className.
- [x] T019 [P] [US4] Update `src/components/UpgradeCard.tsx` owned variant: change the owned card layout to a compact tray-item style — `flex items-center gap-2 px-2 py-1 rounded bg-farm-grass/20 border border-farm-grass/40` with a `✓` checkmark badge and tool label. Remove the "Owned ✓" text span; replace with a small `<span className="text-farm-grass text-sm">✓</span>` icon only. This compact format fits the Active Buffs tray.
- [x] T020 [US4] Update `src/components/Shop.tsx`: (a) split owned vs purchasable tiers — `const ownedTiers = UPGRADE_TIER_DEFINITIONS.filter(d => upgradeTier >= d.tier)` and `const nextTier = UPGRADE_TIER_DEFINITIONS.find(d => upgradeTier === d.tier - 1)` and `const futureTiers = UPGRADE_TIER_DEFINITIONS.filter(d => upgradeTier < d.tier - 1)`; (b) render `<section aria-label="Active Buffs">` only when `ownedTiers.length > 0`, containing compact owned `UpgradeCard` items; (c) render in Tools section only `nextTier` (with buy button) and `futureTiers` (dimmed) — owned tiers no longer appear here.
- [x] T021 [US4] Add wood-texture CSS to `src/components/Shop.tsx` sidebar wrapper: change `bg-farm-soil` to include an inline `style` with `background: repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 8px), #4A2F1A` to create subtle wood grain stripes. Alternatively use a Tailwind arbitrary background value if it fits cleanly.

**Checkpoint**: Active Buffs tray appears only when tools are owned. Selecting a seed shows gold ring. BUY button has press feedback. Net profit shown on every seed card.

---

## Phase 7: User Story 5 — Environmental & Aesthetic Polish (Priority: P3)

**Goal**: The game world feels grounded and atmospheric: textured background, plot depth (shadows), consistent color language, enlarged coin icon, glass-morphic HUD.

**Independent Test**: Load the game and visually verify: (1) canvas background has visible texture, not flat color; (2) plot cells have inset shadow depth; (3) HUD has semi-transparent glass effect; (4) coin icon in HUD is noticeably larger than the day number.

- [ ] T022 [P] [US5] Update `src/components/HUD.tsx` with glass-morphic styling: change `bg-farm-soil` to `bg-farm-soil/80 backdrop-blur-sm`. Increase coin emoji size: wrap balance `🪙` in `<span className="text-2xl leading-none" aria-hidden="true">🪙</span>` and increase balance value to `text-xl font-pixel text-farm-gold`. Increase Day sun icon: `<span className="text-xl" aria-hidden="true">☀️</span>` + Day number `text-lg font-pixel text-farm-gold`. Note: CSS gradient (`bg-clip-text`) does not apply to emoji characters — size increase alone satisfies FR-018. Do not attempt to apply gradient CSS to the emoji span.
- [ ] T023 [P] [US5] Update `src/index.css`: add dirt texture to the body or app root — change `background-color: #4A2F1A` to `background: repeating-linear-gradient(0deg, #3D2010 0px, #3D2010 2px, #4A2F1A 2px, #4A2F1A 6px)`. This gives the overall page a subtle horizontal stripe texture visible in gaps between UI elements.
- [ ] T024 [P] [US5] Update all `PlotCard` sub-components in `src/components/PlotCard.tsx` to replace `border-dashed border-2 border-farm-stone` with `shadow-inner border border-farm-soil/50` on `GrowingCropCard` and `PestDamagedPlot` containers (the empty and exhausted plots are already updated in US3). This gives all plots a slightly sunken look.
- [ ] T025 [US5] Verify decorative elements in `src/components/FarmGrid.tsx` are complete (added in T017). No further changes to FarmGrid.tsx needed. Instead, verify the `pp-grain` SVG filter from T002 is visibly active on the farm container by doing a quick browser check: the background should appear slightly textured, not flat. If the filter has no visible effect, adjust `baseFrequency` from `0.65` to `0.85` in `src/App.tsx` to increase grain visibility.

**Checkpoint**: Visual pass — background has texture, plots have depth, HUD is glass-morphic, coin icon is prominent.

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: Final validation, cleanup, and GameBoard test update for structural changes.

- [ ] T026 Update `tests/components/GameBoard.test.tsx` to reflect: HUD now receives `onNextDay`, `onLastTurn`, `isProcessing`, `hasLastTurn` props; footer with Next Day button is removed; DailyLog sidebar block is removed. Fix any broken queries or assertions caused by these structural changes.
- [ ] T027 [P] Run `npm test && npm run lint` from repo root. Fix any TypeScript errors or lint violations introduced by the revamp. Confirm all engine tests (`gameEngine.test.ts`, `useGameEngine.test.ts`) still pass.
- [ ] T028 [P] Visual smoke test: run `npm run dev`, open on both desktop (1280 px) and mobile emulator (375 px). Verify all 5 user story acceptance criteria are met per spec.md SC-001 through SC-007.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks US2 and US3
- **Phase 3 (US1)**: Depends on Phase 2 completion; modifies `GameBoard.tsx` layout
- **Phase 4 (US2)**: Depends on Phase 3 completion (both modify `GameBoard.tsx`); depends on `DaySummaryModal` from Phase 2
- **Phases 5, 6 (US3, US4)**: Depend on Phase 2 only; can start in parallel with US1/US2 (different files)
- **Phase 7 (US5)**: Depends on Phases 3–6 completion (polish over all components)
- **Phase 8 (Polish)**: Depends on all implementation phases

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — touches `GameBoard.tsx` layout + `HUD.tsx`
- **US2 (P1)**: After US1 — touches `GameBoard.tsx` turn logic + `HUD.tsx` buttons + modal
- **US3 (P2)**: After Phase 2 — touches `PlotCard.tsx` + `FarmGrid.tsx` only (**independent of US1/US2**)
- **US4 (P2)**: After Phase 2 — touches `SeedCard.tsx` + `UpgradeCard.tsx` + `Shop.tsx` only (**independent of US1/US2/US3**)
- **US5 (P3)**: After US1–US4 — touches `HUD.tsx`, `index.css`, `PlotCard.tsx`, `FarmGrid.tsx`

### Within Each Phase

- Tasks marked `[P]` can be executed in parallel (different files, no intra-story dependencies)
- Tasks without `[P]` must complete in listed order within their phase

### Parallel Opportunities

```
# Phase 2 — run in parallel:
T003 Create ProgressRing.tsx
T004 Create DaySummaryModal.tsx

# Phase 5 (US3) — run first three in parallel:
T013 getGrowthStage helper in PlotCard.tsx
T014 GrowingCropCard stage icons + ProgressRing
T015 EmptyPlot hover CTA styling
T016 ExhaustedPlot cracked-earth styling
# Then T017 (FarmGrid wrapper) after T013-T016

# Phase 6 (US4) — run first two in parallel:
T018 SeedCard net profit + active border + BUY
T019 UpgradeCard compact owned style
# Then T020 Shop Active Buffs tray, then T021 wood texture

# Phase 7 (US5) — run first three in parallel:
T022 HUD glass-morphic + coin icon
T023 index.css body texture
T024 PlotCard shadow depth
# Then T025 FarmGrid decoratives
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — `ProgressRing` + `DaySummaryModal` exist
3. Complete Phase 3 (US1) — responsive layout, bottom sheet
4. Complete Phase 4 (US2) — HUD restructured, Next Day in HUD, day summary modal
5. **STOP and VALIDATE**: Game is playable on mobile, core loop works end-to-end
6. Ship/demo if ready

### Incremental Delivery

1. Setup + Foundational → baseline confirmed
2. US1 → mobile layout works
3. US2 → HUD + Next Day modal complete
4. US3 → plot visuals (parallel with US4)
5. US4 → shop improvements (parallel with US3)
6. US5 → environmental polish
7. Polish → tests green, lint clean

### Parallel Team Strategy (2 developers)

After Phase 2:
- **Dev A**: US1 → US2 (GameBoard + HUD thread)
- **Dev B**: US3 → US4 (PlotCard + Shop thread, independent files)
Both merge → Dev A or B: US5 → Polish

---

## Notes

- `[P]` = different files, no intra-phase dependencies — safe to run concurrently
- `[USn]` maps each task to its user story for traceability
- Engine files (`src/engine/`) are untouched throughout
- No new npm dependencies introduced (see research.md)
- Each phase checkpoint is independently demonstrable to stakeholders
- Commit after each phase checkpoint at minimum
