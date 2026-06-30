# 015 — Mobile UX Polish

**Date:** 2026-06-28
**Status:** Design approved (pending spec review)
**Type:** Mobile/responsive UI fixes (no gameplay or economy changes)

## Goal

Fix a set of mobile-only layout and UX problems on the main game screen. Every
change is scoped to small screens — desktop (`md:` breakpoint and up) stays
visually unchanged.

## Background

Live analysis at 375×812 found the mobile experience functional but
desktop-first: tiny touch targets, primary actions stranded at the top of the
screen, an overflowing HUD chip row, and several smaller defects. The player
(project owner) independently reported an overlapping set of issues. This spec
merges both lists.

Confirmed root causes (measured against the running build):

- **Touch targets:** Next Day renders 27px tall, shop BUY buttons 24px, Shop/Last
  Turn ~28–30px — all well below the 44px minimum.
- **Thumb reach:** Next Day and Shop live in a 130px top header; the core loop
  requires reaching the top edge.
- **HUD overflow:** the inner chip group (`flex items-stretch gap-2`) has no
  wrap. The Streak chip only appears after the first harvest (i.e. once
  onboarding ends), pushing the row past 375px and off the right edge.
- **Uneven plot heights:** the "Buy plot" cell renders 82px while its row
  siblings are 74px — the buy-plot button overflows the `aspect-square` box.
- **White overscroll:** the background gradient is on `body`, but `html` has no
  background, so rubber-band overscroll flashes the browser's default white.
  `index.css` also uses `min-height: 100vh`.
- **Onboarding hint:** the `buy-radishes` bubble is measured once while the shop
  bottom sheet is still sliding up (anchor off-screen) and never re-measured, so
  the hint ("grab 4, one for each open plot") strands off-screen on mobile.

## Requirements

### 1. Sticky bottom action bar (mobile)

- Add a mobile-only action bar pinned to the bottom of `GameBoard`, containing
  `🌾 Shop` (left) and `Next Day →` (right, primary, roughly 1.4× the Shop
  width).
- Buttons are ≥44px tall; retain existing `active:scale-95` press feedback and
  the `Next Day` disabled/processing + "Plant seeds first" states.
- Bar background matches the HUD (`#0E0A04` with a top border). Apply
  `padding-bottom: env(safe-area-inset-bottom)` for notched devices.
- Remove these two controls from the HUD **on mobile only**: the bottom bar is
  `md:hidden`; the existing header buttons become `hidden md:flex` (or
  equivalent) so desktop keeps its current top-right layout untouched.
- `Last Turn` remains in the HUD (secondary control).
- Add bottom padding to the farm/main area equal to the bar height so the fixed
  bar never overlaps the last plot row or the shop sheet's reachable area.

### 2. HUD status row compaction (mobile)

- Add `flex-wrap` to the inner chip group as a safety net.
- Compact chips so the row fits one line on a 375px screen:
  - **Day chip:** short season label + day, e.g. `SPRING · D1/20`. Short label
    is the first word of the season name:
    Spring Thaw→`SPRING`, Summer Heat→`SUMMER`, Autumn Pressure→`AUTUMN`,
    Winter Crunch→`WINTER`, endless "Deep Winter"→`WINTER`.
    **Tapping the chip reveals the full season name** ("Spring Thaw").
  - **Balance chip:** keep `🪙 130/105`; drop the trailing word "target" on
    mobile (keep it on desktop).
  - **Streak chip:** `🔥×3` (already compact, unchanged).
  - **Reputation chip:** `🎖️` icon only on mobile; **tapping reveals the tier
    title** (e.g. "Struggling Smallholder").
- Desktop retains the full text labels for all chips.
- "Tap to reveal" for the season and reputation chips may be a simple toggle that
  shows the full text inline (or a small popover); the existing `title`/aria
  labels must be preserved for accessibility.

### 3. Equal plot-cell heights

- Constrain every `PlotCard` variant (empty / growing / ready / exhausted / pest
  / locked / buy-plot) to the same square footprint so all cells in a grid row
  are identical height.
- Fix the buy-plot overflow: keep its content within the `aspect-square` box
  (condensed/smaller button, `leading-none`, no text wrap) so it no longer grows
  the cell to 82px.

### 4. Background unification + dynamic viewport height

- Apply the background base color/gradient to `html` (in addition to `body`) so
  overscroll no longer reveals white. Unify the base tone to the dark game
  canvas color `#140E06` so overscroll blends with the board.
- Change `min-height: 100vh` → `100dvh` in `index.css`.

### 5. Onboarding buy-radishes hint placement

- Re-measure the onboarding anchor after the shop bottom sheet finishes its
  open animation (e.g. on `transitionend`, a short timeout, or a layout
  observer) so the `buy-radishes` hint bubble appears over the radish card on
  mobile instead of stranding off-screen.
- Desktop behavior (sidebar shop, no animation) must remain correct.

### 6. Touch targets ≥44px (mobile)

- Bring all remaining interactive mobile controls to ≥44px min-height via
  responsive padding that stays compact on desktop:
  shop BUY / Plant / Select buttons, Fertilizer buy, Upgrade buy, Last Turn,
  and the buy-plot button.

## Non-goals / Out of scope

- **Dead vertical space below the grid:** the bottom bar reclaims the lowest
  strip, but the empty band between the grid and the bar is **intentionally
  deferred** to a future spec (grid vertical-space rework / larger plots on tall
  phones). No grid resizing in this spec.
- No desktop layout changes.
- No gameplay, economy, balance, or persistence/schema changes.

## Testing & verification

- `npm test` and `npm run lint` pass.
- Manual verification in the mobile preview at 375×812:
  - Bottom bar buttons reachable and ≥44px; Shop and Next Day in the new order.
  - HUD fits one row with the streak chip active; no horizontal overflow; season
    and reputation chips reveal full text on tap.
  - All plot cells in a row are equal height across every plot state.
  - No white flash on overscroll; layout sized with `100dvh`.
  - Onboarding `buy-radishes` hint visible over the radish card after opening the
    shop sheet.
  - All listed controls measure ≥44px min-height on mobile; desktop unchanged.
