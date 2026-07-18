import { describe, it, expect } from 'vitest';
import { initialGameState, buyBuilding, processTurn, plantSeed, buySeed } from '../../src/engine/gameEngine';
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

/** Plants a radish on plot 0 of a rich state (buys the seed first). */
function planted(state: GameState): GameState {
  const bought = buySeed({ ...state, coinBalance: 1000 }, 'radish', 1);
  if (!bought.ok) throw new Error('seed buy failed');
  const p = plantSeed(bought.state, 0, 'radish');
  if (!p.ok) throw new Error('plant failed');
  return p.state;
}

describe('Scarecrow — pest destruction chance (019)', () => {
  // rng() = 0.3 sits between the scarecrow chance (0.25) and the base (0.5):
  // destroyed without a scarecrow, spared with one.
  it('destroys the plot at the base 50% chance without a scarecrow', () => {
    const { state } = processTurn(planted(initialGameState()), 'pest_infestation', undefined, undefined, DEFAULT_ECONOMY, () => 0.3);
    expect(state.plots[0].pestDamaged).toBe(true);
  });

  it('spares the plot at the 25% chance with a scarecrow', () => {
    const s = withBuildings(planted(initialGameState()), { scarecrow: true });
    const { state } = processTurn(s, 'pest_infestation', undefined, undefined, DEFAULT_ECONOMY, () => 0.3);
    expect(state.plots[0].pestDamaged).toBe(false);
  });
});

describe('Irrigation Well — drought window (019)', () => {
  it('adds +2 days without the well', () => {
    const { state } = processTurn(planted(initialGameState()), 'flash_drought');
    expect(state.flashDroughtDaysRemaining).toBe(2);
  });

  it('adds +1 day with the well', () => {
    const s = withBuildings(planted(initialGameState()), { irrigation_well: true });
    const { state } = processTurn(s, 'flash_drought');
    expect(state.flashDroughtDaysRemaining).toBe(1);
  });

  it('buying the well mid-window does not shorten an active counter', () => {
    const midWindow = { ...initialGameState(), coinBalance: 1000, currentDay: 21, flashDroughtDaysRemaining: 2 };
    const r = buyBuilding(midWindow, 'irrigation_well');
    expect(r.ok && r.state.flashDroughtDaysRemaining).toBe(2);
  });
});

describe('buildingsApplied log field (019)', () => {
  it('records scarecrow on an owned pest turn', () => {
    const s = withBuildings(planted(initialGameState()), { scarecrow: true });
    const { log } = processTurn(s, 'pest_infestation', [], undefined);
    expect(log.buildingsApplied).toEqual(['scarecrow']);
  });

  it('records irrigation_well on an owned drought turn', () => {
    const s = withBuildings(planted(initialGameState()), { irrigation_well: true });
    const { log } = processTurn(s, 'flash_drought');
    expect(log.buildingsApplied).toEqual(['irrigation_well']);
  });

  it('is empty on disaster turns without the matching building, and on sunny turns', () => {
    expect(processTurn(planted(initialGameState()), 'pest_infestation', []).log.buildingsApplied).toEqual([]);
    const owned = withBuildings(planted(initialGameState()), { scarecrow: true, irrigation_well: true });
    expect(processTurn(owned, 'sunny').log.buildingsApplied).toEqual([]);
  });
});

describe('Compost Bin — natural recovery (019)', () => {
  /** A state whose plot 0 went exhausted on day `since`, currently at day `now`. */
  const exhaustedState = (now: number, since: number): GameState => {
    const s = initialGameState();
    return {
      ...s,
      currentDay: now,
      coinBalance: 1000,
      plots: s.plots.map(p => (p.id === 0 ? { ...p, exhaustedSinceDay: since } : p)),
    };
  };

  it('recovers after 3 days without the compost bin', () => {
    // day 6 → turn completes into day 7; 7 - 4 = 3 >= 3 recovers
    const { state } = processTurn(exhaustedState(6, 4), 'sunny');
    expect(state.plots[0].exhaustedSinceDay).toBeNull();
    // day 5 → day 6; 6 - 4 = 2 < 3 stays exhausted
    const early = processTurn(exhaustedState(5, 4), 'sunny');
    expect(early.state.plots[0].exhaustedSinceDay).toBe(4);
  });

  it('recovers after 2 days with the compost bin (immediate benefit mid-rest)', () => {
    const owned = withBuildings(exhaustedState(5, 4), { compost_bin: true });
    const { state } = processTurn(owned, 'sunny'); // day 5 → 6; 6 - 4 = 2 >= 2 recovers
    expect(state.plots[0].exhaustedSinceDay).toBeNull();
  });
});
