import type { CropDefinition, UpgradeTierDefinition } from './types';
import {
  STARTING_BALANCE, PLOT_COUNT, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from './constants';
import { SEASON_TABLE, type SeasonConfig } from './seasons';

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
