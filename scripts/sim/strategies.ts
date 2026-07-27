import {
  buySeed, plantSeed, buyBuilding, buyPlot, computeSeedCost,
} from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import type { EconomyConfig } from '../../src/engine/economy';
import type {
  GameState, CropId, ActiveMarketEvent, MarketEvent, BuildingId, FarmEventChoiceId, FarmEventId,
} from '../../src/engine/types';

export type Strategy = (state: GameState, config: EconomyConfig) => GameState;

/** Plant `crop` on every plantable plot while a seed + lease buffer is affordable. */
function fillBoard(state: GameState, config: EconomyConfig, pick: (s: GameState) => CropId): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  for (let i = 0; i < s.unlockedPlots; i++) {
    const plot = s.plots[i];
    if (plot.cropId !== null || plot.exhaustedSinceDay !== null || plot.pestDamaged) continue;
    const crop = pick(s);
    const cost = computeSeedCost(crop, s.buildings, config);
    if (s.coinBalance - cost < lease) break;
    const b = buySeed(s, crop, 1, config);
    if (!b.ok) break;
    s = b.state;
    const pl = plantSeed(s, i, crop, config);
    if (pl.ok) s = pl.state;
  }
  return s;
}

/** Priority order for building purchases; a retune candidate (Task 12). */
const BUILDING_PRIORITY: BuildingId[] = [
  'toolshed', 'compost_bin', 'irrigation_well', 'scarecrow', 'farm_stand',
];

/** Buy buildings in priority order while comfortably affordable (lease ×2 buffer).
 *  Locked or unknown buildings are skipped, not waited for. */
export function maybeBuyBuildings(
  state: GameState,
  config: EconomyConfig,
  ids: BuildingId[] = BUILDING_PRIORITY,
): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  for (const id of ids) {
    if (s.buildings[id]) continue;
    const def = config.buildings.definitions.find(d => d.id === id);
    if (!def) continue;
    if (s.coinBalance - def.cost < lease * 2) continue;
    const r = buyBuilding(s, id, config);
    if (r.ok) s = r.state;
  }
  return s;
}

/** Buy plots while the board is fully utilized and we can afford the next plot
 *  with a healthy buffer (don't spend the lease cushion on land). */
function maybeBuyPlots(state: GameState, config: EconomyConfig): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  while (s.unlockedPlots < config.maxPlots) {
    const boardFull = s.plots
      .slice(0, s.unlockedPlots)
      .every(p => p.cropId !== null || p.exhaustedSinceDay !== null || p.pestDamaged);
    if (!boardFull) break;
    const price = config.plotPrices[s.unlockedPlots - config.startingPlots];
    if (price === undefined || s.coinBalance - price < lease * 2) break;
    const r = buyPlot(s, config);
    if (!r.ok) break;
    s = r.state;
  }
  return s;
}

const single = (crop: CropId): Strategy => (state, config) =>
  fillBoard(maybeBuyBuildings(state, config, ['toolshed']), config, () => crop);

/**
 * Adjust a base crop choice for the current market: chase a shortage, dodge a glut.
 * `active` takes precedence over `pending` (it affects harvests now).
 */
export function pickCropWithMarket(
  basePick: CropId,
  active: ActiveMarketEvent | null,
  pending: MarketEvent | null,
): CropId {
  const isShortage = (e: MarketEvent | null) => e?.kind === 'shortage';
  const shortage = isShortage(active) ? active : isShortage(pending) ? pending : null;
  if (shortage) return shortage.cropId;

  // Only an active glut is dodged; a pending glut is an intentional no-op since it
  // doesn't affect harvests yet (and the bot may pivot away before it activates).
  const glut = active?.kind === 'glut' ? active : null;
  if (glut && glut.cropId === basePick) {
    return basePick === 'radish' ? 'parsnip' : 'radish';
  }
  return basePick;
}

const smartMixed: Strategy = (state, config) => {
  let s = maybeBuyBuildings(state, config);
  const pick = (cur: GameState): CropId => {
    const base: CropId = cur.coinBalance > 250 ? 'pumpkin' : cur.coinBalance > 60 ? 'parsnip' : 'radish';
    return pickCropWithMarket(base, cur.market.active, cur.market.pending);
  };
  // Fill, then expand, then fill the new plot(s); a couple of rounds converge.
  for (let round = 0; round < 3; round++) {
    s = fillBoard(s, config, pick);
    const expanded = maybeBuyPlots(s, config);
    if (expanded.unlockedPlots === s.unlockedPlots) { s = expanded; break; }
    s = expanded;
  }
  return s;
};

export const STRATEGIES: Record<string, Strategy> = {
  radishOnly: single('radish'),
  parsnipOnly: single('parsnip'),
  pumpkinOnly: single('pumpkin'),
  smartMixed,
};

// ── 022: farm-event decision policies ──────────────────────────────────────────

export type EventPolicy = (state: GameState, config: EconomyConfig) => FarmEventChoiceId;

/** Accept the merchant's instant sale only when at least half the occupied plots ripen within 2 days. */
function heuristicMerchant(active: GameState['plots']): FarmEventChoiceId {
  const occupied = active.filter(p => p.cropId !== null);
  const ripeSoon = occupied.filter(p => p.daysRemaining !== null && p.daysRemaining <= 2);
  return occupied.length > 0 && ripeSoon.length * 2 >= occupied.length ? 'A' : 'B';
}

/** Embrace the yield buff only when the board isn't already close to exhaustion. */
function heuristicBountifulSpring(active: GameState['plots'], config: EconomyConfig): FarmEventChoiceId {
  const nearExhausted = active.filter(p => p.consecutiveHarvests >= config.exhaustionThreshold - 1);
  return nearExhausted.length <= 1 ? 'A' : 'B';
}

/** Rush-plant the discounted radishes only with enough coins to spare for a few seeds + lease. */
function heuristicDroughtWarning(state: GameState, config: EconomyConfig, lease: number): FarmEventChoiceId {
  const seedCost = computeSeedCost('radish', state.buildings, config, state.farmEvents.activeEffects);
  return state.coinBalance >= seedCost * 4 + lease * 2 ? 'A' : 'B';
}

/** Take a delivery contract only when enough free plots and growth time allow completing it. */
function heuristicContract(
  active: GameState['plots'],
  config: EconomyConfig,
  eventId: FarmEventId,
): FarmEventChoiceId {
  const def = config.farmEvents.events.find(e => e.id === eventId);
  const spec = def?.choiceA.effects.find(e => e.kind === 'contract');
  if (spec === undefined || spec.kind !== 'contract') return 'B';
  const free = active.filter(p => p.cropId === null && p.exhaustedSinceDay === null && !p.pestDamaged);
  return spec.quantity <= free.length && config.crops[spec.cropId].growthDays + 1 <= spec.deadlineDays
    ? 'A' : 'B';
}

/** The per-event "defensible reasoning" each event is designed around (spec §Simulator). */
function heuristicChoice(state: GameState, config: EconomyConfig): FarmEventChoiceId {
  const pending = state.farmEvents.pending;
  if (pending === null) return 'B';
  const lease = getSeasonForDay(state.currentDay, config).leasePerDay;
  const active = state.plots.slice(0, state.unlockedPlots);
  switch (pending.eventId) {
    case 'traveling_merchant': return heuristicMerchant(active);
    case 'bountiful_spring': return heuristicBountifulSpring(active, config);
    case 'drought_warning': return heuristicDroughtWarning(state, config, lease);
    case 'millers_order':
    case 'fair_committee': return heuristicContract(active, config, pending.eventId);
    case 'wandering_beekeeper': return state.coinBalance > lease * 3 ? 'A' : 'B';
    default: {
      // Exhaustiveness guard: adding a 7th FarmEventId without a case here is a compile error,
      // rather than silently declining it (every event's choice must be defensible).
      const unreachable: never = pending.eventId;
      return unreachable;
    }
  }
}

export const EVENT_POLICIES: Record<string, EventPolicy> = {
  heuristic: heuristicChoice,
  acceptAll: () => 'A',
  declineAll: () => 'B',
};
