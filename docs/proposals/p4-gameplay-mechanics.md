# P4 — Gameplay Mechanics Proposal: The "Why to Play"

**Based on:** DOCUMENTATION.md (current game state) + Gameplay Mechanics skill framework  
**Date:** 2026-04-09  
**Author:** Vaclav Balak × Claude Code

---

## 1. Diagnosis: What the Current Loop Is Missing

The current game is mechanically sound — the INVEST → PLANT → ADVANCE TIME → HARVEST & PAY loop works, the weather creates tension, and the bankruptcy fail state gives urgency. But applying the **Feedback Loop Timing Layers** from the Gameplay Mechanics framework reveals a structural gap:

```
FEEDBACK TIMING AUDIT (current state):
┌─────────────────────────────────────────────────────────────┐
│  IMMEDIATE (0-100ms):     ✅ Plot animations, HUD updates   │
│  SHORT-TERM (100ms-1s):   ✅ Day Summary modal, coin delta  │
│  LONG-TERM (1s+):         ❌ MISSING                        │
│    → No XP / score track                                    │
│    → No milestones to chase                                 │
│    → No win state — only a lose state                       │
│    → No escalation — Day 50 plays identically to Day 5      │
└─────────────────────────────────────────────────────────────┘
```

The short-term loop is satisfying (modal feedback is strong). The **long-term loop is absent**. Players master the optimal rotation (Pumpkins + fertilizer discipline + Tier 3 tools) and then face an empty horizon. There is no goal, no escalation, no victory — only delayed bankruptcy.

Additionally, the **skill ceiling collapses early**:

| Mechanic | Skill Floor | Skill Ceiling | Status |
|---|---|---|---|
| Crop selection | Low | Medium | Solved by Day 5 |
| Weather response | Medium | Medium | Passive — player can't act |
| Soil rotation | Medium | Medium | Solved by Day 10 |
| Capital allocation | Medium | High | ✅ Sustained but unsupported |

Once the player learns "buy Pumpkins, keep 2 plots resting, save for Tier 3 tools," there is no new mechanic to discover.

---

## 2. Design Objectives for P4

1. **Add a win condition** — give players something to achieve, not just avoid.
2. **Escalate difficulty over time** — Day 50 must feel harder than Day 5.
3. **Create short-term goals** that bridge each turn to the long-term arc.
4. **Increase strategic variance** — break the single dominant optimal strategy.
5. **Make the run summary richer** — more data = stronger "one-more-try" pull.

---

## 3. Proposed Mechanics

---

### Mechanic A — Season System (Win Condition + Escalation)

**The Core Problem it Solves:** No win state. No escalating difficulty.

#### How It Works

Divide each run into **Seasons of 20 days each**. Each season has:
- A **Survival Target**: a minimum coin balance the player must hold at the end of Day 20 to advance.
- **Escalating costs**: the Land Lease increases by +5 coins/day per season (Season 1: 15/day → Season 2: 20/day → Season 3: 25/day).
- **Harsher weather**: disaster probability increases per season (Season 1: 15% → Season 2: 20% → Season 3: 28%).

```
SEASON STRUCTURE:
┌──────────────────┬────────────────┬───────────────┬──────────────┐
│ Season           │ Days           │ Lease/Day     │ Disaster %   │
├──────────────────┼────────────────┼───────────────┼──────────────┤
│ Spring (1)       │ 1–20           │ 15 coins      │ 15%          │
│ Summer (2)       │ 21–40          │ 20 coins      │ 20%          │
│ Autumn (3)       │ 41–60          │ 25 coins      │ 28%          │
│ Winter (4+)      │ 61+            │ 30 coins      │ 35%          │
└──────────────────┴────────────────┴───────────────┴──────────────┘

SURVIVAL TARGET:
  End of Season 1: hold ≥ 150 coins  (1.5× starting balance)
  End of Season 2: hold ≥ 250 coins
  End of Season 3: hold ≥ 400 coins
  Beyond: survival mode — no target, just hold on
```

Failing the target doesn't end the run immediately — it triggers a **Coin Penalty** (lose 30% of balance), representing a "forced sale" of assets. This keeps the game alive but punishes underperformance meaningfully.

**Season Transition Reward:** Surviving a season grants a **bonus cash injection** (50 coins) + a brief Season Summary screen (alongside the existing run data). This creates a clear short-term victory moment.

#### Balance Notes (Economy Formula)
Using the skill's balance ratio formula:
- Season 1 income ceiling (12 plots, Pumpkins, Tier 3 tools): ~600 coins over 20 days
- Season 1 cost floor (lease only): 300 coins over 20 days
- Ratio: ~2.0 — too abundant; player should reinvest heavily into upgrades to normalize it
- Season 3 with Tier 3 tools and disaster pressure narrows this to ~1.1 — balanced tension

---

### Mechanic B — Daily Objectives (Short-Term Goal Layer)

**The Core Problem it Solves:** No short-term progression. Turns feel isolated from a larger arc.

#### How It Works

Each day, **one active Objective** is displayed in the HUD alongside the Day counter. Objectives are drawn from a pool and offer a **coin bonus** on completion.

```
OBJECTIVE POOL (examples):
┌──────────────────────────────────────┬──────────┬───────────────────────────┐
│ Objective                            │ Reward   │ Difficulty                │
├──────────────────────────────────────┼──────────┼───────────────────────────┤
│ Harvest 3+ crops today               │ +20 coins│ Easy — basic rotation     │
│ End the day above 200 coins          │ +25 coins│ Easy — capital discipline  │
│ Harvest during Perfect Sun           │ +35 coins│ Medium — weather-dependent │
│ Plant all 12 plots                   │ +30 coins│ Medium — full commitment   │
│ Survive a Disaster without harvesting│ +50 coins│ Hard — rare event          │
│ Reach 3 consecutive Pumpkin harvests │ +60 coins│ Hard — patience + risk     │
└──────────────────────────────────────┴──────────┴───────────────────────────┘
```

**Display:** A small Objective card appears below the Day/Coin cluster in the HUD. Completion flashes a brief reward notification inline (no modal interruption). Missed objectives simply expire.

**Why it works (skill framework):** Objectives inject the **Long-Term feedback layer** via a short-horizon proxy. A player who has no idea how to "get better" now has a concrete, legible micro-goal each turn. This is the missing bridge between the immediate (plant a crop) and the long-term (survive the season).

#### Balance Notes
- Objectives should be completable ~60% of the time at average play to keep them motivating but not mandatory.
- Rewards are small (5–15% of a day's income) — supplemental, not game-defining.

---

### Mechanic C — Crop Rotation Bonus (Breaking the Dominant Strategy)

**The Core Problem it Solves:** One optimal strategy collapses skill ceiling. Pumpkins dominate.

#### How It Works

Introduce a **Rotation Bonus**: when a plot that was previously rested (exhausted + recovered) is planted with a **different crop type** than the one that exhausted it, that plot yields a **+25% harvest bonus** on the next harvest.

```
ROTATION BONUS FLOW:
  Plot exhausted by 3× Pumpkin harvests
     ↓ natural rest (3 days) or fertilizer
  Plot replanted with Radish
     ↓ harvest
  Radish yields 12 coins × 1.25 = 15 coins  ← rotation bonus applied
  
  Compare: same plot replanted with Pumpkin → no bonus
```

**Visual signal:** A small golden leaf icon on the plot tile when the rotation bonus is active. Fits the existing visual language (plots already have state-based visual cues).

**Strategic Impact:**
- Pure Pumpkin loops: no bonus, higher exhaustion pressure
- Mixed rotations: bonus crops + healthier plots + faster soil recovery cycle
- Radishes become tactically relevant again (fast cycle, quick bonus activation)
- Creates a genuine rock-paper-scissors between Radish cadence, Parsnip balance, and Pumpkin peaks

---

### Mechanic D — Plot Unlocking (Spatial Progression Arc)

**The Core Problem it Solves:** Early game has no growth arc. Starting with 12 plots makes the farm feel "complete" from turn 1.

#### How It Works

Start each run with **8 plots** unlocked. The remaining 4 plots are visible but locked (greyed out, padlock icon). Plots unlock when the player reaches **coin milestones**:

```
UNLOCK MILESTONES:
  Start:            8 plots  (base)
  Reach 200 coins:  +2 plots → 10 plots
  Reach 500 coins:  +2 plots → 12 plots
```

Unlocking a plot is free — the coin milestone is the gate, not a purchase cost. This avoids an economic trap where unlocking plots conflicts with tool upgrades.

**Why it works:** The progression curve from the skill framework calls for **early game: fast hook, mid game: steady progress**. Right now both phases are identical. Starting with 8 plots gives early game a tight, focused feel. Expansion to 12 feels like a genuine reward — the farm visually grows.

**Run Summary addition:** Report "Peak plots active" alongside days survived and peak balance. This gives the run summary another performance vector, strengthening the "one-more-try" hook.

---

### Mechanic E — Market Fluctuation (Dynamic Crop Pricing)

**The Core Problem it Solves:** Crop values are static. Player only needs to optimise once.

#### How It Works

Every 5 days, the game rolls a **Market Event** for one crop type. Market Events temporarily shift that crop's yield value:

```
MARKET EVENTS (per crop, every 5 days):
┌───────────────────────┬────────────────────────────────────────┐
│ Event                 │ Effect                                 │
├───────────────────────┼────────────────────────────────────────┤
│ Bumper Harvest        │ -30% yield for this crop (3 days)     │
│  (oversupply)         │ "The market is flooded with Radishes"  │
├───────────────────────┼────────────────────────────────────────┤
│ Local Shortage        │ +40% yield for this crop (3 days)     │
│  (demand spike)       │ "Parsnips are scarce — prices up!"    │
└───────────────────────┴────────────────────────────────────────┘
```

**Market Event frequency:** Each crop has an independent 20% chance of a Market Event every 5 days. On average, one event fires every ~8 days — noticeable but not constant.

**Display:** A small market ticker line beneath the Coins display in the HUD. Active market events are shown on the relevant Seed Cards in the Shop (price indicator arrow up/down).

**Strategic Impact:** The player can no longer commit to a fixed crop plan and forget it. A Bumper Harvest on Pumpkins mid-season forces a pivot. A Shortage on Radishes rewards players who can quickly rotate. The optimal strategy now changes every few days.

---

### Mechanic F — Enriched Run Summary (Meta-Loop Hook)

**The Core Problem it Solves:** Run summary (days survived, peak balance) is thin. Players don't know what to do differently.

#### How It Works

Expand the bankruptcy screen to include:
- Days survived (existing)
- Peak balance (existing)
- Season reached (new — with Season system)
- Total crops harvested (new)
- Total disasters survived (new)
- Best single harvest day (new)
- Objectives completed (new — X of Y across the run)
- Suggested improvement hint (new — one line, contextual)

```
CONTEXTUAL HINT LOGIC:
  If died before Day 10 and lease drains > 40% of losses:
    → "Tip: Plant Radishes immediately — the lease never stops."
  
  If died with 3+ exhausted plots and no fertilizer used:
    → "Tip: Fertilizer on an exhausted plot saves 3 days of dead capacity."
  
  If survived Season 1 but failed Season 2 target:
    → "Tip: The lease increases in Summer — save more in Spring."
```

**Why it works:** The skill framework identifies "Progression feels grindy" as a solvable problem with "Give meaningful rewards more frequently." The run summary is the game's only persistent feedback moment. Enriching it converts a thin loss screen into an analytical debrief that gives the player a concrete reason to try again differently.

---

## 4. Priority & Sequencing

Not all proposals carry equal weight. Recommended implementation order:

| Priority | Mechanic | Rationale |
|---|---|---|
| **1** | Season System (A) | Provides the win condition — the most critical missing piece |
| **2** | Daily Objectives (B) | Cheapest to implement, highest immediate impact on "why" |
| **3** | Enriched Run Summary (F) | Amplifies every other mechanic by surfacing data |
| **4** | Crop Rotation Bonus (C) | Breaks dominant strategy, rewards existing soil system |
| **5** | Plot Unlocking (D) | Restructures early game arc — requires UX work |
| **6** | Market Fluctuation (E) | Highest complexity, adds variance but risks overwhelming new players |

Mechanics A + B + F together constitute a **minimum viable "why"**: a goal to chase (seasons), a turn-by-turn reward track (objectives), and a richer debrief on failure. The others deepen the system but are not required for the first pass.

---

## 5. Balance Checkpoint

Applying the skill's **Economy Balance Formula** across all proposals:

```
PROJECTED INCOME vs EXPENDITURE (Season 2, all mechanics active):
  Hourly Income:  Pumpkin rotation + Rotation Bonus + Objective rewards
  Hourly Spend:   Lease 20/day + Tax 5% + Fertilizer decisions + Season target pressure

  Balance Ratio target: 0.9–1.1  (tight, meaningful choices)
  
  Without Market Fluctuation:  ~1.2 (slightly abundant — player can optimize cleanly)
  With Market Fluctuation:     ~1.0 (balanced — forced pivots reduce optimization)
```

Market Fluctuation (Mechanic E) is thus the primary **balance regulator** for mid-to-late game. If Season 2+ feels too easy without it, Mechanic E is the first tuning lever to pull before adjusting raw numbers.

---

## 6. What This Does Not Propose

- **Meta-progression across runs** (persistent unlocks, unlockable crops): Out of scope for this proposal. The game's identity is a single-session survival arc. Persistent unlocks would require an account system or change the run-start balance, both of which alter the core identity.
- **Multiplayer / leaderboard**: Out of scope. A date-seeded daily challenge (same weather RNG for all players on a given day) is a lightweight alternative worth future consideration.
- **New crop types**: Not proposed here. The existing 3-crop triangle (speed vs. balance vs. yield) is sound. New crops would require rebalancing the whole economy before any of the above mechanics are implemented.

---

*Pixel Parsnips — P4 Gameplay Mechanics Proposal*  
*Document version 1.0 — April 2026*
