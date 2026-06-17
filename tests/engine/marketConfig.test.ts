import { describe, it, expect } from 'vitest';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('DEFAULT_ECONOMY.market', () => {
  it('ships the proposed starting numbers', () => {
    expect(DEFAULT_ECONOMY.market).toEqual({
      cadenceDays: 5,
      fireChance: 0.5,
      shortageMultiplier: 1.4,
      glutMultiplier: 0.7,
      durationDays: 3,
      announceLeadDays: 1,
    });
  });

  it('keeps shortage above and glut below 1.0', () => {
    expect(DEFAULT_ECONOMY.market.shortageMultiplier).toBeGreaterThan(1);
    expect(DEFAULT_ECONOMY.market.glutMultiplier).toBeLessThan(1);
  });
});
