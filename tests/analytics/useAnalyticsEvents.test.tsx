import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({ track }));

import { useAnalyticsEvents } from '../../src/analytics/useAnalyticsEvents';
import { initialGameState } from '../../src/engine/gameEngine';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

function makeLog(day: number): DailyLogEntry {
  return {
    day,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests: [],
    totalHarvestIncome: 0,
    openingBalance: 100,
    landLeaseDeducted: 5,
    taxRate: 0.06,
    taxDeducted: 6,
    netChange: -11,
    closingBalance: 89,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 0,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
  };
}

beforeEach(() => track.mockClear());

describe('useAnalyticsEvents day_completed', () => {
  it('fires when lastDailyLog changes to a new entry', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    expect(track).not.toHaveBeenCalledWith('day_completed', expect.anything());

    const next: GameState = { ...base, currentDay: 2, lastDailyLog: makeLog(1) };
    rerender({ state: next });

    expect(track).toHaveBeenCalledWith(
      'day_completed',
      expect.objectContaining({ day: 1, harvest_count: 0, tax_deducted: 6, phase_after: 'playing' }),
    );
  });

  it('does not re-fire when state changes but the log is unchanged', () => {
    const base = { ...initialGameState(), lastDailyLog: makeLog(1) } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();
    rerender({ state: { ...base, coinBalance: base.coinBalance + 1 } });
    expect(track).not.toHaveBeenCalledWith('day_completed', expect.anything());
  });
});
