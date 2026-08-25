import { describe, expect, it } from 'vitest';
import { deriveEvidenceLine, MIN_HISTORY_FOR_EVIDENCE } from '../../src/engine/runPostMortem';
import type { RunDayRecord } from '../../src/engine/types';

function rec(day: number, closingBalance: number, taxDeducted: number, over: Partial<RunDayRecord> = {}): RunDayRecord {
  return { day, closingBalance, taxDeducted, harvestIncome: 0, unlockedPlots: 4, buildingCount: 0, ...over };
}

describe('deriveEvidenceLine', () => {
  it('names the hoarding window and the tax it cost', () => {
    const history = [
      rec(1, 50, 3), rec(2, 60, 3), rec(3, 70, 4), rec(4, 80, 4), rec(5, 90, 5),
      rec(6, 240, 14), rec(7, 250, 15), rec(8, 260, 16), rec(9, 245, 15),
      rec(10, 40, 2),
    ];
    const line = deriveEvidenceLine(history);
    expect(line).toMatch(/240/);
    expect(line).toMatch(/days 6.9/);
    // 14 + 15 + 16 + 15
    expect(line).toMatch(/60/);
  });

  it('uses the singular form for a one-day window', () => {
    const history = [rec(1, 10, 0), rec(2, 10, 0), rec(3, 10, 0), rec(4, 10, 0), rec(5, 500, 30)];
    const line = deriveEvidenceLine(history);
    expect(line).toMatch(/on day 5\b/);
    expect(line).not.toMatch(/days/);
  });

  it('returns null for a run too short to have a pattern', () => {
    expect(deriveEvidenceLine([rec(1, 30, 1), rec(2, 20, 1)])).toBeNull();
    expect(deriveEvidenceLine([])).toBeNull();
  });

  it('needs at least MIN_HISTORY_FOR_EVIDENCE days', () => {
    const short = Array.from({ length: MIN_HISTORY_FOR_EVIDENCE - 1 }, (_, i) => rec(i + 1, 100, 6));
    expect(deriveEvidenceLine(short)).toBeNull();
    expect(deriveEvidenceLine([...short, rec(99, 100, 6)])).not.toBeNull();
  });

  it('returns null when the window cost no tax at all', () => {
    // A run that never paid tax has no story about hoarding.
    const history = [rec(1, 5, 0), rec(2, 6, 0), rec(3, 7, 0), rec(4, 8, 0), rec(5, 9, 0)];
    expect(deriveEvidenceLine(history)).toBeNull();
  });
});
