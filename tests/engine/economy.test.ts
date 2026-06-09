import { describe, it, expect } from 'vitest';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import {
  STARTING_BALANCE, PLOT_COUNT, STARTING_PLOTS, PLOT_PRICES, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from '../../src/engine/constants';
import { SEASON_TABLE } from '../../src/engine/seasons';

describe('DEFAULT_ECONOMY', () => {
  it('mirrors the current live constants exactly', () => {
    expect(DEFAULT_ECONOMY.startingBalance).toBe(STARTING_BALANCE);
    expect(DEFAULT_ECONOMY.startingPlots).toBe(STARTING_PLOTS);
    expect(DEFAULT_ECONOMY.maxPlots).toBe(PLOT_COUNT);
    expect(DEFAULT_ECONOMY.plotPrices).toBe(PLOT_PRICES);
    expect(DEFAULT_ECONOMY.taxRate).toBe(TAX_RATE);
    expect(DEFAULT_ECONOMY.fertilizerCost).toBe(FERTILIZER_COST);
    expect(DEFAULT_ECONOMY.exhaustionThreshold).toBe(EXHAUSTION_THRESHOLD);
    expect(DEFAULT_ECONOMY.exhaustionRecoveryDays).toBe(EXHAUSTION_RECOVERY_DAYS);
    expect(DEFAULT_ECONOMY.streakBonusPerLevel).toBe(STREAK_BONUS_PER_LEVEL);
    expect(DEFAULT_ECONOMY.streakBonusCap).toBe(STREAK_BONUS_CAP);
    expect(DEFAULT_ECONOMY.crops).toBe(CROP_DEFINITIONS);
    expect(DEFAULT_ECONOMY.upgrades).toBe(UPGRADE_TIER_DEFINITIONS);
    expect(DEFAULT_ECONOMY.seasons).toBe(SEASON_TABLE);
  });

  it('encodes the endless formula coefficients used today', () => {
    expect(DEFAULT_ECONOMY.endless.leaseBase).toBe(30);
    expect(DEFAULT_ECONOMY.endless.leasePerSeason).toBe(2);
    expect(DEFAULT_ECONOMY.endless.disasterBase).toBe(0.35);
    expect(DEFAULT_ECONOMY.endless.disasterPerSeason).toBe(0.02);
    expect(DEFAULT_ECONOMY.endless.disasterCap).toBe(0.50);
    expect(DEFAULT_ECONOMY.endless.targetBase).toBe(600);
    expect(DEFAULT_ECONOMY.endless.targetPerSeason).toBe(200);
  });
});
