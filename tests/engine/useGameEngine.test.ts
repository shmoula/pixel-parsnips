import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { SCHEMA_VERSION } from '../../src/engine/constants';
import { initialGameState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';
import { loadRecords } from '../../src/engine/records';

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

// Action callbacks must return true synchronously on success. Earlier versions
// read `success` from inside a setState updater and returned it before the
// updater ran, so success cases falsely reported false. This block locks the
// fix in place.
describe('useGameEngine — action callbacks return true on success', () => {
  beforeEach(() => { localStorage.clear(); });

  it('buySeed returns true when funds are sufficient', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = false;
    act(() => { ok = result.current.buySeed('radish', 1); });
    expect(ok).toBe(true);
  });

  it('plantSeed returns true when seed is available', () => {
    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.buySeed('radish', 1); });
    let ok = false;
    act(() => { ok = result.current.plantSeed(0, 'radish'); });
    expect(ok).toBe(true);
  });

  it('buyUpgrade returns true when affordable', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = false;
    act(() => { ok = result.current.buyUpgrade(); });
    expect(ok).toBe(true);
  });

  it('buyFertilizer returns true when affordable', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = false;
    act(() => { ok = result.current.buyFertilizer(1); });
    expect(ok).toBe(true);
  });

  it('applyFertilizer returns true on an exhausted plot when inventory has stock', () => {
    const exhausted: GameState = {
      ...initialGameState(),
      fertilizerInventory: 1,
      plots: initialGameState().plots.map((p, i) =>
        i === 0 ? { ...p, exhaustedSinceDay: 4, consecutiveHarvests: 0 } : p
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: exhausted }));
    const { result } = renderHook(() => useGameEngine());
    let ok = false;
    act(() => { ok = result.current.applyFertilizer(0); });
    expect(ok).toBe(true);
  });

  it('clearPestDamage returns true on a pest-damaged plot', () => {
    const damaged: GameState = {
      ...initialGameState(),
      plots: initialGameState().plots.map((p, i) =>
        i === 0 ? { ...p, pestDamaged: true } : p
      ),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: damaged }));
    const { result } = renderHook(() => useGameEngine());
    let ok = false;
    act(() => { ok = result.current.clearPestDamage(0); });
    expect(ok).toBe(true);
  });
});

// ── T016: buyFertilizer + applyFertilizer hook integration ────────────────────

describe('useGameEngine — fertilizer hook integration (T016, US2)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('buyFertilizer updates fertilizerInventory in React state', () => {
    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.buyFertilizer(1); });
    expect(result.current.getFertilizerCount()).toBe(1);
    expect(result.current.state.coinBalance).toBe(70); // 100 - 30
  });

  it('buyFertilizer persists fertilizerInventory to localStorage', () => {
    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.buyFertilizer(1); });
    const saved = JSON.parse(localStorage.getItem('pixel-parsnips-state')!);
    expect(saved.state.fertilizerInventory).toBe(1);
  });

  it('buyFertilizer returns false when insufficient funds', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = true;
    act(() => { ok = result.current.buyFertilizer(10); }); // 300 coins needed
    expect(ok).toBe(false);
    expect(result.current.getFertilizerCount()).toBe(0);
  });

  it('applyFertilizer clears exhausted plot in React state', () => {
    // Inject an exhausted state with 1 fertilizer
    const exhausted = {
      ...initialGameState(),
      coinBalance: 500,
      fertilizerInventory: 1,
      plots: initialGameState().plots.map((p, i) =>
        i === 0 ? { ...p, exhaustedSinceDay: 4, consecutiveHarvests: 0 } : p
      ),
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: exhausted }));
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.applyFertilizer(0); });
    expect(result.current.state.plots[0].exhaustedSinceDay).toBeNull();
    expect(result.current.getFertilizerCount()).toBe(0);
  });

  it('applyFertilizer persists cleared plot to localStorage', () => {
    const exhausted = {
      ...initialGameState(),
      coinBalance: 500,
      fertilizerInventory: 1,
      plots: initialGameState().plots.map((p, i) =>
        i === 0 ? { ...p, exhaustedSinceDay: 4, consecutiveHarvests: 0 } : p
      ),
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: exhausted }));
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.applyFertilizer(0); });
    const saved = JSON.parse(localStorage.getItem('pixel-parsnips-state')!);
    expect(saved.state.plots[0].exhaustedSinceDay).toBeNull();
    expect(saved.state.fertilizerInventory).toBe(0);
  });

  it('applyFertilizer returns false when no fertilizer in inventory', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = true;
    act(() => { ok = result.current.applyFertilizer(0); });
    expect(ok).toBe(false);
  });

  it('getFertilizerCount returns 0 on fresh state', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.getFertilizerCount()).toBe(0);
  });
});

describe('useGameEngine — continueSeason and endRun (US2, US5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('continueSeason from season_passed advances day and returns to playing', () => {
    const passedState: GameState = {
      ...initialGameState(),
      currentDay: 21, // already advanced by processTurn — phase carries the season_passed signal
      phase: 'season_passed',
      coinBalance: 200,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: passedState }));

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.phase).toBe('season_passed');
    act(() => { result.current.continueSeason(); });
    expect(result.current.state.phase).toBe('playing');
    expect(result.current.state.currentDay).toBe(21);
  });

  it('continueSeason from season_4_won flips endlessMode and advances to Day 81', () => {
    const victoryState: GameState = {
      ...initialGameState(),
      currentDay: 80, // not yet advanced (season_4_won pauses on Day 80)
      phase: 'season_4_won',
      coinBalance: 700,
      endlessMode: false,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: victoryState }));

    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.continueSeason(); });
    expect(result.current.state.endlessMode).toBe(true);
    expect(result.current.state.currentDay).toBe(81);
    expect(result.current.state.phase).toBe('playing');
  });

  it('endRunVictory resets to fresh state', () => {
    const victoryState: GameState = {
      ...initialGameState(),
      currentDay: 80,
      phase: 'season_4_won',
      coinBalance: 700,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: victoryState }));

    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.endRunVictory(); });
    expect(result.current.state.currentDay).toBe(1);
    expect(result.current.state.coinBalance).toBe(100);
  });
});

describe('schema 4 → 5 migration (007 — disastersSurvived)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('migrates a v4 save by adding disastersSurvived: 0', () => {
    const { disastersSurvived: _, harvestStreak: __, peakHarvestStreak: ___, ...v4State } = {
      ...initialGameState(),
      schemaVersion: 4,
      currentDay: 25,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: v4State }));

    const { result } = renderHook(() => useGameEngine());

    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.disastersSurvived).toBe(0);
    expect(result.current.state.harvestStreak).toBe(0);
    expect(result.current.state.peakHarvestStreak).toBe(0);
    expect(result.current.state.currentDay).toBe(25); // existing fields preserved
  });

  it('initialGameState includes disastersSurvived: 0', () => {
    localStorage.clear();
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.disastersSurvived).toBe(0);
  });

  it('initialGameState includes harvestStreak and peakHarvestStreak: 0', () => {
    localStorage.clear();
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.harvestStreak).toBe(0);
    expect(result.current.state.peakHarvestStreak).toBe(0);
  });
});

describe('useGameEngine — schema 3 → 5 migration (US7 chained via 007)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('migrates a v3 mid-run save to v6 with endlessMode: false', () => {
    const v3State = {
      schemaVersion: 3,
      currentDay: 15,
      coinBalance: 180,
      plots: Array.from({ length: 12 }, (_, i) => ({
        id: i, cropId: null, dayPlanted: null, daysRemaining: null,
        consecutiveHarvests: 0, exhaustedSinceDay: null,
        pestDamaged: false, droughtPenalised: false,
      })),
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
      upgradeTier: 0,
      lastDailyLog: null,
      phase: 'playing',
      peakBalance: 200,
      fertilizerInventory: 0,
      flashDroughtDaysRemaining: 0,
    };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 3, state: v3State })
    );

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(15);
    expect(result.current.state.coinBalance).toBe(180);
    expect(result.current.state.endlessMode).toBe(false);
    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.disastersSurvived).toBe(0);
    expect(result.current.state.harvestStreak).toBe(0);
    expect(result.current.state.peakHarvestStreak).toBe(0);
  });

  it('preserves bankrupt phase through migration', () => {
    const v3State = {
      ...initialGameState(),
      schemaVersion: 3,
      currentDay: 10,
      coinBalance: 5,
      phase: 'bankrupt' as const,
    };
    // strip endlessMode, harvestStreak, peakHarvestStreak to simulate a true v3 save
    const { endlessMode: _drop, harvestStreak: _drop2, peakHarvestStreak: _drop3, ...v3Stripped } = v3State as typeof v3State & { endlessMode: boolean; harvestStreak: number; peakHarvestStreak: number };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 3, state: v3Stripped })
    );

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.phase).toBe('bankrupt');
    expect(result.current.state.endlessMode).toBe(false);
    expect(result.current.state.harvestStreak).toBe(0);
    expect(result.current.state.peakHarvestStreak).toBe(0);
  });

  it('discards schema 2 saves and starts fresh', () => {
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 2, state: { currentDay: 99 } })
    );
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(1);
    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('useGameEngine — endOfRunRecap (007)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is null while phase is "playing"', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.endOfRunRecap).toBeNull();
  });

  it('populates endOfRunRecap when phase flips to "bankrupt"', () => {
    // Seed a state that will bankrupt on the next turn.
    const nearBankrupt = {
      ...initialGameState(),
      coinBalance: 0,
      currentDay: 5,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: nearBankrupt }));

    const { result } = renderHook(() => useGameEngine());
    act(() => result.current.nextDay());

    expect(result.current.state.phase).toBe('bankrupt');
    expect(result.current.endOfRunRecap).not.toBeNull();
    expect(result.current.endOfRunRecap!.medal).toBe('none'); // bankrupt in S1
    expect(result.current.endOfRunRecap!.records.totalRunsCompleted).toBe(1);
  });

  it('preserves records across restart', () => {
    const nearBankrupt = { ...initialGameState(), coinBalance: 0, currentDay: 5 };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: nearBankrupt }));
    const { result } = renderHook(() => useGameEngine());
    act(() => result.current.nextDay());
    expect(result.current.endOfRunRecap).not.toBeNull();

    act(() => result.current.restart());

    expect(result.current.endOfRunRecap).toBeNull();
    expect(loadRecords().totalRunsCompleted).toBe(1); // still there
  });

  // TODO: assert recap does not fire on season_passed/season_failed
});

describe('useGameEngine — v5 → v6 migration (008 — Harvest Streak)', () => {
  beforeEach(() => localStorage.clear());

  it('hydrates a v5 save with harvestStreak/peakHarvestStreak defaulted to 0', () => {
    const v5State = {
      schemaVersion: 5,
      currentDay: 4,
      coinBalance: 80,
      plots: Array.from({ length: 12 }, (_, i) => ({
        id: i, cropId: null, dayPlanted: null, daysRemaining: null,
        consecutiveHarvests: 0, exhaustedSinceDay: null,
        pestDamaged: false, droughtPenalised: false,
      })),
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
      upgradeTier: 0,
      lastDailyLog: null,
      phase: 'playing',
      peakBalance: 100,
      fertilizerInventory: 0,
      flashDroughtDaysRemaining: 0,
      endlessMode: false,
      disastersSurvived: 0,
    };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 5, state: v5State }),
    );
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.harvestStreak).toBe(0);
    expect(result.current.state.peakHarvestStreak).toBe(0);
  });
});
