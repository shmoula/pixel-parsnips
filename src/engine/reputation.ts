export interface ReputationTier {
  /** 1-based tier index, matching the ladder table. */
  tier: number;
  /** Display title shown in the HUD. */
  title: string;
  /** First day (inclusive) at which this tier applies. */
  minDay: number;
}

/**
 * Reputation ladder, ascending by minDay. The last entry is open-ended:
 * any day at or beyond its minDay resolves to it.
 */
export const REPUTATION_TIERS: readonly ReputationTier[] = [
  { tier: 1, minDay: 1, title: 'Struggling Smallholder' },
  { tier: 2, minDay: 4, title: 'Hopeful Homesteader' },
  { tier: 3, minDay: 8, title: 'Apprentice Farmer' },
  { tier: 4, minDay: 14, title: 'Seasoned Grower' },
  { tier: 5, minDay: 21, title: 'Respected Agronomist' },
  { tier: 6, minDay: 41, title: 'Master of the Harvest' },
  { tier: 7, minDay: 81, title: 'Legendary Cultivator' },
];

/**
 * Returns the reputation tier for the given run day. Total over all numbers:
 * picks the highest tier whose minDay <= currentDay; days below the first
 * threshold (not expected in normal play) return Tier 1. Pure — no I/O.
 */
export function getReputationTier(currentDay: number): ReputationTier {
  let result = REPUTATION_TIERS[0];
  for (const t of REPUTATION_TIERS) {
    if (currentDay >= t.minDay) result = t;
  }
  return result;
}
