import { describe, it, expect } from 'vitest';
import { initialGameState, canAdvanceProductively } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

/** Fresh state: 4 empty plots, no seeds in inventory. */
function freshEmpty(): GameState {
  const s = initialGameState();
  return { ...s, seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 } };
}

describe('canAdvanceProductively', () => {
  it('is false on a fresh empty farm with no seeds', () => {
    expect(canAdvanceProductively(freshEmpty())).toBe(false);
  });

  it('is false when a seed is only held in inventory (not yet planted)', () => {
    const s = freshEmpty();
    expect(canAdvanceProductively({ ...s, seedInventory: { ...s.seedInventory, radish: 1 } })).toBe(false);
  });

  it('is true when a crop is growing on a plot', () => {
    const s = freshEmpty();
    const plots = s.plots.map((p, i) =>
      i === 0 ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
    );
    expect(canAdvanceProductively({ ...s, plots })).toBe(true);
  });
});
