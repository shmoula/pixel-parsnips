import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, init, optOutCapturing, optInCapturing } = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
  optOutCapturing: vi.fn(),
  optInCapturing: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init,
    capture,
    opt_out_capturing: optOutCapturing,
    opt_in_capturing: optInCapturing,
  },
}));

import { optIn, optOut } from '../../src/analytics/consent';
import { __resetAnalyticsForTests, initAnalytics, setAnalyticsOptOut, track } from '../../src/analytics/track';

beforeEach(() => {
  localStorage.clear();
  capture.mockClear();
  init.mockClear();
  optOutCapturing.mockClear();
  optInCapturing.mockClear();
  __resetAnalyticsForTests();
  Object.defineProperty(window.navigator, 'doNotTrack', { value: null, configurable: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('initAnalytics', () => {
  it('no-ops when no key is configured (never touches posthog)', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    await initAnalytics();
    track('milestone_reached', { milestone: 'season_2_reached', day: 8, season_number: 2 });
    expect(init).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('no-ops when Do-Not-Track is set even with a key', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });
    await initAnalytics();
    expect(init).not.toHaveBeenCalled();
  });

  it('initializes once and fires page_loaded exactly once (StrictMode-safe)', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    await Promise.all([initAnalytics(), initAnalytics()]); // simulate React 18 StrictMode double-invoke
    expect(init).toHaveBeenCalledTimes(1);
    const pageLoads = capture.mock.calls.filter(([name]) => name === 'page_loaded');
    expect(pageLoads).toHaveLength(1);
  });

  it('merges global props and version metadata into every capture', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VITE_APP_VERSION', '9.9.9');
    await initAnalytics();
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

describe('setAnalyticsOptOut', () => {
  it('suppresses capture on opt-out and restores live capture on opt-in', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    await initAnalytics();
    capture.mockClear();

    // Opt out: mirrors the real toggle, which calls optOut() before setAnalyticsOptOut(true).
    optOut();
    setAnalyticsOptOut(true);
    expect(optOutCapturing).toHaveBeenCalledTimes(1);

    track('milestone_reached', { milestone: 'first_plot_unlocked', day: 5, season_number: 1 });
    expect(capture).not.toHaveBeenCalled();

    // Opt back in: mirrors the real toggle, which calls optIn() before setAnalyticsOptOut(false).
    optIn();
    setAnalyticsOptOut(false);
    expect(optInCapturing).toHaveBeenCalledTimes(1);

    track('milestone_reached', { milestone: 'first_plot_unlocked', day: 5, season_number: 1 });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('initializes on opt-in when the player was opted out at boot', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');

    // Boot while opted out: init must no-op without latching (posthog untouched).
    optOut();
    await initAnalytics();
    expect(init).not.toHaveBeenCalled();

    // Opt back in mid-session: this must actually boot posthog, not stay dead.
    optIn();
    setAnalyticsOptOut(false);
    await initAnalytics(); // awaits the same in-flight init kicked off above
    expect(init).toHaveBeenCalledTimes(1);

    track('milestone_reached', { milestone: 'first_plot_unlocked', day: 5, season_number: 1 });
    const captured = capture.mock.calls.filter(([name]) => name === 'milestone_reached');
    expect(captured).toHaveLength(1);
  });
});
