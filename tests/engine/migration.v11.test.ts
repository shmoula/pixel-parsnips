import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import { SCHEMA_VERSION } from '../../src/engine/constants';

const STORAGE_KEY = 'pixel-parsnips-state';

beforeEach(() => localStorage.clear());

/** Writes a save envelope at an arbitrary schema version. */
function seedSave(version: number, over: Record<string, unknown> = {}) {
  const state = { ...initialGameState(DEFAULT_ECONOMY), currentDay: 6, coinBalance: 88, ...over };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: version, state }));
}

describe('schema 11 migration', () => {
  it('carries a v10 save forward and seeds an empty history', () => {
    const state = { ...initialGameState(DEFAULT_ECONOMY), currentDay: 6, coinBalance: 88 };
    delete (state as Record<string, unknown>).runHistory;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state }));

    const { result } = renderHook(() => useGameEngine());

    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.currentDay).toBe(6);
    expect(result.current.state.coinBalance).toBe(88);
    expect(result.current.state.runHistory).toEqual([]);
  });

  it('gives every legacy version a history via hardening', () => {
    for (const v of [3, 4, 5, 6, 7, 8, 9]) {
      localStorage.clear();
      seedSave(v);
      const { result } = renderHook(() => useGameEngine());
      expect(result.current.state.runHistory, `v${v}`).toEqual([]);
      expect(result.current.state.schemaVersion, `v${v}`).toBe(SCHEMA_VERSION);
    }
  });

  it('preserves a history that is already present at v11', () => {
    seedSave(SCHEMA_VERSION, {
      runHistory: [{ day: 1, closingBalance: 90, taxDeducted: 5, harvestIncome: 20, unlockedPlots: 4, buildingCount: 0 }],
    });
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.runHistory).toHaveLength(1);
    expect(result.current.state.runHistory[0].closingBalance).toBe(90);
  });

  it('discards a tampered non-array history rather than crashing', () => {
    seedSave(SCHEMA_VERSION, { runHistory: 'not an array' });
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.runHistory).toEqual([]);
  });

  it('drops malformed entries but keeps well-formed ones', () => {
    seedSave(SCHEMA_VERSION, {
      runHistory: [
        { day: 1, closingBalance: 90, taxDeducted: 5, harvestIncome: 20, unlockedPlots: 4, buildingCount: 0 },
        { day: 'two' },
        null,
      ],
    });
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.runHistory).toHaveLength(1);
    expect(result.current.state.runHistory[0].closingBalance).toBe(90);
  });
});
