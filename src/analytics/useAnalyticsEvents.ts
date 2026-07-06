import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types';
import { getSeasonForDay } from '../engine/seasons';
import { getNextPlotPrice } from '../engine/gameEngine';
import { track } from './track';
import { buildDayCompletedProps } from './events';
import type { SeasonOutcome } from './events';

/** Fires all state-derived analytics events by diffing engine state across renders. */
export function useAnalyticsEvents(state: GameState, _endOfRunRecap: unknown): void {
  const prevRef = useRef<GameState | null>(null);
  const firedMilestonesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (prev === null) return;

    // day_completed — fire when a new daily log is produced.
    if (state.lastDailyLog && state.lastDailyLog !== prev.lastDailyLog) {
      const log = state.lastDailyLog;
      const seasonNumber = getSeasonForDay(log.day).number;
      track('day_completed', buildDayCompletedProps(log, seasonNumber, state.phase));
    }

    // plot_unlocked + first_plot_unlocked milestone — on an unlockedPlots increment.
    if (state.unlockedPlots > prev.unlockedPlots) {
      const price = getNextPlotPrice(prev) ?? 0;
      track('plot_unlocked', {
        unlocked_plots_after: state.unlockedPlots,
        price,
        coin_balance_after: state.coinBalance,
      });
      if (prev.unlockedPlots === 0 && !firedMilestonesRef.current.has('first_plot_unlocked')) {
        firedMilestonesRef.current.add('first_plot_unlocked');
        track('milestone_reached', {
          milestone: 'first_plot_unlocked',
          day: state.currentDay,
          season_number: getSeasonForDay(state.currentDay).number,
        });
      }
    }

    // season_2_reached milestone — first time the derived season number reaches 2.
    const prevSeason = getSeasonForDay(prev.currentDay).number;
    const currSeason = getSeasonForDay(state.currentDay).number;
    if (
      prevSeason < 2 &&
      currSeason >= 2 &&
      !firedMilestonesRef.current.has('season_2_reached')
    ) {
      firedMilestonesRef.current.add('season_2_reached');
      track('milestone_reached', {
        milestone: 'season_2_reached',
        day: state.currentDay,
        season_number: currSeason,
      });
    }

    // season_completed — on entering any season-resolution phase.
    const seasonPhases: SeasonOutcome[] = ['season_passed', 'season_failed', 'season_4_won'];
    if (state.phase !== prev.phase && seasonPhases.includes(state.phase as SeasonOutcome)) {
      track('season_completed', {
        season_number: getSeasonForDay(state.currentDay).number,
        outcome: state.phase as SeasonOutcome,
        coin_balance: state.coinBalance,
        days_played: state.currentDay,
      });
    }
  }, [state]);
}
