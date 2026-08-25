import type { DailyLogEntry, RunDayRecord } from './types';

/** Below this many recorded days a run has no pattern worth naming, and the
 *  post-mortem falls back to generic advice. A player who died on day 2 was not
 *  hoarding; they were unlucky or new. */
export const MIN_HISTORY_FOR_EVIDENCE = 5;

/** Fraction of the run's peak balance that counts as "holding". */
const HOARD_PEAK_FRACTION = 0.75;

function hoardThreshold(history: readonly RunDayRecord[]): number {
  const peak = Math.max(...history.map(r => r.closingBalance));
  return peak * HOARD_PEAK_FRACTION;
}

interface HoardWindow { start: number; end: number; min: number; tax: number }

/** Longest consecutive stretch of days at or above the threshold. */
// Assumes one record per consecutive day: contiguity is detected by array adjacency, while the window span is read from r.day.
function longestHoardWindow(history: readonly RunDayRecord[], threshold: number): HoardWindow | null {
  let best: HoardWindow | null = null;
  let run: RunDayRecord[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const candidate: HoardWindow = {
      start: run[0].day,
      end: run[run.length - 1].day,
      min: Math.min(...run.map(r => r.closingBalance)),
      tax: run.reduce((sum, r) => sum + r.taxDeducted, 0),
    };
    const bestLen = best ? best.end - best.start : -1;
    if (candidate.end - candidate.start > bestLen) best = candidate;
    run = [];
  };

  for (const r of history) {
    if (r.closingBalance >= threshold) run.push(r);
    else flush();
  }
  flush();
  return best;
}

/**
 * 025 — the evidence line that replaces generic advice on the bankruptcy screen.
 *
 * Quotes the MINIMUM balance across the window, not the peak or the mean: it is the
 * strongest claim the data actually supports, and an invented average would be
 * precision the log does not have. Returns null when the run is too short, or when
 * the window cost nothing — both cases fall back to `deriveInsight`.
 */
export function deriveEvidenceLine(history: readonly RunDayRecord[]): string | null {
  if (history.length < MIN_HISTORY_FOR_EVIDENCE) return null;

  const window = longestHoardWindow(history, hoardThreshold(history));
  if (!window || window.tax <= 0) return null;

  const where =
    window.start === window.end
      ? `on day ${window.start}`
      : `on days ${window.start}–${window.end}`;
  const held = window.start === window.end ? `${window.min}` : `${window.min}+`;

  return `You held ${held} coins overnight ${where}. The taxman took ${window.tax}.`;
}

/**
 * Generic fallback advice, moved verbatim from BankruptcyScreen so the whole
 * "what does this screen say" decision lives in one tested module. Used when the
 * run is too short for evidence, or when the save predates schema 11.
 */
export function deriveInsight(
  log: DailyLogEntry | null | undefined,
  daysPlayed: number,
  peakBalance: number,
): string {
  if (!log) return 'Plant early and harvest often to build a coin reserve.';
  if (log.pestDestroyedPlots.length > 0)
    return 'Pests wiped your plots. Clear them quickly and replant to recover income.';
  if (log.weatherId === 'blight')
    return 'Blight destroyed your crops. Fast-growing radishes reduce blight exposure.';
  if (log.weatherId === 'flash_drought')
    return 'Flash Drought delayed your harvest. Keep a coin buffer to survive slow turns.';
  if (daysPlayed < 5)
    return 'You went bankrupt early. Start with radishes — they pay out in just 1 day.';
  if (peakBalance < 40)
    return 'Your balance stayed dangerously low. Aim for a buffer of 3× your lease cost.';
  return 'Keep a reserve above your daily lease cost to survive bad-weather turns.';
}
