import { describe, expect, it } from 'vitest';
import { initialGameState, processTurn } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('runHistory — initial state', () => {
  it('starts empty on a fresh run', () => {
    const s = initialGameState(DEFAULT_ECONOMY);
    expect(s.runHistory).toEqual([]);
  });

  it('declares schema 11', () => {
    expect(initialGameState(DEFAULT_ECONOMY).schemaVersion).toBe(11);
  });
});

describe('runHistory — accumulation', () => {
  it('appends one record per completed day', () => {
    let s = initialGameState(DEFAULT_ECONOMY);
    s = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.5).state;
    expect(s.runHistory).toHaveLength(1);
    expect(s.runHistory[0].day).toBe(1);

    s = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.5).state;
    expect(s.runHistory).toHaveLength(2);
    expect(s.runHistory[1].day).toBe(2);
  });

  it('records the fields the post-mortem needs', () => {
    let s = initialGameState(DEFAULT_ECONOMY);
    s = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.5).state;
    const rec = s.runHistory[0];
    expect(rec.closingBalance).toBe(s.coinBalance);
    expect(rec.taxDeducted).toBe(s.lastDailyLog!.taxDeducted);
    expect(rec.harvestIncome).toBe(s.lastDailyLog!.totalHarvestIncome);
    expect(rec.unlockedPlots).toBe(s.unlockedPlots);
    expect(rec.buildingCount).toBe(0);
  });

  it('records the fatal day too', () => {
    // Drive the balance below the lease so processTurn takes the bankruptcy early return.
    const s = { ...initialGameState(DEFAULT_ECONOMY), coinBalance: 0 };
    const before = s.runHistory.length;
    const result = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.5);

    expect(result.isBankrupt).toBe(true);
    expect(result.state.runHistory).toHaveLength(before + 1);
    expect(result.state.runHistory.at(-1)!.day).toBe(s.currentDay);
  });
});

describe('runHistory — restart', () => {
  it('is empty again after a fresh initial state', () => {
    let s = initialGameState(DEFAULT_ECONOMY);
    s = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.5).state;
    expect(s.runHistory.length).toBeGreaterThan(0);
    expect(initialGameState(DEFAULT_ECONOMY).runHistory).toEqual([]);
  });
});
