import type {
  CropDefinition,
  CropId,
  WeatherDefinition,
  WeatherId,
  BuildingDefinition,
  BuildingId,
} from './types';

// ── Scalar constants ──────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 9;
export const STARTING_BALANCE = 130;
export const PLOT_COUNT = 12;
export const STARTING_PLOTS = 4;
export const PLOT_PRICES = [30, 55, 85, 120, 160, 210, 280, 360];
export const TAX_RATE = 0.06;
export const EXHAUSTION_THRESHOLD = 3;
export const EXHAUSTION_RECOVERY_DAYS = 3;
export const FERTILIZER_COST = 30;
export const STREAK_BONUS_PER_LEVEL = 5;
export const STREAK_BONUS_CAP = 4;
export const MARKET_CADENCE_DAYS = 5;
export const MARKET_FIRE_CHANCE = 0.5;
export const MARKET_SHORTAGE_MULTIPLIER = 1.4;
export const MARKET_GLUT_MULTIPLIER = 0.7;
export const MARKET_DURATION_DAYS = 3;
export const MARKET_ANNOUNCE_LEAD_DAYS = 1;
export const PEST_DESTRUCTION_CHANCE = 0.5;
export const FLASH_DROUGHT_WINDOW_DAYS = 2;
export const BUILDING_SEED_DISCOUNT = 0.4;
export const BUILDING_EXHAUSTION_RECOVERY_DAYS = 2;
export const BUILDING_DROUGHT_WINDOW_DAYS = 1;
export const BUILDING_PEST_DESTRUCTION_CHANCE = 0.25;
export const BUILDING_YIELD_MULTIPLIER = 1.1;
export const FARM_EVENT_WINDOW_START_OFFSET = 4;  // first eligible day = season startDay + 4 (season day 5)
export const FARM_EVENT_WINDOW_END_OFFSET = 15;   // last eligible day = season startDay + 15 (season day 16)
export const FARM_EVENT_SECOND_CHANCE = 0.5;      // chance of a 2nd event per season

/** Integer rounding helper for all coin arithmetic. */
export const coins = (n: number): number => Math.floor(n);

// ── Crop definitions ──────────────────────────────────────────────────────────

export const CROP_DEFINITIONS: Record<CropId, CropDefinition> = {
  radish: {
    id: 'radish',
    name: 'Radish',
    growthDays: 1,
    baseSeedCost: 5,
    baseYield: 12,
  },
  parsnip: {
    id: 'parsnip',
    name: 'Parsnip',
    growthDays: 2,
    baseSeedCost: 10,
    baseYield: 28,
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Pumpkin',
    growthDays: 3,
    baseSeedCost: 20,
    baseYield: 65,
  },
} as const;

// ── Building definitions (019) ────────────────────────────────────────────────

export const BUILDING_DEFINITIONS: BuildingDefinition[] = [
  { id: 'toolshed',        name: 'Toolshed',        emoji: '🛠️', cost: 100, description: 'Seeds cost 40% less',                    unlockSeason: 1 },
  { id: 'compost_bin',     name: 'Compost Bin',     emoji: '🍂', cost: 100, description: 'Exhausted plots rest 2 days instead of 3', unlockSeason: 2 },
  { id: 'irrigation_well', name: 'Irrigation Well', emoji: '⛲', cost: 130, description: 'Flash droughts pass in 1 day instead of 2', unlockSeason: 2 },
  { id: 'scarecrow',       name: 'Scarecrow',       emoji: '🎃', cost: 150, description: 'Pests destroy half as many plots',          unlockSeason: 2 },
  { id: 'farm_stand',      name: 'Farm Stand',      emoji: '🧺', cost: 200, description: 'All harvests sell for 10% more',            unlockSeason: 2 },
];

/** Canonical "nothing owned" record — spread it, never mutate it. */
export const NO_BUILDINGS: Record<BuildingId, boolean> = {
  toolshed: false,
  compost_bin: false,
  irrigation_well: false,
  scarecrow: false,
  farm_stand: false,
};

// ── Weather definitions ───────────────────────────────────────────────────────

export const WEATHER_DEFINITIONS: Record<string, WeatherDefinition> = {
  drought: {
    id: 'drought',
    name: 'Drought',
    multiplier: 0.5,
    description: 'Scorching heat withers the crops.',
  },
  overcast: {
    id: 'overcast',
    name: 'Overcast',
    multiplier: 0.8,
    description: 'Little sun today.',
  },
  sunny: {
    id: 'sunny',
    name: 'Sunny',
    multiplier: 1.0,
    description: 'A normal farming day.',
  },
  warm_breeze: {
    id: 'warm_breeze',
    name: 'Warm Breeze',
    multiplier: 1.2,
    description: 'Ideal growing conditions.',
  },
  perfect_sun: {
    id: 'perfect_sun',
    name: 'Perfect Sun',
    multiplier: 1.5,
    description: 'Bumper harvest!',
  },
  blight: {
    id: 'blight',
    name: 'Blight',
    multiplier: 0.1,
    description: 'A fungal blight devastates the harvest.',
  },
  pest_infestation: {
    id: 'pest_infestation',
    name: 'Pest Infestation',
    multiplier: 1.0,
    description: 'Pests invade and destroy crops before they can be picked.',
  },
  flash_drought: {
    id: 'flash_drought',
    name: 'Flash Drought',
    multiplier: 1.0,
    description: 'A sudden drought will slow crop growth for the next 2 days.',
  },
} as const;

/**
 * Continuous probability bands for weather selection.
 * Roll Math.random() (0.0–1.0); return the first band where roll < threshold.
 * Disasters: 0–0.05 Blight, 0.05–0.10 Pest Infestation, 0.10–0.15 Flash Drought.
 * Existing 5 types split equally over 0.15–1.00 (0.17 each, rounded).
 */
export const WEATHER_PROBABILITY_BANDS: Array<{ threshold: number; id: WeatherId }> = [
  { threshold: 0.05, id: 'blight' },
  { threshold: 0.10, id: 'pest_infestation' },
  { threshold: 0.15, id: 'flash_drought' },
  { threshold: 0.32, id: 'drought' },
  { threshold: 0.49, id: 'overcast' },
  { threshold: 0.66, id: 'sunny' },
  { threshold: 0.83, id: 'warm_breeze' },
  { threshold: 1.00, id: 'perfect_sun' },
];
