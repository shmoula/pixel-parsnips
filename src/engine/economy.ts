import type { CropDefinition, UpgradeTierDefinition } from './types';
import {
  STARTING_BALANCE, PLOT_COUNT, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from './constants';
import type { SeasonConfig } from './seasons';

/** Hard-coded configs for Seasons 1–4 (the finite arc). Defined here to avoid circular imports. */
export const SEASON_TABLE: SeasonConfig[] = [
  { number: 1, name: 'Spring Thaw',      startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 150 },
  { number: 2, name: 'Summer Heat',      startDay: 21, endDay: 40, leasePerDay: 20, disasterTotalPct: 0.20, target: 250 },
  { number: 3, name: 'Autumn Pressure',  startDay: 41, endDay: 60, leasePerDay: 25, disasterTotalPct: 0.28, target: 400 },
  { number: 4, name: 'Winter Crunch',    startDay: 61, endDay: 80, leasePerDay: 30, disasterTotalPct: 0.35, target: 600 },
];

export interface EndlessFormula {
  leaseBase: number; leasePerSeason: number;
  disasterBase: number; disasterPerSeason: number; disasterCap: number;
  targetBase: number; targetPerSeason: number;
}

export interface EconomyConfig {
  startingBalance: number;
  startingPlots: number; // 010 activates plot gating; in 009 == maxPlots
  maxPlots: number;
  plotPrices: number[];  // unused in 009; 010 reads it
  taxRate: number;
  crops: Record<string, CropDefinition>;
  upgrades: UpgradeTierDefinition[];
  seasons: SeasonConfig[];
  endless: EndlessFormula;
  exhaustionThreshold: number;
  exhaustionRecoveryDays: number;
  fertilizerCost: number;
  streakBonusPerLevel: number;
  streakBonusCap: number;
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  startingBalance: STARTING_BALANCE,
  startingPlots: PLOT_COUNT,
  maxPlots: PLOT_COUNT,
  plotPrices: [],
  taxRate: TAX_RATE,
  crops: CROP_DEFINITIONS,
  upgrades: UPGRADE_TIER_DEFINITIONS,
  seasons: SEASON_TABLE,
  endless: {
    leaseBase: 30, leasePerSeason: 2,
    disasterBase: 0.35, disasterPerSeason: 0.02, disasterCap: 0.50,
    targetBase: 600, targetPerSeason: 200,
  },
  exhaustionThreshold: EXHAUSTION_THRESHOLD,
  exhaustionRecoveryDays: EXHAUSTION_RECOVERY_DAYS,
  fertilizerCost: FERTILIZER_COST,
  streakBonusPerLevel: STREAK_BONUS_PER_LEVEL,
  streakBonusCap: STREAK_BONUS_CAP,
};
