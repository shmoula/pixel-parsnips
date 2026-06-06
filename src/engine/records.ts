import type { GameState } from './types';
import { getSeasonForDay } from './seasons';

export const RECORDS_KEY = 'pixel-parsnips-records';

export interface PersonalBests {
  schemaVersion: 2;
  bestDaysSurvived: number;
  bestPeakBalance: number;
  bestSeasonReached: number;
  mostDisastersSurvived: number;
  bestHarvestStreak: number;
  totalRunsCompleted: number;
}

const ZERO_RECORDS: PersonalBests = {
  schemaVersion: 2,
  bestDaysSurvived: 0,
  bestPeakBalance: 0,
  bestSeasonReached: 0,
  mostDisastersSurvived: 0,
  bestHarvestStreak: 0,
  totalRunsCompleted: 0,
};

/** Returns zero defaults when missing or malformed; never throws. */
export function loadRecords(): PersonalBests {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...ZERO_RECORDS };
    const parsed = JSON.parse(raw) as Partial<PersonalBests>;
    return {
      schemaVersion: 2,
      bestDaysSurvived: typeof parsed.bestDaysSurvived === 'number' ? parsed.bestDaysSurvived : 0,
      bestPeakBalance: typeof parsed.bestPeakBalance === 'number' ? parsed.bestPeakBalance : 0,
      bestSeasonReached: typeof parsed.bestSeasonReached === 'number' ? parsed.bestSeasonReached : 0,
      mostDisastersSurvived:
        typeof parsed.mostDisastersSurvived === 'number' ? parsed.mostDisastersSurvived : 0,
      bestHarvestStreak: typeof parsed.bestHarvestStreak === 'number' ? parsed.bestHarvestStreak : 0,
      totalRunsCompleted: typeof parsed.totalRunsCompleted === 'number' ? parsed.totalRunsCompleted : 0,
    };
  } catch {
    return { ...ZERO_RECORDS };
  }
}

function saveRecords(r: PersonalBests): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    // Storage full or disabled — non-fatal; records simply won't persist.
  }
}

/**
 * Called exactly once per run, on the first terminal-phase transition.
 * Loads current records, computes new maxes, persists, and reports which
 * stats beat their prior record.
 */
export function recordRunEnd(state: GameState): {
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
} {
  const prior = loadRecords();
  const seasonReached = getSeasonForDay(state.currentDay).number;

  const candidates = {
    bestDaysSurvived: state.currentDay,
    bestPeakBalance: state.peakBalance,
    bestSeasonReached: seasonReached,
    mostDisastersSurvived: state.disastersSurvived,
    bestHarvestStreak: state.peakHarvestStreak,
  } as const;

  const newBests = new Set<keyof PersonalBests>();
  const next: PersonalBests = {
    schemaVersion: 2,
    bestDaysSurvived: Math.max(prior.bestDaysSurvived, candidates.bestDaysSurvived),
    bestPeakBalance: Math.max(prior.bestPeakBalance, candidates.bestPeakBalance),
    bestSeasonReached: Math.max(prior.bestSeasonReached, candidates.bestSeasonReached),
    mostDisastersSurvived: Math.max(prior.mostDisastersSurvived, candidates.mostDisastersSurvived),
    bestHarvestStreak: Math.max(prior.bestHarvestStreak, candidates.bestHarvestStreak),
    totalRunsCompleted: prior.totalRunsCompleted + 1,
  };

  for (const key of [
    'bestDaysSurvived',
    'bestPeakBalance',
    'bestSeasonReached',
    'mostDisastersSurvived',
    'bestHarvestStreak',
  ] as const) {
    if (candidates[key] > prior[key]) newBests.add(key);
  }

  saveRecords(next);
  return { records: next, newBests };
}
