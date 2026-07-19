import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({ track }));

import { useOnboarding } from '../../src/hooks/useOnboarding';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete, requestOnboardingReplay } from '../../src/engine/onboarding';
import type { GameState } from '../../src/engine/types';

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
});

/** Fresh day-1 state with no seeds and 4 empty plots (mirrors useOnboarding.test.tsx). */
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

/** Steps emitted so far, in call order. */
function emittedSteps(): string[] {
  return track.mock.calls
    .filter(([name]) => name === 'onboarding_step_reached')
    .map(([, props]) => (props as { step: string }).step);
}

describe('useOnboarding tracking — activation', () => {
  it('emits welcome once for a fresh first run', () => {
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(emittedSteps()).toEqual(['welcome']);
    expect(track).toHaveBeenCalledWith('onboarding_step_reached', { step: 'welcome', step_index: 0 });
  });

  it('emits welcome exactly once under StrictMode double-invocation', () => {
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }), { wrapper: StrictMode });
    expect(emittedSteps()).toEqual(['welcome']);
  });

  it('emits nothing when onboarding is already completed', () => {
    markOnboardingComplete();
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(track).not.toHaveBeenCalled();
  });

  it('emits nothing for a pre-feature run already past day 1', () => {
    renderHook(() => useOnboarding({ ...day1(), currentDay: 7 }, { isShopVisible: false }));
    expect(track).not.toHaveBeenCalled();
  });

  it('a replayed tutorial re-emits from welcome', () => {
    markOnboardingComplete();
    requestOnboardingReplay();
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(emittedSteps()).toEqual(['welcome']);
  });
});

describe('useOnboarding tracking — step progression', () => {
  it('emits open-shop on the start CTA (shop hidden)', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onStart());
    expect(emittedSteps()).toEqual(['welcome', 'open-shop']);
    expect(track).toHaveBeenCalledWith('onboarding_step_reached', { step: 'open-shop', step_index: 1 });
  });

  it('emits cascade intermediates in order when the shop is already visible', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: true }));
    act(() => result.current.onStart());
    // open-shop passes through instantly (desktop sidebar) — both steps emit, in order.
    expect(emittedSteps()).toEqual(['welcome', 'open-shop', 'buy-radishes']);
  });

  it('emits every step through payoff, then onboarding_completed on dismiss — never done', () => {
    let state = day1();
    const { result, rerender } = renderHook(
      ({ s }) => useOnboarding(s, { isShopVisible: true }),
      { initialProps: { s: state } },
    );
    act(() => result.current.onStart());
    state = { ...state, seedInventory: { ...state.seedInventory, radish: 4 } };
    rerender({ s: state });
    state = plantAll({ ...state, seedInventory: { ...state.seedInventory, radish: 0 } });
    rerender({ s: state });
    state = { ...state, currentDay: 2, lastDailyLog: { totalHarvestIncome: 48 } as GameState['lastDailyLog'] };
    rerender({ s: state });
    act(() => result.current.onDismissPayoff());

    expect(emittedSteps()).toEqual(['welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff']);
    expect(track).toHaveBeenCalledWith('onboarding_completed', {});
    expect(track).not.toHaveBeenCalledWith('onboarding_skipped', expect.anything());
    expect(emittedSteps()).not.toContain('done');
  });

  it('does not re-emit earlier steps on resume-after-refresh, and continues from there', () => {
    localStorage.setItem(
      'pixel-parsnips-onboarding',
      JSON.stringify({ schemaVersion: 1, completed: false, step: 'buy-radishes' }),
    );
    let state = day1();
    const { rerender } = renderHook(({ s }) => useOnboarding(s, { isShopVisible: true }), {
      initialProps: { s: state },
    });
    expect(track).not.toHaveBeenCalled();

    // Buying the radishes advances buy-radishes -> plant: only 'plant' emits.
    state = { ...state, seedInventory: { ...state.seedInventory, radish: 4 } };
    rerender({ s: state });
    expect(emittedSteps()).toEqual(['plant']);
    expect(track).toHaveBeenCalledWith('onboarding_step_reached', { step: 'plant', step_index: 3 });
  });
});

describe('useOnboarding tracking — skip and completion exclusivity', () => {
  it('emits onboarding_skipped with the step the player was on', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: true }));
    act(() => result.current.onStart()); // lands on buy-radishes via cascade
    act(() => result.current.onSkip());
    expect(track).toHaveBeenCalledWith('onboarding_skipped', {
      from_step: 'buy-radishes',
      from_step_index: 2,
    });
    expect(track).not.toHaveBeenCalledWith('onboarding_completed', expect.anything());
  });

  it('skip straight from welcome is valid', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onSkip());
    expect(track).toHaveBeenCalledWith('onboarding_skipped', {
      from_step: 'welcome',
      from_step_index: 0,
    });
  });
});
