import {
  SCHEMA_VERSION,
  STARTING_BALANCE,
  PLOT_COUNT,
  LAND_LEASE_FEE,
  MAX_UPGRADE_TIER,
  CROP_DEFINITIONS,
  WEATHER_DEFINITIONS,
  WEATHER_IDS,
  UPGRADE_TIER_DEFINITIONS,
  TAX_RATE,
  coins,
} from './constants';
import type {
  GameState,
  PlotState,
  CropId,
  WeatherId,
  UpgradeTier,
  PlantResult,
  BuyResult,
  UpgradeResult,
  TurnResult,
  DailyLogEntry,
  HarvestEvent,
} from './types';

// ── Factory ───────────────────────────────────────────────────────────────────

/** Returns the canonical starting state for a new game run. */
export function initialGameState(): GameState {
  const plots: PlotState[] = Array.from({ length: PLOT_COUNT }, (_, i) => ({
    id: i,
    cropId: null,
    dayPlanted: null,
    daysRemaining: null,
    consecutiveHarvests: 0,
    exhaustedSinceDay: null,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    currentDay: 1,
    coinBalance: STARTING_BALANCE,
    plots,
    seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
    upgradeTier: 0,
    lastDailyLog: null,
    phase: 'playing',
    peakBalance: STARTING_BALANCE,
    fertilizerInventory: 0,
  };
}

// ── T012: plantSeed ───────────────────────────────────────────────────────────

/** Plants one seed from inventory into an empty plot. Pure — no mutations. */
export function plantSeed(
  state: GameState,
  plotId: number,
  cropId: CropId
): PlantResult {
  if (plotId < 0 || plotId >= PLOT_COUNT) {
    return { ok: false, error: 'invalid_plot' };
  }

  if (state.seedInventory[cropId] === 0) {
    return { ok: false, error: 'no_seed' };
  }

  const plot = state.plots[plotId];
  if (plot.cropId !== null) {
    return { ok: false, error: 'plot_occupied' };
  }

  const crop = CROP_DEFINITIONS[cropId];

  const updatedPlot: PlotState = {
    ...plot,
    cropId,
    dayPlanted: state.currentDay,
    daysRemaining: crop.growthDays,
  };

  return {
    ok: true,
    state: {
      ...state,
      plots: state.plots.map(p => (p.id === plotId ? updatedPlot : p)),
      seedInventory: {
        ...state.seedInventory,
        [cropId]: state.seedInventory[cropId] - 1,
      },
    },
  };
}

// ── T029: computeSeedCost ─────────────────────────────────────────────────────

/** Returns the current purchase price for one seed, applying upgrade discount. */
export function computeSeedCost(cropId: CropId, upgradeTier: UpgradeTier): number {
  const crop = CROP_DEFINITIONS[cropId];
  if (upgradeTier === 0) return crop.baseSeedCost;
  const def = UPGRADE_TIER_DEFINITIONS[upgradeTier - 1];
  return coins(crop.baseSeedCost * (1 - def.cumulativeDiscount));
}

// ── T029: buySeed ─────────────────────────────────────────────────────────────

/** Purchases seeds from the shop. Pure — no mutations. */
export function buySeed(
  state: GameState,
  cropId: CropId,
  quantity: number
): BuyResult {
  const unitCost = computeSeedCost(cropId, state.upgradeTier);
  const totalCost = unitCost * quantity;

  if (state.coinBalance < totalCost) {
    return {
      ok: false,
      error: 'insufficient_funds',
      cost: totalCost,
      balance: state.coinBalance,
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      coinBalance: state.coinBalance - totalCost,
      seedInventory: {
        ...state.seedInventory,
        [cropId]: state.seedInventory[cropId] + quantity,
      },
    },
  };
}

// ── T029: buyUpgrade ──────────────────────────────────────────────────────────

/** Purchases the next tool upgrade tier. Pure — no mutations. */
export function buyUpgrade(state: GameState): UpgradeResult {
  if (state.upgradeTier >= MAX_UPGRADE_TIER) {
    return { ok: false, error: 'max_tier_reached' };
  }

  const nextTier = (state.upgradeTier + 1) as UpgradeTier;
  const def = UPGRADE_TIER_DEFINITIONS[nextTier - 1];

  if (state.coinBalance < def.cost) {
    return { ok: false, error: 'insufficient_funds' };
  }

  return {
    ok: true,
    state: {
      ...state,
      upgradeTier: nextTier,
      coinBalance: state.coinBalance - def.cost,
    },
  };
}

// ── T013/T021: processTurn (FR-002 full 10-step sequence) ────────────────────

/**
 * Executes the full end-of-turn sequence (FR-002).
 * Pass `weatherRoll` in tests for deterministic results; omit in production
 * to use uniform-random weather selection (added in T037, Phase 6).
 */
export function processTurn(
  state: GameState,
  weatherRoll?: WeatherId
): TurnResult {
  // Step 1: Decrement daysRemaining on all occupied plots
  const plots = state.plots.map(plot => {
    if (plot.cropId === null || plot.daysRemaining === null) return plot;
    return { ...plot, daysRemaining: plot.daysRemaining - 1 };
  });

  // Step 2: Resolve weather — inject via weatherRoll for tests, else uniform random
  const weatherId: WeatherId =
    weatherRoll ?? WEATHER_IDS[Math.floor(Math.random() * WEATHER_IDS.length)];
  const weather = WEATHER_DEFINITIONS[weatherId];

  // Step 3: Harvest all plots where daysRemaining === 0
  const harvests: HarvestEvent[] = [];
  const harvestedPlots = plots.map(plot => {
    if (plot.cropId === null || plot.daysRemaining !== 0) return plot;
    const crop = CROP_DEFINITIONS[plot.cropId];
    const adjustedYield = coins(crop.baseYield * weather.multiplier);
    harvests.push({
      plotId: plot.id,
      cropId: plot.cropId,
      baseYield: crop.baseYield,
      weatherMultiplier: weather.multiplier,
      adjustedYield,
    });
    return { ...plot, cropId: null, dayPlanted: null, daysRemaining: null };
  });

  // Step 4: Add harvest income to balance
  const totalHarvestIncome = harvests.reduce(
    (sum, h) => sum + h.adjustedYield,
    0
  );
  const openingBalance = state.coinBalance;
  let coinBalance = openingBalance + totalHarvestIncome;

  // Step 5: Bankruptcy check — if balance < lease fee, game over
  if (coinBalance < LAND_LEASE_FEE) {
    const log: DailyLogEntry = {
      day: state.currentDay,
      weatherId,
      weatherMultiplier: weather.multiplier,
      harvests,
      totalHarvestIncome,
      openingBalance,
      landLeaseDeducted: 0,
      taxRate: TAX_RATE,
      taxDeducted: 0,
      netChange: totalHarvestIncome,
      closingBalance: coinBalance,
    };
    const bankruptState: GameState = {
      ...state,
      plots: harvestedPlots,
      coinBalance,
      phase: 'bankrupt',
      lastDailyLog: log,
    };
    return { state: bankruptState, log, isBankrupt: true };
  }

  // Step 6: Deduct land lease fee
  coinBalance -= LAND_LEASE_FEE;
  const landLeaseDeducted = LAND_LEASE_FEE;

  // Step 7: Compute and deduct tax (5% of post-lease balance, floor-rounded)
  const taxDeducted = coins(coinBalance * TAX_RATE);
  coinBalance -= taxDeducted;

  // Step 8: Increment currentDay
  const currentDay = state.currentDay + 1;

  // Step 9: Update peakBalance
  const peakBalance = Math.max(state.peakBalance, coinBalance);

  // Step 10: Build DailyLogEntry
  const log: DailyLogEntry = {
    day: state.currentDay,
    weatherId,
    weatherMultiplier: weather.multiplier,
    harvests,
    totalHarvestIncome,
    openingBalance,
    landLeaseDeducted,
    taxRate: TAX_RATE,
    taxDeducted,
    netChange: totalHarvestIncome - landLeaseDeducted - taxDeducted,
    closingBalance: coinBalance,
  };

  const nextState: GameState = {
    ...state,
    plots: harvestedPlots,
    coinBalance,
    currentDay,
    peakBalance,
    lastDailyLog: log,
  };

  return { state: nextState, log, isBankrupt: false };
}
