import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({ track }));

import { useAnalyticsEvents } from '../../src/analytics/useAnalyticsEvents';
import { initialGameState } from '../../src/engine/gameEngine';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 8,
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
    pestPlotsAtRisk: 0,
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 0,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    buildingsApplied: [],
    ...over,
  };
}

beforeEach(() => track.mockClear());

describe('useAnalyticsEvents farm_event_fired', () => {
  it('fires once when pending transitions null -> set', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const fired: GameState = {
      ...base,
      currentDay: 8,
      farmEvents: { ...base.farmEvents, pending: { eventId: 'millers_order', firedDay: 8 } },
    };
    rerender({ state: fired });

    const calls = track.mock.calls.filter(([n]) => n === 'farm_event_fired');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ event_id: 'millers_order', season: 1, day: 8 });

    // Re-rendering with the same pending object must not re-fire.
    rerender({ state: fired });
    expect(track.mock.calls.filter(([n]) => n === 'farm_event_fired')).toHaveLength(1);
  });
});

describe('useAnalyticsEvents farm_event_choice', () => {
  it('fires when lastResolved changes', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const resolved: GameState = {
      ...base,
      currentDay: 8,
      farmEvents: {
        ...base.farmEvents,
        lastResolved: { eventId: 'millers_order', choice: 'B', day: 8, auto: false },
      },
    };
    rerender({ state: resolved });

    const calls = track.mock.calls.filter(([n]) => n === 'farm_event_choice');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ event_id: 'millers_order', choice: 'B', auto: false, day: 8 });

    rerender({ state: resolved });
    expect(track.mock.calls.filter(([n]) => n === 'farm_event_choice')).toHaveLength(1);
  });
});

describe('useAnalyticsEvents contract_completed', () => {
  it('fires when a new lastDailyLog carries contractCompleted', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const next: GameState = {
      ...base,
      currentDay: 9,
      lastDailyLog: makeLog({ contractCompleted: { eventId: 'millers_order', reward: 120 } }),
    };
    rerender({ state: next });

    const calls = track.mock.calls.filter(([n]) => n === 'contract_completed');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ event_id: 'millers_order', reward: 120 });
  });
});

describe('useAnalyticsEvents contract_expired', () => {
  it('fires when a new lastDailyLog carries contractExpired', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const next: GameState = {
      ...base,
      currentDay: 9,
      lastDailyLog: makeLog({ contractExpired: 'millers_order' }),
    };
    rerender({ state: next });

    const calls = track.mock.calls.filter(([n]) => n === 'contract_expired');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ event_id: 'millers_order' });
  });
});

describe('useAnalyticsEvents farm-event detectors stay silent on unrelated changes', () => {
  it('does not fire any farm-event/contract events when advancing a quiet day', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    track.mockClear();

    const quietNext: GameState = { ...base, currentDay: 2, lastDailyLog: makeLog({ day: 1 }) };
    rerender({ state: quietNext });

    expect(track.mock.calls.filter(([n]) => n === 'farm_event_fired')).toHaveLength(0);
    expect(track.mock.calls.filter(([n]) => n === 'farm_event_choice')).toHaveLength(0);
    expect(track.mock.calls.filter(([n]) => n === 'contract_completed')).toHaveLength(0);
    expect(track.mock.calls.filter(([n]) => n === 'contract_expired')).toHaveLength(0);
  });
});
