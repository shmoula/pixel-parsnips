# 010 — Plot Progression & Economy Rebalance (Delivery B)

**Status:** Design approved, awaiting spec review
**Date:** 2026-06-08
**Depends on:** 009-balance-simulator (the `EconomyConfig` foundation + the simulator used to tune this spec's numbers)

## Problem

The current economy has no real challenge or progression (see 009 for the measured
evidence: 97% win, ~4× wealth overshoot). Root causes:

1. **Faucets dwarf sinks.** The only sinks are a small flat lease and a 5% tax; a full
   board out-earns them by ~10×, so wealth runs away.
2. **You start at maximum scale.** All 12 plots are available on day 1 — there is no
   "grow the farm" arc, income is near-max from turn two.
3. **Progression runs backwards.** The only upgrade (cheaper seeds) makes the game
   *easier* over time, on top of compounding income.
4. **Targets grow slower than income** (linear 150→250→400→600 vs. compounding earnings).
5. **Crop balance is accidental** — the highest-margin crop (pumpkin) is an instant
   bankruptcy trap; parsnip silently dominates.

## Goal

Add a **plot-progression system** (start small, buy plots at escalating cost) as the
missing scaling sink + genuine progression, and **rebalance the crop/lease/tax/target
numbers** so a skilled player is challenged (target ~50–65% win for skilled play,
overshoot ≈1.2×) without making the game unfair. All numbers are **tuned using the
009 simulator**, not guessed.

Non-goals: no new crops, weather, or disasters; no monetization; no change to the
exhaustion/streak/fertilizer systems beyond exposing their numbers via `EconomyConfig`.

## Approach

### 1. Plot-progression mechanic (engine)

Builds on 009's `EconomyConfig`, which already carries `startingPlots`, `maxPlots`,
and `plotPrices` (inert in 009, activated here).

- **State:** add `unlockedPlots: number` to `GameState`. New games start at
  `config.startingPlots` (**4**); `maxPlots` stays **12**. The `plots` array remains
  length `maxPlots`; indices `≥ unlockedPlots` are **locked**.
- **`buyPlot(state, config): BuyPlotResult`** — unlocks the next plot.
  - Price = `config.plotPrices[state.unlockedPlots - config.startingPlots]`.
  - Errors: `max_plots_reached` (unlockedPlots ≥ maxPlots), `insufficient_funds`.
  - On success: deduct price, `unlockedPlots += 1`. Pure, no mutation.
  - The escalating price is the **scaling capital sink** the economy was missing.
- **`plantSeed`** rejects a locked plot (`plotId ≥ unlockedPlots`) with a new
  `plot_locked` error.
- **`processTurn`** needs no change — locked plots are simply empty and produce nothing.
  Lease stays a flat per-day, per-season fee (the plot *purchases* are the sink, not
  per-plot rent).
- **Schema bump 6 → 7.** Migration: existing saves get `unlockedPlots: maxPlots` (12)
  so runs already in progress are not retroactively punished. Add the v6→v7 branch to
  `migrateState`.

### 2. Rebalanced numbers (the `proposed` economy, tuned via 009)

These are the **starting point**; final values come from running `npm run sim` and
adjusting until `smartMixed` lands in the target band. Encoded as a new
`proposed` preset in `scripts/sim/economyPresets.ts`, then promoted to
`DEFAULT_ECONOMY` once validated.

| Lever | Current | Proposed (pre-tuning) |
|---|---|---|
| Starting plots | 12 (all) | **4**, unlock to 12 |
| Plot prices (unlock 5th…12th) | — | **40, 70, 110, 160, 220, 300, 400, 520** |
| Radish seed/yield/grow | 5 / 12 / 1d | **5 / 9 / 1d** |
| Parsnip seed/yield/grow | 10 / 28 / 2d | **11 / 24 / 2d** |
| Pumpkin seed/yield/grow | 20 / 65 / 3d | **22 / 55 / 3d** |
| Tax | 5% | **6%** |
| Lease S1–S4 | 15/20/25/30 | **18/26/36/48** |
| Targets S1–S4 | 150/250/400/600 | **180/400/700/1100** |
| Starting balance | 100 | 100 (revisit during tuning) |

Rationale: compressed crop margins stop runaway income; pumpkin's payoff is tightened
so it is a *choice*, not a death trap; higher lease/tax make a bad weather streak
actually bite; steeper geometric-ish targets keep each season a real checkpoint;
plot purchases drain capital and create the progression arc. **Final numbers are
whatever the simulator says hits 15–35% smartMixed win, ≈1.2× overshoot.**

### 3. Simulator extension (in `scripts/sim/`, from 009)

- Extend `smartMixed` to **buy plots**: when balance comfortably exceeds the next plot
  price *and* the board is fully utilized, buy a plot before/instead of over-stocking
  seeds. (A trivial `buyPlot`-aware policy; keeps the bot a realistic lower bound.)
- The `baseline` preset (12 plots) still works — `startingPlots == maxPlots` means no
  plots to buy, so the plot logic is a no-op there. This lets us compare old vs. new.

### 4. UI

- New `LockedPlot` branch in `PlotCard` (highest-or-near priority, before EmptyPlot):
  renders 🔒 and, **only on the single next-purchasable plot**, a `Buy plot · N🪙`
  button (disabled + dimmed when unaffordable). Plots beyond the next show a plain lock.
- Drive it with derived props: `unlockedPlots`, `nextPlotPrice`, `canAffordPlot`.
- `FarmGrid` passes those through from `GameState`.
- `useGameEngine` exposes `buyPlot()` (mirrors the other action callbacks) and a
  `getNextPlotPrice()` helper.
- Optional: small "Plots 4/12" readout in the HUD or shop. Keep minimal (YAGNI).

## Components & boundaries

- Engine: `buyPlot` is a new pure function alongside the others; `unlockedPlots` is a
  single scalar on state. Clear interface, independently testable.
- UI: `LockedPlot` is a self-contained presentational branch; `useGameEngine` gains one
  action + one selector, following the existing pattern exactly.
- Numbers live entirely in `EconomyConfig`/presets — no balance value hard-coded in UI.

## Testing

- **Engine (TDD):** `buyPlot` success path (deducts price, increments, correct price
  from `plotPrices`); `max_plots_reached`; `insufficient_funds`. `plantSeed` returns
  `plot_locked` for `plotId ≥ unlockedPlots`. `initialGameState` starts with
  `unlockedPlots === startingPlots`. Migration v6→v7 sets `unlockedPlots = maxPlots`.
- **UI:** `PlotCard` renders `LockedPlot` for locked indices; Buy button disabled when
  unaffordable; clicking the next plot calls `buyPlot`. Accessibility: locked plots have
  a clear `aria-label`.
- **Balance validation (via 009 sim):** record the final `npm run sim` table in this
  spec folder (e.g. `tuning-results.md`) showing `proposed` hits the target band and
  single-crop strategies are non-viable.
- `npm test && npm run lint` green.

## Success criteria

- New game starts with 4 usable plots; the player can buy plots up to 12 at the
  configured escalating prices; locked plots are clearly indicated and not plantable.
- Old saves load without data loss (migrated to 12 unlocked plots).
- The shipped `DEFAULT_ECONOMY` (promoted from the tuned `proposed` preset) measures, in
  `npm run sim`: `smartMixed` win 15–35% (observed 16.9%), overshoot ≈1.1–1.3×, single-crop strategies
  mostly failing — i.e. the player must mix crops *and* manage expansion/cash-flow.
- No regressions in existing engine/UI tests.

## Risks / notes

- Tuning is iterative; change **one lever at a time** between sim runs so each effect is
  attributable (the 009 report makes this fast). Avoid the "change everything at once"
  swing we already saw (97% → 0%).
- Starting with 4 plots and the higher early lease (18) could make the opening too tight
  — watch the season-1 bankruptcy rate in the sim and soften lease or starting balance if
  it spikes.
- The simulator bot is a difficulty *floor*; confirm the final feel with a manual
  click-through playthrough before declaring done.
