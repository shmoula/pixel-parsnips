import type { FarmEventsState } from './types';
import { getSeasonForDay } from './seasons';
import type { EconomyConfig } from './economy';

/** Canonical empty slice. `enabled` defaults true (sim/tests); the UI overrides at run creation. */
export const EMPTY_FARM_EVENTS: FarmEventsState = {
  enabled: true,
  scheduleSeason: 0,
  scheduledDays: [],
  pending: null,
  activeEffects: [],
  contract: null,
  seenIds: [],
  lastResolved: null,
};

/**
 * Lazily draw a season's event schedule. No-op when disabled or already drawn
 * for the current season. Consumes rng draws: second-event roll, then one per
 * scheduled day. The window is clamped to future days (currentDay + 1) so
 * migrated mid-season saves are never retroactively scheduled. Pure.
 */
export function ensureSchedule(
  fe: FarmEventsState,
  currentDay: number,
  config: EconomyConfig,
  rng: () => number,
): FarmEventsState {
  if (!fe.enabled) return fe;
  const season = getSeasonForDay(currentDay, config);
  if (fe.scheduleSeason === season.number) return fe;

  const cfg = config.farmEvents;
  const lo = Math.max(season.startDay + cfg.windowStartOffset, currentDay + 1);
  const hi = Math.min(season.startDay + cfg.windowEndOffset, season.endDay);

  const scheduledDays: number[] = [];
  if (hi >= lo) {
    const count = 1 + (rng() < cfg.secondEventChance ? 1 : 0);
    const span = hi - lo + 1;
    for (let i = 0; i < Math.min(count, span); i++) {
      let d = lo + Math.min(span - 1, Math.floor(rng() * span));
      // Linear probe on collision keeps the draw deterministic per rng sequence.
      while (scheduledDays.includes(d)) d = lo + ((d - lo + 1) % span);
      scheduledDays.push(d);
    }
  }
  return { ...fe, scheduleSeason: season.number, scheduledDays };
}
