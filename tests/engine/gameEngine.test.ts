import { describe, it, expect, vi } from 'vitest';
import {
  initialGameState,
  plantSeed,
  processTurn,
  computeSeedCost,
  buySeed,
  buyUpgrade,
  buyFertilizer,
  applyFertilizer,
} from '../../src/engine/gameEngine';
import { LAND_LEASE_FEE, EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS, FERTILIZER_COST } from '../../src/engine/constants';
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
    const s = plantSeed(state, 0, 'radish');
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const s2 = plantSeed(s.state, 1, 'radish');
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

// ── processTurn — weather yield multiplier (US4, T035) ────────────────────────

describe('processTurn — weather yield multiplier (US4)', () => {
  function stateWithRadish(): GameState {
    const s = withSeeds(initialGameState(), { radish: 1 });
    const r = plantSeed(s, 0, 'radish');
    if (!r.ok) throw new Error('plant failed');
    return r.state;
  }

  it('applies drought multiplier (0.5×): radish yields floor(12 × 0.5) = 6', () => {
    const { log } = processTurn(stateWithRadish(), 'drought');
    expect(log.harvests[0].adjustedYield).toBe(6);
    expect(log.totalHarvestIncome).toBe(6);
  });

  it('applies overcast multiplier (0.8×): radish yields floor(12 × 0.8) = 9', () => {
    const { log } = processTurn(stateWithRadish(), 'overcast');
    expect(log.harvests[0].adjustedYield).toBe(9);
  });

  it('applies warm_breeze multiplier (1.2×): radish yields floor(12 × 1.2) = 14', () => {
    const { log } = processTurn(stateWithRadish(), 'warm_breeze');
    expect(log.harvests[0].adjustedYield).toBe(14);
  });

  it('applies perfect_sun multiplier (1.5×): radish yields floor(12 × 1.5) = 18', () => {
    const { log } = processTurn(stateWithRadish(), 'perfect_sun');
    expect(log.harvests[0].adjustedYield).toBe(18);
  });

  it('applies drought on pumpkin: floor(65 × 0.5) = 32', () => {
    let state = withSeeds(initialGameState(), { pumpkin: 1 });
    const planted = plantSeed(state, 0, 'pumpkin');
    if (!planted.ok) throw new Error('plant failed');
    state = planted.state;
    state = processTurn(state, 'sunny').state;
    state = processTurn(state, 'sunny').state;
    const { log } = processTurn(state, 'drought');
    expect(log.harvests[0].adjustedYield).toBe(32);
    expect(log.totalHarvestIncome).toBe(32);
  });

  it('applies perfect_sun on pumpkin: floor(65 × 1.5) = 97', () => {
    let state = withSeeds(initialGameState(), { pumpkin: 1 });
    const planted = plantSeed(state, 0, 'pumpkin');
    if (!planted.ok) throw new Error('plant failed');
    state = planted.state;
    state = processTurn(state, 'sunny').state;
    state = processTurn(state, 'sunny').state;
    const { log } = processTurn(state, 'perfect_sun');
    expect(log.harvests[0].adjustedYield).toBe(97);
  });
});

// ── processTurn — DailyLogEntry accounting fields (US4, T036) ─────────────────

describe('processTurn — DailyLogEntry accounting fields (US4)', () => {
  it('sets weatherId and weatherMultiplier from injected roll', () => {
    const { log } = processTurn(initialGameState(), 'warm_breeze');
    expect(log.weatherId).toBe('warm_breeze');
    expect(log.weatherMultiplier).toBe(1.2);
  });

  it('drought harvest: correct totalHarvestIncome, taxDeducted, netChange, closingBalance', () => {
    // drought radish: floor(12 × 0.5) = 6 coins
    // 100 + 6 = 106 → −15 lease = 91 → tax = floor(91 × 0.05) = 4
    // net = 6 − 15 − 4 = −13, closing = 87
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    if (!planted.ok) throw new Error('plant failed');
    const { log } = processTurn(planted.state, 'drought');
    expect(log.totalHarvestIncome).toBe(6);
    expect(log.taxDeducted).toBe(4);
    expect(log.netChange).toBe(-13);
    expect(log.closingBalance).toBe(87);
  });

  it('perfect_sun harvest: correct totalHarvestIncome, taxDeducted, netChange, closingBalance', () => {
    // perfect_sun radish: floor(12 × 1.5) = 18 coins
    // 100 + 18 = 118 → −15 = 103 → tax = floor(103 × 0.05) = 5
    // net = 18 − 15 − 5 = −2, closing = 98
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    if (!planted.ok) throw new Error('plant failed');
    const { log } = processTurn(planted.state, 'perfect_sun');
    expect(log.totalHarvestIncome).toBe(18);
    expect(log.taxDeducted).toBe(5);
    expect(log.netChange).toBe(-2);
    expect(log.closingBalance).toBe(98);
  });
});

// ── processTurn — uniform random weather when no weatherRoll (US4, T037) ──────

describe('processTurn — uniform random weather selection (US4)', () => {
  it('uses Math.random to select weather when no weatherRoll is injected', () => {
    // WEATHER_IDS = ['drought','overcast','sunny','warm_breeze','perfect_sun']
    // Math.random() = 0.0 → floor(0.0 × 5) = 0 → 'drought'
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('drought');
    spy.mockRestore();
  });

  it('selects perfect_sun when Math.random returns 0.8', () => {
    // floor(0.8 × 5) = floor(4.0) = 4 → 'perfect_sun'
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('perfect_sun');
    spy.mockRestore();
  });

  it('injected weatherRoll still overrides random selection', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0); // would give 'drought'
    const { log } = processTurn(initialGameState(), 'warm_breeze');
    expect(log.weatherId).toBe('warm_breeze');
    spy.mockRestore();
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

// ── T044: 100-turn automated stress test (SC-002, SC-003) ─────────────────────

describe('processTurn — 100-turn stress test (T044)', () => {
  it('runs 100 turns without exceptions and produces integer coin values', () => {
    const WEATHER_CYCLE: import('../../src/engine/types').WeatherId[] = [
      'sunny', 'drought', 'overcast', 'warm_breeze', 'perfect_sun',
    ];

    let state = initialGameState();

    for (let turn = 0; turn < 100; turn++) {
      if (state.phase === 'bankrupt') break; // game over — stop early

      const weatherRoll = WEATHER_CYCLE[turn % WEATHER_CYCLE.length];
      const result = processTurn(state, weatherRoll);
      const next = result.state;

      // Coin values must always be integers (no floating-point drift)
      expect(Number.isInteger(next.coinBalance)).toBe(true);
      expect(Number.isInteger(next.peakBalance)).toBe(true);

      if (result.log) {
        expect(Number.isInteger(result.log.totalHarvestIncome)).toBe(true);
        expect(Number.isInteger(result.log.landLeaseDeducted)).toBe(true);
        expect(Number.isInteger(result.log.taxDeducted)).toBe(true);
        expect(Number.isInteger(result.log.netChange)).toBe(true);

        // Closing balance in log must match actual coin balance
        if (next.phase !== 'bankrupt') {
          expect(result.log.closingBalance).toBe(next.coinBalance);
        }

        // Each harvest yield must also be an integer
        for (const h of result.log.harvests) {
          expect(Number.isInteger(h.adjustedYield)).toBe(true);
        }
      }

      state = next;
    }
  });

  it('processTurn never throws even when state has edge-case balances', () => {
    // State right at the boundary — coinBalance just enough for lease
    const edgeState: GameState = {
      ...initialGameState(),
      coinBalance: 15, // exactly LAND_LEASE_FEE
    };
    expect(() => processTurn(edgeState, 'sunny')).not.toThrow();

    // State with zero balance — should go bankrupt cleanly
    const zeroState: GameState = { ...initialGameState(), coinBalance: 0 };
    expect(() => processTurn(zeroState, 'sunny')).not.toThrow();
    expect(processTurn(zeroState, 'sunny').state.phase).toBe('bankrupt');
  });
});

// ── Helpers for exhaustion tests ──────────────────────────────────────────────

/** Plants a radish and advances one day (harvests it). Requires radish in inventory. */
function harvestOnce(state: GameState, plotId: number): GameState {
  const withSeed = withSeeds(state, { radish: 1 });
  const planted = plantSeed(withSeed, plotId, 'radish');
  if (!planted.ok) throw new Error(`plantSeed failed: ${planted.error}`);
  return processTurn(planted.state, 'sunny').state;
}

/** Returns a state where plot 0 has been exhausted (3 consecutive harvests). */
function exhaustedState(): GameState {
  let state = withSeeds(initialGameState(), { radish: 0 });
  // Give enough balance to survive 3 turns of lease+tax
  state = { ...state, coinBalance: 500 };
  for (let i = 0; i < EXHAUSTION_THRESHOLD; i++) {
    state = harvestOnce(state, 0);
  }
  return state;
}

// ── T005: processTurn — exhaustion trigger ────────────────────────────────────

describe('processTurn — exhaustion trigger (T005, US1)', () => {
  it('consecutiveHarvests increments to 1 after first harvest', () => {
    const state = { ...initialGameState(), coinBalance: 500 };
    const afterFirst = harvestOnce(state, 0);
    expect(afterFirst.plots[0].consecutiveHarvests).toBe(1);
  });

  it('consecutiveHarvests increments to 2 after second consecutive harvest', () => {
    const state = { ...initialGameState(), coinBalance: 500 };
    const afterSecond = harvestOnce(harvestOnce(state, 0), 0);
    expect(afterSecond.plots[0].consecutiveHarvests).toBe(2);
  });

  it('3rd harvest sets exhaustedSinceDay to the new currentDay (post-increment)', () => {
    const s = exhaustedState();
    expect(s.plots[0].exhaustedSinceDay).not.toBeNull();
  });

  it('3rd harvest resets consecutiveHarvests to 0', () => {
    const s = exhaustedState();
    expect(s.plots[0].consecutiveHarvests).toBe(0);
  });

  it('exhaustedSinceDay equals currentDay after exhaustion trigger', () => {
    const s = exhaustedState();
    // exhaustedSinceDay is set to the post-increment currentDay
    expect(s.plots[0].exhaustedSinceDay).toBe(s.currentDay);
  });

  it('log.exhaustedPlots contains the exhausted plotId on the triggering turn', () => {
    let state = { ...initialGameState(), coinBalance: 500 };
    // First two harvests — not yet exhausted
    state = harvestOnce(state, 0);
    state = harvestOnce(state, 0);
    // Third harvest — exhaustion triggers
    const withSeed = withSeeds(state, { radish: 1 });
    const planted = plantSeed(withSeed, 0, 'radish');
    if (!planted.ok) throw new Error('plant failed');
    const result = processTurn(planted.state, 'sunny');
    expect(result.log.exhaustedPlots).toContain(0);
  });

  it('non-harvested plots are not added to exhaustedPlots', () => {
    let state = { ...initialGameState(), coinBalance: 500 };
    state = harvestOnce(state, 0);
    state = harvestOnce(state, 0);
    const withSeed = withSeeds(state, { radish: 1 });
    const planted = plantSeed(withSeed, 0, 'radish');
    if (!planted.ok) throw new Error('plant failed');
    const result = processTurn(planted.state, 'sunny');
    // Plot 1 (not harvested this turn) should not be in exhaustedPlots
    expect(result.log.exhaustedPlots).not.toContain(1);
  });

  it('consecutiveHarvests on OTHER plots is unaffected by one plot exhausting', () => {
    let state = { ...initialGameState(), coinBalance: 500 };
    // Harvest plot 1 once
    state = harvestOnce(state, 1);
    expect(state.plots[1].consecutiveHarvests).toBe(1);
    // Now exhaust plot 0 (3 harvests)
    state = harvestOnce(state, 0);
    state = harvestOnce(state, 0);
    state = harvestOnce(state, 0);
    // Plot 1 counter should still be 1 (only harvested once, no change since)
    expect(state.plots[1].consecutiveHarvests).toBe(1);
  });
});

// ── T006: processTurn — natural recovery ──────────────────────────────────────

describe('processTurn — natural recovery (T006, US1)', () => {
  it('plot remains exhausted 1 day after exhaustion', () => {
    let s = exhaustedState();
    s = processTurn(s, 'sunny').state;
    expect(s.plots[0].exhaustedSinceDay).not.toBeNull();
  });

  it('plot remains exhausted 2 days after exhaustion', () => {
    let s = exhaustedState();
    s = processTurn(s, 'sunny').state;
    s = processTurn(s, 'sunny').state;
    expect(s.plots[0].exhaustedSinceDay).not.toBeNull();
  });

  it(`plot recovers after exactly ${EXHAUSTION_RECOVERY_DAYS} days`, () => {
    let s = exhaustedState();
    for (let i = 0; i < EXHAUSTION_RECOVERY_DAYS; i++) {
      s = processTurn(s, 'sunny').state;
    }
    expect(s.plots[0].exhaustedSinceDay).toBeNull();
  });

  it('consecutiveHarvests resets to 0 after natural recovery', () => {
    let s = exhaustedState();
    for (let i = 0; i < EXHAUSTION_RECOVERY_DAYS; i++) {
      s = processTurn(s, 'sunny').state;
    }
    expect(s.plots[0].consecutiveHarvests).toBe(0);
  });

  it('plot can be planted again after natural recovery', () => {
    let s = exhaustedState();
    for (let i = 0; i < EXHAUSTION_RECOVERY_DAYS; i++) {
      s = processTurn(s, 'sunny').state;
    }
    const withSeed = withSeeds(s, { radish: 1 });
    const result = plantSeed(withSeed, 0, 'radish');
    expect(result.ok).toBe(true);
  });
});

// ── T007: plantSeed — plot_exhausted error ────────────────────────────────────

describe('plantSeed — plot_exhausted error (T007, US1)', () => {
  it('returns plot_exhausted when target plot has exhaustedSinceDay !== null', () => {
    const s = exhaustedState();
    const withSeed = withSeeds(s, { radish: 1 });
    const result = plantSeed(withSeed, 0, 'radish');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('plot_exhausted');
  });

  it('does not deduct a seed when plot_exhausted', () => {
    const s = exhaustedState();
    const withSeed = withSeeds(s, { radish: 3 });
    plantSeed(withSeed, 0, 'radish');
    expect(withSeed.seedInventory.radish).toBe(3);
  });

  it('non-exhausted plots are still plantable in the same state', () => {
    const s = exhaustedState();
    const withSeed = withSeeds(s, { radish: 1 });
    const result = plantSeed(withSeed, 1, 'radish'); // plot 1 is not exhausted
    expect(result.ok).toBe(true);
  });

  it('plot_exhausted guard fires even when no seeds available', () => {
    // exhaustedSinceDay check must be evaluated before no_seed check
    const s = exhaustedState(); // no radish seeds
    expect(s.seedInventory.radish).toBe(0);
    const result = plantSeed(s, 0, 'radish');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('plot_exhausted');
  });
});

// ── T012: buyFertilizer ───────────────────────────────────────────────────────

describe('buyFertilizer (T012, US2)', () => {
  it('deducts FERTILIZER_COST from coinBalance on success', () => {
    const state = { ...initialGameState(), coinBalance: 100 };
    const result = buyFertilizer(state, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.coinBalance).toBe(100 - FERTILIZER_COST);
  });

  it('increments fertilizerInventory by 1 on success', () => {
    const state = { ...initialGameState(), coinBalance: 100 };
    const result = buyFertilizer(state, 1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.fertilizerInventory).toBe(1);
  });

  it('returns insufficient_funds when balance too low', () => {
    const state = { ...initialGameState(), coinBalance: FERTILIZER_COST - 1 };
    const result = buyFertilizer(state, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('insufficient_funds');
  });

  it('does not mutate state on failure', () => {
    const state = { ...initialGameState(), coinBalance: 10 };
    buyFertilizer(state, 1);
    expect(state.coinBalance).toBe(10);
    expect(state.fertilizerInventory).toBe(0);
  });

  it('handles quantity > 1: deducts FERTILIZER_COST * quantity', () => {
    const state = { ...initialGameState(), coinBalance: 200 };
    const result = buyFertilizer(state, 3);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.coinBalance).toBe(200 - FERTILIZER_COST * 3);
      expect(result.state.fertilizerInventory).toBe(3);
    }
  });

  it('returns insufficient_funds for quantity > 1 when balance too low', () => {
    const state = { ...initialGameState(), coinBalance: FERTILIZER_COST * 2 - 1 };
    const result = buyFertilizer(state, 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('insufficient_funds');
  });
});

// ── T013: applyFertilizer ─────────────────────────────────────────────────────

describe('applyFertilizer (T013, US2)', () => {
  it('clears exhaustedSinceDay on success', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 1 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.plots[0].exhaustedSinceDay).toBeNull();
  });

  it('resets consecutiveHarvests to 0 on success', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 1 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.plots[0].consecutiveHarvests).toBe(0);
  });

  it('decrements fertilizerInventory by 1 on success', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 2 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.fertilizerInventory).toBe(1);
  });

  it('plot is immediately plantable after apply', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 1 };
    const applied = applyFertilizer(s, 0);
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      const withSeed = withSeeds(applied.state, { radish: 1 });
      expect(plantSeed(withSeed, 0, 'radish').ok).toBe(true);
    }
  });

  it('returns no_fertilizer when fertilizerInventory === 0', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 0 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('no_fertilizer');
  });

  it('returns plot_not_exhausted when plot is not exhausted', () => {
    const s = { ...initialGameState(), fertilizerInventory: 1 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('plot_not_exhausted');
  });

  it('returns invalid_plot for out-of-range plotId', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 1 };
    const result = applyFertilizer(s, 999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_plot');
  });

  it('invalid_plot takes priority over plot_not_exhausted and no_fertilizer', () => {
    const s = { ...initialGameState(), fertilizerInventory: 0 };
    const result = applyFertilizer(s, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_plot');
  });

  it('clears cropId, dayPlanted, daysRemaining fields on success', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 1 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.plots[0].cropId).toBeNull();
      expect(result.state.plots[0].dayPlanted).toBeNull();
      expect(result.state.plots[0].daysRemaining).toBeNull();
    }
  });
});

// ── T022: Edge case tests ─────────────────────────────────────────────────────

describe('processTurn — edge cases (T022)', () => {
  it('does not crash when all 12 plots are simultaneously exhausted', () => {
    // Directly inject all plots as exhausted on the current day
    const currentDay = 10;
    const allExhaustedState: GameState = {
      ...initialGameState(),
      coinBalance: 5000,
      currentDay,
      plots: initialGameState().plots.map(p => ({
        ...p,
        cropId: null,
        dayPlanted: null,
        daysRemaining: null,
        consecutiveHarvests: 0,
        exhaustedSinceDay: currentDay,
      })),
    };
    expect(allExhaustedState.plots.every(p => p.exhaustedSinceDay !== null)).toBe(true);
    expect(() => processTurn(allExhaustedState, 'sunny')).not.toThrow();
  });

  it('applyFertilizer resets consecutiveHarvests to 0 so plot can exhaust again', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 1 };
    const result = applyFertilizer(s, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.plots[0].consecutiveHarvests).toBe(0);
      // Confirm planting is re-enabled
      const withSeed = withSeeds(result.state, { radish: 1 });
      expect(plantSeed(withSeed, 0, 'radish').ok).toBe(true);
    }
  });

  it('JSON round-trip preserves consecutiveHarvests, exhaustedSinceDay, and fertilizerInventory', () => {
    const s = { ...exhaustedState(), fertilizerInventory: 2 };
    const roundTripped: GameState = JSON.parse(JSON.stringify(s));
    expect(roundTripped.plots[0].exhaustedSinceDay).toBe(s.plots[0].exhaustedSinceDay);
    expect(roundTripped.plots[0].consecutiveHarvests).toBe(s.plots[0].consecutiveHarvests);
    expect(roundTripped.fertilizerInventory).toBe(2);
  });
});
