import type { DailyLogEntry, GameState, RunDayRecord, WeatherId } from './types';
import { DISASTER_WEATHER_IDS } from './seasons';

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
// Contiguity is detected by r.day (not array adjacency): a tampered/corrupt save can carry
// records with gaps in day, and those must not be reported as one continuous window.
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

  let previousDay: number | null = null;
  for (const r of history) {
    if (previousDay !== null && r.day !== previousDay + 1) flush();
    if (r.closingBalance >= threshold) run.push(r);
    else flush();
    previousDay = r.day;
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

export type DeathCauseId =
  | 'fed_the_taxman'
  | 'weathered_out'
  | 'overextended'
  | 'idle_hands'
  | 'out_of_seed_money';

/** Punchlines, not scores. The medal says how far the run got; this says how it died. */
export const DEATH_TITLES: Record<DeathCauseId, string> = {
  fed_the_taxman: 'Fed the Taxman',
  weathered_out: 'Weathered Out',
  overextended: 'Bought the Farm',
  idle_hands: 'Idle Hands',
  out_of_seed_money: 'Out of Seed Money',
};

/** Share of gross harvest income lost to tax that counts as "the taxman got you". */
const TAXMAN_SHARE = 0.25;
/** How recent a purchase has to be to have plausibly caused the collapse. */
const OVEREXTENSION_WINDOW_DAYS = 3;

export interface DeathCauseInput {
  history: readonly RunDayRecord[];
  /** Weather on the fatal day, from `lastDailyLog`; null when unknown. */
  finalWeatherId: WeatherId | null;
  /** Unlocked plots with nothing growing on the final day. */
  emptyPlots: number;
  unlockedPlots: number;
}

function boughtRecently(history: readonly RunDayRecord[]): boolean {
  const window = history.slice(-(OVEREXTENSION_WINDOW_DAYS + 1));
  for (let i = 1; i < window.length; i++) {
    if (
      window[i].unlockedPlots > window[i - 1].unlockedPlots ||
      window[i].buildingCount > window[i - 1].buildingCount
    ) {
      return true;
    }
  }
  // A purchase on the very first recorded day has no predecessor to compare against;
  // treat a non-zero building count in a one-day history as a recent buy. The plot
  // case is deliberately NOT covered here — a day-1 plot purchase has no baseline in
  // the window since `startingPlots` isn't in `DeathCauseInput`; the worst outcome is
  // a mislabelled cause, never a crash.
  return window.length === 1 && window[0].buildingCount > 0;
}

/**
 * 025 — how this run died, evaluated most-interesting-cause-first.
 *
 * The ORDER is the design, not the thresholds. A run that both hoarded and ended on
 * a disaster is a taxman story: the tax is the game's thesis and the weather is
 * noise. Thresholds are first-pass and expected to move once real runs exist.
 */
export function deriveDeathCause({
  history,
  finalWeatherId,
  emptyPlots,
  unlockedPlots,
}: DeathCauseInput): DeathCauseId {
  const totalTax = history.reduce((s, r) => s + r.taxDeducted, 0);
  const totalIncome = history.reduce((s, r) => s + r.harvestIncome, 0);

  if (totalIncome > 0 && totalTax >= totalIncome * TAXMAN_SHARE) return 'fed_the_taxman';
  if (finalWeatherId !== null && DISASTER_WEATHER_IDS.includes(finalWeatherId)) return 'weathered_out';
  if (boughtRecently(history)) return 'overextended';
  if (unlockedPlots > 0 && emptyPlots > unlockedPlots / 2) return 'idle_hands';
  return 'out_of_seed_money';
}

/**
 * The state → inputs mapping, in one place.
 *
 * Two callers need it — App.tsx for the bankruptcy screen and the balance
 * simulator for the distribution report — and the `slice(0, unlockedPlots)` below
 * is the kind of detail that silently diverges when it is written twice. Plots at
 * or beyond `unlockedPlots` are LOCKED, not idle; counting them would fire
 * `idle_hands` on every run that never bought a plot.
 */
export function deathCauseForState(state: GameState): DeathCauseId {
  return deriveDeathCause({
    history: state.runHistory,
    finalWeatherId: state.lastDailyLog?.weatherId ?? null,
    emptyPlots: state.plots.slice(0, state.unlockedPlots).filter(p => p.cropId === null).length,
    unlockedPlots: state.unlockedPlots,
  });
}
