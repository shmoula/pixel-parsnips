# 023 — Analytics Coverage: schema enrichment, lifecycle events, dashboards

Status: **approved** (2026-08-20). Follows [017-analytics](../017-analytics/spec.md) (A0 layer),
[020-onboarding-analytics](../020-onboarding-analytics/spec.md) (A1 funnel), and
[022-narrative-events](../022-narrative-events/spec.md) (farm events + its unbuilt dashboard).

## Summary

A coverage audit (2026-08-20) found the analytics layer frozen at the 017 feature set: events exist
for everything 017/020/022 specified, and for nothing shipped in between. Four gameplay systems
(disasters, market events, harvest streak, building effects) emit no signal, four run-lifecycle
moments are invisible, one stated KPI is unmeasurable, and five of seventeen events have no tile
anywhere in PostHog.

This spec closes those gaps in four phases: enrich two existing events, add four state-derived
lifecycle events, provision the missing dashboards, and retire the unused starter dashboard.

## Problem

Ten of the seventeen events are derived by diffing `GameState` in `useAnalyticsEvents`; the other
seven fire imperatively at their seams. Coverage therefore only grows when someone writes a
detector — a system can ship, add fields to `GameState`/`DailyLogEntry`, and emit nothing. Features
that shipped **with** an analytics spec (017, 020, 022) are instrumented; features that shipped
without one (003 disasters, 008 streak, 012 market events, 019 building effects) are not. This
matches the 2026-06-26 batching decision recorded in [backlog.md](../../backlog.md) — analytics is
wired in batches, and these systems never got theirs.

Concretely, as verified against the live PostHog project (EU, id 216788) on 2026-08-20:

| # | Finding | Evidence |
|---|---|---|
| 1 | `day_completed` carries 9 of ~25 `DailyLogEntry` fields | live event schema; streak, market, pest, drought, buildings, buffs all absent |
| 2 | `plot_unlocked` has no `day`/`season_number` | live schema shows only `price`, `unlocked_plots_after`, `coin_balance_after`; the 017 KPI "median day of first plot unlock" is unmeasurable, and the provisioned tile concedes a plots-reached proxy |
| 3 | Entering endless mode emits nothing | `endlessMode` flips at `useGameEngine.ts:582`; the strongest engagement signal in the game is invisible |
| 4 | Abandoning a run emits nothing | `restart()` is untracked; voluntary quits are indistinguishable from tab closes |
| 5 | No activation signal between `play_started` and `day_completed` | outside the tutorial there is no first-plant / first-harvest event |
| 6 | `_endOfRunRecap` accepted and unused | `useAnalyticsEvents.ts:183`; dead wiring from 007 |
| 7 | Five events have zero tiles | `shop_purchased` (highest-volume event, 761 occurrences) plus all four 022 farm-event events; 0 matching insights |
| 8 | Starter dashboard is dead weight | dashboard 795789 charts `$pageview`/autocapture, both disabled in `track.ts` |

Not defects, for the record: `contract_expired` has a real engine path and two passing test
assertions but has never fired in production, because only one contract has ever completed. Every
declared event has test coverage.

## Goals

- Make the four dark gameplay systems measurable from the event already emitted every in-game day.
- Repair the one stated KPI that current properties cannot answer.
- Close the run-lifecycle and activation blind spots with the smallest event surface that works.
- Give every emitted event at least one tile, and every dashboard a spec it maps to.

## Non-goals

- Per-action `plant_seed` / `harvest_collected` events (see Out of scope).
- Any change to consent, DNT handling, opt-out behaviour, or the `posthog-js` init config.
- Any engine impurity: all new events stay state-derived in the render-diff hook.
- Backfilling historical events. Pre-023 rows keep their v1 shape.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Enrichment breadth | **Curated** — only props tracing to a named blind spot, not a full `DailyLogEntry` mirror |
| New event count | **Four** — two lifecycle, two once-per-run activation firsts |
| Emission style | **State-derived** in `useAnalyticsEvents`; no new component call sites |
| Versioning | Per-event `EVENT_VERSIONS` bump; `ANALYTICS_SCHEMA_VERSION` stays **1** (layer contract unchanged, all changes additive) |
| Dashboards | 022's **Narrative Events** verbatim + new **Economy & Systems** + **Core** extensions |
| Starter dashboard | **Delete** 795789, after explicit confirmation at execution time |
| Branch | `023-analytics-coverage`, carrying the `app_version` build fix as its first commit |

## Phase A — schema enrichment

### `day_completed` v1 → v2

Ten props added to the pure builder `buildDayCompletedProps` in `src/analytics/events.ts`. All read
from the `DailyLogEntry` already passed in; no new arguments, no engine change.

| Property | Source | Type | Answers |
|---|---|---|---|
| `streak_after` | `log.streakAfter` | number | 008 — does the streak mechanic actually build? |
| `streak_bonus` | `log.streakBonus` | number | 008 — what does it pay out? |
| `pest_destroyed_count` | `log.pestDestroyedPlots.length` | number | 003 — disaster severity |
| `pest_plots_at_risk` | `log.pestPlotsAtRisk` | number | 003 — severity denominator (empty board vs all spared) |
| `flash_drought_days_after` | `log.flashDroughtDaysAfter` | number | 003 — drought exposure |
| `market_event_kind` | `log.marketActive?.kind ?? null` | `'shortage' \| 'glut' \| null` | 012 — market exposure |
| `market_crop_id` | `log.marketActive?.cropId ?? null` | `CropId \| null` | 012 — which crop it hit |
| `buildings_applied` | `log.buildingsApplied` | `BuildingId[]` | 019 — did a purchased building actually mitigate? |
| `event_buff_count` | `log.eventBuffsApplied?.length ?? 0` | number | 022 — buff uptake |
| `contract_active` | `log.contractProgress != null` | boolean | 022 — contract pressure |

### `plot_unlocked` v1 → v2

| Property | Source | Type |
|---|---|---|
| `day` | `state.currentDay` | number |
| `season_number` | `getSeasonForDay(state.currentDay).number` | number |

Restores the 017 KPI "median day of first plot unlock" and brings the event in line with every
other gameplay event, all of which already carry `day`.

## Phase B — four new events

All four are detected in `useAnalyticsEvents` from the `prev` → `state` diff.

| Event | Properties | Detector |
|---|---|---|
| `endless_mode_entered` | `day`, `season_number`, `coin_balance` | `!prev.endlessMode && state.endlessMode`. Self-resetting: a new run returns the flag to false, so no guard is needed. |
| `run_abandoned` | `days_played`, `season_number`, `coin_balance` | The existing new-run reset branch in `detectRunLifecycle`, taken only when `prev.phase === 'playing'`. |
| `first_plant_placed` | `day`, `crop_id` | First plot whose `cropId` goes `null` → set this run; once-per-run ref guard. |
| `first_harvest_collected` | `day`, `coin_balance_after`, `harvest_count` | First `lastDailyLog` identity change with `harvests.length > 0`; once-per-run ref guard. |

**`run_abandoned` reads `prev`, not `state`.** By the time the reset is detected the new state is
already `initialGameState()` at day 1, so every property must come from the outgoing run:
`days_played` is `prev.currentDay`, `season_number` is `getSeasonForDay(prev.currentDay).number`,
and `coin_balance` is `prev.coinBalance`. Getting this wrong would emit a uniform day-1 abandon for
every run. No `phase_before` property is carried: the emit condition already requires
`prev.phase === 'playing'`, so it could only ever hold one value.

**Ordering constraint.** Within `detectRunLifecycle`, `run_abandoned` must be emitted *before* the
per-run guards are cleared, and the two new first-* guards must be reset in the same branch that
already clears `firedMilestones` and `runEndedFired`.

**Why `prev.phase === 'playing'` is the right discriminator.** `restart()` from a terminal phase is
a normal post-`run_ended` restart, not an abandon. `continueSeason()` advances to `currentDay + 1`,
never day 1. `endRunVictory()` runs from a terminal phase. Only a mid-run `restart()` satisfies the
condition.

### Cleanup in the same pass

Drop the unused `_endOfRunRecap` parameter from `useAnalyticsEvents` and its argument at
`App.tsx:63`. `run_ended` derives the medal itself via `deriveMedal`.

## Edge cases

| Case | Behaviour |
|---|---|
| First render after mount (`prevRef === null`) | No diff, no events. Unchanged. |
| Page reload mid-run, then a plant | `first_plant_placed` **re-fires** — the guard is per-mount, not persisted. Accepted trade-off; see Risks. Same for `first_harvest_collected`. |
| Run won, then "Continue" | `run_ended` (won) fires at the win, then `endless_mode_entered` on the flag flip. Both are correct and expected together. |
| Restart from a terminal phase | No `run_abandoned`; the run already emitted `run_ended`. |
| Analytics disabled (no key / DNT / opted out) | `track()` no-ops as today. No new surface. |
| Pre-023 events already in PostHog | Keep their v1 shape; new props are absent, not null. Charts must tolerate missing properties or filter on `event_version`. |

## Phase C — dashboards

Provisioned via the PostHog MCP against EU project 216788, following the 020 and 022 precedent.
Dashboard and insight IDs get recorded back into this spec once created.

### 1. "Pixel Parsnips — Narrative Events" (new)

Built **verbatim to the 022 spec's six tiles** — that dashboard was scoped, marked "pending
(main-session step)" in the backlog, and never built:

1. Event fires by `event_id`, with `play_started.events_enabled` separating "no events because
   first run" from a scheduling bug
2. Choice split A vs B per `event_id`
3. Auto-decline rate (`auto: true` share; should be ~0)
4. Contract funnel: offered → accepted → completed vs expired
5. Fires by season and season-day
6. `farm_event_choice` → `run_ended` breakdown

**Provisioned 2026-08-20** — dashboard id **907101**
([link](https://eu.posthog.com/project/216788/dashboard/907101)). Insight short-ids:

| Tile | short-id |
|---|---|
| Event fires by id | `2XWH5YFQ` |
| Choice split A vs B | `LAMM5QGu` |
| Auto-decline rate | `I77NmOda` |
| Contract funnel | `eteNTsSQ` |
| Fires by season | `qmUZ326L` |
| Choice to outcome | `KTh8HMB3` |

### 2. "Pixel Parsnips — Economy & Systems" (new)

Covers the highest-volume event, which has no tile today, plus the systems Phase A unblocks:

1. Purchases over time by `item_type`
2. Top `item_id` purchased
3. Building adoption — share of runs buying each building
4. Median `cost` and `coin_balance_after` by `item_type`
5. Disaster incidence — days with `pest_destroyed_count > 0` or `flash_drought_days_after > 0`
6. Pest severity — `pest_destroyed_count` against `pest_plots_at_risk`
7. Market exposure — `day_completed` by `market_event_kind`
8. Streak health — median `streak_after`, summed `streak_bonus`

**Provisioned 2026-08-20** — dashboard id **907106**
([link](https://eu.posthog.com/project/216788/dashboard/907106)). Insight short-ids:

| Tile | short-id |
|---|---|
| Purchases over time | `M1AkNYIp` |
| Top items bought | `H6PvDNEn` |
| Building adoption | `YohhJfDB` |
| Spend per purchase | `XlQCEs5n` |
| Disaster incidence | `iwA3AIoL` |
| Pest severity | `ghtgFelD` |
| Market exposure | `jbQyHWdV` |
| Streak health | `L8E3o2X1` |

Tiles 5–8 (`day_completed` v2 properties) render empty until the enriched build
ships to production; they were provisioned per plan ahead of the deploy.

### 3. "Pixel Parsnips — Core" (extend, id 798528)

1. **Activation funnel v2** — `page_loaded → play_started → first_plant_placed →
   first_harvest_collected → day_completed`. Updates the existing insight in place
   (`3Tcoqzoj`, "Activation funnel — loaded → started → milestone") so its dashboard slot and
   links survive.
2. **Run endings** *(new insight)* — `run_ended` by `outcome` alongside `run_abandoned`, giving an
   abandon rate
3. **Endless adoption** *(new insight)* — `endless_mode_entered` against won runs
4. **Expansion pacing** — updates the existing insight in place (`BYWNR0xz`) to median `day` on
   `plot_unlocked`, retiring its plots-reached proxy note once v2 data flows

**Provisioned 2026-08-20** — dashboard id **798528** (extended in place):

| Change | Insight | short-id |
|---|---|---|
| Activation funnel v2 (5-step, renamed) — updated in place | `3Tcoqzoj` (id 4866069) | `3Tcoqzoj` |
| Expansion pacing → median `day` — updated in place | `BYWNR0xz` (id 4866078) | `BYWNR0xz` |
| Run endings — completed vs abandoned *(new)* | id 5568773 | `O5PtIea4` |
| Endless mode adoption *(new)* | id 5568783 | `GhrFRFpS` |

The two in-place updates preserved their short-ids and dashboard slots. The `run_abandoned`,
`endless_mode_entered`, `first_plant_placed` and `first_harvest_collected` series render empty
until the enriched build ships to production.

## Phase D — retire the starter dashboard

Delete dashboard 795789 ("Your starter dashboard"). Its tiles chart `$pageview`, autocapture and
session data, all disabled in `track.ts`, so they render empty and misrepresent the project's
instrumentation. Deletion is irreversible and will be confirmed with the user at execution time.

**Outcome 2026-08-20** — user confirmed; dashboard **795789** deleted via the PostHog MCP
(soft-delete, `deleted: true`). It held 16 boilerplate tiles (`$pageview` / `$screen` /
`$autocapture` / retention / referrers, all `created_by: null`), every one empty because those
events are disabled in `track.ts`.

## Testing

TDD, Vitest + jsdom, `posthog-js` mocked, extending the existing files in `tests/analytics/`.

- `events.test.ts` — `buildDayCompletedProps` maps each of the ten new props, including the
  `marketActive === null` and `eventBuffsApplied === undefined` fallbacks
- `useAnalyticsEvents.test.tsx` — one case per new event: endless flip fires once; mid-run restart
  fires `run_abandoned` **with outgoing-run values**; terminal-phase restart fires none; first
  plant and first harvest fire exactly once per run and re-arm after a new run; `plot_unlocked`
  carries `day`/`season_number`
- Regression: existing `day_completed` assertions still pass with the widened bag
- Gate: `npm test && npm run lint && npm run build`

## Implementation phasing

| Phase | Content | Gate |
|---|---|---|
| A | `events.ts` prop enrichment + `plot_unlocked` props + version bumps | tests green |
| B | Four detectors + guard resets + `_endOfRunRecap` removal | tests green, lint clean |
| C | Three dashboards via MCP; record IDs in this spec | tiles render |
| D | Delete 795789 after confirmation | — |

Phases A and B ship as code and can merge independently of C and D.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Tiles cannot be validated** — production is ~15 people, nearly all the developer | Same caveat 020 and 022 carried. Tiles are provisioned but unproven until a seed pass; the spec says so rather than implying they are verified. |
| **Mixed-version data** — v1 rows lack the new props | Filter on `event_version`, or segment by `app_version`, which now reports a real build id per the branch's first commit. |
| **`first_plant_placed` re-fires after a mid-run reload** | Documented and accepted. If the metric proves noisy, the follow-up is a persisted guard in the existing analytics localStorage namespace — deliberately not built now, since it adds a persistence surface for an unmeasured problem. |
| **Deleting 795789 is irreversible** | Explicit confirmation at execution time; it is PostHog boilerplate, not authored work. |
| **Widened `day_completed` grows event size** | Ten scalar props on the project's second-highest-volume event is negligible against the EU free tier; curated breadth was chosen over a full mirror partly for this reason. |

## Out of scope

- **Per-action `plant_seed` / `harvest_collected`** — thousands of events per run, largely redundant
  with `day_completed.harvest_count`, and the crop mix is inferable from `shop_purchased`.
- **Reputation tier (011)** — `getReputationTier` is a pure function of `currentDay`, so the tier is
  already derivable from the `day` on every event. Instrumenting it would duplicate data.
- **Mute toggle (021) and opt-out toggle** — UI preferences with no stated question behind them.
- **Session replay, feature flags, error tracking** — deliberately disabled in 017; unchanged here.
