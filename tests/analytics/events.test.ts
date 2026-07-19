import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCHEMA_VERSION,
  EVENT_VERSIONS,
  buildDayCompletedProps,
  buildRunEndedProps,
  runOutcomeForPhase,
} from '../../src/analytics/events';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 3,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests: [{ cropId: 'radish', baseYield: 4, weatherMultiplier: 1, adjustedYield: 4 }],
    totalHarvestIncome: 12,
    openingBalance: 100,
    landLeaseDeducted: 5,
    taxRate: 0.06,
    taxDeducted: 7,
    netChange: 0,
    closingBalance: 100,
    exhaustedPlots: [2],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 1,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    buildingsApplied: [],
    ...over,
  };
}

describe('events schema', () => {
  it('exposes a schema version and a version per event', () => {
    expect(ANALYTICS_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(EVENT_VERSIONS.day_completed).toBeGreaterThanOrEqual(1);
    expect(EVENT_VERSIONS.run_ended).toBeGreaterThanOrEqual(1);
  });
});

describe('buildDayCompletedProps', () => {
  it('maps DailyLogEntry fields to snake_case counts', () => {
    const props = buildDayCompletedProps(makeLog(), 1, 'playing');
    expect(props).toEqual({
      day: 3,
      season_number: 1,
      weather_id: 'sunny',
      harvest_count: 1,
      net_change: 0,
      tax_deducted: 7,
      lease_deducted: 5,
      exhausted_plot_count: 1,
      phase_after: 'playing',
    });
  });
});

describe('runOutcomeForPhase', () => {
  it('maps terminal phases to outcome labels', () => {
    expect(runOutcomeForPhase('bankrupt')).toBe('bankrupt');
    expect(runOutcomeForPhase('season_failed')).toBe('season_failed');
    expect(runOutcomeForPhase('season_4_won')).toBe('won');
  });
});

describe('buildRunEndedProps', () => {
  it('assembles run summary props from state', () => {
    const state = {
      currentDay: 40,
      peakBalance: 320,
      disastersSurvived: 2,
      peakHarvestStreak: 5,
    } as unknown as GameState;
    const props = buildRunEndedProps(state, 'won', 4, 'gold');
    expect(props).toEqual({
      outcome: 'won',
      days_played: 40,
      season_reached: 4,
      peak_balance: 320,
      disasters_survived: 2,
      peak_harvest_streak: 5,
      medal: 'gold',
    });
  });
});
