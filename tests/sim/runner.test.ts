import { describe, it, expect } from 'vitest';
import { playRun, monteCarlo } from '../../scripts/sim/runner';
import { baseline } from '../../scripts/sim/economyPresets';
import { STRATEGIES } from '../../scripts/sim/strategies';
import { aggregate } from '../../scripts/sim/metrics';

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

describe('baseline difficulty smoke', () => {
  it('confirms the current economy is trivially easy for smartMixed', () => {
    const outcomes = monteCarlo(baseline, STRATEGIES.smartMixed, 500, 42);
    const m = aggregate(outcomes, baseline.seasons[3].target);
    expect(m.winPct).toBeGreaterThan(90);   // ~97% observed
    expect(m.overshoot).toBeGreaterThan(2); // ~4x observed
  });

  it('confirms pumpkinOnly is the cash-flow death trap', () => {
    const outcomes = monteCarlo(baseline, STRATEGIES.pumpkinOnly, 200, 42);
    const m = aggregate(outcomes, baseline.seasons[3].target);
    expect(m.bankruptPct).toBeGreaterThan(95);
  });
});
