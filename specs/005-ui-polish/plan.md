# Implementation Plan: UI Polish & Accessibility

**Branch**: `005-ui-polish` | **Date**: 2026-04-09 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/005-ui-polish/spec.md`

## Summary

Fourteen UI/UX issues identified in the game design review are addressed across 9 user stories (P1–P4). Changes are confined to the presentation layer: no `GameState` schema changes, no new dependencies, and two new named constants. The highest-impact fixes (font sizes, mobile visibility, touch affordance) are delivered first as independent P1 increments.

## Technical Context

**Language/Version**: TypeScript ~5.6  
**Primary Dependencies**: React 18.3, Tailwind CSS 3.4, Vite 5.4  
**Storage**: localStorage (key: `pixel-parsnips-state`, schema version 3 — unchanged)  
**Testing**: Vitest 4.1.0, @testing-library/react 16.3.2, vitest-axe  
**Target Platform**: Browser — mobile (touch) and desktop  
**Project Type**: Web game application (single-page)  
**Performance Goals**: 60 fps at all breakpoints; no layout jank during animation transitions  
**Constraints**: No new npm dependencies; no schema version bump; no changes to game engine logic  
**Scale/Scope**: 10 component files modified; 2 new constants added

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Specification-First | ✅ Pass | spec.md complete with priorities and acceptance scenarios |
| II. Incremental & Independent Delivery | ✅ Pass | Each user story (P1–P4) is independently implementable and testable without other stories |
| III. Quality Gates | ✅ Pass | Spec does not explicitly request new tests; existing tests must remain green |
| IV. Simplicity (YAGNI) | ✅ Pass | No new abstractions; all changes are direct edits to existing components |
| V. Observability | ✅ Pass | Autosave indicator (FR-014) adds explicit save confirmation; no silent failures introduced |

**Post-Phase-1 re-check**: No violations detected. Two new constants are co-located with related constants. No new component files created (changes are inline). No new state management layer introduced.

## Project Structure

### Documentation (this feature)

```text
specs/005-ui-polish/
├── plan.md              # This file
├── research.md          # Phase 0 output ✅
├── data-model.md        # Phase 1 output ✅
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

*Note: `contracts/` and `quickstart.md` are omitted — this feature adds no external interface.*

### Source Code (files modified by this feature)

```text
src/
├── index.css                        # + reduced-motion global block
└── components/
    ├── HUD.tsx                      # font sizes, mobile lease/tax, low-balance warning, shop button
    ├── GameBoard.tsx                # onboarding hint, autosave indicator, Flash Drought banner weight
    ├── FarmGrid.tsx                 # planting mode border/glow, sm breakpoint fix
    ├── PlotCard.tsx                 # touch affordance, planting mode plot highlight
    ├── DailyLog.tsx                 # disaster event headline promotion
    ├── DaySummaryModal.tsx          # disaster modal tinted background
    ├── BankruptcyScreen.tsx         # run-specific insight display
    ├── UpgradeCard.tsx              # owned-tier text contrast fix
    └── App.tsx                      # thread lastLog prop to BankruptcyScreen

src/engine/
└── constants.ts                     # + LOW_BALANCE_WARNING_THRESHOLD, LOW_BALANCE_CRITICAL_THRESHOLD

tests/
├── components/
│   └── GameBoard.test.tsx           # existing tests must remain green
└── engine/
    ├── gameEngine.test.ts           # unchanged
    └── useGameEngine.test.ts        # unchanged
```

## Implementation Phases

### Phase 1 — Critical: Readability & Touch Affordance (P1)

**Stories**: US1 (HUD readability + mobile visibility), US2 (empty plot touch affordance)

**Deliverables**:

1. **HUD.tsx — font size uplift** (FR-001, FR-002):
   - Replace `text-[9px]` → `text-[14px]` for lease/tax labels
   - Replace `text-[10px]` → `text-[14px]` for button labels
   - Replace coin balance `text-sm` → `text-[18px]`
   - Replace day counter → `text-[18px]`

2. **HUD.tsx — mobile lease/tax always-visible** (FR-001):
   - Remove `hidden sm:flex` wrapper from lease/tax display
   - Render as compact sub-label beneath coin balance chip on all viewports
   - Format: `−15🪙/day · 5% tax`

3. **HUD.tsx — shop button prominence** (FR-016):
   - Increase shop button visual weight on mobile (larger padding, accent border, or badge)

4. **PlotCard.tsx — persistent touch affordance** (FR-005):
   - Add persistent `opacity-30` "+" or "🌱" indicator to empty plots at rest
   - Increase to `opacity-100` on `hover:` / `focus:`

**Acceptance test** (independent): Mobile viewport — all HUD text visible, lease cost shows without interaction, empty plots show indicator at rest.

---

### Phase 2 — High: Player Guidance & Feedback (P2)

**Stories**: US3 (low-balance warning), US4 (onboarding hint), US5 (planting mode visual)

**Deliverables**:

5. **constants.ts — warning thresholds** (FR-003, FR-004):
   - Add `LOW_BALANCE_WARNING_THRESHOLD = 45` (3 × LAND_LEASE_FEE)
   - Add `LOW_BALANCE_CRITICAL_THRESHOLD = 15` (1 × LAND_LEASE_FEE)

6. **HUD.tsx — low-balance warning** (FR-003, FR-004):
   - Import new constants
   - When `coinBalance ≤ LOW_BALANCE_WARNING_THRESHOLD`: coin chip shifts to amber (`text-farm-gold` → amber tone, add `⚠️` or warning icon)
   - When `coinBalance ≤ LOW_BALANCE_CRITICAL_THRESHOLD`: escalate to red + `animate-pulse` (suppressed by reduced-motion)

7. **GameBoard.tsx — onboarding hint** (FR-006, FR-007):
   - Derive `showOnboardingHint` from `state.currentDay === 1 && allPlotsEmpty && noSeedsInInventory`
   - Render hint banner: "🌱 Visit the Shop to buy seeds before advancing the day"
   - Automatically hides when first seed is planted (state re-evaluation)

8. **FarmGrid.tsx + GameBoard.tsx — planting mode border** (FR-008):
   - Accept `isPlantingMode: boolean` prop from `GameBoard` (derived from `selectedCrop !== null`)
   - Apply ring/border to FarmGrid container when `isPlantingMode` is true
   - Pass `isPlantingMode` down to each `PlotCard`

9. **PlotCard.tsx — planting mode plot highlight** (FR-008):
   - Accept `isPlantingMode: boolean` prop
   - On empty plots: apply invitation highlight (brighter border + background glow) when `isPlantingMode` is true

**Acceptance test** (independent for each): Balance 30 coins → amber warning shows. Day 1 fresh game → hint visible. Buy seed → grid border + plot highlights appear.

---

### Phase 3 — Medium: Drama & Accessibility (P3)

**Stories**: US6 (disaster drama), US7 (bankruptcy insight), US8 (reduced motion)

**Deliverables**:

10. **index.css — reduced-motion global block** (FR-011):
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    ```
    - Add `motion-reduce:transition-none` to shop bottom-sheet slide classes in `GameBoard.tsx`
    - Add `motion-reduce:animate-none` to any `animate-pulse` usage

11. **DailyLog.tsx — disaster headline** (FR-009):
    - Derive `isDisaster` from `weatherId` in `['blight', 'pest_infestation', 'flash_drought']`
    - When `isDisaster`: render prominent `<h2>`-style disaster title before line items (e.g., "⚠️ Pest Infestation!" in `text-farm-red font-pixel text-[14px]`)

12. **DaySummaryModal.tsx — disaster tinted background** (FR-009):
    - Pass `isDisaster` derived boolean to modal container
    - When `isDisaster`: apply `bg-farm-red/10` overlay to modal background

13. **App.tsx + BankruptcyScreen.tsx — run insight** (FR-010):
    - Thread `lastLog={state.lastDailyLog}` prop through `App.tsx` to `BankruptcyScreen`
    - In `BankruptcyScreen`: compute insight string from priority rule set (see `research.md` Decision 9)
    - Render insight beneath existing stats

**Acceptance test** (independent): Enable OS reduced-motion → no transitions. Trigger pest disaster → modal has red tint + headline. Trigger bankruptcy → insight shows.

---

### Phase 4 — Polish: Visual Consistency Bundle (P4)

**Story**: US9 (visual polish & consistency)

**Deliverables**:

14. **FarmGrid.tsx — sm breakpoint fix** (FR-012):
    - Change `grid-cols-4` to `grid-cols-4 sm:grid-cols-6` (6 columns from 640px up)

15. **UpgradeCard.tsx — owned tier contrast** (FR-013):
    - Change `text-farm-ink` on owned-tier card to `text-farm-parchment` for legibility on dark sidebar

16. **GameBoard.tsx — autosave indicator** (FR-014):
    - Add `lastSavedAt` state (number | null), updated in all action callbacks
    - `useEffect` watching `lastSavedAt`: sets `showSaveConfirm = true`, clears after 2 seconds
    - Render "Saved ✓" chip in HUD area — no fade transition when reduced-motion is enabled

17. **GameBoard.tsx — Flash Drought banner weight** (FR-015):
    - Change Flash Drought alert from `text-xs` to `text-[14px]`
    - Increase background opacity from `/10` to `/20`
    - Add warning icon to left of text

**Acceptance test** (independent): Tablet landscape (640px) → 6-column grid. Owned upgrade cards → parchment text. Advance day → "Saved ✓" appears/disappears. Flash Drought active → banner clearly distinct.

---

## Complexity Tracking

*No constitution violations requiring justification.*
