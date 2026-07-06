import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const { initAnalytics } = vi.hoisted(() => ({
  initAnalytics: vi.fn(),
}));
vi.mock('../src/analytics/track', () => ({
  initAnalytics,
  track: vi.fn(),
  trackPlayStartedOnce: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));
const { useAnalyticsEvents } = vi.hoisted(() => ({
  useAnalyticsEvents: vi.fn(),
}));
vi.mock('../src/analytics/useAnalyticsEvents', () => ({ useAnalyticsEvents }));

import App from '../src/App';

beforeEach(() => {
  localStorage.clear();
  initAnalytics.mockClear();
  useAnalyticsEvents.mockClear();
});
afterEach(cleanup);

describe('App analytics bootstrap', () => {
  it('calls initAnalytics on mount', () => {
    render(<App />);
    expect(initAnalytics).toHaveBeenCalledTimes(1);
  });

  it('mounts useAnalyticsEvents with the engine state', () => {
    render(<App />);
    expect(useAnalyticsEvents).toHaveBeenCalled();
    const [stateArg] = useAnalyticsEvents.mock.calls[0];
    expect(stateArg).toHaveProperty('phase');
    expect(stateArg).toHaveProperty('plots');
  });
});
