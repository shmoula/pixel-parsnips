# Analytics Tracking (017) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal, privacy-first PostHog analytics layer (P0+P1 events) fired from engine-facing state transitions, with opt-out/DNT consent and MCP-provisioned dashboards, per `specs/017-analytics/specs/2026-07-06-analytics-tracking-design.md`.

**Architecture:** All analytics code is isolated under `src/analytics/`. UI components import nothing from it. `App` calls `initAnalytics()` once and mounts `useAnalyticsEvents(state, endOfRunRecap)`, which fires every *state-derived* event by diffing engine state against a `prevStateRef` (mirroring the existing `prevPhaseRef`/`lastDailyLog` patterns). The single *action-derived* event, `play_started`, is fired inline from `useGameEngine` wrappers. `posthog-js` is gated behind a configured key and consent — with no key or with DNT/opt-out, the whole layer is a silent no-op.

**Tech Stack:** React 18.3 + TypeScript ~5.6, Vite 7, `posthog-js`, Vitest + @testing-library/react (jsdom). Tests live in `tests/` mirroring `src/`.

**Working branch:** `017-analytics` (main repo). Commit directly to it; no new branch.

**Conventions:**
- Run one test file: `npx vitest run tests/analytics/consent.test.ts`
- Run everything: `npm test && npm run lint`
- Coverage floor is 80% lines (`vite.config.ts`) — keep it green.
- `vi` is a global (Vitest `globals: true`); no import needed.
- `tests/setup.ts` stubs `matchMedia` to `{ matches: false }` and provides `localStorage` via jsdom.
- Append this trailer to every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

**Create:**
- `src/analytics/config.ts` — reads Vite env; resolves key/host/appVersion; no-op signal when key absent.
- `src/analytics/consent.ts` — DNT + localStorage opt-out; `isTrackingAllowed()`, `optOut()`, `optIn()`.
- `src/analytics/globals.ts` — anonymous id, session id, device type, UTM parsing, global prop bag.
- `src/analytics/events.ts` — `EventPropsMap` type, `ANALYTICS_SCHEMA_VERSION`, `EVENT_VERSIONS`, pure prop mappers.
- `src/analytics/track.ts` — `initAnalytics()`, `track(name, props)`, `trackPlayStartedOnce(props)`, `setAnalyticsOptOut(bool)`, `__resetAnalyticsForTests()`.
- `src/analytics/useAnalyticsEvents.ts` — React hook firing all state-derived events.
- `src/components/AnalyticsOptOutToggle.tsx` — small in-game opt-out control.
- Test files mirroring each under `tests/analytics/` and `tests/components/`.

**Modify:**
- `src/vite-env.d.ts` — add `ImportMetaEnv` typing for the new Vite vars.
- `src/App.tsx` — call `initAnalytics()` once, mount `useAnalyticsEvents(...)`, render the toggle.
- `src/engine/useGameEngine.ts` — fire `play_started` from action wrappers via a local helper.
- `package.json` — add `posthog-js` dependency.

---

## Phase A — Foundation

### Task A1: Dependency, env typing, and config module

**Files:**
- Modify: `package.json` (add `posthog-js`)
- Modify: `src/vite-env.d.ts`
- Create: `src/analytics/config.ts`
- Test: `tests/analytics/config.test.ts`

- [ ] **Step 1: Install the dependency**

Run: `npm install posthog-js`
Expected: `posthog-js` appears under `dependencies` in `package.json`; `npm install` exits 0.

- [ ] **Step 2: Add env typing**

Replace the contents of `src/vite-env.d.ts` with:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** PostHog project API key (public client key). Absent -> analytics is a no-op. */
  readonly VITE_POSTHOG_KEY?: string;
  /** PostHog ingestion host. Defaults to EU cloud when unset. */
  readonly VITE_POSTHOG_HOST?: string;
  /** Build-time app version string. Defaults to 'dev' when unset. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 3: Write the failing test**

Create `tests/analytics/config.test.ts`:

```ts
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
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/config.test.ts`
Expected: FAIL — cannot resolve `../../src/analytics/config`.

- [ ] **Step 5: Implement `src/analytics/config.ts`**

```ts
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
```

- [ ] **Step 6: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/vite-env.d.ts src/analytics/config.ts tests/analytics/config.test.ts
git commit -m "feat(analytics): add posthog-js dep, env typing, and config module

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A2: Consent module (DNT + opt-out)

**Files:**
- Create: `src/analytics/consent.ts`
- Test: `tests/analytics/consent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/analytics/consent.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_OPT_OUT_KEY, isOptedOut, isTrackingAllowed, optIn, optOut } from '../../src/analytics/consent';

function setDnt(value: string | null): void {
  Object.defineProperty(window.navigator, 'doNotTrack', { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setDnt(null);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('consent', () => {
  it('allows tracking by default (no DNT, no opt-out)', () => {
    expect(isTrackingAllowed()).toBe(true);
  });

  it('denies when Do-Not-Track is "1"', () => {
    setDnt('1');
    expect(isTrackingAllowed()).toBe(false);
  });

  it('denies when the opt-out key is set', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    expect(isOptedOut()).toBe(true);
    expect(isTrackingAllowed()).toBe(false);
  });

  it('optOut then optIn flips the stored flag', () => {
    optOut();
    expect(isOptedOut()).toBe(true);
    optIn();
    expect(isOptedOut()).toBe(false);
    expect(isTrackingAllowed()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/consent.test.ts`
Expected: FAIL — cannot resolve `../../src/analytics/consent`.

- [ ] **Step 3: Implement `src/analytics/consent.ts`**

```ts
export const ANALYTICS_OPT_OUT_KEY = 'pixel-parsnips-analytics-optout';

/** True when the browser signals Do-Not-Track. */
export function isDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt = navigator.doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/** True when the player has explicitly opted out locally. */
export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Single source of truth: track only when neither DNT nor local opt-out apply. */
export function isTrackingAllowed(): boolean {
  return !isDoNotTrack() && !isOptedOut();
}

export function optOut(): void {
  try {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
  } catch {
    /* storage unavailable; nothing to persist */
  }
}

export function optIn(): void {
  try {
    localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    /* storage unavailable; nothing to persist */
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/consent.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/consent.ts tests/analytics/consent.test.ts
git commit -m "feat(analytics): add DNT + opt-out consent module

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A3: Global properties module

**Files:**
- Create: `src/analytics/globals.ts`
- Test: `tests/analytics/globals.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/analytics/globals.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_ID_KEY,
  getDeviceType,
  getOrCreatePlayerId,
  hasSavedRun,
  parseUtms,
} from '../../src/analytics/globals';

beforeEach(() => {
  localStorage.clear();
});

describe('getOrCreatePlayerId', () => {
  it('creates and persists a new id, reporting a first-time player', () => {
    const first = getOrCreatePlayerId();
    expect(first.isReturning).toBe(false);
    expect(first.id).toMatch(/.{8,}/);
    expect(localStorage.getItem(ANALYTICS_ID_KEY)).toBe(first.id);
  });

  it('reuses the persisted id, reporting a returning player', () => {
    const first = getOrCreatePlayerId();
    const second = getOrCreatePlayerId();
    expect(second.id).toBe(first.id);
    expect(second.isReturning).toBe(true);
  });
});

describe('hasSavedRun', () => {
  it('is true only when the game save key exists', () => {
    expect(hasSavedRun()).toBe(false);
    localStorage.setItem('pixel-parsnips-state', '{}');
    expect(hasSavedRun()).toBe(true);
  });
});

describe('parseUtms', () => {
  it('extracts only utm_* params', () => {
    expect(parseUtms('?utm_source=reddit&utm_medium=social&foo=bar')).toEqual({
      utm_source: 'reddit',
      utm_medium: 'social',
    });
  });

  it('returns an empty object when there are no utm params', () => {
    expect(parseUtms('?foo=bar')).toEqual({});
  });
});

describe('getDeviceType', () => {
  it('defaults to desktop under the jsdom matchMedia stub', () => {
    expect(getDeviceType()).toBe('desktop');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/globals.test.ts`
Expected: FAIL — cannot resolve `../../src/analytics/globals`.

- [ ] **Step 3: Implement `src/analytics/globals.ts`**

```ts
export const ANALYTICS_ID_KEY = 'pixel-parsnips-analytics-id';
const GAME_SAVE_KEY = 'pixel-parsnips-state';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface Utms {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface GlobalProps extends Utms {
  session_id: string;
  anonymous_player_id: string;
  device_type: DeviceType;
}

function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for environments without crypto.randomUUID.
  return `pp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads (or creates) the persisted anonymous id. `isReturning` reflects prior existence. */
export function getOrCreatePlayerId(): { id: string; isReturning: boolean } {
  try {
    const existing = localStorage.getItem(ANALYTICS_ID_KEY);
    if (existing) return { id: existing, isReturning: true };
    const id = uuid();
    localStorage.setItem(ANALYTICS_ID_KEY, id);
    return { id, isReturning: false };
  } catch {
    return { id: uuid(), isReturning: false };
  }
}

export function hasSavedRun(): boolean {
  try {
    return localStorage.getItem(GAME_SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function createSessionId(): string {
  return uuid();
}

export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  if (window.matchMedia('(max-width: 640px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet';
  return 'desktop';
}

export function parseUtms(search: string): Utms {
  const params = new URLSearchParams(search);
  const out: Utms = {};
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source) out.utm_source = source;
  if (medium) out.utm_medium = medium;
  if (campaign) out.utm_campaign = campaign;
  return out;
}

/** Builds the property bag attached to every event. */
export function buildGlobalProps(anonymousPlayerId: string): GlobalProps {
  return {
    session_id: createSessionId(),
    anonymous_player_id: anonymousPlayerId,
    device_type: getDeviceType(),
    ...parseUtms(typeof window !== 'undefined' ? window.location.search : ''),
  };
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/globals.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/globals.ts tests/analytics/globals.test.ts
git commit -m "feat(analytics): add global-properties module (id, session, device, utm)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A4: Event schema types and pure prop mappers

**Files:**
- Create: `src/analytics/events.ts`
- Test: `tests/analytics/events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/analytics/events.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_SCHEMA_VERSION,
  EVENT_VERSIONS,
  buildDayCompletedProps,
  buildRunEndedProps,
  runOutcomeForPhase,
} from '../../src/analytics/events';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 3,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests: [{ cropId: 'radish', baseYield: 4, weatherMultiplier: 1, adjustedYield: 4 }],
    totalHarvestIncome: 12,
    openingBalance: 100,
    landLeaseDeducted: 5,
    taxRate: 0.06,
    taxDeducted: 7,
    netChange: 0,
    closingBalance: 100,
    exhaustedPlots: [2],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 1,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    ...over,
  };
}

describe('events schema', () => {
  it('exposes a schema version and a version per event', () => {
    expect(ANALYTICS_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    expect(EVENT_VERSIONS.day_completed).toBeGreaterThanOrEqual(1);
    expect(EVENT_VERSIONS.run_ended).toBeGreaterThanOrEqual(1);
  });
});

describe('buildDayCompletedProps', () => {
  it('maps DailyLogEntry fields to snake_case counts', () => {
    const props = buildDayCompletedProps(makeLog(), 1, 'playing');
    expect(props).toEqual({
      day: 3,
      season_number: 1,
      weather_id: 'sunny',
      harvest_count: 1,
      net_change: 0,
      tax_deducted: 7,
      lease_deducted: 5,
      exhausted_plot_count: 1,
      phase_after: 'playing',
    });
  });
});

describe('runOutcomeForPhase', () => {
  it('maps terminal phases to outcome labels', () => {
    expect(runOutcomeForPhase('bankrupt')).toBe('bankrupt');
    expect(runOutcomeForPhase('season_failed')).toBe('season_failed');
    expect(runOutcomeForPhase('season_4_won')).toBe('won');
  });
});

describe('buildRunEndedProps', () => {
  it('assembles run summary props from state', () => {
    const state = {
      currentDay: 40,
      peakBalance: 320,
      disastersSurvived: 2,
      peakHarvestStreak: 5,
    } as unknown as GameState;
    const props = buildRunEndedProps(state, 'won', 4, 'gold');
    expect(props).toEqual({
      outcome: 'won',
      days_played: 40,
      season_reached: 4,
      peak_balance: 320,
      disasters_survived: 2,
      peak_harvest_streak: 5,
      medal: 'gold',
    });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: FAIL — cannot resolve `../../src/analytics/events`.

- [ ] **Step 3: Implement `src/analytics/events.ts`**

```ts
import type { DailyLogEntry, GameState, WeatherId } from '../engine/types';
import type { Medal } from '../engine/medals';

export const ANALYTICS_SCHEMA_VERSION = 1;

export type MilestoneId = 'first_plot_unlocked' | 'season_2_reached';
export type RunOutcome = 'bankrupt' | 'season_failed' | 'won';
export type SeasonOutcome = 'season_passed' | 'season_failed' | 'season_4_won';

/** The full P0+P1 event surface. Property bags are event-specific; globals are merged in `track`. */
export interface EventPropsMap {
  page_loaded: {
    is_returning_player: boolean;
    has_saved_run: boolean;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  play_started: { start_action: string; day: number; onboarding_active: boolean };
  milestone_reached: { milestone: MilestoneId; day: number; season_number: number };
  day_completed: {
    day: number;
    season_number: number;
    weather_id: WeatherId;
    harvest_count: number;
    net_change: number;
    tax_deducted: number;
    lease_deducted: number;
    exhausted_plot_count: number;
    phase_after: GameState['phase'];
  };
  plot_unlocked: { unlocked_plots_after: number; price: number; coin_balance_after: number };
  season_completed: {
    season_number: number;
    outcome: SeasonOutcome;
    coin_balance: number;
    days_played: number;
  };
  run_ended: {
    outcome: RunOutcome;
    days_played: number;
    season_reached: number;
    peak_balance: number;
    disasters_survived: number;
    peak_harvest_streak: number;
    medal: Medal;
  };
}

export type AnalyticsEventName = keyof EventPropsMap;

/** Per-event schema version; bump the specific event when its shape changes. */
export const EVENT_VERSIONS: Record<AnalyticsEventName, number> = {
  page_loaded: 1,
  play_started: 1,
  milestone_reached: 1,
  day_completed: 1,
  plot_unlocked: 1,
  season_completed: 1,
  run_ended: 1,
};

export function buildDayCompletedProps(
  log: DailyLogEntry,
  seasonNumber: number,
  phaseAfter: GameState['phase'],
): EventPropsMap['day_completed'] {
  return {
    day: log.day,
    season_number: seasonNumber,
    weather_id: log.weatherId,
    harvest_count: log.harvests.length,
    net_change: log.netChange,
    tax_deducted: log.taxDeducted,
    lease_deducted: log.landLeaseDeducted,
    exhausted_plot_count: log.exhaustedPlots.length,
    phase_after: phaseAfter,
  };
}

export function runOutcomeForPhase(phase: GameState['phase']): RunOutcome | null {
  if (phase === 'bankrupt') return 'bankrupt';
  if (phase === 'season_failed') return 'season_failed';
  if (phase === 'season_4_won') return 'won';
  return null;
}

export function buildRunEndedProps(
  state: GameState,
  outcome: RunOutcome,
  seasonReached: number,
  medal: Medal,
): EventPropsMap['run_ended'] {
  return {
    outcome,
    days_played: state.currentDay,
    season_reached: seasonReached,
    peak_balance: state.peakBalance,
    disasters_survived: state.disastersSurvived,
    peak_harvest_streak: state.peakHarvestStreak,
    medal,
  };
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/events.ts tests/analytics/events.test.ts
git commit -m "feat(analytics): add typed event schema and pure prop mappers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A5: Track module — init, capture wrapper, no-op paths, page_loaded

**Files:**
- Create: `src/analytics/track.ts`
- Test: `tests/analytics/track.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/analytics/track.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.fn();
const init = vi.fn();
const optOutCapturing = vi.fn();

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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/track.test.ts`
Expected: FAIL — cannot resolve `../../src/analytics/track`.

- [ ] **Step 3: Implement `src/analytics/track.ts`**

```ts
import posthog from 'posthog-js';
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
let globals: GlobalProps | null = null;
let appVersion = 'dev';

/** Initialize analytics at most once. No key or denied consent -> permanent no-op. */
export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const cfg = getAnalyticsConfig();
  if (!cfg.key || !isTrackingAllowed()) return;

  const { id, isReturning } = getOrCreatePlayerId();
  posthog.init(cfg.key, {
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

  track('page_loaded', {
    is_returning_player: isReturning,
    has_saved_run: hasSavedRun(),
    ...parseUtms(typeof window !== 'undefined' ? window.location.search : ''),
  });
}

/** Fire-and-forget capture. No-ops unless initialized and consent still allows. */
export function track<N extends AnalyticsEventName>(name: N, props: EventPropsMap[N]): void {
  if (!enabled || !globals || !isTrackingAllowed()) return;
  posthog.capture(name, {
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
    if (initialized) posthog.opt_out_capturing();
  } else {
    // Re-enable within the session if we had already initialized with a key.
    if (initialized && globals) enabled = true;
    else initAnalytics();
  }
}

/** Test-only: reset module state between cases. */
export function __resetAnalyticsForTests(): void {
  initialized = false;
  enabled = false;
  playStartedFired = false;
  globals = null;
  appVersion = 'dev';
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/track.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/track.ts tests/analytics/track.test.ts
git commit -m "feat(analytics): add track module with gated init and page_loaded

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A6: Initialize analytics on app mount

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/App.analytics.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/App.analytics.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';

const initAnalytics = vi.fn();
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/App.analytics.test.tsx`
Expected: FAIL — `initAnalytics` not called (App does not import it yet).

- [ ] **Step 3: Wire it into `src/App.tsx`**

Add the import near the other imports at the top of `src/App.tsx`:

```tsx
import { useEffect } from 'react';
import { initAnalytics } from './analytics/track';
```

(If `useEffect` is already imported from `'react'`, merge it into the existing import instead of adding a duplicate.)

Then, as the first statement inside `function App()` (before the early `return`s), add:

```tsx
  useEffect(() => {
    initAnalytics();
  }, []);
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/App.analytics.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Full suite + lint**

Run: `npm test && npm run lint`
Expected: all pass; coverage floor holds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx tests/App.analytics.test.tsx
git commit -m "feat(analytics): initialize analytics on app mount

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase B — Event wiring

> All Phase B state-derived events live in `src/analytics/useAnalyticsEvents.ts`. Tasks B1–B5 grow this one hook incrementally; each adds its slice plus tests. The hook mocks `track` in tests and drives transitions with `rerender`.

### Task B1: `useAnalyticsEvents` — `day_completed`

**Files:**
- Create: `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/analytics/useAnalyticsEvents.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const track = vi.fn();
vi.mock('../../src/analytics/track', () => ({ track }));

import { useAnalyticsEvents } from '../../src/analytics/useAnalyticsEvents';
import { initialGameState } from '../../src/engine/gameEngine';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

function makeLog(day: number): DailyLogEntry {
  return {
    day,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests: [],
    totalHarvestIncome: 0,
    openingBalance: 100,
    landLeaseDeducted: 5,
    taxRate: 0.06,
    taxDeducted: 6,
    netChange: -11,
    closingBalance: 89,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 0,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
  };
}

beforeEach(() => track.mockClear());

describe('useAnalyticsEvents day_completed', () => {
  it('fires when lastDailyLog changes to a new entry', () => {
    const base = initialGameState();
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base as GameState },
    });
    expect(track).not.toHaveBeenCalledWith('day_completed', expect.anything());

    const next: GameState = { ...base, currentDay: 2, lastDailyLog: makeLog(1) };
    rerender({ state: next });

    expect(track).toHaveBeenCalledWith(
      'day_completed',
      expect.objectContaining({ day: 1, harvest_count: 0, tax_deducted: 6, phase_after: 'playing' }),
    );
  });

  it('does not re-fire when state changes but the log is unchanged', () => {
    const base = { ...initialGameState(), lastDailyLog: makeLog(1) } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();
    rerender({ state: { ...base, coinBalance: base.coinBalance + 1 } });
    expect(track).not.toHaveBeenCalledWith('day_completed', expect.anything());
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: FAIL — cannot resolve `../../src/analytics/useAnalyticsEvents`.

- [ ] **Step 3: Implement the initial hook `src/analytics/useAnalyticsEvents.ts`**

```tsx
import { useEffect, useRef } from 'react';
import type { GameState } from '../engine/types';
import { getSeasonForDay } from '../engine/seasons';
import { track } from './track';
import { buildDayCompletedProps } from './events';

/** Fires all state-derived analytics events by diffing engine state across renders. */
export function useAnalyticsEvents(state: GameState, _endOfRunRecap: unknown): void {
  const prevRef = useRef<GameState | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = state;
    if (prev === null) return;

    // day_completed — fire when a new daily log is produced.
    if (state.lastDailyLog && state.lastDailyLog !== prev.lastDailyLog) {
      const log = state.lastDailyLog;
      const seasonNumber = getSeasonForDay(log.day).number;
      track('day_completed', buildDayCompletedProps(log, seasonNumber, state.phase));
    }
  }, [state]);
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): fire day_completed from state transitions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B2: `plot_unlocked` + `first_plot_unlocked` milestone

**Files:**
- Modify: `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx` (append)

- [ ] **Step 1: Add the failing test (append to the existing describe file)**

Append to `tests/analytics/useAnalyticsEvents.test.tsx`:

```tsx
describe('useAnalyticsEvents plot_unlocked + first-plot milestone', () => {
  it('fires plot_unlocked with the paid price and the first-plot milestone once', () => {
    const base = { ...initialGameState(), unlockedPlots: 0, currentDay: 4 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: base },
    });
    track.mockClear();

    const after: GameState = { ...base, unlockedPlots: 1 };
    rerender({ state: after });

    const plotCall = track.mock.calls.find(([n]) => n === 'plot_unlocked');
    expect(plotCall).toBeTruthy();
    expect(plotCall![1]).toMatchObject({
      unlocked_plots_after: 1,
      coin_balance_after: after.coinBalance,
    });
    expect(typeof plotCall![1].price).toBe('number');

    const milestoneCall = track.mock.calls.find(
      ([n, p]) => n === 'milestone_reached' && p.milestone === 'first_plot_unlocked',
    );
    expect(milestoneCall).toBeTruthy();
    expect(milestoneCall![1]).toMatchObject({ milestone: 'first_plot_unlocked', day: 4 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: FAIL — no `plot_unlocked` call.

- [ ] **Step 3: Extend the hook**

Add the imports at the top of `src/analytics/useAnalyticsEvents.ts`:

```tsx
import { getNextPlotPrice } from '../engine/gameEngine';
```

Add a milestone-guard ref inside the hook (next to `prevRef`):

```tsx
  const firedMilestonesRef = useRef<Set<string>>(new Set());
```

Inside the `useEffect`, after the `day_completed` block, add:

```tsx
    // plot_unlocked + first_plot_unlocked milestone — on an unlockedPlots increment.
    if (state.unlockedPlots > prev.unlockedPlots) {
      const price = getNextPlotPrice(prev) ?? 0;
      track('plot_unlocked', {
        unlocked_plots_after: state.unlockedPlots,
        price,
        coin_balance_after: state.coinBalance,
      });
      if (prev.unlockedPlots === 0 && !firedMilestonesRef.current.has('first_plot_unlocked')) {
        firedMilestonesRef.current.add('first_plot_unlocked');
        track('milestone_reached', {
          milestone: 'first_plot_unlocked',
          day: state.currentDay,
          season_number: getSeasonForDay(state.currentDay).number,
        });
      }
    }
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: PASS (3 describes).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): fire plot_unlocked and first-plot milestone

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B3: `season_2_reached` milestone

**Files:**
- Modify: `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx` (append)

- [ ] **Step 1: Add the failing test**

Append:

```tsx
describe('useAnalyticsEvents season_2 milestone', () => {
  it('fires season_2_reached once when the derived season first hits 2', () => {
    // Season 1 is days 1-7; day 8 is season 2 (see engine/seasons).
    const s1 = { ...initialGameState(), currentDay: 5 } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: s1 },
    });
    track.mockClear();

    rerender({ state: { ...s1, currentDay: 8 } });
    rerender({ state: { ...s1, currentDay: 9 } });

    const calls = track.mock.calls.filter(
      ([n, p]) => n === 'milestone_reached' && p.milestone === 'season_2_reached',
    );
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ season_number: 2 });
  });
});
```

> If the season boundary differs, read `src/engine/seasons.ts` and adjust the day numbers so the transition crosses from season 1 to season 2. The behavior asserted (fires exactly once) does not change.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: FAIL — no `season_2_reached` call.

- [ ] **Step 3: Extend the hook**

Inside the `useEffect`, after the plot block, add:

```tsx
    // season_2_reached milestone — first time the derived season number reaches 2.
    const prevSeason = getSeasonForDay(prev.currentDay).number;
    const currSeason = getSeasonForDay(state.currentDay).number;
    if (
      prevSeason < 2 &&
      currSeason >= 2 &&
      !firedMilestonesRef.current.has('season_2_reached')
    ) {
      firedMilestonesRef.current.add('season_2_reached');
      track('milestone_reached', {
        milestone: 'season_2_reached',
        day: state.currentDay,
        season_number: currSeason,
      });
    }
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): fire season_2_reached milestone once per run

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B4: `season_completed`

**Files:**
- Modify: `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx` (append)

- [ ] **Step 1: Add the failing test**

Append:

```tsx
describe('useAnalyticsEvents season_completed', () => {
  it('fires on entering a season-resolution phase', () => {
    const playing = { ...initialGameState(), currentDay: 7, phase: 'playing' } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: playing },
    });
    track.mockClear();

    rerender({ state: { ...playing, phase: 'season_passed' } });

    const call = track.mock.calls.find(([n]) => n === 'season_completed');
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ outcome: 'season_passed', days_played: 7 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: FAIL — no `season_completed` call.

- [ ] **Step 3: Extend the hook**

Add the import at the top:

```tsx
import type { SeasonOutcome } from './events';
```

Inside the `useEffect`, after the season-2 block, add:

```tsx
    // season_completed — on entering any season-resolution phase.
    const seasonPhases: SeasonOutcome[] = ['season_passed', 'season_failed', 'season_4_won'];
    if (state.phase !== prev.phase && seasonPhases.includes(state.phase as SeasonOutcome)) {
      track('season_completed', {
        season_number: getSeasonForDay(state.currentDay).number,
        outcome: state.phase as SeasonOutcome,
        coin_balance: state.coinBalance,
        days_played: state.currentDay,
      });
    }
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): fire season_completed on resolution phases

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B5: `run_ended` (incl. `season_failed`) + new-run reset

**Files:**
- Modify: `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/useAnalyticsEvents.test.tsx` (append)

- [ ] **Step 1: Add the failing tests**

Append:

```tsx
describe('useAnalyticsEvents run_ended', () => {
  function playingOnDay(day: number): GameState {
    return { ...initialGameState(), currentDay: day, phase: 'playing' } as GameState;
  }

  it('fires once on bankruptcy', () => {
    const s = playingOnDay(12);
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: s },
    });
    track.mockClear();
    rerender({ state: { ...s, phase: 'bankrupt' } });
    rerender({ state: { ...s, phase: 'bankrupt', coinBalance: -5 } });
    const calls = track.mock.calls.filter(([n]) => n === 'run_ended');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ outcome: 'bankrupt', days_played: 12 });
  });

  it('fires on season_failed (the gap the recordRunEnd effect misses)', () => {
    const s = playingOnDay(20);
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: s },
    });
    track.mockClear();
    rerender({ state: { ...s, phase: 'season_failed' } });
    const call = track.mock.calls.find(([n]) => n === 'run_ended');
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ outcome: 'season_failed' });
  });

  it('resets per-run guards when a fresh run begins', () => {
    const bankrupt = { ...initialGameState(), currentDay: 12, phase: 'bankrupt' } as GameState;
    const { rerender } = renderHook(({ state }) => useAnalyticsEvents(state, null), {
      initialProps: { state: bankrupt },
    });
    track.mockClear();
    // restart() produces a fresh initialGameState (day 1, playing).
    rerender({ state: initialGameState() as GameState });
    // A second bankruptcy in the new run must fire run_ended again.
    const secondRun = { ...initialGameState(), currentDay: 9, phase: 'bankrupt' } as GameState;
    rerender({ state: secondRun });
    const calls = track.mock.calls.filter(([n]) => n === 'run_ended');
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toMatchObject({ days_played: 9 });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: FAIL — no `run_ended` call.

- [ ] **Step 3: Extend the hook**

Add the imports at the top:

```tsx
import { deriveMedal } from '../engine/medals';
import { buildRunEndedProps, runOutcomeForPhase } from './events';
```

Add a run-ended guard ref inside the hook (next to the other refs):

```tsx
  const runEndedFiredRef = useRef(false);
```

Inside the `useEffect`, before the `prevRef.current = state` assignment is fine, but keep it at the end of the diff logic. Add this block after the `season_completed` block:

```tsx
    // New-run reset — a fresh initialGameState (day 1, playing) starts a new run.
    if (state.phase === 'playing' && state.currentDay === 1 && prev.currentDay !== 1) {
      firedMilestonesRef.current.clear();
      runEndedFiredRef.current = false;
    }

    // run_ended — first transition into a terminal phase this run.
    const outcome = runOutcomeForPhase(state.phase);
    const isEndlessWin = state.phase === 'season_4_won' && state.endlessMode;
    if (
      outcome !== null &&
      !isEndlessWin &&
      state.phase !== prev.phase &&
      !runEndedFiredRef.current
    ) {
      runEndedFiredRef.current = true;
      const seasonReached = getSeasonForDay(state.currentDay).number;
      const won = outcome === 'won';
      track('run_ended', buildRunEndedProps(state, outcome, seasonReached, deriveMedal(seasonReached, won)));
    }
```

> Note: `season_4_won` while `endlessMode` is true is intentionally excluded (matches the existing terminal-transition semantics in `useGameEngine`). `season_failed` is intentionally included — the core fix from the spec.

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/analytics/useAnalyticsEvents.test.tsx`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/useAnalyticsEvents.ts tests/analytics/useAnalyticsEvents.test.tsx
git commit -m "feat(analytics): fire run_ended (incl. season_failed) with per-run reset

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B6: Mount `useAnalyticsEvents` in App

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/App.analytics.test.tsx` (append)

- [ ] **Step 1: Add the failing test**

Replace the `useAnalyticsEvents` mock line in `tests/App.analytics.test.tsx` with a spy and assert it is called with engine state:

```tsx
const useAnalyticsEvents = vi.fn();
vi.mock('../src/analytics/useAnalyticsEvents', () => ({ useAnalyticsEvents }));
```

Add this test inside the describe:

```tsx
  it('mounts useAnalyticsEvents with the engine state', () => {
    render(<App />);
    expect(useAnalyticsEvents).toHaveBeenCalled();
    const [stateArg] = useAnalyticsEvents.mock.calls[0];
    expect(stateArg).toHaveProperty('phase');
    expect(stateArg).toHaveProperty('plots');
  });
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/App.analytics.test.tsx`
Expected: FAIL — `useAnalyticsEvents` not called.

- [ ] **Step 3: Wire it into `src/App.tsx`**

Add the import at the top:

```tsx
import { useAnalyticsEvents } from './analytics/useAnalyticsEvents';
```

Immediately after `const engine = useGameEngine();` in `function App()`, add:

```tsx
  useAnalyticsEvents(engine.state, engine.endOfRunRecap);
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/App.analytics.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/App.analytics.test.tsx
git commit -m "feat(analytics): mount useAnalyticsEvents in App

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B7: `play_started` inline in `useGameEngine`

**Files:**
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/engine/useGameEngine.playStarted.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/useGameEngine.playStarted.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const trackPlayStartedOnce = vi.fn();
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/engine/useGameEngine.playStarted.test.tsx`
Expected: FAIL — `trackPlayStartedOnce` never called.

- [ ] **Step 3: Wire it into `src/engine/useGameEngine.ts`**

Add imports near the top (after the existing engine imports):

```ts
import { trackPlayStartedOnce } from '../analytics/track';
import { loadOnboarding } from './onboarding';
```

Add this helper inside `useGameEngine`, just after the `stateRef` effect:

```ts
  const signalPlayStarted = useCallback((action: string) => {
    const s = stateRef.current;
    trackPlayStartedOnce({
      start_action: action,
      day: s.currentDay,
      onboarding_active: !loadOnboarding().completed && s.currentDay <= 1,
    });
  }, []);
```

Then add one call in the success branch of each mutating wrapper, immediately before its `setState(...)`:

- In `nextDay`: after computing the turn, before `setState`, add `signalPlayStarted('next_day');`
- In `plant`: `signalPlayStarted('plant');`
- In `buySeed`: `signalPlayStarted('buy_seed');`
- In `buyUpgrade`: `signalPlayStarted('buy_upgrade');`
- In `buyFertilizer`: `signalPlayStarted('buy_fertilizer');`
- In `applyFertilizer`: `signalPlayStarted('apply_fertilizer');`
- In `clearPestDamage`: `signalPlayStarted('clear_pest');`
- In `buyPlot`: `signalPlayStarted('buy_plot');`

Example — the `buySeed` wrapper becomes:

```ts
  const buySeed = useCallback((cropId: CropId, quantity: number): boolean => {
    const result = engineBuySeed(stateRef.current, cropId, quantity);
    if (!result.ok) return false;
    signalPlayStarted('buy_seed');
    setState(result.state);
    return true;
  }, [signalPlayStarted]);
```

> `nextDay` currently has no `ok` gate (it always advances); place `signalPlayStarted('next_day')` right before its `setState`. Add `signalPlayStarted` to each wrapper's dependency array.

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/engine/useGameEngine.playStarted.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Regression — existing engine tests still pass**

Run: `npx vitest run tests/engine/useGameEngine.test.ts`
Expected: PASS (no behavior change to returns).

- [ ] **Step 6: Commit**

```bash
git add src/engine/useGameEngine.ts tests/engine/useGameEngine.playStarted.test.tsx
git commit -m "feat(analytics): fire play_started on first successful engine action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B8: Opt-out toggle component

**Files:**
- Create: `src/components/AnalyticsOptOutToggle.tsx`
- Modify: `src/App.tsx` (render it on the main playing screen)
- Test: `tests/components/AnalyticsOptOutToggle.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/AnalyticsOptOutToggle.test.tsx`:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setAnalyticsOptOut = vi.fn();
vi.mock('../../src/analytics/track', () => ({ setAnalyticsOptOut }));

import { AnalyticsOptOutToggle } from '../../src/components/AnalyticsOptOutToggle';
import { ANALYTICS_OPT_OUT_KEY } from '../../src/analytics/consent';

beforeEach(() => {
  localStorage.clear();
  setAnalyticsOptOut.mockClear();
});

describe('AnalyticsOptOutToggle', () => {
  it('reflects the default opted-in state and opts out on click', async () => {
    render(<AnalyticsOptOutToggle />);
    const btn = screen.getByRole('button', { name: /analytics/i });
    expect(btn).toHaveTextContent(/on/i);

    await userEvent.click(btn);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(true);
    expect(btn).toHaveTextContent(/off/i);
  });

  it('reflects a persisted opted-out state and opts back in on click', async () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    render(<AnalyticsOptOutToggle />);
    const btn = screen.getByRole('button', { name: /analytics/i });
    expect(btn).toHaveTextContent(/off/i);

    await userEvent.click(btn);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(false);
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AnalyticsOptOutToggle />);
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then(m => m.axe(container))).toHaveNoViolations();
  });
});

afterEach(cleanup);
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/components/AnalyticsOptOutToggle.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Implement `src/components/AnalyticsOptOutToggle.tsx`**

```tsx
import { useState } from 'react';
import { isOptedOut, optIn, optOut } from '../analytics/consent';
import { setAnalyticsOptOut } from '../analytics/track';

/** Small privacy control: flips the local analytics opt-out flag. */
export function AnalyticsOptOutToggle() {
  const [optedOut, setOptedOut] = useState<boolean>(() => isOptedOut());

  const toggle = () => {
    const next = !optedOut;
    if (next) optOut();
    else optIn();
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!optedOut}
      className="fixed bottom-2 left-2 z-40 rounded bg-black/40 px-2 py-1 text-xs text-white/80 hover:text-white"
      title="Toggle anonymous analytics. No personal data is ever collected."
    >
      Analytics: {optedOut ? 'off' : 'on'}
    </button>
  );
}
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `npx vitest run tests/components/AnalyticsOptOutToggle.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Render it in `src/App.tsx`**

Add the import at the top:

```tsx
import { AnalyticsOptOutToggle } from './components/AnalyticsOptOutToggle';
```

Render `<AnalyticsOptOutToggle />` inside the main playing-screen return (the fragment that renders `GameBoard`), as a sibling of the existing top-level content — e.g. just before the closing `</>` of that return. Because it is `position: fixed`, exact placement in the tree does not affect layout.

- [ ] **Step 6: Full suite + lint**

Run: `npm test && npm run lint`
Expected: all pass; coverage floor holds.

- [ ] **Step 7: Commit**

```bash
git add src/components/AnalyticsOptOutToggle.tsx src/App.tsx tests/components/AnalyticsOptOutToggle.test.tsx
git commit -m "feat(analytics): add opt-out toggle and render it on the play screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B9: Manual browser verification (preview) — ✅ done 2026-07-06

Verified against the connected PostHog project "Default project" (216788, EU) via the preview browser.

- [x] **Step 1: Configure a dev key** — `.env.local` created with `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST=https://eu.i.posthog.com`, `VITE_APP_VERSION=017-analytics-b9`.
- [x] **Step 2: Run the app** and play a short run — plot bought (plot_unlocked), day advanced, save seeded to day 20 to cross into season 2 (season_completed + season_2_reached), then seeded to a low balance to force bankruptcy (run_ended).
- [x] **Step 3:** Confirmed the full sequence `page_loaded → play_started → day_completed(×N) → plot_unlocked → season_completed → milestone_reached → run_ended` POSTed to `eu.i.posthog.com`; C1 confirmed each carries `anonymous_player_id`, `session_id`, `device_type`, `schema_version`, `event_version`, `app_version`, and no PII.
- [x] **Step 4: Opt-out toggle** — toggling "Analytics: off" (localStorage optout=true, `posthog.opt_out_capturing()`) produced **zero** new ingestion POSTs across a restart + full replay; toggling back on resumed capture.
- [x] **Step 5: Do-Not-Track** — exercised against the shipped `consent.ts`/`track.ts`: with DNT set, `isTrackingAllowed()===false`, `initAnalytics()` refuses to init and `track()` no-ops (no ingestion POST).

---

## Phase C — Dashboards (PostHog MCP)

> Operational, not code. Run **after** Phase B events have flowed at least once so schema discovery sees real event/property names. Uses the connected PostHog MCP `exec` CLI. For every tool: `info <tool>` (and `schema <tool> <field>` where hinted) **before** `call`. Confirm events exist via `read-data-schema` before building any insight.

### Task C1: Verify event schema is live — ✅ done 2026-07-06

- [x] All 7 events present (`page_loaded`, `play_started`, `milestone_reached`, `day_completed`, `plot_unlocked`, `season_completed`, `run_ended`).
- [x] `run_ended` carries `outcome`, `season_reached`, `days_played`, `peak_balance`, `disasters_survived`, `peak_harvest_streak`, `medal`; `day_completed` carries `net_change`, `tax_deducted`, `lease_deducted`, `season_number`, `weather_id`, `harvest_count`, `exhausted_plot_count`, `phase_after`. Globals (`anonymous_player_id`, `session_id`, `device_type`, `app_version`, `schema_version`, `event_version`) merged on both; no PII.

### Task C2: Create the "Pixel Parsnips — Core" dashboard and insights — ✅ done 2026-07-06

Dashboard: https://eu.posthog.com/project/216788/dashboard/798528

- [x] Dashboard created (id 798528).
- [x] **Activation funnel** (`3Tcoqzoj`): `page_loaded → play_started → milestone_reached` (verified 100% on the seed run).
- [x] **Core-loop trend** (`Y7fUjFRl`): total `day_completed` per day.
- [x] **Run outcomes** (`zNUGFHJa`): `run_ended` count, breakdown by `outcome`.
- [x] **Season 1 pass rate** (`RSnTq2HS`): `season_completed` breakdown by `outcome`, filtered `season_number = 1`.
- [x] **Expansion pacing** (`BYWNR0xz`): median of `unlocked_plots_after` on `plot_unlocked`. **Note:** the plan originally specified "median of the `day` property", but `plot_unlocked` carries no `day` property (only `unlocked_plots_after`, `price`, `coin_balance_after`), so plots-reached is used as the pacing proxy. Add a `day` prop to `plot_unlocked` in `events.ts`/`useAnalyticsEvents.ts` if run-day pacing is wanted.
- [x] **Retention** (`717yhjTl`): first-time D1–D7 active retention on `day_completed` (aggregated on person distinct_id = bootstrapped `anonymous_player_id`).

### Task C3: Create cohorts and pin the north star — ✅ done 2026-07-06

- [x] **Returning players** cohort (id 174202) — `page_loaded ≥ 2` in last 30 days.
- [x] **North Star — weekly active players** cohort (id 174203) — `day_completed ≥ 3` in last 7 days; plus a favorited north-star insight (`XlPzTcqO`) plotting weekly unique players in that cohort.
- [x] Dashboard renders with the seed data (`dashboard-insights-run`, force_blocking): funnel 1→1→1, core loop 4, run outcomes bankrupt=1, retention D0=1, north star=1, expansion pacing median=5.

---

## Self-Review

**Spec coverage** — every spec section maps to a task:
- Consent (opt-out/DNT) → A2, B8, B9(step 4–5). Global props → A3, A5. Config/no-op → A1, A5. Event schema P0+P1 → A4 + B1–B7. Firing seams → B1 (`day_completed`), B2 (`plot_unlocked`, first-plot), B3 (`season_2`), B4 (`season_completed`), B5 (`run_ended` incl. `season_failed`), B7 (`play_started`), A5/A6 (`page_loaded`). `season_failed` fix → B5. New-run reset → B5. PostHog init privacy config → A5. Dashboards/cohorts/north star → C1–C3. Testing matrix → tests in every A/B task. Risks (StrictMode, no-key, public key) → A5/A6 tests.
- Not implemented by design (spec Non-Goals): server-side collection, `identify()` with PII, Later-tier events, experiments/flags/surveys.

**Placeholder scan** — no TBD/TODO; every code and test step contains complete content. The only intentionally-operational section (Phase C) uses concrete MCP commands and the discovery workflow rather than code.

**Type consistency** — `EventPropsMap`, `AnalyticsEventName`, `EVENT_VERSIONS`, `ANALYTICS_SCHEMA_VERSION`, `runOutcomeForPhase`, `buildDayCompletedProps`, `buildRunEndedProps`, `SeasonOutcome`, `MilestoneId` are defined in A4 and used unchanged in B1–B7. `track`/`trackPlayStartedOnce`/`initAnalytics`/`setAnalyticsOptOut`/`__resetAnalyticsForTests` are defined in A5 and mocked/consumed consistently. `ANALYTICS_OPT_OUT_KEY`/`isOptedOut`/`optIn`/`optOut` (A2), `getOrCreatePlayerId`/`hasSavedRun`/`parseUtms`/`getDeviceType`/`buildGlobalProps`/`GlobalProps` (A3) are referenced with matching signatures throughout.
