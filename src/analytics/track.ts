import type { PostHog } from 'posthog-js';
import { getAnalyticsConfig } from './config';
import { isTrackingAllowed } from './consent';
import {
  buildGlobalProps,
  getOrCreatePlayerId,
  hasSavedRun,
  parseUtms,
  type GlobalProps,
} from './globals';
import {
  ANALYTICS_SCHEMA_VERSION,
  EVENT_VERSIONS,
  type AnalyticsEventName,
  type EventPropsMap,
} from './events';

let initialized = false;
let enabled = false;
let playStartedFired = false;
let pageLoadedFired = false;
let globals: GlobalProps | null = null;
let appVersion = 'dev';
// Resolved lazily so posthog-js is code-split out of the initial bundle.
let ph: PostHog | null = null;
// Shared in-flight init so concurrent callers await one real setup.
let initInFlight: Promise<void> | null = null;

/**
 * Initialize analytics at most once per successful attempt.
 *
 * The `initialized` guard is only latched after posthog actually boots, so a
 * boot-time no-op (no key, DNT, or opted out) leaves the door open for a later
 * opt-in to retry. Concurrent callers share one in-flight promise and resolve
 * only once globals/enabled are ready, so a following `track(...)` won't no-op.
 */
export function initAnalytics(): Promise<void> {
  if (initialized) return Promise.resolve();
  if (initInFlight) return initInFlight;

  const cfg = getAnalyticsConfig();
  if (!cfg.key || !isTrackingAllowed()) return Promise.resolve();
  const key = cfg.key;

  initInFlight = (async () => {
    try {
      const { id, isReturning } = getOrCreatePlayerId();
      const { default: posthog } = await import('posthog-js');
      ph = posthog;
      ph.init(key, {
        api_host: cfg.host,
        persistence: 'localStorage',
        autocapture: false,
        capture_pageview: false,
        capture_heatmaps: false,
        disable_session_recording: true,
        respect_dnt: true,
        bootstrap: { distinctID: id },
      });

      appVersion = cfg.appVersion;
      globals = buildGlobalProps(id);
      enabled = true;
      initialized = true;

      // Once per session, even when init is re-run via a mid-session opt-in.
      if (!pageLoadedFired) {
        pageLoadedFired = true;
        track('page_loaded', {
          is_returning_player: isReturning,
          has_saved_run: hasSavedRun(),
          ...parseUtms(typeof window !== 'undefined' ? window.location.search : ''),
        });
      }
    } finally {
      initInFlight = null;
    }
  })();

  return initInFlight;
}

/** Fire-and-forget capture. No-ops unless initialized and consent still allows. */
export function track<N extends AnalyticsEventName>(name: N, props: EventPropsMap[N]): void {
  if (!enabled || !ph || !globals || !isTrackingAllowed()) return;
  ph.capture(name, {
    ...props,
    ...globals,
    app_version: appVersion,
    schema_version: ANALYTICS_SCHEMA_VERSION,
    event_version: EVENT_VERSIONS[name],
  });
}

/** Fire `play_started` once per browser session (first successful engine action). */
export function trackPlayStartedOnce(props: EventPropsMap['play_started']): void {
  if (playStartedFired) return;
  playStartedFired = true;
  track('play_started', props);
}

/** Respond to a live opt-out toggle. */
export function setAnalyticsOptOut(optedOut: boolean): void {
  if (optedOut) {
    enabled = false;
    if (ph) ph.opt_out_capturing();
  } else {
    // Re-enable within the session if we had already initialized with a key.
    if (ph && globals) {
      enabled = true;
      ph.opt_in_capturing();
    } else {
      void initAnalytics();
    }
  }
}

/** Test-only: reset module state between cases. */
export function __resetAnalyticsForTests(): void {
  initialized = false;
  enabled = false;
  playStartedFired = false;
  pageLoadedFired = false;
  globals = null;
  appVersion = 'dev';
  ph = null;
  initInFlight = null;
}
