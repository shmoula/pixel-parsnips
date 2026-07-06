import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, init, optOutCapturing } = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
  optOutCapturing: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: { init, capture, opt_out_capturing: optOutCapturing },
}));

import { __resetAnalyticsForTests, initAnalytics, track } from '../../src/analytics/track';

beforeEach(() => {
  localStorage.clear();
  capture.mockClear();
  init.mockClear();
  optOutCapturing.mockClear();
  __resetAnalyticsForTests();
  Object.defineProperty(window.navigator, 'doNotTrack', { value: null, configurable: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initAnalytics', () => {
  it('no-ops when no key is configured (never touches posthog)', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    initAnalytics();
    track('milestone_reached', { milestone: 'season_2_reached', day: 8, season_number: 2 });
    expect(init).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('no-ops when Do-Not-Track is set even with a key', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });
    initAnalytics();
    expect(init).not.toHaveBeenCalled();
  });

  it('initializes once and fires page_loaded exactly once (StrictMode-safe)', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    initAnalytics();
    initAnalytics(); // simulate React 18 StrictMode double-invoke
    expect(init).toHaveBeenCalledTimes(1);
    const pageLoads = capture.mock.calls.filter(([name]) => name === 'page_loaded');
    expect(pageLoads).toHaveLength(1);
  });

  it('merges global props and version metadata into every capture', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VITE_APP_VERSION', '9.9.9');
    initAnalytics();
    capture.mockClear();
    track('milestone_reached', { milestone: 'first_plot_unlocked', day: 5, season_number: 1 });
    expect(capture).toHaveBeenCalledTimes(1);
    const [name, payload] = capture.mock.calls[0];
    expect(name).toBe('milestone_reached');
    expect(payload).toMatchObject({
      milestone: 'first_plot_unlocked',
      day: 5,
      season_number: 1,
      schema_version: 1,
      event_version: 1,
      app_version: '9.9.9',
    });
    expect(payload.anonymous_player_id).toBeTruthy();
    expect(payload.session_id).toBeTruthy();
    expect(payload.device_type).toBe('desktop');
  });
});
