import {
  SCHEMA_VERSION,
  STARTING_BALANCE,
  PLOT_COUNT,
} from './constants';
import type { GameState, PlotState } from './types';

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
