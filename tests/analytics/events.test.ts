import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCHEMA_VERSION,
  EVENT_VERSIONS,
  buildDayCompletedProps,
  buildRunEndedProps,
  runOutcomeForPhase,
} from '../../src/analytics/events';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { DailyLogEntry, GameState, RunDayRecord } from '../../src/engine/types';

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
    pestPlotsAtRisk: 0,
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

  it('versions the 020 onboarding-funnel events', () => {
    expect(EVENT_VERSIONS.onboarding_step_reached).toBe(1);
    expect(EVENT_VERSIONS.onboarding_completed).toBe(1);
    expect(EVENT_VERSIONS.onboarding_skipped).toBe(1);
    expect(EVENT_VERSIONS.onboarding_replay_requested).toBe(1);
    expect(EVENT_VERSIONS.empty_day_safeguard).toBe(1);
  });

  it('versions the 023 enriched events', () => {
    expect(EVENT_VERSIONS.day_completed).toBe(2);
    expect(EVENT_VERSIONS.plot_unlocked).toBe(2);
  });

  it('declares credits_viewed at version 1', () => {
    expect(EVENT_VERSIONS.credits_viewed).toBe(1);
  });

  it('bumps run_ended to 2 for the F9 death-cause property', () => {
    expect(EVENT_VERSIONS.run_ended).toBe(2);
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
      streak_after: 1,
      streak_bonus: 0,
      pest_destroyed_count: 0,
      pest_plots_at_risk: 0,
      flash_drought_days_after: 0,
      market_event_kind: null,
      market_crop_id: null,
      buildings_applied: [],
      event_buff_count: 0,
      contract_active: false,
    });
  });

  it('surfaces disaster, market, building and 022 system state', () => {
    const props = buildDayCompletedProps(
      makeLog({
        pestDestroyedPlots: [0, 3],
        pestPlotsAtRisk: 4,
        flashDroughtDaysAfter: 2,
        streakAfter: 3,
        streakBonus: 15,
        marketActive: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.5, daysRemaining: 2 },
        buildingsApplied: ['irrigation_well'],
        eventBuffsApplied: [{ eventId: 'bountiful_spring', multiplier: 1.25, harvestsAffected: 2 }],
        contractProgress: { cropId: 'radish', done: 1, total: 3, deadlineDay: 9 },
      }),
      2,
      'playing',
    );
    expect(props).toMatchObject({
      pest_destroyed_count: 2,
      pest_plots_at_risk: 4,
      flash_drought_days_after: 2,
      streak_after: 3,
      streak_bonus: 15,
      market_event_kind: 'shortage',
      market_crop_id: 'pumpkin',
      buildings_applied: ['irrigation_well'],
      event_buff_count: 1,
      contract_active: true,
    });
  });

  it('treats absent optional 022 fields as empty rather than undefined', () => {
    const props = buildDayCompletedProps(makeLog({ eventBuffsApplied: undefined, contractProgress: undefined }), 1, 'playing');
    expect(props.event_buff_count).toBe(0);
    expect(props.contract_active).toBe(false);
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
      death_cause: null,
    });
  });

  it('carries the death cause when the run went bankrupt (F9)', () => {
    // Tax at half of gross income clears TAXMAN_SHARE (0.25) outright.
    const history: RunDayRecord[] = [
      { day: 1, closingBalance: 40, taxDeducted: 50, harvestIncome: 100, unlockedPlots: 4, buildingCount: 0 },
    ];
    const state: GameState = { ...initialGameState(DEFAULT_ECONOMY), runHistory: history };

    const props = buildRunEndedProps(state, 'bankrupt', 1, 'none');

    expect(props.death_cause).toBe('fed_the_taxman');
  });

  it('leaves the death cause null for runs that did not go bankrupt (F9)', () => {
    const history: RunDayRecord[] = [
      { day: 1, closingBalance: 40, taxDeducted: 50, harvestIncome: 100, unlockedPlots: 4, buildingCount: 0 },
    ];
    const state: GameState = { ...initialGameState(DEFAULT_ECONOMY), runHistory: history };

    // The same state that would derive `fed_the_taxman` reports nothing when the
    // run did not end in bankruptcy — the cause is only meaningful on that screen.
    expect(buildRunEndedProps(state, 'season_failed', 2, 'none').death_cause).toBeNull();
    expect(buildRunEndedProps(state, 'won', 4, 'gold').death_cause).toBeNull();
  });
});
