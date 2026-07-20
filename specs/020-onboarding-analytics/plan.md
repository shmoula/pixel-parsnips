# Onboarding Funnel Analytics (A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the onboarding step funnel, skip-point, completion, tutorial-replay, and empty-day safeguard events on top of the 017 analytics layer, then provision the "Pixel Parsnips — Onboarding" PostHog dashboard.

**Architecture:** Five new typed events join `EventPropsMap` in `src/analytics/events.ts`. Step/skip/complete emissions live in `src/hooks/useOnboarding.ts` at the same seams that already call `saveOnboarding`, guarded by an emitted-through-index ref (StrictMode-safe, resume-safe, cascade-aware). The replay event is emitted from `App.tsx`'s `onReplayTutorial` handler; the safeguard event from `GameBoard.tsx`'s `EmptyDayConfirm` callbacks. The dashboard is provisioned via the connected PostHog MCP (Phase C, mirrors 017).

**Tech Stack:** TypeScript ~5.6, React 18.3, Vitest + @testing-library/react (jsdom), PostHog Cloud EU (project 216788) via the PostHog MCP.

**Spec:** `specs/020-onboarding-analytics/spec.md` (read it first — it locks the event semantics).

**Branch:** `020-onboarding-analytics` (already created).

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/analytics/events.ts` | Modify | Add 5 event shapes to `EventPropsMap` + `EVENT_VERSIONS`; add `OnboardingFunnelStep` type |
| `src/engine/onboarding.ts` | Modify | Export the (currently private) ordered step list as `ONBOARDING_STEPS` |
| `src/hooks/useOnboarding.ts` | Modify | Emit `onboarding_step_reached` / `onboarding_skipped` / `onboarding_completed` at existing transition seams |
| `src/App.tsx` | Modify | Emit `onboarding_replay_requested` in the `onReplayTutorial` handler |
| `src/components/GameBoard.tsx` | Modify | Emit `empty_day_safeguard` from the `EmptyDayConfirm` dialog callbacks |
| `tests/analytics/events.test.ts` | Modify | Schema-version coverage for the new events |
| `tests/engine/onboarding.test.ts` | Modify | `ONBOARDING_STEPS` order/shape |
| `tests/hooks/useOnboarding.tracking.test.tsx` | Create | All hook-level emission scenarios |
| `tests/App.replayTracking.test.tsx` | Create | Replay button emission (mocked engine in bankrupt phase) |
| `tests/components/GameBoard.safeguard.test.tsx` | Create | Safeguard dialog emissions |
| `backlog.md` | Modify (Task 7) | Mark A1 done |

Conventions used throughout:

- Run a single test file: `npx vitest run <path>` (project test runner is Vitest; `npm test` = `vitest run` over everything).
- All tests that assert emissions mock the track module with `vi.hoisted` + `vi.mock`, exactly like the existing `tests/analytics/useAnalyticsEvents.test.tsx`.
- jsdom `matchMedia` is stubbed to `matches: false` in `tests/setup.ts`, so `GameBoard` renders in mobile mode in tests (the `BottomActionBar` is present; "Skip day" buttons appear in both HUD and bar — use `getAllByRole(...)[0]`).

---

### Task 1: Event schema — five new events in `events.ts`

**Files:**
- Modify: `src/analytics/events.ts`
- Test: `tests/analytics/events.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics/events.test.ts`, inside the existing `describe('events schema', ...)` block (after the `'exposes a schema version and a version per event'` test):

```ts
  it('versions the 020 onboarding-funnel events', () => {
    expect(EVENT_VERSIONS.onboarding_step_reached).toBe(1);
    expect(EVENT_VERSIONS.onboarding_completed).toBe(1);
    expect(EVENT_VERSIONS.onboarding_skipped).toBe(1);
    expect(EVENT_VERSIONS.onboarding_replay_requested).toBe(1);
    expect(EVENT_VERSIONS.empty_day_safeguard).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: FAIL — TypeScript/runtime error: `EVENT_VERSIONS` has no property `onboarding_step_reached` (`toBe(1)` receives `undefined`).

- [ ] **Step 3: Implement the schema additions**

In `src/analytics/events.ts`:

3a. Add the import and funnel-step type after the existing imports (below `import type { Medal } from '../engine/medals';`):

```ts
import type { OnboardingStep } from '../engine/onboarding';
```

3b. Add next to the other exported type aliases (after `export type SeasonOutcome = ...`):

```ts
/** Tutorial steps that appear in the funnel — every step except the terminal 'done'. */
export type OnboardingFunnelStep = Exclude<OnboardingStep, 'done'>;
```

3c. Add five entries at the end of `interface EventPropsMap` (after `shop_purchased: {...};`):

```ts
  onboarding_step_reached: { step: OnboardingFunnelStep; step_index: number };
  onboarding_completed: Record<string, never>;
  onboarding_skipped: { from_step: OnboardingFunnelStep; from_step_index: number };
  onboarding_replay_requested: Record<string, never>;
  empty_day_safeguard: {
    action: 'advanced' | 'cancelled';
    onboarding_active: boolean;
    day: number;
    coin_balance: number;
  };
```

3d. Add five entries at the end of `EVENT_VERSIONS` (after `shop_purchased: 1,`):

```ts
  onboarding_step_reached: 1,
  onboarding_completed: 1,
  onboarding_skipped: 1,
  onboarding_replay_requested: 1,
  empty_day_safeguard: 1,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: PASS (all existing tests in the file too).

- [ ] **Step 5: Commit**

```bash
git add src/analytics/events.ts tests/analytics/events.test.ts
git commit -m "feat(analytics): add onboarding funnel + safeguard event schemas (020)"
```

---

### Task 2: Export `ONBOARDING_STEPS` from the engine

The ordered step list currently lives as a private `STEPS` const in `src/engine/onboarding.ts`; the emitter needs it to compute `step_index` and walk cascade intermediates.

**Files:**
- Modify: `src/engine/onboarding.ts:13-15`
- Test: `tests/engine/onboarding.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine/onboarding.test.ts`, add `ONBOARDING_STEPS` to the existing import from `'../../src/engine/onboarding'`, then append a new describe block at the end of the file:

```ts
describe('ONBOARDING_STEPS', () => {
  it('is the full ordered flow with done last', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff', 'done',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/onboarding.test.ts`
Expected: FAIL — `ONBOARDING_STEPS` is not exported.

- [ ] **Step 3: Rename and export the const**

In `src/engine/onboarding.ts`, replace:

```ts
const STEPS: readonly OnboardingStep[] = [
  'welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff', 'done',
];
```

with:

```ts
/** Ordered steps of the guided flow; index = funnel position ('done' is terminal, never emitted). */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  'welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff', 'done',
];
```

and update the one internal reference in `isStep`:

```ts
function isStep(v: unknown): v is OnboardingStep {
  return typeof v === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(v);
}
```

(There are no other references to `STEPS` in the file — the doc comment above the type already describes the order.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/onboarding.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/onboarding.ts tests/engine/onboarding.test.ts
git commit -m "refactor(onboarding): export ONBOARDING_STEPS for funnel indexing (020)"
```

---

### Task 3: Step / skip / complete emissions in `useOnboarding`

The core of A1. Design constraints (from the spec — do not deviate):

- `done` is **never** emitted as `onboarding_step_reached`.
- Cascade jumps emit every intermediate step, in order (e.g. desktop: `onStart` lands on `open-shop`, the effect immediately derives `buy-radishes` → both emit).
- Resume-after-refresh at a step past `welcome` emits nothing until the next real transition, and never re-emits earlier steps.
- StrictMode's double effect invocation must not double-fire. The mechanism: a single `emittedThroughRef` recording the highest `ONBOARDING_STEPS` index already emitted; every emission path walks from `ref + 1` to its target, so replays of the same effect are no-ops.

**Files:**
- Modify: `src/hooks/useOnboarding.ts`
- Create: `tests/hooks/useOnboarding.tracking.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/hooks/useOnboarding.tracking.test.tsx` with this exact content:

```tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { StrictMode } from 'react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({ track }));

import { useOnboarding } from '../../src/hooks/useOnboarding';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete, requestOnboardingReplay } from '../../src/engine/onboarding';
import type { GameState } from '../../src/engine/types';

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
});

/** Fresh day-1 state with no seeds and 4 empty plots (mirrors useOnboarding.test.tsx). */
function day1(): GameState {
  const s = initialGameState();
  return { ...s, seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 } };
}

function plantAll(s: GameState): GameState {
  const plots = s.plots.map((p, i) =>
    i < s.unlockedPlots ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
  );
  return { ...s, plots };
}

/** Steps emitted so far, in call order. */
function emittedSteps(): string[] {
  return track.mock.calls
    .filter(([name]) => name === 'onboarding_step_reached')
    .map(([, props]) => (props as { step: string }).step);
}

describe('useOnboarding tracking — activation', () => {
  it('emits welcome once for a fresh first run', () => {
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(emittedSteps()).toEqual(['welcome']);
    expect(track).toHaveBeenCalledWith('onboarding_step_reached', { step: 'welcome', step_index: 0 });
  });

  it('emits welcome exactly once under StrictMode double-invocation', () => {
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }), { wrapper: StrictMode });
    expect(emittedSteps()).toEqual(['welcome']);
  });

  it('emits nothing when onboarding is already completed', () => {
    markOnboardingComplete();
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(track).not.toHaveBeenCalled();
  });

  it('emits nothing for a pre-feature run already past day 1', () => {
    renderHook(() => useOnboarding({ ...day1(), currentDay: 7 }, { isShopVisible: false }));
    expect(track).not.toHaveBeenCalled();
  });

  it('a replayed tutorial re-emits from welcome', () => {
    markOnboardingComplete();
    requestOnboardingReplay();
    renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(emittedSteps()).toEqual(['welcome']);
  });
});

describe('useOnboarding tracking — step progression', () => {
  it('emits open-shop on the start CTA (shop hidden)', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onStart());
    expect(emittedSteps()).toEqual(['welcome', 'open-shop']);
    expect(track).toHaveBeenCalledWith('onboarding_step_reached', { step: 'open-shop', step_index: 1 });
  });

  it('emits cascade intermediates in order when the shop is already visible', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: true }));
    act(() => result.current.onStart());
    // open-shop passes through instantly (desktop sidebar) — both steps emit, in order.
    expect(emittedSteps()).toEqual(['welcome', 'open-shop', 'buy-radishes']);
  });

  it('emits every step through payoff, then onboarding_completed on dismiss — never done', () => {
    let state = day1();
    const { result, rerender } = renderHook(
      ({ s }) => useOnboarding(s, { isShopVisible: true }),
      { initialProps: { s: state } },
    );
    act(() => result.current.onStart());
    state = { ...state, seedInventory: { ...state.seedInventory, radish: 4 } };
    rerender({ s: state });
    state = plantAll({ ...state, seedInventory: { ...state.seedInventory, radish: 0 } });
    rerender({ s: state });
    state = { ...state, currentDay: 2, lastDailyLog: { totalHarvestIncome: 48 } as GameState['lastDailyLog'] };
    rerender({ s: state });
    act(() => result.current.onDismissPayoff());

    expect(emittedSteps()).toEqual(['welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff']);
    expect(track).toHaveBeenCalledWith('onboarding_completed', {});
    expect(track).not.toHaveBeenCalledWith('onboarding_skipped', expect.anything());
    expect(emittedSteps()).not.toContain('done');
  });

  it('does not re-emit earlier steps on resume-after-refresh, and continues from there', () => {
    localStorage.setItem(
      'pixel-parsnips-onboarding',
      JSON.stringify({ schemaVersion: 1, completed: false, step: 'buy-radishes' }),
    );
    let state = day1();
    const { rerender } = renderHook(({ s }) => useOnboarding(s, { isShopVisible: true }), {
      initialProps: { s: state },
    });
    expect(track).not.toHaveBeenCalled();

    // Buying the radishes advances buy-radishes -> plant: only 'plant' emits.
    state = { ...state, seedInventory: { ...state.seedInventory, radish: 4 } };
    rerender({ s: state });
    expect(emittedSteps()).toEqual(['plant']);
    expect(track).toHaveBeenCalledWith('onboarding_step_reached', { step: 'plant', step_index: 3 });
  });
});

describe('useOnboarding tracking — skip and completion exclusivity', () => {
  it('emits onboarding_skipped with the step the player was on', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: true }));
    act(() => result.current.onStart()); // lands on buy-radishes via cascade
    act(() => result.current.onSkip());
    expect(track).toHaveBeenCalledWith('onboarding_skipped', {
      from_step: 'buy-radishes',
      from_step_index: 2,
    });
    expect(track).not.toHaveBeenCalledWith('onboarding_completed', expect.anything());
  });

  it('skip straight from welcome is valid', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onSkip());
    expect(track).toHaveBeenCalledWith('onboarding_skipped', {
      from_step: 'welcome',
      from_step_index: 0,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/hooks/useOnboarding.tracking.test.tsx`
Expected: FAIL — every emission assertion fails (`track` never called by the hook yet). The "emits nothing" tests pass vacuously; that's fine.

- [ ] **Step 3: Implement the emissions**

Replace the entire contents of `src/hooks/useOnboarding.ts` with:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types';
import {
  loadOnboarding,
  saveOnboarding,
  markOnboardingComplete,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '../engine/onboarding';
import { track } from '../analytics/track';
import type { OnboardingFunnelStep } from '../analytics/events';

export interface UseOnboardingResult {
  active: boolean;
  step: OnboardingStep;
  shouldPinWeather: boolean;
  onStart: () => void;
  onSkip: () => void;
  onDismissPayoff: () => void;
}

interface Opts {
  /** True when the shop is on-screen (always true on desktop sidebar; mobile sheet open). */
  isShopVisible: boolean;
}

/** Count of unlocked, plantable (empty / not pest / not exhausted) plots. */
export function emptyPlotCount(state: GameState): number {
  return state.plots
    .slice(0, state.unlockedPlots)
    .filter(p => p.cropId === null && !p.pestDamaged && p.exhaustedSinceDay === null).length;
}

/**
 * Radishes needed to satisfy the buy-radishes step: one per open plot, floored at 1.
 * The floor matters because if every unlocked plot happens to be pest-damaged or
 * exhausted when the tutorial starts, `emptyPlotCount` returns 0 — without the floor
 * the step would either "complete" with zero radishes bought, or the progress display
 * would read "X of 0 bought". Shared by `deriveStep` (step-advance gate) and
 * `GameBoard`'s progress display so the two can never desync.
 */
export function buyRadishesNeeded(state: GameState): number {
  return Math.max(1, emptyPlotCount(state));
}

/**
 * Forward-only goal evaluation: given the current step and live state, return the
 * furthest AUTO step now justified. Manual gates (welcome, payoff) are returned as-is.
 */
function deriveStep(step: OnboardingStep, state: GameState, isShopVisible: boolean): OnboardingStep {
  let s = step;
  // Cascade: each satisfied goal moves to the next step; manual steps stop the cascade.
  while (true) {
    if (s === 'open-shop' && isShopVisible) { s = 'buy-radishes'; continue; }
    if (s === 'buy-radishes') {
      const needed = buyRadishesNeeded(state);
      if (state.seedInventory.radish >= needed) { s = 'plant'; continue; }
    }
    if (s === 'plant' && emptyPlotCount(state) === 0) { s = 'advance'; continue; }
    if (s === 'advance' && state.lastDailyLog !== null) { s = 'payoff'; continue; }
    return s;
  }
}

export function useOnboarding(state: GameState, { isShopVisible }: Opts): UseOnboardingResult {
  // One-time init: decide whether the tutorial runs at all.
  const initRef = useRef(false);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  // Highest ONBOARDING_STEPS index already emitted as onboarding_step_reached.
  // Every emission path walks from ref + 1 to its target, so cascade jumps emit
  // intermediates, resume never re-emits earlier steps, and StrictMode's double
  // effect invocation is a no-op on the second pass.
  const emittedThroughRef = useRef(ONBOARDING_STEPS.length - 1);

  if (!initRef.current) {
    initRef.current = true;
    const rec = loadOnboarding();
    if (rec.completed) {
      // already done — stay inactive
    } else if (state.currentDay > 1) {
      // Pre-feature run already in progress — never yank into a tutorial.
      markOnboardingComplete();
    } else {
      // Fresh first run.
      // (setState during render init is fine; React applies before commit.)
    }
    const willBeActive = !rec.completed && state.currentDay <= 1;
    setActive(willBeActive);
    setStep(rec.completed ? 'done' : rec.step);
    // 'welcome' (the default/replayed record) starts below 0 so the entry step
    // emits; resuming at a later step counts that step as already emitted.
    emittedThroughRef.current = !willBeActive
      ? ONBOARDING_STEPS.length - 1
      : rec.step === 'welcome' ? -1 : ONBOARDING_STEPS.indexOf(rec.step);
  }

  const emitStepsThrough = useCallback((toIndex: number) => {
    for (let i = emittedThroughRef.current + 1; i <= toIndex; i++) {
      const s = ONBOARDING_STEPS[i];
      if (s === 'done') break; // terminal outcome is onboarding_completed/_skipped, never a step
      track('onboarding_step_reached', { step: s as OnboardingFunnelStep, step_index: i });
    }
    if (toIndex > emittedThroughRef.current) emittedThroughRef.current = toIndex;
  }, []);

  // welcome — the entry step of a fresh (or replayed) tutorial pass.
  useEffect(() => {
    if (active && step === 'welcome') emitStepsThrough(0);
  }, [active, step, emitStepsThrough]);

  // Goal-driven forward advancement for auto steps.
  useEffect(() => {
    if (!active) return;
    const next = deriveStep(step, state, isShopVisible);
    if (next !== step) {
      emitStepsThrough(ONBOARDING_STEPS.indexOf(next));
      setStep(next);
      saveOnboarding({ schemaVersion: 1, completed: false, step: next });
    }
  }, [active, step, state, isShopVisible, emitStepsThrough]);

  const onStart = useCallback(() => {
    emitStepsThrough(1);
    setStep('open-shop');
    saveOnboarding({ schemaVersion: 1, completed: false, step: 'open-shop' });
  }, [emitStepsThrough]);

  const finish = useCallback(() => {
    markOnboardingComplete();
    setStep('done');
    setActive(false);
  }, []);

  const onSkip = useCallback(() => {
    // step can't be 'done' here: finish() deactivates before the overlay unmounts.
    track('onboarding_skipped', {
      from_step: step as OnboardingFunnelStep,
      from_step_index: ONBOARDING_STEPS.indexOf(step),
    });
    finish();
  }, [step, finish]);

  const onDismissPayoff = useCallback(() => {
    track('onboarding_completed', {});
    finish();
  }, [finish]);

  return {
    active,
    step,
    shouldPinWeather: active && step === 'advance',
    onStart,
    onSkip,
    onDismissPayoff,
  };
}
```

Note what changed vs. the original: the two new imports, the `emittedThroughRef` + init line, the `emitStepsThrough` helper, the welcome effect, one `emitStepsThrough` call in the advancement effect, one in `onStart`, and `onSkip`/`onDismissPayoff` gaining their `track` calls (previously both were bare aliases of `finish`). `emptyPlotCount`, `buyRadishesNeeded`, `deriveStep`, and all gating logic are byte-identical to before.

- [ ] **Step 4: Run the new tests, then the full suite**

Run: `npx vitest run tests/hooks/useOnboarding.tracking.test.tsx`
Expected: PASS (all scenarios).

Run: `npx vitest run tests/hooks/ tests/analytics/ tests/components/OnboardingOverlay.test.tsx`
Expected: PASS — the pre-existing `useOnboarding.test.tsx` must still pass unchanged (behavior is untouched; only emissions were added). If anything there fails, the implementation changed behavior — fix the implementation, not the old test.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOnboarding.ts tests/hooks/useOnboarding.tracking.test.tsx
git commit -m "feat(analytics): emit onboarding step/skip/completion funnel events (020)"
```

---

### Task 4: Replay emission in `App.tsx`

**Files:**
- Modify: `src/App.tsx:8,66`
- Create: `tests/App.replayTracking.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/App.replayTracking.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../src/analytics/track', () => ({
  track,
  initAnalytics: vi.fn(),
  trackPlayStartedOnce: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));
vi.mock('../src/analytics/useAnalyticsEvents', () => ({ useAnalyticsEvents: vi.fn() }));

// Pin the engine to a bankrupt run so App renders the BankruptcyScreen branch.
const { mockEngine } = vi.hoisted(() => ({ mockEngine: { current: null as unknown } }));
vi.mock('../src/engine/useGameEngine', () => ({
  useGameEngine: () => mockEngine.current,
}));

import App from '../src/App';
import { initialGameState } from '../src/engine/gameEngine';
import { loadOnboarding, markOnboardingComplete } from '../src/engine/onboarding';

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  mockEngine.current = {
    state: { ...initialGameState(), phase: 'bankrupt' },
    restart: vi.fn(),
    endOfRunRecap: null,
  };
});
afterEach(cleanup);

describe('replay tutorial tracking', () => {
  it('emits onboarding_replay_requested and still resets + restarts', () => {
    markOnboardingComplete(); // a finished tutorial is the precondition for replay
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /replay tutorial/i }));
    expect(track).toHaveBeenCalledWith('onboarding_replay_requested', {});
    // The existing behavior must be preserved: record reset + engine restart.
    expect(loadOnboarding().completed).toBe(false);
    expect((mockEngine.current as { restart: ReturnType<typeof vi.fn> }).restart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/App.replayTracking.test.tsx`
Expected: FAIL on the `track` assertion only — the reset/restart assertions already pass (existing behavior).

- [ ] **Step 3: Implement**

In `src/App.tsx`, extend the existing analytics import (line 8):

```ts
import { initAnalytics, track } from './analytics/track';
```

and change the handler on line 66 from:

```tsx
onReplayTutorial={() => { requestOnboardingReplay(); restart(); }}
```

to:

```tsx
onReplayTutorial={() => {
  track('onboarding_replay_requested', {});
  requestOnboardingReplay();
  restart();
}}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/App.replayTracking.test.tsx tests/App.analytics.test.tsx`
Expected: PASS (both files — `App.analytics.test.tsx` already mocks `track` in its module mock, so the new import resolves).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/App.replayTracking.test.tsx
git commit -m "feat(analytics): emit onboarding_replay_requested from run-end replay (020)"
```

---

### Task 5: Safeguard emission in `GameBoard.tsx`

**Files:**
- Modify: `src/components/GameBoard.tsx` (imports; `EmptyDayConfirm` render block at ~line 430)
- Create: `tests/components/GameBoard.safeguard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/GameBoard.safeguard.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({
  track,
  initAnalytics: vi.fn(),
  trackPlayStartedOnce: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));

import { GameBoard } from '../../src/components/GameBoard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete } from '../../src/engine/onboarding';
import type { GameState } from '../../src/engine/types';

function makeProps(state: GameState = initialGameState()) {
  return {
    state,
    lastDailyLog: null,
    onNextDay: vi.fn(),
    onPlantSeed: vi.fn().mockReturnValue(false),
    onBuySeed: vi.fn(),
    onBuyFertilizer: vi.fn(),
    onApplyFertilizer: vi.fn(),
    onClearPestDamage: vi.fn(),
    getFertilizerCount: () => 0,
    getSeedPrice: () => 5,
    onBuyPlot: vi.fn().mockReturnValue(false),
    getNextPlotPrice: () => null as number | null,
    recoveryDays: 3,
    buildingCards: [],
    onBuyBuilding: vi.fn().mockReturnValue(false),
    onRestart: vi.fn(),
  };
}

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
});
afterEach(cleanup);

/** Fresh state has no crops planted, so Next Day reads "Skip day" and opens the confirm. */
function openEmptyDayDialog() {
  fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]);
  return screen.getByRole('dialog', { name: /advance empty day/i });
}

describe('empty_day_safeguard tracking', () => {
  it('emits cancelled with full context when the player backs out', () => {
    markOnboardingComplete(); // tutorial not running
    const props = makeProps();
    render(<GameBoard {...props} />);
    const dialog = openEmptyDayDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(track).toHaveBeenCalledWith('empty_day_safeguard', {
      action: 'cancelled',
      onboarding_active: false,
      day: props.state.currentDay,
      coin_balance: props.state.coinBalance,
    });
    expect(props.onNextDay).not.toHaveBeenCalled();
  });

  it('emits advanced and still advances the day', () => {
    markOnboardingComplete();
    const props = makeProps();
    render(<GameBoard {...props} />);
    const dialog = openEmptyDayDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /^advance$/i }));
    expect(track).toHaveBeenCalledWith(
      'empty_day_safeguard',
      expect.objectContaining({ action: 'advanced' }),
    );
    expect(props.onNextDay).toHaveBeenCalledTimes(1);
  });

  it('flags onboarding_active while the tutorial is running', () => {
    // Fresh localStorage: onboarding auto-starts at welcome on a day-1 board.
    const props = makeProps();
    render(<GameBoard {...props} />);
    const dialog = openEmptyDayDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(track).toHaveBeenCalledWith(
      'empty_day_safeguard',
      expect.objectContaining({ action: 'cancelled', onboarding_active: true }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/GameBoard.safeguard.test.tsx`
Expected: FAIL — the `empty_day_safeguard` assertions fail (`track` is only receiving the hook's `onboarding_step_reached` calls, if any). `onNextDay` behavior assertions pass.

- [ ] **Step 3: Implement**

In `src/components/GameBoard.tsx`:

3a. Add the import (with the other `../` imports near the top of the file):

```ts
import { track } from '../analytics/track';
```

3b. Inside the `GameBoard` function body, add a helper directly after the `handleNextDay` function definition:

```ts
  /** 020 A1 — one emission per safeguard encounter, on resolution (spec: never on display). */
  function trackSafeguard(action: 'advanced' | 'cancelled') {
    track('empty_day_safeguard', {
      action,
      onboarding_active: onboarding.active,
      day: state.currentDay,
      coin_balance: state.coinBalance,
    });
  }
```

3c. Replace the `EmptyDayConfirm` render block (~line 430):

```tsx
      {showEmptyConfirm && (
        <EmptyDayConfirm
          onCancel={() => setShowEmptyConfirm(false)}
          onAdvance={() => {
            setShowEmptyConfirm(false);
            setHasConfirmedEmptyDay(true);
            doAdvance();
          }}
        />
      )}
```

with:

```tsx
      {showEmptyConfirm && (
        <EmptyDayConfirm
          onCancel={() => {
            trackSafeguard('cancelled');
            setShowEmptyConfirm(false);
          }}
          onAdvance={() => {
            trackSafeguard('advanced');
            setShowEmptyConfirm(false);
            setHasConfirmedEmptyDay(true);
            doAdvance();
          }}
        />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/GameBoard.safeguard.test.tsx tests/components/GameBoard.test.tsx`
Expected: PASS — both the new file and the pre-existing GameBoard suite (which now transitively hits the mocked-free real `track`; that's fine because `track` no-ops when analytics was never initialized).

- [ ] **Step 5: Commit**

```bash
git add src/components/GameBoard.tsx tests/components/GameBoard.safeguard.test.tsx
git commit -m "feat(analytics): emit empty_day_safeguard on confirm-dialog resolution (020)"
```

---

### Task 6: Full verification gate

- [ ] **Step 1: Run the project gate**

Run: `npm test && npm run lint`
Expected: all test files pass, eslint clean. This is the gate defined in CLAUDE.md — do not proceed to Phase C with any failure.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: `tsc -b` and `vite build` succeed (catches any type error the test runner's transpile-only mode missed — e.g. the `Record<string, never>` call sites).

- [ ] **Step 3: Commit (only if anything needed fixing)**

If steps 1–2 required fixes, commit them:

```bash
git add -A && git commit -m "fix(analytics): address 020 gate findings"
```

---

### Task 7: Phase C — provision the "Pixel Parsnips — Onboarding" dashboard (PostHog MCP)

Prerequisite: Tasks 1–6 merged/deployed enough that the new events exist in the PostHog project (play a tutorial pass locally with a `VITE_POSTHOG_KEY` set, or deploy first). PostHog insight/funnel queries can be created before events arrive, but validating tiles needs at least one seed pass — mirror 017 Phase C, which seeded by playing.

This task runs through the connected PostHog MCP (project 216788, eu.posthog.com), not repo code. **Follow the MCP's discovery protocol: `info insight-create`, `info dashboard-create`, and `schema insight-create query` (drill hinted fields) before the first `call` — do not paste the JSON below blind; it is the target shape, modeled on the live 017 insights, but the MCP schema is authoritative.**

- [ ] **Step 1: Seed the events**

Run one manual tutorial pass (fresh browser profile or cleared localStorage) against a build with the key set: complete the tutorial once, replay it, skip it once from any step, and trigger the empty-day dialog choosing Cancel once and Advance once. Verify arrival:

```
call read-data-schema {"query":{"kind":"events"}}
```

Expected: `onboarding_step_reached`, `onboarding_completed`, `onboarding_skipped`, `onboarding_replay_requested`, `empty_day_safeguard` all listed.

- [ ] **Step 2: Create the six insights**

Create each with `insight-create` (after schema drill-down). Target query sources — all `InsightVizNode` wrappers, `dateRange: {"date_from": "-30d"}`, `filterTestAccounts: false`, matching the 017 house style:

1. **"Onboarding funnel — welcome → completed"** (description: "Step funnel from onboarding_step_reached filtered by step, ending on onboarding_completed. Note: on desktop the shop sidebar is always visible, so open-shop auto-passes (~100%); real drop-offs start at buy-radishes.") — `FunnelsQuery`, `funnelWindowInterval: 14 day`, ordered, with series:
   - `EventsNode onboarding_step_reached` + property filter `step = welcome` (event property, exact)
   - same for `open-shop`, `buy-radishes`, `plant`, `advance`, `payoff`
   - `EventsNode onboarding_completed`
2. **"Skip points — onboarding_skipped by from_step"** — `TrendsQuery`, series `EventsNode onboarding_skipped` math `total`, display `ActionsBar`, breakdown by event property `from_step`.
3. **"Completion vs skip — weekly"** — `TrendsQuery`, interval `week`, two series: `onboarding_completed` (total) and `onboarding_skipped` (total), display `ActionsLineGraph`.
4. **"Replay requests"** — `TrendsQuery`, interval `week`, series `onboarding_replay_requested` (total), display `ActionsLineGraph`.
5. **"Safeguard triggers — behavior"** — `TrendsQuery`, interval `day`, series `empty_day_safeguard` (total), display `ActionsBar`, breakdown by event property `action`.
6. **"Safeguard triggers — context"** — `TrendsQuery`, interval `day`, series `empty_day_safeguard` (total), display `ActionsBar`, breakdown by event property `onboarding_active`.

- [ ] **Step 3: Create the dashboard and attach tiles**

`dashboard-create` with name `Pixel Parsnips — Onboarding`, description: `Onboarding tutorial analytics: step funnel, skip points, completion vs skip, replay requests, and the empty-day safeguard. Provisioned from spec 020-onboarding-analytics.` Attach the six insights in the order above (tile order 0–5).

- [ ] **Step 4: Validate the tiles render**

```
call dashboard-insights-run {"id": <new dashboard id>, ...}
```

(with force/blocking refresh per the tool's schema). Expected: every tile returns data consistent with the seed pass from Step 1 — funnel shows the seeded completion; skip points shows 1; safeguard shows 1 advanced + 1 cancelled. Record the dashboard URL.

- [ ] **Step 5: Close out the backlog**

In `backlog.md`, update the A1 row (currently `| A1 | **Onboarding funnel events** — ... | Medium | S | ... |`): prefix the title with `✅`, and replace the Notes cell with: `**DONE.** Shipped as [020-onboarding-analytics](specs/020-onboarding-analytics/spec.md): onboarding_step_reached / onboarding_completed / onboarding_skipped / onboarding_replay_requested + empty_day_safeguard (all players), emitted from the 014 step machine seams; "Pixel Parsnips — Onboarding" dashboard (id <fill in>) provisioned via MCP.` Also update the trailing italic changelog line at the bottom of `backlog.md` by appending `, then <date> after shipping 020-onboarding-analytics (A1 onboarding funnel + safeguard events + Onboarding dashboard)` before the final period.

- [ ] **Step 6: Commit and finish the branch**

```bash
git add backlog.md
git commit -m "docs(backlog): mark A1 onboarding funnel analytics shipped (020)"
```

Then use the superpowers:finishing-a-development-branch skill to merge/PR `020-onboarding-analytics`. PR description follows the user's global Conventional-Commits + Changed/Fixed/Why format (see `~/.claude/CLAUDE.md`).

---

## Self-Review Notes (already applied)

- **Spec coverage:** step funnel (Task 3), skip point (Task 3), completion (Task 3), replay (Task 4), safeguard all-players with resolution semantics (Task 5), schema (Task 1), dashboard 6 tiles (Task 7), backlog closeout (Task 7 Step 5). `done` never emitted — asserted in Task 3's test.
- **Type consistency:** `OnboardingFunnelStep` defined in Task 1, consumed in Task 3; `ONBOARDING_STEPS` exported in Task 2, consumed in Task 3; `trackSafeguard` defined and used only within Task 5; empty-prop events typed `Record<string, never>` and called with `{}` in Tasks 3–4.
- **Known accepted behaviors** (spec §Edge Cases): welcome may re-emit if the player never advances past it before closing (no record is persisted at `welcome`); localStorage-disabled browsers re-emit per session; replay re-emits the funnel deliberately.
