// scripts/sim/economyPresets.ts
import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';

/** Frozen snapshot of the original (pre-010) live economy — the comparison baseline. */
export const baseline: EconomyConfig = {
  ...DEFAULT_ECONOMY,
  startingBalance: 100, // pinned: keep baseline frozen after 010 promotes a new DEFAULT_ECONOMY
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

/**
 * Candidate 010 economy — TUNED in Task 8 (see specs/010-plot-progression-rebalance/tuning-results.md).
 * Difficulty comes from structure rather than crop margins: a 4-plot start with an escalating
 * plot-purchase sink, higher lease, and steeper targets. Crop yields stayed at baseline because
 * compressing them on top of those changes made the run unwinnable. The smartMixed floor-bot lands
 * at ~16–17% win / ~1.05x overshoot; single-crop strategies all fail.
 */
export const proposed: EconomyConfig = {
  ...baseline,
  startingBalance: 130,
  startingPlots: 4,
  maxPlots: 12,
  plotPrices: [30, 55, 85, 120, 160, 210, 280, 360],
  taxRate: 0.06,
  crops: {
    radish:  { id: 'radish',  name: 'Radish',  growthDays: 1, baseSeedCost: 5,  baseYield: 12 },
    parsnip: { id: 'parsnip', name: 'Parsnip', growthDays: 2, baseSeedCost: 10, baseYield: 28 },
    pumpkin: { id: 'pumpkin', name: 'Pumpkin', growthDays: 3, baseSeedCost: 20, baseYield: 65 },
  },
  seasons: [
    { number: 1, name: 'Spring Thaw',     startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 105 },
    { number: 2, name: 'Summer Heat',     startDay: 21, endDay: 40, leasePerDay: 22, disasterTotalPct: 0.20, target: 230 },
    { number: 3, name: 'Autumn Pressure', startDay: 41, endDay: 60, leasePerDay: 30, disasterTotalPct: 0.28, target: 390 },
    { number: 4, name: 'Winter Crunch',   startDay: 61, endDay: 80, leasePerDay: 40, disasterTotalPct: 0.35, target: 480 },
  ],
};

export const PRESETS: Record<string, EconomyConfig> = { baseline, proposed };
