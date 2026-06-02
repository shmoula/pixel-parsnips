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
