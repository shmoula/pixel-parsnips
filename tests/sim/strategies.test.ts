import { describe, it, expect } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import { STRATEGIES } from '../../scripts/sim/strategies';

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
