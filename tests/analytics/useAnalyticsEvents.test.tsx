import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({ track }));

import { useAnalyticsEvents } from '../../src/analytics/useAnalyticsEvents';
import { buyPlot, initialGameState } from '../../src/engine/gameEngine';
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
    buildingsApplied: [],
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
  // Real play never sees unlockedPlots === 0: initialGameState() starts at
  // startingPlots, so the first *purchase* is the startingPlots -> +1 transition.
  function buyPlotOrThrow(state: GameState): GameState {
    const result = buyPlot(state);
    if (!result.ok) throw new Error(`buyPlot failed: ${result.error}`);
    return result.state;
  }

  it('fires plot_unlocked with the paid price when a plot is bought', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const after = buyPlotOrThrow(base);
    rerender({ state: after });

    const plotCall = track.mock.calls.find(([n]) => n === 'plot_unlocked');
    expect(plotCall).toBeTruthy();
    expect(plotCall![1]).toMatchObject({
      unlocked_plots_after: base.unlockedPlots + 1,
      price: base.coinBalance - after.coinBalance,
      coin_balance_after: after.coinBalance,
    });
  });

  it('fires the first_plot_unlocked milestone exactly once, on the first purchase of a run', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const afterFirst = buyPlotOrThrow(base);
    rerender({ state: afterFirst });
    const afterSecond = buyPlotOrThrow(afterFirst);
    rerender({ state: afterSecond });

    const milestoneCalls = track.mock.calls.filter(
      ([n, p]) => n === 'milestone_reached' && p.milestone === 'first_plot_unlocked',
    );
    expect(milestoneCalls).toHaveLength(1);
    expect(milestoneCalls[0][1]).toMatchObject({
      milestone: 'first_plot_unlocked',
      day: 1,
      season_number: 1,
    });
    expect(track.mock.calls.filter(([n]) => n === 'plot_unlocked')).toHaveLength(2);
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

describe('useAnalyticsEvents season_completed', () => {
  it('fires on entering a season-resolution phase', () => {
    const playing = { ...initialGameState(), currentDay: 7, phase: 'playing' } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: playing },
    });
    track.mockClear();

    rerender({ state: { ...playing, phase: 'season_passed' } });

    const call = track.mock.calls.find(([n]) => n === 'season_completed');
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ outcome: 'season_passed', days_played: 7 });
  });
});

describe('useAnalyticsEvents run_ended', () => {
  function playingOnDay(day: number): GameState {
    return { ...initialGameState(), currentDay: day, phase: 'playing' } as GameState;
  }

  it('fires once on bankruptcy', () => {
    const s = playingOnDay(12);
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: s },
    });
    track.mockClear();
    rerender({ state: { ...s, phase: 'bankrupt' } });
    rerender({ state: { ...s, phase: 'bankrupt', coinBalance: -5 } });
    const calls = track.mock.calls.filter(([n]) => n === 'run_ended');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ outcome: 'bankrupt', days_played: 12 });
  });

  it('fires on season_failed (the gap the recordRunEnd effect misses)', () => {
    const s = playingOnDay(20);
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: s },
    });
    track.mockClear();
    rerender({ state: { ...s, phase: 'season_failed' } });
    const call = track.mock.calls.find(([n]) => n === 'run_ended');
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ outcome: 'season_failed' });
  });

  it('resets per-run guards when a fresh run begins', () => {
    const bankrupt = { ...initialGameState(), currentDay: 12, phase: 'bankrupt' } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: bankrupt },
    });
    track.mockClear();
    // restart() produces a fresh initialGameState (day 1, playing).
    rerender({ state: initialGameState() as GameState });
    // A second bankruptcy in the new run must fire run_ended again.
    const secondRun = { ...initialGameState(), currentDay: 9, phase: 'bankrupt' } as GameState;
    rerender({ state: secondRun });
    const calls = track.mock.calls.filter(([n]) => n === 'run_ended');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ days_played: 9 });
  });
});
