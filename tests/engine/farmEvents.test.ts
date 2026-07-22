import { describe, it, expect } from 'vitest';
import { EMPTY_FARM_EVENTS, ensureSchedule } from '../../src/engine/farmEvents';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

/** Deterministic RNG yielding the given sequence, then repeating the last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('ensureSchedule', () => {
  it('draws 1 event when the second-event roll misses', () => {
    // rolls: secondEventChance miss (0.9), day pick 0.0 → earliest window day
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduleSeason).toBe(1);
    expect(fe.scheduledDays).toEqual([5]); // startDay 1 + windowStartOffset 4
  });

  it('draws 2 distinct days when the second-event roll hits', () => {
    // rolls: hit (0.1), then two identical day picks — linear probe makes them distinct
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.1, 0.5, 0.5]));
    expect(fe.scheduledDays).toHaveLength(2);
    expect(new Set(fe.scheduledDays).size).toBe(2);
    for (const d of fe.scheduledDays) {
      expect(d).toBeGreaterThanOrEqual(5);
      expect(d).toBeLessThanOrEqual(16); // startDay 1 + windowEndOffset 15
    }
  });

  it('is a no-op when the season schedule is already drawn', () => {
    const drawn = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    const again = ensureSchedule(drawn, 7, DEFAULT_ECONOMY, seq([0.1, 0.9]));
    expect(again).toBe(drawn);
  });

  it('redraws when the day crosses into a new season', () => {
    const s1 = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    const s2 = ensureSchedule(s1, 21, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(s2.scheduleSeason).toBe(2);
    expect(s2.scheduledDays).toEqual([25]); // startDay 21 + 4
  });

  it('clamps a mid-season draw to future days only', () => {
    // Migrated save on day 10: window lo = max(5, 10+1) = 11
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 10, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduledDays).toEqual([11]);
  });

  it('produces an empty schedule when the remaining window is empty', () => {
    // Day 17 of season 1: lo = 18 > hi = 16 → no events this season
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 17, DEFAULT_ECONOMY, seq([0.1, 0.5]));
    expect(fe.scheduleSeason).toBe(1);
    expect(fe.scheduledDays).toEqual([]);
  });

  it('does nothing while disabled', () => {
    const disabled = { ...EMPTY_FARM_EVENTS, enabled: false };
    expect(ensureSchedule(disabled, 1, DEFAULT_ECONOMY, seq([0.1]))).toBe(disabled);
  });

  it('schedules for endless seasons too', () => {
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 81, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduleSeason).toBe(5);
    expect(fe.scheduledDays).toEqual([85]); // endless season 5 startDay 81 + 4
  });
});
