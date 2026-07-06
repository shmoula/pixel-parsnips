import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { trackPlayStartedOnce } = vi.hoisted(() => ({
  trackPlayStartedOnce: vi.fn(),
}));
vi.mock('../../src/analytics/track', () => ({
  trackPlayStartedOnce,
  track: vi.fn(),
  initAnalytics: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));

import { useGameEngine } from '../../src/engine/useGameEngine';

beforeEach(() => {
  localStorage.clear();
  trackPlayStartedOnce.mockClear();
});

describe('play_started', () => {
  it('fires once on the first successful action and not again', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => {
      result.current.buySeed('radish', 1);
    });
    act(() => {
      result.current.buySeed('radish', 1);
    });

    expect(trackPlayStartedOnce).toHaveBeenCalledTimes(1);
    expect(trackPlayStartedOnce.mock.calls[0][0]).toMatchObject({
      start_action: 'buy_seed',
      day: 1,
    });
    expect(typeof trackPlayStartedOnce.mock.calls[0][0].onboarding_active).toBe('boolean');
  });

  it('does not fire when an action fails (e.g. cannot afford)', () => {
    const { result } = renderHook(() => useGameEngine());
    act(() => {
      // A wildly unaffordable purchase returns false and must not signal play start.
      result.current.buySeed('pumpkin', 99999);
    });
    expect(trackPlayStartedOnce).not.toHaveBeenCalled();
  });
});
