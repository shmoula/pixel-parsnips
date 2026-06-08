import type { WeatherId } from './types';
import { WEATHER_PROBABILITY_BANDS } from './constants';
import { DEFAULT_ECONOMY, type EconomyConfig } from './economy';

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

// Re-export so existing consumers of `seasons.ts` keep working
export { SEASON_TABLE } from './economy';

/**
 * Returns the active SeasonConfig for any calendar day ≥ 1.
 * @param config - Economy configuration; defaults to DEFAULT_ECONOMY.
 *
 * Days within a configured season's [startDay, endDay] use `config.seasons`.
 * Days beyond use the Endless formula with coefficients from `config.endless`
 * (where N = 5 + floor((day - 81) / 20)):
 *   - startDay         = 81 + 20 * (N - 5);  endDay = startDay + 19
 *   - leasePerDay      = leaseBase + leasePerSeason * (N - 4)
 *   - disasterTotalPct = min(disasterBase + disasterPerSeason * (N - 4), disasterCap)
 *   - target           = targetBase + targetPerSeason * (N - 4)
 */
export function getSeasonForDay(day: number, config: EconomyConfig = DEFAULT_ECONOMY): SeasonConfig {
  for (const s of config.seasons) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Endless Season N (N ≥ 5)
  const e = config.endless;
  const n = 5 + Math.floor((day - 81) / 20);
  const startDay = 81 + 20 * (n - 5);
  return {
    number: n,
    name: 'Deep Winter',
    startDay,
    endDay: startDay + 19,
    leasePerDay: e.leaseBase + e.leasePerSeason * (n - 4),
    disasterTotalPct: Math.min(e.disasterBase + e.disasterPerSeason * (n - 4), e.disasterCap),
    target: e.targetBase + e.targetPerSeason * (n - 4),
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
