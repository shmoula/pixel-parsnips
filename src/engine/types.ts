// ── Discriminated union types ─────────────────────────────────────────────────

export type CropId = 'radish' | 'parsnip' | 'pumpkin';

export type WeatherId =
  | 'drought'
  | 'overcast'
  | 'sunny'
  | 'warm_breeze'
  | 'perfect_sun'
  | 'blight'
  | 'pest_infestation'
  | 'flash_drought';

export type UpgradeTier = 0 | 1 | 2 | 3;

// ── Definition records (constants — never mutated) ────────────────────────────

export interface CropDefinition {
  id: CropId;
  name: string;
  growthDays: number;
  baseSeedCost: number;
  baseYield: number;
}

export interface WeatherDefinition {
  id: WeatherId;
  name: string;
  multiplier: number;
  description: string;
}

export interface UpgradeTierDefinition {
  tier: 1 | 2 | 3;
  label: string;
  cost: number;
  cumulativeDiscount: number;
}

// ── Mutable game state ────────────────────────────────────────────────────────

export interface PlotState {
  id: number;
  cropId: CropId | null;
  dayPlanted: number | null;
  daysRemaining: number | null;
  consecutiveHarvests: number;
  exhaustedSinceDay: number | null;
  /** Plot was destroyed by Pest Infestation; blocks planting until cleared. */
  pestDamaged: boolean;
  /** Crop was planted during an active Flash Drought window; growth time was doubled. */
  droughtPenalised: boolean;
}

export interface SeedInventory {
  radish: number;
  parsnip: number;
  pumpkin: number;
}

export interface HarvestEvent {
  plotId: number;
  cropId: CropId;
  baseYield: number;
  weatherMultiplier: number;
  adjustedYield: number;
}

export interface DailyLogEntry {
  day: number;
  weatherId: WeatherId;
  weatherMultiplier: number;
  harvests: HarvestEvent[];
  totalHarvestIncome: number;
  openingBalance: number;
  landLeaseDeducted: number;
  taxRate: number;
  taxDeducted: number;
  netChange: number;
  closingBalance: number;
  exhaustedPlots: number[];
  /** Plot IDs destroyed by Pest Infestation this turn; empty array on non-pest turns. */
  pestDestroyedPlots: number[];
  /** Value of flashDroughtDaysRemaining at end of turn processing; 0 when inactive. */
  flashDroughtDaysAfter: number;
}

export interface GameState {
  schemaVersion: number;
  currentDay: number;
  coinBalance: number;
  plots: PlotState[];
  seedInventory: SeedInventory;
  upgradeTier: UpgradeTier;
  lastDailyLog: DailyLogEntry | null;
  phase: 'playing' | 'bankrupt'
       | 'season_passed' | 'season_4_won' | 'season_failed';
  peakBalance: number;
  fertilizerInventory: number;
  /** Calendar days remaining in the active Flash Drought window (0 = inactive). */
  flashDroughtDaysRemaining: number;
  /** True after the player accepts "Continue" on the Season 4 victory screen.
   *  Disables further target checks; lease/disaster keep escalating per formula. */
  endlessMode: boolean;
}

// ── Engine result types ───────────────────────────────────────────────────────

export type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'plot_pest_damaged' | 'invalid_plot' };

export type FertilizerResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_fertilizer' | 'plot_not_exhausted' | 'invalid_plot' };

export type BuyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds'; cost: number; balance: number }
  | { ok: false; error: 'invalid_quantity' };

export type UpgradeResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds' | 'max_tier_reached' };

export type ClearPestDamageResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'plot_not_pest_damaged' | 'invalid_plot' };

export interface TurnResult {
  state: GameState;
  log: DailyLogEntry;
  isBankrupt: boolean;
}
