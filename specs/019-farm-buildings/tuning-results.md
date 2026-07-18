# 019 Buildings Economy Tuning Results

Tuned with the Monte Carlo simulator (`npm run sim`) against the real engine, per
Task 12. The `smartMixed` bot is the **difficulty floor** — a skilled human plays
meaningfully better, so a bot win-rate of ~15–35% maps to roughly 50–65% for a
skilled human.

## Target band

- `smartMixed` win **15–35%** on `buildings019`
- overshoot (avgPeak / final target) **1.0–1.3×**
- single-crop strategies mostly failing (near 0% win)
- `buildings019` win sits above the no-buildings `proposed` control (buildings add
  player power)

## Step 1 — Freeze the historical presets

Before this task, `baseline` and `proposed` both spread `DEFAULT_ECONOMY` and so
silently inherited the full 5-building catalog — the sim's bots could buy
buildings under presets meant to represent the pre-buildings (010-era) economy.
`economyPresets.ts` now pins `baseline.buildings = { ...DEFAULT_ECONOMY.buildings,
definitions: [] }` (no buildings purchasable — `proposed` inherits the freeze by
spreading `baseline`), and adds:

```ts
export const buildings019: EconomyConfig = {
  ...proposed,
  buildings: DEFAULT_ECONOMY.buildings, // full catalog
};
```

This freeze is a real behavior change for `baseline`/`proposed` (they used to get
building bonuses for free), which is why the `tests/sim/runner.test.ts`
characterization test needed its threshold lowered — see **Test updates** below.

## Step 2 — Baseline the band (pre-tune, original constants.ts priors)

500 trials, seed 42, `BUILDING_DEFINITIONS` costs as they shipped from Task 1–11
(toolshed 150, compost_bin 150, irrigation_well 180, scarecrow 220, farm_stand 300):

```
config        strategy    win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
proposed      smartMixed  10.2  29.8       60.0   469      295.5    0.98x      53/27/17/10
buildings019  smartMixed  7.4   35.6       57.0   388      234.5    0.81x      47/12/7/7
```

```
config        strategy     win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
buildings019  radishOnly   0.0   50.8       49.2   156      155      0.32x      9/0/0/0
buildings019  parsnipOnly  0.0   62.0       38.0   201      198      0.42x      29/2/0/0
buildings019  pumpkinOnly  0.0   59.8       40.2   380      296      0.79x      48/38/5/0
```

`proposed` (no buildings) sits at ~9–10% win — already below the 15–35% band and
below the ~16–18% this preset showed back in 010 (the 003–018 features that
shipped since then — crop disasters, weather bands, pest/blight/flash-drought —
have organically raised difficulty on top of the 010 structure; that is out of
scope for this task, which only tunes building-related levers). More strikingly,
`buildings019` came in **below** `proposed` (7.4% vs 10.2%): `smartMixed` calls
`maybeBuyBuildings` before filling the board every day, and at the original
prices (150–300 coins against a 130-coin starting balance and an already-tight
plot-purchase ladder) the upfront building spend competed directly with early
expansion capital, net-hurting more than the mitigations helped.

Both single-crop bots and `smartMixed` on `buildings019` were out of band → tuning needed.

## Step 3 — Tune

Per the spec's lever order, **building costs** were tried first (before touching
`BUILDING_SEED_DISCOUNT`, mitigation magnitudes, or `BUILDING_PRIORITY`, none of
which were touched). Costs were cut roughly a third across the board so buying
the early buildings (toolshed especially, which pays for itself via the seed
discount) no longer crowds out land/seed spending during the lean 4-plot start:

| Building         | old cost | new cost |
|------------------|----------|----------|
| toolshed         | 150      | **100**  |
| compost_bin      | 150      | **100**  |
| irrigation_well  | 180      | **130**  |
| scarecrow        | 220      | **150**  |
| farm_stand       | 300      | **200**  |

One sweep at these new costs (500 trials, seed 42) was enough to land in band —
no further iteration was needed:

```
config        strategy    win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
proposed      smartMixed  10.2  29.8       60.0   469      295.5    0.98x      53/27/17/10
buildings019  smartMixed  19.4  39.0       41.6   573      242      1.19x      49/22/19/19
```

Sanity checks:

```
config        strategy     win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
buildings019  radishOnly   0.0   56.4       43.6   139      130      0.29x      16/0/0/0
buildings019  parsnipOnly  0.0   65.2       34.8   175      130      0.36x      35/4/0/0
buildings019  pumpkinOnly  0.0   100.0      0.0    130      130      0.27x      0/0/0/0
```

Single-crop bots all stay at 0% win, and overshoot (1.19×) is within the ≤1.3×
sanity ceiling. `buildings019` (19.4%) now clears `proposed` (10.2%) as expected —
buildings add player power.

### Robustness (smartMixed on `buildings019`, 2000 trials, multiple seeds)

| seed | proposed win% | buildings019 win% | buildings019 overshoot |
|------|----------------|--------------------|--------------------------|
| 1    | 9.0            | 16.6               | 1.09×                   |
| 7    | 9.0            | 16.7               | 1.10×                   |
| 42   | 8.9            | 17.0               | 1.11×                   |
| 99   | 8.8            | 17.1               | 1.11×                   |
| 2024 | 7.9            | 16.3               | 1.09×                   |

All seeds land inside the band: `buildings019` win 16.3–17.1%, overshoot
1.09–1.11×, and `buildings019` consistently beats the `proposed` control by
~7–9 points.

No further tuning (seed discount, mitigation magnitudes, or `BUILDING_PRIORITY`)
was needed — costs alone moved the candidate from out-of-band-and-below-control
to comfortably in-band and above-control.

## Step 4 — Promote + final gate (2000 trials, seed 42)

The tuned costs above are already the live values in
`src/engine/constants.ts` (`BUILDING_DEFINITIONS` = `DEFAULT_ECONOMY.buildings.definitions`),
so promotion is just leaving them in place; `buildings019` equals the live economy.

```bash
npm run sim -- --configs proposed,buildings019 --strategies smartMixed --trials 2000
```

```
config        strategy    win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
proposed      smartMixed  8.9   30.2       60.9   450      292      0.94x      54/24/14/9
buildings019  smartMixed  17.0  40.5       42.5   532      239      1.11x      48/19/17/17
```

```bash
npm run sim -- --configs buildings019 --strategies radishOnly,parsnipOnly,pumpkinOnly --trials 2000
```

```
config        strategy     win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
buildings019  radishOnly   0.0   54.8       45.2   142      130      0.30x      22/0/0/0
buildings019  parsnipOnly  0.0   65.3       34.6   175      130      0.37x      37/3/0/0
buildings019  pumpkinOnly  0.0   100.0      0.0    130      130      0.27x      0/0/0/0
```

`smartMixed` on `buildings019` is **in band**: 17.0% win, 1.11× overshoot.

## Final promoted numbers

| Lever                              | prior (Tasks 1–11) | promoted (Task 12) |
|-------------------------------------|---------------------|----------------------|
| toolshed cost                      | 150                 | **100**             |
| compost_bin cost                   | 150                 | **100**             |
| irrigation_well cost                | 180                 | **130**             |
| scarecrow cost                     | 220                 | **150**             |
| farm_stand cost                    | 300                 | **200**             |
| `BUILDING_SEED_DISCOUNT`           | 0.4                 | unchanged           |
| `BUILDING_EXHAUSTION_RECOVERY_DAYS` | 2                   | unchanged           |
| `BUILDING_DROUGHT_WINDOW_DAYS`      | 1                   | unchanged           |
| `BUILDING_PEST_DESTRUCTION_CHANCE`  | 0.25                | unchanged           |
| `BUILDING_YIELD_MULTIPLIER`         | 1.1                 | unchanged           |
| `BUILDING_PRIORITY` (bot order)     | toolshed, compost_bin, irrigation_well, scarecrow, farm_stand | unchanged |

Crop yields and season targets were untouched, per the spec's off-limits list.

## Test updates required by the cost changes

- `tests/engine/gameEngine.buildings.test.ts` — toolshed purchase deduction
  `1000 - 150` → `1000 - 100`.
- `tests/components/BuildingCard.test.tsx` — "Buy Scarecrow for 220 coins" →
  "…for 150 coins".
- `tests/analytics/useAnalyticsEvents.test.tsx` — scarecrow purchase event
  `cost: 220` → `cost: 150`.
- `tests/sim/strategies.test.ts` — `maybeBuyBuildings` priority-order buffer
  arithmetic recomputed for the new costs (rich balance dropped from 400 to 300
  so the well still stops the sequence, matching the original test's intent of
  demonstrating a partial buy).
- `tests/sim/runner.test.ts` — the `baseline` "trivially easy" characterization
  test's `winPct` threshold lowered from `> 90` to `> 80` (observed ~86%,
  overshoot ~3.2×) because freezing `baseline` to `definitions: []` in Step 1
  removed building bonuses it was previously (accidentally) getting for free;
  still comfortably "trivially easy," just no longer near-98%.

## Rationale

The original building costs (150/150/180/220/300) were steep relative to the
010-era 4-plot, 130-starting-balance economy that `proposed`/`buildings019`
inherit. Because `smartMixed` spends on buildings *before* filling the board
each day, those costs directly competed with the plot-purchase ladder and seed
capital that the 010 tuning campaign already relied on for its difficulty curve.
The result was perverse: enabling buildings made `smartMixed` do *worse*
(7.4% win) than the no-buildings control (10.2%), because the early cash outlay
outweighed the long-run mitigation value before a run could even reach the
seasons where scarecrow/farm_stand/well matter.

Cutting costs by roughly a third (concentrated on the cheap, high-leverage
toolshed and compost_bin) let the bot afford its first building earlier without
starving the expansion loop, and let the seed discount start compounding sooner.
One sweep was enough to swing `buildings019` from 7.4%/0.81× to 19.4%/1.19×
(500-trial iteration) and settle at 17.0%/1.11× at the 2000-trial gate — comfortably
inside the 15–35% / 1.0–1.3× band and consistently above the `proposed` control,
which is the qualitative shape the spec asked for (buildings add power, but the
run stays winnable-not-trivial). No changes to `BUILDING_SEED_DISCOUNT`, the
mitigation magnitudes, or `BUILDING_PRIORITY` were needed.
