import { describe, it, expect } from 'vitest';
import { getSeasonForDay, SEASON_LENGTH, getDisasterBandsForSeason } from '../../src/engine/seasons';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

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

describe('getDisasterBandsForSeason', () => {
  it('Season 1 returns the baseline bands (matches existing constants)', () => {
    const bands = getDisasterBandsForSeason(getSeasonForDay(1));
    // Baseline: blight 0–0.05, pest 0.05–0.10, flash_drought 0.10–0.15
    expect(bands[0]).toEqual({ threshold: 0.05, id: 'blight' });
    expect(bands[1]).toEqual({ threshold: 0.10, id: 'pest_infestation' });
    expect(bands[2]).toEqual({ threshold: 0.15, id: 'flash_drought' });
  });

  it('Season 2 scales disaster bands proportionally to 20% total', () => {
    const bands = getDisasterBandsForSeason(getSeasonForDay(21));
    // Each disaster band scales by 20/15 = 1.333..., so each disaster slice = 0.0667
    expect(bands[0].threshold).toBeCloseTo(20 / 300, 5); // blight slice 0.0667
    expect(bands[1].threshold).toBeCloseTo(40 / 300, 5); // through pest 0.1333
    expect(bands[2].threshold).toBeCloseTo(60 / 300, 5); // through flash_drought 0.20
  });

  it('preserves the 1:1:1 disaster ratio across seasons', () => {
    const s4 = getSeasonForDay(80);
    const bands = getDisasterBandsForSeason(s4);
    const blightWidth = bands[0].threshold;
    const pestWidth = bands[1].threshold - bands[0].threshold;
    const droughtWidth = bands[2].threshold - bands[1].threshold;
    expect(blightWidth).toBeCloseTo(pestWidth, 5);
    expect(pestWidth).toBeCloseTo(droughtWidth, 5);
  });

  it('total disaster band width equals season.disasterTotalPct', () => {
    const s = getSeasonForDay(41); // Season 3, 0.28
    const bands = getDisasterBandsForSeason(s);
    expect(bands[2].threshold).toBeCloseTo(0.28, 5);
  });

  it('non-disaster bands fill the remaining probability up to 1.0', () => {
    const s = getSeasonForDay(21); // Season 2, 0.20 disaster
    const bands = getDisasterBandsForSeason(s);
    // Last band threshold must be exactly 1.0 (perfect_sun)
    expect(bands[bands.length - 1].threshold).toBeCloseTo(1.0, 5);
    // Last band id is perfect_sun (same as baseline)
    expect(bands[bands.length - 1].id).toBe('perfect_sun');
  });

  it('non-disaster bands keep their original equal-width spacing', () => {
    const s = getSeasonForDay(21);
    const bands = getDisasterBandsForSeason(s);
    // After the 3 disasters there are 5 weather bands (drought, overcast, sunny, warm_breeze, perfect_sun)
    // each must occupy (1.0 - 0.20) / 5 = 0.16 of probability space
    const nonDisasterTotal = 1.0 - 0.20;
    const expectedWidth = nonDisasterTotal / 5;
    expect(bands[4].threshold - bands[3].threshold).toBeCloseTo(expectedWidth, 5);
  });

  it('handles the Endless disaster cap (0.50) correctly', () => {
    const s = getSeasonForDay(221); // Endless Season 12, disasterTotalPct = 0.50
    const bands = getDisasterBandsForSeason(s);
    // Disaster total width should equal 0.50 within tolerance
    expect(bands[2].threshold).toBeCloseTo(0.50, 5);
    // 1:1:1 ratio preserved
    const blightWidth = bands[0].threshold;
    const pestWidth = bands[1].threshold - bands[0].threshold;
    const droughtWidth = bands[2].threshold - bands[1].threshold;
    expect(blightWidth).toBeCloseTo(pestWidth, 5);
    expect(pestWidth).toBeCloseTo(droughtWidth, 5);
    // Final band still lands at exactly 1.0
    expect(bands[bands.length - 1].threshold).toBeCloseTo(1.0, 5);
  });
});

describe('getSeasonForDay with injected config', () => {
  it('defaults to DEFAULT_ECONOMY and is unchanged', () => {
    expect(getSeasonForDay(21).target).toBe(250);
    expect(getSeasonForDay(81).leasePerDay).toBe(32); // endless season 5
  });

  it('reads finite-season values from a custom config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      seasons: DEFAULT_ECONOMY.seasons.map(s =>
        s.number === 2 ? { ...s, target: 999 } : s),
    };
    expect(getSeasonForDay(21, custom).target).toBe(999);
  });

  it('reads endless coefficients from a custom config', () => {
    const custom = {
      ...DEFAULT_ECONOMY,
      endless: { ...DEFAULT_ECONOMY.endless, targetBase: 1000, targetPerSeason: 500 },
    };
    // day 81 → season 5 → target 1000 + 500*(5-4) = 1500
    expect(getSeasonForDay(81, custom).target).toBe(1500);
  });

  it('derives the endless anchor from overridden finite-season boundaries', () => {
    // Shorten Winter Crunch so the finite arc ends on day 70 (length 10).
    const custom = {
      ...DEFAULT_ECONOMY,
      seasons: DEFAULT_ECONOMY.seasons.map(s =>
        s.number === 4 ? { ...s, endDay: 70 } : s),
    };
    // Default: day 75 is finite Season 4 (target 600).
    expect(getSeasonForDay(75).target).toBe(600);
    // Custom: day 71+ is now Endless Season 5, anchored to the new boundary.
    const endless = getSeasonForDay(75, custom);
    expect(endless.number).toBe(5);
    expect(endless.startDay).toBe(71);
    expect(endless.endDay).toBe(80); // seasonLength derived as 10
    expect(endless.target).toBe(800); // targetBase 600 + 200*(5-4)
    expect(endless.leasePerDay).toBe(32); // leaseBase 30 + 2*(5-4)
  });
});
