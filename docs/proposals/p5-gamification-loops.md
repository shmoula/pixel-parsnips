# Pixel Parsnips — Gamification Loops Proposal

> Grounded in the Gamification Loops skill (patterns, sharp edges, validations)

---

## 1. Diagnosis: Why Players Stop

Pixel Parsnips has a functional core loop — **Invest → Plant → Advance Time → Harvest & Pay** — but it stalls as an engagement system. Using the Core Loop Framework from patterns.md:

```
TRIGGER    → "I wonder if I can do better this run"        ✓ (weak)
ACTION     → Plant, manage soil, advance days               ✓
REWARD     → Coins + weather outcome                        ✗ (shallow)
INVESTMENT → "I put coins in, I'll get more out"            ✓ (partial)
```

The reward step is where the loop breaks. Coins are purely instrumental — they have no value beyond delaying bankruptcy. There is no **endgame** to strive for, no **milestones** that mark meaningful progress, and no **meta-layer** that persists across runs. Players correctly intuit there is nothing to unlock, nothing to prove, and nothing to compare against.

### Validated Failure Modes

Checking against `validations.md`:

| Validation Check | Status | Evidence |
|---|---|---|
| Users should feel sense of completion | **FAIL** | No win state, no chapter end, just endless days until bankruptcy |
| Gamification should enhance intrinsic value | Partial | The farming loop has tension but no payoff arc |
| Users should be able to stop without penalty | Pass | Bankruptcy is a clean off-ramp |
| Rewards should be hard to game | N/A (no rewards) | — |

The primary failure is `no-completion`: the engagement feels like a treadmill with no finish line. Secondary failure: reward-only-motivation risk — if the only feedback is coin delta, the game trains players to optimise for a number that ultimately means nothing.

---

## 2. Design Principles for This Game

Before proposing mechanics, constraints:

- Pixel Parsnips is **single-player, browser-native, session-based** — no social layer, no push notifications, no live service pressure.
- The run structure (start fresh on bankruptcy) is a **feature**, not a limitation. Roguelite replayability already exists; it just lacks reasons to replay.
- The risk of **motivation crowding** (sharp_edges.md) is real: this game has genuine intrinsic tension (weather RNG, soil rotation, disaster response). Any gamification layer must **enhance** that tension, not replace it with point-chasing.
- Per `sharp_edges.md / addiction-not-engagement`: the game should provide **natural completion points** and let players walk away satisfied, not compelled.

---

## 3. Proposed Systems

### 3.1 — Run Objectives: Give Each Run a Purpose

**Problem it solves:** `no-completion` validation failure — there is no chapter, no win condition.

**Mechanic:** Before a run begins (or at start), the player is presented with a **Season Goal** — a concrete target for this run. The goal defines a "win" that is separate from the existing "survive as long as possible" implicit goal.

#### Season Goal Examples

| Goal Tier | Example | Difficulty |
|---|---|---|
| Starter | Survive 15 days | Easy — tutorial frame |
| Apprentice | Reach a peak balance of 300 coins | Moderate |
| Skilled | Harvest 5 Pumpkins in a single run | Requires tool investment |
| Expert | Survive a Pest Infestation without losing all crops | Disaster management |
| Master | Reach Tool Tier 3 before Day 25 | Aggressive economy |

**Design rationale (patterns.md — Milestone Moments):**
> "Design milestones that mark meaningful progress, unlock new capabilities, celebrate achievement, set new goals."

Season Goals create a **named completion state**. When a player hits their goal, the run is _won_ — they can choose to keep farming or restart with a harder goal. This transforms bankruptcy from "you failed" into "you ran out of time trying" — a meaningful distinction.

**Ethical check (sharp_edges.md):**
- Player can still ignore goals and just survive — no penalty for disengaging from this system.
- Goals are informational, not coercive.

---

### 3.2 — Personal Best Board: Compete Against Yourself

**Problem it solves:** The run summary (days survived, peak balance) exists but creates no lasting comparison frame.

**Mechanic:** Expand localStorage tracking to record a **Personal Best profile** across all runs:

| Tracked Metric | Shown As |
|---|---|
| Best days survived | "Your record: 34 days" |
| Highest peak balance | "Peak wealth: 847 coins" |
| Most crops harvested in one run | "Best harvest run: 31 crops" |
| Most disasters survived | "Disasters weathered: 7" |
| Fastest Tool Tier 3 unlock | "Speed record: Day 18" |

On the game-over screen, show **which personal bests were beaten this run**, highlighted in gold. If none were beaten, show the gap ("3 days short of your record").

**Design rationale (patterns.md — Progress Systems, social competition row):**
> "Personal bests — compete with yourself."

And from `sharp_edges.md / leaderboard-demoralization`:
> "Only top 10% motivated. Bottom 90% demotivated."

A global leaderboard would demotivate the majority. Personal bests sidestep this entirely — every player is always competing against an achievable target: their own previous run.

**Variable reward schedule (patterns.md — Reward Systems):**
Personal bests naturally create variable ratio rewards — you don't know which record you'll break on a given run. This is the most engaging reward schedule.

---

### 3.3 — Farm Reputation Tier: Named Progress Within a Run

**Problem it solves:** Players have no sense of "where they are" in a run's arc. Day 14 feels identical to Day 4.

**Mechanic:** Assign a **Reputation Tier** based on days survived, displayed in the HUD. This is purely cosmetic/informational — no mechanical effect.

| Tier | Threshold | Title |
|---|---|---|
| 1 | Day 1–5 | Struggling Smallholder |
| 2 | Day 6–12 | Apprentice Farmer |
| 3 | Day 13–20 | Seasoned Grower |
| 4 | Day 21–30 | Respected Agronomist |
| 5 | Day 31+ | Master of the Harvest |

**Design rationale (patterns.md — Progress Bar Psychology — Endowed Progress):**
> "Start at 20%, not 0% — you're already on your way!"

Starting as "Struggling Smallholder" implies a ladder. Even surviving to Day 6 is a visible tier-up. The titles also carry narrative weight that raw numbers don't — "Master of the Harvest" is a reward in itself.

**Ethical check:** No mechanical gate. No penalty for not advancing. Purely informational reward.

---

### 3.4 — Persistent Achievements: A Meta-Layer Across Runs

**Problem it solves:** Nothing survives a run. There is no cross-run investment.

**Mechanic:** A small, curated set of **Achievements** stored in localStorage, earned once and never lost. Achievable through diverse play, not grinding.

#### Achievement Examples

| Category | Achievement | Condition |
|---|---|---|
| Milestone | First Harvest | Harvest any crop |
| Milestone | First Pumpkin | Harvest a Pumpkin |
| Resilience | Disaster Survivor | Survive a Blight, Pest, or Drought in a single run |
| Mastery | Full Tool Kit | Reach Tool Tier 3 in any run |
| Efficiency | Rotation Master | Never have more than 2 plots exhausted simultaneously |
| Endurance | Two-Week Farmer | Survive 14 days |
| Endurance | Month-Long Season | Survive 30 days |
| Wealth | Coin Hoarder | Reach 500 coins in a single run |
| Recovery | Phoenix Farmer | Reach below 50 coins and recover to 200+ without restarting |

**Design rationale (patterns.md — Progress Systems — Branching):**
> "Multiple paths — different types of achievers."

Achievements cover multiple play styles: survival-focused, wealth-focused, efficiency-focused. A player who keeps going bankrupt early can still unlock "First Pumpkin" or "Disaster Survivor" — progress is always available.

**Anti-overjustification guard (sharp_edges.md — Motivation Crowding):**
Achievements should be **informational** and **unexpected** where possible. They should acknowledge what the player already did well, not direct behaviour in a controlling way. No achievement should read as "do X grind to unlock Y" — only "if you naturally do X, you'll see this acknowledged."

---

### 3.5 — Harvest Streaks: In-Run Tension Layer

**Problem it solves:** Individual turns feel disconnected. There is no turn-to-turn momentum.

**Mechanic:** Track a **Harvest Streak** — the number of consecutive days on which at least one crop was harvested. Display it as a small counter in the HUD. Award a small coin bonus for maintaining streaks.

| Streak Length | Bonus |
|---|---|
| 3 days | +5 coins |
| 5 days | +10 coins |
| 7 days | +15 coins |
| 10+ days | +20 coins (max) |

A day with no harvest (because all crops are still growing, or all plots are exhausted) resets the streak to zero.

**Design rationale (patterns.md — Streak Mechanics — Streak Psychology):**
> "Loss aversion: losing a streak hurts more than gaining it. Creates commitment."

This creates active tension during Flash Droughts (no planting → no harvest → streak breaks) and Pest Infestations (crops destroyed mid-growth → harvest gaps). The streak mechanic makes existing disaster events feel more consequential without adding new content.

**Healthy design check (patterns.md — Healthy Streak Design):**
- No harsh penalty for breaking — only a missed bonus, not a deduction.
- Streak is within a single run — no cross-session anxiety.
- The daily ask is "plant something" — a behaviour already central to the game.

---

### 3.6 — Season Goals Difficulty Ladder: The "WHY to Return"

**Problem it solves:** Once a player has beaten the easy goals, what pulls them back?

**Mechanic:** Season Goals unlock in sequence. Completing a goal unlocks the next tier. This creates a **long-term progression arc** that spans many runs.

```
STARTER GOALS (run 1–3)
  ↓ complete any one
APPRENTICE GOALS (runs 4–8)
  ↓ complete any two
SKILLED GOALS (runs 9–15)
  ↓ complete any two
EXPERT GOALS (runs 16+)
  ↓ complete any two
MASTER GOALS (endgame)
```

Each tier reveals 2–3 goal options, and the player picks one to attempt. This is the **branching progress** pattern from patterns.md — multiple paths to advancement, preventing the single path from feeling like a grind.

**Ethical check (validations.md — no-completion):**
Master Goals represent a genuine finish line. A player who completes all Master Goals has "beaten" Pixel Parsnips. This is intentional — per `sharp_edges.md`, the game should have **finite daily goals** and **completion states**, not an infinite treadmill.

---

## 4. Implementation Priority

Ordered by impact-to-effort ratio:

| Priority | System | Why First |
|---|---|---|
| 1 | Personal Best Board | Tiny scope (localStorage), high immediate impact on replayability |
| 2 | Farm Reputation Tier | Pure display change, adds narrative arc immediately |
| 3 | Harvest Streak | Small logic addition, meaningful tension layer on existing disasters |
| 4 | Persistent Achievements | Medium scope (achievement tracking), highest cross-run retention impact |
| 5 | Season Goals | Largest scope, but the true answer to "WHY to play" |

---

## 5. What to Avoid

From `sharp_edges.md` and `validations.md`, the following patterns would harm this game:

| Pattern | Why Risky Here |
|---|---|
| Global leaderboard | Single-player game; 90% of players would see scores they can't beat — demotivates |
| Streak with harsh penalties | Disaster events already punish players; adding streak loss *on top* creates compounding frustration |
| Daily login bonuses | Browser game with no accounts — wrong surface; also crosses into addiction-not-engagement territory |
| Infinite XP progression | The treadmill problem — if the progression never ends, it stops feeling like progress |
| Achievement grinding | Achievements like "harvest 1000 crops" reward time invested, not skill — metric gaming risk |

---

## 6. Success Signals

After implementing these systems, engagement health can be measured by:

| Signal | Healthy Indicator |
|---|---|
| Return sessions | Player restarts immediately after bankruptcy |
| Goal pursuit | Player actively adjusts strategy toward Season Goal |
| Achievement diversity | Players unlock achievements from multiple categories (not just endurance) |
| Run length distribution | Average run length increases as players internalise strategy |
| Player-expressed motivation | "I'm trying to beat my record" vs "I don't know why I'm playing" |

---

*Analysis grounded in Gamification Loops skill — patterns.md (Core Loop Design, Progress Systems, Reward Systems, Streak Mechanics), sharp_edges.md (addiction-not-engagement, motivation-crowding, leaderboard-demoralization), validations.md (no-completion, reward-only-motivation, no-off-ramp).*
