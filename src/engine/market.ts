import type { CropId, MarketEvent, ActiveMarketEvent, MarketState } from './types';
import type { MarketConfig } from './economy';

const CROP_IDS: readonly CropId[] = ['radish', 'parsnip', 'pumpkin'];

const CROP_PLURAL: Record<CropId, string> = {
  radish: 'Radishes',
  parsnip: 'Parsnips',
  pumpkin: 'Pumpkins',
};

/** The starting/empty market: no active or pending event. */
export const EMPTY_MARKET: MarketState = { active: null, pending: null };

/** Yield multiplier for `cropId` under the current active event (1 if unaffected). Pure. */
export function marketMultiplierFor(active: ActiveMarketEvent | null, cropId: CropId): number {
  return active !== null && active.cropId === cropId ? active.multiplier : 1;
}

/** Promote a pending event to active with a full lifetime. No-op if nothing pending. Pure. */
export function activatePending(market: MarketState, config: MarketConfig): MarketState {
  if (market.pending === null) return market;
  return {
    active: { ...market.pending, daysRemaining: config.durationDays },
    pending: null,
  };
}

/** Decrement an active event; return the survivor or null when it expires. Pure. */
export function expireActive(active: ActiveMarketEvent | null): ActiveMarketEvent | null {
  if (active === null) return null;
  const daysRemaining = active.daysRemaining - 1;
  return daysRemaining > 0 ? { ...active, daysRemaining } : null;
}

/**
 * At a cycle boundary with no active/pending event, maybe schedule one.
 * Consumes up to three rng draws (fire, crop, kind). Returns the event or null. Pure.
 */
export function rollSchedule(
  market: MarketState,
  currentDay: number,
  config: MarketConfig,
  rng: () => number,
): MarketEvent | null {
  if (market.active !== null || market.pending !== null) return null;
  if (currentDay % config.cadenceDays !== 0) return null;
  if (rng() >= config.fireChance) return null;

  const cropId = CROP_IDS[Math.min(CROP_IDS.length - 1, Math.floor(rng() * CROP_IDS.length))];
  const isShortage = rng() < 0.5;
  return {
    cropId,
    kind: isShortage ? 'shortage' : 'glut',
    multiplier: isShortage ? config.shortageMultiplier : config.glutMultiplier,
  };
}

/** One-line announcement for a scheduled (tomorrow's) event. */
export function announceText(ev: MarketEvent): string {
  return ev.kind === 'shortage'
    ? `${CROP_PLURAL[ev.cropId]} are scarce — prices up!`
    : `The market is flooded with ${CROP_PLURAL[ev.cropId]} — prices down.`;
}

/** One-line description for the currently active event. */
export function activeText(ev: ActiveMarketEvent): string {
  const pct = Math.round((ev.multiplier - 1) * 100);
  const sign = pct >= 0 ? '+' : '';
  const days = ev.daysRemaining === 1 ? 'day' : 'days';
  return `${CROP_PLURAL[ev.cropId]} ${ev.kind}: yield ${sign}${pct}% (${ev.daysRemaining} ${days} left)`;
}
