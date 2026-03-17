// ── Discriminated union types ─────────────────────────────────────────────────

export type CropId = 'radish' | 'parsnip' | 'pumpkin';

export type WeatherId =
  | 'drought'
  | 'overcast'
  | 'sunny'
  | 'warm_breeze'
  | 'perfect_sun';

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
}

export interface GameState {
  schemaVersion: number;
  currentDay: number;
  coinBalance: number;
  plots: PlotState[];
  seedInventory: SeedInventory;
  upgradeTier: UpgradeTier;
  lastDailyLog: DailyLogEntry | null;
  phase: 'playing' | 'bankrupt';
  peakBalance: number;
  fertilizerInventory: number;
}

// ── Engine result types ───────────────────────────────────────────────────────

export type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'invalid_plot' };

export type FertilizerResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_fertilizer' | 'plot_not_exhausted' | 'invalid_plot' };

export type BuyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds'; cost: number; balance: number };

export type UpgradeResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds' | 'max_tier_reached' };

export interface TurnResult {
  state: GameState;
  log: DailyLogEntry;
  isBankrupt: boolean;
}
