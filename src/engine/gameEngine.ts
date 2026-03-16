import {
  SCHEMA_VERSION,
  STARTING_BALANCE,
  PLOT_COUNT,
  CROP_DEFINITIONS,
  WEATHER_DEFINITIONS,
  TAX_RATE,
  coins,
} from './constants';
import type {
  GameState,
  PlotState,
  CropId,
  WeatherId,
  PlantResult,
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

// ── T013: processTurn (US1 — harvest only; lease/tax/bankruptcy added in T021) ─

/**
 * Executes the end-of-turn sequence.
 *
 * Phase 3 implements steps 1–4 and 8–10 (crop growth + harvest).
 * Steps 5–7 (bankruptcy check, lease, tax) are added in T021 (Phase 4).
 * Pass `weatherRoll` in tests for deterministic results; omit in production.
 */
export function processTurn(
  state: GameState,
  weatherRoll: WeatherId = 'sunny'
): TurnResult {
  // Step 1: Decrement daysRemaining on all occupied plots
  const plots = state.plots.map(plot => {
    if (plot.cropId === null || plot.daysRemaining === null) return plot;
    return { ...plot, daysRemaining: plot.daysRemaining - 1 };
  });

  // Step 2: Resolve weather
  const weatherId = weatherRoll;
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
  const coinBalance = openingBalance + totalHarvestIncome;

  // Steps 5–7 (lease deduction, tax, bankruptcy) will be added in T021.
  // Stubs: deductions are 0 so balance is unchanged beyond harvest income.
  const landLeaseDeducted = 0;
  const taxDeducted = 0;

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
