import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';

/** The current live economy — the baseline to measure against. */
export const baseline: EconomyConfig = DEFAULT_ECONOMY;

/** Registry of named configs the CLI can select with --configs. */
export const PRESETS: Record<string, EconomyConfig> = {
  baseline,
};
