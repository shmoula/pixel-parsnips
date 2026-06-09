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
  clearPestDamage,
} from '../../src/engine/gameEngine';
import { EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS, FERTILIZER_COST, STREAK_BONUS_PER_LEVEL } from '../../src/engine/constants';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
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

// ── initialGameState — schema 5 fields ────────────────────────────────────────

describe('initialGameState — schema 5 fields', () => {
  it('starts with endlessMode: false', () => {
    const s = initialGameState();
    expect(s.endlessMode).toBe(false);
  });

  it('has schemaVersion 6', () => {
    expect(initialGameState().schemaVersion).toBe(6);
  });

  it('starts with disastersSurvived: 0', () => {
    expect(initialGameState().disastersSurvived).toBe(0);
  });
});

// ── initialGameState — harvest streak ──────────────────────────────────────────

describe('initialGameState — harvest streak', () => {
  it('starts harvestStreak and peakHarvestStreak at 0', () => {
    const s = initialGameState();
    expect(s.harvestStreak).toBe(0);
    expect(s.peakHarvestStreak).toBe(0);
  });
});

// ── unlockedPlots (010) ────────────────────────────────────────────────────────

describe('unlockedPlots', () => {
  it('initialGameState starts at config.startingPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12 };
    const s = initialGameState(custom);
    expect(s.unlockedPlots).toBe(4);
    expect(s.plots).toHaveLength(12); // array is full size; some locked
  });

  it('defaults to all plots unlocked under DEFAULT_ECONOMY', () => {
    expect(initialGameState().unlockedPlots).toBe(DEFAULT_ECONOMY.maxPlots);
  });
});

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
    // First harvest day: no streak bonus (streakBefore=0).
    expect(log.taxDeducted).toBe(4); // floor((100+12-15) × 0.05) = floor(4.85) = 4
    expect(log.netChange).toBe(12 - 15 - 4);
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
    const state = { ...initialGameState(), coinBalance: 15 };
    const { state: after, isBankrupt } = processTurn(state, 'sunny');
    expect(isBankrupt).toBe(false);
    expect(after.phase).toBe('playing');
    // 15 - 15 = 0, tax = floor(0 × 0.05) = 0 → balance = 0
    expect(after.coinBalance).toBe(0);
  });

  it('triggers bankruptcy when coinBalance === LAND_LEASE_FEE - 1', () => {
    const state = { ...initialGameState(), coinBalance: 14 }; // 14
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
    // Turn 3: harvest 65 (no streak bonus — first harvest) → 63+65=128, -15=113, tax=floor(113×0.05)=5 → 108
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
    // drought radish: floor(12 × 0.5) = 6 coins, no streak bonus on first harvest
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
    // perfect_sun radish: floor(12 × 1.5) = 18 coins, no streak bonus on first harvest
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
  // WEATHER_PROBABILITY_BANDS: 0.00–0.05 blight, 0.05–0.10 pest_infestation,
  // 0.10–0.15 flash_drought, 0.15–0.32 drought, 0.32–0.49 overcast,
  // 0.49–0.66 sunny, 0.66–0.83 warm_breeze, 0.83–1.00 perfect_sun

  it('selects blight when Math.random returns 0.0 (roll < 0.05)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('blight');
    spy.mockRestore();
  });

  it('selects pest_infestation when Math.random returns 0.07 (0.05 ≤ roll < 0.10)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.07);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('pest_infestation');
    spy.mockRestore();
  });

  it('selects flash_drought when Math.random returns 0.12 (0.10 ≤ roll < 0.15)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.12);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('flash_drought');
    spy.mockRestore();
  });

  it('selects drought when Math.random returns 0.20 (0.15 ≤ roll < 0.32)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.20);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('drought');
    spy.mockRestore();
  });

  it('selects warm_breeze when Math.random returns 0.80 (0.66 ≤ roll < 0.83)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.80);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('warm_breeze');
    spy.mockRestore();
  });

  it('selects perfect_sun when Math.random returns 0.95 (0.83 ≤ roll < 1.00)', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.95);
    const { log } = processTurn(initialGameState());
    expect(log.weatherId).toBe('perfect_sun');
    spy.mockRestore();
  });

  it('injected weatherRoll still overrides random selection', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0); // would give 'blight'
    const { log } = processTurn(initialGameState(), 'warm_breeze');
    expect(log.weatherId).toBe('warm_breeze');
    spy.mockRestore();
  });
});

// ── processTurn — Pest Infestation (US2) ─────────────────────────────────────

describe('processTurn — Pest Infestation (US2)', () => {
  it('deterministically destroys injected plot IDs (pestDestructionOverride)', () => {
    let state = withSeeds(initialGameState(), { radish: 3 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    state = plantSeed(state, 1, 'radish').state as GameState;
    state = plantSeed(state, 2, 'radish').state as GameState;
    const { state: after, log } = processTurn(state, 'pest_infestation', [0, 2]);
    expect(log.pestDestroyedPlots).toEqual([0, 2]);
    expect(after.plots[0].pestDamaged).toBe(true);
    expect(after.plots[0].cropId).toBeNull();
    expect(after.plots[2].pestDamaged).toBe(true);
    expect(after.plots[2].cropId).toBeNull();
  });

  it('untouched plot is unaffected when override excludes it', () => {
    // Use parsnip (growthDays=2) for plot 1 so it won't harvest this turn
    let state = withSeeds(initialGameState(), { radish: 2, parsnip: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    state = plantSeed(state, 1, 'parsnip').state as GameState;
    state = plantSeed(state, 2, 'radish').state as GameState;
    const { state: after } = processTurn(state, 'pest_infestation', [0, 2]);
    expect(after.plots[1].pestDamaged).toBe(false);
    expect(after.plots[1].cropId).toBe('parsnip'); // still growing, not yet harvested
  });

  it('destroyed plot has cropId=null, daysRemaining=null, pestDamaged=true', () => {
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    const { state: after } = processTurn(state, 'pest_infestation', [0]);
    const plot = after.plots[0];
    expect(plot.pestDamaged).toBe(true);
    expect(plot.cropId).toBeNull();
    expect(plot.daysRemaining).toBeNull();
    expect(plot.dayPlanted).toBeNull();
  });

  it('pest destruction resets consecutiveHarvests to 0', () => {
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    state = {
      ...state,
      plots: state.plots.map((p, i) =>
        i === 0 ? { ...p, consecutiveHarvests: 2 } : p
      ),
    };
    const { state: after } = processTurn(state, 'pest_infestation', [0]);
    expect(after.plots[0].consecutiveHarvests).toBe(0);
  });

  it('crop maturing this turn is included in destruction (destroyed with no yield)', () => {
    // Radish growthDays=1: planted on day 1, matures (daysRemaining→0) on processTurn
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    const { state: after, log } = processTurn(state, 'pest_infestation', [0]);
    expect(log.pestDestroyedPlots).toContain(0);
    expect(log.harvests).toHaveLength(0); // destroyed before harvest
    expect(after.plots[0].pestDamaged).toBe(true);
  });

  it('no-crash when no crops present — pestDestroyedPlots === []', () => {
    const { log } = processTurn(initialGameState(), 'pest_infestation', []);
    expect(log.pestDestroyedPlots).toEqual([]);
  });

  it('plantSeed returns plot_pest_damaged on a pestDamaged plot', () => {
    let state = withSeeds(initialGameState(), { radish: 2 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    const { state: after } = processTurn(state, 'pest_infestation', [0]);
    const withMore = withSeeds(after, { radish: 1 });
    const result = plantSeed(withMore, 0, 'radish');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('plot_pest_damaged');
  });

  it('non-pest turn still has pestDestroyedPlots === [] in log', () => {
    const { log } = processTurn(initialGameState(), 'sunny');
    expect(log.pestDestroyedPlots).toEqual([]);
  });

  it('combo: Pest Infestation during active Flash Drought window — log has both fields and droughtPenalised cleared', () => {
    // Day N: Flash Drought fires → flashDroughtDaysRemaining = 2
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = processTurn(state, 'flash_drought').state;
    // Plant during drought window → droughtPenalised=true
    state = withSeeds(state, { radish: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    // Day N+1: Pest Infestation → counter decrements 2→1, plot destroyed
    const { state: after, log } = processTurn(state, 'pest_infestation', [0]);
    expect(log.pestDestroyedPlots).toEqual([0]);
    expect(log.flashDroughtDaysAfter).toBe(1); // 2→1
    expect(after.plots[0].droughtPenalised).toBe(false); // cleared on destruction
  });
});

// ── processTurn — Flash Drought (US4) ────────────────────────────────────────

describe('processTurn — Flash Drought (US4)', () => {
  it('flashDroughtDaysRemaining=2 immediately after the event turn', () => {
    const { state } = processTurn(initialGameState(), 'flash_drought');
    expect(state.flashDroughtDaysRemaining).toBe(2);
  });

  it('log.flashDroughtDaysAfter=2 on the Flash Drought turn itself (no decrement that day)', () => {
    const { log } = processTurn(initialGameState(), 'flash_drought');
    expect(log.flashDroughtDaysAfter).toBe(2);
  });

  it('planting radish on day N+1 (counter=2): daysRemaining=ceil(1×2)=2 and droughtPenalised=true', () => {
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = processTurn(state, 'flash_drought').state;  // day N, counter→2
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;
    expect(planted.state.plots[0].daysRemaining).toBe(2); // ceil(1*2)=2
    expect(planted.state.plots[0].droughtPenalised).toBe(true);
  });

  it('planting radish on day N+2 (counter=1) still doubles growth', () => {
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = processTurn(state, 'flash_drought').state; // counter→2
    state = processTurn(state, 'sunny').state;          // counter→1
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;
    expect(planted.state.plots[0].daysRemaining).toBe(2);
    expect(planted.state.plots[0].droughtPenalised).toBe(true);
  });

  it('planting radish on day N+3 (counter=0): normal growth, droughtPenalised=false', () => {
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = processTurn(state, 'flash_drought').state; // counter→2
    state = processTurn(state, 'sunny').state;          // counter→1
    state = processTurn(state, 'sunny').state;          // counter→0
    const planted = plantSeed(state, 0, 'radish');
    expect(planted.ok).toBe(true);
    if (!planted.ok) return;
    expect(planted.state.plots[0].daysRemaining).toBe(1); // normal
    expect(planted.state.plots[0].droughtPenalised).toBe(false);
  });

  it('second Flash Drought stacks counter: counter increases by 2 (+=2)', () => {
    let state = initialGameState();
    state = processTurn(state, 'flash_drought').state; // counter=2
    const { state: after } = processTurn(state, 'flash_drought'); // counter=2+2=4
    expect(after.flashDroughtDaysRemaining).toBe(4);
  });

  it('log.flashDroughtDaysAfter equals post-decrement counter on non-drought turns', () => {
    let state = initialGameState();
    state = processTurn(state, 'flash_drought').state; // counter=2
    const { log } = processTurn(state, 'sunny');       // counter: 2→1
    expect(log.flashDroughtDaysAfter).toBe(1);
  });

  it('flash drought does not affect yield of crops already growing (multiplier=1.0)', () => {
    let state = withSeeds({ ...initialGameState(), coinBalance: 500 }, { radish: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    // Radish matures in 1 turn; inject flash_drought on that turn
    const { log } = processTurn(state, 'flash_drought');
    expect(log.harvests).toHaveLength(1);
    expect(log.harvests[0].adjustedYield).toBe(12); // 12 × 1.0 = 12, unaffected
  });

  it('radish growth during drought: ceil(1×2)=2 turns', () => {
    let state = withSeeds({ ...initialGameState(), coinBalance: 500 }, { radish: 1 });
    state = processTurn(state, 'flash_drought').state; // counter=2
    state = plantSeed(state, 0, 'radish').state as GameState;
    expect(state.plots[0].daysRemaining).toBe(2);
    state = processTurn(state, 'sunny').state; // daysRemaining: 2→1
    expect(state.plots[0].cropId).toBe('radish'); // not harvested yet
    state = processTurn(state, 'sunny').state; // daysRemaining: 1→0, harvest
    expect(state.plots[0].cropId).toBeNull();  // harvested
  });

  it('pumpkin growth during drought: ceil(3×2)=6 turns', () => {
    let state = withSeeds({ ...initialGameState(), coinBalance: 5000 }, { pumpkin: 1 });
    state = processTurn(state, 'flash_drought').state;
    state = plantSeed(state, 0, 'pumpkin').state as GameState;
    expect(state.plots[0].daysRemaining).toBe(6);
  });

  it('droughtPenalised resets to false after harvest', () => {
    let state = withSeeds({ ...initialGameState(), coinBalance: 500 }, { radish: 1 });
    state = processTurn(state, 'flash_drought').state; // counter=2
    state = plantSeed(state, 0, 'radish').state as GameState; // droughtPenalised=true, 2 days
    state = processTurn(state, 'sunny').state;
    state = processTurn(state, 'sunny').state; // harvests on this turn
    expect(state.plots[0].droughtPenalised).toBe(false);
  });

  it('JSON round-trip preserves flashDroughtDaysRemaining and droughtPenalised', () => {
    let state = withSeeds(initialGameState(), { radish: 1 });
    state = processTurn(state, 'flash_drought').state;
    state = plantSeed(state, 0, 'radish').state as GameState;
    const roundTripped: GameState = JSON.parse(JSON.stringify(state));
    expect(roundTripped.flashDroughtDaysRemaining).toBe(2);
    expect(roundTripped.plots[0].droughtPenalised).toBe(true);
  });

  it('combo: Blight during Flash Drought window — counter decrements, yield reduced, drought still active', () => {
    let state = withSeeds({ ...initialGameState(), coinBalance: 500 }, { radish: 1 });
    state = processTurn(state, 'flash_drought').state; // counter=2
    // Plant during drought window on day N+1
    state = plantSeed(state, 0, 'radish').state as GameState;
    expect(state.plots[0].droughtPenalised).toBe(true);
    // Day N+1: Blight — counter should decrement 2→1, multiplier 0.1
    const { log, state: after } = processTurn(state, 'blight');
    expect(log.flashDroughtDaysAfter).toBe(1);
    expect(log.weatherMultiplier).toBe(0.1);
    // Counter decremented, but plant was already during window
    expect(after.flashDroughtDaysRemaining).toBe(1);
  });

  it('combo: normal weather during Flash Drought window — counter decrements and log reflects it', () => {
    let state = initialGameState();
    state = processTurn(state, 'flash_drought').state; // counter=2
    const { log, state: after } = processTurn(state, 'sunny'); // counter: 2→1
    expect(log.flashDroughtDaysAfter).toBe(1);
    expect(after.flashDroughtDaysRemaining).toBe(1);
  });
});

// ── processTurn — Blight disaster (US1) ───────────────────────────────────────

describe('processTurn — Blight disaster (US1)', () => {
  it('radish yield on Blight: floor(12 × 0.1) = 1', () => {
    const state = withSeeds(initialGameState(), { radish: 1 });
    const planted = plantSeed(state, 0, 'radish');
    if (!planted.ok) throw new Error('plant failed');
    const { log } = processTurn(planted.state, 'blight');
    expect(log.harvests[0].adjustedYield).toBe(1);
    expect(log.totalHarvestIncome).toBe(1);
    expect(log.weatherMultiplier).toBe(0.1);
  });

  it('pumpkin yield on Blight: floor(65 × 0.1) = 6', () => {
    let state = withSeeds(initialGameState(), { pumpkin: 1 });
    const planted = plantSeed(state, 0, 'pumpkin');
    if (!planted.ok) throw new Error('plant failed');
    state = planted.state;
    state = processTurn(state, 'sunny').state;
    state = processTurn(state, 'sunny').state;
    const { log } = processTurn(state, 'blight');
    expect(log.harvests[0].adjustedYield).toBe(6);
    expect(log.totalHarvestIncome).toBe(6);
  });

  it('zero-harvest Blight day records weatherId=blight and weatherMultiplier=0.1', () => {
    const { log } = processTurn(initialGameState(), 'blight');
    expect(log.weatherId).toBe('blight');
    expect(log.weatherMultiplier).toBe(0.1);
    expect(log.harvests).toHaveLength(0);
  });

  it('Blight turn: log.pestDestroyedPlots === [] and log.flashDroughtDaysAfter === 0', () => {
    const { log } = processTurn(initialGameState(), 'blight');
    expect(log.pestDestroyedPlots).toEqual([]);
    expect(log.flashDroughtDaysAfter).toBe(0);
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

  it('returns invalid_quantity for zero quantity', () => {
    const state = initialGameState();
    const result = buySeed(state, 'radish', 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_quantity');
  });

  it('returns invalid_quantity for negative quantity', () => {
    const state = initialGameState();
    const result = buySeed(state, 'radish', -2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_quantity');
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

  it('returns invalid_quantity for zero quantity', () => {
    const state = initialGameState();
    const result = buyFertilizer(state, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_quantity');
  });

  it('returns invalid_quantity for negative quantity', () => {
    const state = initialGameState();
    const result = buyFertilizer(state, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_quantity');
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

// ── clearPestDamage (US3) ─────────────────────────────────────────────────────

describe('clearPestDamage (US3)', () => {
  /** Returns a state where plot 0 has pestDamaged=true via injected pest turn. */
  function pestDamagedState(): GameState {
    let state = withSeeds({ ...initialGameState(), coinBalance: 500 }, { radish: 1 });
    state = plantSeed(state, 0, 'radish').state as GameState;
    return processTurn(state, 'pest_infestation', [0]).state;
  }

  it('success clears pestDamaged=false on the target plot', () => {
    const s = pestDamagedState();
    expect(s.plots[0].pestDamaged).toBe(true);
    const result = clearPestDamage(s, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.plots[0].pestDamaged).toBe(false);
  });

  it('plot is plantable after clearPestDamage succeeds', () => {
    const s = pestDamagedState();
    const cleared = clearPestDamage(s, 0);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      const withSeed = withSeeds(cleared.state, { radish: 1 });
      expect(plantSeed(withSeed, 0, 'radish').ok).toBe(true);
    }
  });

  it('returns plot_not_pest_damaged on a healthy plot', () => {
    const result = clearPestDamage(initialGameState(), 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('plot_not_pest_damaged');
  });

  it('returns invalid_plot for out-of-range ID', () => {
    const result = clearPestDamage(initialGameState(), 999);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_plot');
  });

  it('invalid_plot takes priority over plot_not_pest_damaged', () => {
    const result = clearPestDamage(initialGameState(), -1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_plot');
  });

  it('day advance does NOT clear pestDamaged — indicator persists until player acknowledges', () => {
    const s = pestDamagedState();
    const after = processTurn(s, 'sunny').state;
    expect(after.plots[0].pestDamaged).toBe(true);
  });

  it('JSON round-trip preserves pestDamaged=true', () => {
    const s = pestDamagedState();
    const roundTripped: GameState = JSON.parse(JSON.stringify(s));
    expect(roundTripped.plots[0].pestDamaged).toBe(true);
  });

  it('does not mutate other plots when clearing one', () => {
    let s = withSeeds({ ...initialGameState(), coinBalance: 500 }, { radish: 2 });
    s = plantSeed(s, 0, 'radish').state as GameState;
    s = plantSeed(s, 1, 'radish').state as GameState;
    s = processTurn(s, 'pest_infestation', [0, 1]).state;
    const cleared = clearPestDamage(s, 0);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.state.plots[0].pestDamaged).toBe(false); // cleared
      expect(cleared.state.plots[1].pestDamaged).toBe(true);  // untouched
    }
  });
});

// ── processTurn — seasonal lease (US4) ───────────────────────────────────────

describe('processTurn — seasonal lease (US4)', () => {
  it('deducts 15 coins lease on Day 1 (Season 1)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(15);
  });

  it('deducts 20 coins lease on Day 25 (Season 2)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 25 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(20);
  });

  it('deducts 25 coins lease on Day 45 (Season 3)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 45 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(25);
  });

  it('deducts 30 coins lease on Day 65 (Season 4)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 65 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(30);
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

describe('processTurn — seasonal disaster bands (US4)', () => {
  it('weather roll 0.18 returns a non-disaster in Season 1', () => {
    // Season 1 disaster bands: blight 0–0.05, pest 0.05–0.10, flash 0.10–0.15
    // Roll 0.18 falls into the first non-disaster band (drought, 0.15–0.32)
    const state: GameState = { ...initialGameState(), coinBalance: 100 };
    const result = processTurn(state, undefined, undefined, 0.18);
    expect(result.log.weatherId).toBe('drought');
  });

  it('weather roll 0.18 returns Flash Drought in Season 2', () => {
    // Season 2 disaster total = 0.20 → flash_drought band ends at 0.20
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 25 };
    const result = processTurn(state, undefined, undefined, 0.18);
    expect(result.log.weatherId).toBe('flash_drought');
  });

  it('weather roll 0.04 returns Blight in any season (disaster proportions preserved)', () => {
    const state1: GameState = { ...initialGameState(), coinBalance: 100 };
    const state3: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 45 };
    expect(processTurn(state1, undefined, undefined, 0.04).log.weatherId).toBe('blight');
    expect(processTurn(state3, undefined, undefined, 0.04).log.weatherId).toBe('blight');
  });
});

describe('processTurn — disastersSurvived counter (007)', () => {
  it('increments by 1 on a survived blight day', () => {
    const start = { ...initialGameState(), coinBalance: 500, disastersSurvived: 0 };
    const result = processTurn(start, 'blight');
    expect(result.isBankrupt).toBe(false);
    expect(result.state.disastersSurvived).toBe(1);
  });

  it('does NOT increment on a non-disaster day', () => {
    const start = { ...initialGameState(), coinBalance: 500, disastersSurvived: 3 };
    const result = processTurn(start, 'sunny');
    expect(result.state.disastersSurvived).toBe(3);
  });

  it('does NOT increment when a disaster causes bankruptcy that turn', () => {
    // Balance below seasonal lease (15) so the disaster turn bankrupts.
    const start = { ...initialGameState(), coinBalance: 5, disastersSurvived: 2 };
    const result = processTurn(start, 'pest_infestation');
    expect(result.isBankrupt).toBe(true);
    expect(result.state.disastersSurvived).toBe(2); // unchanged
  });
});

// ── processTurn — harvest streak (G12) ────────────────────────────────────────

function seedAndPlant(state: GameState): GameState {
  const bought = buySeed(state, 'radish', 1);
  if (!bought.ok) throw new Error('buy failed');
  const planted = plantSeed(bought.state, 0, 'radish');
  if (!planted.ok) throw new Error('plant failed');
  return planted.state;
}

describe('processTurn — harvest streak', () => {
  it('gives no bonus on the first harvest day but increments streak to 1', () => {
    const state = seedAndPlant(initialGameState());
    const { state: after, log } = processTurn(state, 'sunny');
    expect(log.streakBefore).toBe(0);
    expect(log.streakAfter).toBe(1);
    expect(log.streakBonus).toBe(0);
    expect(after.harvestStreak).toBe(1);
    expect(after.peakHarvestStreak).toBe(1);
  });

  it('awards +5 bonus on the second consecutive harvest day', () => {
    const state = seedAndPlant({ ...initialGameState(), harvestStreak: 1, peakHarvestStreak: 1 });
    const { state: after, log } = processTurn(state, 'sunny');
    expect(log.streakBefore).toBe(1);
    expect(log.streakAfter).toBe(2);
    expect(log.streakBonus).toBe(STREAK_BONUS_PER_LEVEL);
    expect(after.harvestStreak).toBe(2);
  });

  it('resets streak to 0 on a turn with no harvest', () => {
    const base = { ...initialGameState(), harvestStreak: 3, peakHarvestStreak: 3 };
    const { state: after, log } = processTurn(base, 'sunny');
    expect(log.streakBefore).toBe(3);
    expect(log.streakAfter).toBe(0);
    expect(log.streakBonus).toBe(0);
    expect(after.harvestStreak).toBe(0);
    expect(after.peakHarvestStreak).toBe(3);
  });

  it('caps bonus at 20 (streak * 5, capped at 4) but lets streak count keep growing', () => {
    const seeded = seedAndPlant({
      ...initialGameState(),
      harvestStreak: 6,
      peakHarvestStreak: 6,
    });
    const { state: after, log } = processTurn(seeded, 'sunny');
    expect(log.streakBonus).toBe(20);
    expect(after.harvestStreak).toBe(7);
    expect(after.peakHarvestStreak).toBe(7);
  });

  it('records streak bonus even on the bankrupting turn', () => {
    // Streak already at 1 going in, so this harvest earns +5 — still not enough to avoid bankruptcy.
    const seeded = seedAndPlant({ ...initialGameState(), harvestStreak: 1, peakHarvestStreak: 1 });
    const lowBalance = { ...seeded, coinBalance: 1 };
    const { state: after, log } = processTurn(lowBalance, 'blight');
    expect(after.phase).toBe('bankrupt');
    expect(log.streakBonus).toBe(5);
    expect(log.streakAfter).toBe(2);
  });
});

describe('processTurn — harvest streak season reset', () => {
  it('resets harvestStreak on season_passed turn but keeps peakHarvestStreak', () => {
    const seeded = seedAndPlant({
      ...initialGameState(),
      currentDay: 20,
      coinBalance: 500,
      harvestStreak: 3,
      peakHarvestStreak: 5,
    });
    const { state: after } = processTurn(seeded, 'sunny');
    expect(after.phase).toBe('season_passed');
    expect(after.harvestStreak).toBe(0);
    expect(after.peakHarvestStreak).toBe(5);
  });

  it('does NOT reset streak on season_failed (run is ending)', () => {
    // Seed a harvest so we actually exercise the season-end code path
    // (the miss-day reset would otherwise zero the streak for unrelated reasons).
    // coinBalance kept low so the harvest still leaves us under Season 1's target (150).
    const seeded = seedAndPlant({
      ...initialGameState(),
      currentDay: 20,
      coinBalance: 50,
      harvestStreak: 2,
      peakHarvestStreak: 2,
    });
    const { state: after, log } = processTurn(seeded, 'sunny');
    expect(after.phase).toBe('season_failed');
    // Harvest happened: streakBefore=2 → streakAfter=3, then season_failed does NOT reset it.
    expect(log.streakAfter).toBe(3);
    expect(after.harvestStreak).toBe(3);
  });
});

describe('config injection — state/upgrade/plant', () => {
  it('initialGameState uses startingBalance from config', () => {
    const custom = { ...DEFAULT_ECONOMY, startingBalance: 500 };
    expect(initialGameState(custom).coinBalance).toBe(500);
    expect(initialGameState().coinBalance).toBe(100);
  });

  it('buyUpgrade uses the custom upgrade cost', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      upgrades: DEFAULT_ECONOMY.upgrades.map((u, i) => i === 0 ? { ...u, cost: 10 } : u),
    };
    const s = initialGameState();
    const r = buyUpgrade(s, custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(s.coinBalance - 10);
  });

  it('plantSeed uses growthDays from config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      crops: { ...DEFAULT_ECONOMY.crops, radish: { ...DEFAULT_ECONOMY.crops.radish, growthDays: 7 } },
    };
    let s = initialGameState();
    s = (buySeed(s, 'radish', 1, custom) as { state: typeof s }).state;
    const r = plantSeed(s, 0, 'radish', custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.plots[0].daysRemaining).toBe(7);
  });
});

describe('config injection — seeds', () => {
  it('computeSeedCost uses crop cost from a custom config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      crops: { ...DEFAULT_ECONOMY.crops, radish: { ...DEFAULT_ECONOMY.crops.radish, baseSeedCost: 99 } },
    };
    expect(computeSeedCost('radish', 0, custom)).toBe(99);
    expect(computeSeedCost('radish', 0)).toBe(5); // default unchanged
  });

  it('buySeed deducts the custom seed cost', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      crops: { ...DEFAULT_ECONOMY.crops, radish: { ...DEFAULT_ECONOMY.crops.radish, baseSeedCost: 40 } },
    };
    const s = initialGameState();
    const r = buySeed(s, 'radish', 2, custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(s.coinBalance - 80);
  });
});

describe('config injection — fertilizer', () => {
  it('buyFertilizer uses fertilizerCost from config', () => {
    const custom = { ...DEFAULT_ECONOMY, fertilizerCost: 12 };
    const s = initialGameState();
    const r = buyFertilizer(s, 2, custom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.coinBalance).toBe(s.coinBalance - 24);
  });

  it('applyFertilizer rejects an out-of-range plot using config.maxPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, maxPlots: 12 };
    const r = applyFertilizer(initialGameState(), 99, custom);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_plot');
  });

  it('clearPestDamage rejects an out-of-range plot using config.maxPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, maxPlots: 6 };
    const r = clearPestDamage(initialGameState(), 8, custom);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_plot');
  });

  it('applyFertilizer rejects (not throws) when maxPlots exceeds state.plots.length', () => {
    const state = initialGameState(); // DEFAULT_ECONOMY.maxPlots plots
    const custom = { ...DEFAULT_ECONOMY, maxPlots: state.plots.length + 5 };
    const r = applyFertilizer(state, state.plots.length + 2, custom);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_plot');
  });

  it('clearPestDamage rejects (not throws) when maxPlots exceeds state.plots.length', () => {
    const state = initialGameState();
    const custom = { ...DEFAULT_ECONOMY, maxPlots: state.plots.length + 5 };
    const r = clearPestDamage(state, state.plots.length + 2, custom);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_plot');
  });
});

describe('config injection + rng — processTurn', () => {
  it('uses tax rate from config', () => {
    // 12 radishes ready to harvest at day 1 with weather sunny (x1.0)
    // Use withSeeds so the opening balance stays at 100 (no coin deduction for seeds)
    let s = withSeeds(initialGameState(), { radish: 12 });
    for (let i = 0; i < 12; i++) {
      s = (plantSeed(s, i, 'radish') as { state: typeof s }).state;
    }
    const custom = { ...DEFAULT_ECONOMY, taxRate: 0.50 };
    const { state: after } = processTurn(s, 'sunny', undefined, undefined, custom);
    // income 12*12=144 + opening 100; lease 15; tax 50% of (balance-lease)
    const preTax = 100 + 144 - 15;
    expect(after.coinBalance).toBe(preTax - Math.floor(preTax * 0.50));
  });

  it('is deterministic for a fixed rng seed (same weather sequence)', () => {
    const rngA = () => 0.5; // constant roll → same weather band every call
    const rngB = () => 0.5;
    const s = initialGameState();
    const a = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, rngA);
    const b = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, rngB);
    expect(a.log.weatherId).toBe(b.log.weatherId);
  });

  it('the injected rng drives weather band selection', () => {
    const s = initialGameState();
    // Low roll → first (disaster) band; high roll → last (perfect_sun) band.
    const low = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, () => 0.01);
    const high = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, () => 0.99);
    expect(low.log.weatherId).not.toBe(high.log.weatherId);
    expect(low.log.weatherId).toBe('blight');
    expect(high.log.weatherId).toBe('perfect_sun');
  });
});

// ── plantSeed locked plots ─────────────────────────────────────────────────────

describe('plantSeed locked plots', () => {
  it('returns plot_locked for an index >= unlockedPlots', () => {
    const custom = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12 };
    let s = initialGameState(custom);
    s = (buySeed(s, 'radish', 1, custom) as { state: typeof s }).state;
    const r = plantSeed(s, 5, 'radish', custom); // plot 5 is locked (only 0..3 unlocked)
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('plot_locked');
  });

  it('allows planting on an unlocked plot', () => {
    const custom = { ...DEFAULT_ECONOMY, startingPlots: 4, maxPlots: 12 };
    let s = initialGameState(custom);
    s = (buySeed(s, 'radish', 1, custom) as { state: typeof s }).state;
    const r = plantSeed(s, 0, 'radish', custom);
    expect(r.ok).toBe(true);
  });
});
