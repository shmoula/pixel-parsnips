# Feature Specification: Plot Exhaustion Maintenance

**Feature Branch**: `002-plot-exhaustion-maintenance`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "The original game wasn't challenging, so I'd like to add functionality which makes it harder for players - plot maintenance. Currently, plots are simply empty or occupied. The Change: After 3 consecutive harvests, a plot becomes 'Exhausted' and cannot be planted for 3 days unless the player buys a 'Fertilizer' in the shop."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plot Becomes Exhausted After Repeated Use (Priority: P1)

A player who has harvested from the same plot 3 times in a row finds that the plot is now marked as "Exhausted" and cannot be planted again immediately. The player must either wait 3 in-game days for the plot to recover naturally, or spend coins to buy Fertilizer from the shop to restore it right away.

**Why this priority**: This is the core mechanic of the entire feature. Without it, none of the other stories are meaningful. It directly increases difficulty and forces players to manage their land more thoughtfully.

**Independent Test**: Can be tested by planting and harvesting the same plot 3 consecutive times, then observing that the plot enters an Exhausted state and blocks further planting attempts.

**Acceptance Scenarios**:

1. **Given** a plot has been harvested 3 times consecutively, **When** the third harvest completes, **Then** the plot transitions to "Exhausted" state and its consecutive harvest counter resets to 0.
2. **Given** a plot is in "Exhausted" state, **When** the player attempts to plant a seed on it, **Then** the action is blocked and a clear explanation is shown (e.g., "This plot is exhausted. Wait 3 days or use Fertilizer.").
3. **Given** a plot is in "Exhausted" state, **When** 3 in-game days pass, **Then** the plot automatically returns to an empty, plantable state.
4. **Given** a plot has been harvested fewer than 3 consecutive times, **When** the next harvest completes, **Then** the plot returns to empty and the consecutive harvest counter increments by 1.

---

### User Story 2 - Buy and Use Fertilizer to Instantly Restore a Plot (Priority: P2)

A player with an Exhausted plot and sufficient coins can visit the shop, purchase one or more Fertilizer items, then apply a Fertilizer to the Exhausted plot to immediately restore it to a plantable state — without waiting.

**Why this priority**: Fertilizer is the spending mechanic that creates a risk-reward tradeoff. It makes the feature economically interesting and ensures players always have an escape valve. Without it the feature has no interaction beyond waiting.

**Independent Test**: Can be tested end-to-end by exhausting a plot, purchasing Fertilizer from the shop, applying it to the exhausted plot, and confirming the plot is immediately plantable again.

**Acceptance Scenarios**:

1. **Given** the player has enough coins, **When** they purchase Fertilizer from the shop, **Then** their coin balance decreases by the Fertilizer cost and one Fertilizer is added to their inventory.
2. **Given** the player has at least one Fertilizer in inventory and a plot is "Exhausted", **When** the player applies Fertilizer to that plot, **Then** the plot immediately returns to an empty, plantable state, and one Fertilizer is consumed from inventory.
3. **Given** the player has no Fertilizer in inventory, **When** they attempt to apply Fertilizer to an Exhausted plot, **Then** the action is blocked with a message directing them to the shop.
4. **Given** a plot is NOT in "Exhausted" state, **When** the player attempts to apply Fertilizer to it, **Then** the action is blocked (Fertilizer cannot be wasted on a healthy or occupied plot).

---

### User Story 3 - Natural Recovery Countdown Visibility (Priority: P3)

A player looking at their farm can clearly see which plots are Exhausted and how many days remain until each Exhausted plot recovers naturally, so they can plan their planting schedule without guessing.

**Why this priority**: Without visible feedback, the waiting mechanic feels opaque and frustrating. This story makes the feature fair and readable. It is lower priority because the game is still functional without it, just less informative.

**Independent Test**: Can be tested by exhausting a plot and confirming the UI shows an "Exhausted — N days remaining" indicator that decrements each day until recovery.

**Acceptance Scenarios**:

1. **Given** a plot just became Exhausted, **When** the player views the farm, **Then** the plot displays an "Exhausted" label along with "3 days remaining".
2. **Given** an Exhausted plot with 2 days remaining, **When** the player advances one in-game day, **Then** the plot now shows "1 day remaining".
3. **Given** an Exhausted plot with 1 day remaining, **When** the player advances one in-game day, **Then** the plot clears its Exhausted state and shows as empty and plantable.

---

### Edge Cases

- What happens if the player is bankrupt while plots are Exhausted? Exhausted state is preserved in saved game state and shown on the end screen — no special handling required.
- What if a player saves mid-exhaustion recovery and reloads the page? Recovery days remaining must persist across sessions (stored as part of game state).
- What if all 12 plots are simultaneously Exhausted? The player cannot plant anything until plots recover or Fertilizer is used; this is a valid game state and should not cause errors.
- What happens to the consecutive harvest counter if a plot sits empty for several days without being planted? The counter only increments on harvest; idle time neither resets nor increments it. Planting and harvesting again later continues from the same counter value.
- What if the player buys Fertilizer but their coin balance would go negative? The purchase must be blocked; players cannot spend coins they do not have.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each farm plot MUST track a consecutive harvest counter recording how many times in a row it has been harvested without being restored.
- **FR-002**: When a plot's consecutive harvest counter reaches 3, the system MUST transition that plot to "Exhausted" state immediately upon harvest completion.
- **FR-003**: An Exhausted plot MUST record the in-game day on which it became exhausted so the 3-day natural recovery period can be calculated.
- **FR-004**: The system MUST prevent players from planting seeds on an Exhausted plot and MUST display a reason message explaining the restriction.
- **FR-005**: At the start of each in-game day, the system MUST automatically clear the Exhausted state on any plot whose 3-day recovery period has elapsed.
- **FR-006**: The shop MUST offer "Fertilizer" as a purchasable consumable item with a fixed coin cost.
- **FR-007**: Purchased Fertilizer MUST be added to the player's inventory and MUST persist in saved game state.
- **FR-008**: When the player clicks an Exhausted plot, the system MUST present a "Use Fertilizer" action in place of the normal plant button; confirming this action applies one Fertilizer from inventory and immediately restores the plot to an empty, plantable state.
- **FR-009**: Applying Fertilizer MUST consume exactly one unit from the player's Fertilizer inventory.
- **FR-010**: Fertilizer MUST NOT be applicable to plots that are not in Exhausted state (empty plots or plots with a crop growing).
- **FR-011**: Each Exhausted plot MUST display the number of in-game days remaining until natural recovery.
- **FR-014**: The consecutive harvest counter MUST NOT be displayed to the player at any point; no warning or indicator of approaching Exhaustion is shown before the 3rd harvest completes.
- **FR-012**: All new plot state (consecutive harvest counter, exhausted status, day exhaustion began) MUST be included in the saved game state and survive a page reload.
- **FR-013**: The consecutive harvest counter MUST reset to 0 after a plot is restored (naturally or via Fertilizer), so the exhaustion cycle can begin again.

### Key Entities

- **Plot**: A farmable square of land. Extended with: consecutive harvest count, exhausted status flag, and the in-game day the exhaustion began.
- **Fertilizer**: A consumable shop item with a fixed coin purchase price, held as a quantity in the player's inventory.
- **Fertilizer Inventory**: The count of Fertilizer units the player currently holds; stored as part of overall game state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players who use all 12 plots without buying Fertilizer will encounter at least one Exhausted plot by in-game day 6 under normal play, confirming the mechanic meaningfully impacts strategy.
- **SC-002**: Applying Fertilizer to an Exhausted plot restores it within the same in-game action — no additional day advance is required.
- **SC-003**: Natural recovery completes exactly 3 in-game days after a plot becomes Exhausted — no earlier, no later.
- **SC-004**: Exhausted plot status and recovery countdown survive a page reload with zero data loss.
- **SC-005**: Players can distinguish Exhausted plots from empty and growing plots at a glance without reading tooltips.
- **SC-006**: The Fertilizer purchase and application flow takes no more than 2 player actions from shop to restored plot.

## Clarifications

### Session 2026-03-17

- Q: How does the player trigger Fertilizer use on a specific plot? → A: Click Exhausted plot → "Use Fertilizer" action appears in place of the plant button (Option A).
- Q: Should the player receive a warning when a plot is one harvest away from Exhaustion, or does Exhaustion arrive as a surprise? → A: No warning; Exhaustion is a surprise — the player must track plot usage themselves (Option B).

## Assumptions

- **Fertilizer price**: Assumed at 30 coins per unit — enough to represent a meaningful cost without being prohibitive, and comparable to buying a mid-tier seed. Tunable during implementation.
- **Counter persistence across idle gaps**: The consecutive harvest counter persists even when a plot sits empty between harvests. Counter resets only via natural recovery or Fertilizer use.
- **No bulk Fertilizer application**: One Fertilizer restores exactly one plot. Restoring multiple plots at once is out of scope.
- **No Fertilizer inventory cap**: Players may accumulate as many Fertilizer units as their coin balance allows.
- **No tool upgrade discount on Fertilizer**: Existing tool tier discounts (applied to seed costs) do not extend to Fertilizer purchases.
- **Schema migration**: New fields added to plot and game state require a schema version increment; old saves are discarded on load, consistent with the existing migration strategy.
