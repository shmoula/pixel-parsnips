// scripts/sim/economyPresets.ts
import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';

/** Frozen snapshot of the original (pre-010) live economy — the comparison baseline. */
export const baseline: EconomyConfig = {
  ...DEFAULT_ECONOMY,
  startingPlots: 12,
  maxPlots: 12,
  plotPrices: [],
  taxRate: 0.05,
  crops: {
    radish:  { id: 'radish',  name: 'Radish',  growthDays: 1, baseSeedCost: 5,  baseYield: 12 },
    parsnip: { id: 'parsnip', name: 'Parsnip', growthDays: 2, baseSeedCost: 10, baseYield: 28 },
    pumpkin: { id: 'pumpkin', name: 'Pumpkin', growthDays: 3, baseSeedCost: 20, baseYield: 65 },
  },
  seasons: [
    { number: 1, name: 'Spring Thaw',     startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 150 },
    { number: 2, name: 'Summer Heat',     startDay: 21, endDay: 40, leasePerDay: 20, disasterTotalPct: 0.20, target: 250 },
    { number: 3, name: 'Autumn Pressure', startDay: 41, endDay: 60, leasePerDay: 25, disasterTotalPct: 0.28, target: 400 },
    { number: 4, name: 'Winter Crunch',   startDay: 61, endDay: 80, leasePerDay: 30, disasterTotalPct: 0.35, target: 600 },
  ],
};

/** Candidate 010 economy — plot progression + compressed margins. TUNED in Task 8. */
export const proposed: EconomyConfig = {
  ...baseline,
  startingPlots: 4,
  maxPlots: 12,
  plotPrices: [40, 70, 110, 160, 220, 300, 400, 520],
  taxRate: 0.06,
  crops: {
    radish:  { id: 'radish',  name: 'Radish',  growthDays: 1, baseSeedCost: 5,  baseYield: 9  },
    parsnip: { id: 'parsnip', name: 'Parsnip', growthDays: 2, baseSeedCost: 11, baseYield: 24 },
    pumpkin: { id: 'pumpkin', name: 'Pumpkin', growthDays: 3, baseSeedCost: 22, baseYield: 55 },
  },
  seasons: [
    { number: 1, name: 'Spring Thaw',     startDay:  1, endDay: 20, leasePerDay: 18, disasterTotalPct: 0.15, target: 180 },
    { number: 2, name: 'Summer Heat',     startDay: 21, endDay: 40, leasePerDay: 26, disasterTotalPct: 0.20, target: 400 },
    { number: 3, name: 'Autumn Pressure', startDay: 41, endDay: 60, leasePerDay: 36, disasterTotalPct: 0.28, target: 700 },
    { number: 4, name: 'Winter Crunch',   startDay: 61, endDay: 80, leasePerDay: 48, disasterTotalPct: 0.35, target: 1100 },
  ],
};

export const PRESETS: Record<string, EconomyConfig> = { baseline, proposed };
