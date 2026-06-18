# Pixel Parsnips — Consolidated Backlog

> Synthesized from p1–p6 analysis documents. Items are merged where multiple documents
> propose the same or overlapping change. **Priority** reflects cross-document consensus
> and player-impact arguments. **Effort** uses S (≤1 day of work / pure number tweak),
> M (new UI surface + logic, ~2–5 days), L (new system, art, or backend, >1 week).

---

## Legend

- **Priority**: `High` (consensus across docs, blocks the "why play" gap) · `Medium` (deepens existing systems) · `Low` (polish or future-state)
- **Effort**: `S` small · `M` medium · `L` large
- **Refs**: source documents (p1=balancing, p2=core, p3=theory, p4=mechanics, p5=gamification, p6=monetization)

---

## Backlog — Gameplay & Design

| # | Item | Priority | Effort | Refs | Notes |
|---|------|----------|--------|------|-------|
| G1 | ✅ **Season System (win condition + arc)** — divide runs into named seasons (~20–30 days) with explicit Survival Targets, season summary, victory state | High | M | p1·I1, p2·A, p3·1, p4·A, p5·3.1/3.6 → **shipped as [006-season-system](specs/006-season-system/spec.md)** | **DONE (2026-06-03).** Shipped with 20-day seasons, p4-style gentle escalation, hard-end on missed target, finite 4-season arc + opt-in Endless mode. 17 tasks, 22 commits, 261 tests. |
| G2 | ✅ **Escalating difficulty curve (lease + disaster %)** — lease rises with days/season, disaster probability bumps per season | High | S | p1·I2, p2·D, p3·1, p4·A → **shipped with [006-season-system](specs/006-season-system/spec.md)** | **DONE (2026-06-03).** Bundled with G1 per scope decision in brainstorming. Lease 15→20→25→30 across S1–S4; disaster bands scale proportionally (15%→20%→28%→35%). |
| G3 | ✅ **Enriched run/season summary** — season reached, medals/tier, personal bests, contextual failure tip, milestones recap | High | S–M | p1·I6, p2·F, p4·F, p5·3.2 → **shipped as [007-enriched-run-summary](specs/007-enriched-run-summary/spec.md)** | **DONE (2026-06-04).** Bronze/Silver/Gold/Platinum medal tied to season reached; three persistent personal bests (days, peak, disasters) under a separate `pixel-parsnips-records` localStorage key; milestones recap with inline "🏆 New Best!" badges; contextual insight was already shipped in 005-ui-polish-core US5. 9 tasks, 9 commits. |
| G4 | ⛔ **Daily objectives / milestone banners / farm contracts** — short-term goals each day or season with small coin rewards | ~~High~~ Deferred | M | p2·B, p3·2, p4·B, p5·3.5 | **DEFERRED (2026-06-05)** after brainstorming. The row bundles three structurally different features (per-day pooled objectives, per-season contracts, retroactive milestone banners). Once examined against shipped work: (1) per-season **Contracts** duplicate the Survival Target already shown in the HUD by G1/006; (2) per-day **Objectives** compete with G12 Harvest Streak for the same "per-day hook" slot — Streak is cheaper, native to the existing harvest action, and carries loss-aversion teeth that pooled objectives don't; (3) **Milestone Banners** are really one-time in-run achievements and belong with G14, not with goal/contract systems. Shipping all three would create reward-soup (4 overlapping coin-bonus systems on the same day cycle). Revisit only if G12 + G13 + G14 ship and the "per-day hook" gap is still observably empty. |
| G5 | **Crop rebalance — buff Parsnip; consider new Truffle crop** — Parsnip yield 28→32 to make it a real choice; Truffle as season 3+ high-risk option | Medium | S (rebalance) / M (new crop) | p1·I4 | Parsnip buff is a one-line change. Truffle adds a new sprite, balance pass, unlock gate — defer until after G1 ships. **Post-010**: the simulator-tuned rebalance deliberately **kept all crop yields at baseline** (radish 5/12, parsnip 10/28, pumpkin 20/65) — challenge now comes from *structure* (few starting plots + escalating land cost + steeper targets), not crop margins. Per the 010 tuning log, compressing crop margins on top of the new sinks made the early game unwinnable. A Parsnip *buff* would now make the game easier than the tuned target band — re-validate against `npm run sim` before touching any crop number. Truffle (new crop) is unaffected and still open. |
| G6 | **Crop rotation bonus** — +25% yield when replanting an exhausted plot with a different crop | Medium | S–M | p4·C | Reinforces existing soil system; breaks Pumpkin-only optimization without new content. |
| ✅ G7 | **Market events / dynamic crop pricing** — temporary ±yield modifiers per crop, announced in advance | Medium | M | p1·I5, p3·5, p4·E | p1 proposes 3% daily roll, p4 proposes 20% per 5 days, p3 proposes once-per-season. p1's "announced 1 day ahead" pattern is the most player-fair. Acts as the late-game balance regulator (p4). <br>**DONE (2026-06-17).** Shipped as [012-market-events](specs/012-market-events/spec.md) — fixed 5-day cycle, one event at a time (shortage +40% / glut −30%), announced 1 day ahead, surfaced in Shop seed-card + Day Summary (no HUD chip). Pure `src/engine/market.ts`; schema 7→8. Sim-gated: `smartMixed` stayed in the 15–35% band (18.0% win / 1.08× overshoot, see [tuning-results.md](specs/012-market-events/tuning-results.md)); single-crop bots still fail (0% win). |
| G8 | **Infrastructure upgrades (second shop track)** — Irrigation Well, Scarecrow, Compost Bin, Market Stall as disaster-mitigation purchases | Medium | M | p1·I3 | Adds ~850 coins of new sink capacity, gives wealth somewhere to go post-Tier-3. Distinct from G9 (plot expansion). |
| G9 | **Farm expansion (more plots as late-game purchase)** — North Field (+4 plots @ 300), East Field (+4 plots @ 600) | Medium | M | p3·3 | Alternative/complement to G8. Requires grid layout changes. Picks up where Tier 3 tools leave off. |
| G10 | ✅ **Plot unlocking (early-game growth arc)** — start with 8 plots, unlock to 10/12 at 200/500-coin milestones | Medium | M | p4·D → **shipped as [010-plot-progression-rebalance](specs/010-plot-progression-rebalance/spec.md)** | **DONE (2026-06-08).** Shipped with simulator-tuned numbers: start at **4 plots**, buy up to **12** at escalating prices `[30, 55, 85, 120, 160, 210, 280, 360]` (purchases are the scaling capital sink the economy was missing, not milestone-gated freebies). New `buyPlot` engine fn + `unlockedPlots` state; `plantSeed` rejects locked plots; `LockedPlot` UI branch with a Buy button on the next purchasable plot. Schema bump 6→7 (old saves migrate to 12 unlocked, not retroactively punished). The "feels restrictive?" concern from the original note was resolved by tuning against the 009 simulator + a manual playthrough rather than guessing. |
| G11 | **In-run narrative events** — authored 1–2 per season Farm Events with binary choices (Traveling Merchant, Bountiful Spring, Drought Warning) | Medium | M | p2·C | Adds memorable, shareable moments. Higher writing/design cost than mechanical items. Defer until G1+G4 are validated. |
| G12 | ✅ **Harvest streak counter** — consecutive harvest-days with small escalating coin bonuses (5/10/15/20) | High | S | p5·3.5 → **shipped as [008-harvest-streak](specs/008-harvest-streak/spec.md)** | **DONE (2026-06-06).** Bonus capped at +20 (4× +5), streak count uncapped for HUD chip and the Longest-streak personal best. Resets on miss-days and at season boundaries (not on season_failed). Bonus is added to balance before the bankruptcy check, so it counts toward survival. |
| G13 | ✅ **Farm Reputation tier (HUD title)** — cosmetic title that escalates with days survived (Struggling Smallholder → Master of the Harvest) | Low | S | p5·3.3 | Pure display change. Adds narrative arc to existing day counter. **Post-007**: now layers cleanly on top of the medal system — could derive the title from `bestDaysSurvived` / `bestSeasonReached` already persisted by `records.ts`, no new state required. **DONE (2026-06-16).** Shipped as [011-farm-reputation-tier](specs/011-farm-reputation-tier/spec.md) — current-run, day-based front-loaded 7-tier ladder; pure display via new src/engine/reputation.ts; always-visible HUD chip; no state/schema change. |
| G14 | **Persistent achievements** — small curated set stored in localStorage, earned once, multiple play styles covered | Low | M | p5·3.4 | Cross-run meta-layer. Watch for grind-bait designs ("harvest 1000 crops"); favor skill/resilience achievements. **Post-007**: `records.ts` already owns a separate localStorage key (`pixel-parsnips-records`) with a tested load/migrate/defensive-parse pattern — achievements can follow the same shape (own `schemaVersion`, never crashes on malformed JSON, untouched by Restart). |
| G15 | **Run legacy / meta-progression bonuses** — small starting bonus on next run based on previous performance | Low | M | p3·4 | Non-stacking single-bonus design avoids power creep. Conflicts with monetization "Founder's pack" framing — make sure these don't overlap. **Post-007**: 007 deliberately kept `PersonalBests` display-only (per spec "Out of Scope"). The data needed for legacy bonuses (`bestDaysSurvived`, `bestPeakBalance`, `bestSeasonReached`, `mostDisastersSurvived`) is already persisted — wiring it back into `initialGameState` is the gating design decision, not an infrastructure cost. |

---

## Backlog — Game Feel & Polish

| # | Item | Priority | Effort | Refs | Notes |
|---|------|----------|--------|------|-------|
| F1 | **Juice pass — harvest moment** — coins fly to HUD with animation; counter ticks rapidly; per-crop harvest sounds | Medium | M | p2·E | Pure feedback layer. Validate after G1 ships — juice on a hollow loop is wasted effort. |
| F2 | **Juice pass — disaster reveal** — reveal disasters last in Day Summary; pest "scurrying" animation; Blight uses heavier visual weight | Medium | S–M | p2·E | Small modal-order change + a couple animations. Maximizes "dread-then-hit" moment. |
| F3 | **Juice pass — weather flavor** — distinct background tint per weather type in modal | Low | S | p2·E | Pure CSS/animation work. Low effort, low-but-cumulative impact. |
| F4 | **Bankruptcy "final day" sequence** — at 0–14 coins trigger a dramatic last-day playthrough instead of immediate end | Low | M | p2·E | Adds cinematic closure to runs. Requires state-machine work to defer end-of-run logic. |

---

## Backlog — Monetization (defer until retention proven)

| # | Item | Priority | Effort | Refs | Notes |
|---|------|----------|--------|------|-------|
| M1 | **Rewarded ads on bankruptcy screen** — opt-in: watch ad for +25 starting coins, or to reveal next-day weather category | Medium | S | p6·1 | Zero backend; ad SDK only. Bankruptcy screen is the only allowed surface. Cap at 1 ad/run. |
| M2 | **Founder's Pack ($0.99, 7-day window)** — cosmetic theme + Founder badge for early adopters | Medium | M | p6·4 | First-purchase conversion play. Needs Stripe + redemption code flow. Honest "7 days" framing only. |
| M3 | **Cosmetic farm themes ($1.99–3.99)** — Haunted, Winter, Desert, Neon visual reskins; bundle at $7.99 | Medium | L | p6·2 | Highest art cost. Strictly cosmetic (no contrast advantages). Requires redemption code flow for localStorage safety. |
| M4 | **Content DLC "Root Vegetable Season" ($2.99)** — new crops, weather events, plot expansion, Prestige mode | Low | L | p6·3 | High effort; only viable after content/retention is proven. Must add difficulty/breadth, never power. |
| M5 | **"Almanac Plus" subscription ($1.99/mo)** — monthly theme, run history, leaderboard, subscriber badge | Low | L | p6·5 | **Blocked**: requires backend, accounts, and server-side receipt validation. Do not start until M1–M3 prove revenue and a backend exists. |

---

## Cross-Document Consensus Summary

These are the items that appear in **3 or more** documents — strongest signal:

| Theme | Appears in | Status |
|---|---|---|
| Season system / win condition | p1, p2, p3, p4, p5 | ✅ **Shipped (006-season-system, 2026-06-03)** |
| Escalating difficulty | p1, p2, p3, p4 | ✅ **Shipped with seasons; rebalanced 2026-06-08 (010)** — lease 15/22/30/40, targets 105/230/390/480, tax 6%, starting balance 130, all simulator-tuned. |
| Enriched run summary | p1, p2, p4, p5 | ✅ **Shipped (007-enriched-run-summary, 2026-06-04)** — Season-reached line + medals + personal bests + first-run line + contextual tip all live on BankruptcyScreen |
| Daily objectives / contracts | p2, p3, p4, p5 | ⛔ **Deferred (G4, 2026-06-05)** — bundle splits into G12 (per-day hook), G14 (milestones-as-achievements), and Survival Target (already shipped in G1). No standalone build. |
| Market events | p1, p3, p4 | ✅ Shipped 2026-06-17 as [012](specs/012-market-events/spec.md) — 5-day cycle, one event at a time (shortage +40% / glut −30%), announced 1 day ahead. Sim-gated, smartMixed in band. |

---

## Tooling / Infrastructure delivered (not a p1–p6 item)

| Item | Status | Notes |
|---|---|---|
| **Balance simulator** | ✅ **Shipped ([009-balance-simulator](specs/009-balance-simulator/spec.md), 2026-06-08)** | Reusable Monte Carlo difficulty harness (`npm run sim`) that runs randomized games against the **real engine** under a swappable `EconomyConfig`, reporting win/bankrupt/target-miss rates, wealth overshoot, and per-season clear rates. Extracted all tunable numbers into `src/engine/economy.ts` (`DEFAULT_ECONOMY`); engine fns gained optional `config`/`rng` params (behavior-preserving). Strategy bots: `radishOnly`/`parsnipOnly`/`pumpkinOnly`/`smartMixed`. The `smartMixed` bot is the **difficulty floor**. Diagnosed the pre-010 problem (97% win, ~4× overshoot) and tuned every 010 number. Added one devDep (`tsx`). See [SIMULATION.md](SIMULATION.md) and [tuning-results.md](specs/010-plot-progression-rebalance/tuning-results.md). |

This is the measurement tool that should gate **all future balance work** (G5 crop tweaks, G7 market events, G8/G9 sinks): add a preset, run `npm run sim`, confirm `smartMixed` stays in the 15–35% win / ≈1.0–1.3× overshoot band before promoting numbers to `DEFAULT_ECONOMY`.

---

## Suggested Phasing

**Phase 1 — "Give the run a shape"** ✅ shipped 2026-06-03 as [006-season-system](specs/006-season-system/spec.md) + 2026-06-04 as [007-enriched-run-summary](specs/007-enriched-run-summary/spec.md)
~~G1 Season System~~ ✅ + ~~G2 Escalating Difficulty~~ ✅ + ~~G3 Enriched Summary~~ ✅ + G5 Parsnip rebalance (deferred)

**Phase 2 — "Give each day a hook"** ← **next up**
~~G4 Daily Objectives~~ (deferred 2026-06-05) + ~~G12 Harvest Streak~~ ✅ (shipped 2026-06-06) + G13 Reputation Tier + F2 Disaster reveal juice + G5 Parsnip rebalance (still trivial, can slot anywhere). The per-day hook gap is now filled by G12.

**Phase 3 — "Give wealth somewhere to go"** (target: 1–2 sprints) — *partially started*
~~G10 Plot unlocking~~ ✅ (shipped 2026-06-08 as [010](specs/010-plot-progression-rebalance/spec.md); escalating plot prices are now the primary scaling capital sink) + the simulator-tuned economy rebalance ([009](specs/009-balance-simulator/spec.md)+010). G7 Market Events ✅ (shipped 2026-06-17 as [012](specs/012-market-events/spec.md) — late-game variance regulator). Still open: G8 Infrastructure Upgrades *or* G9 Farm Expansion (pick one to start) + G6 Rotation Bonus.

**Phase 4 — "Depth & memorable moments"**
G11 Narrative Events + G14 Achievements + G15 Run Legacy + F1/F3 remaining juice

**Phase 5 — "Monetization"** (only after retention metrics validated)
M1 Rewarded Ads → M2 Founder's Pack → M3 Cosmetic Themes → (later) M4/M5

---

## Open Decisions (resolve before building)

1. ✅ ~~**Season length**: 20 days (p1, p4) or 30 days (p3)?~~ → **Resolved: 20 days** (shipped in 006).
2. ✅ ~~**Season failure mode**: hard run-end (p1) or 30% coin penalty + continue (p4)?~~ → **Resolved: hard run-end** (shipped in 006).
3. **G8 vs G9**: Infrastructure upgrades and farm expansion both target "post-Tier-3 sink." Pick the one that fits the planned art/UI budget; doing both risks bloat.
4. ✅ ~~**G10 plot unlocking** conflicts with current "12 plots from start." Validate with a playtest before committing — could feel like a step backward to current players.~~ → **Resolved: shipped** (010, 2026-06-08). New games start at 4 plots and buy up to 12; the concern was addressed by tuning the numbers against the 009 simulator plus a manual click-through rather than guessing, and old saves migrate to 12 unlocked so existing players aren't downgraded.

---

*Generated 2026-06-02 from p1–p6 analyses. Updated 2026-06-03 after shipping 006-season-system, then 2026-06-04 after shipping 007-enriched-run-summary, then 2026-06-05 after deferring G4 (Daily Objectives / Milestones / Contracts), then 2026-06-08 after shipping 009-balance-simulator (tooling) + 010-plot-progression-rebalance (G10 plot unlocking + simulator-tuned economy).*
