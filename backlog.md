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
| G3 | **Enriched run/season summary** — season reached, medals/tier, personal bests, contextual failure tip, milestones recap | High | S–M | p1·I6, p2·F, p4·F, p5·3.2 | **Partially landed via [006-season-system](specs/006-season-system/spec.md)**: BankruptcyScreen now shows "Season reached: N (Name)". Remaining: medals/tier, personal bests across runs, contextual failure tip, milestones recap. Bump to next sprint candidate. |
| G4 | **Daily objectives / milestone banners / farm contracts** — short-term goals each day or season with small coin rewards | High | M | p2·B, p3·2, p4·B, p5·3.5 | Three flavors converge here: per-day objectives (p4), per-season contracts (p3), event milestones (p2). Recommend starting with per-day objectives — cheapest, fastest validation. Contracts can layer on. |
| G5 | **Crop rebalance — buff Parsnip; consider new Truffle crop** — Parsnip yield 28→32 to make it a real choice; Truffle as season 3+ high-risk option | Medium | S (rebalance) / M (new crop) | p1·I4 | Parsnip buff is a one-line change. Truffle adds a new sprite, balance pass, unlock gate — defer until after G1 ships. |
| G6 | **Crop rotation bonus** — +25% yield when replanting an exhausted plot with a different crop | Medium | S–M | p4·C | Reinforces existing soil system; breaks Pumpkin-only optimization without new content. |
| G7 | **Market events / dynamic crop pricing** — temporary ±yield modifiers per crop, announced in advance | Medium | M | p1·I5, p3·5, p4·E | p1 proposes 3% daily roll, p4 proposes 20% per 5 days, p3 proposes once-per-season. p1's "announced 1 day ahead" pattern is the most player-fair. Acts as the late-game balance regulator (p4). |
| G8 | **Infrastructure upgrades (second shop track)** — Irrigation Well, Scarecrow, Compost Bin, Market Stall as disaster-mitigation purchases | Medium | M | p1·I3 | Adds ~850 coins of new sink capacity, gives wealth somewhere to go post-Tier-3. Distinct from G9 (plot expansion). |
| G9 | **Farm expansion (more plots as late-game purchase)** — North Field (+4 plots @ 300), East Field (+4 plots @ 600) | Medium | M | p3·3 | Alternative/complement to G8. Requires grid layout changes. Picks up where Tier 3 tools leave off. |
| G10 | **Plot unlocking (early-game growth arc)** — start with 8 plots, unlock to 10/12 at 200/500-coin milestones | Medium | M | p4·D | Restructures early game pacing. Conflicts with current "12 from day 1" — playtest before committing; some players may feel restricted. |
| G11 | **In-run narrative events** — authored 1–2 per season Farm Events with binary choices (Traveling Merchant, Bountiful Spring, Drought Warning) | Medium | M | p2·C | Adds memorable, shareable moments. Higher writing/design cost than mechanical items. Defer until G1+G4 are validated. |
| G12 | **Harvest streak counter** — consecutive harvest-days with small escalating coin bonuses (5/10/15/20) | Medium | S | p5·3.5 | Cheap turn-to-turn tension layer. Streak resets on missed-harvest days (droughts, pest events). Healthy design: no penalty, only forgone bonus. |
| G13 | **Farm Reputation tier (HUD title)** — cosmetic title that escalates with days survived (Struggling Smallholder → Master of the Harvest) | Low | S | p5·3.3 | Pure display change. Adds narrative arc to existing day counter. Could ship alongside G3. |
| G14 | **Persistent achievements** — small curated set stored in localStorage, earned once, multiple play styles covered | Low | M | p5·3.4 | Cross-run meta-layer. Watch for grind-bait designs ("harvest 1000 crops"); favor skill/resilience achievements. |
| G15 | **Run legacy / meta-progression bonuses** — small starting bonus on next run based on previous performance | Low | M | p3·4 | Non-stacking single-bonus design avoids power creep. Conflicts with monetization "Founder's pack" framing — make sure these don't overlap. |

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
| Escalating difficulty | p1, p2, p3, p4 | ✅ **Shipped with seasons** |
| Enriched run summary | p1, p2, p4, p5 | ⏳ Partial — Season-reached line shipped; medals/personal-bests/tips pending |
| Daily objectives / contracts | p2, p3, p4, p5 | Pending — Phase 2 candidate |
| Market events | p1, p3, p4 | Pending — Phase 3 candidate (primary late-game variance lever) |

---

## Suggested Phasing

**Phase 1 — "Give the run a shape"** ✅ shipped 2026-06-03 as [006-season-system](specs/006-season-system/spec.md)
~~G1 Season System~~ ✅ + ~~G2 Escalating Difficulty~~ ✅ + G3 Enriched Summary (partial — Season-reached line only) + G5 Parsnip rebalance (deferred)

**Phase 2 — "Give each day a hook"** ← **next up**
Finish G3 (medals + personal bests + contextual tip) + G4 Daily Objectives + G12 Harvest Streak + G13 Reputation Tier + F2 Disaster reveal juice + G5 Parsnip rebalance (still trivial, can slot anywhere)

**Phase 3 — "Give wealth somewhere to go"** (target: 1–2 sprints)
G7 Market Events + G8 Infrastructure Upgrades *or* G9 Farm Expansion (pick one to start) + G6 Rotation Bonus

**Phase 4 — "Depth & memorable moments"**
G11 Narrative Events + G14 Achievements + G15 Run Legacy + F1/F3 remaining juice

**Phase 5 — "Monetization"** (only after retention metrics validated)
M1 Rewarded Ads → M2 Founder's Pack → M3 Cosmetic Themes → (later) M4/M5

---

## Open Decisions (resolve before building)

1. ✅ ~~**Season length**: 20 days (p1, p4) or 30 days (p3)?~~ → **Resolved: 20 days** (shipped in 006).
2. ✅ ~~**Season failure mode**: hard run-end (p1) or 30% coin penalty + continue (p4)?~~ → **Resolved: hard run-end** (shipped in 006).
3. **G8 vs G9**: Infrastructure upgrades and farm expansion both target "post-Tier-3 sink." Pick the one that fits the planned art/UI budget; doing both risks bloat.
4. **G10 plot unlocking** conflicts with current "12 plots from start." Validate with a playtest before committing — could feel like a step backward to current players.

---

*Generated 2026-06-02 from p1–p6 analyses. Updated 2026-06-03 after shipping 006-season-system.*
