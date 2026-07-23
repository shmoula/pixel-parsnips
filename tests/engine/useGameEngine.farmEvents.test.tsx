import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { EMPTY_FARM_EVENTS } from '../../src/engine/farmEvents';
import { RECORDS_KEY, type PersonalBests } from '../../src/engine/records';

const STORAGE_KEY = 'pixel-parsnips-state';

function seedRecords(totalRunsCompleted: number): void {
  const records: PersonalBests = {
    schemaVersion: 2,
    bestDaysSurvived: 0,
    bestPeakBalance: 0,
    bestSeasonReached: 0,
    mostDisastersSurvived: 0,
    bestHarvestStreak: 0,
    totalRunsCompleted,
  };
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function seedPendingSave(): void {
  const state = {
    ...initialGameState(),
    currentDay: 8,
    farmEvents: {
      ...EMPTY_FARM_EVENTS, scheduleSeason: 1, scheduledDays: [8],
      pending: { eventId: 'millers_order', firedDay: 8 }, seenIds: ['millers_order'],
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state }));
}

describe('useGameEngine × farm events', () => {
  beforeEach(() => localStorage.clear());

  it('exposes the pending event view with the catalog definition', () => {
    seedPendingSave();
    const { result } = renderHook(() => useGameEngine());
    const view = result.current.getPendingFarmEvent();
    expect(view?.def.id).toBe('millers_order');
    expect(view?.balance).toBe(result.current.state.coinBalance);
  });

  it('resolveFarmEvent applies the choice and clears pending', () => {
    seedPendingSave();
    const { result } = renderHook(() => useGameEngine());
    const before = result.current.state.coinBalance;
    let ok = false;
    act(() => { ok = result.current.resolveFarmEvent('B'); });
    expect(ok).toBe(true);
    expect(result.current.state.farmEvents.pending).toBeNull();
    expect(result.current.state.coinBalance).toBe(before + 12);
  });

  it('resolveFarmEvent returns false when nothing is pending', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = true;
    act(() => { ok = result.current.resolveFarmEvent('A'); });
    expect(ok).toBe(false);
  });

  // Regression test: isNew must be derived fresh from records on every call to
  // getPendingFarmEvent(), NOT frozen at GameBoard mount — a run restart
  // (endRunVictory/restart) commits fresh state in place without remounting
  // GameBoard, so a mount-time snapshot would never reflect the second run.
  it('isNew reflects the current totalRunsCompleted on every call, not a frozen snapshot', () => {
    seedPendingSave();
    seedRecords(1); // player's second run — the feature just unlocked
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.getPendingFarmEvent()?.isNew).toBe(true);

    seedRecords(2); // a later run — no longer new
    expect(result.current.getPendingFarmEvent()?.isNew).toBe(false);
  });
});
