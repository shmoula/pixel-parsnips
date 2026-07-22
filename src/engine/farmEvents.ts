import type { FarmEventsState, FarmEventDefinition, FarmEventEffect, FarmEventId } from './types';
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

/** True when either choice of `def` creates a contract. */
export function isContractEvent(def: FarmEventDefinition): boolean {
  return def.choiceA.effects.some(e => e.kind === 'contract')
    || def.choiceB.effects.some(e => e.kind === 'contract');
}

/**
 * The unseen-id draw pool for this fire, resetting to the full catalog when
 * exhausted, then narrowed to exclude contract events while one is live.
 */
function candidatePool(
  fe: FarmEventsState,
  all: FarmEventDefinition[],
): { candidates: FarmEventDefinition[]; seenIds: FarmEventId[] } {
  const unseenAll = all.filter(e => !fe.seenIds.includes(e.id));
  const pool = unseenAll.length > 0 ? unseenAll : all; // reset: long Endless runs recycle content
  const seenIds = unseenAll.length > 0 ? fe.seenIds : [];
  const candidates = fe.contract !== null ? pool.filter(e => !isContractEvent(e)) : pool;
  return { candidates, seenIds };
}

/** Resolve the definition's `onFire` specs (the Drought Warning's pre-rolled weather pin). */
function rollOnFireEffects(def: FarmEventDefinition, newDay: number, rng: () => number): FarmEventEffect[] {
  const effects: FarmEventEffect[] = [];
  for (const spec of def.onFire ?? []) {
    if (spec.kind === 'weather_pin' && rng() < spec.chance) {
      const span = spec.maxOffsetDays - spec.minOffsetDays;
      const offset = spec.minOffsetDays + Math.min(span, Math.floor(rng() * (span + 1)));
      effects.push({ kind: 'weather_pin', weatherId: spec.weatherId, day: newDay + offset });
    }
  }
  return effects;
}

/**
 * Fire a scheduled event for `newDay` (the day the player is about to start).
 * Draws an unseen event (pool resets when exhausted); contract events are
 * excluded while a contract is live. Fire-time effects (the Drought Warning's
 * pre-rolled weather pin) are applied here, before any choice. Pure.
 */
export function maybeFireEvent(
  fe: FarmEventsState,
  newDay: number,
  config: EconomyConfig,
  rng: () => number,
): FarmEventsState {
  if (!fe.enabled || fe.pending !== null || !fe.scheduledDays.includes(newDay)) return fe;
  const all = config.farmEvents.events;
  if (all.length === 0) return fe;

  const { candidates, seenIds } = candidatePool(fe, all);
  if (candidates.length === 0) return fe; // only contract events left while one is live

  const def = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
  const newEffects = rollOnFireEffects(def, newDay, rng);

  return {
    ...fe,
    pending: { eventId: def.id, firedDay: newDay },
    seenIds: [...seenIds, def.id],
    activeEffects: [...fe.activeEffects, ...newEffects],
  };
}
