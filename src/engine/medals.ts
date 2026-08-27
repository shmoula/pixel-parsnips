export type Medal = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Maps the final state of a run to a medal tier.
 *
 *   - won === true            → 'platinum' (Season 4 victory, sticky once earned)
 *   - seasonReached >= 4      → 'gold'
 *   - seasonReached >= 3      → 'silver'
 *   - seasonReached >= 2      → 'bronze'
 *   - otherwise (S1 bankrupt) → 'none'
 *
 * Pure and total — every (seasonReached, won) pair returns a Medal.
 */
export function deriveMedal(seasonReached: number, won: boolean): Medal {
  if (won) return 'platinum';
  if (seasonReached >= 4) return 'gold';
  if (seasonReached >= 3) return 'silver';
  if (seasonReached >= 2) return 'bronze';
  return 'none';
}

/**
 * 027 — the medal is the game's single run-progression ladder. These titles were the
 * reputation ladder's (src/engine/reputation.ts, deleted in 027): that ladder measured
 * the same axis as the medal on a second surface, so its 7 tiers were collapsed onto
 * the medal's 5. 'Hopeful Homesteader' and 'Master of the Harvest' did not survive the
 * collapse — the remaining five read as one competence progression.
 */
export const MEDAL_LABELS: Record<Medal, string> = {
  none: 'Struggling Smallholder',
  bronze: 'Apprentice Farmer',
  silver: 'Seasoned Grower',
  gold: 'Respected Agronomist',
  platinum: 'Legendary Cultivator',
};

export const MEDAL_TAGLINES: Record<Medal, string> = {
  none: 'Keep going',
  bronze: 'Survived Spring Thaw',
  silver: 'Survived Summer Heat',
  gold: 'Reached the final season',
  platinum: 'Conquered Season 4',
};
