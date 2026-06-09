import { describe, it, expect } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import { STRATEGIES } from '../../scripts/sim/strategies';
import { proposed } from '../../scripts/sim/economyPresets';

describe('strategies', () => {
  it('exposes the four named bots', () => {
    expect(Object.keys(STRATEGIES).sort())
      .toEqual(['parsnipOnly', 'pumpkinOnly', 'radishOnly', 'smartMixed']);
  });

  it('radishOnly plants radishes and spends coins', () => {
    const s = initialGameState();
    const after = STRATEGIES.radishOnly(s, DEFAULT_ECONOMY);
    expect(after.coinBalance).toBeLessThan(s.coinBalance);
    expect(after.plots.some(p => p.cropId === 'radish')).toBe(true);
  });

  it('never plants more than the affordable / available plots', () => {
    const s = initialGameState();
    const after = STRATEGIES.radishOnly(s, DEFAULT_ECONOMY);
    expect(after.coinBalance).toBeGreaterThanOrEqual(0);
  });
});

describe('smartMixed plot buying', () => {
  it('buys a plot when flush with cash and the board is full', () => {
    let s = { ...initialGameState(proposed), coinBalance: 2000 };
    s = STRATEGIES.smartMixed(s, proposed);
    expect(s.unlockedPlots).toBeGreaterThan(4); // expanded beyond the starting 4
  });

  it('does not buy plots in the baseline (no plots to buy)', () => {
    const s = STRATEGIES.smartMixed(initialGameState(), DEFAULT_ECONOMY);
    expect(s.unlockedPlots).toBe(DEFAULT_ECONOMY.maxPlots);
  });

  it('does not waste seeds buying for locked plots', () => {
    // With modest cash the bot should fill only unlocked plots, never spend on locked ones.
    let s = { ...initialGameState(proposed), coinBalance: 100 };
    s = STRATEGIES.smartMixed(s, proposed);
    // Every plot that has a crop must be within the unlocked range.
    const plantedBeyondUnlocked = s.plots.slice(s.unlockedPlots).some(p => p.cropId !== null);
    expect(plantedBeyondUnlocked).toBe(false);
    expect(s.coinBalance).toBeGreaterThanOrEqual(0);
  });
});
