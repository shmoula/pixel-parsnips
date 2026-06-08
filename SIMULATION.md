# Balance Simulator

A reproducible Monte Carlo simulator that measures game difficulty by playing
many randomized games against the **real** engine under a swappable
`EconomyConfig`. Use it to answer questions like _"how often does a sensible
player win?"_ or _"what does halving the tax rate do to the win rate?"_ without
touching the live game.

## Quick start

```bash
npm run sim
```

This runs the default sweep (every preset × every strategy, 2000 trials, seed 42)
and prints a table:

```
Monte Carlo — 2000 trials/seed=42

config    strategy     win%  bankrupt%  miss%  avgPeak  medPeak  overshoot
--------  -----------  ----  ---------  -----  -------  -------  ---------
baseline  radishOnly   ...
baseline  parsnipOnly  ...
baseline  pumpkinOnly  0.0   100.0      0.0    100      100      0.17x
baseline  smartMixed   97.6  2.2        0.2    2420     2447     4.03x
```

## CLI flags

Pass flags after `--` so npm forwards them to the script:

```bash
npm run sim -- --strategies smartMixed,parsnipOnly --trials 500 --seed 7
```

| Flag           | Default            | Meaning                                                        |
| -------------- | ------------------ | -------------------------------------------------------------- |
| `--configs`    | all presets        | Comma-separated economy presets to run (see **Presets**).      |
| `--strategies` | all strategies     | Comma-separated strategy bots to run (see **Strategies**).     |
| `--trials`     | `2000`             | Number of randomized games per (config × strategy) cell.       |
| `--seed`       | `42`               | Master seed. Trial _i_ uses `seed + i`, so runs are reproducible. |

Unknown config or strategy names exit with an error.

## Reading the output

Each row aggregates `--trials` games for one economy × strategy pair.

| Column      | Meaning                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| `win%`      | % of runs that cleared Season 4 (the finite arc, days 1–80).                                |
| `bankrupt%` | % of runs that went bankrupt (balance fell below the daily land lease).                     |
| `miss%`     | % of runs that survived but missed a season target (`targetMissed`).                        |
| `avgPeak`   | Mean peak coin balance reached, rounded.                                                     |
| `medPeak`   | Median peak coin balance.                                                                    |
| `overshoot` | `avgPeak ÷ final-season target`. ~1x means "just barely won"; 4x means "trivially easy".     |

Rules of thumb for a healthy difficulty curve: a competent strategy (`smartMixed`)
should win _most_ but not _all_ runs, and overshoot should be modest (closer to
1–2x than 4x). The committed baseline is intentionally easy — that is the thing
009 exists to measure and 010 will rebalance.

## Strategies

The four bots live in [`scripts/sim/strategies.ts`](scripts/sim/strategies.ts).
A strategy is a pure function `(state, config) => state` that makes all
buy/plant/upgrade decisions for one day; the runner then advances the day.

| Strategy      | Behavior                                                                            |
| ------------- | ----------------------------------------------------------------------------------- |
| `radishOnly`  | Fills every plantable plot with radishes (fast, cheap, low yield).                  |
| `parsnipOnly` | Parsnips only (medium cost/yield).                                                  |
| `pumpkinOnly` | Pumpkins only (expensive, slow — a cash-flow death trap that bankrupts ~always).    |
| `smartMixed`  | Picks pumpkin when flush (>250c), parsnip when comfortable (>60c), else radish.     |

All bots first buy tool upgrades while keeping an 80-coin working buffer, then
fill the board while reserving enough coins to cover the day's land lease.

## Presets

Economy presets live in [`scripts/sim/economyPresets.ts`](scripts/sim/economyPresets.ts).
Today there is one:

- **`baseline`** — the current live economy (`DEFAULT_ECONOMY`). This is the
  reference point every rebalance is measured against.

### Adding a preset

A preset is just an `EconomyConfig`. Spread `DEFAULT_ECONOMY` and override the
fields you want to test, then register it in `PRESETS`:

```ts
// scripts/sim/economyPresets.ts
import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';

export const baseline: EconomyConfig = DEFAULT_ECONOMY;

/** Example: harsher taxes + pricier land. */
export const harsh: EconomyConfig = {
  ...DEFAULT_ECONOMY,
  taxRate: 0.10,
  seasons: DEFAULT_ECONOMY.seasons.map(s => ({ ...s, leasePerDay: s.leasePerDay + 5 })),
};

export const PRESETS: Record<string, EconomyConfig> = {
  baseline,
  harsh,
};
```

Then compare them: `npm run sim -- --configs baseline,harsh`.

Every tunable number — starting balance, tax, crop costs/yields, upgrade tiers,
season targets/leases, the endless-mode formula, exhaustion, fertilizer, streak
bonuses — is a field on `EconomyConfig`
([`src/engine/economy.ts`](src/engine/economy.ts)).

## How it works

The simulator runs the **actual game engine**, not a reimplementation, so its
measurements stay honest as the engine evolves.

```
run.ts ──parse flags──► monteCarlo (runner.ts)
                              │  for each trial: playRun(config, strategy, seed+i)
                              ▼
                     ┌─ initialGameState(config)
                     │  loop days 1..80:
                     │    clear pest damage → strategy(state) → processTurn(state, …, config, rng)
                     └─ classify outcome: won | bankrupt | targetMissed
                              │
                              ▼
                     aggregate (metrics.ts) ──► formatTable (report.ts) ──► stdout
```

Reproducibility comes from a seedable PRNG
([`scripts/sim/rng.ts`](scripts/sim/rng.ts), mulberry32). Each run builds a fresh
`makeRng(seed)` threaded into `processTurn`, so the same seed always yields the
same game. Nothing is shared across trials.

The engine accepts the config/rng through optional **trailing** parameters that
default to `DEFAULT_ECONOMY` and `Math.random`, so the production game and UI are
completely unaffected — they simply never pass the extra arguments.

## Source layout

| File                                | Responsibility                                  |
| ----------------------------------- | ----------------------------------------------- |
| `scripts/sim/rng.ts`                | Seedable PRNG (mulberry32).                     |
| `scripts/sim/economyPresets.ts`     | Named `EconomyConfig` presets.                  |
| `scripts/sim/strategies.ts`         | Strategy bots.                                  |
| `scripts/sim/runner.ts`             | `playRun` + `monteCarlo` against the engine.    |
| `scripts/sim/metrics.ts`            | Aggregates outcomes into summary metrics.       |
| `scripts/sim/report.ts`             | stdout table formatting.                        |
| `scripts/sim/run.ts`                | CLI entry + argv parsing.                       |
| `src/engine/economy.ts`             | `EconomyConfig` type + `DEFAULT_ECONOMY`.       |

## Tests

The simulator is covered by `tests/sim/`. Of note,
`tests/sim/runner.test.ts` includes a **characterization** test that locks in the
known baseline difficulty (smartMixed wins >90%, pumpkinOnly bankrupts >95%) — so
any future engine change that silently alters difficulty fails CI.

```bash
npm test            # full suite (engine + sim + UI)
npx vitest run tests/sim   # simulator tests only
```
