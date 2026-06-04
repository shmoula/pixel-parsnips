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

export const MEDAL_LABELS: Record<Medal, string> = {
  none: 'No Medal',
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

export const MEDAL_TAGLINES: Record<Medal, string> = {
  none: 'Keep going',
  bronze: 'Survived Spring Thaw',
  silver: 'Survived Summer Heat',
  gold: 'Reached the final season',
  platinum: 'Conquered Season 4',
};
