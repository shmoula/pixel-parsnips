# Design: Privacy-Focused Analytics for Pixel Parsnips

**Date:** 2026-07-06
**Status:** Approved (design), ready for implementation planning
**Scope:** P0 + P1 event tracking, opt-out/DNT consent, PostHog (EU) via MCP-provisioned dashboards

## Problem & Goals

Pixel Parsnips has **no tracking today** (Measurement Readiness Index: 18/100 — Broken).
We cannot answer basic questions about acquisition, activation, progression, or difficulty.

This design adds a **minimal, privacy-first** analytics layer that:

- Fires from **engine-facing state transitions**, not UI components, so the seam stays stable.
- Emits a **small, typed, snake_case schema** with **no PII, no raw save-state, no free text, no screen recordings**.
- Defaults to **opt-out + Do-Not-Track respecting** consent (no cookie banner).
- Ships client-side only (no backend), targeting **PostHog Cloud EU**.

Target readiness after implementation: ~78/100 (Usable with Gaps). The ceiling is bounded by
being client-side-only (no server-side validation), which is acceptable for this game.

### Non-Goals

- No server-side event collection or validation.
- No `identify()` with personal data; anonymous IDs only.
- No "Later"-tier events (`resource_purchased`, `plot_restored`, onboarding events) in this branch.
- No experiments/flags/surveys — dashboards and cohorts only.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Event scope | **P0 + P1** (7 events) |
| Consent model | **Opt-out, DNT-respecting**; local toggle; no cookie banner |
| Dashboards | **Provisioned via the connected PostHog MCP** (runnable) |
| Tool | PostHog Cloud **EU** free tier, cookie-free (`persistence: 'localStorage'`) |
| Branch | Current worktree `claude/adoring-cray-147242` |

## Architecture

All analytics code is isolated under `src/analytics/`. UI components import **nothing** from it.
`App` mounts one hook; `useGameEngine` makes exactly **one** inline call.

```
src/analytics/
  config.ts              # VITE_POSTHOG_KEY / VITE_POSTHOG_HOST (EU default). No key -> no-op.
  consent.ts             # DNT + localStorage opt-out toggle; isTrackingAllowed(), optIn(), optOut()
  globals.ts             # anonymous_player_id (persisted), session_id, app_version, device_type, UTMs
  events.ts              # typed discriminated union of all P0+P1 events and their prop shapes
  track.ts               # init() + track(event) fire-and-forget wrapper (lazy-imports posthog-js)
  useAnalyticsEvents.ts  # React hook firing all STATE-DERIVED events from transitions
```

### Component responsibilities

- **config.ts** — Reads `import.meta.env.VITE_POSTHOG_KEY` (public client key, safe to ship) and
  `VITE_POSTHOG_HOST` (default `https://eu.i.posthog.com`). If the key is absent, the whole layer
  is a no-op — safe for dev, tests, and forks.
- **consent.ts** — `isTrackingAllowed()` returns `false` when `navigator.doNotTrack === '1'` OR
  `localStorage['pixel-parsnips-analytics-optout'] === 'true'`. `optOut()`/`optIn()` flip the key.
  Single source of truth consulted by `track.init()` and every `track()` call.
- **globals.ts** — Builds the global property bag attached to every event:
  `event_version`, `schema_version`, `app_version`, `session_id`, `anonymous_player_id`,
  `device_type`, `utm_source|medium|campaign`.
  - `anonymous_player_id`: UUID persisted in `localStorage['pixel-parsnips-analytics-id']`.
    Its **prior existence** (read before we write) determines `is_returning_player`.
  - `session_id`: UUID generated per page load, in-memory only.
  - `app_version`: build-time `import.meta.env.VITE_APP_VERSION` (fallback `'dev'`), since
    `package.json` version is unmaintained (`0.0.0`).
  - `device_type`: `mobile | tablet | desktop`, bucketed via `matchMedia` at init.
  - UTMs: parsed from `window.location.search` at init; never overwritten thereafter.
- **track.ts** — `init()` (idempotent) lazy-imports `posthog-js` and configures it (below), then
  fires `page_loaded` exactly once (module-level guard, StrictMode-safe). `track(event)` is a
  fire-and-forget wrapper that no-ops if consent is denied or no key is configured.
- **useAnalyticsEvents.ts** — Consumes engine `state` (and `endOfRunRecap`), holds a
  `prevStateRef`, and fires all state-derived events on transitions (mirrors the existing
  `prevPhaseRef`/`lastDailyLog` patterns in `useGameEngine`).

### PostHog init config (privacy)

```
persistence: 'localStorage'      // cookie-free
autocapture: false
capture_pageview: false
capture_heatmaps: false
disable_session_recording: true
respect_dnt: true
api_host: <VITE_POSTHOG_HOST, default https://eu.i.posthog.com>
```

`distinct_id` is set to our `anonymous_player_id`. We **never** call `identify()` with PII.

## Event Schema (P0 + P1)

Global properties (above) attach to **every** event. Event-specific properties:

| Priority | Event | Fired from | Derived from state? | Key properties |
|---|---|---|---|---|
| P0 | `page_loaded` | `App` mount, once (module guard) | n/a (init) | `is_returning_player`, `has_saved_run`, UTMs |
| P0 | `play_started` | **inline** in `useGameEngine`, first successful action wrapper this session | No (needs action) | `start_action`, `day`, `onboarding_active` |
| P0 | `milestone_reached` | `useAnalyticsEvents` | Yes | `milestone` (`first_plot_unlocked` \| `season_2_reached`), `day`, `season_number` |
| P1 | `day_completed` | `useAnalyticsEvents` (watch `lastDailyLog` identity change) | Yes | `day`, `season_number`, `weather_id`, `harvest_count`, `net_change`, `tax_deducted`, `lease_deducted`, `exhausted_plot_count`, `phase_after` |
| P1 | `plot_unlocked` | `useAnalyticsEvents` (watch `unlockedPlots` increment) | Yes | `unlocked_plots_after`, `price`, `coin_balance_after` |
| P1 | `season_completed` | `useAnalyticsEvents` (phase -> `season_passed`/`season_failed`/`season_4_won`) | Yes | `season_number`, `outcome`, `coin_balance`, `days_played` |
| P1 | `run_ended` | `useAnalyticsEvents` (phase -> terminal set) | Yes | `outcome`, `days_played`, `season_reached`, `peak_balance`, `disasters_survived`, `peak_harvest_streak`, `medal` |

### Firing seams — code anchors

- **`page_loaded`** — `App` mount (`src/App.tsx`). `track.init()` fires it once; guarded against
  React 18 StrictMode double-mount by a module-level `hasFiredPageLoaded` flag.
  `is_returning_player` = `anonymous_player_id` existed before this load;
  `has_saved_run` = `localStorage['pixel-parsnips-state']` present.
- **`play_started`** — Inline in `useGameEngine`. The only event needing action context ("the user
  actually did something this session" vs. loading a saved run). A guarded helper
  (`trackPlayStartedOnce(action, state)`) is called from the successful branch of the action
  wrappers (`plant`, `buySeed`, `buyPlot`, ...). Fires **once per browser session** (module flag).
  Props: `start_action`, `state.currentDay`, onboarding-active flag.
- **`milestone_reached`** — `useAnalyticsEvents`:
  - `first_plot_unlocked` when `unlockedPlots` transitions `0 -> 1` (first expansion).
  - `season_2_reached` when `getSeasonForDay(currentDay).number` first reaches `2`.
  - Each fires **once per run**; guards reset on new-run detection (see below).
- **`day_completed`** — `useAnalyticsEvents`, on `state.lastDailyLog` changing to a new non-null
  entry. Props mapped from `DailyLogEntry`: `day`, `weather_id` = `weatherId`,
  `harvest_count` = `harvests.length`, `net_change` = `netChange`, `tax_deducted` = `taxDeducted`,
  `lease_deducted` = `landLeaseDeducted`, `exhausted_plot_count` = `exhaustedPlots.length`;
  `season_number` = `getSeasonForDay(day).number`; `phase_after` = `state.phase`.
- **`plot_unlocked`** — `useAnalyticsEvents`, on `unlockedPlots` increment. `price` computed from
  `getNextPlotPrice(prevState)` (the price that was just paid); `unlocked_plots_after` and
  `coin_balance_after` from current state.
- **`season_completed`** — `useAnalyticsEvents`, on `phase` entering
  `season_passed | season_failed | season_4_won`. `outcome` = the phase; `season_number` =
  `getSeasonForDay(currentDay).number`; `coin_balance`, `days_played` from state.
- **`run_ended`** — `useAnalyticsEvents`, on `phase` entering the terminal set
  `{ bankrupt, season_failed, season_4_won (non-endless) }`, **once per run** (prev-phase guard).
  Recomputes `medal`/`season_reached` via `deriveMedal` / `getSeasonForDay` (same as the recap).
  `peak_balance`, `disasters_survived`, `peak_harvest_streak`, `days_played` from state.

### Correctness note — `season_failed` gap

The existing `recordRunEnd` effect (`useGameEngine.ts:254`) treats only `bankrupt` and
non-endless `season_4_won` as terminal — it **omits `season_failed`**. If `run_ended` piggybacked
on that effect, every season-target failure would be invisible, biasing difficulty analysis toward
bankruptcy as the only failure mode. This design fires `run_ended` from an **independent**
`useAnalyticsEvents` watcher whose terminal set **includes `season_failed`**, so the fix cannot
regress the personal-bests / records behavior.

### New-run reset

Per-run guards (`milestone_reached`, `run_ended`) reset when a new run begins — detected in
`useAnalyticsEvents` when `phase` returns to `playing` with `currentDay === 1` (fresh state), i.e.
the `initialGameState()` shape produced by `restart()` / `endRunVictory()`.

## Consent & Privacy Guarantees

- **Default on** (opt-out), but **never** initializes when DNT is set or the opt-out key is `true`.
- A small in-game **opt-out toggle** (Settings/footer) flips `pixel-parsnips-analytics-optout`.
  When toggled off mid-session, `posthog.opt_out_capturing()` is called and `track()` no-ops.
- **Data minimization**: only the schema above is sent. Explicitly **never** sent — full
  localStorage state, exact URLs with arbitrary query params, names, email, IP-derived location,
  replay/heatmap data.
- Anonymous IDs only; no `identify()` with personal data.

## PostHog Dashboards (provisioned via MCP)

Provisioned through the connected PostHog MCP (`exec` CLI: `read-data-schema` -> `query-*` ->
`insight-create` -> `dashboard-create`; cohorts via the cohort tools). Created **after** events are
flowing so schema discovery validates real event/property names.

**Dashboard: "Pixel Parsnips — Core"**

- **Activation funnel** (`query-funnel`): `page_loaded -> play_started -> milestone_reached`.
- **Core-loop trend** (`query-trends`): `day_completed` count per day.
- **Run outcomes** (`query-trends`): `run_ended` broken down by `outcome`.
- **Season 1 pass rate** (`query-trends`): `season_completed` outcome split, `season_number = 1`.
- **Expansion pacing** (`query-trends`): median `day` of `plot_unlocked`.
- **Retention** (`query-retention`): D1/D7 returning-active on `anonymous_player_id`.

**Cohorts**

- Returning players (have `anonymous_player_id` seen on a prior day).
- **North star**: WAU who reach >= 3 in-game days (>= 3 `day_completed` in the week).

## KPIs

- North star: **weekly active players who complete >= 3 in-game days**.
- Visit -> play-start rate: `play_started / page_loaded`.
- Early progression rate: % of `play_started` reaching first plot unlock or season 2.
- D1/D7 returning active rate.
- Median days completed per run; Season 1 pass rate; bankruptcy rate by day/season/weather.
- Median day of first plot unlock; `day_completed` frequency per active player.

## Testing (TDD, Vitest + jsdom)

Tests live in `tests/analytics/` mirroring `src/analytics/`. `posthog-js` is mocked; assert
`capture` is called with the expected event name + props. Maintain the 80% line-coverage floor.

- **consent** — DNT set -> denied; opt-out key -> denied; default (neither) -> allowed; toggle flips.
- **globals** — UTM parsing; `anonymous_player_id` persistence + `is_returning_player` detection;
  `device_type` bucketing; global bag shape.
- **event mappers** — `DailyLogEntry -> day_completed` props; terminal state -> `run_ended` props;
  `plot_unlocked` price via `getNextPlotPrice(prevState)`.
- **dedupe guards** — `page_loaded` once (StrictMode double-mount); `play_started` once/session;
  each `milestone` once/run; `run_ended` once/run **including `season_failed`**; new-run reset.
- **no-op paths** — no key configured -> `track()` no-ops; consent denied -> no `capture`.

## Implementation Phasing

- **Phase A — Foundation (TDD):** `config`, `consent`, `globals`, `events`, `track`; add
  `posthog-js` dependency and `VITE_POSTHOG_KEY`/`VITE_POSTHOG_HOST`/`VITE_APP_VERSION` wiring.
  `page_loaded` on `App` mount.
- **Phase B — Event wiring (TDD):** `useAnalyticsEvents` (all state-derived events + new-run reset)
  mounted in `App`; `play_started` inline in `useGameEngine`; opt-out toggle UI.
- **Phase C — Dashboards:** provision the "Core" dashboard, insights, and cohorts via the PostHog
  MCP once events are flowing.

## Risks & Mitigations

- **StrictMode double-fire** — module-level guards for `page_loaded`; `prevStateRef` for
  transition events (matches existing engine patterns).
- **No key in CI/dev** — `track()` no-ops without a key; tests mock `posthog-js`.
- **Client-only ceiling** — accepted; readiness capped ~78/100 by design.
- **Public key exposure** — PostHog project key is a public client key by design; no server/personal
  key is committed (dashboards run through the MCP, not a repo script).
