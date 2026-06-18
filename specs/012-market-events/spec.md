# G7 — Market Events (Dynamic Crop Pricing)

**Status:** Design approved · 2026-06-16
**Backlog item:** [G7](../../backlog.md) — Phase 3 "Give wealth somewhere to go" (primary late-game variance lever)
**Refs:** p1·I5, p3·5, p4·E
**Effort:** M

---

## Summary

Add a temporary, periodic crop-yield modifier that breaks the "optimize once, autopilot forever"
problem. On a fixed 5-day cycle the game may schedule a **Market Event** affecting **one** crop —
a **Shortage** (yield up) or a **Glut** (yield down). Events are **announced one day before they
take effect**, last 3 days, and at most one is ever active at a time.

The event modifies that crop's yield as a multiplier stacked on top of the existing weather
multiplier. It is surfaced where the player decides (the Shop seed-card) and where the player reads
the forecast (the Day Summary). There is no persistent HUD chip.

All tunable numbers live in a new `MarketConfig` block on `EconomyConfig` so the balance simulator
(`npm run sim`) can sweep them. Final magnitudes are whatever keep `smartMixed` inside the tuned
difficulty band — see [Balance gating](#balance-gating).

---

## Goals

- Remove the static-crop-value problem: the optimal crop choice should shift over a run, not be
  solved once.
- Give skilled players a *positive* timing decision (pivot toward a Shortage) and a *negative*
  one to avoid (don't over-commit into a Glut) — two-directional variance that the disaster
  system (negative-only) does not provide.
- Act as the mid-to-late-game balance regulator (p4·E): a single probability/magnitude knob the
  simulator can pull before touching raw crop numbers.
- Stay fair: every event has a one-day reaction window before it bites.

## Non-goals

- No multiple concurrent events (at most one active at a time — see [Concurrency](#concurrency)).
- No per-crop independent rolls (p4 strict), no daily rolls (p1) — the cadence is a fixed 5-day
  cycle.
- No persistent HUD market chip (the HUD already carries Day/Balance/Season/Streak/Reputation).
- No new shop items, achievements, or narrative framing tied to events (those are G8/G14/G11).
- No effect on the season disaster budget — market events are an independent system.

---

## Mechanic

### Cycle & scheduling

A market **cycle** is `cadenceDays` (default 5) days long. Scheduling is evaluated during
`processTurn` whenever the **day being completed** is a cycle boundary (`currentDay % cadenceDays === 0`,
i.e. days 5, 10, 15, …):

1. If an event is currently `active` **or** already `pending`, do nothing (one-at-a-time guarantee).
2. Otherwise roll `fireChance` (default 0.5). On success, schedule a `pending` event:
   - **crop**: uniform random among the three crops (`radish`, `parsnip`, `pumpkin`).
   - **kind**: 50/50 `shortage` or `glut`.
   - **multiplier**: `shortageMultiplier` (default 1.4) or `glutMultiplier` (default 0.7).

A `pending` event is **announced that same evening** in the Day Summary ("📈 Tomorrow: Pumpkins
are scarce — prices up!"). It does **not** affect the harvest of the day it was scheduled.

### Activation, duration, expiry

On the **next** `processTurn`:

- A `pending` event becomes `active` with `daysRemaining = durationDays` (default 3) **before**
  that turn's harvest is resolved, so the announced effect applies starting the very next day (the
  `announceLeadDays = 1` reaction window).
- An `active` event decrements `daysRemaining` at end of turn; when it reaches 0 the event clears.

This yields a predictable rhythm: announce on a boundary day → 3 active days → quiet until the next
boundary. The cycle length being longer than the duration guarantees quiet gaps and prevents
back-to-back stacking.

### Concurrency

At most **one** event exists in any state combination that affects yield: either `active` is set,
or `pending` is set, or neither. The scheduling roll is skipped while either is set. (A `pending`
event scheduled on day 5 activates day 6 and runs through day 8; the next scheduling roll is day 10,
by which point it has cleared.)

---

## Yield integration

The single integration point is the harvest-yield computation in `processTurn`
(`gameEngine.ts`, currently `const adjustedYield = coins(crop.baseYield * weather.multiplier)`).
The market modifier becomes a third multiplicative factor, applied **before** tax:

```
marketModifier = (active && active.cropId === plot.cropId) ? active.multiplier : 1.0
adjustedYield  = coins(crop.baseYield * weather.multiplier * marketModifier)
```

`marketModifier` is `1.0` for every crop except the one currently under an active event. Weather and
market stack multiplicatively. Tax and the harvest-streak bonus are applied downstream exactly as
today.

---

## Starting numbers (sim-gated proposal)

| Knob | Field | Proposed start |
|---|---|---|
| Cycle length | `cadenceDays` | 5 |
| Fire chance per boundary | `fireChance` | 0.5 |
| Shortage multiplier | `shortageMultiplier` | 1.4 (+40%) |
| Glut multiplier | `glutMultiplier` | 0.7 (−30%) |
| Active duration | `durationDays` | 3 |
| Announce lead | `announceLeadDays` | 1 |

These are a **starting proposal, not final**. Because only one crop is affected at a time — and
often not the crop the player planted — net EV impact is diluted and the mechanic is expected to be
a mild regulator. The promoted values are whatever satisfy [Balance gating](#balance-gating).

`announceLeadDays` is fixed at 1 for this ship (the activation logic assumes a one-turn pending
stage). It is included in config for documentation/future use, not swept.

---

## Data model

### `MarketConfig` (new) on `EconomyConfig`

```ts
export interface MarketConfig {
  cadenceDays: number;        // cycle length; scheduling rolls on day % cadenceDays === 0
  fireChance: number;         // 0..1 chance to schedule an event at a boundary
  shortageMultiplier: number; // > 1, yield up
  glutMultiplier: number;     // < 1, yield down
  durationDays: number;       // active lifetime once it activates
  announceLeadDays: number;   // fixed 1 for this ship
}
```

`EconomyConfig` gains a `market: MarketConfig` field; `DEFAULT_ECONOMY` gets the proposed block
above. Constants are added to `constants.ts` mirroring the existing `STREAK_*` pattern and consumed
by `DEFAULT_ECONOMY`.

### `GameState` additions (schema 7 → 8)

```ts
export type MarketEventKind = 'shortage' | 'glut';

export interface MarketEvent {
  cropId: CropId;
  kind: MarketEventKind;
  multiplier: number;       // resolved from config at schedule time
}

export interface ActiveMarketEvent extends MarketEvent {
  daysRemaining: number;
}

// on GameState:
market: {
  active: ActiveMarketEvent | null;
  pending: MarketEvent | null;
};
```

Initial value: `{ active: null, pending: null }`. Multiplier is captured into the event at schedule
time so a mid-run config change cannot retroactively alter a live event.

### `DailyLogEntry` additions

```ts
marketActive: ActiveMarketEvent | null;   // event affecting THIS turn's harvest (post-activation)
marketAnnounced: MarketEvent | null;      // event scheduled this turn, taking effect next turn
```

These make the Day Summary self-contained: `marketActive` drives the active-event flavor line,
`marketAnnounced` drives the "Tomorrow:" announcement line.

---

## Engine logic

A new pure module **`src/engine/market.ts`** owns all market state transitions, mirroring the
`reputation.ts` / `seasons.ts` pattern (pure functions, no React, RNG injected). Exposed functions:

```ts
// Activate a pending event into an active one (called at the START of a turn, before harvest).
function activatePending(market): { active, pending }   // pending -> active(daysRemaining=duration)

// The yield multiplier for a given crop under the current active event.
function marketMultiplierFor(active: ActiveMarketEvent | null, cropId: CropId): number

// At a cycle boundary with no active/pending event, maybe schedule one. RNG injected.
function rollSchedule(market, currentDay, config: MarketConfig, rng): MarketEvent | null

// Decrement an active event at end of turn; returns the surviving active event or null.
function expireActive(active: ActiveMarketEvent | null): ActiveMarketEvent | null

// Human-readable flavor for announcements / active lines.
function announceText(ev: MarketEvent): string
function activeText(ev: ActiveMarketEvent): string
```

### `processTurn` ordering

1. **Activate** any `pending` event → `active` (so the announced effect applies to *this* turn's
   harvest). After this step, `active` is whatever affects this harvest — a freshly-activated event
   **or** one carried over from a prior turn — and that is what is recorded as the log's
   `marketActive`.
2. Resolve weather (unchanged).
3. Resolve harvest, applying `marketMultiplierFor(active, plot.cropId)` as the third yield factor.
4. Income, streak bonus, bankruptcy check, tax, season phase — all unchanged.
5. **Expire**: decrement `active.daysRemaining`; clear when it hits 0.
6. **Schedule**: if `currentDay % cadenceDays === 0` and no `active` and no `pending`, roll
   `fireChance`; on success set `pending` and record it as `marketAnnounced` for the log.

> Ordering note: a freshly scheduled `pending` (step 6) is never the same event that just expired
> (step 5), because scheduling is skipped while `active` is set, and an event scheduled on a prior
> boundary has cleared before the next boundary. Activation (step 1) and scheduling (step 6) never
> both fire for the same event on the same turn.

### RNG

Scheduling consumes the injected `rng` (same `rng?: () => number` parameter `processTurn` already
threads for weather and disasters). Tests pass deterministic RNG; the simulator passes its seeded
RNG so market events are reproducible in sims.

---

## Simulator integration

- Add the `MarketConfig` block to the sim's economy presets so `npm run sim` exercises market
  events by default.
- Teach the **`smartMixed`** strategy bot to react to market state: prefer planting a crop under an
  active/pending **Shortage**, avoid planting into a **Glut**. This keeps `smartMixed` the true
  difficulty floor by measuring best-case exploitation rather than indifference. The single-crop
  bots (`radishOnly`/etc.) stay naive — they show the downside of ignoring the market.
- Report is unchanged in shape; market effects show up in the existing win/overshoot metrics.

---

## Balance gating

This is balance-affecting work and is gated on the simulator exactly like 010:

1. Add the `MarketConfig` preset, run `npm run sim -- --strategies smartMixed --trials 500`.
2. Confirm `smartMixed` stays in the **15–35% win / ≈1.0–1.3× overshoot** band.
3. Only then promote the swept numbers into `DEFAULT_ECONOMY`.

If the proposed start pushes outside the band, tune `fireChance` first, then the magnitudes. The
expectation is the mechanic is close to net-neutral and needs little correction, but the sim decides.
Record the outcome in `specs/012-market-events/tuning-results.md` (same as 010).

---

## UI

### Shop seed-card indicator (`Shop.tsx` / seed-card component)

For the crop under the current **active** event:

- An arrow + label badge on that crop's Seed Card: `▲ +40%` (shortage, positive tint) or
  `▼ −30%` (glut, negative tint). Percentages are derived from the active multiplier, not
  hard-coded.
- Subtle tint/border on the card matching the direction (reuse existing positive/negative color
  tokens; no new art).
- Unaffected crops render exactly as today.
- The **pending** event is not shown in the Shop (it has no yield effect yet); it lives only in the
  Day Summary announcement.

### Day Summary (`DailyLog.tsx`)

Two new line types in the weather/forecast block:

- **Active line** — when `marketActive` is set:
  `📊 {Crop} {shortage|glut}: yield {×1.4|×0.7} ({N} day(s) left)` with directional styling.
- **Announcement line** — when `marketAnnounced` is set:
  `📈 Tomorrow: {announceText}` (e.g. "Pumpkins are scarce — prices up!" / "The market is
  flooded with Radishes — prices down.").

Both lines are omitted when their field is null. Flavor strings come from `market.ts`
(`activeText` / `announceText`) so wording lives with the logic.

### HUD

No change. (Explicitly out of scope per design.)

---

## Persistence & migration

- `GameState.schemaVersion` bumps 7 → 8.
- v7 → v8 migration: add `market: { active: null, pending: null }`. Existing runs continue with no
  event until the next boundary roll — never punished, never retroactively credited.
- Defensive parse: a malformed/absent `market` field on load is treated as
  `{ active: null, pending: null }`, consistent with the existing load hardening.

---

## Testing

- **Engine — schedule on boundary:** day 5 with no active/pending and an RNG that passes
  `fireChance` → a `pending` event is created; crop/kind/multiplier match the injected rolls.
- **Engine — no schedule off boundary:** day 6 never schedules regardless of RNG.
- **Engine — fireChance miss:** boundary day with RNG above `fireChance` → no event.
- **Engine — one-at-a-time:** boundary roll is skipped when `active` is set, and when `pending` is
  set.
- **Engine — activation:** a `pending` event becomes `active` with `daysRemaining = durationDays`
  at the start of the next turn, before harvest.
- **Engine — yield applied:** active Shortage on the planted crop multiplies that crop's yield by
  `shortageMultiplier`; a Glut by `glutMultiplier`; other crops unaffected.
- **Engine — weather stacking:** market and weather multipliers compound (e.g. weather ×1.2 +
  shortage ×1.4 → ×1.68, then `coins()` rounding).
- **Engine — expiry:** `daysRemaining` decrements each turn and the event clears at 0; no yield
  effect afterward.
- **Engine — multiplier frozen at schedule:** changing config after scheduling does not alter a
  live event's multiplier.
- **Engine — log fields:** `marketActive` reflects the event affecting the current harvest;
  `marketAnnounced` is set only on the turn an event is scheduled.
- **Migration — v7 → v8:** loading a v7 save yields `market: { active: null, pending: null }`.
- **Load hardening:** malformed `market` field parses to the empty market.
- **Simulator — smartMixed reacts:** with an active Shortage, the bot's chosen crop is the
  shortage crop (unit-test the decision helper, not a full sim run).
- **UI — Shop indicator:** affected crop card shows the correct arrow/percent/tint; others plain;
  pending event shows no shop badge.
- **UI — Day Summary active line:** rendered with correct crop/multiplier/days when `marketActive`
  set; omitted when null.
- **UI — Day Summary announcement line:** rendered with correct flavor when `marketAnnounced` set;
  omitted when null.

---

## Out of scope

- Multiple simultaneous events / per-crop independent rolls.
- Persistent HUD market chip or ticker.
- Player-triggered market actions (selling stockpiles, futures, contracts) — G7 is yield-side only.
- Market-event achievements (G14) or narrative framing (G11).
- Endless-mode-specific behavior: the same cadence/roll runs in Endless using the Endless economy;
  no special-casing beyond reading `cadenceDays` off config.
- Tuning the crop base yields themselves (G5 — separate, also sim-gated).
