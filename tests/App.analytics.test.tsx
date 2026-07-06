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
// useAnalyticsEvents is added in Phase B; stub it so App renders in isolation here.
vi.mock('../src/analytics/useAnalyticsEvents', () => ({ useAnalyticsEvents: vi.fn() }));

import App from '../src/App';

beforeEach(() => {
  localStorage.clear();
  initAnalytics.mockClear();
});
afterEach(cleanup);

describe('App analytics bootstrap', () => {
  it('calls initAnalytics on mount', () => {
    render(<App />);
    expect(initAnalytics).toHaveBeenCalledTimes(1);
  });
});
