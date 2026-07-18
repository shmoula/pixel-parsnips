import { describe, it, expect } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { BUILDING_DEFINITIONS, NO_BUILDINGS } from '../../src/engine/constants';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { GameState } from '../../src/engine/types';

/** Returns a state with the given buildings marked owned. */
export function withBuildings(
  state: GameState,
  owned: Partial<GameState['buildings']>,
): GameState {
  return { ...state, buildings: { ...state.buildings, ...owned } };
}

describe('initialGameState — buildings (019)', () => {
  it('starts with no buildings owned', () => {
    expect(initialGameState().buildings).toEqual(NO_BUILDINGS);
    expect(Object.values(initialGameState().buildings).every(v => v === false)).toBe(true);
  });
});

describe('DEFAULT_ECONOMY.buildings (019)', () => {
  it('defines exactly the five buildings with unique ids', () => {
    const ids = BUILDING_DEFINITIONS.map(d => d.id);
    expect(ids).toEqual(['toolshed', 'compost_bin', 'irrigation_well', 'scarecrow', 'farm_stand']);
    expect(new Set(ids).size).toBe(5);
  });

  it('gates only the toolshed to season 1', () => {
    const byId = Object.fromEntries(BUILDING_DEFINITIONS.map(d => [d.id, d.unlockSeason]));
    expect(byId.toolshed).toBe(1);
    for (const id of ['compost_bin', 'irrigation_well', 'scarecrow', 'farm_stand']) {
      expect(byId[id]).toBe(2);
    }
  });

  it('carries the base disaster knobs and building magnitudes', () => {
    expect(DEFAULT_ECONOMY.pestDestructionChance).toBe(0.5);
    expect(DEFAULT_ECONOMY.flashDroughtWindowDays).toBe(2);
    expect(DEFAULT_ECONOMY.buildings.seedDiscount).toBe(0.4);
    expect(DEFAULT_ECONOMY.buildings.exhaustionRecoveryDays).toBe(2);
    expect(DEFAULT_ECONOMY.buildings.droughtWindowDays).toBe(1);
    expect(DEFAULT_ECONOMY.buildings.pestDestructionChance).toBe(0.25);
    expect(DEFAULT_ECONOMY.buildings.yieldMultiplier).toBe(1.1);
    expect(DEFAULT_ECONOMY.buildings.definitions).toBe(BUILDING_DEFINITIONS);
  });
});
