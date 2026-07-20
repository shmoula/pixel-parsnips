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
| G8 | ✅ **Infrastructure upgrades (second shop track)** — Irrigation Well, Scarecrow, Compost Bin, Market Stall as disaster-mitigation purchases | Medium | M | p1·I3 | **DONE (2026-07-19).** Shipped as [019-farm-buildings](specs/019-farm-buildings/spec.md) — unified Buildings track; absorbed the 3-tier tool ladder (collapsed into 🛠️ Toolshed); Farm Stand = renamed Market Stall; Season-2 gate + day-1 teaser; schema 8→9; sim-gated (buildings019 smartMixed ~17% win / 1.11× overshoot; final costs 100/100/130/150/200). |
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
| F1 | ✅ **Juice pass — harvest moment** — coins fly to HUD with animation; counter ticks rapidly; per-crop harvest sounds | Medium | M | p2·E → **shipped as [021-harvest-juice](specs/021-harvest-juice/spec.md)** | **DONE (2026-07-19).** Coin-flight celebration on fresh harvest-summary close (HUD holds the pre-turn balance, then rapid-ticks as coins land); per-crop Web-Audio chiptune SFX (zero assets, swappable to CC0 files behind `playSfx(id)`) + persistent HUD mute toggle (`pixel-parsnips-audio` key). Skippable on any input; reduced-motion = sounds only; no engine/schema change, no new deps. |
| F2 | ✅ **Juice pass — disaster reveal** — reveal disasters last in Day Summary; pest "scurrying" animation; Blight uses heavier visual weight | Medium | S–M | p2·E → **shipped as [013-disaster-reveal-juice](specs/013-disaster-reveal-juice/plan.md)** | **DONE (2026-06-19).** Staged "dread-then-hit" reveal in the Day Summary modal: opens neutral, then after ~700ms tints red and drops in a "Disaster!" badge + a single unified `DisasterBanner` (icon + title + body) shared by blight / pest / flash drought. Reopen via "Last Turn" or `prefers-reduced-motion` shows the resolved state immediately. New `useReducedMotion` + `useDisasterReveal` hooks; inline disaster lines removed from DailyLog (now in the banner); `role="alert"`/`aria-live` so the staged reveal is announced to screen readers. Pure presentation — no engine/type/schema change. Built via subagent-driven-development (two-stage review per task); 455 tests, lint green. PR #6. |
| F3 | **Juice pass — weather flavor** — distinct background tint per weather type in modal | Low | S | p2·E | Pure CSS/animation work. Low effort, low-but-cumulative impact. |
| F4 | **Bankruptcy "final day" sequence** — at 0–14 coins trigger a dramatic last-day playthrough instead of immediate end | Low | M | p2·E | Adds cinematic closure to runs. Requires state-machine work to defer end-of-run logic. |
| F5 | ✅ **Player onboarding ("Your First Harvest")** — first-run guided overlay (fill plots with radishes → advance → payoff) + always-on empty-day safeguard + run-end "Replay tutorial". | High | M | UI.md #5 → shipped as [014-player-onboarding](specs/014-player-onboarding/spec.md) | **DONE.** Own localStorage key (survives Restart); turn-1 weather pinned safe; analytics deferred to A1. |
| F6 | **Farm-scene building sprites** — owned 019 buildings get pixel sprites anchored on the 018 backdrop | Low | S–M | 019 follow-up | Pure presentation; shop cards + banner lines shipped in 019. |
| F7 | **Mobile lease visibility** — surface the per-day lease at mobile widths (`HUD.tsx` Lease/Tax block is `hidden sm:flex`, so <640px players can't see `season.leasePerDay` before advancing). | Low | S | UI.md audit (open item) | The runaway-bankruptcy risk is already guarded by the 014 empty-day confirm + unwinnable banner, so this is now a *planning* affordance, not a safety fix. Suggested form: a compact `−15🪙/day` sub-label under the always-visible coin balance chip. |
| F8 | **Autosave indicator** — a subtle "Saved ✓" flash in the HUD after significant actions (Next Day, plant, purchase), ~1s then fade. | Low | S | UI.md audit (open item) | The game already autosaves to localStorage after every action; players have no signal it happens. Pure feedback layer — reduces "closed the tab, did I lose my run?" anxiety. |

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

## Backlog — Analytics & Instrumentation (prepare as one batch)

> Decision (2026-06-26, onboarding brainstorm): **do not** wire analytics piecemeal per feature.
> Stand up one event/telemetry layer and instrument all events together, then design the event
> schema (`name` + typed property bag + per-event version) so call sites never change when the sink does.
>
> **Update (2026-07): the shared layer shipped as [017-analytics](specs/017-analytics/spec.md)** — and
> went past the originally-planned "local logging" v1 to a real privacy-first **PostHog** sink (EU host,
> no-op when no project key is set, `Do-Not-Track` + local opt-out both honored via `isTrackingAllowed`,
> `AnalyticsOptOutToggle` UI). So the batch is now: **layer + core gameplay funnel = done; the
> onboarding-specific step funnel (A1) is the remaining piece.**

| # | Item | Priority | Effort | Refs | Notes |
|---|------|----------|--------|------|-------|
| A0 | ✅ **Privacy-first analytics layer + core gameplay funnel** — shared event layer plus the P0+P1 gameplay events | — | M | 2026-06-26 batch decision → **shipped as [017-analytics](specs/017-analytics/spec.md)** | **DONE.** `src/analytics/` (config · consent · track · events · globals · `useAnalyticsEvents`). Ships these events: `page_loaded`, `play_started` (carries `onboarding_active`), `milestone_reached` (`first_plot_unlocked` / `season_2_reached`), `day_completed`, `plot_unlocked`, `season_completed`, `run_ended`. State-derived via a render-diff hook, once-per-run guards, per-event schema versions (`ANALYTICS_SCHEMA_VERSION`). This is the shared layer A1 was waiting on. |
| A1 | ✅ **Onboarding funnel events** — the granular step funnel on top of A0's layer. Track: step reached (`welcome`/`open-shop`/`buy-radish`/`plant`/`advance`/`payoff`/`done`), skip point (which step the player skipped from), completion, and tutorial replay. Plus the empty-Next-Day **safeguard trigger** (how often players hit the bankruptcy guard). | Medium | S | player-onboarding skill (references: `onboarding-analytics`, `metrics-blind-onboarding`) | **DONE (code shipped; dashboard tiles await first seed pass).** Shipped as [020-onboarding-analytics](specs/020-onboarding-analytics/spec.md): `onboarding_step_reached` / `onboarding_completed` / `onboarding_skipped` / `onboarding_replay_requested` + `empty_day_safeguard` (all players, with `onboarding_active`), emitted from the 014 step-machine seams (`useOnboarding`), plus replay from `App` and safeguard from `GameBoard`. Canonical step name is `buy-radishes` (not `buy-radish`); `done` is never emitted (terminal outcome is `onboarding_completed` XOR `onboarding_skipped`). "Pixel Parsnips — Onboarding" dashboard (id 834144) provisioned via MCP with 6 tiles — funnel, skip points, completion vs skip, replay requests, safeguard behavior + context; tiles validate once a first seed pass (play/replay/skip + empty-day advance/cancel with `VITE_POSTHOG_KEY` set) lands the events in PostHog. |

---

## Suggested Phasing

**Phase 1 — "Give the run a shape"** ✅ shipped 2026-06-03 as [006-season-system](specs/006-season-system/spec.md) + 2026-06-04 as [007-enriched-run-summary](specs/007-enriched-run-summary/spec.md)
~~G1 Season System~~ ✅ + ~~G2 Escalating Difficulty~~ ✅ + ~~G3 Enriched Summary~~ ✅ + G5 Parsnip rebalance (deferred)

**Phase 2 — "Give each day a hook"** ✅ shipped
~~G4 Daily Objectives~~ (deferred 2026-06-05) + ~~G12 Harvest Streak~~ ✅ (shipped 2026-06-06) + ~~G13 Reputation Tier~~ ✅ (shipped 2026-06-16 as [011](specs/011-farm-reputation-tier/spec.md)) + ~~F2 Disaster reveal juice~~ ✅ (shipped 2026-06-19 as [013](specs/013-disaster-reveal-juice/plan.md)) + G5 Parsnip rebalance (still trivial, can slot anywhere). The per-day hook gap is now filled by G12.

**Phase 3 — "Give wealth somewhere to go"** (target: 1–2 sprints) — *partially shipped* ← **next up**
~~G10 Plot unlocking~~ ✅ (shipped 2026-06-08 as [010](specs/010-plot-progression-rebalance/spec.md); escalating plot prices are now the primary scaling capital sink) + the simulator-tuned economy rebalance ([009](specs/009-balance-simulator/spec.md)+010). ~~G7 Market Events~~ ✅ (shipped 2026-06-17 as [012](specs/012-market-events/spec.md) — late-game variance regulator). ~~G8 Infrastructure Upgrades~~ ✅ (shipped 2026-07-19 as [019-farm-buildings](specs/019-farm-buildings/spec.md)). Still open: G9 Farm Expansion + G6 Rotation Bonus.

**Phase 4 — "Depth & memorable moments"**
G11 Narrative Events + G14 Achievements + G15 Run Legacy + F3 remaining juice

**Phase 5 — "Monetization"** (only after retention metrics validated)
M1 Rewarded Ads → M2 Founder's Pack → M3 Cosmetic Themes → (later) M4/M5

---

## Open Decisions (resolve before building)

1. ✅ ~~**Season length**: 20 days (p1, p4) or 30 days (p3)?~~ → **Resolved: 20 days** (shipped in 006).
2. ✅ ~~**Season failure mode**: hard run-end (p1) or 30% coin penalty + continue (p4)?~~ → **Resolved: hard run-end** (shipped in 006).
3. ✅ ~~**G8 vs G9**: Infrastructure upgrades and farm expansion both target "post-Tier-3 sink." Pick the one that fits the planned art/UI budget; doing both risks bloat.~~ → **Resolved: G8 shipped first** (019-farm-buildings, 2026-07-19). G9 (Farm Expansion) remains open.
4. ✅ ~~**G10 plot unlocking** conflicts with current "12 plots from start." Validate with a playtest before committing — could feel like a step backward to current players.~~ → **Resolved: shipped** (010, 2026-06-08). New games start at 4 plots and buy up to 12; the concern was addressed by tuning the numbers against the 009 simulator plus a manual click-through rather than guessing, and old saves migrate to 12 unlocked so existing players aren't downgraded.

---

*Generated 2026-06-02 from p1–p6 analyses. Updated 2026-06-03 after shipping 006-season-system, then 2026-06-04 after shipping 007-enriched-run-summary, then 2026-06-05 after deferring G4 (Daily Objectives / Milestones / Contracts), then 2026-06-08 after shipping 009-balance-simulator (tooling) + 010-plot-progression-rebalance (G10 plot unlocking + simulator-tuned economy), then 2026-06-16 after shipping 011-farm-reputation-tier (G13), then 2026-06-17 after shipping 012-market-events (G7), then 2026-06-19 after shipping 013-disaster-reveal-juice (F2), then 2026-06-26 after shipping 014-player-onboarding (F5), then 2026-07 after shipping 015-mobile-ux-polish + 016-ux-ui-polish (UI.md audit fixes — empty-plot affordance, reduced-motion, low-balance warning, shop discoverability, disaster/drought banners, upgrade contrast, semantic type scale) + 017-analytics (A0 analytics layer + core gameplay funnel; A1 onboarding funnel still open) + 018-prettier-assets (crop art, illustrated backdrop, wooden shop), then 2026-07-19 after shipping 019-farm-buildings (G8 Infrastructure upgrades — unified Buildings track, Toolshed collapse, Farm Stand, Season-2 gate, schema 8→9), then 2026-07-20 after shipping 020-onboarding-analytics (A1 onboarding funnel + skip/completion/replay + empty-day safeguard events + "Pixel Parsnips — Onboarding" dashboard) + 021-harvest-juice (F1 harvest-moment juice — coin-flight celebration, per-crop Web-Audio SFX, HUD mute toggle; no engine/schema change).*
