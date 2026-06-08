import { describe, it, expect } from 'vitest';
import { aggregate } from '../../scripts/sim/metrics';
import type { Outcome } from '../../scripts/sim/runner';

const mk = (result: Outcome['result'], peak: number): Outcome => ({
  result, endedDay: 80, peakBalance: peak, finalBalance: peak, seasonReached: 4,
});

describe('aggregate', () => {
  it('computes rates and peak stats', () => {
    const outcomes = [mk('won', 1000), mk('bankrupt', 100), mk('targetMissed', 400), mk('won', 800)];
    const m = aggregate(outcomes, 600);
    expect(m.trials).toBe(4);
    expect(m.winPct).toBeCloseTo(50);
    expect(m.bankruptPct).toBeCloseTo(25);
    expect(m.targetMissPct).toBeCloseTo(25);
    expect(m.avgPeak).toBe(575); // (1000+100+400+800)/4
    expect(m.medianPeak).toBe(600); // median of [100,400,800,1000]
    expect(m.overshoot).toBeCloseTo(575 / 600);
  });
});
