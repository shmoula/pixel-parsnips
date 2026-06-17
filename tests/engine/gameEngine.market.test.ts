import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import { coins } from '../../src/engine/constants';
import type { GameState } from '../../src/engine/types';

/** rng that never fires market scheduling (>= fireChance) and never destroys pests. */
const NO_FIRE = () => 1;

/**
 * Helper: a state with one pumpkin planted on plot 0, ready to harvest this turn.
 * Step 1 of processTurn decrements daysRemaining before the Step 3 harvest, so we
 * start at 1 (→ 0 at harvest time) for a plot that harvests on the current turn.
 */
function pumpkinReady(overrides: Partial<GameState> = {}): GameState {
  const base = initialGameState();
  const plots = base.plots.map(p =>
    p.id === 0
      ? { ...p, cropId: 'pumpkin' as const, dayPlanted: 1, daysRemaining: 1 }
      : p,
  );
  return { ...base, plots, ...overrides };
}

describe('processTurn — market scheduling', () => {
  it('schedules a pending event on a boundary day and announces it', () => {
    const rng = (() => { const v = [0.1, 0.0, 0.4]; let i = 0; return () => v[Math.min(i++, v.length - 1)]; })();
    const state = { ...initialGameState(), currentDay: 5 };
    const { state: next, log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng);
    expect(next.market.pending).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4 });
    expect(next.market.active).toBeNull();
    expect(log.marketAnnounced).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4 });
    expect(log.marketActive).toBeNull();
  });

  it('does not schedule off a boundary day', () => {
    const state = { ...initialGameState(), currentDay: 6 };
    const { state: next } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.1);
    expect(next.market.pending).toBeNull();
  });
});

describe('processTurn — market activation, yield, expiry', () => {
  it('activates a pending event and applies the multiplier to the matching crop', () => {
    const state = pumpkinReady({
      currentDay: 6,
      market: { active: null, pending: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4 } },
    });
    const { state: next, log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    const expected = coins(DEFAULT_ECONOMY.crops.pumpkin.baseYield * 1.0 * 1.4);
    expect(log.harvests[0].adjustedYield).toBe(expected);
    expect(log.marketActive).toEqual({ cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 3 });
    expect(next.market.active?.daysRemaining).toBe(2);
  });

  it('does not affect a non-matching crop', () => {
    const state = pumpkinReady({
      currentDay: 6,
      market: { active: null, pending: { cropId: 'radish', kind: 'glut', multiplier: 0.7 } },
    });
    const { log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    const expected = coins(DEFAULT_ECONOMY.crops.pumpkin.baseYield * 1.0 * 1.0);
    expect(log.harvests[0].adjustedYield).toBe(expected);
  });

  it('stacks multiplicatively with weather', () => {
    const state = pumpkinReady({
      currentDay: 6,
      market: { active: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }, pending: null },
    });
    const { log } = processTurn(state, 'warm_breeze', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    const expected = coins(DEFAULT_ECONOMY.crops.pumpkin.baseYield * 1.2 * 1.4);
    expect(log.harvests[0].adjustedYield).toBe(expected);
  });

  it('expires an active event after its last day', () => {
    const state = pumpkinReady({
      currentDay: 7,
      market: { active: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 1 }, pending: null },
    });
    const { state: next, log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    expect(log.marketActive?.daysRemaining).toBe(1);
    expect(next.market.active).toBeNull();
  });

  it('preserves a carried-over active event in the log when nothing is pending', () => {
    const state = pumpkinReady({
      currentDay: 7,
      market: { active: { cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 3 }, pending: null },
    });
    const { log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    expect(log.marketActive?.cropId).toBe('pumpkin');
  });
});

describe('processTurn — market on bankruptcy', () => {
  it('records the active event and does not schedule when the run ends', () => {
    const state: GameState = {
      ...initialGameState(),
      currentDay: 5,
      coinBalance: 0,
      market: { active: { cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 2 }, pending: null },
    };
    const { state: next, log, isBankrupt } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.1);
    expect(isBankrupt).toBe(true);
    expect(log.marketActive?.cropId).toBe('pumpkin');
    expect(log.marketAnnounced).toBeNull();
    expect(next.market.pending).toBeNull();
  });
});
