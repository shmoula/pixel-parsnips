# Feature Specification: UI Polish & Accessibility

**Feature Branch**: `005-ui-polish`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "I'd like to do a UI polishments as a new feature. Please use the UI.md as a specification input."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Critical Readability & Mobile Visibility (Priority: P1)

A player opens the game on any device and can immediately read all critical information: current coin balance, daily costs (land lease, tax), and the current day number. Nothing important is hidden or illegibly small.

**Why this priority**: These are the highest-severity issues. Players can lose the game without ever seeing the numbers that caused their bankruptcy. Unreadable or hidden financial information breaks the core game loop on day one.

**Independent Test**: Open the game on a mobile phone without resizing. All coin balance, lease cost, and tax information must be visible and readable at rest — no interaction needed.

**Acceptance Scenarios**:

1. **Given** a player on a mobile device, **When** the game loads, **Then** the land lease cost and tax rate are visible without scrolling or tapping
2. **Given** a player viewing the HUD, **When** looking at any label (coin balance, day counter, lease, tax), **Then** all text is large enough to read comfortably without zooming
3. **Given** a player on a small screen, **When** the game is at its default state, **Then** the coin balance is the most visually prominent number on the screen

---

### User Story 2 - Empty Plot Touch Affordance (Priority: P1)

A first-time player on a mobile device sees the farm grid and immediately understands that the plots are tappable and that tapping them does something useful.

**Why this priority**: Without visible affordance, mobile players have no way to discover that plots are interactive. This is a critical onboarding failure that makes the core mechanic invisible.

**Independent Test**: Show the game to a new user on a touch device without explanation. They should tap a plot within 30 seconds without being told.

**Acceptance Scenarios**:

1. **Given** a player viewing empty farm plots, **When** the game is in its default idle state, **Then** each empty plot shows a persistent visual cue indicating it can be interacted with
2. **Given** a player on a touch device, **When** they view empty plots, **Then** they can identify them as interactive without needing to hover or tap first
3. **Given** a player in planting mode (seed selected), **When** viewing the farm, **Then** empty plots visually invite interaction more strongly than when no seed is selected

---

### User Story 3 - Low-Balance Danger Warning (Priority: P2)

A player whose coin balance is dangerously low receives a clear visual warning before they lose the game, giving them a chance to react.

**Why this priority**: The game's bankruptcy condition is silent and sudden. Players currently have no warning they are approaching game over, which feels unfair rather than challenging.

**Independent Test**: Reduce coin balance to under 50 coins in the game state and observe the HUD. A warning state should be clearly visible without any action.

**Acceptance Scenarios**:

1. **Given** a player with a low coin balance (below a defined warning threshold), **When** viewing the HUD, **Then** the coin display shows a visually distinct warning state (color change, icon, or animation)
2. **Given** a player critically close to bankruptcy, **When** viewing the HUD, **Then** the warning state is more intense than a moderate warning (e.g., pulsing or a stronger color)
3. **Given** a player whose balance recovers above the warning threshold, **When** viewing the HUD, **Then** the warning state disappears

---

### User Story 4 - First-Run Onboarding Hint (Priority: P2)

A brand-new player on Day 1 with an empty farm understands what they should do first, and is warned that advancing the day without planting seeds will cost them coins.

**Why this priority**: Players who don't know to buy seeds before clicking "Next Day" can trigger a bankruptcy spiral in their first 5 clicks. One contextual hint prevents this without needing a full tutorial.

**Independent Test**: Start a fresh game (reset state) and observe Day 1 with no seeds planted. A hint directing the player toward the shop must be visible.

**Acceptance Scenarios**:

1. **Given** a player on Day 1 with no seeds in inventory, **When** viewing the game, **Then** a hint message is visible directing them to visit the shop
2. **Given** a player on Day 1 who has not yet planted anything, **When** they attempt to advance the day, **Then** a contextual prompt reminds them that advancing costs coins
3. **Given** a player who has visited the shop and planted seeds, **When** viewing the game, **Then** the Day 1 onboarding hint is no longer shown

---

### User Story 5 - Buy-to-Plant State Clarity (Priority: P2)

After a player buys a seed, they know immediately that they are now in "planting mode" and need to click an empty plot to complete the action.

**Why this priority**: The two-step buy→plant flow has an invisible state transition that leaves players uncertain what to do after purchasing. The existing status banner is easy to miss.

**Independent Test**: Buy a seed and observe the game state. Without reading any text, it should be visually obvious that something has changed and the farm grid is now interactive.

**Acceptance Scenarios**:

1. **Given** a player who has just purchased a seed, **When** viewing the game, **Then** the farm grid container shows a visible border or glow and each empty plot shows an individual highlight
2. **Given** a player in planting mode, **When** looking at the farm grid, **Then** both the grid-level border and the per-plot highlights are simultaneously visible
3. **Given** a player who cancels planting mode (without clicking a plot), **When** viewing the game, **Then** the farm returns to its normal visual state

---

### User Story 6 - Disaster Event Drama (Priority: P3)

When a disaster event (blight, pest infestation, flash drought) is revealed in the Day Summary, the player feels the impact emotionally — the visual presentation matches the severity of the loss.

**Why this priority**: Disasters are the game's most dramatic moments. Presenting them identically to calm days misses the emotional hook that drives "one more try" motivation.

**Independent Test**: Trigger a disaster event and observe the Day Summary modal. The visual difference from a normal day should be immediately apparent.

**Acceptance Scenarios**:

1. **Given** a player viewing the Day Summary after a disaster, **When** the modal appears, **Then** the presentation is visually distinct from a normal day summary (color, layout, or emphasis)
2. **Given** a player who lost crops to a disaster, **When** reading the summary, **Then** the disaster headline is prominently displayed before the line-item crop details

---

### User Story 7 - Bankruptcy Post-Mortem Insight (Priority: P3)

When a player reaches the bankruptcy screen, they receive one piece of actionable context about what went wrong in their run, giving them a concrete thing to try differently next time.

**Why this priority**: The re-engagement loop ("one more try") depends on players feeling like they learned something. A generic bankruptcy screen with no insight reduces the chance of a replay.

**Independent Test**: Trigger bankruptcy and observe the screen. A data-driven suggestion or insight specific to the run should appear below the stats.

**Acceptance Scenarios**:

1. **Given** a player who has reached bankruptcy, **When** viewing the bankruptcy screen, **Then** one contextual insight is displayed alongside the end-of-run stats
2. **Given** different causes of bankruptcy (e.g., many empty days vs. disaster), **When** viewing the bankruptcy screen, **Then** the insight reflects the player's actual run pattern

---

### User Story 8 - Accessibility: Reduced Motion (Priority: P3)

A player who has enabled the operating system's reduced-motion accessibility setting experiences the game without distracting or potentially harmful animations.

**Why this priority**: This is a baseline accessibility requirement for any game using animations. Players with vestibular disorders may experience discomfort otherwise.

**Independent Test**: Enable "Reduce Motion" in the OS accessibility settings and load the game. No transitions or transform animations should play.

**Acceptance Scenarios**:

1. **Given** a player with reduced-motion preference enabled, **When** interacting with the game, **Then** slide-in panels and scaling animations do not play
2. **Given** a player with reduced-motion preference enabled, **When** viewing the farm, **Then** hover/active transform effects are suppressed

---

### User Story 9 - Visual Polish & Consistency (Priority: P4)

A player experiences a visually consistent, polished game at all screen sizes, with readable text, appropriate layout, and visible save confirmation.

**Why this priority**: This story bundles medium-severity issues that individually have less impact but together contribute to a professional, trustworthy game feel.

**Independent Test**: Review the game at 4 viewport sizes (mobile, tablet landscape, small desktop, full desktop) and check for layout gaps, contrast issues, and missing feedback.

**Acceptance Scenarios**:

1. **Given** a player on a tablet in landscape orientation, **When** viewing the farm grid, **Then** the layout uses available horizontal space without unusual gaps or stretching
2. **Given** a player viewing owned upgrade cards, **When** reading the card text, **Then** the text is legible against the dark sidebar background
3. **Given** a player who takes a significant action (plants, purchases, advances day), **When** the action completes, **Then** a brief save confirmation appears and fades
4. **Given** a player on any device, **When** a Flash Drought warning is active, **Then** the warning banner is visually prominent and clearly distinguishable from other status messages
5. **Given** a player on mobile, **When** the Shop button is visible in the HUD, **Then** it has greater visual prominence than secondary HUD controls

---

### Edge Cases

- What happens when a player's balance drops to exactly the warning threshold during an animation?
- How does the onboarding hint behave if a player reloads mid-Day-1 after already visiting the shop?
- When reduced-motion is enabled, the animated save confirmation is replaced by a static "Saved ✓" label visible for 2 seconds (no fade or transition)
- How does the disaster summary look when multiple disaster types occur in the same day?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST display all critical financial information (coin balance, daily lease cost, tax rate) visibly on all screen sizes without requiring any interaction
- **FR-002**: All text in the HUD and game controls MUST meet a minimum readable size for the pixel font in use
- **FR-003**: The coin balance MUST display a warning state when the player's balance falls below 3× the land lease fee (tax excluded — tax is variable and not predictable per turn)
- **FR-004**: The coin balance MUST display a critical-danger state when the player's balance falls below 1× the land lease fee (the point at which one more turn triggers bankruptcy)
- **FR-005**: Empty farm plots MUST show a persistent visual indicator that communicates their interactivity on touch devices without requiring hover
- **FR-006**: The game MUST display a contextual onboarding hint to players on their first day with no seeds planted
- **FR-007**: The onboarding hint MUST disappear once the player successfully plants their first seed in a plot
- **FR-008**: When a player enters planting mode (seed selected), the farm grid MUST show both a border/glow around the entire farm grid container AND individual highlight states on each empty plot
- **FR-009**: The Day Summary modal MUST present disaster events with a visually distinct treatment that reflects the severity of the loss
- **FR-010**: The bankruptcy screen MUST display one run-specific contextual insight based on observable player behavior during the run
- **FR-011**: The game MUST respect the operating system's reduced-motion accessibility setting by suppressing or replacing transform-based animations
- **FR-012**: The farm grid layout MUST use appropriate column count at all common viewport widths including the tablet landscape range
- **FR-013**: Owned upgrade card text MUST maintain sufficient contrast against the sidebar background to be readable
- **FR-014**: The game MUST show a brief visual confirmation after significant player actions that trigger an autosave; when reduced-motion is enabled, this MUST be a static "Saved ✓" label visible for 2 seconds with no animation
- **FR-015**: The Flash Drought warning banner MUST be visually distinct and more prominent than standard status messages
- **FR-016**: The Shop button on mobile MUST have greater visual weight than secondary HUD controls

### Key Entities

- **Warning Threshold**: 3× LAND_LEASE_FEE (= 45 coins); the balance level below which the low-balance warning state activates (tax excluded — it is variable and harvest-dependent)
- **Critical Threshold**: 1× LAND_LEASE_FEE (= 15 coins); the balance level below which the danger state escalates to its most urgent form (matches the existing bankruptcy check)
- **Planting Mode State**: A game state flag indicating a seed has been purchased and the player must click a plot to complete the action
- **Run Behavior Summary**: Observable metrics from the final turn of a game run used to generate the bankruptcy insight: last turn's pest-destroyed plots, last turn's weather event, total days played, and peak balance reached

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player on mobile completes the core loop (buy seed → plant → advance day) within their first 3 minutes without external instructions
- **SC-002**: 100% of critical financial information (lease cost, tax rate, coin balance) is visible on a mobile viewport without any user interaction
- **SC-003**: Players whose balance drops below 3× daily total cost receive a visible warning in the HUD; players below 1× daily total cost receive an escalated danger signal
- **SC-004**: The Day Summary modal for disaster events is visually distinguishable from a normal day summary within 1 second of opening
- **SC-005**: Players with OS reduced-motion enabled experience zero transform-based animations during normal gameplay
- **SC-006**: The farm grid displays without layout gaps at viewport widths from 320px to 1440px
- **SC-007**: All HUD text is readable on mobile without zooming
- **SC-008**: Players who reach bankruptcy see a contextual insight on the bankruptcy screen that references something specific to their run

## Clarifications

### Session 2026-04-09

- Q: What specific player action dismisses the Day 1 onboarding hint? → A: First seed successfully planted in a plot
- Q: How should the low-balance warning threshold be defined? → A: Dynamic — warn at 3× daily total cost, critical at 1× daily total cost
- Q: What replaces the animated save confirmation when reduced-motion is enabled? → A: Static "Saved ✓" label appears for 2 seconds then disappears (no animation)
- Q: When planting mode is active, what is the visual scope of the highlight? → A: Whole-farm grid border/glow + individual empty plot highlights

## Assumptions

- The bankruptcy threshold (15 coins) is already defined in game constants and can be referenced without changing game logic
- "Significant actions" for autosave confirmation are: advancing the day, purchasing a seed, purchasing an upgrade, and planting a seed
- The "first-run" state can be determined from existing game state (Day 1 + empty inventory + no crops planted)
- Run behavior metrics for the bankruptcy insight are derivable from the existing game state or game log without adding new data structures
- The disaster insight on the bankruptcy screen is generated from the most recent run only
- The onboarding hint is a one-time contextual message, not a full tutorial system
