# Feature Specification: UI Polish & Accessibility

**Feature Branch**: `005-ui-polish`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: User description: "Sub-selection of original 005-ui-polish: US3, US4, US5 (Plant text brightness only), US6, US7, US9 (except autosave)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Low-Balance Danger Warning (Priority: P1)

A player whose coin balance is dangerously low receives a clear visual warning before they lose the game, giving them a chance to react.

**Why this priority**: The game's bankruptcy condition is silent and sudden. Players currently have no warning they are approaching game over, which feels unfair rather than challenging.

**Independent Test**: Reduce coin balance to under 50 coins in the game state and observe the HUD. A warning state should be clearly visible without any action.

**Acceptance Scenarios**:

1. **Given** a player with a low coin balance (below a defined warning threshold), **When** viewing the HUD, **Then** the coin display shows a visually distinct warning state (color change, icon, or animation)
2. **Given** a player critically close to bankruptcy, **When** viewing the HUD, **Then** the warning state is more intense than a moderate warning (e.g., pulsing or a stronger color)
3. **Given** a player whose balance recovers above the warning threshold, **When** viewing the HUD, **Then** the warning state disappears

---

### User Story 2 - First-Run Onboarding Hint (Priority: P1)

A brand-new player on Day 1 with an empty farm understands what they should do first, and is warned that advancing the day without planting seeds will cost them coins.

**Why this priority**: Players who don't know to buy seeds before clicking "Next Day" can trigger a bankruptcy spiral in their first 5 clicks. One contextual hint prevents this without needing a full tutorial.

**Independent Test**: Start a fresh game (reset state) and observe Day 1 with no seeds planted. A hint directing the player toward the shop must be visible.

**Acceptance Scenarios**:

1. **Given** a player on Day 1 with no seeds in inventory, **When** viewing the game, **Then** a hint message is visible directing them to visit the shop
2. **Given** a player on Day 1 who has not yet planted anything, **When** they attempt to advance the day, **Then** a contextual prompt reminds them that advancing costs coins
3. **Given** a player who has visited the shop and planted seeds, **When** viewing the game, **Then** the Day 1 onboarding hint is no longer shown

---

### User Story 3 - Empty Plot Plant Text Brightness (Priority: P2)

A player viewing empty farm plots sees the 🌱 Plant label at full brightness, making it clearly readable and inviting without needing to be in any special mode.

**Why this priority**: If the Plant label on empty plots is dimmed or muted, players may not notice the call-to-action, reducing plot discoverability.

**Independent Test**: Load the game with empty plots and observe without taking any action. The 🌱 Plant text on each empty plot must appear at full visual brightness.

**Acceptance Scenarios**:

1. **Given** a player viewing the farm, **When** the game is in its default idle state, **Then** the 🌱 Plant text on each empty plot is displayed at full brightness (not dimmed or reduced opacity)
2. **Given** a player on any device, **When** viewing empty plots, **Then** the Plant label is legible without hovering or interacting

---

### User Story 4 - Disaster Event Drama (Priority: P2)

When a disaster event (blight, pest infestation, flash drought) is revealed in the Day Summary, the player feels the impact emotionally — the visual presentation matches the severity of the loss.

**Why this priority**: Disasters are the game's most dramatic moments. Presenting them identically to calm days misses the emotional hook that drives "one more try" motivation.

**Independent Test**: Trigger a disaster event and observe the Day Summary modal. The visual difference from a normal day should be immediately apparent.

**Acceptance Scenarios**:

1. **Given** a player viewing the Day Summary after a disaster, **When** the modal appears, **Then** the presentation is visually distinct from a normal day summary (color, layout, or emphasis)
2. **Given** a player who lost crops to a disaster, **When** reading the summary, **Then** the disaster headline is prominently displayed before the line-item crop details

---

### User Story 5 - Bankruptcy Post-Mortem Insight (Priority: P2)

When a player reaches the bankruptcy screen, they receive one piece of actionable context about what went wrong in their run, giving them a concrete thing to try differently next time.

**Why this priority**: The re-engagement loop ("one more try") depends on players feeling like they learned something. A generic bankruptcy screen with no insight reduces the chance of a replay.

**Independent Test**: Trigger bankruptcy and observe the screen. A data-driven suggestion or insight specific to the run should appear below the stats.

**Acceptance Scenarios**:

1. **Given** a player who has reached bankruptcy, **When** viewing the bankruptcy screen, **Then** one contextual insight is displayed alongside the end-of-run stats
2. **Given** different causes of bankruptcy (e.g., many empty days vs. disaster), **When** viewing the bankruptcy screen, **Then** the insight reflects the player's actual run pattern

---

### User Story 6 - Visual Polish & Consistency (Priority: P3)

A player experiences a visually consistent, polished game at all screen sizes, with readable text, appropriate layout, and prominent critical UI elements.

**Why this priority**: This story bundles medium-severity issues that individually have less impact but together contribute to a professional, trustworthy game feel.

**Independent Test**: Review the game at 4 viewport sizes (mobile, tablet landscape, small desktop, full desktop) and check for layout gaps, contrast issues, and UI prominence.

**Acceptance Scenarios**:

1. **Given** a player on a tablet in landscape orientation, **When** viewing the farm grid, **Then** the layout uses available horizontal space without unusual gaps or stretching
2. **Given** a player viewing owned upgrade cards, **When** reading the card text, **Then** the text is legible against the dark sidebar background
3. **Given** a player on any device, **When** a Flash Drought warning is active, **Then** the warning banner is visually prominent and clearly distinguishable from other status messages
4. **Given** a player on mobile, **When** the Shop button is visible in the HUD, **Then** it has greater visual prominence than secondary HUD controls

---

### Edge Cases

- What happens when a player's balance drops to exactly the warning threshold during an animation?
- How does the onboarding hint behave if a player reloads mid-Day-1 after already visiting the shop?
- How does the disaster summary look when multiple disaster types occur in the same day?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST display a warning state on the coin balance when the player's balance falls below 3× the land lease fee (tax excluded — tax is variable and not predictable per turn)
- **FR-002**: The game MUST display a critical-danger state on the coin balance when the player's balance falls below 1× the land lease fee (the point at which one more turn triggers bankruptcy)
- **FR-003**: The warning state MUST disappear when the player's balance recovers above the warning threshold
- **FR-004**: The game MUST display a contextual onboarding hint to players on their first day with no seeds planted
- **FR-005**: The onboarding hint MUST disappear once the player successfully plants their first seed in a plot
- **FR-006**: The 🌱 Plant text on empty farm plots MUST be displayed at full brightness at all times in the game's idle state
- **FR-007**: The Day Summary modal MUST present disaster events with a visually distinct treatment that reflects the severity of the loss
- **FR-008**: The bankruptcy screen MUST display one run-specific contextual insight based on observable player behavior during the run
- **FR-009**: The farm grid layout MUST use appropriate column count at all common viewport widths including the tablet landscape range
- **FR-010**: Owned upgrade card text MUST maintain sufficient contrast against the sidebar background to be readable
- **FR-011**: The Flash Drought warning banner MUST be visually distinct and more prominent than standard status messages
- **FR-012**: The Shop button on mobile MUST have greater visual weight than secondary HUD controls

### Key Entities

- **Warning Threshold**: 3× LAND_LEASE_FEE (= 45 coins); the balance level below which the low-balance warning state activates (tax excluded — it is variable and harvest-dependent)
- **Critical Threshold**: 1× LAND_LEASE_FEE (= 15 coins); the balance level below which the danger state escalates to its most urgent form (matches the existing bankruptcy check)
- **Run Behavior Summary**: Observable metrics from the final turn of a game run used to generate the bankruptcy insight: last turn's pest-destroyed plots, last turn's weather event, total days played, and peak balance reached

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players whose balance drops below 3× land lease fee receive a visible warning in the HUD; players below 1× land lease fee receive an escalated danger signal
- **SC-002**: A first-time player on Day 1 is shown a contextual hint directing them to the shop before advancing the day
- **SC-003**: The 🌱 Plant label on empty plots is fully bright and legible without any user interaction
- **SC-004**: The Day Summary modal for disaster events is visually distinguishable from a normal day summary within 1 second of opening
- **SC-005**: Players who reach bankruptcy see a contextual insight on the bankruptcy screen that references something specific to their run
- **SC-006**: The farm grid displays without layout gaps at viewport widths from 320px to 1440px

## Clarifications

### Session 2026-04-09

- Q: What specific player action dismisses the Day 1 onboarding hint? → A: First seed successfully planted in a plot
- Q: How should the low-balance warning threshold be defined? → A: Dynamic — warn at 3× land lease fee, critical at 1× land lease fee

### Session 2026-04-10

- Q: Which sub-set of 005-ui-polish to implement? → A: US3, US4, US5 (Plant text brightness only — no planting-mode border/glow), US6, US7, US9 (except autosave save confirmation)

## Assumptions

- The bankruptcy threshold (15 coins) is already defined in game constants and can be referenced without changing game logic
- The "first-run" state can be determined from existing game state (Day 1 + empty inventory + no crops planted)
- Run behavior metrics for the bankruptcy insight are derivable from the existing game state or game log without adding new data structures
- The disaster insight on the bankruptcy screen is generated from the most recent run only
- The onboarding hint is a one-time contextual message, not a full tutorial system
- Empty plot Plant text brightness is a CSS/style-only change requiring no logic changes
