import { describe, it, expect } from 'vitest';
import { getSeasonForDay, SEASON_LENGTH } from '../../src/engine/seasons';

describe('getSeasonForDay — Seasons 1–4 (table-based)', () => {
  it('returns Season 1 (Spring Thaw) for Day 1', () => {
    const s = getSeasonForDay(1);
    expect(s.number).toBe(1);
    expect(s.name).toBe('Spring Thaw');
    expect(s.startDay).toBe(1);
    expect(s.endDay).toBe(20);
    expect(s.leasePerDay).toBe(15);
    expect(s.disasterTotalPct).toBeCloseTo(0.15);
    expect(s.target).toBe(150);
  });

  it('returns Season 1 for Day 20 (the last day of Season 1)', () => {
    expect(getSeasonForDay(20).number).toBe(1);
  });

  it('returns Season 2 (Summer Heat) for Day 21', () => {
    const s = getSeasonForDay(21);
    expect(s.number).toBe(2);
    expect(s.name).toBe('Summer Heat');
    expect(s.startDay).toBe(21);
    expect(s.endDay).toBe(40);
    expect(s.leasePerDay).toBe(20);
    expect(s.disasterTotalPct).toBeCloseTo(0.20);
    expect(s.target).toBe(250);
  });

  it('returns Season 3 (Autumn Pressure) for Day 41', () => {
    const s = getSeasonForDay(41);
    expect(s.number).toBe(3);
    expect(s.name).toBe('Autumn Pressure');
    expect(s.leasePerDay).toBe(25);
    expect(s.disasterTotalPct).toBeCloseTo(0.28);
    expect(s.target).toBe(400);
  });

  it('returns Season 4 (Winter Crunch) for Day 80 (last day of finite arc)', () => {
    const s = getSeasonForDay(80);
    expect(s.number).toBe(4);
    expect(s.name).toBe('Winter Crunch');
    expect(s.endDay).toBe(80);
    expect(s.leasePerDay).toBe(30);
    expect(s.disasterTotalPct).toBeCloseTo(0.35);
    expect(s.target).toBe(600);
  });

  it('exports SEASON_LENGTH = 20', () => {
    expect(SEASON_LENGTH).toBe(20);
  });

  it('returns Season 4 for Day 61 (first day of Season 4)', () => {
    expect(getSeasonForDay(61).number).toBe(4);
  });

});

describe('getSeasonForDay — Endless formula (N ≥ 5)', () => {
  it('returns Endless Season 5 for Day 81', () => {
    const s = getSeasonForDay(81);
    expect(s.number).toBe(5);
    expect(s.name).toBe('Deep Winter');
    expect(s.startDay).toBe(81);
    expect(s.endDay).toBe(100);
    expect(s.leasePerDay).toBe(32); // 30 + 2*(5-4)
    expect(s.disasterTotalPct).toBeCloseTo(0.37); // 0.35 + 0.02*(5-4)
    expect(s.target).toBe(800); // 600 + 200
  });

  it('returns Endless Season 6 for Day 101', () => {
    const s = getSeasonForDay(101);
    expect(s.number).toBe(6);
    expect(s.startDay).toBe(101);
    expect(s.endDay).toBe(120);
    expect(s.leasePerDay).toBe(34);
    expect(s.disasterTotalPct).toBeCloseTo(0.39);
    expect(s.target).toBe(1000);
  });

  it('returns Endless Season 5 for Day 100 (last day of Endless 5)', () => {
    expect(getSeasonForDay(100).number).toBe(5);
  });

  it('caps disasterTotalPct at 0.50 for very high Endless seasons', () => {
    // Season N where 0.35 + 0.02*(N-4) > 0.50 → N - 4 > 7.5 → N >= 12
    // Season 12 → Days 221..240 → pick Day 221
    const s = getSeasonForDay(221);
    expect(s.number).toBe(12);
    expect(s.disasterTotalPct).toBeCloseTo(0.50);
  });

  it('continues to escalate lease and target past the disaster cap', () => {
    const s = getSeasonForDay(221); // Endless Season 12
    expect(s.leasePerDay).toBe(30 + 2 * (12 - 4)); // 46
    expect(s.target).toBe(600 + 200 * (12 - 4)); // 2200
  });
});
