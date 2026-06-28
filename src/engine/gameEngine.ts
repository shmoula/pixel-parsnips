import {
  SCHEMA_VERSION,
  WEATHER_DEFINITIONS,
  coins,
} from './constants';
import { DEFAULT_ECONOMY, type EconomyConfig } from './economy';
import { EMPTY_MARKET, activatePending, expireActive, marketMultiplierFor, rollSchedule } from './market';
import { getSeasonForDay, getDisasterBandsForSeason, DISASTER_WEATHER_IDS } from './seasons';
import type {
  GameState,
  PlotState,
  CropId,
  WeatherId,
  UpgradeTier,
  PlantResult,
  BuyPlotResult,
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
export function initialGameState(config: EconomyConfig = DEFAULT_ECONOMY): GameState {
  const plots: PlotState[] = Array.from({ length: config.maxPlots }, (_, i) => ({
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
    coinBalance: config.startingBalance,
    plots,
    seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
    upgradeTier: 0,
    lastDailyLog: null,
    phase: 'playing',
    peakBalance: config.startingBalance,
    fertilizerInventory: 0,
    flashDroughtDaysRemaining: 0,
    endlessMode: false,
    disastersSurvived: 0,
    harvestStreak: 0,
    peakHarvestStreak: 0,
    unlockedPlots: config.startingPlots,
    market: EMPTY_MARKET,
  };
}

// ── T010: plantSeed ───────────────────────────────────────────────────────────

type PlantBlockReason = Extract<PlantResult, { ok: false }>['error'];

/**
 * Returns the reason `plotId` can't be planted, or null if it can.
 * Guard order (precedence) is load-bearing — reviewers and tests depend on it:
 * invalid_plot → plot_locked → plot_occupied → plot_exhausted →
 * plot_pest_damaged → no_seed.
 */
function plantBlockReason(
  state: GameState,
  plotId: number,
  cropId: CropId,
  config: EconomyConfig,
): PlantBlockReason | null {
  if (plotId < 0 || plotId >= config.maxPlots || plotId >= state.plots.length) {
    return 'invalid_plot';
  }
  if (plotId >= state.unlockedPlots) {
    return 'plot_locked';
  }

  const plot = state.plots[plotId];
  if (plot.cropId !== null) {
    return 'plot_occupied';
  }
  // T010: guard after plot_occupied, before no_seed
  if (plot.exhaustedSinceDay !== null) {
    return 'plot_exhausted';
  }
  if (plot.pestDamaged) {
    return 'plot_pest_damaged';
  }
  if (state.seedInventory[cropId] === 0) {
    return 'no_seed';
  }
  return null;
}

/** Plants one seed from inventory into an empty plot. Pure — no mutations. */
export function plantSeed(
  state: GameState,
  plotId: number,
  cropId: CropId,
  config: EconomyConfig = DEFAULT_ECONOMY,
): PlantResult {
  const reason = plantBlockReason(state, plotId, cropId, config);
  if (reason) {
    return { ok: false, error: reason };
  }

  const plot = state.plots[plotId];
  const crop = config.crops[cropId];

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
export function computeSeedCost(
  cropId: CropId, upgradeTier: UpgradeTier, config: EconomyConfig = DEFAULT_ECONOMY,
): number {
  const crop = config.crops[cropId];
  if (upgradeTier === 0) return crop.baseSeedCost;
  const def = config.upgrades[upgradeTier - 1];
  return coins(crop.baseSeedCost * (1 - def.cumulativeDiscount));
}

// ── T029: buySeed ─────────────────────────────────────────────────────────────

/** Purchases seeds from the shop. Pure — no mutations. */
export function buySeed(
  state: GameState,
  cropId: CropId,
  quantity: number,
  config: EconomyConfig = DEFAULT_ECONOMY,
): BuyResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'invalid_quantity' };
  }
  const unitCost = computeSeedCost(cropId, state.upgradeTier, config);
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
export function buyUpgrade(state: GameState, config: EconomyConfig = DEFAULT_ECONOMY): UpgradeResult {
  const maxTier = config.upgrades.length;
  if (state.upgradeTier >= maxTier) {
    return { ok: false, error: 'max_tier_reached' };
  }

  const nextTier = (state.upgradeTier + 1) as UpgradeTier;
  const def = config.upgrades[nextTier - 1];

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

function applySeasonStreakReset(
  streakAfter: number,
  phase: GameState['phase']
): number {
  return phase === 'season_passed' || phase === 'season_4_won' ? 0 : streakAfter;
}

type SeasonEndResult = { phase: GameState['phase']; nextDay: number };

function resolveSeasonEnd(
  currentDayBeforeIncrement: number,
  incrementedDay: number,
  season: ReturnType<typeof getSeasonForDay>,
  coinBalance: number,
  endlessMode: boolean,
): SeasonEndResult {
  if (currentDayBeforeIncrement !== season.endDay) {
    return { phase: 'playing', nextDay: incrementedDay };
  }
  if (coinBalance < season.target) {
    return { phase: 'season_failed', nextDay: currentDayBeforeIncrement };
  }
  if (endlessMode) {
    return { phase: 'playing', nextDay: incrementedDay };
  }
  if (season.number === 4) {
    return { phase: 'season_4_won', nextDay: currentDayBeforeIncrement };
  }
  return { phase: 'season_passed', nextDay: incrementedDay };
}

function computeStreakUpdate(
  streakBefore: number,
  peakBefore: number,
  hadHarvest: boolean,
  bonusCap: number,
  bonusPerLevel: number,
): { streakAfter: number; streakBonus: number; peakHarvestStreak: number } {
  if (!hadHarvest) {
    return { streakAfter: 0, streakBonus: 0, peakHarvestStreak: peakBefore };
  }
  const streakAfter = streakBefore + 1;
  // Bonus is based on the prior streak count, so the first harvest in a streak
  // earns nothing (streakBefore=0). Day 2 of a streak earns +5, day 3 +10, etc.,
  // capped at bonusCap * bonusPerLevel.
  const streakBonus = Math.min(streakBefore, bonusCap) * bonusPerLevel;
  return {
    streakAfter,
    streakBonus,
    peakHarvestStreak: Math.max(peakBefore, streakAfter),
  };
}

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
  weatherRollOverride?: number,
  config: EconomyConfig = DEFAULT_ECONOMY,
  rng: () => number = Math.random,
): TurnResult {
  // Compute season once — reused for both lease and weather band selection
  const season = getSeasonForDay(state.currentDay, config);

  // Market Step A: activate any pending event so its modifier applies to THIS harvest.
  const marketAfterActivate = activatePending(state.market, config.market);
  const activeMarket = marketAfterActivate.active;

  // Step 1: Decrement daysRemaining on all occupied plots
  const plots = state.plots.map(plot => {
    if (plot.cropId === null || plot.daysRemaining === null) return plot;
    return { ...plot, daysRemaining: plot.daysRemaining - 1 };
  });

  // Step 2: Resolve weather — inject via weatherRoll for tests, else seasonal-band random
  const weatherId: WeatherId = (() => {
    if (weatherRoll) return weatherRoll;
    const bands = getDisasterBandsForSeason(season);
    const roll = weatherRollOverride ?? rng();
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
        : rng() < 0.5;
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
    const crop = config.crops[plot.cropId];
    const marketMod = marketMultiplierFor(activeMarket, plot.cropId);
    const adjustedYield = coins(crop.baseYield * weather.multiplier * marketMod);
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
    if (newConsecutiveHarvests >= config.exhaustionThreshold) {
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

  // Step 4.5: Harvest streak update — bonus counts toward bankruptcy avoidance
  const streakBefore = state.harvestStreak;
  const { streakAfter, streakBonus, peakHarvestStreak } = computeStreakUpdate(
    streakBefore,
    state.peakHarvestStreak,
    harvests.length > 0,
    config.streakBonusCap,
    config.streakBonusPerLevel,
  );
  coinBalance += streakBonus;

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
      taxRate: config.taxRate,
      taxDeducted: 0,
      netChange: coinBalance - openingBalance,
      closingBalance: coinBalance,
      exhaustedPlots,
      pestDestroyedPlots,
      flashDroughtDaysAfter: flashDroughtDaysAfterEvent,
      streakBefore,
      streakAfter,
      streakBonus,
      marketActive: activeMarket,
      marketAnnounced: null,
    };
    const bankruptState: GameState = {
      ...state,
      plots: harvestedPlots,
      coinBalance,
      phase: 'bankrupt',
      flashDroughtDaysRemaining: flashDroughtDaysAfterEvent,
      lastDailyLog: log,
      harvestStreak: streakAfter,
      peakHarvestStreak,
      market: marketAfterActivate,
    };
    return { state: bankruptState, log, isBankrupt: true };
  }

  // Step 6: Deduct land lease fee
  coinBalance -= leaseForDay;
  const landLeaseDeducted = leaseForDay;

  // Step 7: Compute and deduct tax (5% of post-lease balance, floor-rounded)
  const taxDeducted = coins(coinBalance * config.taxRate);
  coinBalance -= taxDeducted;

  // Step 8: Increment currentDay
  const currentDay = state.currentDay + 1;

  // Step 8.4: Season-end check
  const { phase: seasonPhase, nextDay: nextDayAfterTransition } = resolveSeasonEnd(
    state.currentDay,
    currentDay,
    season,
    coinBalance,
    state.endlessMode,
  );

  // Step 8.4b: Reset harvest streak when a season is cleared (not on season_failed,
  // since the run is ending and the final log should reflect the as-played streak).
  const harvestStreakAfterSeason = applySeasonStreakReset(streakAfter, seasonPhase);

  // Step 8.6: Decrement flash drought counter each calendar day EXCEPT the turn it fires
  // (skip on flash_drought turn so N+1 and N+2 planting days both receive the penalty)
  const flashDroughtDaysRemaining = (weatherId !== 'flash_drought' && flashDroughtDaysAfterEvent > 0)
    ? flashDroughtDaysAfterEvent - 1
    : flashDroughtDaysAfterEvent;

  // Step 8.5: Natural recovery — clear exhaustion after EXHAUSTION_RECOVERY_DAYS turns
  const recoveredPlots = harvestedPlots.map(plot => {
    if (plot.exhaustedSinceDay === null) return plot;
    if (currentDay - plot.exhaustedSinceDay >= config.exhaustionRecoveryDays) {
      return { ...plot, exhaustedSinceDay: null, consecutiveHarvests: 0 };
    }
    return plot;
  });

  // Step 9: Update peakBalance
  const peakBalance = Math.max(state.peakBalance, coinBalance);

  // Market Step B: expire the active event, then maybe schedule a new one at a boundary.
  const activeAfterExpire = expireActive(activeMarket);
  const scheduled = rollSchedule(
    { active: activeAfterExpire, pending: null },
    state.currentDay,
    config.market,
    rng,
  );
  const nextMarket = { active: activeAfterExpire, pending: scheduled };

  // Step 10: Build DailyLogEntry
  const log: DailyLogEntry = {
    day: state.currentDay,
    weatherId,
    weatherMultiplier: weather.multiplier,
    harvests,
    totalHarvestIncome,
    openingBalance,
    landLeaseDeducted,
    taxRate: config.taxRate,
    taxDeducted,
    netChange: coinBalance - openingBalance,
    closingBalance: coinBalance,
    exhaustedPlots,
    pestDestroyedPlots,
    flashDroughtDaysAfter: flashDroughtDaysRemaining,
    streakBefore,
    streakAfter: harvestStreakAfterSeason,
    streakBonus,
    marketActive: activeMarket,
    marketAnnounced: scheduled,
  };

  // Step 9.5: Increment disastersSurvived if this turn's weather was a disaster
  //           AND the run did not bankrupt this turn.
  const isDisasterTurn = (DISASTER_WEATHER_IDS as readonly string[]).includes(weatherId);
  const disastersSurvived = state.disastersSurvived + (isDisasterTurn ? 1 : 0);

  const nextState: GameState = {
    ...state,
    plots: recoveredPlots,
    coinBalance,
    currentDay: nextDayAfterTransition,
    flashDroughtDaysRemaining,
    peakBalance,
    lastDailyLog: log,
    phase: seasonPhase,
    disastersSurvived,
    harvestStreak: harvestStreakAfterSeason,
    peakHarvestStreak,
    market: nextMarket,
  };

  return { state: nextState, log, isBankrupt: false };
}

// ── clearPestDamage (stub — implemented in T013) ──────────────────────────────

/** Removes Pest Damage state from a plot, making it plantable again. Pure — no mutations. */
export function clearPestDamage(
  state: GameState,
  plotId: number,
  config: EconomyConfig = DEFAULT_ECONOMY
): ClearPestDamageResult {
  if (plotId < 0 || plotId >= config.maxPlots || plotId >= state.plots.length) {
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
export function buyFertilizer(state: GameState, quantity: number, config: EconomyConfig = DEFAULT_ECONOMY): BuyResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'invalid_quantity' };
  }
  const totalCost = config.fertilizerCost * quantity;

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

// ── buyPlot ───────────────────────────────────────────────────────────────────

/** Canonical price of the next purchasable plot, or null when all plots are unlocked. */
export function getNextPlotPrice(state: GameState, config: EconomyConfig = DEFAULT_ECONOMY): number | null {
  if (state.unlockedPlots >= config.maxPlots) return null;
  return config.plotPrices[state.unlockedPlots - config.startingPlots] ?? null;
}

/**
 * True when advancing a day can produce value: a crop is planted and growing on
 * a plot. A seed merely held in inventory does NOT count — an unplanted seed
 * grows nothing when the day advances, so advancing only burns lease + tax (the
 * empty-day bankruptcy trap) and the UI should warn ("Plant seeds first") until
 * something is actually planted.
 */
export function canAdvanceProductively(state: GameState): boolean {
  return state.plots.some(p => p.cropId !== null);
}

/** Unlocks the next farm plot at its escalating price. Pure — no mutations. */
export function buyPlot(state: GameState, config: EconomyConfig = DEFAULT_ECONOMY): BuyPlotResult {
  if (state.unlockedPlots >= config.maxPlots) {
    return { ok: false, error: 'max_plots_reached' };
  }
  const price = getNextPlotPrice(state, config);
  if (price === null || state.coinBalance < price) {
    return { ok: false, error: 'insufficient_funds' };
  }
  return {
    ok: true,
    state: {
      ...state,
      coinBalance: state.coinBalance - price,
      unlockedPlots: state.unlockedPlots + 1,
    },
  };
}

// ── T015: applyFertilizer ─────────────────────────────────────────────────────

/** Applies fertilizer to an exhausted plot, immediately restoring it. Pure — no mutations. */
export function applyFertilizer(state: GameState, plotId: number, config: EconomyConfig = DEFAULT_ECONOMY): FertilizerResult {
  if (plotId < 0 || plotId >= config.maxPlots || plotId >= state.plots.length) {
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
