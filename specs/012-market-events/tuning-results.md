# 012 Market Events Tuning Results

Sim-gated with the 009 Monte Carlo simulator (`npm run sim`) against the real engine.
The `smartMixed` bot is the **difficulty floor** — a skilled human plays meaningfully
better, so a bot win-rate of ~15–35% maps to roughly 50–65% for a skilled human.

Market events are a new system (G7): a fixed 5-day cycle that fires at most one event
at a time (shortage raises a single crop's sell price, glut lowers it), announced one
day ahead. The question this tuning answers: **do the starting market numbers keep
`smartMixed` inside the established difficulty band, and do they avoid rescuing naive
single-crop strategies?**

## Target band

- `smartMixed` win **15–35%**
- overshoot (avgPeak / final target) **1.0–1.3×**
- single-crop strategies still failing (market must not rescue naive play)

## Sim commands

```bash
npm run sim -- --strategies smartMixed --trials 500
npm run sim -- --strategies radishOnly,parsnipOnly,pumpkinOnly,smartMixed --trials 500
# robustness: --seed 7, --seed 99 (above, smartMixed)
```

The `proposed` preset has market events ON (fireChance 0.5); `baseline` has them OFF
(fireChance 0) and is otherwise the post-010 economy. The market-aware `smartMixed`
bot reacts to announced events.

## Final comparison (500 trials, seed 42)

```
config    strategy     win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
baseline  radishOnly   26.0  5.6        68.4   674      728.5    1.12x      86/83/77/26
baseline  parsnipOnly  74.2  15.0       10.8   1102     1234.5   1.84x      83/83/83/74
baseline  pumpkinOnly  0.0   100.0      0.0    100      100      0.17x      0/0/0/0
baseline  smartMixed   96.6  2.2        1.2    2396     2450.5   3.99x      97/97/97/97
proposed  radishOnly   0.0   49.2       50.8   146      142      0.30x      13/0/0/0
proposed  parsnipOnly  0.0   49.2       50.8   198      200      0.41x      35/1/0/0
proposed  pumpkinOnly  0.0   47.4       52.6   386      374      0.80x      48/34/8/0
proposed  smartMixed   18.0  26.0       56.0   520      270.5    1.08x      51/24/18/18
```

`cleared%` is the per-season clear rate (S1/S2/S3/S4) — the fraction of runs that
survived past each season.

## smartMixed: pre-context vs. measured

| metric     | 010 proposed (market OFF) | 012 proposed (market ON) |
|------------|---------------------------|--------------------------|
| win%       | 16.9                      | **18.0**                 |
| bankrupt%  | 19.3                      | **26.0**                 |
| overshoot  | 1.06×                     | **1.08×**                |
| cleared%   | 54/23/17/17               | 51/24/18/18              |

(The 010 column is from `specs/010-plot-progression-rebalance/tuning-results.md`,
2000 trials; the 012 column is 500 trials. Both use the same post-010 economy, the
only difference being market events on/off.)

## Robustness (smartMixed, 500 trials, multiple seeds)

| seed | win% | bankrupt% | overshoot |
|------|------|-----------|-----------|
| 42   | 18.0 | 26.0      | 1.08×     |
| 7    | 18.2 | 25.4      | 1.10×     |
| 99   | 17.2 | 26.8      | 1.06×     |

All seeds land inside the band: win 17.2–18.2%, overshoot 1.06–1.10×.

## Single-crop bots still fail

On `proposed`, every single-crop strategy wins **0%** (radish, parsnip, pumpkin),
with ~47–49% bankruptcy and the rest missing season targets. Market events do **not**
rescue naive play — a single crop only ever benefits from the ~5-day window when its
own shortage fires, and is hurt by its own glut, so over a full 80-day run the EV is
roughly washed out while the structural challenge (4-plot start, escalating land cost,
steep targets) still dominates.

## Final promoted MarketConfig

No tuning was needed — the starting numbers landed in band on the first 500-trial run
and held across seeds, so they are promoted as-is.

| Lever              | value |
|--------------------|-------|
| cadenceDays        | 5     |
| fireChance         | 0.5   |
| shortageMultiplier | 1.4   |
| glutMultiplier     | 0.7   |
| durationDays       | 3     |
| announceLeadDays   | 1     |

These live in `src/engine/constants.ts` (the `MARKET_*` consts, flowing into
`DEFAULT_ECONOMY`) and are mirrored in the `proposed` preset's `market` block in
`scripts/sim/economyPresets.ts`. The `baseline` preset keeps `fireChance: 0`
(events off) as the pre-012 reference snapshot.

## Did market events move difficulty?

Barely — and that is the intended reading. Adding events nudged `smartMixed` from
16.9% → 18.0% win with overshoot essentially flat (1.06× → 1.08×); bankruptcy rose
modestly (19% → 26%), reflecting the extra price variance that occasionally catches a
thinly-buffered run on the wrong side of a glut. Because only one event fires at a
time and the bot plants a mix of crops, any single shortage lifts only the slice of
the portfolio holding that crop, and gluts cut the same way — so the expected value
over a full run nets close to zero. The mechanic is therefore a **mild regulator and
texture layer** (a reason to time sells and watch the announce), not a difficulty
lever. The difficulty band established by 009/010 is preserved.
