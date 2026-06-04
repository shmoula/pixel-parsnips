import { describe, it, expect } from 'vitest';
import { deriveMedal, MEDAL_LABELS, MEDAL_TAGLINES } from '../../src/engine/medals';

describe('deriveMedal', () => {
  it('returns "none" when bankrupt in Season 1', () => {
    expect(deriveMedal(1, false)).toBe('none');
  });

  it('returns "bronze" when bankrupt in Season 2', () => {
    expect(deriveMedal(2, false)).toBe('bronze');
  });

  it('returns "silver" when bankrupt in Season 3', () => {
    expect(deriveMedal(3, false)).toBe('silver');
  });

  it('returns "gold" when bankrupt in Season 4 (did not win)', () => {
    expect(deriveMedal(4, false)).toBe('gold');
  });

  it('returns "platinum" when won === true regardless of season', () => {
    expect(deriveMedal(4, true)).toBe('platinum');
    expect(deriveMedal(7, true)).toBe('platinum');
    expect(deriveMedal(1, true)).toBe('platinum');
  });

  it('treats endless seasons ≥ 4 as gold when not won', () => {
    expect(deriveMedal(5, false)).toBe('gold');
  });
});

describe('MEDAL_LABELS / MEDAL_TAGLINES', () => {
  it('has an entry for every medal tier', () => {
    const tiers = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;
    for (const t of tiers) {
      expect(MEDAL_LABELS[t]).toBeTruthy();
      expect(MEDAL_TAGLINES[t]).toBeTruthy();
    }
  });
});
