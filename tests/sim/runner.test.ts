import { describe, it, expect } from 'vitest';
import { playRun, monteCarlo } from '../../scripts/sim/runner';
import { baseline } from '../../scripts/sim/economyPresets';
import { STRATEGIES } from '../../scripts/sim/strategies';

describe('runner', () => {
  it('playRun returns a terminal outcome', () => {
    const o = playRun(baseline, STRATEGIES.smartMixed, 1);
    expect(['won', 'bankrupt', 'targetMissed']).toContain(o.result);
    expect(o.endedDay).toBeGreaterThan(0);
    expect(o.peakBalance).toBeGreaterThanOrEqual(baseline.startingBalance);
  });

  it('is reproducible for the same seed', () => {
    const a = playRun(baseline, STRATEGIES.smartMixed, 7);
    const b = playRun(baseline, STRATEGIES.smartMixed, 7);
    expect(a).toEqual(b);
  });

  it('monteCarlo returns one outcome per trial', () => {
    const outcomes = monteCarlo(baseline, STRATEGIES.radishOnly, 50, 99);
    expect(outcomes).toHaveLength(50);
  });
});
