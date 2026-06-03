# Pixel Parsnips — Product Vision & Player Handbook

> *"Can you outlast the elements?"*

---

## Table of Contents

1. [Product Identity](#1-product-identity)
2. [Market Position & The Hook](#2-market-position--the-hook)
3. [The Core Gameplay Loop](#3-the-core-gameplay-loop)
4. [Key Systems & Mechanics](#4-key-systems--mechanics)
   - 4.1 Dynamic Weather Engine
   - 4.2 Soil Health (Exhaustion)
   - 4.3 Economic Progression (Shop & Tool Upgrades)
   - 4.4 Fail States (Bankruptcy & Season Failure)
   - 4.5 The Season System (The Run Arc)
5. [The HUD & Player Feedback](#5-the-hud--player-feedback)
6. [Technical Advantages for Stakeholders](#6-technical-advantages-for-stakeholders)
7. [Feature Roadmap Summary](#7-feature-roadmap-summary)

---

## 1. Product Identity

**Pixel Parsnips** is a web-based, turn-based farming tycoon game designed around resource management and risk mitigation. It distills the tension of agricultural economics into a lean, accessible format that rewards forward-thinking players and punishes complacency.

| Attribute | Detail |
|---|---|
| **Genre** | Turn-based tycoon / survival-lite strategy |
| **Platform** | Browser-native (no installation, no download) |
| **Audience** | Casual-to-mid-core players who enjoy numbers, strategy, and "one-more-turn" tension |
| **Session Length** | 5–20 minutes (a single season ≈ 10 min; a full 4-season run ≈ 30 min) |
| **Accessibility** | Fully responsive — Desktop, Tablet, Mobile (320px–1440px) |

The game's identity is built on a single dramatic question: *can the player grow a profitable enough farm to survive four escalating seasons before the money runs out?* Each Season is a 20-day arc with a coin target that must be met to advance. Missing the target ends the run; surviving all four crowns the player with a Victory and an optional Endless mode.

---

## 2. Market Position & The Hook

### The Pitch

Pixel Parsnips is a survival-lite tycoon where every "Next Day" click is a calculated risk. Players invest scarce coins into crops, tools, and soil care — then watch the economy and the weather decide their fate. The threat of bankruptcy is always one bad season away.

### What Sets It Apart

Most casual farming games reward patience with guaranteed progress. Pixel Parsnips inverts that contract. Here, time itself is the enemy:

- **Every passing day costs money** — a flat land lease fee plus a percentage tax drains the balance regardless of harvest.
- **The weather is unpredictable** — a single Blight or Flash Drought can erase a carefully planned season.
- **The soil degrades** — overworking plots introduces the Exhaustion mechanic, forcing players to either rest land or spend to restore it.

This creates a friction loop that feels genuinely earned to overcome, driving the "one-more-try" replayability central to the game's retention model.

---

## 3. The Core Gameplay Loop

The game follows a clean, repeatable cycle across four phases per turn:

```
INVEST → PLANT → ADVANCE TIME → HARVEST & PAY
```

### Phase 1 — The Investment Phase (The Shop)

Before advancing time, players spend coins in the Shop. Three decisions live here:

1. **Buy Seeds** — choosing between three crops at different risk/reward profiles.
2. **Buy Fertilizer** — insurance against soil exhaustion (see Section 4.2).
3. **Upgrade Tools** — a capital investment that permanently reduces all future seed costs.

The Shop is always visible (sidebar on desktop; a sliding bottom sheet on mobile), keeping the economy legible at all times.

### Phase 2 — The Tilled Grid (Farm Management)

The farm consists of **12 plots** arranged in a grid. Each plot is in one of the following states at any moment:

| Plot State | Visual Cue | Player Action Available |
|---|---|---|
| Empty | Dark tilled soil, "Plant here" prompt | Plant a seed from inventory |
| Growing (Sprout) | Small seedling icon, amber ring | None — wait |
| Growing (Mid-stage) | Larger plant, amber ring progressing | None — wait |
| Ready to Harvest | Full vegetable, green highlight | Auto-harvests on Next Day |
| Exhausted | Cracked/dead-earth, red coloring | Apply Fertilizer or wait |
| Pest-Damaged | Red damage indicator | Acknowledge and clear |

A circular progress ring on each occupied plot communicates days remaining without cluttering the grid with text.

### Phase 3 — The Chronos Mechanic (Advancing Time)

The **"Next Day" button** is the player's primary action. It is always visible in the top HUD bar — no scrolling required. Clicking it triggers the full turn sequence:

1. All growing crops age by one day.
2. The weather event for the day is determined (disaster probability scales with the active Season — see Section 4.5).
3. Mature crops are harvested automatically.
4. The weather multiplier is applied to harvest income.
5. The Land Lease fee is deducted (rate depends on the active Season — see Section 4.5).
6. The Daily Tax is deducted (5% of remaining balance).
7. Bankruptcy is checked.
8. On the last day of a Season, the player's balance is checked against the Season's target — pass advances, miss ends the run.

A **Day Summary modal** immediately surfaces the results — weather, income, costs, disasters, and net change — before returning the player to the updated farm.

### Phase 4 — The Harvest & Tax Cycle (The Economic Reality)

Harvested crops convert to coins — but the costs are relentless:

- **Land Lease**: A daily fee that escalates with the Season — 15 in Spring Thaw, 20 in Summer Heat, 25 in Autumn Pressure, 30 in Winter Crunch (and continuing to climb in Endless mode). Deducted every single day, regardless of whether crops were harvested.
- **Daily Tax**: 5% of the balance remaining after the lease is deducted. As wealth grows, this scales up — incentivising continual reinvestment rather than coin-hoarding.
- **Bankruptcy Threshold**: If the balance drops below the active Season's lease fee, the run ends. The player sees a run summary (days survived, season reached, peak balance) and can restart.

---

## 4. Key Systems & Mechanics

### 4.1 — Dynamic Weather Engine

The weather system is the game's primary source of variance. Each turn, a single event is drawn from a probability pool that spans a full spectrum from fortune to catastrophe.

#### The Probability Spectrum

| Event | Type | Probability | Effect |
|---|---|---|---|
| Perfect Sun | Positive Boost | ~17% | 1.5× yield multiplier |
| Warm Breeze | Positive Boost | ~17% | 1.2× yield multiplier |
| Sunny | Neutral | ~17% | 1.0× (baseline) |
| Overcast | Mild Negative | ~17% | 0.8× yield multiplier |
| Drought | Moderate Negative | ~17% | 0.5× yield multiplier |
| **Blight** | **Disaster** | **5%** | **0.1× multiplier — near-total harvest loss** |
| **Pest Infestation** | **Disaster** | **5%** | **Each occupied plot: 50% chance of destruction** |
| **Flash Drought** | **Disaster** | **5%** | **Doubles growth time of any crop planted in the next 2 days** |

#### How Disasters Change the Math

The three Disaster-Class events are not merely multiplier adjustments — they are structural disruptions:

- **Blight** is brutal but legible: every harvested crop this turn is worth a fraction of its value. A Radish that should yield 12 coins yields barely 1.
- **Pest Infestation** is the most devastating: it randomly destroys crops mid-growth, wiping out invested seed cost and growth time. Pest-damaged plots require manual acknowledgment before replanting, adding a psychological weight to the loss.
- **Flash Drought** punishes future plans: crops planted during the active window take twice as long to mature, compounding daily lease costs and disrupting the player's rotation schedule. Multiple Flash Droughts stack, making mid-disaster planting increasingly dangerous.

These events are rare by design (15% combined chance per day in Season 1), but their asymmetric impact — and the knowledge that they can occur at any moment — sustains strategic tension across the entire session. The combined disaster probability scales with the active Season (see Section 4.5) — by Winter Crunch (Season 4) a player faces a 35% chance of *some* disaster every day.

### 4.2 — Soil Health System (The Exhaustion Mechanic)

Land is not infinite. Continuous cropping degrades soil quality, forcing players to think in rotations rather than pure throughput.

**How it works:**

- Each plot silently tracks a **consecutive harvest counter**.
- After **3 consecutive harvests** from the same plot, the land becomes **Exhausted** and cannot be planted.
- The player must choose one of two recovery paths:

| Recovery Method | Cost | Speed |
|---|---|---|
| Natural Rest | 0 coins | 3 in-game days |
| Fertilizer Application | 30 coins | Instant |

**The strategic dilemma:** Fertilizer is purchased from the Shop and applied directly to the exhausted plot. It restores immediately — but at a cost that competes with buying seeds or upgrading tools. Choosing to wait 3 days instead saves money but sacrifices productive capacity and loses ground to daily lease fees.

This system ensures that a player who ignores soil management will eventually find themselves with too few plantable plots to generate sufficient income — a slow-burn difficulty ramp that rewards planning.

### 4.3 — Economic Progression (The Shop & Tool Upgrades)

The Shop is the player's only lever for long-term economic improvement. Beyond consumables, it offers three tiers of **Tool Upgrades**:

| Tier | Cost | Cumulative Seed Discount |
|---|---|---|
| Tier 1 | 50 coins | 20% off all seeds |
| Tier 2 | 120 coins | 40% off all seeds |
| Tier 3 | 250 coins | 60% off all seeds |

Each upgrade is a delayed-return capital decision: the player sacrifices current liquidity for permanently lower operating costs. At Tier 3, a Pumpkin that cost 20 coins now costs 8 — dramatically changing the risk/reward calculus of longer-growth crops.

#### Crop Reference Card

| Crop | Base Cost | Growth Time | Yield | Base Profit |
|---|---|---|---|---|
| Radish | 5 coins | 1 day | 12 coins | +7 coins |
| Parsnip | 10 coins | 2 days | 28 coins | +18 coins |
| Pumpkin | 20 coins | 3 days | 65 coins | +45 coins |

Radishes are the safe, low-yield workhorse — fast cash but susceptible to daily lease drain across long gaps. Pumpkins are the high-risk, high-reward play — their 3-day growth window is a significant window of exposure to Pest Infestation, Blight, and Flash Drought.

### 4.4 — The Fail States (Bankruptcy & Season Failure)

The game's stakes are unambiguous — and there are now two ways to end a run:

- **Bankruptcy**: triggered when the coin balance falls below the active Season's lease fee. The player cannot pay to stay in business.
- **Season Failure**: triggered when the player ends Day 20 of a Season below the Season's coin target. The arc structure means underperformance has a hard ceiling — surviving the costs is no longer enough; the player must also grow the farm fast enough.

On either outcome, the player receives a **Run Summary** detailing:
- Total days survived
- Season reached (e.g., "Season 2 — Summer Heat")
- Peak balance reached during the run

This data gives the "one-more-try" replayability its emotional hook — players know exactly how far they got and have an immediate frame for improvement. A fresh game starts with 100 coins, 12 empty plots, and Season 1 (Spring Thaw) on Day 1.

### 4.5 — The Season System (The Run Arc)

Every run is structured as a **4-Season arc** plus an optional Endless mode. Each Season is 20 days long, has a unique name, and ratchets up both the daily lease and the disaster probability.

| Season | Days | Lease/day | Disaster % | End-of-season target |
|---|---|---|---|---|
| 1 — Spring Thaw | 1–20 | 15 | 15% | ≥ 150 coins |
| 2 — Summer Heat | 21–40 | 20 | 20% | ≥ 250 coins |
| 3 — Autumn Pressure | 41–60 | 25 | 28% | ≥ 400 coins |
| 4 — Winter Crunch | 61–80 | 30 | 35% | ≥ 600 coins |
| Endless N (N ≥ 5) — Deep Winter | rolling 20-day windows | 30 + 2·(N−4) | capped at 50% | previous + 200 |

The proportions between the three disaster types (Blight / Pest Infestation / Flash Drought) are preserved across all Seasons — only the *total* probability grows. The non-disaster weather slots stretch evenly across the remaining probability space.

**Season transitions are explicit and telegraphed.** From Day 18 of each Season, the HUD shows a "X days left" warning when the target is not yet met. On Day 20, the HUD previews the next Season's lease ("rises to 20 next season"). When the day resolves, one of three outcomes plays out:

- **Target met (Seasons 1–3)** → a Season Transition modal shows the result, previews the next Season's rules (lease, disaster bands, target), and offers a single "Begin Season N+1" button.
- **Target missed** → a Season Failed modal shows the gap (only when within 50% of the target, to avoid feeling mocking) and offers a "Start New Run" button.
- **Target met on Day 80 (Season 4 Victory)** → a Victory modal appears with a choice: "End Run Here" (clean finish) or "Continue →" (enters Endless mode and Day 81).

**Endless mode** is a deliberate retention path for hardcore players who want to push beyond the finite arc. Each Endless Season raises the lease by 2 and disaster probability by 2 percentage points (capped at 50%), and adds 200 to the next target. Targets are still checked at end-of-season — Endless does not exempt the player from the run-end check on a missed target.

---

## 5. The HUD & Player Feedback

The interface is designed on a principle of **zero hidden information**: everything a player needs to make a decision is visible without navigation.

### The Top HUD Bar

Always visible, never scrolled away:

```
[ Season 1 · Spring Thaw       ]  [ Coins: 87 / 150 target ]   [ Next Day ]  [ Last Turn ]
[ Day 14 / 20                  ]  [ Lease: 15🪙/day | Tax: 5% ]
```

- **Season chip**: shows the current Season's number, name, and day within the Season (e.g., "Day 14 / 20"). Replaces the bare day counter.
- **Coin / target chip**: shows the live balance alongside the Season's target. The target text turns green when the threshold is met and red ("— X days left") from Day 18 onward when it isn't.
- **Lease line**: shows the active Season's lease per day. On Day 20 of a non-final Season (and Day 80 of Season 4 only when Endless mode is on), it appends "(rises to N next season)" — telegraphing the upcoming cost increase.
- **Next Day** button and **Last Turn** button are unchanged in placement.
- **Cost display**: Land Lease (now per-Season) and Tax Rate are permanently visible, preventing surprise deductions.

### The Day Summary Modal

After each "Next Day" press, a modal surfaces the full turn breakdown:

- Weather event (with drama for disasters)
- Line-item harvest list: base yield, multiplier applied, adjusted income
- Lease and Tax deductions
- Net change and closing balance
- Any disaster events (pest-destroyed plot IDs, Flash Drought countdown)

The modal is dismissed to return to the updated farm. The "Last Turn" button allows it to be recalled at any point.

### The Season Transition Modal

On the last day of any Season, after the Day Summary is dismissed, a dedicated **Season Transition modal** surfaces. It has three variants keyed off the run's outcome:

- **Passed** — "Season N — Complete", final balance vs. target, and a preview of the next Season's lease, disaster rate, and target. A single "Begin Season N+1" button continues the run.
- **Failed** — "Season Failed", final balance, an optional "You were X coins short" line (suppressed when the gap exceeds 50% of the target), and a "Start New Run" button.
- **Victory** — "🌾 VICTORY 🌾" with total days survived and peak balance. Two buttons: "End Run Here" (clean run-end) and "Continue →" (enters Endless mode).

Focus moves to the modal's primary action button on open. Escape routes to the safest exit per variant — Continue for Passed, Restart for Failed, End Run for Victory.

### The Shop Interface

- **Desktop**: Persistent sidebar with a visually distinct darker/wood-textured background.
- **Mobile**: Bottom sheet that slides up on demand, keeping the farm grid as the primary viewport.
- Seed cards display price, description, growth time, yield, and **Net Profit** prominently.
- Selected seeds show a persistent high-contrast border (bright gold) until cancelled or changed.
- Unaffordable items are visually dimmed — the player always knows what is within reach.
- The **"Active Buffs" tray** appears only when Tool Upgrades have been purchased, cleanly separating owned tools from the purchasable shop inventory.

---

## 6. Technical Advantages for Stakeholders

### Instant Access — Zero Friction Onboarding

Pixel Parsnips runs in any modern web browser with no installation, no account creation, and no download. A player can be in their first turn within seconds of clicking a link. This eliminates the single largest drop-off point in casual game distribution.

### Persistent Play — Automatic Save State

The game saves the complete farm state to the browser's **localStorage** after every player action — planting, purchasing, advancing a day, or restarting. Sessions are never lost. A player can close the tab, return hours later, and resume exactly where they left off.

This persistence is schema-versioned. When the game updates to a new schema, in-progress saves are migrated forward where possible — for example, the Season System upgrade (v3 → v4) preserves a player's mid-run state and seamlessly resumes them in the new Season-aware engine. When a schema change is too large to migrate, the old save is cleanly discarded and a fresh run begins — never a corrupted state or error screen.

### Responsive Design — One Product, Every Screen

The interface is engineered to run without horizontal overflow at any viewport from 320px (small mobile) to 1440px (large desktop). The shop pivots from a persistent sidebar to a mobile-optimised bottom sheet at the 768px breakpoint. Touch targets meet accessibility minimums (44×44px). The game is genuinely playable on a phone held in portrait orientation.

### The Fail State as a Feature

Bankruptcy is not a bug — it is the game's central retention driver. The run summary on game-over gives players a concrete performance metric (days survived, peak balance) that creates an immediate, intrinsic motivation to improve. This "one-more-try" loop is responsible for the majority of session-to-session retention in the tycoon genre and requires no external reward systems or notifications to function.

---

## 7. Feature Roadmap Summary

The game has been built across six successive feature milestones, each expanding the depth of play:

| Milestone | Codename | Core Addition |
|---|---|---|
| **001** | Farming Tycoon Core | Base loop: shop, planting, weather multipliers, economy, bankruptcy |
| **002** | Plot Exhaustion | Soil degradation system, Fertilizer item, rotation strategy layer |
| **003** | Crop Disasters | Three disaster-class weather events: Blight, Pest Infestation, Flash Drought |
| **004** | Game UI Revamp | Full visual and UX overhaul: responsive layout, growth stages, modal feedback, textured art direction |
| **005** | UI Polish | Low-balance warning, Day-1 onboarding hint, Plant text always visible, disaster drama in Day Summary, contextual bankruptcy insight, mobile/desktop polish |
| **006** | Season System | 4-Season finite arc with escalating lease and disaster rates, end-of-season targets, Season Transition modal (passed/failed/victory), optional Endless mode, schema 3 → 4 migration |

Each milestone was designed to layer additional decision-making complexity onto the existing foundation without requiring changes to the underlying core mechanic — ensuring the loop remains legible while the skill ceiling continues to rise.

---

*Pixel Parsnips — Product Vision & Player Handbook*
*Document version 1.1 — June 2026 (Season System update)*
