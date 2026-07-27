# 022 Farm Events Tuning Results

Sim-gated with the Monte Carlo simulator (`npm run sim`) against the real engine.
The `smartMixed` bot is the **difficulty floor** — a skilled human plays meaningfully
better, so a bot win-rate of ~15–35% maps to roughly 50–65% for a skilled human.

Farm Events (G11) are authored story moments — 1–2 per season inside a mid-season
window — each a binary choice resolving to serializable effect primitives (instant
coins, sell-everything-now, timed yield buffs, one-day seed discounts, a hidden
weather pin, and delivery contracts). The question this tuning answers: **do the
catalog's coin numbers keep `smartMixed` inside the difficulty band under all three
event policies, and do events avoid rescuing naive single-crop play?**

## Target band

- `smartMixed` win **15–35%** and overshoot (avgPeak / final target) **≈1.0–1.3×**,
  under **all three** event policies (`heuristic`, `acceptAll`, `declineAll`).
- single-crop strategies still failing (events must not rescue naive play).
- `declineAll` should sit closest to the pre-events reference (`buildings019`).

## Sim commands

```bash
# Reference (events off — the shipped post-019 economy):
npm run sim -- --configs buildings019 --strategies smartMixed --trials 500

# The three gating passes (events on):
npm run sim -- --configs events022 --strategies smartMixed --trials 500 --eventPolicy heuristic
npm run sim -- --configs events022 --strategies smartMixed --trials 500 --eventPolicy acceptAll
npm run sim -- --configs events022 --strategies smartMixed --trials 500 --eventPolicy declineAll

# Naive single-crop bots (must still fail):
npm run sim -- --configs events022 --strategies radishOnly,parsnipOnly,pumpkinOnly,smartMixed --trials 500 --eventPolicy heuristic

# declineAll robustness: --seed 100, 200, 900
```

`events022` is `buildings019` + the live farm-event catalog (`DEFAULT_ECONOMY.farmEvents`).
The `eventPolicy` answers a pending event before the bot acts: `heuristic` uses the
per-event "defensible reasoning" from the spec; `acceptAll`/`declineAll` are the
bounding variants.

## Final comparison (500 trials, seed 42) — promoted numbers

```
config        strategy     policy      win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
buildings019  smartMixed   (n/a)       18.6  39.0       42.4   549      237.5    1.14x      46/21/19/19
events022     smartMixed   heuristic   20.4  36.8       42.8   606      255.0    1.26x      49/22/20/20
events022     smartMixed   acceptAll   20.0  38.6       41.4   621      255.0    1.29x      49/22/20/20
events022     smartMixed   declineAll  15.6  35.6       48.8   511      251.0    1.06x      48/18/16/16
events022     radishOnly   heuristic    0.0  56.0       44.0   143      130.0    0.30x      22/1/0/0
events022     parsnipOnly  heuristic    0.0  61.2       38.8   183      130.0    0.38x      39/4/0/0
events022     pumpkinOnly  heuristic    0.0  100.0      0.0    130      130.0    0.27x      0/0/0/0
```

All three `smartMixed` policies land **15–35% win / ≈1.0–1.3× overshoot**. Every
single-crop bot still fails at 0% win — events do not rescue naive play.

## `declineAll` robustness (500 trials each, promoted numbers)

| seed | win% | overshoot |
|------|------|-----------|
| 42   | 15.6 | 1.06×     |
| 100  | 15.8 | 1.06×     |
| 200  | 15.6 | 1.06×     |
| 900  | 14.6 | 0.99×     |

`declineAll` hugs the 15% floor (mean ≈15.4%) — appropriate for the worst-case
bounding policy that ignores every event. The seed-900 outlier (14.6%) is within
Monte-Carlo noise of the boundary; the canonical gate seed (42) clears it.

## Tuning journey

**Starting proposal** (plan defaults): contract B-side consolations `millers_order`
+12 / `fair_committee` +10, Drought Warning weather-pin chance 0.7, merchant
`priceFactor` 1.4, buffs 1.5×/1.2×.

**First gate:** `heuristic` 18.4% / 1.22× ✅, `acceptAll` 20.0% / 1.29× ✅,
`declineAll` **14.0% / 1.01×** ✗ — ~1 point below the 15% floor, and *below* the
`buildings019` reference (18.6%).

**Diagnosis.** `declineAll` sitting under the reference is a structural artifact, not
an economic trap: enabling the event scheduler makes `ensureSchedule`/`maybeFireEvent`
consume RNG draws that shift the weather/pest/market streams, so `events022 declineAll`
is a different random trajectory than `buildings019` — exactly the spec's "if
`declineAll` drifts, something structural moved" caveat. The Drought Warning's
fire-time pin (which fires regardless of choice) is the only non-choice downside.

**Rejected lever — pin chance.** Lowering the pin chance 0.7 → 0.5 did **not** lift
`declineAll` (still ~14%) but inflated `acceptAll` overshoot to **1.31×** (over the
ceiling), because less drought = higher peaks for the accepting policies. Reverted to
0.7.

**Promoted lever — contract B-side consolations.** Raised `millers_order` choiceB
+12 → **+20** and `fair_committee` choiceB +10 → **+18**. This is surgical: only
`declineAll` (and `heuristic` when it declines a contract) collects the B consolation,
while `acceptAll` — the variant nearest the 1.3× overshoot ceiling — never takes B and
is therefore unchanged. Choice A stays clearly better when deliverable (55 vs 20,
40 vs 18), so contract tension is preserved.

## Promoted numbers

| Knob | Value | Notes |
|------|-------|-------|
| `millers_order` choiceB `coins_delta` | **+20** | was +12 (raised to clear the `declineAll` floor) |
| `fair_committee` choiceB `coins_delta` | **+18** | was +10 |
| `millers_order` choiceA contract reward | 55 | unchanged |
| `fair_committee` choiceA contract reward | 40 | unchanged |
| Traveling Merchant `priceFactor` | 1.4 | unchanged |
| Bountiful Spring buff | 1.5× / 3 harvests / exhaustion 2 | unchanged |
| Wandering Beekeeper | −15 → 1.2× / 4 harvests | unchanged |
| Drought Warning pin chance | 0.7 | unchanged (0.5 rejected — inflated acceptAll overshoot) |
| `FARM_EVENT_SECOND_CHANCE` | 0.5 | unchanged |

Only the two contract B-side consolations moved from the plan's starting proposal;
everything else shipped at its authored value.
