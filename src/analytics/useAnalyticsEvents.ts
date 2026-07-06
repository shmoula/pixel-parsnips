import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types';
import { getSeasonForDay } from '../engine/seasons';
import { getNextPlotPrice } from '../engine/gameEngine';
import { track } from './track';
import { buildDayCompletedProps } from './events';

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
  }, [state]);
}
