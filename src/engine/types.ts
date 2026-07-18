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

export type BuildingId =
  | 'toolshed'
  | 'compost_bin'
  | 'irrigation_well'
  | 'scarecrow'
  | 'farm_stand';

export type MarketEventKind = 'shortage' | 'glut';

/** A scheduled or active market event affecting one crop's yield. */
export interface MarketEvent {
  cropId: CropId;
  kind: MarketEventKind;
  /** Resolved yield multiplier captured at schedule time (>1 shortage, <1 glut). */
  multiplier: number;
}

/** A market event currently affecting harvests, with its remaining lifetime. */
export interface ActiveMarketEvent extends MarketEvent {
  daysRemaining: number;
}

/** The run's market: at most one of active/pending is set (one-at-a-time invariant). */
export interface MarketState {
  active: ActiveMarketEvent | null;
  pending: MarketEvent | null;
}

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

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  emoji: string;
  cost: number;
  /** Plain-language card copy, not percentages alone. */
  description: string;
  /** First season the building is purchasable; 1 = from day 1. */
  unlockSeason: number;
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
  /** Value of harvestStreak at start of turn (before increment/reset). */
  streakBefore: number;
  /** Value of harvestStreak at end of turn (after increment/reset and any season-end reset). */
  streakAfter: number;
  /** Coins awarded this turn from streak bonus; 0 when no harvest occurred. */
  streakBonus: number;
  /** Active market event affecting THIS turn's harvest (post-activation), or null. */
  marketActive: ActiveMarketEvent | null;
  /** Event scheduled THIS turn to take effect next turn, or null. */
  marketAnnounced: MarketEvent | null;
  /** Disaster mitigations in effect this turn: subset of {irrigation_well, scarecrow}.
   *  Logged (not derived from live state) so reopening "Last Turn" after buying a
   *  building can't show a mitigation that didn't happen. */
  buildingsApplied: BuildingId[];
}

export interface GameState {
  schemaVersion: number;
  currentDay: number;
  coinBalance: number;
  plots: PlotState[];
  seedInventory: SeedInventory;
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
  /** Count of disaster days (blight, pest_infestation, flash_drought) the run survived without bankruptcy. */
  disastersSurvived: number;
  /** Uncapped consecutive-harvest-day counter. Bonus is min(streak, 4) * 5. */
  harvestStreak: number;
  /** Highest harvestStreak value reached this run; used for the persistent-best record. */
  peakHarvestStreak: number;
  /** Number of plots currently usable (indices 0..unlockedPlots-1). Plots beyond are locked. */
  unlockedPlots: number;
  /** Dynamic crop-pricing state (G7). At most one of active/pending is set. */
  market: MarketState;
  /** One-time farm buildings owned this run (019). All false on a new run. */
  buildings: Record<BuildingId, boolean>;
}

// ── Engine result types ───────────────────────────────────────────────────────

export type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'plot_pest_damaged' | 'plot_locked' | 'invalid_plot' };

export type BuyPlotResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'max_plots_reached' | 'insufficient_funds' };

export type FertilizerResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_fertilizer' | 'plot_not_exhausted' | 'invalid_plot' };

export type BuyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'insufficient_funds'; cost: number; balance: number }
  | { ok: false; error: 'invalid_quantity' };

export type ClearPestDamageResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'plot_not_pest_damaged' | 'invalid_plot' };

export type BuyBuildingResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'invalid_id' | 'already_owned' | 'not_unlocked' | 'insufficient_funds' };

export interface TurnResult {
  state: GameState;
  log: DailyLogEntry;
  isBankrupt: boolean;
}
