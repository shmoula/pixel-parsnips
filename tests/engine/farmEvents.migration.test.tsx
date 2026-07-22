import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { EMPTY_FARM_EVENTS } from '../../src/engine/farmEvents';

const STORAGE_KEY = 'pixel-parsnips-state';
const RECORDS_KEY = 'pixel-parsnips-records';

function v9Save(): string {
  // A real v10 state minus the farmEvents slice, stamped v9 — the shape v9 saves have.
  const { farmEvents: _dropped, ...v9State } = initialGameState();
  return JSON.stringify({ schemaVersion: 9, state: { ...v9State, schemaVersion: 9 } });
}

function seedRecords(totalRunsCompleted: number): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({
    schemaVersion: 2, bestDaysSurvived: 5, bestPeakBalance: 100, bestSeasonReached: 1,
    mostDisastersSurvived: 0, bestHarvestStreak: 2, totalRunsCompleted,
  }));
}

describe('v9 → v10 migration', () => {
  beforeEach(() => localStorage.clear());

  it('adds the empty slice, enabled=false on a device with no completed runs', () => {
    localStorage.setItem(STORAGE_KEY, v9Save());
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents).toEqual({ ...EMPTY_FARM_EVENTS, enabled: false });
    expect(result.current.state.schemaVersion).toBe(10);
  });

  it('enables events for devices with completed runs', () => {
    seedRecords(3);
    localStorage.setItem(STORAGE_KEY, v9Save());
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.enabled).toBe(true);
  });

  it('a malformed farmEvents field on a v10 save loads as the records-derived empty slice', () => {
    seedRecords(1);
    const tampered = { ...initialGameState(), farmEvents: 'garbage' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: tampered }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents).toEqual({ ...EMPTY_FARM_EVENTS, enabled: true });
  });

  it('drops a malformed pending field on an otherwise valid v10 save', () => {
    seedRecords(1);
    const tampered = {
      ...initialGameState(),
      farmEvents: { ...EMPTY_FARM_EVENTS, pending: { eventId: 42 } },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: tampered }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.pending).toBeNull();
  });

  it('drops a contract with an unknown eventId on an otherwise valid v10 save', () => {
    seedRecords(1);
    const tampered = {
      ...initialGameState(),
      farmEvents: {
        ...EMPTY_FARM_EVENTS,
        contract: { eventId: 'nope', cropId: 'radish', quantity: 1, remaining: 1, deadlineDay: 5, reward: 10 },
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: tampered }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.contract).toBeNull();
  });

  it('drops an active effect carrying a bogus weatherId on an otherwise valid v10 save', () => {
    seedRecords(1);
    const tampered = {
      ...initialGameState(),
      farmEvents: {
        ...EMPTY_FARM_EVENTS,
        activeEffects: [{ kind: 'weather_pin', weatherId: 'nonsense', day: 3 }],
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: tampered }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.activeEffects).toEqual([]);
  });

  it('a persisted pending event survives the reload round-trip', () => {
    const withPending = {
      ...initialGameState(),
      farmEvents: {
        ...EMPTY_FARM_EVENTS, scheduleSeason: 1, scheduledDays: [8],
        pending: { eventId: 'traveling_merchant', firedDay: 8 }, seenIds: ['traveling_merchant'],
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: withPending }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.pending).toEqual({ eventId: 'traveling_merchant', firedDay: 8 });
  });

  it('a brand-new device (no save) starts its first run with events disabled', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.enabled).toBe(false);
  });
});
