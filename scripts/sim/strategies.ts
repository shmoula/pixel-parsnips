import {
  buySeed, plantSeed, buyUpgrade, buyPlot, computeSeedCost,
} from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import type { EconomyConfig } from '../../src/engine/economy';
import type { GameState, CropId } from '../../src/engine/types';

export type Strategy = (state: GameState, config: EconomyConfig) => GameState;

/** Plant `crop` on every plantable plot while a seed + lease buffer is affordable. */
function fillBoard(state: GameState, config: EconomyConfig, pick: (s: GameState) => CropId): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  for (let i = 0; i < s.unlockedPlots; i++) {
    const plot = s.plots[i];
    if (plot.cropId !== null || plot.exhaustedSinceDay !== null || plot.pestDamaged) continue;
    const crop = pick(s);
    const cost = computeSeedCost(crop, s.upgradeTier, config);
    if (s.coinBalance - cost < lease) break;
    const b = buySeed(s, crop, 1, config);
    if (!b.ok) break;
    s = b.state;
    const pl = plantSeed(s, i, crop, config);
    if (pl.ok) s = pl.state;
  }
  return s;
}

/** Buy upgrades while comfortably affordable (keeps an 80-coin working buffer). */
function maybeUpgrade(state: GameState, config: EconomyConfig): GameState {
  let s = state;
  while (s.upgradeTier < config.upgrades.length) {
    const cost = config.upgrades[s.upgradeTier].cost;
    if (s.coinBalance - cost <= 80) break;
    const r = buyUpgrade(s, config);
    if (!r.ok) break;
    s = r.state;
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
  fillBoard(maybeUpgrade(state, config), config, () => crop);

const smartMixed: Strategy = (state, config) => {
  let s = maybeUpgrade(state, config);
  const pick = (cur: GameState): CropId =>
    cur.coinBalance > 250 ? 'pumpkin' : cur.coinBalance > 60 ? 'parsnip' : 'radish';
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
