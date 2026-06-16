import { describe, it, expect } from 'vitest';
import { getReputationTier, REPUTATION_TIERS } from '../../src/engine/reputation';

describe('getReputationTier', () => {
  it('maps boundary days to the correct title', () => {
    const cases: Array<[number, string]> = [
      [1, 'Struggling Smallholder'],
      [3, 'Struggling Smallholder'],
      [4, 'Hopeful Homesteader'],
      [7, 'Hopeful Homesteader'],
      [8, 'Apprentice Farmer'],
      [13, 'Apprentice Farmer'],
      [14, 'Seasoned Grower'],
      [20, 'Seasoned Grower'],
      [21, 'Respected Agronomist'],
      [40, 'Respected Agronomist'],
      [41, 'Master of the Harvest'],
      [80, 'Master of the Harvest'],
      [81, 'Legendary Cultivator'],
    ];
    for (const [day, title] of cases) {
      expect(getReputationTier(day).title).toBe(title);
    }
  });

  it('returns the top tier for a large Endless day', () => {
    expect(getReputationTier(500).title).toBe('Legendary Cultivator');
    expect(getReputationTier(500).tier).toBe(7);
  });

  it('returns Tier 1 defensively for day < 1 and never throws', () => {
    expect(() => getReputationTier(0)).not.toThrow();
    expect(getReputationTier(0).tier).toBe(1);
    expect(getReputationTier(-5).tier).toBe(1);
  });

  it('has a contiguous, ascending ladder with no gaps or overlaps', () => {
    for (let i = 1; i < REPUTATION_TIERS.length; i++) {
      expect(REPUTATION_TIERS[i].minDay).toBeGreaterThan(REPUTATION_TIERS[i - 1].minDay);
      expect(REPUTATION_TIERS[i].tier).toBe(REPUTATION_TIERS[i - 1].tier + 1);
    }
    expect(REPUTATION_TIERS[0].minDay).toBe(1);
    expect(REPUTATION_TIERS[0].tier).toBe(1);
  });
});
