import { lazy } from 'react';

/**
 * Late-appearing overlays, code-split out of the initial entry bundle.
 *
 * None of these render on first paint — they surface only after a full day is
 * played (DaySummaryModal), at end of season (SeasonTransitionModal), on a
 * run-2+ event day (FarmEventModal), or at terminal bankruptcy
 * (BankruptcyScreen). Loading them lazily keeps ~40 KB off the critical-path JS
 * payload the CI bundle gate measures, and off first-paint / TTI in the browser.
 *
 * `prefetchLateModals()` warms these chunks during idle time after first paint
 * so opening one never shows a Suspense fallback flash — they're deferred, not
 * merely hidden behind a spinner.
 */

export const BankruptcyScreen = lazy(() =>
  import('./BankruptcyScreen').then((m) => ({ default: m.BankruptcyScreen })),
);

export const SeasonTransitionModal = lazy(() =>
  import('./SeasonTransitionModal').then((m) => ({ default: m.SeasonTransitionModal })),
);

export const DaySummaryModal = lazy(() =>
  import('./DaySummaryModal').then((m) => ({ default: m.DaySummaryModal })),
);

export const FarmEventModal = lazy(() =>
  import('./FarmEventModal').then((m) => ({ default: m.FarmEventModal })),
);

/** Warm the deferred modal chunks during idle time after first paint. */
export function prefetchLateModals(): void {
  const warm = () => {
    void import('./BankruptcyScreen');
    void import('./SeasonTransitionModal');
    void import('./DaySummaryModal');
    void import('./FarmEventModal');
  };
  const ric = (globalThis as {
    requestIdleCallback?: (cb: () => void) => void;
  }).requestIdleCallback;
  if (ric) ric(warm);
  else setTimeout(warm, 1500);
}
