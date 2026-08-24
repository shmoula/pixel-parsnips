import { describe, expect, it } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('runHistory — initial state', () => {
  it('starts empty on a fresh run', () => {
    const s = initialGameState(DEFAULT_ECONOMY);
    expect(s.runHistory).toEqual([]);
  });

  it('declares schema 11', () => {
    expect(initialGameState(DEFAULT_ECONOMY).schemaVersion).toBe(11);
  });
});
