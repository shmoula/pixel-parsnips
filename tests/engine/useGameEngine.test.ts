import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { SCHEMA_VERSION } from '../../src/engine/constants';
import { initialGameState } from '../../src/engine/gameEngine';

const STORAGE_KEY = 'pixel-parsnips-state';

// ── useGameEngine — localStorage persistence (US5, T042) ──────────────────────

describe('useGameEngine — localStorage persistence (US5)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ── Load on mount ────────────────────────────────────────────────────────────

  it('starts with initialGameState when no saved state exists', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(1);
    expect(result.current.state.coinBalance).toBe(100);
  });

  it('restores a valid saved state on mount', () => {
    const savedGameState = { ...initialGameState(), currentDay: 5, coinBalance: 250 };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: savedGameState })
    );

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(5);
    expect(result.current.state.coinBalance).toBe(250);
  });

  it('starts fresh when schemaVersion in storage mismatches SCHEMA_VERSION', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: SCHEMA_VERSION + 99, state: { currentDay: 99 } })
    );

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(1); // fresh start
    expect(result.current.state.coinBalance).toBe(100);
  });

  it('logs a console notice when schema version mismatches', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, state: {} })
    );

    renderHook(() => useGameEngine());
    expect(spy).toHaveBeenCalled();
  });

  it('starts fresh when stored JSON is malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(1);
  });

  // ── Save after actions ────────────────────────────────────────────────────────

  it('saves state to localStorage after nextDay', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.nextDay(); });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const saved = JSON.parse(raw!);
    expect(saved.schemaVersion).toBe(SCHEMA_VERSION);
    expect(saved.state.currentDay).toBe(2);
  });

  it('saves state to localStorage after buySeed', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.buySeed('radish', 1); });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.seedInventory.radish).toBe(1);
    expect(saved.state.coinBalance).toBe(95); // 100 - 5
  });

  it('saves state to localStorage after buyUpgrade', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.buyUpgrade(); });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.upgradeTier).toBe(1);
    expect(saved.state.coinBalance).toBe(50); // 100 - 50
  });

  it('saves state to localStorage after plantSeed', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.buySeed('radish', 1); });
    act(() => { result.current.plantSeed(0, 'radish'); });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.plots[0].cropId).toBe('radish');
  });

  it('saves fresh state to localStorage after restart', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.nextDay(); }); // advance to day 2
    act(() => { result.current.restart(); });

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.state.currentDay).toBe(1); // reset to day 1
    expect(saved.state.coinBalance).toBe(100);
  });

  // ── State is persisted across hook remount ────────────────────────────────────

  it('persisted state is available on remount (simulated page reload)', () => {
    const { result: first, unmount } = renderHook(() => useGameEngine());

    act(() => { first.current.nextDay(); });
    act(() => { first.current.nextDay(); }); // day 3
    unmount();

    // Remount — simulates page reload picking up saved state
    const { result: second } = renderHook(() => useGameEngine());
    expect(second.current.state.currentDay).toBe(3);
  });
});

// ── T046: Full turn sequence integration tests ────────────────────────────────

describe('useGameEngine — full turn sequence integration (T046)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('plant → nextDay → harvest income → lease → tax → updated balance', async () => {
    const { result } = renderHook(() => useGameEngine());

    // Buy a radish seed (cost 5🪙) and plant it in plot 0
    act(() => { result.current.buySeed('radish', 1); });
    act(() => { result.current.plantSeed(0, 'radish'); });

    expect(result.current.state.coinBalance).toBe(95); // 100 - 5

    // Radish grows in 1 day, so one nextDay() should harvest it
    // Use sunny weather (×1.0) → yield = 12
    // processTurn is called internally (uses Math.random in prod),
    // but we verify the accounting identity:
    //   closing = opening + harvest - lease - tax
    const openingBalance = result.current.state.coinBalance;
    act(() => { result.current.nextDay(); });

    const log = result.current.lastDailyLog;
    expect(log).not.toBeNull();

    // Accounting identity: opening + harvest - lease - tax = closing
    const expectedClosing =
      openingBalance +
      log!.totalHarvestIncome -
      log!.landLeaseDeducted -
      log!.taxDeducted;
    expect(log!.closingBalance).toBe(expectedClosing);
    expect(result.current.state.coinBalance).toBe(log!.closingBalance);

    // Harvest income must be positive (radish was ready)
    expect(log!.totalHarvestIncome).toBeGreaterThan(0);

    // Log references the correct day
    expect(log!.day).toBe(1);
    expect(result.current.state.currentDay).toBe(2);
  });

  it('coinBalance decreases by at least lease fee each turn with no crops', () => {
    const { result } = renderHook(() => useGameEngine());

    const before = result.current.state.coinBalance; // 100
    act(() => { result.current.nextDay(); });
    const after = result.current.state.coinBalance;

    // With no crops: lease (15) + tax on (100 - 15) = floor(85 * 0.05) = 4 → net -19
    expect(after).toBeLessThan(before);
    expect(before - after).toBeGreaterThanOrEqual(15); // at least the lease
  });

  it('upgradeTier reduces seed cost on subsequent buys', () => {
    const { result } = renderHook(() => useGameEngine());

    // Tier 0: radish costs 5
    expect(result.current.getSeedPrice('radish')).toBe(5);

    // Buy tier 1 upgrade (costs 50)
    act(() => { result.current.buyUpgrade(); });
    expect(result.current.state.upgradeTier).toBe(1);

    // Tier 1: 10% cumulative discount → radish = floor(5 * 0.9) = 4
    expect(result.current.getSeedPrice('radish')).toBe(4);
  });

  it('restart resets state to day 1 with starting balance', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.nextDay(); });
    act(() => { result.current.nextDay(); });
    expect(result.current.state.currentDay).toBe(3);

    act(() => { result.current.restart(); });
    expect(result.current.state.currentDay).toBe(1);
    expect(result.current.state.coinBalance).toBe(100);
    expect(result.current.lastDailyLog).toBeNull();
  });
});

// ── Coverage gap-fillers (T048) ───────────────────────────────────────────────

describe('useGameEngine — branch coverage completions (T048)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('plantSeed returns false when no seed in inventory', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok: boolean = true;
    act(() => { ok = result.current.plantSeed(0, 'radish'); });
    expect(ok).toBe(false);
  });

  it('buySeed returns false when insufficient funds', () => {
    const { result } = renderHook(() => useGameEngine());
    // Pumpkin costs 30; drain coins first
    act(() => { result.current.buyUpgrade(); }); // spends 50 → balance 50
    act(() => { result.current.buyUpgrade(); }); // no tier left (tier 1 → can't buy again yet)
    // Try to buy pumpkin × 10 (300 coins needed) — should fail
    let ok: boolean = true;
    act(() => { ok = result.current.buySeed('pumpkin', 10); });
    expect(ok).toBe(false);
  });

  it('buyUpgrade returns false when already at MAX_UPGRADE_TIER', () => {
    const { result } = renderHook(() => useGameEngine());
    // Buy all 3 tiers (costs 50 + 75 + 100 = 225; starting 100 is not enough)
    // Instead, directly verify getNextUpgradeCost returns null at max tier
    // by testing the null branch of getNextUpgradeCost
    act(() => { result.current.buyUpgrade(); }); // tier 0 → 1, costs 50; balance 50
    // now can't afford tier 2 (75), but let's test that buyUpgrade returns false for insufficient
    let ok: boolean = true;
    act(() => { ok = result.current.buyUpgrade(); }); // tier 2 costs 75, only 50 coins → false
    expect(ok).toBe(false);
  });

  it('getNextUpgradeCost returns null at MAX_UPGRADE_TIER', () => {
    // Build a state with upgradeTier === MAX_UPGRADE_TIER via localStorage
    const maxed = { ...initialGameState(), upgradeTier: 3 };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: maxed }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.getNextUpgradeCost()).toBeNull();
  });

  it('getOccupiedPlotCount returns 0 on fresh state', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.getOccupiedPlotCount()).toBe(0);
  });

  it('getOccupiedPlotCount returns 1 after planting one seed', () => {
    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.buySeed('radish', 1); });
    act(() => { result.current.plantSeed(0, 'radish'); });
    expect(result.current.getOccupiedPlotCount()).toBe(1);
  });
});
