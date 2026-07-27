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

// ── Farm Events (022) ─────────────────────────────────────────────────────────

export type FarmEventId =
  | 'traveling_merchant'
  | 'bountiful_spring'
  | 'drought_warning'
  | 'millers_order'
  | 'fair_committee'
  | 'wandering_beekeeper';

export type FarmEventChoiceId = 'A' | 'B';

/** Authored effect payloads (catalog data). `weather_pin` is fire-time-only. */
export type FarmEventEffectSpec =
  | { kind: 'coins_delta'; amount: number }
  | { kind: 'sell_standing_crops'; priceFactor: number }
  | { kind: 'yield_buff'; multiplier: number; harvests: number; exhaustionFactor: number }
  | { kind: 'seed_discount'; cropId: CropId; factor: number }
  | { kind: 'weather_pin'; weatherId: WeatherId; chance: number; minOffsetDays: number; maxOffsetDays: number }
  | { kind: 'contract'; cropId: CropId; quantity: number; deadlineDays: number; reward: number };

/** Live, serialized effects with counters — resolved from specs at choice/fire time. */
export type FarmEventEffect =
  | { kind: 'yield_buff'; eventId: FarmEventId; multiplier: number; harvestsRemaining: number; exhaustionFactor: number }
  | { kind: 'seed_discount'; cropId: CropId; factor: number; expiresAfterDay: number }
  | { kind: 'weather_pin'; weatherId: WeatherId; day: number };

export interface ContractState {
  eventId: FarmEventId;
  cropId: CropId;
  /** Total harvests required (frozen at accept time). */
  quantity: number;
  /** Harvests still owed. */
  remaining: number;
  /** Last calendar day on which the contract can complete. */
  deadlineDay: number;
  reward: number;
}

export interface FarmEventChoice {
  label: string;
  /** One-line mechanical summary rendered under the label. */
  summary: string;
  effects: FarmEventEffectSpec[];
}

export interface FarmEventDefinition {
  id: FarmEventId;
  emoji: string;
  title: string;
  body: string;
  /** Fire-time effects applied before any choice (weather_pin only — Drought Warning). */
  onFire?: FarmEventEffectSpec[];
  choiceA: FarmEventChoice;
  /** By catalog convention, B is always the decline/safe side (the auto-resolve target). */
  choiceB: FarmEventChoice;
}

export interface FarmEventsState {
  /** False on a device's first run (new-player gating); frozen at run creation. */
  enabled: boolean;
  /** Season number the schedule below was drawn for; 0 = never drawn. */
  scheduleSeason: number;
  scheduledDays: number[];
  pending: { eventId: FarmEventId; firedDay: number } | null;
  activeEffects: FarmEventEffect[];
  contract: ContractState | null;
  /** No-repeat pool for this run; resets when every catalog id has been seen. */
  seenIds: FarmEventId[];
  /** Most recent resolution, for the analytics render-diff hook. */
  lastResolved: { eventId: FarmEventId; choice: FarmEventChoiceId; day: number; auto: boolean } | null;
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
  /** Occupied plots when Pest Infestation struck (before destruction); 0 on non-pest turns.
   *  Lets the banner tell an empty board ("no crops were growing") apart from an
   *  all-spared board ("every plot survived") when pestDestroyedPlots is empty. */
  pestPlotsAtRisk: number;
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
  /** Effective exhaustion-recovery period (in days) in force the turn this log was
   *  written: 2 with a Compost Bin, 3 without. Snapshotted (not derived from live
   *  state) so reopening "Last Turn" after buying a Compost Bin still shows the
   *  period that actually applied. Optional for pre-schema-9 logs that predate it. */
  recoveryDays?: number;
  /** Yield buffs that boosted THIS turn's harvests (022); absent/empty on unbuffed turns. */
  eventBuffsApplied?: Array<{ eventId: FarmEventId; multiplier: number; harvestsAffected: number }>;
  /** Live contract snapshot after this turn's accounting, or null. */
  contractProgress?: { cropId: CropId; done: number; total: number; deadlineDay: number } | null;
  /** Contract delivered this turn (reward already in closingBalance), or null. */
  contractCompleted?: { eventId: FarmEventId; reward: number } | null;
  /** Contract that ran out of time this turn (no penalty), or null. */
  contractExpired?: FarmEventId | null;
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
  /** In-run narrative events state (022). */
  farmEvents: FarmEventsState;
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
