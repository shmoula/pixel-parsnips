import type { WeatherId } from './types';
import { WEATHER_PROBABILITY_BANDS } from './constants';

export const SEASON_LENGTH = 20;

export interface SeasonConfig {
  number: number;
  name: string;
  startDay: number;
  endDay: number;
  leasePerDay: number;
  disasterTotalPct: number;
  target: number;
}

/** Hard-coded configs for Seasons 1–4 (the finite arc). */
export const SEASON_TABLE: SeasonConfig[] = [
  { number: 1, name: 'Spring Thaw',      startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 150 },
  { number: 2, name: 'Summer Heat',      startDay: 21, endDay: 40, leasePerDay: 20, disasterTotalPct: 0.20, target: 250 },
  { number: 3, name: 'Autumn Pressure',  startDay: 41, endDay: 60, leasePerDay: 25, disasterTotalPct: 0.28, target: 400 },
  { number: 4, name: 'Winter Crunch',    startDay: 61, endDay: 80, leasePerDay: 30, disasterTotalPct: 0.35, target: 600 },
];

/**
 * Returns the active SeasonConfig for any calendar day ≥ 1.
 * Days 1–80 use SEASON_TABLE; days ≥ 81 use the Endless formula:
 *   - Season N = 5 + floor((day - 81) / 20)
 *   - startDay = 81 + 20 * (N - 5)
 *   - endDay   = startDay + 19
 *   - leasePerDay      = 30 + 2 * (N - 4)
 *   - disasterTotalPct = min(0.35 + 0.02 * (N - 4), 0.50)
 *   - target           = 600 + 200 * (N - 4)
 */
export function getSeasonForDay(day: number): SeasonConfig {
  for (const s of SEASON_TABLE) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Endless Season N (N ≥ 5)
  const n = 5 + Math.floor((day - 81) / 20);
  const startDay = 81 + 20 * (n - 5);
  return {
    number: n,
    name: 'Deep Winter',
    startDay,
    endDay: startDay + 19,
    leasePerDay: 30 + 2 * (n - 4),
    disasterTotalPct: Math.min(0.35 + 0.02 * (n - 4), 0.50),
    target: 600 + 200 * (n - 4),
  };
}

/** WeatherIds that count as disasters for season-based scaling. */
export const DISASTER_WEATHER_IDS: ReadonlyArray<WeatherId> = ['blight', 'pest_infestation', 'flash_drought'];

/**
 * Returns weather probability bands for the given season.
 * Disaster bands (blight, pest, flash_drought) scale proportionally so their
 * total width equals `season.disasterTotalPct`, preserving the 1:1:1 ratio.
 * Non-disaster bands keep equal-width spacing in the remaining probability space.
 */
export function getDisasterBandsForSeason(
  season: SeasonConfig
): Array<{ threshold: number; id: WeatherId }> {
  const disasterIds = WEATHER_PROBABILITY_BANDS.filter(b => DISASTER_WEATHER_IDS.includes(b.id)).map(b => b.id);
  const nonDisasterIds = WEATHER_PROBABILITY_BANDS.filter(b => !DISASTER_WEATHER_IDS.includes(b.id)).map(b => b.id);

  const disasterTotal = season.disasterTotalPct;
  const perDisasterWidth = disasterTotal / disasterIds.length;

  const nonDisasterTotal = 1.0 - disasterTotal;
  const perNonDisasterWidth = nonDisasterTotal / nonDisasterIds.length;

  // Round helper to avoid floating-point drift (10 significant decimal places)
  const round = (n: number): number => Math.round(n * 1e10) / 1e10;

  const bands: Array<{ threshold: number; id: WeatherId }> = [];
  let cursor = 0;
  for (const id of disasterIds) {
    cursor = round(cursor + perDisasterWidth);
    bands.push({ threshold: cursor, id });
  }
  for (const id of nonDisasterIds) {
    cursor = round(cursor + perNonDisasterWidth);
    bands.push({ threshold: cursor, id });
  }
  // Floating-point safety: clamp the final band to exactly 1.0
  bands[bands.length - 1] = { threshold: 1.0, id: bands[bands.length - 1].id };
  return bands;
}
