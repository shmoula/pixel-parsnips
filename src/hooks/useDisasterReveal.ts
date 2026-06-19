import { useEffect, useState } from 'react';
import type { DailyLogEntry } from '../engine/types';
import { DISASTER_WEATHER_IDS } from '../components/DailyLog';
import { useReducedMotion } from './useReducedMotion';

const REVEAL_DELAY_MS = 700;

export interface DisasterReveal {
  /** Whether disaster chrome (red bg + "Disaster!" badge + DisasterBanner) should show now. */
  showDisasterChrome: boolean;
  /** True while a disaster is still pending its staged reveal — used to keep DailyLog's
      weather badge neutral so the disaster isn't spoiled early. */
  suppressDisasterStyling: boolean;
  /** Whether the banner's drop-in/pulse animation should play. */
  animate: boolean;
}

/**
 * Drives the staged "dread-then-hit" disaster reveal for the Day Summary modal.
 * On a fresh disaster open with motion allowed it holds the disaster chrome back for
 * REVEAL_DELAY_MS, then drops it in. On reopen (animateReveal=false) or reduced motion
 * it reveals immediately. The modal is mounted fresh per open, so state starts clean
 * each time — a mid-open preference flip is intentionally not re-synced.
 */
export function useDisasterReveal(log: DailyLogEntry, animateReveal: boolean): DisasterReveal {
  const reducedMotion = useReducedMotion();
  const isDisaster = DISASTER_WEATHER_IDS.has(log.weatherId);
  const shouldStage = isDisaster && animateReveal && !reducedMotion;
  const [revealed, setRevealed] = useState(!shouldStage);

  useEffect(() => {
    if (!shouldStage) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [shouldStage]);

  return {
    showDisasterChrome: isDisaster && revealed,
    suppressDisasterStyling: isDisaster && !revealed,
    animate: animateReveal && !reducedMotion,
  };
}
