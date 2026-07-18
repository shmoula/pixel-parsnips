import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState, computeSeedCost } from '../../src/engine/gameEngine';
import { SCHEMA_VERSION, NO_BUILDINGS } from '../../src/engine/constants';

const STORAGE_KEY = 'pixel-parsnips-state';

/** A minimal v8 envelope: schema-8 state still carrying upgradeTier, no buildings. */
function v8State(upgradeTier: number): Record<string, unknown> {
  const { buildings: _b, ...rest } = initialGameState() as unknown as Record<string, unknown>;
  return { ...rest, schemaVersion: 8, upgradeTier };
}

beforeEach(() => localStorage.clear());

describe('schema 8 → 9 migration (019 — ladder to buildings)', () => {
  it.each([
    [0, false],
    [1, true],
    [2, true],
    [3, true],
  ])('maps upgradeTier %i to toolshed=%s and drops the field', (tier, ownsToolshed) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 8, state: v8State(tier) }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.buildings).toEqual({ ...NO_BUILDINGS, toolshed: ownsToolshed });
    expect('upgradeTier' in (result.current.state as unknown as Record<string, unknown>)).toBe(false);
  });

  it('hardens a malformed buildings field on a current-schema save to all-false', () => {
    const st = { ...(initialGameState() as unknown as Record<string, unknown>), buildings: 'garbage' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: st }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.buildings).toEqual(NO_BUILDINGS);
  });
});

describe('computeSeedCost — toolshed (019)', () => {
  it('charges base price without the toolshed and 40% off with it', () => {
    expect(computeSeedCost('pumpkin', { ...NO_BUILDINGS })).toBe(20);
    expect(computeSeedCost('pumpkin', { ...NO_BUILDINGS, toolshed: true })).toBe(12);
    expect(computeSeedCost('radish', { ...NO_BUILDINGS, toolshed: true })).toBe(3); // floor(5 × 0.6)
  });
});
