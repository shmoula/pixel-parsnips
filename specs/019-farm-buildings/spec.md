# G8 — Farm Buildings (unified upgrade track)

**Status:** Design approved · 2026-07-18
**Backlog item:** [G8](../../backlog.md) — Phase 3 "Give wealth somewhere to go". Scope grew during
brainstorming: G8's infrastructure track **absorbs the 3-tier tool ladder**, collapsing both into one
unified Buildings system. Also resolves backlog Open Decision #3 (G8 before G9; G9 stays open).
**Refs:** p1·I3 + 2026-07-18 brainstorm (shop-merge decision)
**Effort:** M+ (M feature work + a 010-magnitude sim retune)

---

## Summary

Replace the shop's two parallel upgrade surfaces — the sequential 3-tier tool ladder (a fake choice:
nobody skips Tier 1) and the planned infrastructure track — with **one unified Buildings section**:
five one-time purchases, uniform card visual, bought in any order within availability gates.

Three buildings mitigate disasters and maintenance (Scarecrow, Irrigation Well, Compost Bin — the
original G8 intent), one amplifies income (Farm Stand), and one (**Toolshed**) carries the seed
discount the tool ladder used to provide, as a single flat purchase. Blight deliberately remains
uninsurable, so disasters keep teeth.

`GameState.upgradeTier` is removed (schema 8 → 9). All costs and effect magnitudes live in a new
`BuildingsConfig` block on `EconomyConfig` so the balance simulator can sweep them. Because the seed
discount curve changes, this is a **full retune**, not a pricing add-on — final numbers are whatever
keeps `smartMixed` inside the tuned difficulty band (see [Balance gating](#balance-gating)).

---

## Goals

- Give post-plot wealth **strategic agency**: disaster odds reach 28–35% in Seasons 3–4; buildings
  let players insure against the risks that hurt *their* strategy most.
- Replace the ladder's forced sequence with **real choices**: five distinct effects competing for the
  same budget ("Scarecrow now, or save for Farm Stand?").
- Add ~1,000 coins of optional sink capacity on top of plot purchases.
- Simplify the shop: Seeds / Supplies / **Buildings** (+ the owned-items tray), one card visual for
  every one-time purchase.
- Keep every number sim-tunable without touching engine code.

## Non-goals

- No blight mitigation — one uninsurable disaster is a design feature.
- No building sprites on the farm scene (follow-up backlog item; shop-only this ship).
- No refunds, selling, or per-run building tiers; no cross-run persistence (G15 territory).
- No G9 farm expansion (plots beyond 12) — separate backlog item, still open.
- No changes to crop yields, weather bands, market events, or season targets beyond what the retune
  requires (crop base yields stay untouched per the 010 doctrine).

---

## The buildings

| Building | Prior cost | Effect | Available | Strategic role |
|---|---|---|---|---|
| 🛠️ Toolshed | 150 | Seeds cost **−40%** (flat) | Day 1 | Income engine; replaces the 20/40/60% ladder |
| 🍂 Compost Bin | 150 | Exhausted plots rest **2 days** instead of 3 | Season 2 | Less idle land; pairs with rest-rotation play |
| ⛲ Irrigation Well | 180 | Flash Droughts penalise planting for **1 day** instead of 2 | Season 2 | Blunts the most disruptive disaster |
| 🎃 Scarecrow | 220 | Pest Infestations destroy each plot at **25%** instead of 50% | Season 2 | Halves worst-case pest damage |
| 🧺 Farm Stand | 300 | All harvests sell for **+10%** | Season 2 | Late-game amplifier once plots are maxed |

*Farm Stand is p1's "Market Stall", renamed to avoid confusion with 012 market events.*

All five are **per-run** purchases (a new run starts with none), persist through season transitions
and Endless mode, and are one-time (no stacking, no upgrades-of-buildings).

**Every cost and magnitude above is a prior, not a commitment.** The simulator pass owns the final
values; the spec's numbers are the starting point of the sweep.

### Effect semantics (engine-exact)

- **Toolshed** — `computeSeedCost` returns `coins(baseSeedCost × (1 − seedDiscount))` when owned,
  the base cost otherwise. Applies to all three crops, at purchase time only (seeds already in
  inventory were bought at the old price; there is no repricing).
- **Compost Bin** — the natural-recovery check compares against an effective recovery period:
  `ownsCompost ? 2 : 3` days. Buying it while plots are already resting benefits them immediately
  (the next `processTurn` uses the shorter period). Fertilizer's instant restore is unchanged and
  remains strictly better per-plot — Compost is the passive complement.
- **Irrigation Well** — a Flash Drought event adds **+1** day to `flashDroughtDaysRemaining`
  instead of +2. The existing skip-decrement-on-firing-turn rule is unchanged, so the penalty
  window covers exactly 1 subsequent planting day. Buying the Well **mid-window does not shorten an
  already-running counter** (same "captured at event time" principle as market multipliers).
  Stacking droughts still stack (+1 each).
- **Scarecrow** — the per-plot destruction roll on a Pest Infestation turn becomes
  `rng() < 0.25` instead of `rng() < 0.5`. The `pestDestructionOverride` test seam is unchanged.
- **Farm Stand** — harvest yield becomes
  `coins(baseYield × weatherMultiplier × marketModifier × 1.1)`; one `coins()` floor at the end,
  exactly like the market modifier integrated in 012.

---

## Availability & gating

- Each `BuildingDefinition` carries `unlockSeason`: **1** for Toolshed, **2** for the other four.
- A building is purchasable when `getSeasonForDay(currentDay, config).number >= unlockSeason`.
  Endless mode always satisfies the gate (season numbers keep rising). Boundary: day 20 (Season 1's
  last day) is still locked; day 21 unlocks.
- The gate is enforced in the **engine** (`buyBuilding` returns `not_unlocked`), not just hidden by
  UI.
- **Teaser cell:** before Season 2, the Buildings section shows the Toolshed card plus a single
  inert placeholder card — "🔒 New stock arrives in Season 2" — instead of four locked cards. From
  Season 2 the placeholder is replaced by the four building cards.

### Dev flag for playtesting

Manual testing shouldn't require surviving to day 21:

- New UI-layer module `src/devFlags.ts`: parses `?dev=flag1,flag2` from the URL **only when
  `import.meta.env.DEV`**; always empty in production builds.
- `resolveEconomy()` (same module): returns `DEFAULT_ECONOMY`, except the `buildings-s1` flag maps
  every building's `unlockSeason` to 1.
- `useGameEngine` resolves the economy once and **threads it through every engine call** it makes
  (`initialGameState`, `processTurn`, `plantSeed`, all buys, `computeSeedCost`, …). This finally
  uses the config seam the engine was built with (sim and tests already inject configs this way);
  the engine itself stays browser-free.

Usage: `npm run dev` → `http://localhost:5173/?dev=buildings-s1` → all five buildings purchasable
from day 1.

---

## Data model

### Types

```ts
export type BuildingId =
  | 'toolshed'
  | 'compost_bin'
  | 'irrigation_well'
  | 'scarecrow'
  | 'farm_stand';

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  emoji: string;
  cost: number;
  description: string;   // plain-language card copy ("Seeds cost less"), not percentages alone
  unlockSeason: number;  // 1 = from day 1
}
```

### `EconomyConfig` changes

```ts
// REMOVED: upgrades: UpgradeTierDefinition[]  (type UpgradeTierDefinition deleted too)

// Base disaster knobs extracted from hard-coded engine literals (009 pattern):
pestDestructionChance: number;   // 0.5  — was literal `rng() < 0.5`
flashDroughtWindowDays: number;  // 2    — was literal `+ 2`

buildings: {
  definitions: BuildingDefinition[];   // the five above, priors as listed
  seedDiscount: number;                // 0.40 — Toolshed
  exhaustionRecoveryDays: number;      // 2    — Compost Bin (base stays config.exhaustionRecoveryDays = 3)
  droughtWindowDays: number;           // 1    — Irrigation Well
  pestDestructionChance: number;       // 0.25 — Scarecrow
  yieldMultiplier: number;             // 1.10 — Farm Stand
};
```

Constants live in `constants.ts` mirroring the `STREAK_*` / `MARKET_*` pattern and are consumed by
`DEFAULT_ECONOMY`.

### `GameState` changes (schema 8 → 9)

```ts
// REMOVED: upgradeTier: UpgradeTier   (type UpgradeTier and MAX_UPGRADE_TIER deleted)

buildings: Record<BuildingId, boolean>;   // initial: all false
```

### `DailyLogEntry` addition

```ts
/** Disaster mitigations in effect this turn: subset of {irrigation_well, scarecrow}.
 *  Logged (not derived from current state) so reopening "Last Turn" after buying a
 *  building can't show a mitigation that didn't happen. */
buildingsApplied: BuildingId[];
```

`irrigation_well` is recorded when the turn's weather is `flash_drought` and the Well is owned;
`scarecrow` when the weather is `pest_infestation` and the Scarecrow is owned. Toolshed, Compost,
and Farm Stand are **not** logged — their feedback surfaces live elsewhere (seed prices, plot
countdown, the building card itself).

---

## Engine logic

### `buyBuilding` (replaces `buyUpgrade` and the planned `buyInfrastructure`)

```ts
export type BuyBuildingResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'invalid_id' | 'already_owned' | 'not_unlocked' | 'insufficient_funds' };

export function buyBuilding(state, id, config = DEFAULT_ECONOMY): BuyBuildingResult
```

Guard precedence (load-bearing, like `plantBlockReason`): `invalid_id` → `already_owned` →
`not_unlocked` → `insufficient_funds`. Pure, no mutations, mirrors `buyPlot`.

### Effect hook sites (all in existing code paths)

| Hook | Site (pre-change) | Change |
|---|---|---|
| Toolshed | `computeSeedCost` tier lookup | signature becomes `computeSeedCost(cropId, buildings, config)` |
| Scarecrow | pest roll `rng() < 0.5` in `processTurn` | threshold from config, picked by ownership |
| Irrigation Well | `flashDroughtDaysRemaining + 2` | increment from config, picked by ownership |
| Compost Bin | recovery check vs `config.exhaustionRecoveryDays` | effective days picked by ownership |
| Farm Stand | `coins(baseYield × weather × market)` | fourth multiplicative factor, single floor |

`processTurn` step ordering is otherwise unchanged; `buildingsApplied` is assembled alongside the
existing `pestDestroyedPlots` / `flashDroughtDaysAfter` bookkeeping.

### Removals

`UPGRADE_TIER_DEFINITIONS`, `UpgradeTierDefinition`, `UpgradeTier`, `MAX_UPGRADE_TIER`,
`buyUpgrade`, `UpgradeResult`, and `useGameEngine`'s `buyUpgrade`/`getNextUpgradeCost` all go away.
Their tests are **rewritten as building tests**, not silently dropped.

---

## Persistence & migration

- `SCHEMA_VERSION` bumps 8 → 9.
- **v8 → v9:** add `buildings` with all-false, then map the ladder:
  `upgradeTier >= 1` → `toolshed: true`; drop the `upgradeTier` field. Tier-1 owners get a small
  windfall (paid 50, receive the flat discount), Tier-3 owners a small haircut (60% → 40%) — an
  accepted wash for mid-run localStorage saves, noted in the migration's `console.info`.
- Older chains (v3–v7) run their existing steps, then the same ladder mapping — every legacy save
  lands on v9 with a correct `buildings` record.
- **Load hardening:** a malformed/missing `buildings` field normalizes to all-false; unknown keys
  are dropped; values are coerced to boolean (same defensive posture as `normalizeMarket`).

---

## Simulator integration

- `scripts/sim/strategies.ts`: `maybeUpgrade` is replaced by `maybeBuyBuildings(state, config)` —
  attempts purchases in a priority order (initial: `toolshed → compost_bin → irrigation_well →
  scarecrow → farm_stand`) while keeping the established lease-buffer idiom (`balance − cost ≥
  lease × 2`); simply skips gated buildings (`not_unlocked`).
- `smartMixed` calls it in the slot `maybeUpgrade` occupied. The single-crop bots buy **Toolshed
  only**, preserving their role as naive-but-tooled baselines.
- The buy-priority order and the pumpkin threshold (`coinBalance > 250`) are retune candidates.

## Balance gating

This is a **full retune** (the seed-discount curve changed shape), same process as 010/012:

1. Add a `019-buildings` preset to `scripts/sim/economyPresets.ts`.
2. Sweep building costs, `seedDiscount`, and bot buy-order with
   `npm run sim -- --strategies smartMixed --trials 500`.
3. Promote to `DEFAULT_ECONOMY` only when `smartMixed` sits in the
   **15–35% win / ≈1.0–1.3× overshoot** band (currently 18% / 1.08×).
4. Record the pass in `specs/019-farm-buildings/tuning-results.md`.

Tuning levers in priority order: building **costs** first, then `seedDiscount`, then mitigation
magnitudes. Crop yields and season targets are off-limits. Expected drift: win rate rises from 18%
(all five buildings add player power) — acceptable inside the band; sanity-check that single-crop
bots stay near their current 0%.

---

## UI

### Shop restructure (`Shop.tsx`)

- Sections become: **Seeds → Supplies → Active Buffs (owned tray) → Buildings**. The Tools section
  is deleted.
- New **`BuildingCard`** component replaces `UpgradeCard` everywhere: emoji, name, plain-language
  effect, price button; disabled + dimmed when unaffordable; same wood/awning dressing as today.
- Owned buildings render in the **Active Buffs tray** (uniform owned-variant of `BuildingCard`),
  exactly like owned tool tiers did. Bought cards leave the Buildings shelf; the shelf disappears
  when all five are owned (mirrors current Tools behavior).
- Pre-Season-2 the shelf shows: Toolshed card + the inert teaser cell. No interaction, no tooltip
  work needed.
- Mobile: unchanged behavior — the shop already stacks and scrolls.
- Onboarding (014): no special handling. The teaser is inert, and Toolshed (150) is unaffordable
  during the tutorial (start 130 minus tutorial seed purchases), so it cannot derail the guided
  flow.

### Effect feedback

Prevented losses are invisible by default; these make ownership feel real:

- **`DisasterBanner` sub-line** (driven by `lastDailyLog.buildingsApplied`):
  - pest + scarecrow → "🎃 Your Scarecrow thinned the swarm — fewer plots were hit."
  - flash drought + well → "⛲ Your Irrigation Well shortened the drought to 1 day."
  - The 013 staged-reveal / reduced-motion behavior is untouched; the sub-line renders inside the
    banner body. The generic Flash Drought weather description ("…for the next 2 days") stays
    static; the sub-line is what communicates the shortened window.
- **Toolshed**: seed prices in the shop simply show the discounted value (as they did with tiers).
- **Compost Bin**: the plot-card rest countdown must reflect the effective period. `PlotCard`
  currently computes it from the `EXHAUSTION_RECOVERY_DAYS` constant, so the effective recovery
  days (2 with Compost, 3 without) are threaded down as a prop.
- **Farm Stand**: passive; its owned card in the tray reads "+10% harvests".

---

## Analytics

One new **unified purchase event** on the 017 layer, following the render-diff detector pattern:

```ts
shop_purchased: {
  item_type: 'seed' | 'fertilizer' | 'building';
  item_id: string;      // 'radish' · 'fertilizer' · 'scarecrow' · …
  quantity: number;     // seeds/fertilizer support multi-buy; buildings always 1
  cost: number;         // total coins spent, reconstructed from prev-state prices
  day: number;
  season_number: number;
  coin_balance_after: number;
}
```

- Detector in `useAnalyticsEvents`: a per-commit **increase** in `seedInventory` /
  `fertilizerInventory`, or a `buildings` flag flipping false → true, is a purchase; decreases
  (planting, applying fertilizer) stay silent. Each action commits separately, so prev-state price
  reconstruction is unambiguous (seed costs use the prev state's `buildings`).
- **`plot_unlocked` is unchanged** — plots are bought on the farm grid, not the shop; the two
  events split by UI surface. (A PostHog union of both gives "all purchases" when needed.)
- `EVENT_VERSIONS` gains `shop_purchased: 1`. No bespoke infrastructure event exists — buildings
  ride the unified event.

---

## Testing

- **Engine — `buyBuilding`:** happy path per building; each error; guard precedence
  (`invalid_id` beats `already_owned` beats `not_unlocked` beats `insufficient_funds`).
- **Engine — gate boundary:** day 20 rejects (`not_unlocked`), day 21 accepts; Endless mode always
  unlocked; Toolshed purchasable on day 1.
- **Engine — Toolshed:** `computeSeedCost` with/without ownership, `coins()` rounding per crop.
- **Engine — Compost Bin:** plot recovers after 2 turns when owned, 3 when not; buying mid-rest
  shortens the remaining wait.
- **Engine — Irrigation Well:** drought event adds +1 when owned (+2 when not); skip-decrement rule
  intact; buying mid-window does **not** reduce an active counter; stacking still stacks.
- **Engine — Scarecrow:** deterministic RNG shows 0.25 threshold when owned, 0.5 when not;
  `pestDestructionOverride` seam still honored.
- **Engine — Farm Stand:** yield = `coins(base × weather × market × 1.1)`, single floor; stacks
  with market events correctly.
- **Engine — `buildingsApplied`:** contains `scarecrow` only on owned pest turns, `irrigation_well`
  only on owned drought turns, empty otherwise; never contains the other three ids.
- **Migration:** v8 saves with `upgradeTier` 0/1/2/3 → correct `buildings` record, field dropped;
  a chained v3 save lands on v9; malformed `buildings` hardens to all-false.
- **Analytics:** one `shop_purchased` per purchase with correct type/id/quantity/cost; no event on
  plant/apply-fertilizer; building purchase carries the definition cost.
- **Sim:** `maybeBuyBuildings` unit tests (priority order, buffer, gate skip); single-crop bots buy
  Toolshed only.
- **UI:** BuildingCard render states (buyable/unaffordable/owned); teaser cell pre-S2 and its
  replacement post-S2; owned tray uniformity; DisasterBanner sub-lines; discounted seed prices.
- **Dev flag:** `resolveEconomy` honors `buildings-s1` in DEV, ignores it in prod builds.
- Full suite (`npm test && npm run lint`) green; existing ladder tests rewritten, not dropped.

---

## Out of scope

- Farm-scene building sprites (new backlog polish item on ship).
- G9 (plots 13+), blight mitigation, refunds/selling, building tiers, cross-run persistence (G15).
- A1 onboarding funnel events (separate backlog item).
- Deprecating `plot_unlocked` (explicitly kept).
- Any market-event interaction beyond the multiplicative stack that already exists.

---

## Backlog updates on ship

- Mark **G8 done** (note the absorbed tool-ladder collapse and the Farm Stand rename).
- Record **Open Decision #3** as resolved: G8 shipped first; G9 remains open.
- Add follow-up item: **farm-scene building sprites** (Low, S–M, pure presentation).
- Document the dev-flag pattern (`?dev=buildings-s1`) in README.md's development section.
