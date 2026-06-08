import { describe, it, expect } from 'vitest';
import { makeRng } from '../../scripts/sim/rng';

describe('makeRng', () => {
  it('produces values in [0,1)', () => {
    const r = makeRng(123);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('is deterministic for the same seed', () => {
    const a = makeRng(42), b = makeRng(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });
  it('differs across seeds', () => {
    const a = makeRng(1), b = makeRng(2);
    expect(a()).not.toEqual(b());
  });
});
