import { describe, expect, it } from 'vitest';
import { monteCarlo } from '../../scripts/sim/runner';
import { aggregate } from '../../scripts/sim/metrics';
import { PRESETS } from '../../scripts/sim/economyPresets';
import { STRATEGIES } from '../../scripts/sim/strategies';

const config = PRESETS.events022;
const strategy = STRATEGIES.smartMixed;
const finalTarget = config.seasons[config.seasons.length - 1].target;

describe('simulator — death cause reporting', () => {
  it('labels every bankrupt run and leaves survivors unlabelled', () => {
    const outcomes = monteCarlo(config, strategy, 40, 7);
    for (const o of outcomes) {
      if (o.result === 'bankrupt') expect(o.deathCause).not.toBeNull();
      else expect(o.deathCause).toBeNull();
    }
  });

  it('aggregates causes into counts that sum to the bankrupt total', () => {
    const outcomes = monteCarlo(config, strategy, 60, 11);
    const m = aggregate(outcomes, finalTarget);
    const bankrupt = outcomes.filter(o => o.result === 'bankrupt').length;
    const summed = Object.values(m.deathCauses).reduce((a, b) => a + b, 0);
    expect(summed).toBe(bankrupt);
  });

  it('is deterministic for a given seed', () => {
    const a = aggregate(monteCarlo(config, strategy, 30, 3), finalTarget);
    const b = aggregate(monteCarlo(config, strategy, 30, 3), finalTarget);
    expect(a.deathCauses).toEqual(b.deathCauses);
  });
});
