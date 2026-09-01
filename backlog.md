# Pixel Parsnips — Consolidated Backlog

> Synthesized from p1–p6 analysis documents. Items are merged where multiple documents
> propose the same or overlapping change. **Priority** reflects cross-document consensus
> and player-impact arguments. **Effort** uses S (≤1 day of work / pure number tweak),
> M (new UI surface + logic, ~2–5 days), L (new system, art, or backend, >1 week).
>
> **Source docs relocated (2026-07-21):** p1–p6 moved from the repo root to
> [`docs/proposals/`](docs/proposals/) — kept as dated reference, not an active plan.

---

## 2026-07-21 Triage — Decisions

A full walk-through of the open backlog. Project intent confirmed as **portfolio / hobby**,
which takes the entire Monetization section off the table.

| Item | Decision | Rationale |
|---|---|---|
| **G5 Parsnip buff (28→32)** | ❌ **Skip (resolved)** | Sim disproves the p1 premise. Against the current tuned economy: `parsnipOnly` **20.5% win — the best single-crop strategy**, `pumpkinOnly` **0% win / 100% bankrupt**, `radishOnly` 0.1%. p1's "Parsnip is a trap / Pumpkin dominates" analysis was written pre-010. Buffing Parsnip would over-tune the strongest solo crop. |
| **G5 Truffle (new crop)** | 💤 Defer | Content, not a fix. Parked as "someday." |
| **G6 Rotation bonus** | ❌ Skip | Its goal (break Pumpkin-only optimization) is already met by shipped **012 Market Events** variance + the fact that Pumpkin-only now bankrupts 100% of the time. Redundant. |
| **G9 Farm expansion** | ❌ Skip | The "post-Tier-3 sink" it targets is already filled by **G8 buildings** + **G10 escalating plot prices**. Adding a third sink risks bloat (Open Decision #3 already chose G8). |
| **G11 Narrative events / contracts** | ✅ **Do — top pick** | The single biggest *un-built* gameplay layer. Highest replay value of anything left. Fold the deferred **G4** per-day objectives into this rather than building them standalone. |
| **G14 Achievements** | ✅ **Do — cheap** | `records.ts` already provides the persistence pattern; low effort, good portfolio polish. |
| **G15 Run legacy** | ❌ Skip | Breaks the single-session roguelite identity (p4's argument); balance risk > payoff for a hobby build. |
| **M1–M5 Monetization** | 🗄️ Archived | Out of scope for a portfolio/hobby project. |

**Net remaining plan: G11 (with G4 folded in) → G14.** Everything else is shipped, skipped, or parked.

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
| G5 | ❌/💤 **Crop rebalance — buff Parsnip; consider new Truffle crop** — Parsnip yield 28→32; Truffle as season 3+ high-risk option | ~~Medium~~ | S / M | p1·I4 | **Parsnip buff SKIPPED (2026-07-21).** `npm run sim -- --configs baseline --strategies radishOnly,parsnipOnly,pumpkinOnly,smartMixed --trials 1000` → parsnipOnly **20.5% win (best solo)**, pumpkinOnly **0%**, radishOnly 0.1%, smartMixed 85.6%. p1's "Parsnip trap / Pumpkin dominant" analysis was pre-010; the buff would over-tune the strongest solo crop. **Truffle (new crop) still deferred** — content, not a fix. |
| G6 | ❌ **Crop rotation bonus** — +25% yield when replanting an exhausted plot with a different crop | ~~Medium~~ | S–M | p4·C | **SKIPPED (2026-07-21).** Goal (break Pumpkin-only optimization) already met by 012 Market Events variance + Pumpkin-only now bankrupts 100%. Redundant. |
| ✅ G7 | **Market events / dynamic crop pricing** — temporary ±yield modifiers per crop, announced in advance | Medium | M | p1·I5, p3·5, p4·E | p1 proposes 3% daily roll, p4 proposes 20% per 5 days, p3 proposes once-per-season. p1's "announced 1 day ahead" pattern is the most player-fair. Acts as the late-game balance regulator (p4). <br>**DONE (2026-06-17).** Shipped as [012-market-events](specs/012-market-events/spec.md) — fixed 5-day cycle, one event at a time (shortage +40% / glut −30%), announced 1 day ahead, surfaced in Shop seed-card + Day Summary (no HUD chip). Pure `src/engine/market.ts`; schema 7→8. Sim-gated: `smartMixed` stayed in the 15–35% band (18.0% win / 1.08× overshoot, see [tuning-results.md](specs/012-market-events/tuning-results.md)); single-crop bots still fail (0% win). |
| G8 | ✅ **Infrastructure upgrades (second shop track)** — Irrigation Well, Scarecrow, Compost Bin, Market Stall as disaster-mitigation purchases | Medium | M | p1·I3 | **DONE (2026-07-19).** Shipped as [019-farm-buildings](specs/019-farm-buildings/spec.md) — unified Buildings track; absorbed the 3-tier tool ladder (collapsed into 🛠️ Toolshed); Farm Stand = renamed Market Stall; Season-2 gate + day-1 teaser; schema 8→9; sim-gated (buildings019 smartMixed ~17% win / 1.11× overshoot; final costs 100/100/130/150/200). |
| G9 | ❌ **Farm expansion (more plots as late-game purchase)** — North Field (+4 plots @ 300), East Field (+4 plots @ 600) | ~~Medium~~ | M | p3·3 | **SKIPPED (2026-07-21).** The "post-Tier-3 sink" it targets is already filled by G8 buildings + G10 escalating plot prices; a third sink risks bloat. |
| G10 | ✅ **Plot unlocking (early-game growth arc)** — start with 8 plots, unlock to 10/12 at 200/500-coin milestones | Medium | M | p4·D → **shipped as [010-plot-progression-rebalance](specs/010-plot-progression-rebalance/spec.md)** | **DONE (2026-06-08).** Shipped with simulator-tuned numbers: start at **4 plots**, buy up to **12** at escalating prices `[30, 55, 85, 120, 160, 210, 280, 360]` (purchases are the scaling capital sink the economy was missing, not milestone-gated freebies). New `buyPlot` engine fn + `unlockedPlots` state; `plantSeed` rejects locked plots; `LockedPlot` UI branch with a Buy button on the next purchasable plot. Schema bump 6→7 (old saves migrate to 12 unlocked, not retroactively punished). The "feels restrictive?" concern from the original note was resolved by tuning against the 009 simulator + a manual playthrough rather than guessing. |
| G11 | ✅ **In-run narrative events** — authored 1–2 per season Farm Events with binary choices (Traveling Merchant, Bountiful Spring, Drought Warning) | High | M | p2·C, p3·2, p4·B, p5·3.1 | **GREENLIT — top remaining pick (2026-07-21).** The single biggest un-built gameplay layer; highest replay value left. **Fold the deferred G4** (per-day objectives / per-season contracts) into this feature rather than building it standalone. **Spec approved (2026-07-21): [022-narrative-events](specs/022-narrative-events/spec.md)** — 6-event catalog (3 Proposal-C events + 2 contract events folding G4 in + 1 pay-for-buff), guaranteed 1–2 windowed events/season, own start-of-day modal, typed effect primitives, schema 9→10, sim-gated (heuristic + acceptAll/declineAll bounds), analytics + PostHog dashboard. <br>**DONE (2026-07-24).** Shipped as [022-narrative-events](specs/022-narrative-events/spec.md) via subagent-driven-development (17 tasks, two-stage spec+quality review per task). Pure `src/engine/farmEvents.ts` + data-only catalog; schema 9→10 with defensive migration + hardening; run-2 auto-unlock gate; blocking choice modal + HUD contract chip (📜) + Day-Summary event/contract lines + run-end unlock tease + "New!" ribbon; 4 analytics events (`farm_event_fired`/`farm_event_choice`/`contract_completed`/`contract_expired`) + `play_started.events_enabled`; sim event policies (`--eventPolicy heuristic\|acceptAll\|declineAll`) + `events022` preset. Sim-gated: all three policies land in the 15–35% win / 1.0–1.3× overshoot band (see [tuning-results.md](specs/022-narrative-events/tuning-results.md)) — only lever moved from the authored proposal was the two contract consolations (12→20, 10→18); single-crop bots still fail. 834 tests, lint clean. PostHog "Narrative Events" dashboard (id 907101) was provisioned separately on **2026-08-20** — the deferred main-session step — via [023-analytics-coverage](specs/023-analytics-coverage/spec.md) (the gameplay delivery above shipped 2026-07-24). |
| G12 | ✅ **Harvest streak counter** — consecutive harvest-days with small escalating coin bonuses (5/10/15/20) | High | S | p5·3.5 → **shipped as [008-harvest-streak](specs/008-harvest-streak/spec.md)** | **DONE (2026-06-06).** Bonus capped at +20 (4× +5), streak count uncapped for HUD chip and the Longest-streak personal best. Resets on miss-days and at season boundaries (not on season_failed). Bonus is added to balance before the bankruptcy check, so it counts toward survival. |
| G13 | ✅ **Farm Reputation tier (HUD title)** — cosmetic title that escalates with days survived (Struggling Smallholder → Master of the Harvest) | Low | S | p5·3.3 | Pure display change. Adds narrative arc to existing day counter. **Post-007**: now layers cleanly on top of the medal system — could derive the title from `bestDaysSurvived` / `bestSeasonReached` already persisted by `records.ts`, no new state required. **DONE (2026-06-16).** Shipped as [011-farm-reputation-tier](specs/011-farm-reputation-tier/spec.md) — current-run, day-based front-loaded 7-tier ladder; pure display via new src/engine/reputation.ts; always-visible HUD chip; no state/schema change. **SUPERSEDED (2026-08-27) by [027-hud-legibility](specs/027-hud-legibility/spec.md):** the HUD chip is removed and `src/engine/reputation.ts` deleted. The title was derived from the day counter the HUD already shows, and its 7-tier ladder duplicated the 5-tier medal on the same axis (disagreeing outright at day 61). Its titles now *are* the medal labels, so the feature lives on at run end rather than being reverted. |
| G14 | **Persistent achievements** — small curated set stored in localStorage, earned once, multiple play styles covered | Medium | M | p5·3.4 | **GREENLIT (2026-07-21) — second pick after G11.** Cheap: `records.ts` already owns a separate localStorage key (`pixel-parsnips-records`) with a tested load/migrate/defensive-parse pattern — achievements follow the same shape (own `schemaVersion`, never crashes on malformed JSON, untouched by Restart). Watch for grind-bait ("harvest 1000 crops"); favor skill/resilience achievements. |
| G15 | ❌ **Run legacy / meta-progression bonuses** — small starting bonus on next run based on previous performance | ~~Low~~ | M | p3·4 | **SKIPPED (2026-07-21).** Breaks the single-session roguelite identity (p4's argument); balance risk > payoff for a hobby build. Data is already persisted if this is ever revisited. |

---

## Backlog — Game Feel & Polish

| # | Item | Priority | Effort | Refs | Notes |
|---|------|----------|--------|------|-------|
| F1 | ✅ **Juice pass — harvest moment** — coins fly to HUD with animation; counter ticks rapidly; per-crop harvest sounds | Medium | M | p2·E → **shipped as [021-harvest-juice](specs/021-harvest-juice/spec.md)** | **DONE (2026-07-19).** Coin-flight celebration on fresh harvest-summary close (HUD holds the pre-turn balance, then rapid-ticks as coins land); per-crop Web-Audio chiptune SFX (zero assets, swappable to CC0 files behind `playSfx(id)`) + persistent HUD mute toggle (`pixel-parsnips-audio` key). Skippable on any input; reduced-motion = sounds only; no engine/schema change, no new deps. |
| F2 | ✅ **Juice pass — disaster reveal** — reveal disasters last in Day Summary; pest "scurrying" animation; Blight uses heavier visual weight | Medium | S–M | p2·E → **shipped as [013-disaster-reveal-juice](specs/013-disaster-reveal-juice/plan.md)** | **DONE (2026-06-19).** Staged "dread-then-hit" reveal in the Day Summary modal: opens neutral, then after ~700ms tints red and drops in a "Disaster!" badge + a single unified `DisasterBanner` (icon + title + body) shared by blight / pest / flash drought. Reopen via "Last Turn" or `prefers-reduced-motion` shows the resolved state immediately. New `useReducedMotion` + `useDisasterReveal` hooks; inline disaster lines removed from DailyLog (now in the banner); `role="alert"`/`aria-live` so the staged reveal is announced to screen readers. Pure presentation — no engine/type/schema change. Built via subagent-driven-development (two-stage review per task); 455 tests, lint green. PR #6. |
| F3 | **Juice pass — weather flavor** — distinct background tint per weather type in modal | Low | S | p2·E | Pure CSS/animation work. Low effort, low-but-cumulative impact. **Still open after 028** — deliberately excluded: different surface (Day Summary modal), different mechanism, no shared code with the farm-scene work. |
| F4 | **Bankruptcy "final day" sequence** — at 0–14 coins trigger a dramatic last-day playthrough instead of immediate end | Low | M | p2·E | Adds cinematic closure to runs. Requires state-machine work to defer end-of-run logic. |
| F5 | ✅ **Player onboarding ("Your First Harvest")** — first-run guided overlay (fill plots with radishes → advance → payoff) + always-on empty-day safeguard + run-end "Replay tutorial". | High | M | UI.md #5 → shipped as [014-player-onboarding](specs/014-player-onboarding/spec.md) | **DONE.** Own localStorage key (survives Restart); turn-1 weather pinned safe; analytics deferred to A1. |
| F6 | **Farm-scene building sprites** — owned 019 buildings get pixel sprites anchored on the 018 backdrop | Low | S–M | 019 follow-up | Pure presentation; shop cards + banner lines shipped in 019. **Deferred by 028 to a future spec (number assigned when it is written, not reserved ahead).** Cannot hang off `PageBackdrop`: it is `fixed`, `-z-10` and positioned in viewport percentages, so a building would sit behind the grid on a short viewport and in the open on a tall one. Needs a new in-flow farmyard container plus five new sprites. |
| F7 | ✅ **Mobile lease visibility** — surface the per-day lease at mobile widths | Low | S | UI.md audit → shipped as [027-hud-legibility](specs/027-hud-legibility/spec.md) | **DONE.** Not shipped as the proposed balance-chip sub-label: the balance chip already carries a caption and a late-season warning, so a third line would grow the HUD on the width that can least afford it, and `farm-stone` fails AA on `farm-chip` (3.751). Shipped instead as a merged **daily ledger chip** — lease and the harvest-streak bonus are both coins-per-day, so they share one chip that replaced both the streak chip and the old `hidden sm:flex` readout. Measured at 375px: the chip's mobile form has a hard 81px budget; an emoji inside it costs ~10px and pushes the HUD to a third row. **Mobile half withdrawn by [029](specs/029-release-polish/spec.md).** A device review of the live build found the compact form the width budget forced — `−15/d` — communicated nothing. The chip is now `hidden sm:flex`; mobile players read the nightly charge in the Day Summary, where it is itemised. The desktop readout is unchanged. Withdrawing it freed 61px of the 82px that got the mobile header onto one row. |
| F8 | 💤 **Autosave indicator** — a subtle "Saved ✓" flash in the HUD after significant actions (Next Day, plant, purchase), ~1s then fade. | ~~Low~~ | S | UI.md audit | **DEFERRED (2026-08-30).** The game already autosaves to localStorage after every action, so this is a reassurance layer over behaviour that is not actually broken — it adds a recurring HUD interruption to solve an anxiety no player has reported. The HUD is also the most space-constrained surface in the game (see **F10**), which makes it the worst place to spend a new element. Revisit only if save-loss confusion shows up in real feedback. |
| F9 | **Death-cause title tuning** — two of the five 026 cause-of-death titles are mis-calibrated on the live economy: `fed_the_taxman` fires on 0–3% of bankrupt runs and `idle_hands` on 46–87%. | Low | S–M | [026-post-mortem](specs/026-post-mortem/plan.md) follow-up; matrix below | **HELD, now measurable.** Deliberately not tuned at ship time — thresholds were always "first-pass, tune against real runs" (026 §C3) — but the cause was never sent to analytics, so the hold could never end. `run_ended` now carries `death_cause` (2026-08-30). See "F9 — measured baseline" below. |
| F10 | ✅ **Mobile HUD density at ≤360px** — the header wrapped to three rows at 360px under worst-case load | Low | S | [029-release-polish](specs/029-release-polish/spec.md) | **DONE — and the pre-029 diagnosis in this row was wrong.** It claimed the `Goal 105·D20` caption was "the lever" and that the balance chip needed restructuring. Measured: de-tracking that caption saves **12px of the 13 needed** and still leaves three rows — a one-pixel trap that looks like a fix. The header went to **one** row (better than F10's two-row target) via three small removals instead: hide the decorative 🪙 below `sm` (−21px), withdraw the mobile lease chip (−61px, see **F7**), and move `Last Turn` into the gear menu (−99px). Final state 312 of 328px at 360px. 320px remains two rows, deliberately. |
| F12 | ✅ **Release polish** — one-row mobile HUD, low-balance warning brought into the palette, `@` in the goal caption, SVG gear, bankruptcy season value on one line, parsnip favicon, recaptured screenshots, share-preview tags | Medium | M | [029-release-polish](specs/029-release-polish/spec.md) | **DONE.** Scoped from a device review of the live deploy, which is why several findings could not have surfaced in the preview browser. Closed the last two off-palette colours (`border-yellow-600/70`, `text-yellow-300` — class names, so 028's hex sweep and the contrast gate both missed them) and added a source-scanning test so they cannot come back. The gear became an inline SVG because its optical nudge had been measured in Chromium and read off-centre in iOS Safari — a class of bug that measuring harder in the preview cannot fix. |
| F11 | ✅ **Farm scene coherence** — palette consolidation, play-surface and chrome lift, farm-grid art migration | Medium | M | [028-farm-scene-coherence](specs/028-farm-scene-coherence/spec.md) | **DONE.** 46 hardcoded hex literals across 5 components folded into `PALETTE`, so the contrast gate finally covers the surface the player looks at all game — which immediately exposed two labels at 2.89:1 (pest tile, exhausted tile), both now AA. Fields and HUD lifted out of near-black; the chrome lift was only possible by re-picking `danger`, which alone capped the available `chip` lift at 2.9% instead of 18.3%. Grid decor migrated from four inline SVGs to the 018 PNG registry, and the grain filter moved off the plot subtree where it was smudging the LPC crop sprites. |


### F9 — measured baseline (2026-08-25)

`npm run sim -- --trials 500 --seed 42`, all four strategies. Percentages are of **bankrupt runs**
per row, not of all trials. `events022` is the live economy (`proposed` + buildings + farm events);
the other presets are kept for comparison.

| config | strategy | bankrupt | fed_the_taxman | weathered_out | overextended | idle_hands | out_of_seed_money |
|---|---|---|---|---|---|---|---|
| baseline | radishOnly | 36 | 17% | 17% | 0% | 67% | 0% |
| baseline | parsnipOnly | 67 | 12% | 13% | 0% | 54% | 21% |
| baseline | pumpkinOnly | 500 | 0% | 13% | 0% | 87% | 0% |
| baseline | smartMixed | 2 | 0% | 0% | 0% | 100% | 0% |
| proposed | radishOnly | 203 | 45% | 9% | 0% | 45% | 0% |
| proposed | parsnipOnly | 260 | 15% | 18% | 0% | 50% | 17% |
| proposed | pumpkinOnly | 233 | 39% | 9% | 0% | 24% | 27% |
| proposed | smartMixed | 142 | 0% | 19% | 20% | 49% | 12% |
| buildings019 | radishOnly | 260 | 2% | 15% | 0% | 83% | 0% |
| buildings019 | parsnipOnly | 322 | 2% | 25% | 0% | 54% | 19% |
| buildings019 | pumpkinOnly | 500 | 0% | 13% | 0% | 87% | 0% |
| buildings019 | smartMixed | 195 | 0% | 17% | 15% | 62% | 6% |
| **events022** | **radishOnly** | **280** | **2%** | **13%** | **0%** | **85%** | **0%** |
| **events022** | **parsnipOnly** | **306** | **3%** | **34%** | **0%** | **46%** | **17%** |
| **events022** | **pumpkinOnly** | **500** | **0%** | **13%** | **0%** | **87%** | **0%** |
| **events022** | **smartMixed** | **184** | **0%** | **16%** | **12%** | **67%** | **5%** |

**Health criterion** (026 plan, Task 7): no cause above ~60%, none that never fires. On the live
economy it **fails at both ends**.

**Why `idle_hands` dominates.** You go bankrupt because you cannot pay lease, which usually means you
could not afford seeds either — so the board is empty on the fatal day almost by definition.
`emptyPlots > unlockedPlots / 2` is therefore true on most deaths, and because it sits *above*
`out_of_seed_money` in the priority order it starves the actual default. It is less a cause than the
default wearing a costume.

**Why `fed_the_taxman` is silent.** Not a broken threshold: on the `proposed` preset, at the *same*
6% tax rate, it fires at 45% for `radishOnly` and 39% for `pumpkinOnly` (15% for `parsnipOnly`, 0%
for `smartMixed`). Buildings and farm events raise gross harvest income enough that cumulative tax
rarely reaches `TAXMAN_SHARE` (25% of it). Note also that `smartMixed` reinvests rather than hoards,
so the strategy closest to a real player structurally cannot trigger the one title that names the
game's thesis.

**Candidate fixes, in cost order:**

1. **Lower `TAXMAN_SHARE`** ([`runPostMortem.ts:114`](src/engine/runPostMortem.ts)) from `0.25` to
   ~`0.12–0.15` and re-measure. One constant, no schema impact, a few test fixtures. **S.**
2. **Give `idle_hands` a duration test** — "half the board empty for 3+ consecutive days" rather than
   a fatal-day snapshot. `RunDayRecord` has no empty-plot count, so this needs a seventh field and
   `SCHEMA_VERSION` 11 → 12 with a migration branch. **S–M, and it is its own small feature.**

**Recommendation: still hold on the thresholds.** Tuning against bots risks fitting the wrong
distribution — the bot population does not contain the hoarding behaviour `fed_the_taxman` exists to
catch. Use this table as the before.

#### 2026-08-30 — the hold had no exit ramp; now it does

Re-examining F9 turned up the reason the hold could never have ended on its own: **the cause of death
was never sent to analytics.** `run_ended` carried seven properties and none of them was the cause,
so "revisit once real-run data exists" was waiting on data nothing was collecting. Confirmed against
the live PostHog project's ingested property list, not just the source.

What the live data showed at that point — 33 `run_ended` events since 2026-07-06, 26 of them
bankrupt, from 5 people (11 runs on `pixel-parsnips.vercel.app` from 3 people; the rest local dev).
Real-player volume is real but negligible, so the bot-vs-player objection stands unchanged.

**Shipped instead of a tuning pass:** `run_ended` now carries `death_cause` (`DeathCauseId | null`,
null for non-bankrupt outcomes, since the title is only shown on the bankruptcy screen).
`buildRunEndedProps` already received the full `GameState` and `deathCauseForState` was already a
pure one-call helper, so this is one line plus the type field; `EVENT_VERSIONS.run_ended` 1 → 2.
No game-schema impact — `SCHEMA_VERSION` stays 11.

**Ending condition for the hold:** enough real bankrupt runs on the deployed build to read the
`death_cause` distribution directly, then compare against the `events022` row above. At the current
~3 players that is a long way off; the point of the change is that the clock is now running at all.
Revisit if `run_ended` with `outcome = 'bankrupt'` passes roughly 100 real runs.

---

## Backlog — Monetization 🗄️ ARCHIVED (2026-07-21)

> **Out of scope.** Project intent confirmed as portfolio / hobby — no monetization planned.
> Rows kept for reference only; do not build. Revisit only if the project's intent changes.

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
| A2 | ✅ **Coverage closure** — enriched `day_completed` (disasters, market, streak, buildings, 022 buffs) + `plot_unlocked` day/season, four lifecycle events (`endless_mode_entered`, `run_abandoned`, `first_plant_placed`, `first_harvest_collected`), Narrative Events + Economy & Systems dashboards, Core extensions | Medium | M | 2026-08-20 coverage audit → **shipped as [023-analytics-coverage](specs/023-analytics-coverage/spec.md)** | **DONE.** Closes the 022 "dashboard pending" item and gives every emitted event a tile — with one deliberate exception: `milestone_reached` has no dedicated tile because its two signals are already charted elsewhere (`first_plot_unlocked` duplicates the `plot_unlocked` expansion-pacing tile; `season_2_reached` is covered by season data on `day_completed`/`season_completed`). |

---

## Suggested Phasing

**Phase 1 — "Give the run a shape"** ✅ shipped 2026-06-03 as [006-season-system](specs/006-season-system/spec.md) + 2026-06-04 as [007-enriched-run-summary](specs/007-enriched-run-summary/spec.md)
~~G1 Season System~~ ✅ + ~~G2 Escalating Difficulty~~ ✅ + ~~G3 Enriched Summary~~ ✅ + G5 Parsnip rebalance (deferred)

**Phase 2 — "Give each day a hook"** ✅ shipped
~~G4 Daily Objectives~~ (deferred 2026-06-05) + ~~G12 Harvest Streak~~ ✅ (shipped 2026-06-06) + ~~G13 Reputation Tier~~ ✅ (shipped 2026-06-16 as [011](specs/011-farm-reputation-tier/spec.md)) + ~~F2 Disaster reveal juice~~ ✅ (shipped 2026-06-19 as [013](specs/013-disaster-reveal-juice/plan.md)) + G5 Parsnip rebalance (still trivial, can slot anywhere). The per-day hook gap is now filled by G12.

**Phase 3 — "Give wealth somewhere to go"** (target: 1–2 sprints) — *partially shipped* ← **next up**
~~G10 Plot unlocking~~ ✅ (shipped 2026-06-08 as [010](specs/010-plot-progression-rebalance/spec.md); escalating plot prices are now the primary scaling capital sink) + the simulator-tuned economy rebalance ([009](specs/009-balance-simulator/spec.md)+010). ~~G7 Market Events~~ ✅ (shipped 2026-06-17 as [012](specs/012-market-events/spec.md) — late-game variance regulator). ~~G8 Infrastructure Upgrades~~ ✅ (shipped 2026-07-19 as [019-farm-buildings](specs/019-farm-buildings/spec.md)). ~~G9 Farm Expansion~~ + ~~G6 Rotation Bonus~~ skipped 2026-07-21 (sink already solved; variance already solved) — **Phase 3 complete, nothing open**.

**Phase 4 — "Depth & memorable moments"** — *partially shipped* ← **G14 next up (only remaining active work)**
~~G11 Narrative Events~~ ✅ (shipped 2026-07-24 as [022-narrative-events](specs/022-narrative-events/spec.md), with G4 objectives folded in) → **G14 Achievements ← next up**. ~~G15 Run Legacy~~ skipped; ~~G6 Rotation Bonus~~ skipped; F3 remaining juice (optional polish).

**Phase 5 — "Monetization"** 🗄️ **archived** — out of scope for a portfolio/hobby project (2026-07-21).

---

## Open Decisions (resolve before building)

1. ✅ ~~**Season length**: 20 days (p1, p4) or 30 days (p3)?~~ → **Resolved: 20 days** (shipped in 006).
2. ✅ ~~**Season failure mode**: hard run-end (p1) or 30% coin penalty + continue (p4)?~~ → **Resolved: hard run-end** (shipped in 006).
3. ✅ ~~**G8 vs G9**: Infrastructure upgrades and farm expansion both target "post-Tier-3 sink." Pick the one that fits the planned art/UI budget; doing both risks bloat.~~ → **Resolved: G8 shipped first** (019-farm-buildings, 2026-07-19); **G9 subsequently skipped** (2026-07-21 triage — the sink is already covered by G8 + G10).
4. ✅ ~~**G10 plot unlocking** conflicts with current "12 plots from start." Validate with a playtest before committing — could feel like a step backward to current players.~~ → **Resolved: shipped** (010, 2026-06-08). New games start at 4 plots and buy up to 12; the concern was addressed by tuning the numbers against the 009 simulator plus a manual click-through rather than guessing, and old saves migrate to 12 unlocked so existing players aren't downgraded.

---

*Generated 2026-06-02 from p1–p6 analyses. Updated 2026-06-03 after shipping 006-season-system, then 2026-06-04 after shipping 007-enriched-run-summary, then 2026-06-05 after deferring G4 (Daily Objectives / Milestones / Contracts), then 2026-06-08 after shipping 009-balance-simulator (tooling) + 010-plot-progression-rebalance (G10 plot unlocking + simulator-tuned economy), then 2026-06-16 after shipping 011-farm-reputation-tier (G13), then 2026-06-17 after shipping 012-market-events (G7), then 2026-06-19 after shipping 013-disaster-reveal-juice (F2), then 2026-06-26 after shipping 014-player-onboarding (F5), then 2026-07 after shipping 015-mobile-ux-polish + 016-ux-ui-polish (UI.md audit fixes — empty-plot affordance, reduced-motion, low-balance warning, shop discoverability, disaster/drought banners, upgrade contrast, semantic type scale) + 017-analytics (A0 analytics layer + core gameplay funnel; A1 onboarding funnel still open) + 018-prettier-assets (crop art, illustrated backdrop, wooden shop), then 2026-07-19 after shipping 019-farm-buildings (G8 Infrastructure upgrades — unified Buildings track, Toolshed collapse, Farm Stand, Season-2 gate, schema 8→9), then 2026-07-20 after shipping 020-onboarding-analytics (A1 onboarding funnel + skip/completion/replay + empty-day safeguard events + "Pixel Parsnips — Onboarding" dashboard) + 021-harvest-juice (F1 harvest-moment juice — coin-flight celebration, per-crop Web-Audio SFX, HUD mute toggle; no engine/schema change), then 2026-07-21 triage: relocated p1–p6 source docs to docs/proposals/; skipped G5 Parsnip buff (sim-disproven), G6 Rotation Bonus, G9 Farm Expansion, G15 Run Legacy; archived all Monetization (portfolio/hobby); greenlit G11 Narrative Events (with G4 folded in) then G14 Achievements as the only remaining active work, then 2026-07-24 after shipping 022-narrative-events (G11 Narrative Events with G4 folded in — authored Farm Events + per-season delivery contracts, schema 9→10, sim event policies), leaving G14 Achievements as the only remaining active work. Then 2026-08-27: shipped **027-hud-legibility** — reputation chip and ladder removed (G13 superseded, titles folded onto the medal), F7 closed via a merged daily-ledger chip, contrast gate re-pointed at the chip's foregrounds; **F10** added for ≤360px HUD density.*
