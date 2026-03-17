import type {
  CropDefinition,
  WeatherDefinition,
  UpgradeTierDefinition,
} from './types';

// ── Scalar constants ──────────────────────────────────────────────────────────

export const SCHEMA_VERSION = 1;
export const STARTING_BALANCE = 100;
export const PLOT_COUNT = 12;
export const LAND_LEASE_FEE = 15;
export const TAX_RATE = 0.05;
export const MAX_UPGRADE_TIER = 3;

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
} as const;

/** Ordered list for uniform random selection (20% each). */
export const WEATHER_IDS = [
  'drought',
  'overcast',
  'sunny',
  'warm_breeze',
  'perfect_sun',
] as const;

// ── Upgrade tier definitions ──────────────────────────────────────────────────

export const UPGRADE_TIER_DEFINITIONS: UpgradeTierDefinition[] = [
  { tier: 1, label: 'Rusty Trowel',  cost: 50,  cumulativeDiscount: 0.20 },
  { tier: 2, label: 'Iron Hoe',      cost: 120, cumulativeDiscount: 0.40 },
  { tier: 3, label: 'Golden Spade',  cost: 250, cumulativeDiscount: 0.60 },
];
