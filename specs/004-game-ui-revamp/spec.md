# Feature Specification: Game UI Visual Revamp

**Feature Branch**: `004-game-ui-revamp`
**Created**: 2026-03-19
**Status**: Draft

## Overview

Transform the current form-based farming game interface into an immersive, visually-driven game experience. Players should respond to visual cues and resource states rather than reading text descriptions. The revamp covers the farm canvas, individual plots, the HUD, the shop sidebar, and responsive layout for mobile screens.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Responsive Layout on Mobile (Priority: P1)

A player opens the game on a smartphone. All game elements — the farm grid, HUD, and shop — are visible and usable without horizontal scrolling or overlapping content.

**Why this priority**: Without responsive layout, mobile players cannot interact with the game at all. All other improvements are worthless if the screen is broken on small devices.

**Independent Test**: Open the game on a 375×667 px viewport. Verify the farm grid, HUD bar, and shop panel are all reachable and interactive.

**Acceptance Scenarios**:

1. **Given** a 375 px wide viewport, **When** the game loads, **Then** the farm grid fills the screen and the shop is accessible via a bottom sheet that slides up from the bottom edge.
2. **Given** a mobile viewport, **When** the player taps a plot or shop button, **Then** the touch targets are at least 44×44 px and respond correctly.
3. **Given** any viewport width from 320 px to 1440 px, **When** the game is displayed, **Then** no content is clipped or requires horizontal scrolling.
4. **Given** a wide desktop viewport, **When** the game loads, **Then** the shop panel appears as a sidebar alongside the farm grid (existing layout preserved).

---

### User Story 2 - Structured HUD with Next Day Button (Priority: P1)

A player glances at the top bar to check their day count and coin balance, then presses "Next Day" from the HUD to advance the turn without scrolling to the bottom of the page.

**Why this priority**: The buried Next Day button makes the core game loop nearly unusable; surfacing it to the HUD unblocks every other interaction.

**Independent Test**: With any game state loaded, confirm the HUD shows Day, Balance, Lease, Tax, and a Next Day button — all visible without scrolling.

**Acceptance Scenarios**:

1. **Given** any game state, **When** the player looks at the top bar, **Then** they see a Player Status group (Sun icon + Day number, Coin icon + Balance) on the left and a Costs group (Lease, Tax) on the right.
2. **Given** the HUD is visible, **When** the player clicks "Next Day," **Then** the turn engine processes immediately, the game state updates, and a Day Summary modal appears showing the results of that just-completed turn.
3. **Given** the Day Summary modal is open, **When** the player closes it, **Then** the game returns to the normal playing state.
4. **Given** the HUD, **When** the player clicks a "Last Turn" button, **Then** the Day Summary modal reopens for the most recently completed turn.

---

### User Story 3 - Visual Plot States and Growth Stages (Priority: P2)

A player scans the farm grid and immediately identifies which plots are empty, growing, ready to harvest, or exhausted — without reading any text labels.

**Why this priority**: This is the core "game-based vs form-based" improvement. Visual differentiation of plot states enables fast, reactive gameplay.

**Independent Test**: Seed one plot, advance days, and verify the plot transitions through sprout → small plant → full vegetable → harvestable states purely via visual changes.

**Acceptance Scenarios**:

1. **Given** an empty plot, **When** the player views the farm, **Then** the plot displays as dark tilled soil with a "Plant here" CTA indicator on hover/focus.
2. **Given** a plot that was just planted, **When** day 1 is active, **Then** the plot shows a sprout icon.
3. **Given** a growing plot on day 2, **When** the player views it, **Then** a small plant icon is displayed.
4. **Given** a crop ready for harvest, **When** the player views the plot, **Then** the full vegetable icon is shown with a green highlight.
5. **Given** an exhausted plot, **When** the player views it, **Then** the plot appears cracked and grayed out (dead earth look) with a red/muted color treatment.
6. **Given** any plot with a growing crop, **When** the player views it, **Then** a circular progress ring (not a text badge) surrounds the plant icon showing days remaining.

---

### User Story 4 - Shop Sidebar Improvements (Priority: P2)

A player opens the shop, clearly sees which items they can afford, selects a seed (with a visible active selection state), and buys it. Owned tools are visually separated so they do not clutter the purchase list.

**Why this priority**: The shop is the primary decision-making surface; improving clarity directly reduces errors and improves game flow.

**Independent Test**: Open the shop with an owned tool and multiple seeds. Verify owned tools appear in a separate "Active Buffs" tray, and buying a seed shows the pressed-button feedback.

**Acceptance Scenarios**:

1. **Given** the shop is open, **When** a player selects a seed, **Then** that seed card shows a high-contrast active border (bright gold or neon green) that persists until another seed is selected or selection is cancelled.
2. **Given** a seed card, **When** the player views the shop, **Then** the Net Profit (Yield minus Cost) is displayed prominently next to the price.
3. **Given** a player clicks the BUY button, **When** the purchase is successful, **Then** the button shows a tactile "pressed" visual effect and the balance updates.
4. **Given** a player already owns a tool (e.g., Rusty Trowel), **When** they view the shop, **Then** that tool is shown in a separate "Active Buffs" tray and not in the main purchase list.
5. **Given** a player cannot afford an item, **When** they view the shop, **Then** the item is visually dimmed or disabled.

---

### User Story 5 - Environmental and Aesthetic Polish (Priority: P3)

A player experiences the farm as a grounded, atmospheric place with textured backgrounds, environmental decorations, and consistent color language.

**Why this priority**: This is polish that improves feel without changing mechanics. Valuable but not blocking gameplay.

**Independent Test**: Load the game and visually verify the farm canvas has a non-flat background, plots have depth (shadow/inset), and at least one decorative non-interactive element is present.

**Acceptance Scenarios**:

1. **Given** the game canvas, **When** the player views it, **Then** the background uses a grass, dirt, or grain texture instead of a flat color.
2. **Given** each plot cell, **When** the player views it, **Then** plots have a raised or sunken appearance (soft shadows) rather than flat dashed borders.
3. **Given** the farm grid area, **When** the player views it, **Then** at least one non-interactive decorative element (pebble, grass tuft, or fence border) is visible.
4. **Given** any plot or UI element, **When** the color state is amber, **Then** it indicates an in-progress/growing state; green indicates ready/actionable; red or muted indicates blocked or exhausted.
5. **Given** the coin/balance display, **When** the player views the HUD, **Then** the coin icon is large enough to be legible at a glance and uses a gold/silver gradient treatment.
6. **Given** the shop sidebar, **When** the player views it, **Then** the sidebar has a visually distinct (e.g., darker wood-textured) background that differentiates it from the game world.

---

### Edge Cases

- What happens when the screen is rotated from portrait to landscape on mobile — do the grid and shop rearrange gracefully?
- How does the circular progress ring render when a crop has only 1 day remaining versus the maximum growth period?
- The "Active Buffs" tray is hidden entirely when no tools are owned (see FR-013).
- What if the Day Summary modal has no events to report (e.g., no crops matured, no income) — is a meaningful empty state shown?
- How does the active seed selection state reset if the player runs out of coins mid-session?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The layout MUST be fully responsive, supporting all viewport widths from 320 px to 1440 px without horizontal overflow. On narrow viewports (below ~768 px) the shop panel MUST appear as a bottom sheet that slides up from the bottom edge, keeping the farm grid fully visible. On wider viewports the shop panel MUST appear as a sidebar alongside the grid.
- **FR-002**: The top bar MUST display a Player Status group (Day with sun icon, Balance with coin icon) on the left and a Costs group (Lease, Tax) on the right.
- **FR-003**: The "Next Day" button MUST be located in the HUD bar and visible without scrolling.
- **FR-004**: Clicking "Next Day" MUST immediately process the turn, then display a Day Summary modal showing the results of that completed turn. The game state updates before the modal appears; the player dismisses the modal to return to the updated farm.
- **FR-005**: A "Last Turn" button or equivalent MUST be available in the HUD to reopen the most recent Day Summary modal.
- **FR-006**: Empty plots MUST display a "Plant here" call-to-action indicator on hover or focus.
- **FR-007**: Growing crops MUST display three visual growth stages: sprout (first third of growth duration), small plant (middle third), full vegetable (final third / ready to harvest). For crops with fewer than 3 days total growth, stages collapse: a 1-day crop shows the full vegetable immediately; a 2-day crop shows sprout on day 1 and full vegetable on day 2.
- **FR-008**: Crop progress MUST be represented by a circular progress ring around the plant icon, replacing text-only day-count badges.
- **FR-009**: Exhausted plots MUST use a cracked or dead-earth visual style with red/muted color treatment to signal the need for fertilizer.
- **FR-010**: The currently selected seed in the shop MUST show a persistent high-contrast active border (bright gold or neon green) until selection is cancelled.
- **FR-011**: Each seed card in the shop MUST display the Net Profit (Yield minus Cost) alongside the purchase price.
- **FR-012**: The BUY button MUST provide a tactile pressed visual effect on click/tap.
- **FR-013**: Owned tools MUST be moved out of the main shop purchase list into a visually separate "Active Buffs" tray. The tray MUST be hidden entirely when the player owns no tools; it appears only once at least one tool is owned.
- **FR-014**: The game canvas background MUST use a textured appearance (grass, dirt, or grain) rather than a flat color.
- **FR-015**: Each plot MUST have a raised or sunken visual style using soft shadows, not flat dashed borders.
- **FR-016**: The farm grid area MUST include at least one non-interactive decorative element (e.g., pebbles, grass tufts, or fence border).
- **FR-017**: The color system MUST use amber for in-progress states, green for ready/actionable states, and red or muted tones for blocked/exhausted states consistently across all UI elements. Color-only differentiation is acceptable; no secondary non-color signal is required.
- **FR-018**: The coin/balance icon in the HUD MUST be noticeably larger than surrounding text (minimum `text-2xl`) and rendered in gold color so it reads as a reward signal. A gradient treatment is aspirational; if the emoji cannot receive CSS gradient styling, size and color are sufficient.
- **FR-019**: The shop sidebar MUST use a visually distinct background (e.g., darker wood texture) that separates it from the game world.
- **FR-020**: The static Day Summary box in its current position MUST be removed; summary information is shown only via the modal triggered by Next Day or the Last Turn button.

### Key Entities

- **Plot**: A single farm tile that can be empty (tilled), growing (with a crop at a specific growth stage), harvestable, or exhausted. Its visual appearance reflects its state.
- **Crop**: A plant growing in a plot, characterized by a growth stage (sprout/small/full), days remaining, and readiness to harvest.
- **HUD**: The persistent top-bar player interface showing Day, Balance, Costs, Next Day button, and Last Turn button.
- **Day Summary**: A modal record of events from a completed turn (income, expenses, crop progress, disasters).
- **Shop Item**: A purchasable seed or tool with price, yield, and net profit displayed. Tools may be in "owned" state, moving them to the Active Buffs tray.
- **Active Buffs Tray**: A visual area in the shop panel showing tools/upgrades the player already owns, separate from purchasable items.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player on a 375 px wide device can complete a full turn (plant a seed, advance the day, view summary) without horizontal scrolling or UI overlap.
- **SC-002**: A player can locate and press "Next Day" within 5 seconds of loading the game, without instructions.
- **SC-003**: A player can determine the state of every plot (empty, growing, harvestable, exhausted) by visual inspection alone in under 10 seconds.
- **SC-004**: A player can identify which shop items they own versus can buy without reading any text labels.
- **SC-005**: The Day Summary is surfaced immediately upon clicking "Next Day" — the player never misses end-of-turn results.
- **SC-006**: The active seed selection is unambiguous — players never accidentally plant the wrong seed due to unclear selection state.
- **SC-007**: The net profit calculation is visible on every seed card, enabling purchase decisions without mental arithmetic.

## Clarifications

### Session 2026-03-19

- Q: Does the urgency color system (amber/green/red) need a secondary non-color signal for accessibility? → A: Color-only is acceptable — this is a game, WCAG compliance is out of scope.
- Q: Does the turn engine run before or after the Day Summary modal is shown? → A: Turn processes immediately on click, then the modal shows results; player dismisses to continue.
- Q: How is the shop panel presented on narrow mobile screens? → A: Bottom sheet / slide-up drawer — farm grid stays fully visible, shop slides up from the bottom on demand.
- Q: What rule determines when a crop transitions between growth stages? → A: Equal thirds of total growth duration; stages collapse gracefully for crops shorter than 3 days.
- Q: How does the Active Buffs tray behave when the player owns no tools? → A: The tray is hidden entirely; it only appears once the player owns at least one tool.

## Assumptions

- The game's underlying logic (turn engine, crop growth math, exhaustion, disasters) is unchanged; this feature is a pure UI/visual layer revamp.
- CSS/styling changes to achieve textures and shadows do not require new build dependencies; pure CSS (e.g., gradients, box-shadow, filter) is sufficient for most effects.
- Growth stage thresholds use equal thirds of the total growth period (see FR-007); stages collapse for crops shorter than 3 days.
- "Decorative elements" (pebbles, grass tufts, fence) are implemented as CSS or inline SVG, not external image assets requiring new loading infrastructure.
- The "Last Turn" button stores only the most recently completed turn's summary, not full history.
- Touch targets of 44×44 px minimum are achievable within the current grid layout on all target screen sizes.
