import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn } from '../../src/engine/gameEngine';
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
