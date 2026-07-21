# G11 — In-Run Narrative Events (Farm Events)

**Status:** Design approved · 2026-07-21
**Backlog item:** [G11](../../BACKLOG.md) — Phase 4 "Depth & memorable moments" (top remaining pick, 2026-07-21 triage)
**Refs:** p2·C, p3·2, p4·B, p5·3.1 · folds in deferred **G4** (per-day objectives / contracts)
**Effort:** M

---

## Summary

Add authored **Farm Events**: 1–2 per season, each a short story moment with a **binary choice**
presented in a dedicated modal at the start of a day. Choices map to a small closed set of typed,
serializable **effect primitives** (instant coins, sell-everything-now, timed yield buffs, one-day
seed discounts, hidden weather pins, and **delivery contracts**). The contract archetype is how the
deferred G4 "short-term goal with a coin reward" folds into this feature — as an authored event the
player opts into, not a standalone daily-objective system.

Architecture mirrors the proven 012 market pattern: a pure `src/engine/farmEvents.ts` module plus a
data-only catalog, state on `GameState` (schema **9 → 10**), all rolls driven by the injected RNG,
all tunable numbers in a new `FarmEventsConfig` block on `EconomyConfig` so the balance simulator
can sweep them. Coin numbers ship only after passing [Balance gating](#balance-gating).

Per Proposal C's design constraint, **events are never traps**: each side of every choice must be
defensible under some game state, and the "decline/safe" side is always choice B by catalog
convention.

---

## Goals

- Break run-to-run sameness: authored moments create stories players remember and replay for
  ("I got the merchant offer the same day a blight hit — so glad I sold").
- Create genuine state-dependent decisions — the right answer depends on coins, board state, soil
  health, and season pressure, never a puzzle with one correct answer.
- Deliver G4's short-term-goal itch through opt-in **contracts** (harvest N of crop C within D days
  for a reward) without building a parallel daily-objective reward system.
- Keep the economy simulator the referee: every coin number is a config knob gated on the
  15–35% win / ≈1.0–1.3× overshoot `smartMixed` band.

## Non-goals

- No standalone per-day objective picker or pooled daily rewards (G4's original form — deliberately
  not built; see the 2026-06-05 deferral rationale).
- No more than **one concurrent contract** (contract-type events are excluded from the draw while
  one is active).
- No event art beyond emoji; no per-event sounds this ship (can ride the 021 `playSfx` seam later).
- No negative/punishing events — effects are opportunities or foreshadowing, per Proposal C.
- No changes to the season disaster budget, market events, or streak systems beyond the defined
  integration points.

---

## Mechanic

### Scheduling (lazy, per-season, guaranteed)

Each season deterministically receives **1 event, plus a second with `secondEventChance`**
(default 0.5), on distinct random days inside a **mid-season window**: season days
`1 + windowStartOffset` … `1 + windowEndOffset` (defaults 4 and 15 → days 5–16 of a 20-day season).
The window avoids the onboarding overlap at the start of season 1 and the season-end crunch.

Scheduling is **lazy**: `processTurn` calls an `ensureSchedule` step — whenever the season of the
day being processed differs from `farmEvents.scheduleSeason`, it draws that season's schedule from
the injected RNG (count, then distinct days) and stores it. This covers day 1 of a new run (empty
slice, `scheduleSeason: 0`), season transitions, and Endless seasons (which keep scheduling the
same way, window anchored to each endless season's `startDay`). Migrated mid-season saves clamp the
window to future days only; if the remaining window is empty, that season simply gets no event.

### Firing

At the end of `processTurn`, if the **new** `currentDay` is in `scheduledDays` and no event is
`pending`, the engine draws an event id from the catalog (uniform among ids not in `seenIds`;
contract-type ids are excluded while a contract is active) and sets
`pending = { eventId, firedDay: currentDay }`. `seenIds` gets the id immediately; when all catalog
ids have been seen, the pool resets (long Endless runs recycle content rather than going quiet).

### Choosing

The UI presents the pending event in a dedicated modal after the Day Summary closes and **blocks
Next Day** until the player answers. A new pure engine function applies the choice:

```ts
resolveFarmEventChoice(state, choice: 'A' | 'B', config): GameState
```

It applies the chosen side's effect list (instant effects immediately; lingering effects appended
to `activeEffects`; contracts into `contract`), clears `pending`, and records
`lastResolved = { eventId, choice, day, auto: false }` for the analytics render-diff hook.

**Auto-decline invariant:** if `processTurn` is ever called while `pending` is set (a UI bug, a
test, or the simulator choosing not to engage), the engine first resolves the event as **choice B**
with `auto: true`, then proceeds. Choice B is always the decline/safe side, so the invariant is
well-defined for every event. A reload with `pending` set re-presents the modal (state persists).

---

## Effect primitives (closed set)

Every choice side is a list of zero or more primitives. They are plain serializable data — no
functions in the catalog's runtime state — so saves, tests, and sim bots all speak the same shapes.
One exception to choice attachment: an event definition may also carry **fire-time effects**
(applied when the event fires, before any choice) — used only by `weather_pin` for the Drought
Warning, whose forecast is real or not regardless of what the player picks.

| Kind | Payload | Behavior |
|---|---|---|
| `coins_delta` | `amount` (may be negative for buy-ins) | Applied immediately in `resolveFarmEventChoice`. A negative amount is only offered when the modal disables the button if unaffordable. |
| `sell_standing_crops` | `priceFactor` | Immediately clears every growing plot (cropId/daysRemaining/dayPlanted null, `droughtPenalised` false; `consecutiveHarvests` **unchanged** — a private sale, not a harvest) and credits `coins(baseYield × priceFactor)` per cleared crop. No weather/market/stand multipliers, no streak effect, no exhaustion increment. |
| `yield_buff` | `multiplier`, `harvestsRemaining`, `exhaustionFactor` (default 1) | Lingering. Each harvested plot's yield is multiplied by `multiplier` (stacking multiplicatively with weather/market/Farm Stand inside the existing single `coins()` floor) and `consecutiveHarvests` increments by `exhaustionFactor` instead of 1. `harvestsRemaining` decrements per harvest event; the effect expires at 0. |
| `seed_discount` | `cropId`, `factor` | Lingering, expires at the end of the day it was granted (cleared by the next `processTurn`). `computeSeedCost` applies it multiplicatively with the Toolshed discount, floored by `coins()`. |
| `weather_pin` | `day`, `weatherId` | Hidden foreshadowing: rolled at fire time (see Drought Warning), it forces that day's weather to `weatherId` instead of the seasonal-band roll, then clears. Never surfaced to the player before it hits. |
| `contract` | `cropId`, `quantity`, `deadlineDays`, `reward` | Creates `contract = { eventId, cropId, remaining: quantity, deadlineDay: firedDay + deadlineDays, reward }`. `processTurn` decrements `remaining` per qualifying harvest event; at 0 it credits `reward` **before the bankruptcy check** (same survival-counting rule as the streak bonus), logs completion, and clears. If `currentDay > deadlineDay` first, it clears with an expiry log line and **no penalty**. Contracts persist across season boundaries; the run ending moots them. |

---

## Event catalog (6 events, v1)

Copy below is the design intent; final strings live in `farmEventCatalog.ts`. All coin numbers are
**provisional pending sim gating**. Choice B is always decline/safe.

| # | Event | Choice A | Choice B | Tension (why both sides are defensible) |
|---|---|---|---|---|
| 1 | 🧳 **The Traveling Merchant** — "A buyer offers to take everything growing in your fields, right now." | `sell_standing_crops` at **1.4×** base yield | Decline | Strong with a full board and a disaster-heavy season looming; weak when crops just went in. The modal shows a live estimate of the offer. |
| 2 | 🌸 **Bountiful Spring** — "Unusually rich soil this week." | `yield_buff`: next **3** harvests **+50%**, `exhaustionFactor: 2` | Decline | Windfall vs. soil health — costly if plots are near exhaustion. |
| 3 | 🌵 **Drought Warning** — "The almanac says a flash drought is likely within days." Pre-rolled at fire time: **70%** chance a `weather_pin` schedules a real `flash_drought` 2–3 days out (rng picks the offset). | `seed_discount`: radish seeds **half price today** | Hold and wait | Acting on uncertain information; 30% of the time the drought never comes. The pin fires (or doesn't) regardless of the choice — the choice is the reaction window. |
| 4 | 📜 **The Miller's Order** — "The miller needs parsnips for the harvest fair." *(contract — G4 fold-in)* | `contract`: **3 parsnip** harvests within **6 days** → **+55🪙** | `coins_delta` **+12🪙** now | Guaranteed small vs. conditional big; bad if the board is committed to other crops. |
| 5 | 🎪 **The Fair Committee** — "The county fair wants fresh radishes, fast." *(contract — G4 fold-in)* | `contract`: **4 radish** harvests within **5 days** → **+40🪙** | `coins_delta` **+10🪙** now | Same shape, faster tempo, cheap crop — a different board state favors it than the Miller. |
| 6 | 🐝 **The Wandering Beekeeper** — "For a small fee, her bees will pollinate your fields." | `coins_delta` **−15🪙** + `yield_buff`: next **4** harvests **+20%** (no exhaustion downside) | Decline | Up-front cost against future harvests; dead money if pests wipe the plots. Button disabled when unaffordable. |

---

## Data model

### `FarmEventsConfig` (new) on `EconomyConfig`

```ts
export interface FarmEventsConfig {
  windowStartOffset: number;   // first eligible season day = startDay + this (default 4)
  windowEndOffset: number;     // last eligible season day = startDay + this (default 15)
  secondEventChance: number;   // 0..1 chance of a 2nd event per season (default 0.5)
  events: FarmEventDefinition[];  // the authored catalog with all per-event numbers
}
```

`FarmEventDefinition` carries id, emoji, title, body copy, and per-choice
`{ label, summary, effects: FarmEventEffectSpec[] }`. Per-event tunables (multipliers, rewards,
deadlines, the Drought Warning's pin chance) live in these specs so the simulator sweeps them.
Constants join `constants.ts` in the existing `MARKET_*` style.

### `GameState` additions (schema 9 → 10)

```ts
farmEvents: {
  scheduleSeason: number;                 // 0 = never drawn
  scheduledDays: number[];
  pending: { eventId: FarmEventId; firedDay: number } | null;
  activeEffects: FarmEventEffect[];       // yield_buff / seed_discount / weather_pin with live counters
  contract: ContractState | null;
  seenIds: FarmEventId[];
  lastResolved: { eventId: FarmEventId; choice: 'A' | 'B'; day: number; auto: boolean } | null;
}
```

Initial value: `{ scheduleSeason: 0, scheduledDays: [], pending: null, activeEffects: [],
contract: null, seenIds: [], lastResolved: null }`. Effect payloads are resolved from config at
choice time (frozen into state), so a mid-run config change cannot alter a live effect — same rule
as market multipliers.

### `DailyLogEntry` additions

```ts
eventBuffApplied: { eventId: FarmEventId; multiplier: number; harvestsAffected: number } | null;
contractProgress: { cropId: CropId; remaining: number; deadlineDay: number } | null;
contractCompleted: { eventId: FarmEventId; reward: number } | null;
contractExpired: FarmEventId | null;
```

These make the Day Summary self-contained (same principle as `marketActive`/`buildingsApplied`).
A pinned drought logs as ordinary `flash_drought` weather — the pin is invisible by design.

---

## Engine logic

New pure module **`src/engine/farmEvents.ts`** (pure functions, no React, RNG injected) plus
data-only **`src/engine/farmEventCatalog.ts`**. Exposed functions:

```ts
ensureSchedule(fe, currentDay, config, rng)      // draw a season's schedule when stale
maybeFireEvent(fe, newCurrentDay, rng, config)   // set pending on a scheduled day; applies fire-time effects (the Drought Warning's pre-rolled pin)
resolveChoice(state, choice, config)             // apply effects; exported as resolveFarmEventChoice
autoResolvePending(state, config)                // the choice-B invariant, called by processTurn
buffMultiplierFor(activeEffects)                 // aggregate yield_buff factor for one harvest
seedDiscountFor(activeEffects, cropId)           // 1 or the active discount factor
pinnedWeatherFor(activeEffects, day)             // weather_pin lookup
tickEffects(...)                                 // decrement/expire counters end of turn
merchantOfferValue(state, config)                // live modal estimate for sell_standing_crops
```

### `processTurn` ordering (integration points, in sequence)

1. **Auto-resolve** a still-`pending` event as choice B (`auto: true`).
2. `ensureSchedule` for the season of the day being processed.
3. Weather resolution: `pinnedWeatherFor` overrides the seasonal-band roll when a pin matches
   today; the pin is consumed.
4. Harvest: `buffMultiplierFor` joins the existing multiplicative stack
   (`baseYield × weather × market × stand × buff`) inside the single `coins()` floor;
   `consecutiveHarvests` increments by the buff's `exhaustionFactor` while active;
   `harvestsRemaining` decrements per harvest event.
5. Contract accounting: decrement `remaining` per qualifying harvest; on completion add `reward`
   to the balance **before the bankruptcy check** (alongside the streak bonus).
6. Lease, tax, season-end, streak — unchanged.
7. `tickEffects`: expire spent buffs, end-of-day seed discounts, consumed pins.
8. **Fire**: if the new `currentDay` is scheduled and nothing is pending, draw and set `pending`.
9. Log the new `DailyLogEntry` fields.

`resolveFarmEventChoice` is a player action like `buyBuilding` — dispatched from the UI via
`useGameEngine`, persisted immediately.

---

## Simulator integration

- `FarmEventsConfig` joins the sim's economy presets so `npm run sim` exercises events by default.
- `tickDay` in `scripts/sim/runner.ts` gains a resolve step: if `pending`, answer via the run's
  **event policy** before the strategy acts.
- Three policies:
  - **`heuristic`** (default for `smartMixed`) — the per-event "defensible reasoning":
    - *Merchant:* accept iff ≥ half the occupied plots ripen within 2 days.
    - *Bountiful Spring:* accept iff ≤ 1 plot is near exhaustion (`consecutiveHarvests ≥ threshold − 1`).
    - *Drought Warning:* accept iff balance covers the discounted seeds plus 2 days' lease.
    - *Contracts:* accept iff enough free plantable plots exist for the required crop to beat the
      deadline (`quantity ≤ freePlots` and `growthDays + 1 ≤ deadlineDays`).
    - *Beekeeper:* accept iff balance > 3× current lease.
  - **`acceptAll`** / **`declineAll`** — the bounding variants, exposed via a sim flag
    (e.g. `--eventPolicy acceptAll`).
- Single-crop bots use `declineAll` (they stay naive, as with market events).

---

## Balance gating

Sim-gated exactly like 012/019. The catalog's coin numbers are promoted to `DEFAULT_ECONOMY` only
when **all three** policy variants keep `smartMixed` in band:

1. `npm run sim -- --strategies smartMixed --trials 500` under `heuristic`, `acceptAll`, and
   `declineAll`.
2. Confirm **15–35% win / ≈1.0–1.3× overshoot** for each.
3. Record the runs and the promoted numbers in
   `specs/022-narrative-events/tuning-results.md` (012/019 precedent).

Expected lever order if out of band: contract rewards and the Merchant's `priceFactor` first (pure
coin injectors), then buff multipliers, then `secondEventChance`. Because events are opt-in and
choice B is near-neutral, `declineAll` should sit closest to today's baseline — if *it* drifts out
of band, something other than this feature moved and the run should be investigated, not tuned
around.

---

## UI

### `FarmEventModal.tsx` (new)

- 018 wooden/parchment styling; emoji illustration, title, 2–3 sentences of story.
- Two full-width choice buttons, each with the flavor label plus a one-line mechanical summary
  ("Sell everything now — est. **+82🪙**" via `merchantOfferValue` / "Decline — harvest on
  schedule"). Buy-in buttons (Beekeeper) disable with a "not enough coins" hint when unaffordable.
- Opens after the Day Summary closes on a fired day; **Next Day is blocked** while `pending`.
- A11y: `role="dialog"`, focus trap, **Escape does not dismiss** — a choice is required.
  `prefers-reduced-motion` honored as elsewhere.

### HUD

Compact contract chip while a contract is live, reusing the streak-chip pattern:
`📜 2/3 · 4d left`. Hidden otherwise. (This is the one HUD addition; events themselves get no
persistent chip.)

### Day Summary (`DailyLog.tsx` / `DaySummaryModal`)

- Buff line when `eventBuffApplied`: "🌸 Rich soil: +50% on 2 harvests (1 boosted harvest left)".
- Contract progress line when `contractProgress`; completion line with celebratory styling and the
  reward when `contractCompleted`; neutral expiry line ("The miller found another supplier — no
  harm done") when `contractExpired`.
- Lines omitted when their field is null. Flavor strings live with the catalog/engine, not in
  components.

---

## Persistence & migration

- `GameState.schemaVersion` bumps **9 → 10**.
- v9 → v10 migration: add the empty `farmEvents` slice. The lazy scheduler then draws for the
  current season with the window clamped to **future days only** — a save migrated past its
  season's window simply gets no event that season (never punished, never retroactively credited).
- Defensive parse: a malformed/absent `farmEvents` field loads as the empty slice, consistent with
  existing load hardening.
- A persisted `pending` re-presents the modal on reload.

---

## Analytics & dashboard

Events ride the 017 layer (state-derived via the `useAnalyticsEvents` render-diff hook — `pending`
transitions and `lastResolved` drive them; no engine impurity):

| Event | Properties |
|---|---|
| `farm_event_fired` | `event_id`, `season`, `day` |
| `farm_event_choice` | `event_id`, `choice` (`A`/`B`), `auto` (boolean), `day` |
| `contract_completed` | `event_id`, `reward` |
| `contract_expired` | `event_id` |

Per-event schema versions under the existing `ANALYTICS_SCHEMA_VERSION` pattern; consent/DNT
handling unchanged.

**PostHog dashboard (deliverable):** provision a **"Pixel Parsnips — Narrative Events"** dashboard
via the PostHog MCP (020 precedent, EU project 216788) with tiles:

1. Event fires by `event_id` (are all six being seen?)
2. Choice split A vs B per `event_id` (a lopsided split flags a dominant choice — Proposal C's
   failure mode)
3. Auto-decline rate (`auto: true` share — should be ~0; nonzero flags a UI gap)
4. Contract funnel: offered → accepted → completed vs expired
5. Fires by season and by season-day (window behaving as designed?)
6. `farm_event_choice` → `run_ended` breakdown (do choices correlate with outcomes?)

Tiles validate once a first seed pass lands events in PostHog (same caveat as the 020 dashboard).

---

## Testing

- **Scheduling:** deterministic draw from seeded RNG (count honors `secondEventChance`, days
  distinct and inside the window); redraw on season change only; Endless seasons schedule; migrated
  mid-season save clamps to future days; empty remaining window → no events.
- **Firing:** pending set on a scheduled day; unseen-pool draw; contract-type ids excluded while a
  contract is live; pool resets when exhausted; no double-fire while pending.
- **Resolution:** each primitive applies correctly per event and choice; `lastResolved` recorded;
  Beekeeper buy-in rejected when unaffordable; `sell_standing_crops` credits
  `coins(baseYield × priceFactor)` per growing plot, leaves `consecutiveHarvests`/streak untouched.
- **Auto-decline:** `processTurn` with `pending` resolves choice B with `auto: true` before
  anything else.
- **Buffs:** multiplier stacks with weather/market/stand inside one `coins()` floor;
  `exhaustionFactor: 2` doubles the exhaustion increment; expiry after N harvests (multi-harvest
  turns decrement per harvest event).
- **Seed discount:** applies today (stacking with Toolshed, single floor), gone next turn.
- **Weather pin:** overrides the band roll on the pinned day, consumed after; 70/30 pre-roll honors
  injected RNG.
- **Contracts:** progress decrements on qualifying harvests only; reward added **before** the
  bankruptcy check (a completing contract can save a run); expiry clears without penalty; persists
  across a season boundary; log fields correct in all three phases.
- **Migration:** v9 → v10 adds the empty slice; malformed field parses to the empty slice.
- **UI:** modal renders copy + live merchant estimate; Next Day blocked while pending; Escape does
  not dismiss; disabled buy-in state; HUD contract chip appears/updates/hides; Day Summary lines
  render/omit per log fields.
- **Simulator:** heuristic policy unit tests per event (decision helpers, not full runs);
  `acceptAll`/`declineAll` flags plumb through.

---

## Out of scope

- Standalone daily objectives / pooled per-day rewards (G4's original form).
- Multiple concurrent contracts, chained/multi-stage events, or event dependencies.
- Event illustrations beyond emoji; per-event SFX (ride 021's `playSfx` seam later).
- Negative-only "punishment" events.
- Achievements tied to events (G14 — next backlog item, may reference event data later).
- Endless-mode-specific event content (same catalog recycles via the seen-pool reset).
