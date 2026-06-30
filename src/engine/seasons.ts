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
 * Days beyond use the Endless formula with coefficients from `config.endless`.
 * The endless anchor is derived from the finite arc rather than hard-coded, so
 * changing `config.seasons` shifts the numbering/scaling consistently. With
 * `F` finite seasons ending on `finiteEndDay` and finite season length `L`:
 *   - anchor season = F + 1, starting on day `finiteEndDay + 1`
 *   - N               = anchor + floor((day - baseStartDay) / L)
 *   - startDay        = baseStartDay + L * (N - anchor); endDay = startDay + L - 1
 *   - offset          = N - F
 *   - leasePerDay     = leaseBase + leasePerSeason * offset
 *   - disasterTotalPct= min(disasterBase + disasterPerSeason * offset, disasterCap)
 *   - target          = targetBase + targetPerSeason * offset
 */
export function getSeasonForDay(day: number, config: EconomyConfig = DEFAULT_ECONOMY): SeasonConfig {
  if (config.seasons.length === 0) {
    throw new Error('getSeasonForDay: config.seasons must not be empty');
  }

  for (const s of config.seasons) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Endless seasons: anchor derived from the finite arc in config.seasons.
  const e = config.endless;
  const finiteSeasonsCount = config.seasons.length;
  const lastFinite = config.seasons[finiteSeasonsCount - 1];

  if (lastFinite.endDay < lastFinite.startDay) {
    throw new Error(`getSeasonForDay: Season ${lastFinite.number} has invalid bounds (endDay ${lastFinite.endDay} < startDay ${lastFinite.startDay})`);
  }

  const seasonLength = lastFinite.endDay - lastFinite.startDay + 1;
  if (seasonLength <= 0) {
    throw new Error(`getSeasonForDay: computed seasonLength must be > 0, got ${seasonLength}`);
  }
  const endlessAnchorSeason = finiteSeasonsCount + 1;
  const baseStartDay = lastFinite.endDay + 1;

  const n = endlessAnchorSeason + Math.floor((day - baseStartDay) / seasonLength);
  const startDay = baseStartDay + seasonLength * (n - endlessAnchorSeason);
  const offset = n - finiteSeasonsCount;
  return {
    number: n,
    name: 'Deep Winter',
    startDay,
    endDay: startDay + seasonLength - 1,
    leasePerDay: e.leaseBase + e.leasePerSeason * offset,
    disasterTotalPct: Math.min(e.disasterBase + e.disasterPerSeason * offset, e.disasterCap),
    target: e.targetBase + e.targetPerSeason * offset,
  };
}

/**
 * Short, uppercased season label for compact mobile chips.
 * First word of the name, with the endless "Deep Winter" collapsed to "WINTER".
 */
export function shortSeasonLabel(name: string): string {
  if (name === 'Deep Winter') return 'WINTER';
  return name.split(' ')[0].toUpperCase();
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
