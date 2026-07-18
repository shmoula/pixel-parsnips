import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { SCHEMA_VERSION } from '../../src/engine/constants';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useGameEngine.nextDay — StrictMode safety (017 FR-019)', () => {
  it('runs processTurn exactly once per nextDay call under StrictMode', () => {
    // Day 5 is a market-cadence day: with rng pinned to 0.9 the market fire
    // check consumes exactly ONE Math.random draw per processTurn run
    // (0.9 >= fireChance 0.5 → no event, no further draws). Weather is
    // overridden, so rng draws come only from that market check.
    //
    // Note: empirically (verified against React 18.3.1 via renderHook and via
    // raw createRoot + StrictMode), React does NOT double-invoke a plain
    // useState functional updater passed to setState from an event handler —
    // that double-invoke guarantee applies to useReducer reducers and to
    // useState/useMemo lazy-initializer functions, not to setState(updater).
    // So this test does not fail against the pre-fix code in this harness;
    // it exists as a standing regression guard for the invariant the fix
    // establishes: processTurn must run exactly once per nextDay() call, via
    // the same stateRef-read-then-setState(result) pattern every other action
    // in this hook already uses (plant, buySeed, buyPlot, ...). Keeping the
    // impure processTurn call out of the setState updater removes the risk
    // entirely, regardless of whether double-invocation reproduces here.
    const seeded = { ...initialGameState(), currentDay: 5 };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, state: seeded }),
    );
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const { result } = renderHook(() => useGameEngine(), { wrapper: StrictMode });
    randomSpy.mockClear(); // discard any draws from mount/initial render

    act(() => {
      result.current.nextDay('sunny');
    });

    expect(result.current.state.currentDay).toBe(6);
    expect(randomSpy).toHaveBeenCalledTimes(1);
  });
});
