import { describe, it, expect } from 'vitest';
import { EVENT_POLICIES } from '../../scripts/sim/strategies';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventId, GameState } from '../../src/engine/types';

function pendingState(eventId: FarmEventId, mutate: (s: GameState) => GameState = s => s): GameState {
  const s = initialGameState();
  return mutate({ ...s, currentDay: 8, farmEvents: { ...s.farmEvents, pending: { eventId, firedDay: 8 } } });
}

describe('event policies', () => {
  it('acceptAll / declineAll are constant', () => {
    expect(EVENT_POLICIES.acceptAll(pendingState('millers_order'), DEFAULT_ECONOMY)).toBe('A');
    expect(EVENT_POLICIES.declineAll(pendingState('millers_order'), DEFAULT_ECONOMY)).toBe('B');
  });

  it('heuristic accepts the merchant only when ≥ half the occupied plots ripen within 2 days', () => {
    const ripe = pendingState('traveling_merchant', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < 2 ? { ...p, cropId: 'radish' as const, daysRemaining: 1, dayPlanted: 7 } : p)),
    }));
    expect(EVENT_POLICIES.heuristic(ripe, DEFAULT_ECONOMY)).toBe('A');
    const green = pendingState('traveling_merchant', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < 2 ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 3, dayPlanted: 8 } : p)),
    }));
    expect(EVENT_POLICIES.heuristic(green, DEFAULT_ECONOMY)).toBe('B');
    expect(EVENT_POLICIES.heuristic(pendingState('traveling_merchant'), DEFAULT_ECONOMY)).toBe('B'); // empty board
  });

  it('heuristic accepts a contract only when free plots and growth time allow delivery', () => {
    expect(EVENT_POLICIES.heuristic(pendingState('millers_order'), DEFAULT_ECONOMY)).toBe('A');
    const busy = pendingState('millers_order', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < s.unlockedPlots ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 3, dayPlanted: 8 } : p)),
    }));
    expect(EVENT_POLICIES.heuristic(busy, DEFAULT_ECONOMY)).toBe('B');
  });

  it('heuristic takes the beekeeper only with a 3-lease cushion', () => {
    expect(EVENT_POLICIES.heuristic(pendingState('wandering_beekeeper'), DEFAULT_ECONOMY)).toBe('A'); // 130 > 45
    const poor = pendingState('wandering_beekeeper', s => ({ ...s, coinBalance: 40 }));
    expect(EVENT_POLICIES.heuristic(poor, DEFAULT_ECONOMY)).toBe('B');
  });

  it('heuristic embraces Bountiful Spring only when at most 1 plot is near exhaustion', () => {
    // EXHAUSTION_THRESHOLD is 3, so "near exhausted" is consecutiveHarvests >= 2.
    expect(EVENT_POLICIES.heuristic(pendingState('bountiful_spring'), DEFAULT_ECONOMY)).toBe('A'); // 0 near-exhausted
    const strained = pendingState('bountiful_spring', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < 2 ? { ...p, consecutiveHarvests: 2 } : p)), // 2 near-exhausted
    }));
    expect(EVENT_POLICIES.heuristic(strained, DEFAULT_ECONOMY)).toBe('B');
  });

  it('heuristic rush-plants on Drought Warning only with 4 radish seeds + 2 lease days in reserve', () => {
    // radish seedCost 5, season-1 lease 15 → threshold = 5*4 + 15*2 = 50.
    const ample = pendingState('drought_warning', s => ({ ...s, coinBalance: 50 }));
    expect(EVENT_POLICIES.heuristic(ample, DEFAULT_ECONOMY)).toBe('A');
    const poor = pendingState('drought_warning', s => ({ ...s, coinBalance: 49 }));
    expect(EVENT_POLICIES.heuristic(poor, DEFAULT_ECONOMY)).toBe('B');
  });
});
