import type {
  ContractState, CropId, FarmEventsState, FarmEventDefinition, FarmEventEffect, FarmEventId,
  GameState, HarvestEvent, WeatherId,
} from './types';
import { getSeasonForDay } from './seasons';
import type { EconomyConfig } from './economy';
import { coins } from './constants';

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

/** Aggregate yield multiplier from live buffs (multiplicative). */
export function buffMultiplierFor(effects: FarmEventEffect[]): number {
  return effects.reduce(
    (f, e) => (e.kind === 'yield_buff' && e.harvestsRemaining > 0 ? f * e.multiplier : f), 1);
}

/** Exhaustion increment per harvest while buffed: max factor across live buffs, min 1. */
export function buffExhaustionFactorFor(effects: FarmEventEffect[]): number {
  return effects.reduce(
    (f, e) => (e.kind === 'yield_buff' && e.harvestsRemaining > 0 ? Math.max(f, e.exhaustionFactor) : f), 1);
}

/** Active seed-discount factor for `cropId`, or 1. */
export function seedDiscountFor(effects: FarmEventEffect[], cropId: CropId): number {
  const d = effects.find(e => e.kind === 'seed_discount' && e.cropId === cropId);
  return d !== undefined && d.kind === 'seed_discount' ? d.factor : 1;
}

/** The weather pinned for `day`, or null. */
export function pinnedWeatherFor(effects: FarmEventEffect[], day: number): WeatherId | null {
  const p = effects.find(e => e.kind === 'weather_pin' && e.day === day);
  return p !== undefined && p.kind === 'weather_pin' ? p.weatherId : null;
}

/**
 * End-of-turn effect bookkeeping: buffs decrement once per harvest event this
 * turn and expire at 0; seed discounts expire with the day they were granted;
 * pins for today or earlier are consumed. Pure.
 */
export function tickEffects(
  effects: FarmEventEffect[],
  harvestCount: number,
  dayCompleted: number,
): FarmEventEffect[] {
  return effects
    .map(e => (e.kind === 'yield_buff' ? { ...e, harvestsRemaining: e.harvestsRemaining - harvestCount } : e))
    .filter(e =>
      e.kind === 'yield_buff' ? e.harvestsRemaining > 0
      : e.kind === 'seed_discount' ? e.expiresAfterDay > dayCompleted
      : e.day > dayCompleted);
}

export interface ContractOutcome {
  contract: ContractState | null;
  completed: { eventId: FarmEventId; reward: number } | null;
  expired: FarmEventId | null;
}

/**
 * One turn of contract accounting: qualifying harvests reduce `remaining`;
 * at 0 the contract completes (caller credits the reward BEFORE the bankruptcy
 * check); an unfinished contract expires — no penalty — once the deadline day
 * has been played. Pure.
 */
export function applyContractProgress(
  contract: ContractState | null,
  harvests: HarvestEvent[],
  dayCompleted: number,
): ContractOutcome {
  if (contract === null) return { contract: null, completed: null, expired: null };
  const qualifying = harvests.filter(h => h.cropId === contract.cropId).length;
  const remaining = contract.remaining - qualifying;
  if (remaining <= 0) {
    return { contract: null, completed: { eventId: contract.eventId, reward: contract.reward }, expired: null };
  }
  if (dayCompleted >= contract.deadlineDay) {
    return { contract: null, completed: null, expired: contract.eventId };
  }
  return { contract: { ...contract, remaining }, completed: null, expired: null };
}

/** Live coin value of the Traveling Merchant's sell-now offer for the current board. */
export function merchantOfferValue(state: GameState, config: EconomyConfig): number {
  const def = config.farmEvents.events.find(e => e.id === 'traveling_merchant');
  const spec = def?.choiceA.effects.find(e => e.kind === 'sell_standing_crops');
  if (spec === undefined || spec.kind !== 'sell_standing_crops') return 0;
  return state.plots.reduce(
    (sum, p) => (p.cropId === null ? sum : sum + coins(config.crops[p.cropId].baseYield * spec.priceFactor)), 0);
}
