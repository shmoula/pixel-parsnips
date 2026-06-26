import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../../src/hooks/useOnboarding';
import { initialGameState } from '../../src/engine/gameEngine';
import { loadOnboarding, markOnboardingComplete } from '../../src/engine/onboarding';
import type { GameState } from '../../src/engine/types';

beforeEach(() => localStorage.clear());

/** Fresh day-1 state with no seeds and 4 empty plots. */
function day1(): GameState {
  const s = initialGameState();
  return { ...s, seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 } };
}

function plantAll(s: GameState): GameState {
  const plots = s.plots.map((p, i) =>
    i < s.unlockedPlots ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
  );
  return { ...s, plots };
}

describe('useOnboarding — auto-start gating', () => {
  it('is active at welcome for a fresh first run', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(result.current.active).toBe(true);
    expect(result.current.step).toBe('welcome');
  });

  it('is inactive when already completed', () => {
    markOnboardingComplete();
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(result.current.active).toBe(false);
  });

  it('does not start (and marks complete) for an in-progress run past day 1', () => {
    const { result } = renderHook(() =>
      useOnboarding({ ...day1(), currentDay: 7 }, { isShopVisible: false }),
    );
    expect(result.current.active).toBe(false);
    expect(loadOnboarding().completed).toBe(true);
  });
});

describe('useOnboarding — advancement', () => {
  it('welcome -> open-shop on the start CTA', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onStart());
    expect(result.current.step).toBe('open-shop');
  });

  it('open-shop -> buy-radishes once the shop is visible', () => {
    const state = day1();
    const { result, rerender } = renderHook(
      ({ vis }) => useOnboarding(state, { isShopVisible: vis }),
      { initialProps: { vis: false } },
    );
    act(() => result.current.onStart());
    expect(result.current.step).toBe('open-shop');
    rerender({ vis: true });
    expect(result.current.step).toBe('buy-radishes');
  });

  it('cascades buy -> plant -> advance -> payoff as goals are met', () => {
    let state = day1();
    const { result, rerender } = renderHook(
      ({ s }) => useOnboarding(s, { isShopVisible: true }),
      { initialProps: { s: state } },
    );
    act(() => result.current.onStart()); // welcome -> open-shop -> (visible) buy-radishes
    expect(result.current.step).toBe('buy-radishes');

    // Buy 4 radishes (one per empty plot)
    state = { ...state, seedInventory: { ...state.seedInventory, radish: 4 } };
    rerender({ s: state });
    expect(result.current.step).toBe('plant');

    // Plant all plots
    state = plantAll({ ...state, seedInventory: { ...state.seedInventory, radish: 0 } });
    rerender({ s: state });
    expect(result.current.step).toBe('advance');

    // Process a turn (lastDailyLog becomes non-null)
    state = { ...state, currentDay: 2, lastDailyLog: { totalHarvestIncome: 48 } as GameState['lastDailyLog'] };
    rerender({ s: state });
    expect(result.current.step).toBe('payoff');

    // Dismiss payoff
    act(() => result.current.onDismissPayoff());
    expect(result.current.step).toBe('done');
    expect(result.current.active).toBe(false);
    expect(loadOnboarding().completed).toBe(true);
  });

  it('shouldPinWeather is true only on the advance step', () => {
    const state = plantAll(day1());
    localStorage.setItem(
      'pixel-parsnips-onboarding',
      JSON.stringify({ schemaVersion: 1, completed: false, step: 'advance' }),
    );
    const { result } = renderHook(() => useOnboarding(state, { isShopVisible: true }));
    expect(result.current.step).toBe('advance');
    expect(result.current.shouldPinWeather).toBe(true);
  });
});

describe('useOnboarding — skip', () => {
  it('skip marks complete and deactivates', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onSkip());
    expect(result.current.active).toBe(false);
    expect(loadOnboarding().completed).toBe(true);
  });
});
