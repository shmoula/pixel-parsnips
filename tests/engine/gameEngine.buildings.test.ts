import { describe, it, expect } from 'vitest';
import { initialGameState, buyBuilding } from '../../src/engine/gameEngine';
import { BUILDING_DEFINITIONS, NO_BUILDINGS } from '../../src/engine/constants';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { GameState, BuildingId } from '../../src/engine/types';

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

describe('buyBuilding (019)', () => {
  const rich = (day: number): GameState => ({ ...initialGameState(), currentDay: day, coinBalance: 1000 });

  it('buys the toolshed on day 1, deducting its cost', () => {
    const r = buyBuilding(rich(1), 'toolshed');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.buildings.toolshed).toBe(true);
      expect(r.state.coinBalance).toBe(1000 - 150);
    }
  });

  it('rejects an unknown id with invalid_id', () => {
    const r = buyBuilding(rich(1), 'barn' as BuildingId);
    expect(r).toEqual({ ok: false, error: 'invalid_id' });
  });

  it('rejects an owned building with already_owned (beats not_unlocked)', () => {
    const owned = withBuildings(rich(1), { scarecrow: true });
    expect(buyBuilding(owned, 'scarecrow')).toEqual({ ok: false, error: 'already_owned' });
  });

  it('gates season-2 buildings: day 20 rejects, day 21 accepts', () => {
    expect(buyBuilding(rich(20), 'scarecrow')).toEqual({ ok: false, error: 'not_unlocked' });
    expect(buyBuilding(rich(21), 'scarecrow').ok).toBe(true);
  });

  it('not_unlocked beats insufficient_funds', () => {
    const broke = { ...rich(1), coinBalance: 0 };
    expect(buyBuilding(broke, 'scarecrow')).toEqual({ ok: false, error: 'not_unlocked' });
  });

  it('rejects with insufficient_funds when unlocked but too poor', () => {
    const broke = { ...rich(21), coinBalance: 100 };
    expect(buyBuilding(broke, 'scarecrow')).toEqual({ ok: false, error: 'insufficient_funds' });
  });

  it('is always unlocked in the endless-season range (day 81+)', () => {
    expect(buyBuilding(rich(85), 'farm_stand').ok).toBe(true);
  });
});
