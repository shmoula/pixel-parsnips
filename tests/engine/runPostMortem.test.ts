import { describe, expect, it } from 'vitest';
import { deriveEvidenceLine, MIN_HISTORY_FOR_EVIDENCE } from '../../src/engine/runPostMortem';
import { deriveDeathCause, deathCauseForState, DEATH_TITLES } from '../../src/engine/runPostMortem';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
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

/** An unplanted plot; matches the real PlotState shape in src/engine/types.ts. */
function emptyPlot(id: number) {
  return {
    id, cropId: null, dayPlanted: null, daysRemaining: null,
    consecutiveHarvests: 0, exhaustedSinceDay: null,
    pestDamaged: false, droughtPenalised: false,
  };
}

const base = {
  history: [] as RunDayRecord[],
  finalWeatherId: 'sunny' as const,
  emptyPlots: 0,
  unlockedPlots: 4,
};

describe('deriveDeathCause', () => {
  it('names the taxman when tax ate a quarter of gross income', () => {
    const history = [
      rec(1, 200, 12, { harvestIncome: 40 }),
      rec(2, 210, 13, { harvestIncome: 40 }),
      rec(3, 220, 13, { harvestIncome: 40 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('fed_the_taxman');
  });

  it('names the weather when the run ended on a disaster', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100 })];
    expect(deriveDeathCause({ ...base, history, finalWeatherId: 'blight' })).toBe('weathered_out');
  });

  it('prefers the taxman over the weather', () => {
    const history = [rec(1, 200, 30, { harvestIncome: 40 })];
    expect(deriveDeathCause({ ...base, history, finalWeatherId: 'blight' })).toBe('fed_the_taxman');
  });

  it('names overextension when a plot was bought in the last three days', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(2, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(3, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(4, 10, 1, { harvestIncome: 100, unlockedPlots: 5 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('overextended');
  });

  it('ignores a purchase older than the window', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(2, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(3, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(4, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(5, 10, 1, { harvestIncome: 100, unlockedPlots: 5 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('out_of_seed_money');
  });

  it('also counts a building purchase as overextension', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, buildingCount: 0 }),
      rec(2, 50, 1, { harvestIncome: 100, buildingCount: 1 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('overextended');
  });

  it('counts a day-1 building buy with no predecessor as overextension', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100, buildingCount: 1 })];
    expect(deriveDeathCause({ ...base, history })).toBe('overextended');
  });

  it('prefers the weather over overextension', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(2, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
    ];
    expect(deriveDeathCause({ ...base, history, finalWeatherId: 'blight' })).toBe('weathered_out');
  });

  it('prefers overextension over idle hands', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(2, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
    ];
    expect(deriveDeathCause({ ...base, history, emptyPlots: 3, unlockedPlots: 4 })).toBe('overextended');
  });

  it('names idle hands when most plots sat empty', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100 })];
    expect(deriveDeathCause({ ...base, history, emptyPlots: 3, unlockedPlots: 4 })).toBe('idle_hands');
  });

  it('falls back to out of seed money', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100 })];
    expect(deriveDeathCause({ ...base, history })).toBe('out_of_seed_money');
  });

  it('handles an empty history without throwing', () => {
    expect(deriveDeathCause({ ...base, history: [] })).toBe('out_of_seed_money');
  });

  it('maps an idle-heavy state to idle_hands', () => {
    const state = {
      ...initialGameState(DEFAULT_ECONOMY),
      unlockedPlots: 4,
      lastDailyLog: null,
      plots: [
        { ...emptyPlot(0), cropId: 'radish' as const },
        emptyPlot(1), emptyPlot(2), emptyPlot(3),
        emptyPlot(4), emptyPlot(5),
      ],
      runHistory: [rec(1, 50, 1, { harvestIncome: 100 })],
    };
    expect(deathCauseForState(state)).toBe('idle_hands');
  });

  it('counts only unlocked plots as idle', () => {
    const state = {
      ...initialGameState(DEFAULT_ECONOMY),
      unlockedPlots: 2,
      plots: [
        { ...emptyPlot(0), cropId: 'radish' as const },
        { ...emptyPlot(1), cropId: 'radish' as const },
        emptyPlot(2), emptyPlot(3), emptyPlot(4), emptyPlot(5),
      ],
      runHistory: [rec(1, 50, 1, { harvestIncome: 100 })],
    };
    expect(deathCauseForState(state)).toBe('out_of_seed_money');
  });

  it('gives every cause a title', () => {
    const causes = [
      'fed_the_taxman', 'weathered_out', 'overextended', 'idle_hands', 'out_of_seed_money',
    ] as const;
    for (const c of causes) expect(DEATH_TITLES[c]).toBeTruthy();
  });
});
