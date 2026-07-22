import { describe, it, expect } from 'vitest';
import { initialGameState, resolveFarmEventChoice, computeSeedCost } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventId, GameState } from '../../src/engine/types';

function withPending(eventId: FarmEventId, mutate: (s: GameState) => GameState = s => s): GameState {
  const s = initialGameState();
  return mutate({
    ...s,
    currentDay: 8,
    farmEvents: { ...s.farmEvents, pending: { eventId, firedDay: 8 } },
  });
}

describe('resolveFarmEventChoice', () => {
  it('is a no-op without a pending event', () => {
    const s = initialGameState();
    expect(resolveFarmEventChoice(s, 'A')).toBe(s);
  });

  it('coins_delta: contract decline pays the consolation now', () => {
    const s = withPending('millers_order');
    const out = resolveFarmEventChoice(s, 'B');
    expect(out.coinBalance).toBe(s.coinBalance + 12);
    expect(out.farmEvents.pending).toBeNull();
    expect(out.farmEvents.lastResolved).toEqual({ eventId: 'millers_order', choice: 'B', day: 8, auto: false });
  });

  it('contract accept creates the contract with the fired-day deadline', () => {
    const out = resolveFarmEventChoice(withPending('millers_order'), 'A');
    expect(out.farmEvents.contract).toEqual({
      eventId: 'millers_order', cropId: 'parsnip', quantity: 3, remaining: 3, deadlineDay: 14, reward: 55,
    });
  });

  it('sell_standing_crops clears growing plots and credits coins(baseYield × 1.4) each', () => {
    const s = withPending('traveling_merchant', st => ({
      ...st,
      plots: st.plots.map((p, i) =>
        i === 0 ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 2, dayPlanted: 7, consecutiveHarvests: 1 } : p),
    }));
    const out = resolveFarmEventChoice(s, 'A');
    expect(out.coinBalance).toBe(s.coinBalance + 91); // coins(65 × 1.4)
    expect(out.plots[0].cropId).toBeNull();
    expect(out.plots[0].consecutiveHarvests).toBe(1); // a private sale, not a harvest
  });

  it('yield_buff and seed_discount become live effects', () => {
    const buffed = resolveFarmEventChoice(withPending('bountiful_spring'), 'A');
    expect(buffed.farmEvents.activeEffects).toEqual([
      { kind: 'yield_buff', eventId: 'bountiful_spring', multiplier: 1.5, harvestsRemaining: 3, exhaustionFactor: 2 },
    ]);
    const discounted = resolveFarmEventChoice(withPending('drought_warning'), 'A');
    expect(discounted.farmEvents.activeEffects).toEqual([
      { kind: 'seed_discount', cropId: 'radish', factor: 0.5, expiresAfterDay: 8 },
    ]);
  });

  it('beekeeper buy-in deducts the fee and refuses when unaffordable', () => {
    const rich = resolveFarmEventChoice(withPending('wandering_beekeeper'), 'A');
    expect(rich.coinBalance).toBe(initialGameState().coinBalance - 15);
    const poor = withPending('wandering_beekeeper', st => ({ ...st, coinBalance: 10 }));
    expect(resolveFarmEventChoice(poor, 'A')).toBe(poor); // unchanged, still pending
  });

  it('flags auto-resolution', () => {
    const out = resolveFarmEventChoice(withPending('bountiful_spring'), 'B', DEFAULT_ECONOMY, true);
    expect(out.farmEvents.lastResolved?.auto).toBe(true);
  });
});

describe('computeSeedCost with an event discount', () => {
  it('applies the seed discount multiplicatively with the toolshed inside one floor', () => {
    const effects = [{ kind: 'seed_discount' as const, cropId: 'radish' as const, factor: 0.5, expiresAfterDay: 8 }];
    const none = initialGameState().buildings;
    expect(computeSeedCost('radish', none, DEFAULT_ECONOMY, effects)).toBe(2);      // floor(5 × 0.5)
    expect(computeSeedCost('parsnip', none, DEFAULT_ECONOMY, effects)).toBe(10);    // unaffected crop
    const shed = { ...none, toolshed: true };
    expect(computeSeedCost('radish', shed, DEFAULT_ECONOMY, effects)).toBe(1);      // floor(5 × 0.6 × 0.5)
  });
});
