# Research: Plot Exhaustion Maintenance

**Feature**: 002-plot-exhaustion-maintenance
**Date**: 2026-03-17
**Status**: Complete — all unknowns resolved
**Carries forward**: All decisions from `specs/001-farming-tycoon-game/research.md`
(build tooling, testing framework, state architecture, immutable update patterns,
localStorage strategy, Tailwind palette, weather determinism, WCAG compliance,
coin rounding). Only net-new decisions are documented below.

---

## 1. PlotState Exhaustion Representation: Discriminated Union vs. Extra Fields

**Decision**: Add two optional fields directly to the existing `PlotState` interface:
`consecutiveHarvests: number` and `exhaustedSinceDay: number | null`.

**Rationale**: `PlotState` already uses a flat field pattern (`cropId | null`,
`dayPlanted | null`, `daysRemaining | null`). Extending with two more fields is the
simplest correct design that fits the existing convention. A discriminated union
(e.g., `type PlotStatus = 'empty' | 'occupied' | 'exhausted'`) would require
restructuring existing consumers and type guards across `gameEngine.ts` and
`PlotCard.tsx` — rework that serves no stated requirement.

**Alternatives considered**:
- Discriminated union `PlotStatus` — rejected; higher refactor surface without benefit
  at this scope; violates YAGNI (constitution Principle IV)
- Separate `ExhaustedPlot` wrapper type — rejected; complicates `plots: PlotState[]`
  array uniformity; adds unnecessary indirection

---

## 2. Exhaustion Day Anchoring: When Is `exhaustedSinceDay` Set?

**Decision**: `exhaustedSinceDay` is set to `newCurrentDay` (`state.currentDay + 1`)
at the moment the third harvest is processed — i.e., it is anchored to the day that
completes once the turn finishes. Recovery is checked after `currentDay` is incremented
in `processTurn`.

**Rationale**: This produces clean integer arithmetic for the countdown displayed
to the player:

```
daysUntilRecovery = EXHAUSTION_RECOVERY_DAYS - (currentDay - exhaustedSinceDay)
```

- Turn that causes exhaustion completes → `currentDay = D`, `exhaustedSinceDay = D` → 3 days remaining ✅
- Next turn → `currentDay = D+1` → 2 days remaining ✅
- Next turn → `currentDay = D+2` → 1 day remaining ✅
- Next turn → `currentDay = D+3` → 0 → plot clears ✅

**Recovery condition**: `currentDay - exhaustedSinceDay >= EXHAUSTION_RECOVERY_DAYS`
checked in a new Step 8.5 within `processTurn`, after the day increment.

**Alternatives considered**:
- Anchor to `state.currentDay` (pre-increment) — rejected; produces off-by-one where
  the turn that causes exhaustion shows "2 days remaining" rather than "3"
- Store absolute "recover on day" — equivalent in math, slightly less flexible for
  display; rejected as a wash

---

## 3. Fertilizer Pricing

**Decision**: `FERTILIZER_COST = 30` coins per unit.

**Rationale**: Game economy context:
- Daily land lease drain: 15 coins
- Cheapest seed (radish): 5 coins, yield 12 coins (+7 net)
- Mid-tier seed (parsnip): 10 coins, yield 28 coins (+18 net)
- Tool upgrade tiers: 50 / 120 / 250 coins

At 30 coins, Fertilizer costs 6× a radish seed and represents ~2 full days' lease
payment. A player managing all 12 plots who suddenly has 4 exhausted plots faces a
120-coin bill to clear them immediately — a meaningful strategic cost that creates
genuine pressure without being unwinnable on day 1 (starting balance is 100 coins;
a single Fertilizer is affordable early). The price also sits between tier-1 and
tier-2 tool upgrades, so it competes meaningfully with upgrade decisions.

**Alternatives considered**:
- 20 coins — rejected; too cheap; reduces pressure
- 50 coins — rejected; equal to tier-1 upgrade; would make Fertilizer unaffordable
  in early game and remove strategic flexibility

---

## 4. `buyFertilizer` vs. Generalised Shop Item Architecture

**Decision**: Dedicated `buyFertilizer(state, quantity): BuyResult` pure function,
mirroring the existing `buySeed(state, cropId, quantity)` pattern.

**Rationale**: There is exactly one new shop item (Fertilizer). Generalising to a
`buyShopItem(state, itemType, quantity)` function would require introducing a new
discriminated union of item types, a lookup table, and conditional pricing logic —
all to serve one item. The simplest correct design is one function per item category,
consistent with how `buySeed` and `buyUpgrade` are already separated.

**Alternatives considered**:
- Generalised `buyShopItem` — rejected; YAGNI violation; adds abstraction cost for
  hypothetical future items with no current evidence they are needed
- Extending `buySeed` to support non-seed items — rejected; conflates concepts;
  `SeedInventory` is a separate typed struct from `fertilizerInventory`

---

## 5. Fertilizer Application Interaction Model

**Decision**: Clicking an Exhausted plot surfaces a "Use Fertilizer" action inside
the plot card UI, replacing the normal plant button. Confirming this action calls
`applyFertilizer(plotId)` via the hook. (Clarified in `/speckit.clarify` session.)

**Rationale**: Keeps the interaction on the farm grid where the player's attention
is already focused. Consistent with the existing "click plot → interact" pattern
for planting.

---

## 6. No Approaching-Exhaustion Warning

**Decision**: The consecutive harvest counter is never displayed. No warning or
indicator is shown before the third harvest. (Confirmed in `/speckit.clarify` session.)

**Rationale**: Per the explicit design goal of increasing difficulty, Exhaustion
arrives as a surprise. Players who track plot usage mentally are rewarded; inattentive
players are penalised.

**Implementation note**: FR-014 enforces this — `consecutiveHarvests` is a pure
internal engine field. No component reads or renders it. TypeScript's
`noUnusedLocals` does not apply (it is read by `processTurn`).

---

## 7. `DailyLogEntry` Extension for Exhaustion Events

**Decision**: Add an `exhaustedPlots: number[]` field to `DailyLogEntry` listing
the `plotId` values of plots that became Exhausted during the turn.

**Rationale**: Constitution Principle V (Observability) requires user-facing
operations to emit observable signals. Exhaustion is a significant game event and
MUST be visible in the daily log so the player understands why a plot is blocked.
The `DailyLog` component can display "Plot #N became exhausted." messages.

**Alternatives considered**:
- Log nothing for exhaustion — rejected; violates Principle V (silent failure)
- Add a separate `ExhaustionEvent` structure — rejected; YAGNI at current scope;
  a simple `number[]` is sufficient

---

## 8. Schema Version Bump

**Decision**: Bump `SCHEMA_VERSION` from `1` to `2`. Old saves are silently discarded
per the existing migration policy (no transforms; start fresh with a console log).

**Rationale**: `PlotState` gains two new required fields (`consecutiveHarvests`,
`exhaustedSinceDay`) and `GameState` gains `fertilizerInventory`. A v1 save loaded
without migration would have `undefined` for these fields, causing type errors and
incorrect game behavior. The existing policy of "discard stale, start fresh" is
correct and proportionate for a single-player game.
