# Feature Specification: Pixel Parsnips — Farming Tycoon Game

**Feature Branch**: `001-farming-tycoon-game`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User description: "Create a web-based, turn-based farming tycoon game titled Pixel Parsnips..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plant, Grow & Harvest Crops (Priority: P1)

A player starts the game with a coin balance and a set of available farm plots.
They buy seeds from the shop, plant them in empty plots, then click "Next Day" to
advance time. When a crop reaches its growth duration it is automatically
harvested and the earned coins are added to the player's balance. The player
repeats this loop to accumulate wealth.

**Why this priority**: This is the entire revenue mechanism of the game. Without
the plant-grow-harvest loop nothing else functions — no money is ever earned and
no other feature can be meaningfully exercised.

**Independent Test**: Plant one Radish seed, click "Next Day" once, verify the
plot shows the crop as ready and coins increase by the crop's yield value. The
game delivers value (coin income) from this story alone.

**Acceptance Scenarios**:

1. **Given** an empty plot and sufficient coins, **When** the player purchases a
   Radish seed and plants it, **Then** the plot displays the crop type and a
   progress indicator showing days remaining until maturity.
2. **Given** a Radish with 0 days remaining, **When** the player clicks "Next Day",
   **Then** the crop is removed from the plot, the harvested yield is added to the
   coin balance, and the plot becomes empty again.
3. **Given** a Parsnip planted 1 day ago (matures in 2 days), **When** the player
   clicks "Next Day", **Then** the crop progress advances but no harvest occurs and
   no coins are awarded for that crop.
4. **Given** multiple crops at different growth stages, **When** "Next Day" is
   clicked, **Then** only crops that have reached full maturity are harvested; all
   others advance by one day.

---

### User Story 2 - Economic Drains & Bankruptcy Condition (Priority: P2)

At the end of every turn the game automatically deducts a flat Land Lease fee
and a percentage-based Tax from the player's coin balance. If the balance is
insufficient to cover the Land Lease fee, the game transitions to a Bankruptcy
screen showing a run summary and a restart option.

**Why this priority**: This is the "sink" that gives the survival loop its
tension. Without it the game has no lose condition and no meaningful economic
pressure.

**Independent Test**: Start with coins just below the Land Lease threshold,
click "Next Day" without harvesting, confirm the Bankruptcy screen appears with
a run summary and a working restart button.

**Acceptance Scenarios**:

1. **Given** a player with 200 coins at end of turn, **When** "Next Day" is clicked
   and Land Lease is 15 coins and Tax is 5%, **Then** the balance becomes
   200 − 15 − (200 − 15) × 0.05 = 175.75 coins (rounded to the nearest whole
   coin, lease deducted first, then tax on remaining balance).
2. **Given** a player whose balance equals exactly the Land Lease fee, **When**
   "Next Day" is clicked, **Then** the lease is deducted (balance reaches 0),
   the tax is applied (0), and the game continues with a zero balance.
3. **Given** a player whose balance is less than the Land Lease fee, **When**
   "Next Day" is clicked, **Then** the game immediately transitions to the
   Bankruptcy screen rather than applying the deduction.
4. **Given** the Bankruptcy screen is displayed, **When** the player clicks
   "Restart", **Then** all game state is reset to initial conditions and the
   game begins fresh on Day 1.

---

### User Story 3 - Shop: Buy Seeds & Upgrade Tools (Priority: P3)

The player accesses a shop panel to spend coins on seeds (added to their seed
inventory for planting) and on permanent tool upgrades that permanently reduce
the base cost of all seeds.

**Why this priority**: The shop is the primary strategic layer. Without it the
player cannot restock seeds or improve their economy, but the core loop (P1) and
the lose condition (P2) can be demonstrated without it.

**Independent Test**: Open the shop, purchase one Pumpkin seed when the player
has sufficient coins, confirm the seed appears in inventory, the coin balance
decreases by the correct price, and the shop closes or remains open showing the
updated balance.

**Acceptance Scenarios**:

1. **Given** the shop is open and the player has sufficient coins, **When** the
   player clicks "Buy" on a seed, **Then** the seed is added to their inventory,
   the coin balance decreases by the seed's current price, and the shop updates
   to show the new balance.
2. **Given** the player has insufficient coins for a seed, **When** they attempt
   to buy it, **Then** the purchase is blocked and an explanatory message is
   displayed; no coins are deducted.
3. **Given** the player has purchased a tool upgrade, **When** they view seed
   prices, **Then** all seed prices reflect the reduced cost from the upgrade, and
   any subsequent purchases use the discounted price.
4. **Given** the maximum tool upgrade tier has been purchased, **When** the player
   views the upgrades section, **Then** the upgrade is marked as maxed out and
   cannot be purchased again.

---

### User Story 4 - Weather System & Daily Log (Priority: P4)

Each time "Next Day" is clicked a random weather event is generated. The weather
applies a yield multiplier to all crops harvested that turn. The daily log
displays the weather outcome alongside a full breakdown of income, expenses, and
net balance change for the completed day.

**Why this priority**: Weather adds variance and excitement to harvests, making
planning interesting. The daily log makes the economy legible. Both features
enrich the core loop but the game is functional without them.

**Independent Test**: Click "Next Day" and verify the daily log appears containing
the weather event name, its multiplier, the coins earned from each harvested crop
(with multiplier applied), the Land Lease deduction, the Tax deduction, and the
net change in coin balance.

**Acceptance Scenarios**:

1. **Given** a Radish with base yield 12 coins is harvested on a day with a
   "Perfect Sun" weather event (1.5× multiplier), **When** "Next Day" is clicked,
   **Then** the player receives 18 coins from that harvest (12 × 1.5, rounded),
   and the daily log shows "Perfect Sun ×1.5" and the adjusted harvest value.
2. **Given** "Next Day" is clicked with no crops ready to harvest, **When** the
   daily log is shown, **Then** it still displays the weather event, the Land Lease
   deduction, and the Tax deduction with a net income of 0 from harvests.
3. **Given** multiple crops are harvested on the same day, **When** "Next Day" is
   clicked, **Then** the same weather multiplier is applied to every harvested crop
   that day and each harvest line-item is listed separately in the daily log.

---

### Edge Cases

- What happens when all farm plots are occupied and the player tries to plant
  another seed? The plant action is blocked; the player must wait for a crop to
  be harvested before planting again.
- What happens if the player's coin balance would go below zero after the Tax
  deduction but was above zero after the Land Lease deduction? The Tax is applied
  as a percentage of whatever balance remains after the lease; the balance can
  reach zero but the game only triggers Bankruptcy if the lease itself cannot be
  paid in full.
- What happens if the player has seeds in inventory but no empty plots? Seeds
  remain in inventory; no automatic planting occurs.
- What happens if the player tries to buy an upgrade they cannot afford? The
  purchase is blocked with an explanatory message; no coins are deducted.
- What happens on Day 1 with no planted crops? "Next Day" still processes normally:
  no harvests, weather is generated, lease and tax are deducted, daily log is shown.

## Requirements *(mandatory)*

### Functional Requirements

**Turn Progression**

- **FR-001**: The game MUST provide a "Next Day" button that advances the game
  state by one day when clicked.
- **FR-002**: Clicking "Next Day" MUST execute the end-of-turn sequence in this
  order: (1) advance crop growth, (2) generate weather, (3) harvest mature crops
  applying the weather multiplier, (4) deduct Land Lease fee, (5) deduct Tax on
  remaining balance, (6) check bankruptcy condition, (7) update daily log.

**Crops & Harvesting**

- **FR-003**: The game MUST support exactly three crop types with the following
  characteristics (values are baseline assumptions; see Assumptions section):

  | Crop    | Growth Duration | Base Seed Cost | Base Yield |
  |---------|----------------|---------------|------------|
  | Radish  | 1 day          | 5 coins       | 12 coins   |
  | Parsnip | 2 days         | 10 coins      | 28 coins   |
  | Pumpkin | 3 days         | 20 coins      | 65 coins   |

- **FR-004**: Players MUST be able to plant a seed from their inventory into any
  empty farm plot.
- **FR-005**: The game MUST automatically harvest all fully mature crops at the
  start of the end-of-turn sequence; no manual harvest action is required.
- **FR-006**: Each active crop MUST display its type, days planted, and days
  remaining until maturity.

**Weather System**

- **FR-007**: The game MUST randomly select one weather event per day from a
  predefined set, each carrying a distinct yield multiplier.
- **FR-008**: The selected weather multiplier MUST be applied to the base yield
  of every crop harvested on that day before coins are awarded.
- **FR-009**: The weather event name and multiplier MUST appear in the daily log.

**Shop**

- **FR-010**: The game MUST provide a shop accessible at any time between turns
  where players can purchase seeds.
- **FR-011**: The shop MUST display the current price, a description, and the
  growth/yield stats for each available seed type.
- **FR-012**: The game MUST offer at least one line of permanent tool upgrades
  that reduce the base cost of all seeds by a fixed percentage per tier.
- **FR-013**: Purchased seeds MUST be added to the player's seed inventory;
  purchased upgrades MUST take effect immediately and persist for the remainder
  of the run.
- **FR-014**: The shop MUST prevent purchases when the player has insufficient
  coins and display a clear reason for the block.

**Economic Drains**

- **FR-015**: The game MUST deduct a flat Land Lease fee at the end of every turn
  regardless of player activity.
- **FR-016**: The game MUST deduct a percentage-based Tax on the player's coin
  balance remaining after the Land Lease deduction, at the end of every turn.
- **FR-017**: Both the Land Lease amount and the Tax percentage MUST be visible
  to the player at all times (e.g., in a persistent HUD or info panel).

**Game State Display**

- **FR-018**: The game MUST persistently display the Current Day, Coin Balance,
  and a visual representation of all farm plots (occupied or empty) without
  requiring navigation.
- **FR-019**: The game MUST display a daily log for the most recently completed
  day, showing each harvest line-item (crop, base yield, weather multiplier,
  adjusted yield), the Land Lease deduction, the Tax deduction, and the net
  balance change.

**Bankruptcy & Restart**

- **FR-020**: If the player's coin balance is strictly less than the Land Lease
  fee at the moment the bankruptcy check occurs, the game MUST immediately
  transition to a Bankruptcy screen.
- **FR-021**: The Bankruptcy screen MUST display the number of days survived and
  the player's peak coin balance achieved during the run.
- **FR-022**: The Bankruptcy screen MUST provide a "Restart" button that resets
  all game state to initial conditions and starts a new game from Day 1.

### Key Entities

- **Game State**: The global container for a single run. Tracks current day,
  coin balance, farm plots, seed inventory, owned upgrades, and the daily log.
- **Crop Instance**: An active crop occupying a farm plot. Carries type reference,
  day planted, and current growth progress relative to maturity duration.
- **Crop Type**: A definition (not an instance) encoding a crop's name, growth
  duration in days, base seed cost, and base harvest yield in coins.
- **Seed Inventory**: A count-per-type record of seeds the player has purchased
  but not yet planted.
- **Tool Upgrade**: A permanent modifier purchased from the shop. Carries a tier
  level and the cumulative percentage discount it applies to all seed costs.
- **Weather Event**: A named event with a yield multiplier. One is randomly
  selected each day and applied to all harvests.
- **Daily Log Entry**: A per-turn record of weather, each harvested crop and its
  adjusted yield, Land Lease deducted, Tax deducted, and net coin change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player can understand and complete their first harvest
  cycle (buy seed → plant → advance day → collect coins) within 3 minutes without
  any external instructions.
- **SC-002**: The game runs without visible lag or incorrect state for sessions
  of 100 or more consecutive days.
- **SC-003**: Every coin value displayed (balance, harvest income, lease, tax)
  exactly matches the values recorded in the daily log with zero discrepancy
  across 100 consecutive turns of automated testing.
- **SC-004**: The Bankruptcy screen appears on 100% of turns where the coin
  balance is below the Land Lease fee, and never appears when the balance is
  sufficient.
- **SC-005**: A player can navigate from the Bankruptcy screen back to a fully
  reset, playable Day 1 state in 2 clicks or fewer.
- **SC-006**: Weather multipliers are applied to harvests correctly (within ±1
  coin of the expected rounded value) in all tested weather/crop combinations.

## Assumptions

The following values are assumed for game balance and may be adjusted during
implementation without changing the specification:

- **Starting coin balance**: 100 coins
- **Farm plot capacity**: 12 plots per run
- **Land Lease fee**: 15 coins per day (flat)
- **Tax rate**: 5% of coin balance remaining after Land Lease deduction, per day
- **Weather events**:

  | Name         | Multiplier |
  |--------------|-----------|
  | Drought      | 0.5×      |
  | Overcast     | 0.8×      |
  | Sunny        | 1.0×      |
  | Warm Breeze  | 1.2×      |
  | Perfect Sun  | 1.5×      |

- **Tool upgrade tiers**: 3 tiers, each reducing all seed base costs by 20%
  cumulatively (Tier 1: −20%, Tier 2: −40%, Tier 3: −60%)
- **Tool upgrade costs**: 50 coins (Tier 1), 120 coins (Tier 2), 250 coins
  (Tier 3)
- **Session persistence**: No save/load between browser sessions is required;
  game state is in-memory only for a single session
- **Coin math**: All coin values are integers; fractional results are rounded
  down (floor) to the nearest whole coin
