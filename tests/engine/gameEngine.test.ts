import { describe, it, expect } from 'vitest';
import {
  initialGameState,
  plantSeed,
  processTurn,
  computeSeedCost,
  buySeed,
  buyUpgrade,
} from '../../src/engine/gameEngine';
import { LAND_LEASE_FEE } from '../../src/engine/constants';
import type { GameState } from '../../src/engine/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a state with seeds added to the inventory. */
function withSeeds(
  state: GameState,
  seeds: Partial<GameState['seedInventory']>
): GameState {
  return {
    ...state,
    seedInventory: { ...state.seedInventory, ...seeds },
  };
}

// ── plantSeed ─────────────────────────────────────────────────────────────────

describe('plantSeed', () => {
  it('plants successfully on an empty plot when seeds available', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const result = plantSeed(state, 0, 'radish');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.plots[0].cropId).toBe('radish');
    expect(result.state.plots[0].daysRemaining).toBe(1); // radish growthDays=1
    expect(result.state.plots[0].dayPlanted).toBe(1);    // currentDay at plant time
    expect(result.state.seedInventory.radish).toBe(0);   // seed consumed
  });

  it('plants a Parsnip (growthDays=2) correctly', () => {
    const state = withSeeds(initialGameState(), { parsnip: 1 });
    const result = plantSeed(state, 5, 'parsnip');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.plots[5].cropId).toBe('parsnip');
    expect(result.state.plots[5].daysRemaining).toBe(2);
  });

  it('does not mutate other plots', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const result = plantSeed(state, 3, 'radish');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // All other plots remain empty
    result.state.plots
      .filter(p => p.id !== 3)
      .forEach(p => expect(p.cropId).toBeNull());
  });

  it('returns no_seed error when seed inventory is empty', () => {
    const state = initialGameState(); // starts with 0 seeds
    const result = plantSeed(state, 0, 'radish');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('no_seed');
  });

  it('returns plot_occupied error when target plot already has a crop', () => {
    const state = withSeeds(initialGameState(), { radish: 2 });
    const first = plantSeed(state, 0, 'radish');
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = plantSeed(first.state, 0, 'radish');
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toBe('plot_occupied');
  });

  it('returns invalid_plot error for plotId out of range', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const result = plantSeed(state, 99, 'radish');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_plot');
  });

  it('returns invalid_plot error for negative plotId', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const result = plantSeed(state, -1, 'radish');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('invalid_plot');
  });
});

// ── processTurn (US1 — harvest only, no drains yet) ───────────────────────────

describe('processTurn — crop growth and harvest (US1, sunny)', () => {
  it('decrements daysRemaining on all occupied plots each turn', () => {
    const state = withSeeds(initialGameState(), { parsnip: 1 });
    const planted = plantSeed(state, 0, 'parsnip');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;

    const { state: after } = processTurn(planted.state, 'sunny');
    expect(after.plots[0].daysRemaining).toBe(1); // parsnip: 2→1
  });

  it('harvests a Radish after 1 turn (sunny, 1.0×): plot empties', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;

    const { state: after } = processTurn(planted.state, 'sunny');
    expect(after.plots[0].cropId).toBeNull();
    expect(after.plots[0].daysRemaining).toBeNull();
    expect(after.plots[0].dayPlanted).toBeNull();
  });

  it('harvests a Radish after 1 turn: log records 12 coins harvest income', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;

    const { log } = processTurn(planted.state, 'sunny');
    expect(log.totalHarvestIncome).toBe(12); // radish baseYield=12, sunny 1.0×
    expect(log.harvests).toHaveLength(1);
    expect(log.harvests[0].cropId).toBe('radish');
    expect(log.harvests[0].adjustedYield).toBe(12);
  });

  it('harvests a Pumpkin after 3 turns (sunny, 1.0×): log records 65 coins', () => {
    let state = withSeeds(initialGameState(), { pumpkin: 1 });
    const planted = plantSeed(state, 0, 'pumpkin');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;
    state = planted.state;

    state = processTurn(state, 'sunny').state; // day 1→2, daysRemaining 3→2
    state = processTurn(state, 'sunny').state; // day 2→3, daysRemaining 2→1
    const { log, state: after } = processTurn(state, 'sunny'); // day 3→4, harvest

    expect(after.plots[0].cropId).toBeNull();
    expect(log.totalHarvestIncome).toBe(65); // pumpkin baseYield=65, sunny 1.0×
  });

  it('increments currentDay after each turn', () => {
    const state = initialGameState();
    expect(state.currentDay).toBe(1);

    const { state: after } = processTurn(state, 'sunny');
    expect(after.currentDay).toBe(2);
  });

  it('harvests multiple plots in the same turn and accumulates income', () => {
    const state = withSeeds(initialGameState(), { radish: 2 });
    let s = plantSeed(state, 0, 'radish');
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    let s2 = plantSeed(s.state, 1, 'radish');
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;

    const { log } = processTurn(s2.state, 'sunny');
    expect(log.totalHarvestIncome).toBe(24); // 2 × 12
    expect(log.harvests).toHaveLength(2);
  });

  it('does not harvest plots that are not yet ready', () => {
    // Plant radish (1 day) and parsnip (2 days) together
    const state = withSeeds(initialGameState(), { radish: 1, parsnip: 1 });
    const p1 = plantSeed(state, 0, 'radish');
    expect(p1.ok).toBe(true);
    if (!p1.ok) return;
    const p2 = plantSeed(p1.state, 1, 'parsnip');
    expect(p2.ok).toBe(true);
    if (!p2.ok) return;

    const { state: after, log } = processTurn(p2.state, 'sunny');
    // Radish harvested, parsnip still growing
    expect(after.plots[0].cropId).toBeNull();
    expect(after.plots[1].cropId).toBe('parsnip');
    expect(after.plots[1].daysRemaining).toBe(1);
    expect(log.harvests).toHaveLength(1);
    expect(log.harvests[0].cropId).toBe('radish');
  });

  it('sets log.openingBalance to the balance before the turn', () => {
    const state = initialGameState(); // 100 coins
    const { log } = processTurn(state, 'sunny');
    expect(log.openingBalance).toBe(100);
  });

  it('sets log.weatherId to the injected weatherRoll', () => {
    const state = initialGameState();
    const { log } = processTurn(state, 'sunny');
    expect(log.weatherId).toBe('sunny');
    expect(log.weatherMultiplier).toBe(1.0);
  });

  it('does not mutate the input state', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;

    const original = planted.state;
    const originalDay = original.currentDay;
    processTurn(original, 'sunny');

    expect(original.currentDay).toBe(originalDay); // unchanged
  });
});

// ── processTurn — economic drains & bankruptcy (US2, weatherRoll='sunny') ─────

describe('processTurn — economic drains & bankruptcy (US2)', () => {
  it('deducts LAND_LEASE_FEE (15 coins) from balance each turn', () => {
    // 100 coins, no harvest → lease 15 → 85 → tax floor(85×0.05)=4 → 81
    const state = initialGameState();
    const { log } = processTurn(state, 'sunny');
    expect(log.landLeaseDeducted).toBe(15);
  });

  it('deducts 5% tax on post-lease balance using Math.floor', () => {
    // 100 → no harvest → 100 - 15 = 85 → tax = floor(85 × 0.05) = floor(4.25) = 4
    const state = initialGameState();
    const { log } = processTurn(state, 'sunny');
    expect(log.taxDeducted).toBe(4);
  });

  it('records correct closingBalance (openingBalance + harvest - lease - tax)', () => {
    // 100 + 0 - 15 - 4 = 81
    const state = initialGameState();
    const { state: after, log } = processTurn(state, 'sunny');
    expect(log.closingBalance).toBe(81);
    expect(after.coinBalance).toBe(81);
  });

  it('computes tax on balance AFTER lease deduction (not before)', () => {
    // With radish harvest: 100 + 12 = 112 → lease → 97 → tax = floor(97 × 0.05) = floor(4.85) = 4
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;

    const { log } = processTurn(planted.state, 'sunny');
    expect(log.landLeaseDeducted).toBe(15);
    expect(log.taxDeducted).toBe(4); // floor((100+12-15) × 0.05) = floor(4.85) = 4
    expect(log.netChange).toBe(12 - 15 - 4); // -7
    expect(log.closingBalance).toBe(100 + 12 - 15 - 4); // 93
  });

  it('triggers bankruptcy when coinBalance < LAND_LEASE_FEE after harvest', () => {
    const state = { ...initialGameState(), coinBalance: 10 }; // 10 < 15
    const { state: after, isBankrupt } = processTurn(state, 'sunny');
    expect(isBankrupt).toBe(true);
    expect(after.phase).toBe('bankrupt');
  });

  it('sets phase=bankrupt and does NOT deduct lease or tax when bankrupt', () => {
    const state = { ...initialGameState(), coinBalance: 10 };
    const { state: after, log } = processTurn(state, 'sunny');
    expect(after.phase).toBe('bankrupt');
    expect(after.coinBalance).toBe(10); // unchanged — no lease/tax deducted
    expect(log.landLeaseDeducted).toBe(0);
    expect(log.taxDeducted).toBe(0);
  });

  it('does NOT trigger bankruptcy when coinBalance === LAND_LEASE_FEE (exact boundary)', () => {
    // 15 is exactly the fee; 15 < 15 is false → not bankrupt
    const state = { ...initialGameState(), coinBalance: LAND_LEASE_FEE };
    const { state: after, isBankrupt } = processTurn(state, 'sunny');
    expect(isBankrupt).toBe(false);
    expect(after.phase).toBe('playing');
    // 15 - 15 = 0, tax = floor(0 × 0.05) = 0 → balance = 0
    expect(after.coinBalance).toBe(0);
  });

  it('triggers bankruptcy when coinBalance === LAND_LEASE_FEE - 1', () => {
    const state = { ...initialGameState(), coinBalance: LAND_LEASE_FEE - 1 }; // 14
    const { isBankrupt } = processTurn(state, 'sunny');
    expect(isBankrupt).toBe(true);
  });

  it('does NOT increment currentDay when bankruptcy triggers', () => {
    const state = { ...initialGameState(), coinBalance: 10 };
    const { state: after } = processTurn(state, 'sunny');
    expect(after.currentDay).toBe(state.currentDay); // day unchanged
  });

  it('updates peakBalance only AFTER drains are applied', () => {
    // Plant pumpkin (65 coins yield, 3 days), run 3 turns
    const s0 = withSeeds(initialGameState(), { pumpkin: 1 });
    const planted = plantSeed(s0, 0, 'pumpkin');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;

    let s = planted.state; // 100 coins
    // Turn 1: no harvest → 100-15=85, tax=4 → 81
    s = processTurn(s, 'sunny').state;
    // Turn 2: no harvest → 81-15=66, tax=3 → 63
    s = processTurn(s, 'sunny').state;
    // Turn 3: harvest 65 → 63+65=128, -15=113, tax=floor(113×0.05)=5 → 108
    const { state: final } = processTurn(s, 'sunny');

    expect(final.peakBalance).toBe(108); // 108 > 100 initial peak
  });
});

// ── computeSeedCost (US3) ─────────────────────────────────────────────────────

describe('computeSeedCost', () => {
  it('returns full base price at tier 0 (no discount)', () => {
    expect(computeSeedCost('radish', 0)).toBe(5);
    expect(computeSeedCost('parsnip', 0)).toBe(10);
    expect(computeSeedCost('pumpkin', 0)).toBe(20);
  });

  it('applies 20% discount at tier 1 (floor-rounded)', () => {
    // coins(baseSeedCost * (1 - 0.20))
    expect(computeSeedCost('radish', 1)).toBe(4);   // floor(5 * 0.8) = 4
    expect(computeSeedCost('parsnip', 1)).toBe(8);  // floor(10 * 0.8) = 8
    expect(computeSeedCost('pumpkin', 1)).toBe(16); // floor(20 * 0.8) = 16
  });

  it('applies 40% discount at tier 2 (floor-rounded)', () => {
    expect(computeSeedCost('radish', 2)).toBe(3);   // floor(5 * 0.6) = 3
    expect(computeSeedCost('parsnip', 2)).toBe(6);  // floor(10 * 0.6) = 6
    expect(computeSeedCost('pumpkin', 2)).toBe(12); // floor(20 * 0.6) = 12
  });

  it('applies 60% discount at tier 3 (floor-rounded)', () => {
    expect(computeSeedCost('radish', 3)).toBe(2);   // floor(5 * 0.4) = 2
    expect(computeSeedCost('parsnip', 3)).toBe(4);  // floor(10 * 0.4) = 4
    expect(computeSeedCost('pumpkin', 3)).toBe(8);  // floor(20 * 0.4) = 8
  });
});

// ── buySeed (US3) ─────────────────────────────────────────────────────────────

describe('buySeed', () => {
  it('deducts correct cost from balance and adds seeds to inventory', () => {
    const state = initialGameState(); // 100 coins, tier 0
    const result = buySeed(state, 'radish', 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.coinBalance).toBe(95);        // 100 - 5
    expect(result.state.seedInventory.radish).toBe(1);
  });

  it('can buy multiple seeds at once', () => {
    const state = initialGameState(); // 100 coins
    const result = buySeed(state, 'parsnip', 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.coinBalance).toBe(70);        // 100 - 3*10
    expect(result.state.seedInventory.parsnip).toBe(3);
  });

  it('applies upgrade discount when buying seeds', () => {
    const state = { ...initialGameState(), upgradeTier: 1 as const }; // 20% off
    const result = buySeed(state, 'radish', 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.coinBalance).toBe(96); // 100 - 4 (radish at tier 1)
  });

  it('returns insufficient_funds when balance is too low', () => {
    const state = { ...initialGameState(), coinBalance: 4 }; // radish costs 5
    const result = buySeed(state, 'radish', 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('insufficient_funds');
    expect(result.cost).toBe(5);
    expect(result.balance).toBe(4);
  });

  it('does not mutate other seed counts when buying one type', () => {
    const state = withSeeds(initialGameState(), { parsnip: 2 });
    const result = buySeed(state, 'radish', 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.seedInventory.parsnip).toBe(2); // unchanged
  });
});

// ── buyUpgrade (US3) ──────────────────────────────────────────────────────────

describe('buyUpgrade', () => {
  it('increments upgradeTier and deducts cost for tier 0 → 1 (costs 50)', () => {
    const state = initialGameState(); // 100 coins, tier 0
    const result = buyUpgrade(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.upgradeTier).toBe(1);
    expect(result.state.coinBalance).toBe(50); // 100 - 50
  });

  it('increments upgradeTier and deducts cost for tier 1 → 2 (costs 120)', () => {
    const state = { ...initialGameState(), upgradeTier: 1 as const, coinBalance: 200 };
    const result = buyUpgrade(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.upgradeTier).toBe(2);
    expect(result.state.coinBalance).toBe(80); // 200 - 120
  });

  it('increments upgradeTier and deducts cost for tier 2 → 3 (costs 250)', () => {
    const state = { ...initialGameState(), upgradeTier: 2 as const, coinBalance: 300 };
    const result = buyUpgrade(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.upgradeTier).toBe(3);
    expect(result.state.coinBalance).toBe(50); // 300 - 250
  });

  it('returns max_tier_reached when already at tier 3', () => {
    const state = { ...initialGameState(), upgradeTier: 3 as const };
    const result = buyUpgrade(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('max_tier_reached');
  });

  it('returns insufficient_funds when balance < next tier cost', () => {
    const state = { ...initialGameState(), coinBalance: 49 }; // tier 1 costs 50
    const result = buyUpgrade(state);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('insufficient_funds');
  });
});
