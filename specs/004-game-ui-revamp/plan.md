# Implementation Plan: Game UI Visual Revamp

**Branch**: `004-game-ui-revamp` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)

## Summary

Transform the current form-based farming game into an immersive, visually-driven experience. The game engine (`src/engine/`) is untouched. All changes are confined to React components, Tailwind CSS styling, and two new components (`ProgressRing`, `DaySummaryModal`). Layout becomes fully responsive via a bottom-sheet pattern on mobile. No new npm dependencies are required.

## Technical Context

**Language/Version**: TypeScript ~5.6 + React 18.3
**Primary Dependencies**: React 18, Tailwind CSS 3.4, Vite 5.4 (no new deps added)
**Storage**: localStorage (unchanged, schema version 3 — no changes)
**Testing**: Vitest 4 + @testing-library/react 16
**Target Platform**: Browser (desktop + mobile, 320 px–1440 px viewport)
**Project Type**: Single-page web application (browser game)
**Performance Goals**: Smooth CSS transitions (no frame-rate target; no animation library used)
**Constraints**: Zero new npm dependencies; pure CSS/SVG for all visual effects; engine untouched
**Scale/Scope**: ~10 component files modified or created; ~2 new components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ Pass | `spec.md` complete with 5 prioritized user stories and acceptance scenarios |
| II. Incremental & Independent Delivery | ✅ Pass | Each user story is independently implementable and testable (US1 responsive layout, US2 HUD restructure, US3 plot visuals, US4 shop improvements, US5 polish) |
| III. Quality Gates | ✅ Pass | Spec does not declare new tests required; existing engine tests (`gameEngine.test.ts`, `useGameEngine.test.ts`) are unaffected; `GameBoard.test.tsx` may need updating for structural changes |
| IV. Simplicity (YAGNI) | ✅ Pass | Two new components (`ProgressRing`, `DaySummaryModal`) each have clear, concrete uses; no premature abstractions |
| V. Observability | ✅ Pass | Browser-only app; no new server-side operations; existing error boundaries unchanged |

**Complexity Tracking**: No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-game-ui-revamp/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── App.tsx                      (minor: add SVG grain filter definition)
├── index.css                    (update: body background texture)
├── components/
│   ├── HUD.tsx                  (update: add Next Day + Last Turn buttons; restructure groups)
│   ├── GameBoard.tsx            (update: layout restructure; bottom-sheet state; modal state)
│   ├── FarmGrid.tsx             (minor: add decorative wrapper / farm canvas container)
│   ├── PlotCard.tsx             (update: growth stages, ProgressRing, exhausted texture, hover CTA)
│   ├── Shop.tsx                 (update: Active Buffs tray; bottom-sheet wrapper; wood texture)
│   ├── SeedCard.tsx             (update: net profit display; active border; BUY button style)
│   ├── UpgradeCard.tsx          (update: owned tiers → Active Buffs tray; purchasable only in main list)
│   ├── DailyLog.tsx             (minor: used inside DaySummaryModal; remove from sidebar)
│   ├── DaySummaryModal.tsx      (NEW: portal modal wrapping DailyLog)
│   └── ProgressRing.tsx         (NEW: circular SVG progress indicator)
└── engine/                      (no changes)

tests/
├── components/
│   └── GameBoard.test.tsx       (update: adjust for structural changes)
└── engine/                      (no changes)
```

**Structure Decision**: Single project (Option 1). No backend. No new directories. New components added to existing `src/components/`. Engine is isolated and unchanged.

---

## Phase 1: Design Detail

### US1 — Responsive Layout (P1)

**GameBoard layout restructure**:
- Desktop (`md:` and above): existing flex row — grid on left, shop sidebar on right (preserve `w-56` sidebar).
- Mobile (below `md:`): single column — HUD at top, farm grid filling the screen, shop as a fixed bottom-sheet slide-up panel.
- `GameBoard` adds `useState<boolean>` for `isShopOpen` (mobile only).
- A "Shop" toggle button appears in the HUD on mobile (hidden on `md:` and above via `md:hidden`).

**FarmGrid / canvas**:
- Wrap the `<section>` in a `<div>` with the dirt/texture background CSS.
- The 12-plot grid already uses `grid-cols-4` — on mobile this stays 4 columns (plots are small enough); no change needed.

**Touch targets**:
- Existing plot buttons are `aspect-square` within a grid — on a 375 px viewport with 4 columns and `gap-2 p-4`, each cell is ~84 px wide. Exceeds the 44 px minimum.
- Shop buttons already have `py-1.5` padding — sufficient.

---

### US2 — Structured HUD + Next Day Button (P1)

**HUD component** receives two new props: `onNextDay: () => void` and `onLastTurn: () => void`.

New HUD layout:
```
[Left group]                    [Right group]           [Actions]
☀️ Day N   🪙 Balance          Lease Xc/day  Tax X%   [Last Turn] [Next Day →]
```

- "Next Day" button moves from `GameBoard` footer into `HUD`.
- "Last Turn" button (new) — always visible; disabled on Day 1 when `lastDailyLog` is null.
- `GameBoard` no longer renders a `<footer>` with the Next Day button.
- `GameBoard` handles the `onNextDay` callback: processes turn, then opens `DaySummaryModal` with the resulting log.
- `lastDailyLog` from `GameState` is the source of truth for the modal content.

**DaySummaryModal**:
- Portal rendered via `ReactDOM.createPortal(…, document.body)`.
- Props: `log: DailyLogEntry`, `onClose: () => void`.
- Contains existing `DailyLog` component unchanged inside the modal card.
- Dismiss: close button, Escape key, click backdrop.
- `DailyLog` is removed from the right-column sidebar in `GameBoard`.

---

### US3 — Visual Plot States & Growth Stages (P2)

**PlotCard changes**:

1. **GrowthStage derivation** — pure helper `getGrowthStage(plot, cropDef): 'sprout' | 'small' | 'full' | 'ready'` per data-model.md spec.

2. **Growth stage icons**:
   - `'sprout'` → 🌱 (radish sprout emoji)
   - `'small'` → 🌿 (generic small plant)
   - `'full'` (not ready) → crop-specific emoji (🌱 radish, 🥕 parsnip, 🎃 pumpkin) — same as current but shown only when in final third
   - `'ready'` → same emoji + green `ring-2 ring-farm-grass` border on the card

3. **ProgressRing** wraps the stage emoji instead of the text badge:
   - `progress = 1 − (daysRemaining / growthDays)`
   - Ring color: amber (`text-farm-gold`) while growing, green (`text-farm-grass`) when ready.

4. **Empty plot**: Add `group` class to the button; show `<span className="opacity-0 group-hover:opacity-100 transition-opacity">🌱 Plant</span>` CTA on hover. Replace flat dashed border with inset shadow style.

5. **Exhausted plot**: Change background from `bg-farm-parchment` to a cracked-earth CSS gradient. Color: gray/red-muted. Remove the text-heavy description in favor of the visual + small fertilizer button.

6. **Urgency color system** applied consistently:
   - Growing → amber border/ring (`border-farm-gold`)
   - Ready → green border/ring (`border-farm-grass ring-farm-grass`)
   - Exhausted → red/muted (`border-farm-red bg-farm-red/10` + crack pattern)
   - Pest damaged → red border (unchanged)

**FarmGrid / canvas decoration**:
- Wrap grid in a container with the dirt texture CSS (dirt-color background + grain filter).
- Add a non-interactive decorative border element (CSS-only fence-style border or pebble SVGs injected as `aria-hidden` elements around the grid container).

---

### US4 — Shop Sidebar Improvements (P2)

**Shop component**:
- Background changes to `bg-farm-soil` (already used) with a wood-texture CSS treatment via additional `repeating-linear-gradient` stripes.
- Active Buffs tray: rendered only when `upgradeTier > 0`. Shows owned `UpgradeCard` items in a separate `<section aria-label="Active Buffs">` above or below the Seeds section.
- Main Tools section now shows only the *next purchasable* tier (not owned tiers). Future tiers remain dimmed.
- Bottom sheet wrapper: on mobile, `Shop` is rendered inside a fixed slide-up panel. On desktop, unchanged sidebar.

**SeedCard component**:
- Add `netProfit` display: `Est. profit: +{netProfit}🪙` below the yield/grow-days row.
- Active border: `isSelected` state changes border to `border-farm-gold ring-2 ring-farm-gold` (high-contrast gold).
- BUY button: rename from `{price}🪙` to `BUY {price}🪙`; add `active:scale-95 active:brightness-90` for pressed effect.
- Disabled state: `opacity-40 cursor-not-allowed` (unchanged).

**UpgradeCard component**:
- Owned cards are no longer rendered in `Shop`'s Tools section. Instead rendered in the Active Buffs tray.
- `UpgradeCard` for owned items: simplified "checkmark" display in the tray (compact, no buy button).

---

### US5 — Environmental & Aesthetic Polish (P3)

**Canvas texture**:
- `src/index.css` body background: already `#4A2F1A` (dark soil). Add a subtle `repeating-linear-gradient` pattern on the game canvas container div (not body).
- SVG `<filter id="pp-grain">` added to `App.tsx` (hidden, `aria-hidden`).

**Plot depth**:
- All plot cards: replace `border-dashed border-farm-stone` with `shadow-inner` + solid `border-farm-soil/50`.

**Decorative elements**:
- Non-interactive pebble/grass SVG shapes (`aria-hidden`) positioned absolutely around the FarmGrid container.

**Currency icon**:
- HUD coin: `text-2xl` (increased from `text-lg`); apply `bg-gradient-to-br from-farm-gold to-yellow-600 bg-clip-text` or replace `🪙` with a styled `<span>` — keep emoji but increase size.

**Shop sidebar wood texture**:
- `Shop` wrapper: add `repeating-linear-gradient` CSS stripes at low opacity over the `bg-farm-soil` base.

**Glass-morphic HUD**:
- HUD: `bg-farm-soil/80 backdrop-blur-sm` for a semi-transparent glass look.

---

## Constitution Check (Post-Design)

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ Pass | All 20 FRs addressed in design |
| II. Incremental & Independent Delivery | ✅ Pass | US1–US5 remain independently deployable |
| III. Quality Gates | ✅ Pass | `GameBoard.test.tsx` will need structural updates (HUD props changed, footer removed); engine tests unaffected |
| IV. Simplicity (YAGNI) | ✅ Pass | `ProgressRing` used by all growing plots; `DaySummaryModal` used by both Next Day and Last Turn triggers |
| V. Observability | ✅ Pass | No server operations introduced |

## Artifacts Generated

| Artifact | Path | Status |
|----------|------|--------|
| Research | `specs/004-game-ui-revamp/research.md` | ✅ Complete |
| Data Model | `specs/004-game-ui-revamp/data-model.md` | ✅ Complete |
| Contracts | N/A — browser-only app, no external interface | Skipped per constitution |
| Quickstart | N/A — no external interface exposed | Skipped per constitution |
