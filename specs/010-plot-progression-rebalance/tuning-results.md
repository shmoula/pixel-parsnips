# 010 Economy Tuning Results

Tuned with the 009 Monte Carlo simulator (`npm run sim`) against the real engine.
The `smartMixed` bot is the **difficulty floor** — a skilled human plays meaningfully
better, so a bot win-rate of ~15–35% maps to roughly 50–65% for a skilled human.

## Target band

- `smartMixed` win **15–35%**
- overshoot (avgPeak / final target) **1.0–1.3×**
- single-crop strategies mostly failing
- season-1 bankruptcy not spiking

## Final comparison (2000 trials, seed 42)

```
config    strategy     win%  bankrupt%  miss%  avgPeak  medPeak  overshoot  cleared%
baseline  smartMixed   97.5  1.7        0.8    2421     2459.5   4.03x      98/98/98/98
baseline  parsnipOnly  74.2  16.0       9.8    1094     1250.5   1.82x      82/82/81/74
baseline  pumpkinOnly  0.0   100.0      0.0    100      100      0.17x      0/0/0/0
baseline  radishOnly   24.6  4.8        70.7   681      732      1.14x      84/83/77/25
proposed  smartMixed   16.9  19.3       63.9   511      263      1.06x      54/23/17/17
proposed  parsnipOnly  0.0   47.2       52.8   197      203      0.41x      37/1/0/0
proposed  pumpkinOnly  0.0   44.8       55.3   392      380      0.82x      48/32/6/0
proposed  radishOnly   0.0   48.0       52.0   147      142      0.31x      15/0/0/0
```

`cleared%` is the per-season clear rate (S1/S2/S3/S4) — the fraction of runs that
survived past each season.

## Robustness (smartMixed, 2000 trials, multiple seeds)

| seed | win% | bankrupt% | overshoot |
|------|------|-----------|-----------|
| 1    | 16.9 | 19.4      | 1.06×     |
| 7    | 16.9 | 19.4      | 1.06×     |
| 42   | 16.9 | 19.3      | 1.06×     |
| 99   | 17.1 | 19.1      | 1.07×     |
| 2024 | 15.4 | 18.9      | 1.01×     |

All seeds land inside the band: win 15.4–17.1%, overshoot 1.01–1.07×, bankruptcy ~19%.

## Final `proposed` numbers

| Lever            | baseline (old)            | proposed (new)                          |
|------------------|---------------------------|-----------------------------------------|
| startingBalance  | 100                       | **130**                                 |
| startingPlots    | 12                        | **4**                                   |
| maxPlots         | 12                        | 12                                      |
| plotPrices       | — (none)                  | **[30, 55, 85, 120, 160, 210, 280, 360]** |
| taxRate          | 0.05                      | **0.06**                                |
| crops            | radish 5/12, parsnip 10/28, pumpkin 20/65 | unchanged (5/12, 10/28, 20/65) |
| S1 lease/target  | 15 / 150                  | **15 / 105**                            |
| S2 lease/target  | 20 / 250                  | **22 / 230**                            |
| S3 lease/target  | 25 / 400                  | **30 / 390**                            |
| S4 lease/target  | 30 / 600                  | **40 / 480**                            |
| disaster %       | 0.15/0.20/0.28/0.35       | unchanged                               |

## Rationale

The first `proposed` draft compressed crop margins **and** raised lease **and** raised
targets **and** cut to 4 plots all at once — the run became unwinnable (smartMixed 0%
win, 76% bankrupt). Tuning one lever at a time revealed:

1. **Crop margins back to baseline.** Restoring yields cut bankruptcy from 76% → 44%,
   but win stayed at 0% — the targets were still unreachable. Lesson: with a 4-plot
   start, the new plot-purchase sink, and higher lease, baseline crop margins already
   produce the desired difficulty. Compressing them on top made the early game a
   guaranteed loss, so the final design keeps crops at baseline and gets its challenge
   from **structure** (few starting plots + escalating land cost + steeper targets).

2. **Targets are the dominant difficulty lever here.** The original 180/400/700/1100
   curve assumed a fully-expanded farm the player can't yet afford. Pulling the curve
   down to 105/230/390/480 (each adjusted as a single step and re-measured) walked the
   win-rate 0% → 6.7% → 12.8% → 16.4% → 16.9%.

3. **startingBalance 100 → 130** addressed catastrophic season-1 bankruptcy and funds
   the first one or two plot purchases, enabling the expansion the design is built
   around (bankruptcy 24% → 18%).

4. **Lease raised modestly** (15/22/30/40) so passive play still bleeds out, but not so
   steep that expansion is impossible.

The result: the game is decided primarily in seasons 1–2 (survive + start expanding);
survivors who keep mixing crops and buying land convert to wins. Single-crop play fails
across the board — radish margins can't beat lease, pumpkin's upfront cost + 3-day delay
bankrupts a 4-plot start, and parsnip alone can't scale to the late targets.

Note: the frozen `baseline` preset now pins `startingBalance: 100` explicitly so it
stays a true pre-010 snapshot after Task 9 promotes `proposed` into `DEFAULT_ECONOMY`.
