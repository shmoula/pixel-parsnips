# Research: UI Polish & Accessibility

**Feature**: 005-ui-polish  
**Date**: 2026-04-09  
**Status**: Complete — no NEEDS CLARIFICATION items remain

---

## Decision 1: Minimum font size for Press Start 2P

**Decision**: 14px minimum for all HUD and control text; 18–20px for coin balance and day counter.

**Rationale**: Press Start 2P is a bitmap font with no anti-aliasing and a taller x-height than typical sans-serif fonts. At the same point size it renders ~30% smaller visually. The current `text-[9px]` / `text-[10px]` usage falls below the 3mm physical minimum on most screens. Tailwind arbitrary values `text-[14px]` and `text-[18px]` are the correct replacements; there is no standard Tailwind step between `text-sm` (14px) and `text-base` (16px) so arbitrary values are appropriate here.

**Alternatives considered**:
- Use `text-sm` (14px) for everything — too coarse; coin balance needs more emphasis.
- Scale up to `text-base`/`text-lg` — too large for the compact pixel-art HUD aesthetic.

---

## Decision 2: Mobile lease/tax visibility

**Decision**: Remove the `hidden sm:flex` wrapper from the lease/tax display. Render it as a compact sub-label beneath the coin balance on all viewports.

**Rationale**: The current `hidden sm:flex` hides the two most consequential numbers on mobile. Moving them beneath the coin chip (e.g., `💰 100 | −15/day`) keeps them always visible without requiring HUD layout restructuring. No new Tailwind breakpoint needed.

**Alternatives considered**:
- Keep `hidden sm:flex` and add a tooltip — tooltips are not accessible on touch devices.
- Show in a separate info button/popover — adds tap friction for critical information.

---

## Decision 3: Empty plot touch affordance

**Decision**: Add a persistent low-opacity "+" or tap indicator to empty plots at rest (always visible, not hover-gated). Increase opacity on hover/focus.

**Rationale**: The existing `opacity-0 group-hover:opacity-100` pattern makes the affordance invisible on touch. A persistent `opacity-30` base with `hover:opacity-100` is a standard pattern for secondary UI affordance — visible enough to communicate interactivity without cluttering the pixel art aesthetic.

**Alternatives considered**:
- Inner glow on empty plots — achievable with `ring` or `shadow-inner`, but adds visual noise to non-interactive state.
- Seed packet icon always visible — cleaner but may confuse with actual planted state.

---

## Decision 4: Reduced-motion implementation

**Decision**: Add a `@media (prefers-reduced-motion: reduce)` block to `src/index.css` that disables all transitions and transforms. Supplement with Tailwind `motion-reduce:` prefix on individual animated elements.

**Rationale**: The game uses `transition-all`, `active:scale-95`, `transition-transform duration-300` (shop sheet), and SVG stroke animation. All of these must be suppressible. The CSS global block handles third-party and non-Tailwind animations; the `motion-reduce:` prefix handles Tailwind-generated classes. This two-layer approach ensures complete coverage without touching each component's class list.

**Alternatives considered**:
- `window.matchMedia()` hook — more granular but adds React state complexity for what is a pure CSS concern.
- Tailwind `motion-reduce:` only — doesn't cover the SVG stroke animation in `ProgressRing` or inline style transitions.

---

## Decision 5: Low-balance warning thresholds

**Decision**: Warning threshold = 3 × `LAND_LEASE_FEE` = 45 coins. Critical threshold = 1 × `LAND_LEASE_FEE` = 15 coins (matches existing bankruptcy check).

**Rationale**: Tax (5% of harvest income) is variable and not predictable per turn. Using only the fixed lease fee as the basis keeps the threshold simple and consistent with the existing bankruptcy check in `gameEngine.ts`. At 45 coins the player has ~3 turns of "empty day" margin; at 15 they are one turn from bankruptcy. Both thresholds should be defined as named constants in `src/engine/constants.ts` for testability.

**Alternatives considered**:
- Include average tax in threshold — introduces variable math that changes based on crop mix, making the threshold feel inconsistent.
- Single threshold only — misses the two-tier drama (amber → red escalation) specified in FR-003/FR-004.

---

## Decision 6: Onboarding hint

**Decision**: A single-line hint rendered inside `GameBoard.tsx` beneath the HUD, visible only when `currentDay === 1 && noSeedsPlanted && noCropsGrowing`. Dismissed (component unmounts) when the player plants their first seed.

**Rationale**: The "first-run" state is fully derivable from existing `GameState` fields: `currentDay`, `seedInventory` (all zero), and `plots` (all empty). No new state field needed. The hint must be a non-blocking, dismissible banner — not a modal — to avoid interrupting the game flow.

**Alternatives considered**:
- Modal tutorial — too disruptive for a casual game; conflicts with Principle IV (YAGNI).
- Tooltip on "Next Day" button — not visible until the player hovers, making it ineffective on touch.
- Persistent throughout Day 1 even after shop visit — misleading if player has bought seeds but not planted.

---

## Decision 7: Planting mode visual

**Decision**: Two-layer highlight: (1) a pulsing border/ring on the `FarmGrid` container element, (2) a bright invitation highlight on each individual empty plot. Both layers activate together when `selectedCrop !== null`. The grid-level border signal is implemented via a conditional CSS class on the `FarmGrid` wrapper; the plot-level highlight is implemented inside `PlotCard`.

**Rationale**: The `selectedCrop` state already lives in `GameBoard`. It is passed down to `FarmGrid` as a prop, which then passes `isPlantingMode` to each `PlotCard`. This keeps the state ownership in `GameBoard` (no changes to `useGameEngine`) while enabling both visual layers. The `FarmGrid` border uses the existing `ring` Tailwind utility.

**Alternatives considered**:
- Grid border only — not enough granularity for plots with mixed states (some occupied, some empty).
- Plot highlight only — players may not notice planting mode is active if looking at the HUD.

---

## Decision 8: Disaster event drama

**Decision**: When `lastDailyLog` contains a disaster weather event (`weatherId` in `['blight', 'pest_infestation', 'flash_drought']`), `DaySummaryModal` applies a red-tinted background overlay and `DailyLog` renders a large headline-style event title before the line items.

**Rationale**: The modal already has conditional content logic (quiet day detection). Adding a `isDisaster` derived boolean is minimal change. The `DailyLog` component already uses `farm-red` styling on disaster-related rows; promoting the weather badge to a full headline is a CSS/layout change only.

**Alternatives considered**:
- Animated disaster reveal (e.g., shake effect) — violates reduced-motion requirement; also not in spec.
- Separate disaster modal component — over-engineering; `DaySummaryModal` already handles the portal/overlay pattern (Principle IV).

---

## Decision 9: Bankruptcy post-mortem insight

**Decision**: Derive the insight from `BankruptcyScreen` props (`daysPlayed`, `peakBalance`) and a new `lastLog` prop (the final `DailyLogEntry`). Compute the insight client-side using a simple priority-ordered rule set.

**Insight rules (priority order)**:
1. If `lastLog.pestDestroyedPlots.length > 0` → "Pests destroyed your final crops. Harvest early when pest risk is high."
2. If `lastLog.weatherId === 'flash_drought'` → "A flash drought ended your run. Avoid planting during drought events."
3. If `daysPlayed ≤ 5` → "Your run was very short. Try buying seeds before advancing the day."
4. If `peakBalance < 50` → "Balance never recovered. Focus on fast Radishes early to build a buffer."
5. Default → "Try diversifying between fast Radishes and higher-yield Pumpkins."

**Rationale**: All required data is already passed to `BankruptcyScreen` or available via the `lastDailyLog` field. No new state fields needed. The rule set maps directly to the observable failure patterns in the spec. The assumption is validated: insights are derivable from existing state without new data structures.

**Alternatives considered**:
- ML/analytics-based insight — massively over-engineered for a local single-player game.
- Storing full run history — unnecessary; the spec says insights are from the most recent run only.

---

## Decision 10: Autosave indicator

**Decision**: A new `SaveIndicator` component (or inline JSX in `GameBoard`) that tracks a `savedAt` timestamp. When the timestamp changes, it shows "Saved ✓" for 2 seconds. With reduced-motion, it appears instantly and disappears after 2 seconds without any fade transition.

**Rationale**: The significant actions are already defined: nextDay, plantSeed, buySeed, buyUpgrade. `GameBoard` already has callbacks for all of these. A `useEffect` watching a `savedAt` state value handles the 2-second visibility window. No changes to `useGameEngine` or storage logic needed.

**Alternatives considered**:
- Integrated into HUD — requires passing save state through props; easier to keep in `GameBoard` near the action callbacks.
- Permanent "last saved" timestamp — more complex, spec only requires a brief confirmation.

---

## No New Dependencies Required

All changes use existing Tailwind CSS 3.4, React 18, and TypeScript capabilities. No new packages needed.

---

## Files to Modify (by feature area)

| Area | File(s) |
|------|---------|
| Font sizes + mobile visibility | `HUD.tsx` |
| Low-balance warning | `HUD.tsx`, `constants.ts` |
| Empty plot affordance | `PlotCard.tsx` |
| Planting mode visual | `GameBoard.tsx`, `FarmGrid.tsx`, `PlotCard.tsx` |
| Onboarding hint | `GameBoard.tsx` |
| Disaster drama | `DailyLog.tsx`, `DaySummaryModal.tsx` |
| Bankruptcy insight | `BankruptcyScreen.tsx`, `App.tsx` (to pass lastLog prop) |
| Reduced motion | `src/index.css`, all animated components |
| Autosave indicator | `GameBoard.tsx` |
| Grid breakpoint | `FarmGrid.tsx` |
| Upgrade contrast | `UpgradeCard.tsx` |
| Flash Drought banner | `GameBoard.tsx` |
| Shop button prominence | `HUD.tsx` |
