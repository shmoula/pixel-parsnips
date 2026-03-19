# Quickstart: Testing Disaster Events — 003-crop-disasters

**Date**: 2026-03-19

All three disaster events can be triggered deterministically in tests via the `processTurn` injection parameters. This guide shows how to force each event.

---

## Running tests

```bash
npm test          # run all tests (Vitest)
npm run lint      # TypeScript + ESLint checks
```

---

## Forcing a Blight (in tests)

```ts
import { processTurn, plantSeed, initialGameState } from '../../src/engine/gameEngine';
import { withSeeds } from '../helpers'; // test helper

const state = withSeeds(initialGameState(), { radish: 1 });
const planted = plantSeed(state, 0, 'radish');
// Force Blight on the harvest turn
const { log } = processTurn(planted.state, 'blight');
// log.weatherId === 'blight'
// log.harvests[0].adjustedYield === Math.floor(12 * 0.1) === 1
```

---

## Forcing a Pest Infestation (deterministic destruction)

```ts
const state = withSeeds(initialGameState(), { radish: 3 });
const s1 = plantSeed(state, 0, 'radish').state;
const s2 = plantSeed(s1, 1, 'radish').state;
const s3 = plantSeed(s2, 2, 'radish').state;

// Force Pest Infestation; only plots 0 and 2 are destroyed
const { log, state: after } = processTurn(s3, 'pest_infestation', [0, 2]);
// log.pestDestroyedPlots === [0, 2]
// after.plots[0].pestDamaged === true   (awaiting acknowledgment)
// after.plots[1].cropId === 'radish'    (untouched)
// after.plots[2].pestDamaged === true
```

To verify the random 50%-per-plot behaviour without an override:

```ts
const spy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.07); // selects pest_infestation
// ...then mock individual plot rolls
```

---

## Forcing a Flash Drought (and observing growth penalty)

```ts
let state = withSeeds(initialGameState(), { radish: 2 });

// Day 1: Force Flash Drought event
const { state: afterDrought } = processTurn(state, 'flash_drought');
// afterDrought.flashDroughtDaysRemaining === 2

// Day 2 (within drought window): plant a radish — growth is doubled
state = withSeeds(afterDrought, { radish: 1 });
const planted = plantSeed(state, 0, 'radish');
// planted.state.plots[0].daysRemaining === 2  (radish base=1, doubled)
// planted.state.plots[0].droughtPenalised === true

// Day 3: counter decrements after processTurn
const { state: day3 } = processTurn(planted.state, 'sunny');
// day3.flashDroughtDaysRemaining === 1

// Day 4: still in drought window
const planted2 = plantSeed(withSeeds(day3, { radish: 1 }), 1, 'radish');
// planted2.state.plots[1].daysRemaining === 2  (still penalised)

// Day 5: drought expires
const { state: day5 } = processTurn(planted2.state, 'sunny');
// day5.flashDroughtDaysRemaining === 0

// Day 6: plant outside window — normal growth
const planted3 = plantSeed(withSeeds(day5, { radish: 1 }), 2, 'radish');
// planted3.state.plots[2].daysRemaining === 1  (normal)
// planted3.state.plots[2].droughtPenalised === false
```

---

## Forcing a Pest Damage acknowledgment flow (in tests)

```ts
import { clearPestDamage } from '../../src/engine/gameEngine';

// 1. Create a pest-damaged plot (inject destruction)
const { state: afterPest } = processTurn(someState, 'pest_infestation', [0]);
// afterPest.plots[0].pestDamaged === true

// 2. Attempt to plant on it — blocked
const blocked = plantSeed(withSeeds(afterPest, { radish: 1 }), 0, 'radish');
// blocked.ok === false, blocked.error === 'plot_pest_damaged'

// 3. Clear the damage
const cleared = clearPestDamage(afterPest, 0);
// cleared.ok === true
// cleared.state.plots[0].pestDamaged === false

// 4. Now planting succeeds
const planted = plantSeed(withSeeds(cleared.state, { radish: 1 }), 0, 'radish');
// planted.ok === true
```

---

## Verifying save/load persistence

```ts
import { JSON } from '...';

// Simulate a save/load round-trip
const roundTripped: GameState = JSON.parse(JSON.stringify(state));
expect(roundTripped.flashDroughtDaysRemaining).toBe(state.flashDroughtDaysRemaining);
expect(roundTripped.plots[0].pestDamaged).toBe(state.plots[0].pestDamaged);
expect(roundTripped.plots[0].droughtPenalised).toBe(state.plots[0].droughtPenalised);
```
