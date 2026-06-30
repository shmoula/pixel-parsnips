import { describe, it, expect } from 'vitest';
import { shortSeasonLabel } from '../../src/engine/seasons';

describe('shortSeasonLabel', () => {
  it('returns the first word, uppercased', () => {
    expect(shortSeasonLabel('Spring Thaw')).toBe('SPRING');
    expect(shortSeasonLabel('Summer Heat')).toBe('SUMMER');
    expect(shortSeasonLabel('Autumn Pressure')).toBe('AUTUMN');
    expect(shortSeasonLabel('Winter Crunch')).toBe('WINTER');
  });

  it('maps the endless "Deep Winter" to WINTER', () => {
    expect(shortSeasonLabel('Deep Winter')).toBe('WINTER');
  });
});
