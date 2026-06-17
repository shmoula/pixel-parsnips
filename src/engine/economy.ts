import type { CropDefinition, CropId, UpgradeTierDefinition } from './types';
import {
  STARTING_BALANCE, PLOT_COUNT, STARTING_PLOTS, PLOT_PRICES, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  MARKET_CADENCE_DAYS, MARKET_FIRE_CHANCE,
  MARKET_SHORTAGE_MULTIPLIER, MARKET_GLUT_MULTIPLIER,
  MARKET_DURATION_DAYS, MARKET_ANNOUNCE_LEAD_DAYS,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from './constants';
import type { SeasonConfig } from './seasons';

/** Hard-coded configs for Seasons 1–4 (the finite arc). Defined here to avoid circular imports. */
export const SEASON_TABLE: SeasonConfig[] = [
  { number: 1, name: 'Spring Thaw',      startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 105 },
  { number: 2, name: 'Summer Heat',      startDay: 21, endDay: 40, leasePerDay: 22, disasterTotalPct: 0.20, target: 230 },
  { number: 3, name: 'Autumn Pressure',  startDay: 41, endDay: 60, leasePerDay: 30, disasterTotalPct: 0.28, target: 390 },
  { number: 4, name: 'Winter Crunch',    startDay: 61, endDay: 80, leasePerDay: 40, disasterTotalPct: 0.35, target: 480 },
];

export interface EndlessFormula {
  leaseBase: number; leasePerSeason: number;
  disasterBase: number; disasterPerSeason: number; disasterCap: number;
  targetBase: number; targetPerSeason: number;
}

export interface MarketConfig {
  /** Cycle length in days; scheduling rolls when currentDay % cadenceDays === 0. */
  cadenceDays: number;
  /** Probability (0..1) of scheduling an event at a cycle boundary. */
  fireChance: number;
  /** Yield multiplier for a Shortage (>1). */
  shortageMultiplier: number;
  /** Yield multiplier for a Glut (<1). */
  glutMultiplier: number;
  /** Active lifetime in days once an event activates. */
  durationDays: number;
  /** Days between announcement and activation; fixed 1 for this ship. */
  announceLeadDays: number;
}

export interface EconomyConfig {
  startingBalance: number;
  startingPlots: number; // 010 activates plot gating; in 009 == maxPlots
  maxPlots: number;
  plotPrices: number[];  // unused in 009; 010 reads it
  taxRate: number;
  crops: Record<CropId, CropDefinition>;
  upgrades: UpgradeTierDefinition[];
  seasons: SeasonConfig[];
  endless: EndlessFormula;
  exhaustionThreshold: number;
  exhaustionRecoveryDays: number;
  fertilizerCost: number;
  streakBonusPerLevel: number;
  streakBonusCap: number;
  market: MarketConfig;
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  startingBalance: STARTING_BALANCE,
  startingPlots: STARTING_PLOTS,
  maxPlots: PLOT_COUNT,
  plotPrices: PLOT_PRICES,
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
  market: {
    cadenceDays: MARKET_CADENCE_DAYS,
    fireChance: MARKET_FIRE_CHANCE,
    shortageMultiplier: MARKET_SHORTAGE_MULTIPLIER,
    glutMultiplier: MARKET_GLUT_MULTIPLIER,
    durationDays: MARKET_DURATION_DAYS,
    announceLeadDays: MARKET_ANNOUNCE_LEAD_DAYS,
  },
};
