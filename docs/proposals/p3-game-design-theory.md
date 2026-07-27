# Pixel Parsnips — Gameplay Design Proposal (p3)
## Applied Game Design Theory Analysis

> **Diagnosis**: The game has solid mechanics and authentic tension, but no goal ladder. Players learn the system, stabilize their economy, and then face an open-ended grind with no direction. The "why" is missing.

---

## MDA Analysis of the Current State

### Mechanics (what exists)
- Turn-based loop: Invest → Plant → Advance → Harvest
- 12 plots, 3 crops with distinct risk/reward profiles
- Probabilistic weather (including 3 disaster-class events)
- Soil exhaustion with two recovery paths
- Tool upgrade tree (3 tiers, cumulative seed discounts)
- Relentless daily costs creating a survival clock
- Bankruptcy = run ends

### Dynamics (what emerges)
- Rotation planning around exhaustion cycles
- Risk exposure window management (Pumpkins vs. Blight)
- Capital allocation tension: seeds vs. upgrades vs. fertilizer
- Cash flow management under daily drain

### Aesthetics (current emotional experience)
- **Strong early**: discovery, tension, some genuine fear of bankruptcy
- **Weak mid/late**: once mechanics are understood and Tier 3 tools are purchased, the experience flattens. Survival becomes routine. The player has mastered the system but has nothing left to conquer.

### Root Cause (MDA Lens)
The mechanics are sound. The dynamics are real. The missing layer is **aesthetics** — specifically:
- **Sensation/Narrative**: no arc, no story beats, no landmark moments
- **Challenge**: no escalating difficulty beyond early survival
- **Fellowship/Achievement**: no goals to pursue, no milestones to celebrate

The game sits **below the flow channel** once the player stabilizes — skill outpaces challenge with no mechanism to restore balance.

---

## Player Type Gap Analysis (Bartle)

| Type | Motivation | Current Support | Gap |
|---|---|---|---|
| **Achiever** | Goals, milestones, progression | Only days-survived score | No targets to chase |
| **Explorer** | Discovery, secrets, unlocks | Tool upgrades (3 tiers only) | Nothing hidden, nothing to find |
| **Socializer** | Community, comparison | None | Out of scope (solo game) |
| **Killer** | Competition | None | Out of scope (solo game) |

The primary audience (casual-to-mid-core tycoon players) skews heavily **Achiever**. Currently, the game offers a single weak Achiever hook: peak balance and days survived on the run summary. That is a score, not a goal.

---

## Proposed Improvements

### Proposal 1 — The Season Arc (Goal Ladder)

**Problem it solves**: No win condition, no pacing, no narrative arc.

Replace the open-ended survival with a structured **Season system**. A season is 30 in-game days. The game's dramatic question becomes: *can you survive a full year — four seasons — and build a thriving farm?*

#### Season Structure

| Season | Days | Dominant Weather | Difficulty Modifier |
|---|---|---|---|
| Spring | Day 1–30 | Warm Breeze / Perfect Sun favored | Baseline |
| Summer | Day 31–60 | Drought / Sunny favored | Disaster chance +3% |
| Autumn | Day 61–90 | Overcast favored, Pest risk rises | Disaster chance +5% |
| Winter | Day 91–120 | Flash Drought / Blight favored | Disaster chance +7%, Lease fee +5 |

Each season has a distinct weather profile — not just cosmetic, but mechanically meaningful. Players must adapt their crop rotation to the current season's risk profile. Pumpkins become increasingly dangerous in Winter; Radishes become the safe backbone.

**At the end of Season 4 (Day 120)**: the player wins the run and sees a full career summary. This gives the "one-more-try" loop a clear destination.

**MDA Effect**: Adds a **Narrative** and **Challenge** aesthetic. The flow channel stays active across the full run because difficulty scales with seasons.

---

### Proposal 2 — Farm Contracts (Short-Term Achiever Hooks)

**Problem it solves**: No sub-goals between runs, no reason to vary crop strategy.

Each season, the player is offered **3 Farm Contracts** — optional objectives that pay a bonus if completed by end-of-season.

#### Example Contracts

| Contract | Reward | Forces |
|---|---|---|
| Harvest 8 Pumpkins this season | +150 coins | Player commits to long-growth crops |
| Survive 5 consecutive days without a plot going Exhausted | +80 coins | Strict rotation planning |
| End Season 1 with 300+ coins in reserve | +100 coins | Conservative play |
| Harvest during a Blight event (anything survives) | +120 coins | Accepting risk, not panic-planting |
| Apply Fertilizer at least 3 times this season | +60 coins | Teaches the fertilizer mechanic |

Contracts are drawn randomly from a pool — different each run — so players cannot optimize the same path twice.

**MDA Effect**: Extrinsic milestone rewards that reshape the **Achiever** experience. Also introduces **variable reward scheduling** (random contract draw each season) which drives engagement without being manipulative — the player always knows exactly what they are working toward.

---

### Proposal 3 — Farm Expansion (Capital Investment Target)

**Problem it solves**: After Tier 3 tools, there is nothing left to spend toward. Wealth accumulation loses meaning.

Add **Plot Expansion** as a late-game Shop item.

| Expansion | Cost | Effect |
|---|---|---|
| North Field (4 more plots) | 300 coins | 16 total plots |
| East Field (4 more plots) | 600 coins | 20 total plots |

More plots mean more revenue potential — but also more surface area for Pest Infestation to destroy. Expansion is a meaningful capital decision that changes the risk/reward calculus at high wealth.

This gives wealthy players a major purchase goal, prevents coin-hoarding (the 5% daily tax already punishes it — expansion spending is the productive alternative), and creates a visible sense of your farm *growing* over a run.

**MDA Effect**: Re-engages **Competence** (I built this farm up) and restores **economic tension** by creating a worthy new spending target at the top of the wealth curve.

---

### Proposal 4 — Run Legacy (Meta-Progression)

**Problem it solves**: Each run starts identically — no session-to-session payoff, no sense of building toward something.

After a completed or failed run, award the player a single **Legacy Bonus** for their next run based on performance. The bonus is small and non-dominant — it acknowledges skill without trivializing future runs.

| Performance Threshold | Legacy Bonus |
|---|---|
| Survived 10+ days | Start with 10 extra coins |
| Reached Season 2 | Start with Tier 1 tools already purchased |
| Completed a Contract | Start with 1 fertilizer in inventory |
| Survived all 4 seasons (won) | Unlock "Veteran" mode (harder weather pool) |

Bonuses do not stack between runs — only the highest earned bonus carries. This prevents runaway accumulation while rewarding improvement.

**MDA Effect**: Creates **intrinsic motivation** between sessions. Players care about each run not just for its own score, but for what they carry forward. This is the "one-more-try" loop's most powerful upgrade — it gives failing runs a purpose.

---

### Proposal 5 — Market Pulse (Endgame Economic Tension)

**Problem it solves**: Crop yields are fully predictable once weather multipliers are understood. High-wealth players have no interesting economic decisions.

Each season, a **Market Pulse** shifts the base yield of one crop by ±20%.

Examples:
- "Radish Glut — oversupply drives price down 20% this season."
- "Parsnip Shortage — export demand increases price 20% this season."

The market pulse is announced at season start and visible in the Shop. Players must weigh the current pulse when deciding which crops to plant — a mechanically simple change that adds a strategic layer requiring no new UI.

**MDA Effect**: Prevents the **dominant strategy** problem (always plant Pumpkins once Tier 3 tools are purchased). Keeps the decision space open and situationally interesting across all four seasons.

---

## Implementation Priority

Ranked by player impact vs. implementation effort:

| Priority | Proposal | Impact | Effort |
|---|---|---|---|
| 1 | **Season Arc** | Very High | Medium — mostly game loop changes |
| 2 | **Farm Contracts** | High | Medium — new UI component + contract pool |
| 3 | **Run Legacy** | High | Low — small state persisted to localStorage |
| 4 | **Farm Expansion** | Medium | Medium — grid layout changes |
| 5 | **Market Pulse** | Medium | Low — single seasonal modifier on crop yields |

---

## Flow Channel Projection

```
Current state:
     Anxiety
         ↑
         │
  Hard   │                          [Player here — below channel]
         │   ████
Skill    │ ████████
Level    │████████████
  Easy   │██████████████
         └──────────────────→
           Day 1            Day 30+

With proposals applied:
     Anxiety
         ↑
         │   [Season contracts + escalating weather keep player in channel]
  Hard   │           ████████████████
         │   ████████████████████████
Skill    │ ████████████████████████████
Level    │████████████████████████████████
  Easy   │████████████████████████████████
         └──────────────────→────────────→
           Day 1    Day 30   Day 60  Day 90+
```

The Season Arc escalates challenge. Contracts create sub-targets that maintain tension even when the economy is stable. Market Pulse prevents mastery from becoming autopilot.

---

## Summary

The game's core loop, economic design, and UI are all strong. The single missing layer is a **goal structure that gives skilled play somewhere to go**. These five proposals address that gap using the MDA framework:

- **Season Arc** — gives the run a shape and a finish line
- **Farm Contracts** — gives each day a sub-goal
- **Run Legacy** — gives each run meaning for the next
- **Farm Expansion** — gives wealth something to become
- **Market Pulse** — keeps decisions interesting at high skill

Together they transform Pixel Parsnips from a mechanics demonstration into a game players finish, restart, and compare runs with.

---

*p3 — Game Design Theory Proposal*
*Authored: 2026-04-09*
