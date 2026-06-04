import { describe, it, expect, beforeEach } from 'vitest';
import { loadRecords, recordRunEnd, RECORDS_KEY, type PersonalBests } from '../../src/engine/records';
import { initialGameState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

function freshState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialGameState(), ...overrides };
}

describe('loadRecords', () => {
  beforeEach(() => localStorage.clear());

  it('returns zero defaults when no key exists', () => {
    const r = loadRecords();
    expect(r.schemaVersion).toBe(1);
    expect(r.bestDaysSurvived).toBe(0);
    expect(r.bestPeakBalance).toBe(0);
    expect(r.bestSeasonReached).toBe(0);
    expect(r.mostDisastersSurvived).toBe(0);
    expect(r.totalRunsCompleted).toBe(0);
  });

  it('returns zero defaults when JSON is malformed', () => {
    localStorage.setItem(RECORDS_KEY, '{not json');
    const r = loadRecords();
    expect(r.totalRunsCompleted).toBe(0);
  });

  it('round-trips a valid record', () => {
    const written: PersonalBests = {
      schemaVersion: 1,
      bestDaysSurvived: 32,
      bestPeakBalance: 410,
      bestSeasonReached: 3,
      mostDisastersSurvived: 5,
      totalRunsCompleted: 4,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(written));
    expect(loadRecords()).toEqual(written);
  });
});

describe('recordRunEnd', () => {
  beforeEach(() => localStorage.clear());

  it('on the first run ever, every stat becomes a new best and totalRunsCompleted = 1', () => {
    const state = freshState({ currentDay: 25, peakBalance: 180, disastersSurvived: 2, phase: 'bankrupt' });
    const { records, newBests } = recordRunEnd(state);

    expect(records.totalRunsCompleted).toBe(1);
    expect(records.bestDaysSurvived).toBe(25);
    expect(records.bestPeakBalance).toBe(180);
    expect(records.bestSeasonReached).toBe(2); // Day 25 is Season 2
    expect(records.mostDisastersSurvived).toBe(2);

    expect(newBests.has('bestDaysSurvived')).toBe(true);
    expect(newBests.has('bestPeakBalance')).toBe(true);
    expect(newBests.has('bestSeasonReached')).toBe(true);
    expect(newBests.has('mostDisastersSurvived')).toBe(true);
  });

  it('writes the record back to localStorage', () => {
    const state = freshState({ currentDay: 25, peakBalance: 180, disastersSurvived: 2, phase: 'bankrupt' });
    recordRunEnd(state);
    const raw = localStorage.getItem(RECORDS_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as PersonalBests;
    expect(parsed.bestDaysSurvived).toBe(25);
  });

  it('keeps prior bests when the new run is worse on every dimension', () => {
    const prior: PersonalBests = {
      schemaVersion: 1,
      bestDaysSurvived: 40,
      bestPeakBalance: 300,
      bestSeasonReached: 3,
      mostDisastersSurvived: 6,
      totalRunsCompleted: 2,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(prior));

    const state = freshState({ currentDay: 18, peakBalance: 90, disastersSurvived: 1, phase: 'bankrupt' });
    const { records, newBests } = recordRunEnd(state);

    expect(records.bestDaysSurvived).toBe(40);
    expect(records.bestPeakBalance).toBe(300);
    expect(records.bestSeasonReached).toBe(3);
    expect(records.mostDisastersSurvived).toBe(6);
    expect(records.totalRunsCompleted).toBe(3); // always increments
    expect(newBests.size).toBe(0);
  });

  it('flags exactly the stats the new run beat', () => {
    const prior: PersonalBests = {
      schemaVersion: 1,
      bestDaysSurvived: 20,
      bestPeakBalance: 500,
      bestSeasonReached: 2,
      mostDisastersSurvived: 3,
      totalRunsCompleted: 1,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(prior));

    const state = freshState({ currentDay: 35, peakBalance: 600, disastersSurvived: 4, phase: 'bankrupt' });
    const { records, newBests } = recordRunEnd(state);

    expect(newBests.has('bestDaysSurvived')).toBe(true);
    expect(newBests.has('bestPeakBalance')).toBe(true);
    expect(newBests.has('bestSeasonReached')).toBe(false);
    expect(newBests.has('mostDisastersSurvived')).toBe(true);
    expect(records.bestSeasonReached).toBe(2);
  });

  it('treats a Season 4 win as season 4 + sets victory implicitly via phase', () => {
    const state = freshState({
      currentDay: 80, peakBalance: 700, disastersSurvived: 5,
      phase: 'season_4_won', endlessMode: false,
    });
    const { records } = recordRunEnd(state);
    expect(records.bestSeasonReached).toBe(4);
  });

  it('handles endless-mode bankruptcy by recording the endless season number', () => {
    const state = freshState({
      currentDay: 95, peakBalance: 900, disastersSurvived: 7,
      phase: 'bankrupt', endlessMode: true,
    });
    const { records } = recordRunEnd(state);
    expect(records.bestSeasonReached).toBe(5);
  });
});
