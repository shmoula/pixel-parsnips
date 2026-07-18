import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types';
import { getSeasonForDay } from '../engine/seasons';
import { DEFAULT_ECONOMY } from '../engine/economy';
import { getNextPlotPrice } from '../engine/gameEngine';
import { deriveMedal } from '../engine/medals';
import { track } from './track';
import { buildDayCompletedProps, buildRunEndedProps, runOutcomeForPhase } from './events';
import type { SeasonOutcome } from './events';

/** Mutable holder for the once-per-run run_ended guard. */
interface RunEndedGuard {
  current: boolean;
}

/** day_completed — fire when a new daily log is produced. */
function detectDayCompleted(prev: GameState, state: GameState): void {
  if (state.lastDailyLog && state.lastDailyLog !== prev.lastDailyLog) {
    const log = state.lastDailyLog;
    const seasonNumber = getSeasonForDay(log.day).number;
    track('day_completed', buildDayCompletedProps(log, seasonNumber, state.phase));
  }
}

/**
 * plot_unlocked + first_plot_unlocked milestone — on an unlockedPlots increment.
 * Runs start at startingPlots (never 0), so the milestone's "first purchased
 * plot" is the startingPlots -> startingPlots + 1 transition.
 */
function detectPlotUnlocked(prev: GameState, state: GameState, firedMilestones: Set<string>): void {
  if (state.unlockedPlots <= prev.unlockedPlots) return;
  const price = getNextPlotPrice(prev) ?? 0;
  track('plot_unlocked', {
    unlocked_plots_after: state.unlockedPlots,
    price,
    coin_balance_after: state.coinBalance,
  });
  if (prev.unlockedPlots === DEFAULT_ECONOMY.startingPlots && !firedMilestones.has('first_plot_unlocked')) {
    firedMilestones.add('first_plot_unlocked');
    track('milestone_reached', {
      milestone: 'first_plot_unlocked',
      day: state.currentDay,
      season_number: getSeasonForDay(state.currentDay).number,
    });
  }
}

/** season_2_reached milestone — first time the derived season number reaches 2. */
function detectSeason2(prev: GameState, state: GameState, firedMilestones: Set<string>): void {
  const prevSeason = getSeasonForDay(prev.currentDay).number;
  const currSeason = getSeasonForDay(state.currentDay).number;
  if (prevSeason < 2 && currSeason >= 2 && !firedMilestones.has('season_2_reached')) {
    firedMilestones.add('season_2_reached');
    track('milestone_reached', {
      milestone: 'season_2_reached',
      day: state.currentDay,
      season_number: currSeason,
    });
  }
}

/** season_completed — on entering any season-resolution phase. */
function detectSeasonCompleted(prev: GameState, state: GameState): void {
  const seasonPhases: SeasonOutcome[] = ['season_passed', 'season_failed', 'season_4_won'];
  if (state.phase !== prev.phase && seasonPhases.includes(state.phase as SeasonOutcome)) {
    track('season_completed', {
      season_number: getSeasonForDay(state.currentDay).number,
      outcome: state.phase as SeasonOutcome,
      coin_balance: state.coinBalance,
      days_played: state.currentDay,
    });
  }
}

/**
 * New-run reset followed by run_ended. A fresh initialGameState (day 1, playing,
 * from a non-day-1 prev) resets the per-run guards; then run_ended fires once on
 * the first transition into a terminal phase. The reset MUST run before the
 * run_ended check within the same pass.
 */
function detectRunLifecycle(
  prev: GameState,
  state: GameState,
  firedMilestones: Set<string>,
  runEndedFired: RunEndedGuard,
): void {
  // New-run reset — a fresh initialGameState (day 1, playing) starts a new run.
  if (state.phase === 'playing' && state.currentDay === 1 && prev.currentDay !== 1) {
    firedMilestones.clear();
    runEndedFired.current = false;
  }

  // run_ended — first transition into a terminal phase this run.
  const outcome = runOutcomeForPhase(state.phase);
  const isEndlessWin = state.phase === 'season_4_won' && state.endlessMode;
  if (outcome !== null && !isEndlessWin && state.phase !== prev.phase && !runEndedFired.current) {
    runEndedFired.current = true;
    const seasonReached = getSeasonForDay(state.currentDay).number;
    const won = outcome === 'won';
    track('run_ended', buildRunEndedProps(state, outcome, seasonReached, deriveMedal(seasonReached, won)));
  }
}

/** Fires all state-derived analytics events by diffing engine state across renders. */
export function useAnalyticsEvents(state: GameState, _endOfRunRecap: unknown): void {
  const prevRef = useRef<GameState | null>(null);
  const firedMilestonesRef = useRef<Set<string>>(new Set());
  const runEndedFiredRef = useRef<RunEndedGuard>({ current: false });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (prev === null) return;

    detectDayCompleted(prev, state);
    detectPlotUnlocked(prev, state, firedMilestonesRef.current);
    detectSeason2(prev, state, firedMilestonesRef.current);
    detectSeasonCompleted(prev, state);
    detectRunLifecycle(prev, state, firedMilestonesRef.current, runEndedFiredRef.current);
  }, [state]);
}
