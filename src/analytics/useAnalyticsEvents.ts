import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types';
import { getSeasonForDay } from '../engine/seasons';
import { track } from './track';
import { buildDayCompletedProps } from './events';

/** Fires all state-derived analytics events by diffing engine state across renders. */
export function useAnalyticsEvents(state: GameState, _endOfRunRecap: unknown): void {
  const prevRef = useRef<GameState | null>(null);

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
  }, [state]);
}
