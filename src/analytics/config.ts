export interface AnalyticsConfig {
  /** Public PostHog project key, or null when analytics should be a no-op. */
  key: string | null;
  /** Ingestion host (EU cloud by default). */
  host: string;
  /** App version string attached to every event. */
  appVersion: string;
}

const DEFAULT_HOST = 'https://eu.i.posthog.com';

export function getAnalyticsConfig(): AnalyticsConfig {
  const rawKey = import.meta.env.VITE_POSTHOG_KEY;
  const key = rawKey && rawKey.length > 0 ? rawKey : null;
  const host = import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST;
  const appVersion = import.meta.env.VITE_APP_VERSION || 'dev';
  return { key, host, appVersion };
}
