# Feature Specification: Negative Weather Events — Crop Disasters

**Feature Branch**: `003-crop-disasters`
**Created**: 2026-03-18
**Status**: Draft

## Clarifications

### Session 2026-03-19

- Q: Are crops ready to harvest on a Pest Infestation day included in the 50% destruction roll? → A: Yes — pests roll against all occupied plots including those maturing this turn; destroyed crops yield nothing.
- Q: Should per-plot pest destruction rolls be injectable for deterministic testing? → A: Yes — injectable (explicit list of plot IDs to destroy or equivalent seed), consistent with FR-012 and SC-002.
- Q: Is day advance blocked while "Pest Damage" plots remain unacknowledged? → A: No — only planting is blocked; the player may advance turns freely and the indicator persists until the player dismisses it.
- Q: Should crops planted during a Flash Drought show a per-plot indicator throughout their growth? → A: Yes — a per-plot drought icon is displayed on the cell for the full growth period of any crop planted during the active window.

## Overview

The current weather system applies yield multipliers that are mostly positive. To raise the stakes and create more compelling strategic decisions, three new disaster-class weather events are introduced: **Blight**, **Pest Infestation**, and **Flash Drought**. Each attacks a different dimension of the player's farm — earnings, assets, and growth tempo — to keep gameplay challenging across all phases.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Surviving a Blight (Priority: P1)

A player with a healthy stack of coins harvests a day affected by Blight. All maturing crops yield a mere 10% of their expected income instead of the full amount. The player sees the dramatic drop in the daily log, checks their coin reserves, and adjusts their next purchasing decision accordingly.

**Why this priority**: Blight is the most straightforward of the three disasters — it reuses the existing yield-multiplier mechanism and is immediately visible in the harvest income line. It is the minimum viable negative event and validates the distribution rework end-to-end.

**Independent Test**: Seed the weather roll so that Blight is always selected on the next turn. Verify harvest income equals `baseYield × 0.1` for every maturing crop, and that the daily log labels the event as "Blight."

**Acceptance Scenarios**:

1. **Given** one or more crops are maturing on a Blight day, **When** the turn is processed, **Then** each harvest yields exactly 10% of its base value, and the daily log records the weather as "Blight" with multiplier 0.1.
2. **Given** no crops are maturing on a Blight day, **When** the turn is processed, **Then** the daily log still records "Blight" with multiplier 0.1 and zero harvest income.
3. **Given** a Blight day, **When** the player reviews the daily log, **Then** the UI clearly distinguishes Blight from positive weather events (e.g., visually marked as a disaster).

---

### User Story 2 — Losing Crops to Pest Infestation (Priority: P2)

A player with several crops in the ground wakes up to a Pest Infestation event. A random selection of currently growing crops are destroyed — removed from their plots immediately — before any harvest occurs. The player finds empty plots where healthy crops used to be and must decide whether to replant immediately or wait.

**Why this priority**: Pest Infestation introduces asset destruction, a qualitatively different loss from a yield cut. It tests the player's seed inventory and coin reserves simultaneously and adds a randomness layer that keeps every session unpredictable.

**Independent Test**: Inject Pest Infestation as the weather event and provide a deterministic list of plot IDs to destroy. Confirm that exactly those plots are cleared, remaining plots are untouched, and the daily log lists the destroyed plot IDs.

**Acceptance Scenarios**:

1. **Given** at least 1 occupied plot exists (including crops ready to harvest this turn), **When** a Pest Infestation turn is processed, **Then** each occupied plot independently has a 50% chance of being destroyed (its plot reset to empty) before harvest resolution.
2. **Given** multiple occupied plots (including any maturing this turn), **When** a Pest Infestation occurs, **Then** each occupied plot has an independent 50% chance of being destroyed, meaning outcomes range from 0 plots destroyed to all plots destroyed.
3. **Given** no crops are currently growing, **When** a Pest Infestation turn is processed, **Then** the event is still logged as "Pest Infestation" and no crash or undefined behaviour occurs.
4. **Given** a Pest Infestation occurs, **When** the player reviews the daily log, **Then** the log lists which plots were affected and describes them as destroyed by pests.

---

### User Story 3 — Acknowledging Pest-Destroyed Plots (Priority: P2)

After a Pest Infestation, each destroyed plot displays a distinct visual indicator (e.g., a "Pest Damage" state) so the player can see at a glance which plots were hit. The player cannot plant on those plots until they click each one to dismiss the notification. Clicking the plot reveals a confirmation action (e.g., "Clear Plot") — identical in pattern to clicking an exhausted plot for the "Use Fertilizer" prompt. Once confirmed, the plot returns to a normal empty state and is immediately plantable.

**Why this priority**: Without this acknowledgment step, pest destruction is easy to miss — the player might not notice a plot is now empty mid-session. Forcing a click-to-clear ensures the player consciously registers the loss before moving on. It also aligns with the existing exhausted-plot interaction pattern, keeping UI behaviour consistent.

**Independent Test**: Inject Pest Infestation destroying a specific plot. Verify: (1) that plot shows the pest-damage indicator immediately after the turn, (2) the player cannot plant on it while unacknowledged, (3) clicking the plot reveals a "Clear Plot" action, (4) confirming the action removes the indicator and makes the plot plantable.

**Acceptance Scenarios**:

1. **Given** a Pest Infestation destroys one or more crops, **When** the turn resolves, **Then** each destroyed plot immediately displays a "Pest Damage" indicator distinguishable from a normal empty plot.
2. **Given** a plot is in "Pest Damage" state, **When** the player attempts to plant on it, **Then** the action is blocked until the player acknowledges the damage.
3. **Given** a plot is in "Pest Damage" state, **When** the player clicks on it, **Then** a "Clear Plot" action is presented (in place of the normal plant action).
4. **Given** the "Clear Plot" action is shown, **When** the player confirms it, **Then** the plot returns to a normal empty state and is immediately plantable.
5. **Given** multiple plots are in "Pest Damage" state, **When** the player clears one, **Then** the remaining damaged plots are unaffected and still require individual acknowledgment.

---

### User Story 4 — Weathering a Flash Drought (Priority: P3)

A Flash Drought strikes. No crops are destroyed today, but the player sees a warning that the next 2 planting days will be affected by drought conditions: any crop planted during that window will take twice as long to mature. The player must weigh whether to plant immediately at a growth penalty or wait out the drought window.

**Why this priority**: Flash Drought is the most complex event — it introduces a persistent game state that spans multiple turns and changes the player's tactical timing decisions. It delivers the deepest strategic depth of the three events but also has the most implementation surface area.

**Independent Test**: Inject Flash Drought on day N, then plant one crop on day N+1 and one crop on day N+3 (after the 2-calendar-day window expires). Verify the first crop has double the normal growth time and the second crop has normal growth time.

**Acceptance Scenarios**:

1. **Given** a Flash Drought event occurs on day N, **When** a crop is planted on day N+1 (within the drought window), **Then** that crop's growth time is doubled compared to its base value.
2. **Given** a Flash Drought event occurs on day N, **When** a crop is planted on day N+2 (the last calendar day of the drought window), **Then** that crop's growth time is also doubled.
3. **Given** a Flash Drought event occurs on day N, **When** a crop is planted on day N+3 or later (outside the drought window), **Then** that crop grows at its normal base rate with no penalty.
4. **Given** a Flash Drought is active, **When** the player views the farm screen, **Then** a visible indicator shows how many drought-affected planting days remain (e.g., "Flash Drought: 2 days remaining").
5. **Given** a second Flash Drought occurs while a first is still active, **When** both are active, **Then** their durations stack — the remaining calendar day counter increases by 2 (the window extends, not resets).
6. **Given** a crop is planted during an active Flash Drought window, **When** the player views the farm screen, **Then** that plot cell displays a drought indicator for the crop's full growth period, distinguishing it from crops planted outside the window.

---

### Edge Cases

- What happens when a Blight and Pest Infestation (hypothetically) coincide? Each event is mutually exclusive by the probability distribution, so co-occurrence is impossible — no special handling needed.
- What if a Flash Drought window is active when the game is saved and reloaded? The remaining drought days must persist across sessions (saved in game state).
- What if Pest Infestation targets a crop that would mature this same turn? Pests are resolved before harvest; a crop maturing this turn is subject to the 50% destruction roll and yields nothing if destroyed.
- What if all plots are empty during a Pest Infestation? The event is logged but no plots enter "Pest Damage" state; there is nothing for the player to acknowledge.
- What if the player saves and reloads while plots are in "Pest Damage" state? The state persists; the damaged indicator is shown on reload and planting remains blocked until acknowledged.
- What happens when Flash Drought's 50% reduction results in a fractional day count? Growth times are rounded up to the nearest whole day.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The weather selection system MUST use a continuous uniform random value (0.0–1.0) to determine the daily event, replacing the current discrete index-based selection.
- **FR-002**: The system MUST map probability ranges to events: 0.00–0.05 → Blight, 0.05–0.10 → Pest Infestation, 0.10–0.15 → Flash Drought, 0.15–1.00 → existing Normal/Positive weather pool.
- **FR-003**: On a Blight day, the system MUST apply a 0.1× yield multiplier to all harvests processed on that turn.
- **FR-004**: On a Pest Infestation day, before harvest resolution, the system MUST independently roll a 50% destruction chance for each occupied plot (including crops that would mature this same turn); each crop that fails the roll is immediately removed from its plot with no yield.
- **FR-005**: On a Flash Drought day, the system MUST record a "flash drought active" state with a remaining counter of 2 calendar days.
- **FR-006**: While a Flash Drought is active, the system MUST double the growth time of any crop at the moment it is planted; the counter MUST decrement by 1 each calendar day that passes (not per planting action).
- **FR-007**: Flash Drought state MUST persist across save/load cycles.
- **FR-008**: If a second Flash Drought occurs while a first is still active, the remaining calendar-day counter MUST increase by 2 (stacking, not resetting).
- **FR-009**: The daily log MUST record the event name and relevant details for all three disaster types: Blight (multiplier), Pest Infestation (list of destroyed plot IDs), Flash Drought (counter value after the event).
- **FR-010**: The farm UI MUST display a persistent Flash Drought indicator when the counter is greater than 0, showing how many affected calendar days remain.
- **FR-011**: The disaster events MUST be visually distinguishable from positive weather events in the daily log (e.g., distinct colour, icon, or label).
- **FR-012**: The existing `processTurn` function signature MUST remain backward-compatible with deterministic test injection for weather selection. Additionally, when a Pest Infestation event is processed, the per-plot destruction rolls MUST be injectable (e.g., via an explicit list of plot IDs to destroy or a fixed seed), enabling fully deterministic pest tests without statistical sampling.
- **FR-013**: Each plot destroyed by Pest Infestation MUST enter a "Pest Damage" state after the turn resolves, displaying a distinct visual indicator on the plot cell.
- **FR-014**: A plot in "Pest Damage" state MUST block planting until the player explicitly acknowledges it. Day advance is NOT blocked — the player may proceed to the next turn with unacknowledged plots; the indicator persists until dismissed.
- **FR-015**: When the player clicks a "Pest Damage" plot, the system MUST present a "Clear Plot" action in place of the normal plant action (consistent with the "Use Fertilizer" pattern on Exhausted plots).
- **FR-016**: Confirming the "Clear Plot" action MUST remove the "Pest Damage" state and return the plot to a normal empty, plantable state — no cost to the player.
- **FR-017**: "Pest Damage" state MUST persist across save/load cycles; a reload before acknowledgment must still show the indicator and block planting.
- **FR-018**: Each crop planted during an active Flash Drought window MUST display a per-plot drought indicator (e.g., a small icon on the plot cell) for the crop's entire growth period, making it visually clear to the player that this specific crop has a doubled growth time.

### Key Entities

- **WeatherEvent**: Represents the outcome of daily weather resolution. Extended to cover disaster-class events (Blight, Pest Infestation, Flash Drought) alongside existing multiplier-based weather. Key attributes: event type, yield multiplier (if applicable), affected plot IDs (for Pest Infestation).
- **FlashDroughtState**: Tracks the number of remaining calendar days affected by a Flash Drought. Persisted in game state. Attributes: remaining days (integer ≥ 0).
- **PlotState**: Extended with a "Pest Damage" flag (requires acknowledgment before planting) and a "drought-penalised" flag (crop was planted during a Flash Drought window and has doubled growth time). Both flags are persisted in game state.
- **DailyLogEntry**: Existing entity extended to capture disaster detail — destroyed plot IDs and post-event drought counter — in addition to the existing weather multiplier field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Players encounter at least one negative weather event on average every 7 turns (consistent with 15% probability over many sessions).
- **SC-002**: All three disaster events can be triggered deterministically in automated tests with zero flakiness.
- **SC-003**: A Blight day produces harvest income within ±1 coin of `Σ(baseYield × 0.1)` for all maturing crops (rounding tolerance).
- **SC-004**: Pest Infestation destroys exactly the injected set of plots in deterministic tests; in non-deterministic play, destruction is distributed across all occupied plots with equal probability.
- **SC-005**: Flash Drought growth penalties are applied to 100% of crops planted within the active window and 0% of crops planted after the window expires.
- **SC-006**: Game state including Flash Drought counter is fully restored after a save/load cycle with no loss of data.
- **SC-007**: Players can identify a disaster event without reading tooltips — the event name and key outcome are visible in the daily log at a glance.
- **SC-008**: Players can clear a pest-damaged plot in exactly 2 interactions (click plot → confirm "Clear Plot") with no additional navigation required.

## Assumptions

- "Planting cycle" in Flash Drought context means a calendar day. The counter decrements by 1 each day that passes, regardless of whether any crops are planted during those days.
- Pest Infestation uses a per-crop 50% independent roll rather than destroying a fixed count. This preserves both mild outcomes (few crops lost) and severe outcomes (all crops lost) within the same event type.
- The existing Normal/Positive weather pool (drought 0.5×, overcast 0.8×, sunny 1.0×, warm breeze 1.2×, perfect sun 1.5×) retains equal weighting among its members within the 0.15–1.00 range.
- The existing `drought` weather type (0.5× multiplier) is retained as a Normal weather outcome; the new "Flash Drought" is a distinct disaster event with a different mechanic.
- Growth time doubling from Flash Drought is applied at planting time and is baked into `daysRemaining`; the UI countdown simply reflects the stored value with no ongoing recalculation.
