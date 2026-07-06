import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnalyticsConfig } from '../../src/analytics/config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAnalyticsConfig', () => {
  it('returns null key when VITE_POSTHOG_KEY is unset', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    expect(getAnalyticsConfig().key).toBeNull();
  });

  it('returns the key and defaults host to EU cloud + version to dev', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VITE_POSTHOG_HOST', '');
    vi.stubEnv('VITE_APP_VERSION', '');
    const cfg = getAnalyticsConfig();
    expect(cfg.key).toBe('phc_test');
    expect(cfg.host).toBe('https://eu.i.posthog.com');
    expect(cfg.appVersion).toBe('dev');
  });

  it('passes through an explicit host and version', () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://eu.example.com');
    vi.stubEnv('VITE_APP_VERSION', '1.2.3');
    const cfg = getAnalyticsConfig();
    expect(cfg.host).toBe('https://eu.example.com');
    expect(cfg.appVersion).toBe('1.2.3');
  });
});
