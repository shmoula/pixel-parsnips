import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn, plantSeed } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

/** Construct a state landing on the season-end day with a given balance.
 *  Note: processTurn deducts lease + tax from balance THEN increments day. So to test
 *  Day 20's end-of-turn behavior, set currentDay to 20 and a coinBalance such that
 *  after harvest (none — no plots planted) and lease/tax, the result meets/misses target.
 */
function stateAt(day: number, balance: number): GameState {
  return { ...initialGameState(), currentDay: day, coinBalance: balance };
}

describe('processTurn — Season 1 end-of-day-20 transition', () => {
  it('sets phase to season_passed when target met', () => {
    // For target 150: opening must satisfy (b - 15) * 0.95 >= 150 → b >= 173.95 → 174
    const state = stateAt(20, 175);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_passed');
    expect(result.state.currentDay).toBe(21);
  });

  it('sets phase to season_failed when target missed', () => {
    const state = stateAt(20, 170);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_failed');
    expect(result.state.currentDay).toBe(20); // does not advance
  });

  it('does not set a transition phase on non-season-end days', () => {
    const state = stateAt(19, 500);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('playing');
  });
});

function stateAtDay80(balance: number): GameState {
  return { ...initialGameState(), currentDay: 80, coinBalance: balance };
}

describe('processTurn — Season 4 endgame (US5)', () => {
  it('sets phase to season_4_won when Day 80 target met and endlessMode is false', () => {
    // Day 80 lease = 30, tax 5% — opening must satisfy (b - 30) * 0.95 >= 600 → b >= 661.58 → 662
    const state = stateAtDay80(700);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_4_won');
    expect(result.state.currentDay).toBe(80); // does not advance
  });

  it('stays in playing phase on Day 80 when endlessMode is true and target met', () => {
    const state = { ...stateAtDay80(700), endlessMode: true };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('playing');
    expect(result.state.currentDay).toBe(81); // advances normally
  });

  it('sets phase to season_failed on Day 80 when target missed (endlessMode false)', () => {
    const state = stateAtDay80(500);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_failed');
  });

  it('sets phase to season_failed on Day 100 when Endless Season 5 target missed', () => {
    // Endless S5 target = 800, lease 32. Need balance < target after costs.
    const state: GameState = {
      ...initialGameState(),
      currentDay: 100,
      coinBalance: 500,
      endlessMode: true,
    };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_failed');
  });
});

describe('processTurn — bankruptcy dominates season_failed', () => {
  it('mid-season bankruptcy (Day 12) sets phase to bankrupt, not any season phase', () => {
    const state: GameState = { ...initialGameState(), currentDay: 12, coinBalance: 5 };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('bankrupt');
  });

  it('Day 20 bankruptcy (insufficient for lease) sets phase to bankrupt, not season_failed', () => {
    // Coin balance below lease (15) on Day 20 — must trigger bankrupt path, not target check
    const state: GameState = { ...initialGameState(), currentDay: 20, coinBalance: 5 };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('bankrupt');
    expect(result.state.phase).not.toBe('season_failed');
  });

  it('Day 20 marginal pass (balance just barely below target) sets season_failed', () => {
    const state: GameState = { ...initialGameState(), currentDay: 20, coinBalance: 165 };
    const result = processTurn(state, 'sunny');
    // 165 - 15 lease = 150 → tax 7 (floor) → closing 143 < 150 → season_failed
    expect(result.state.phase).toBe('season_failed');
  });
});

describe('processTurn — 80-day deterministic run canary (regression)', () => {
  it('a player who plants Pumpkins every turn at Tier 3 reaches season_4_won by Day 80', () => {
    // Set up a player who has skipped to a strong economic position:
    // - Tier 3 tools (60% seed discount)
    // - Plenty of pumpkin seeds
    // - Sunny weather every day for deterministic balance projection
    let state: GameState = {
      ...initialGameState(),
      upgradeTier: 3,
      coinBalance: 500,
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 200 },
    };

    // Helper: plant pumpkins on every empty/non-exhausted/non-pest-damaged plot
    const fillEmptyPlots = (s: GameState): GameState => {
      let next = s;
      for (let plotId = 0; plotId < 12; plotId++) {
        const p = next.plots[plotId];
        if (p.cropId === null && p.exhaustedSinceDay === null && !p.pestDamaged) {
          const r = plantSeed(next, plotId, 'pumpkin');
          if (r.ok) next = r.state;
        }
      }
      return next;
    };

    state = fillEmptyPlots(state);

    // Advance 80 days with sunny weather, replanting after each turn
    for (let d = 0; d < 80; d++) {
      const result = processTurn(state, 'sunny');
      state = result.state;
      if (state.phase === 'bankrupt' || state.phase === 'season_failed' || state.phase === 'season_4_won') break;
      // Auto-acknowledge season transitions like a player tapping "Begin Season N+1"
      if (state.phase === 'season_passed') {
        state = { ...state, phase: 'playing' };
      }
      state = fillEmptyPlots(state);
    }

    // Expected end state: season_4_won at Day 80 with balance >= Season 4 target
    expect(state.phase).toBe('season_4_won');
    expect(state.currentDay).toBe(80);
    expect(state.coinBalance).toBeCloseTo(1277, -1);
  });
});
