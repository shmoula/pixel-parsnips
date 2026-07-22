import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventEffect, GameState } from '../../src/engine/types';

const rng = (v = 0.5) => () => v;

function planted(state: GameState, plotId: number, cropId: 'radish' | 'parsnip' | 'pumpkin', daysRemaining: number): GameState {
  return {
    ...state,
    plots: state.plots.map(p => (p.id === plotId
      ? { ...p, cropId, daysRemaining, dayPlanted: state.currentDay }
      : p)),
  };
}

describe('processTurn × farm events', () => {
  it('auto-resolves a still-pending event as choice B with auto=true', () => {
    let s = initialGameState();
    s = { ...s, currentDay: 8, farmEvents: { ...s.farmEvents, pending: { eventId: 'millers_order', firedDay: 8 } } };
    const { state: out } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng());
    expect(out.farmEvents.pending).toBeNull();
    expect(out.farmEvents.lastResolved).toMatchObject({ eventId: 'millers_order', choice: 'B', auto: true });
    expect(out.coinBalance).toBeGreaterThan(0);
  });

  it('draws the season schedule on the first turn', () => {
    const { state: out } = processTurn(initialGameState(), 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(out.farmEvents.scheduleSeason).toBe(1);
    expect(out.farmEvents.scheduledDays.length).toBeGreaterThanOrEqual(1);
  });

  it('fires a scheduled event for the day the player is about to start', () => {
    let s = initialGameState();
    s = { ...s, currentDay: 7, farmEvents: { ...s.farmEvents, scheduleSeason: 1, scheduledDays: [8] } };
    const { state: out } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.0));
    expect(out.currentDay).toBe(8);
    expect(out.farmEvents.pending?.firedDay).toBe(8);
  });

  it('a pinned flash drought overrides the weather roll and is consumed', () => {
    let s = initialGameState();
    const pin: FarmEventEffect = { kind: 'weather_pin', weatherId: 'flash_drought', day: 6 };
    s = { ...s, currentDay: 6, coinBalance: 200, farmEvents: { ...s.farmEvents, scheduleSeason: 1, activeEffects: [pin] } };
    const { state: out, log } = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, rng(0.99));
    expect(log.weatherId).toBe('flash_drought');
    expect(out.farmEvents.activeEffects).toEqual([]);
  });

  it('yield buff multiplies harvests and double-exhausts while active', () => {
    let s = initialGameState();
    const buffEffect: FarmEventEffect = { kind: 'yield_buff', eventId: 'bountiful_spring', multiplier: 1.5, harvestsRemaining: 3, exhaustionFactor: 2 };
    s = planted({ ...s, coinBalance: 200, farmEvents: { ...s.farmEvents, scheduleSeason: 1, activeEffects: [buffEffect] } }, 0, 'radish', 1);
    const { state: out, log } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(log.harvests[0].adjustedYield).toBe(18); // coins(12 × 1.0 × 1.5)
    expect(out.plots[0].consecutiveHarvests).toBe(2); // exhaustionFactor 2
    expect(log.eventBuffsApplied).toEqual([{ eventId: 'bountiful_spring', multiplier: 1.5, harvestsAffected: 1 }]);
    expect(out.farmEvents.activeEffects).toEqual([{ ...buffEffect, harvestsRemaining: 2 }]);
  });

  it('contract progress, completion reward before the bankruptcy check, and log fields', () => {
    let s = initialGameState();
    const contract = { eventId: 'fair_committee' as const, cropId: 'radish' as const, quantity: 4, remaining: 1, deadlineDay: 12, reward: 40 };
    s = planted({ ...s, currentDay: 8, coinBalance: 10, farmEvents: { ...s.farmEvents, scheduleSeason: 1, contract } }, 0, 'radish', 1);
    const { state: out, log, isBankrupt } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(isBankrupt).toBe(false);
    expect(log.contractCompleted).toEqual({ eventId: 'fair_committee', reward: 40 });
    expect(out.farmEvents.contract).toBeNull();
  });

  it('contract expiry clears without penalty and logs it', () => {
    let s = initialGameState();
    const contract = { eventId: 'fair_committee' as const, cropId: 'radish' as const, quantity: 4, remaining: 2, deadlineDay: 8, reward: 40 };
    s = { ...s, currentDay: 8, coinBalance: 200, farmEvents: { ...s.farmEvents, scheduleSeason: 1, contract } };
    const { state: out, log } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(log.contractExpired).toBe('fair_committee');
    expect(out.farmEvents.contract).toBeNull();
  });

  it('a disabled slice stays empty across a full run of turns', () => {
    let s = initialGameState(DEFAULT_ECONOMY, { farmEventsEnabled: false });
    s = { ...s, coinBalance: 10_000 };
    for (let i = 0; i < 25 && s.phase === 'playing'; i++) {
      s = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.4)).state;
      if (s.phase === 'season_passed') s = { ...s, phase: 'playing' };
    }
    expect(s.farmEvents.scheduledDays).toEqual([]);
    expect(s.farmEvents.pending).toBeNull();
    expect(s.farmEvents.seenIds).toEqual([]);
  });
});
