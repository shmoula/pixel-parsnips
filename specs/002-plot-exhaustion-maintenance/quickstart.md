# Quickstart: Plot Exhaustion Maintenance

**Feature**: 002-plot-exhaustion-maintenance
**Date**: 2026-03-17

This guide covers the changes developers and testers need to know to work with the
plot exhaustion feature. For the full game setup, see
`specs/001-farming-tycoon-game/quickstart.md`.

---

## What Changed

| Area | Change |
|------|--------|
| `PlotState` | + `consecutiveHarvests: number`, `exhaustedSinceDay: number \| null` |
| `GameState` | + `fertilizerInventory: number` |
| `DailyLogEntry` | + `exhaustedPlots: number[]` |
| `constants.ts` | `SCHEMA_VERSION = 2`; + `EXHAUSTION_THRESHOLD`, `EXHAUSTION_RECOVERY_DAYS`, `FERTILIZER_COST` |
| `gameEngine.ts` | Extended `processTurn`, extended `plantSeed`; + `buyFertilizer`, `applyFertilizer` |
| `useGameEngine.ts` | + `buyFertilizer`, `applyFertilizer`, `getFertilizerCount` |
| `PlotCard.tsx` | Exhausted state UI + "Use Fertilizer" action |
| `Shop.tsx` | Fertilizer shop item |
| localStorage | Schema v1 saves are discarded on load |

---

## Triggering Exhaustion in Development

To quickly reach an Exhausted plot state without playing through the game:

1. Open the browser console on the game page.
2. Manually set `consecutiveHarvests` to 2 on any plot in localStorage, then
   plant a fast-growing crop (Radish, 1 day) and advance one day.
3. The plot will exhaust on that harvest.

Alternatively, write a test using the `processTurn` pure function with a seeded
`weatherRoll` to control harvest yield deterministically.

---

## Testing Exhaustion (Unit)

```typescript
import { initialGameState, plantSeed, processTurn, applyFertilizer, buyFertilizer }
  from '../src/engine/gameEngine';

// Helper: exhaust a plot
function exhaustPlot(plotId: number) {
  let state = initialGameState();
  // Give player seeds
  state = { ...state, seedInventory: { ...state.seedInventory, radish: 10 } };

  for (let i = 0; i < 3; i++) {
    const plantResult = plantSeed(state, plotId, 'radish');
    expect(plantResult.ok).toBe(true);
    state = (plantResult as { ok: true; state: typeof state }).state;
    const turnResult = processTurn(state, 'sunny');
    state = turnResult.state;
  }
  return state;
}

it('plot is exhausted after 3 consecutive harvests', () => {
  const state = exhaustPlot(0);
  expect(state.plots[0].exhaustedSinceDay).not.toBeNull();
});

it('planting on exhausted plot returns plot_exhausted error', () => {
  let state = exhaustPlot(0);
  state = { ...state, seedInventory: { ...state.seedInventory, radish: 1 } };
  const result = plantSeed(state, 0, 'radish');
  expect(result.ok).toBe(false);
  expect((result as { ok: false; error: string }).error).toBe('plot_exhausted');
});

it('fertilizer restores exhausted plot immediately', () => {
  let state = exhaustPlot(0);
  const buyResult = buyFertilizer(
    { ...state, coinBalance: 100 }, 1
  );
  expect(buyResult.ok).toBe(true);
  state = (buyResult as { ok: true; state: typeof state }).state;
  const applyResult = applyFertilizer(state, 0);
  expect(applyResult.ok).toBe(true);
  const afterState = (applyResult as { ok: true; state: typeof state }).state;
  expect(afterState.plots[0].exhaustedSinceDay).toBeNull();
  expect(afterState.fertilizerInventory).toBe(0);
});
```

---

## Key Constants

```typescript
EXHAUSTION_THRESHOLD = 3        // harvests before exhaustion
EXHAUSTION_RECOVERY_DAYS = 3    // in-game days for natural recovery
FERTILIZER_COST = 30            // coins per unit
SCHEMA_VERSION = 2              // bumped from 1; old saves are discarded
```

---

## UI Checklist (PlotCard)

When a plot has `exhaustedSinceDay !== null`:

- [ ] Display "Exhausted" label (visually distinct from empty and growing states)
- [ ] Display "N days remaining" where N = `EXHAUSTION_RECOVERY_DAYS - (currentDay - exhaustedSinceDay)`
- [ ] Show "Use Fertilizer" button if `fertilizerInventory > 0`; hide if 0
- [ ] Show "Buy Fertilizer in shop" hint if `fertilizerInventory === 0`
- [ ] Block all normal plot interactions (no plant button visible)
- [ ] Counter (`consecutiveHarvests`) is NOT rendered anywhere

## UI Checklist (Shop)

- [ ] Fertilizer item shows cost (30 coins) and current inventory count
- [ ] Buy button disabled if `coinBalance < FERTILIZER_COST`
- [ ] Quantity selector or single-unit purchase (consistent with seed buying UX)
