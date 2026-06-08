import {
  buySeed, plantSeed, buyUpgrade, computeSeedCost,
} from '../../src/engine/gameEngine';
import { getSeasonForDay } from '../../src/engine/seasons';
import type { EconomyConfig } from '../../src/engine/economy';
import type { GameState, CropId } from '../../src/engine/types';

export type Strategy = (state: GameState, config: EconomyConfig) => GameState;

/** Plant `crop` on every plantable plot while a seed + lease buffer is affordable. */
function fillBoard(state: GameState, config: EconomyConfig, pick: (s: GameState) => CropId): GameState {
  let s = state;
  const lease = getSeasonForDay(s.currentDay, config).leasePerDay;
  for (let i = 0; i < config.maxPlots; i++) {
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

const single = (crop: CropId): Strategy => (state, config) =>
  fillBoard(maybeUpgrade(state, config), config, () => crop);

const smartMixed: Strategy = (state, config) => {
  const s = maybeUpgrade(state, config);
  return fillBoard(s, config, (cur) => {
    if (cur.coinBalance > 250) return 'pumpkin';
    if (cur.coinBalance > 60) return 'parsnip';
    return 'radish';
  });
};

export const STRATEGIES: Record<string, Strategy> = {
  radishOnly: single('radish'),
  parsnipOnly: single('parsnip'),
  pumpkinOnly: single('pumpkin'),
  smartMixed,
};
