import {
  SCHEMA_VERSION,
  STARTING_BALANCE,
  PLOT_COUNT,
  MAX_UPGRADE_TIER,
  CROP_DEFINITIONS,
  WEATHER_DEFINITIONS,
  UPGRADE_TIER_DEFINITIONS,
  TAX_RATE,
  EXHAUSTION_THRESHOLD,
  EXHAUSTION_RECOVERY_DAYS,
  FERTILIZER_COST,
  coins,
} from './constants';
import { getSeasonForDay, getDisasterBandsForSeason } from './seasons';
import type {
  GameState,
  PlotState,
  CropId,
  WeatherId,
  UpgradeTier,
  PlantResult,
  BuyResult,
  UpgradeResult,
  FertilizerResult,
  ClearPestDamageResult,
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
    pestDamaged: false,
    droughtPenalised: false,
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
    flashDroughtDaysRemaining: 0,
    endlessMode: false,
  };
}

// ── T010: plantSeed ───────────────────────────────────────────────────────────

/** Plants one seed from inventory into an empty plot. Pure — no mutations. */
export function plantSeed(
  state: GameState,
  plotId: number,
  cropId: CropId
): PlantResult {
  if (plotId < 0 || plotId >= PLOT_COUNT) {
    return { ok: false, error: 'invalid_plot' };
  }

  const plot = state.plots[plotId];
  if (plot.cropId !== null) {
    return { ok: false, error: 'plot_occupied' };
  }

  // T010: guard after plot_occupied, before no_seed
  if (plot.exhaustedSinceDay !== null) {
    return { ok: false, error: 'plot_exhausted' };
  }

  if (plot.pestDamaged) {
    return { ok: false, error: 'plot_pest_damaged' };
  }

  if (state.seedInventory[cropId] === 0) {
    return { ok: false, error: 'no_seed' };
  }

  const crop = CROP_DEFINITIONS[cropId];

  // Apply Flash Drought growth penalty at planting time (FR-006)
  const isDroughtActive = state.flashDroughtDaysRemaining > 0;
  const updatedPlot: PlotState = {
    ...plot,
    cropId,
    dayPlanted: state.currentDay,
    daysRemaining: isDroughtActive ? Math.ceil(crop.growthDays * 2) : crop.growthDays,
    droughtPenalised: isDroughtActive,
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
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'invalid_quantity' };
  }
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

// ── T008/T009: processTurn (FR-002 full 10-step sequence + 3a/3b/8.5) ────────

/**
 * Executes the full end-of-turn sequence (FR-002).
 * Pass `weatherRoll` in tests for deterministic weather; omit in production.
 * Pass `pestDestructionOverride` (plot ID array) for deterministic pest tests;
 * omit in production to use random 50% rolls per occupied plot.
 */
export function processTurn(
  state: GameState,
  weatherRoll?: WeatherId,
  pestDestructionOverride?: number[],
  weatherRollOverride?: number
): TurnResult {
  // Compute season once — reused for both lease and weather band selection
  const season = getSeasonForDay(state.currentDay);

  // Step 1: Decrement daysRemaining on all occupied plots
  const plots = state.plots.map(plot => {
    if (plot.cropId === null || plot.daysRemaining === null) return plot;
    return { ...plot, daysRemaining: plot.daysRemaining - 1 };
  });

  // Step 2: Resolve weather — inject via weatherRoll for tests, else seasonal-band random
  const weatherId: WeatherId = (() => {
    if (weatherRoll) return weatherRoll;
    const bands = getDisasterBandsForSeason(season);
    const roll = weatherRollOverride ?? Math.random();
    for (const band of bands) {
      if (roll < band.threshold) return band.id;
    }
    return 'perfect_sun';
  })();
  const weather = WEATHER_DEFINITIONS[weatherId];

  // Step 2a: Pest Infestation — destroy occupied plots before harvest (FR-004)
  const pestDestroyedPlots: number[] = [];
  const plotsAfterPest = (() => {
    if (weatherId !== 'pest_infestation') return plots;
    return plots.map(plot => {
      if (plot.cropId === null) return plot; // empty/exhausted plots immune
      const isDestroyed = pestDestructionOverride !== undefined
        ? pestDestructionOverride.includes(plot.id)
        : Math.random() < 0.5;
      if (isDestroyed) {
        pestDestroyedPlots.push(plot.id);
        return {
          ...plot,
          cropId: null,
          daysRemaining: null,
          dayPlanted: null,
          droughtPenalised: false,
          consecutiveHarvests: 0,
          exhaustedSinceDay: null,
          pestDamaged: true,
        };
      }
      return plot;
    });
  })();

  // Step 2b: Flash Drought — set counter to +2 when event fires (stacks)
  const flashDroughtDaysAfterEvent = weatherId === 'flash_drought'
    ? state.flashDroughtDaysRemaining + 2
    : state.flashDroughtDaysRemaining;

  // Step 3: Harvest all plots where daysRemaining === 0
  // Sub-step 3a: increment consecutiveHarvests per harvested plot
  // Sub-step 3b: trigger exhaustion when consecutiveHarvests >= EXHAUSTION_THRESHOLD
  const harvests: HarvestEvent[] = [];
  const exhaustedPlots: number[] = [];
  const harvestedPlots = plotsAfterPest.map(plot => {
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
    // Sub-step 3a: increment counter
    const newConsecutiveHarvests = plot.consecutiveHarvests + 1;
    // Sub-step 3b: trigger exhaustion if threshold reached
    if (newConsecutiveHarvests >= EXHAUSTION_THRESHOLD) {
      exhaustedPlots.push(plot.id);
      return {
        ...plot,
        cropId: null,
        dayPlanted: null,
        daysRemaining: null,
        droughtPenalised: false,
        consecutiveHarvests: 0,
        exhaustedSinceDay: state.currentDay + 1, // post-increment day
      };
    }
    return {
      ...plot,
      cropId: null,
      dayPlanted: null,
      daysRemaining: null,
      droughtPenalised: false,
      consecutiveHarvests: newConsecutiveHarvests,
    };
  });

  // Step 4: Add harvest income to balance
  const totalHarvestIncome = harvests.reduce(
    (sum, h) => sum + h.adjustedYield,
    0
  );
  const openingBalance = state.coinBalance;
  let coinBalance = openingBalance + totalHarvestIncome;

  // Step 5: Bankruptcy check — if balance < lease fee, game over
  const leaseForDay = season.leasePerDay;
  if (coinBalance < leaseForDay) {
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
      exhaustedPlots,
      pestDestroyedPlots,
      flashDroughtDaysAfter: flashDroughtDaysAfterEvent,
    };
    const bankruptState: GameState = {
      ...state,
      plots: harvestedPlots,
      coinBalance,
      phase: 'bankrupt',
      flashDroughtDaysRemaining: flashDroughtDaysAfterEvent,
      lastDailyLog: log,
    };
    return { state: bankruptState, log, isBankrupt: true };
  }

  // Step 6: Deduct land lease fee
  coinBalance -= leaseForDay;
  const landLeaseDeducted = leaseForDay;

  // Step 7: Compute and deduct tax (5% of post-lease balance, floor-rounded)
  const taxDeducted = coins(coinBalance * TAX_RATE);
  coinBalance -= taxDeducted;

  // Step 8: Increment currentDay
  const currentDay = state.currentDay + 1;

  // Step 8.4: Season-end check
  let seasonPhase: GameState['phase'] = 'playing';
  let nextDayAfterTransition = currentDay; // 'currentDay' here is the already-incremented value
  if (state.currentDay === season.endDay) {
    if (coinBalance >= season.target) {
      // Target met
      if (state.endlessMode) {
        // Endless mode: silent advance, no transition modal
        seasonPhase = 'playing';
      } else if (season.number === 4) {
        seasonPhase = 'season_4_won';
        nextDayAfterTransition = state.currentDay; // wait for player choice
      } else {
        seasonPhase = 'season_passed';
        // currentDay was already incremented in Step 8
      }
    } else {
      // Target missed — applies regardless of endlessMode
      seasonPhase = 'season_failed';
      nextDayAfterTransition = state.currentDay;
    }
  }

  // Step 8.6: Decrement flash drought counter each calendar day EXCEPT the turn it fires
  // (skip on flash_drought turn so N+1 and N+2 planting days both receive the penalty)
  const flashDroughtDaysRemaining = (weatherId !== 'flash_drought' && flashDroughtDaysAfterEvent > 0)
    ? flashDroughtDaysAfterEvent - 1
    : flashDroughtDaysAfterEvent;

  // Step 8.5: Natural recovery — clear exhaustion after EXHAUSTION_RECOVERY_DAYS turns
  const recoveredPlots = harvestedPlots.map(plot => {
    if (plot.exhaustedSinceDay === null) return plot;
    if (currentDay - plot.exhaustedSinceDay >= EXHAUSTION_RECOVERY_DAYS) {
      return { ...plot, exhaustedSinceDay: null, consecutiveHarvests: 0 };
    }
    return plot;
  });

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
    exhaustedPlots,
    pestDestroyedPlots,
    flashDroughtDaysAfter: flashDroughtDaysRemaining,
  };

  const nextState: GameState = {
    ...state,
    plots: recoveredPlots,
    coinBalance,
    currentDay: nextDayAfterTransition,
    flashDroughtDaysRemaining,
    peakBalance,
    lastDailyLog: log,
    phase: seasonPhase,
  };

  return { state: nextState, log, isBankrupt: false };
}

// ── clearPestDamage (stub — implemented in T013) ──────────────────────────────

/** Removes Pest Damage state from a plot, making it plantable again. Pure — no mutations. */
export function clearPestDamage(
  state: GameState,
  plotId: number
): ClearPestDamageResult {
  if (plotId < 0 || plotId >= PLOT_COUNT) {
    return { ok: false, error: 'invalid_plot' };
  }

  const plot = state.plots[plotId];
  if (!plot.pestDamaged) {
    return { ok: false, error: 'plot_not_pest_damaged' };
  }

  return {
    ok: true,
    state: {
      ...state,
      plots: state.plots.map(p =>
        p.id === plotId ? { ...p, pestDamaged: false } : p
      ),
    },
  };
}

// ── T014: buyFertilizer ───────────────────────────────────────────────────────

/** Purchases fertilizer from the shop. Pure — no mutations. */
export function buyFertilizer(state: GameState, quantity: number): BuyResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'invalid_quantity' };
  }
  const totalCost = FERTILIZER_COST * quantity;

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
      fertilizerInventory: state.fertilizerInventory + quantity,
    },
  };
}

// ── T015: applyFertilizer ─────────────────────────────────────────────────────

/** Applies fertilizer to an exhausted plot, immediately restoring it. Pure — no mutations. */
export function applyFertilizer(state: GameState, plotId: number): FertilizerResult {
  if (plotId < 0 || plotId >= PLOT_COUNT) {
    return { ok: false, error: 'invalid_plot' };
  }

  const plot = state.plots[plotId];
  if (plot.exhaustedSinceDay === null) {
    return { ok: false, error: 'plot_not_exhausted' };
  }

  if (state.fertilizerInventory === 0) {
    return { ok: false, error: 'no_fertilizer' };
  }

  const restoredPlot: PlotState = {
    ...plot,
    exhaustedSinceDay: null,
    consecutiveHarvests: 0,
    cropId: null,
    dayPlanted: null,
    daysRemaining: null,
  };

  return {
    ok: true,
    state: {
      ...state,
      plots: state.plots.map(p => (p.id === plotId ? restoredPlot : p)),
      fertilizerInventory: state.fertilizerInventory - 1,
    },
  };
}
