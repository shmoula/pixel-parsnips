import type {
  CropDefinition,
  WeatherDefinition,
  WeatherId,
  UpgradeTierDefinition,
} from './types';

// ── Scalar constants ──────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 5;
export const STARTING_BALANCE = 100;
export const PLOT_COUNT = 12;
export const TAX_RATE = 0.05;
export const MAX_UPGRADE_TIER = 3;
export const EXHAUSTION_THRESHOLD = 3;
export const EXHAUSTION_RECOVERY_DAYS = 3;
export const FERTILIZER_COST = 30;

/** Integer rounding helper for all coin arithmetic. */
export const coins = (n: number): number => Math.floor(n);

// ── Crop definitions ──────────────────────────────────────────────────────────

export const CROP_DEFINITIONS: Record<string, CropDefinition> = {
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

// ── Upgrade tier definitions ──────────────────────────────────────────────────

export const UPGRADE_TIER_DEFINITIONS: UpgradeTierDefinition[] = [
  { tier: 1, label: 'Rusty Trowel',  cost: 50,  cumulativeDiscount: 0.20 },
  { tier: 2, label: 'Iron Hoe',      cost: 120, cumulativeDiscount: 0.40 },
  { tier: 3, label: 'Golden Spade',  cost: 250, cumulativeDiscount: 0.60 },
];
