import { describe, it, expect } from 'vitest';
import {
  marketMultiplierFor, activatePending, expireActive, rollSchedule,
  announceText, activeText, EMPTY_MARKET,
} from '../../src/engine/market';
import type { MarketConfig } from '../../src/engine/economy';
import type { ActiveMarketEvent, MarketState } from '../../src/engine/types';

const cfg: MarketConfig = {
  cadenceDays: 5, fireChance: 0.5,
  shortageMultiplier: 1.4, glutMultiplier: 0.7,
  durationDays: 3, announceLeadDays: 1,
};

/** Deterministic RNG that yields the given sequence, then repeats the last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('marketMultiplierFor', () => {
  const active: ActiveMarketEvent = { cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 2 };
  it('returns the multiplier for the affected crop', () => {
    expect(marketMultiplierFor(active, 'pumpkin')).toBe(0.7);
  });
  it('returns 1 for an unaffected crop', () => {
    expect(marketMultiplierFor(active, 'radish')).toBe(1);
  });
  it('returns 1 when no active event', () => {
    expect(marketMultiplierFor(null, 'pumpkin')).toBe(1);
  });
});

describe('activatePending', () => {
  it('promotes pending to active with full duration', () => {
    const m: MarketState = { active: null, pending: { cropId: 'radish', kind: 'shortage', multiplier: 1.4 } };
    const out = activatePending(m, cfg);
    expect(out.active).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 3 });
    expect(out.pending).toBeNull();
  });
  it('is a no-op when nothing is pending', () => {
    const m: MarketState = { active: { cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }, pending: null };
    expect(activatePending(m, cfg)).toBe(m);
  });
});

describe('expireActive', () => {
  it('decrements daysRemaining', () => {
    expect(expireActive({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 3 }))
      .toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 });
  });
  it('clears at 0', () => {
    expect(expireActive({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 1 })).toBeNull();
  });
  it('returns null for null', () => {
    expect(expireActive(null)).toBeNull();
  });
});

describe('rollSchedule', () => {
  it('schedules a shortage on a boundary day when the fire roll passes', () => {
    const ev = rollSchedule(EMPTY_MARKET, 5, cfg, seq([0.1, 0.0, 0.4]));
    expect(ev).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4 });
  });
  it('schedules a glut when the kind roll is >= 0.5', () => {
    const ev = rollSchedule(EMPTY_MARKET, 10, cfg, seq([0.1, 0.9, 0.9]));
    expect(ev).toEqual({ cropId: 'pumpkin', kind: 'glut', multiplier: 0.7 });
  });
  it('does not schedule off a boundary day', () => {
    expect(rollSchedule(EMPTY_MARKET, 6, cfg, seq([0.1, 0.0, 0.4]))).toBeNull();
  });
  it('does not schedule when the fire roll fails', () => {
    expect(rollSchedule(EMPTY_MARKET, 5, cfg, seq([0.9]))).toBeNull();
  });
  it('does not schedule when an event is already active', () => {
    const m: MarketState = { active: { cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 1 }, pending: null };
    expect(rollSchedule(m, 5, cfg, seq([0.1, 0.0, 0.4]))).toBeNull();
  });
  it('does not schedule when an event is already pending', () => {
    const m: MarketState = { active: null, pending: { cropId: 'radish', kind: 'shortage', multiplier: 1.4 } };
    expect(rollSchedule(m, 5, cfg, seq([0.1, 0.0, 0.4]))).toBeNull();
  });
});

describe('flavor text', () => {
  it('announces a shortage and a glut', () => {
    expect(announceText({ cropId: 'parsnip', kind: 'shortage', multiplier: 1.4 }))
      .toBe('Parsnips are scarce — prices up!');
    expect(announceText({ cropId: 'radish', kind: 'glut', multiplier: 0.7 }))
      .toBe('The market is flooded with Radishes — prices down.');
  });
  it('describes an active event with percent and days left', () => {
    expect(activeText({ cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }))
      .toBe('Pumpkins shortage: yield +40% (2 days left)');
    expect(activeText({ cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 1 }))
      .toBe('Pumpkins glut: yield -30% (1 day left)');
  });
});
