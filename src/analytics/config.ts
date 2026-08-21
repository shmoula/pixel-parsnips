export interface AnalyticsConfig {
  /** Public PostHog project key, or null when analytics should be a no-op. */
  key: string | null;
  /** Ingestion host (EU cloud by default). */
  host: string;
  /** App version string attached to every event. */
  appVersion: string;
}

const DEFAULT_HOST = 'https://eu.i.posthog.com';

// Build-time fallback injected by vite.config's `define` (a CI git-sha version,
// or 'dev'). Declared ambiently and read through `typeof` so it degrades to
// 'dev' wherever the define is absent (e.g. unit tests) instead of throwing.
declare const __APP_VERSION__: string | undefined;

export function getAnalyticsConfig(): AnalyticsConfig {
  const rawKey = import.meta.env.VITE_POSTHOG_KEY;
  const key = rawKey && rawKey.length > 0 ? rawKey : null;
  const host = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST;
  const buildVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION || buildVersion;
  return { key, host, appVersion };
}
