# Pixel Parsnips — Game Balancing Proposal (P1)

> **Problem Statement:** The game loop is functional and playable, but has no "WHY." Players
> learn the basics in the first 5 minutes, then grind indefinitely with no tension, goals, or
> reason to continue. Late game is actually *easier* than early game — more money means more
> buffer against disasters, inverted from good tension design.

---

## Economy Audit — Where the Game Breaks Down

Before proposing fixes, it helps to see the math that exposes the problem.

### Faucet vs. Sink Analysis (Current State)

| Resource | Faucets | Sinks | Net Flow | Verdict |
|---|---|---|---|---|
| Coins | Harvests (main) | Lease 15/day, Tax 5%, Seeds, Fertilizer, Upgrades | **Strongly positive post-Day 15** | Runaway inflation |
| Plots | Fixed 12 | Exhaustion (temporary, reversible) | Recovers automatically | No long-term pressure |
| Upgrades | — | 3 tiers at 50/120/250 coins | One-time sinks only | Empty after ~Day 25 |

### Endgame Steady-State (The Boring Part)

With 12 plots cycling Pumpkins at Tier 3 upgrades:

```
4 pumpkins harvest every 3 days → 4 × 65 = 260 coins income per 3-day cycle
Costs per cycle: (15 × 3) = 45 lease + ~5% tax on growing balance
At 800 coin balance: tax ≈ 13/day = 39 per cycle
Total costs per cycle ≈ 84
Net gain per cycle ≈ +176 coins → balance grows ~58 coins/day forever
```

**The problem in one sentence:** once players understand the Pumpkin loop + upgrade path
(reachable by Day 20–25), money compounds without bound and disasters become irrelevant noise.

### Root Cause

1. **No escalating difficulty** — lease and tax are flat; a 1000-coin balance is trivially safe
2. **No spending goals post-upgrades** — money piles up with nothing to buy
3. **No win/loss arc** — survival is open-ended; no milestone creates urgency
4. **Disaster impact reverses** — early game (low cash) disasters are catastrophic; late game (high cash) the same event is a shrug

---

## Proposed Improvements

Six targeted changes, ordered by expected impact. Each is independent so they can be implemented
incrementally. Change one system at a time and measure before proceeding to the next.

---

### Improvement 1 — Season System (Win Condition + Pacing Arc)

**Problem addressed:** No "WHY." Players have no target, no arc, no ending.

**Proposal:** Divide the game into **Seasons of 20 days each.** Each Season has a visible
**Survival Target** — a minimum coin balance the player must hold at the end of Day 20. Meeting
the target advances to the next Season (with harder conditions). Missing it ends the run.

| Season | Name | Days | Survival Target | New Condition Added |
|---|---|---|---|---|
| 1 | Spring Thaw | 1–20 | 150 coins | (baseline) |
| 2 | Summer Heat | 21–40 | 400 coins | Lease increases to 20/day |
| 3 | Autumn Pressure | 41–60 | 800 coins | Disaster probability rises to 22% |
| 4 | Winter Crunch | 61–80 | 1,400 coins | No positive weather events |
| 5+ | Deep Winter (loop) | +20/season | +600/season | Disaster frequency +3%/season |

**Why this works:**
- Creates a natural arc: every session has a "next target" that anchors focus
- Seasonal transitions reintroduce tension the player had eliminated through optimization
- "Deep Winter" looping season gives hardcore players an endless escalation
- Failure at Season 4 feels like earned difficulty, not arbitrary frustration
- Players can share "I made it to Season 3" as a meaningful benchmark

**Scoring:** Award medals at run end — Bronze (Season 1), Silver (Season 2), Gold (Season 3),
Platinum (Season 4+). Show medal on the run summary screen alongside Days Survived and Peak Balance.

---

### Improvement 2 — Escalating Land Lease

**Problem addressed:** Late game is easier than early game; flat costs mean money compounds
freely.

**Proposal:** Increase the Land Lease by **+2 coins every 5 days** (capped at 45 coins/day
in Deep Winter). Keep the 5% Daily Tax flat — it already scales with balance, which is fine.

| Days | Lease/Day | Daily Tax (at 300 balance) | Total Daily Cost |
|---|---|---|---|
| 1–5 | 15 | ~14 | ~29 |
| 6–10 | 17 | ~14 | ~31 |
| 11–15 | 19 | ~15 | ~34 |
| 16–20 | 21 | ~16 | ~37 |
| 21–25 | 23 | ~17 | ~40 |
| 41–50 | 31 | ~20 | ~51 |
| 61–80 | 39 | ~24 | ~63 |

**Why this works:**
- Forces players to continually grow *faster* than costs, not just reach a stable orbit
- Early upgrades remain valuable; late game urgency escalates naturally
- The rate (+2 every 5 days) is slow enough that players always have 5 days' notice before
  a new threshold bites — fair but relentless
- Caps at 45 to prevent the lease alone from becoming unfair

**Display:** Show the lease as "15 → 17 in 3 days" in the HUD when an increase is incoming.
Warn players via Day Summary modal on the day of increase. No hidden surprises.

---

### Improvement 3 — Infrastructure Upgrades (New Money Sinks)

**Problem addressed:** Post Tier 3 tool upgrade, money has nowhere to go. Infinite accumulation
is purposeless and removes tension.

**Proposal:** Add a second upgrade track — **Farm Infrastructure** — with four buildings that
each solve a specific pain point but cost enough to compete for budget with seeds and base upgrades.

| Building | Cost | Effect | Strategic Role |
|---|---|---|---|
| Irrigation Well | 180 coins | Flash Drought duration −1 day (stacking droughts become 1 day each instead of 2) | Mitigates the most disruptive disaster |
| Scarecrow | 220 coins | Pest Infestation plot destruction chance: 50% → 25% | Halves the worst-case outcome of the second disaster |
| Compost Bin | 150 coins | Exhaustion recovery: 3 days → 2 days (natural rest only) | Reduces idle plot time; pairs with a "rest plots" strategy |
| Market Stall | 300 coins | All crop yields +10% (additive, before weather multiplier) | Late-game income amplifier; only valuable once plot count is maxed |

**Why this works:**
- Four meaningful purchases at 150–300 coins each = ~850 total new sink capacity
- Each building rewards a distinct strategy: pest defenders, drought planners, rotation farmers, income scalers
- Creates a prioritization dilemma: "Do I buy Scarecrow now or save for Market Stall?"
- None is mandatory — all are risk-mitigation, which rewards players who understand which disasters
  hurt their current strategy most

**UI:** Add an "Infrastructure" tab in the Shop, visually separated from seed/fertilizer/tool purchases.
Show each building with its effect described in plain terms (not percentages alone).

---

### Improvement 4 — Crop Rebalancing + One New Crop

**Problem addressed:** Pumpkin is strictly dominant past Day 10. Crop selection isn't a real choice.

**Current ROI Analysis:**

| Crop | Cost (T0) | Yield | Days | Daily ROI | Observation |
|---|---|---|---|---|---|
| Radish | 5 | 12 | 1 | +7/day | Best early game cash flow |
| Parsnip | 10 | 28 | 2 | +9/day | Strictly worse than Radish (same cost/day ratio, slower) |
| Pumpkin | 20 | 65 | 3 | +15/day | Dominant — 2× better daily ROI than Radish |

Parsnip is currently the weakest option (worse daily ROI than both alternatives). This makes
crop selection a non-decision: Radish until you can afford Pumpkins, then Pumpkins forever.

**Rebalance:**

| Crop | Cost (T0) | Yield (proposed) | Daily Profit | Role |
|---|---|---|---|---|
| Radish | 5 | 12 | +7/day | Speed play: low exposure to multi-day disasters |
| Parsnip | 10 | **32** (+4) | **+11/day** | Balanced middle: better ROI than Radish, less disaster exposure than Pumpkin |
| Pumpkin | 20 | 65 | +15/day | High-risk, high-reward: longer window = more disaster exposure |

- **Parsnip yield: 28 → 32.** This makes Parsnip a genuine choice for players who want better
  returns than Radish without the 3-day Pumpkin exposure risk window.
- **Pumpkin unchanged** — it remains best ROI but its disaster exposure (3 days of Pest/Blight
  vulnerability) is its real cost, now more visible in contrast.

**New Crop — Truffle (Season 3+ unlock):**

| Crop | Cost | Growth Time | Base Yield | Special |
|---|---|---|---|---|
| Truffle | 50 | 5 days | 200 coins | Destroyed on Blight (0.1× → 0); immune to Pest Infestation |

- Massive ROI but 5-day exposure window and total Blight destruction create genuine risk
- Unlocked after reaching Season 3, adding a late-game decision point
- Immune to Pest gives an interesting counter-play: players can lean into Truffle during
  Pest-likely conditions (after two pest-free streaks) but must watch weather carefully

---

### Improvement 5 — Market Demand Events (Positive Variance Opportunity)

**Problem addressed:** Variance only goes one direction (negative disasters). Skilled players
have no weather "reads" to act on and no timing decisions beyond planting order.

**Proposal:** Add two positive market events (3% chance each per day) that create a **timing
decision** — plant a specific crop now to cash in on a coming price spike.

| Event | Probability | Effect | Duration |
|---|---|---|---|
| Radish Demand | 3% | Radish yield ×2 for the next 3 days | 3 days |
| Pumpkin Glut | 3% | Pumpkin yield ×0.6 for the next 3 days | 3 days |

- "Radish Demand" gives a reason to pivot away from Pumpkins (the optimal default) and
  plant Radishes to capitalize — a short-cycle, opportunistic play
- "Pumpkin Glut" punishes players over-invested in Pumpkins and rewards crop diversification
- Both events are **announced at the start of the effect window** (not retroactively), giving
  players one day to react — fair, but tight
- Net expected value is roughly neutral (+3% Radish days, −3% Pumpkin days); the mechanic is
  about decision-making, not free money

**Display:** Surface market events in the Day Summary modal alongside weather. Add a small
"Market" indicator row in the HUD showing active event duration (similar to Flash Drought countdown).

---

### Improvement 6 — Enriched Run Summary & Personal Bests

**Problem addressed:** The run summary shows "Days Survived" and "Peak Balance" — useful but
thin. The "one-more-try" hook needs more anchors to give players a concrete sense of progress
and clear next targets.

**Proposal:** Expand the run summary with:

1. **Season reached** — the headline metric ("You reached Season 3!")
2. **Medal tier** — Bronze / Silver / Gold / Platinum badge prominently displayed
3. **Personal bests panel** — shows all-time records across runs:
   - Furthest season reached
   - Most days survived
   - Peak balance achieved
   - Fastest Season 1 completion (fewest days to meet the 150 target)
4. **"How close" framing for near-misses** — if the player missed the Season target by
   ≤15%, show "You were 12 coins short of Season 4" to emphasize it was achievable
5. **Strategy hint on failure** — one line of contextual feedback based on what went wrong:
   - Died early from lease: "Tip: plant all 12 plots before Day 3 to cover lease costs"
   - Season target missed: "Tip: Infrastructure upgrades compound income faster than extra seeds late-season"
   - Disaster wipeout: "Tip: Diversify crop types — Radishes survive the Blight that kills Pumpkins"

Personal bests are stored in localStorage alongside the existing save state.

---

## Implementation Priority

| # | Improvement | Effort | Player Impact | Implement First? |
|---|---|---|---|---|
| 1 | Season System | Medium | **Critical** — gives the "WHY" | ✅ Yes |
| 2 | Escalating Lease | Low | High — restores late-game tension | ✅ Yes |
| 4 | Crop Rebalancing | Low | Medium — fixes Parsnip trap | ✅ Yes (simple numbers change) |
| 6 | Run Summary | Low | High — anchors replayability | ✅ Yes |
| 3 | Infrastructure Upgrades | Medium | High — eliminates idle money | After Season system |
| 5 | Market Events | Medium | Medium — adds skill ceiling | After Season system |

**Start with 1 + 2 + 4 + 6 as a single pass.** These four changes are either low-effort number
tweaks or a focused new UI element (season progress indicator + run summary expansion). Together
they give the game a clear arc, escalating pressure, and better crop decision-making without
requiring new art or major systems work. Playtest this pass before adding Infrastructure and
Market Events.

---

## Playtest Targets (Success Criteria)

After implementing Season System + Escalating Lease:

| Metric | Target | Red Flag |
|---|---|---|
| Season 1 completion rate | 70–80% | <60% = too hard, >90% = trivial |
| Season 2 completion rate | 40–55% | <30% = wall too steep |
| Median session length | 15–25 min | <10 min = not engaging enough |
| "One-more-try" restart rate | >60% | <40% = hook isn't landing |
| Days at which players typically go bankrupt (early) | Day 5–10 | <Day 3 = starting balance issue |

Track these metrics by adding a simple event log to localStorage (run number, season reached,
days survived, cause of death). Review after 20+ playthroughs.

---

## What Not to Change

- **Starting balance (100 coins)** — survives first-pass playtesting; only adjust if early
  bankruptcy rate spikes after lease escalation
- **Disaster probabilities (5% each)** — correct as-is for early seasons; Season 3+ bump is
  handled by the Season system, not a global change
- **Exhaustion system** — well-designed; the Compost Bin upgrade gives it more relevance without
  breaking the existing mechanic
- **Tax rate (5%)** — flat percentage naturally scales with wealth; leave it alone

---

*Document version 1.0 — April 2026*
*Based on game-balancing skill framework + current codebase audit*
