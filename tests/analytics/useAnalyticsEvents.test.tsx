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

describe('useAnalyticsEvents plot_unlocked + first-plot milestone', () => {
  it('fires plot_unlocked with the paid price and the first-plot milestone once', () => {
    const base = { ...initialGameState(), unlockedPlots: 0, currentDay: 4 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();

    const after: GameState = { ...base, unlockedPlots: 1 };
    rerender({ state: after });

    const plotCall = track.mock.calls.find(([n]) => n === 'plot_unlocked');
    expect(plotCall).toBeTruthy();
    expect(plotCall![1]).toMatchObject({
      unlocked_plots_after: 1,
      coin_balance_after: after.coinBalance,
    });
    expect(typeof plotCall![1].price).toBe('number');

    const milestoneCall = track.mock.calls.find(
      ([n, p]) => n === 'milestone_reached' && p.milestone === 'first_plot_unlocked',
    );
    expect(milestoneCall).toBeTruthy();
    expect(milestoneCall![1]).toMatchObject({ milestone: 'first_plot_unlocked', day: 4 });
  });
});

describe('useAnalyticsEvents season_2 milestone', () => {
  it('fires season_2_reached once when the derived season first hits 2', () => {
    // Season 1 is days 1-20; day 21 is season 2 (see engine/seasons SEASON_TABLE).
    const s1 = { ...initialGameState(), currentDay: 18 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: s1 },
    });
    track.mockClear();

    rerender({ state: { ...s1, currentDay: 21 } });
    rerender({ state: { ...s1, currentDay: 22 } });

    const calls = track.mock.calls.filter(
      ([n, p]) => n === 'milestone_reached' && p.milestone === 'season_2_reached',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ season_number: 2 });
  });
});
