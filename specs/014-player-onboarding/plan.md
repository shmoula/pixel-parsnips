# Player Onboarding ("Your First Harvest") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a skippable, replayable first-run guided overlay that walks a new player through one complete plant→advance→harvest loop (filling all plots with radishes for a guaranteed profit), plus an always-on safeguard that warns before advancing an empty day.

**Architecture:** Onboarding completion lives in its own localStorage key (`pixel-parsnips-onboarding`) via a pure `onboarding.ts` module mirroring `records.ts` — **never** in `GameState` (which resets on Restart). A `useOnboarding` hook owns a goal-driven step machine that advances by observing live `GameState` + shop visibility; it drives a presentational `OnboardingOverlay` that spotlights real UI elements located by `data-onboarding` attributes. The turn-1 weather pin reuses the existing `processTurn(state, weatherRoll?)` override threaded through the hook's `nextDay`. The empty-day safeguard is a pure `canAdvanceProductively(state)` selector surfaced as a Next-Day label change + a one-time soft confirm in `GameBoard`.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind 3.4, Vite 5.4, Vitest + Testing Library. Commands: `npm test`, `npm run lint`.

**Spec:** [specs/014-player-onboarding/spec.md](spec.md)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/engine/onboarding.ts` | Create | `OnboardingStep` type, `OnboardingRecord`, load/save, `markOnboardingComplete`, `requestOnboardingReplay`. Own localStorage key; defensive parse. |
| `src/engine/gameEngine.ts` | Modify | Add pure `canAdvanceProductively(state)` selector. |
| `src/engine/useGameEngine.ts` | Modify | `nextDay` accepts optional `weatherOverride?: WeatherId`; thread into `processTurn`; update `GameEngineHook` type. |
| `src/hooks/useMediaQuery.ts` | Create | Generic `useMediaQuery(query)` (mirrors `useReducedMotion`). Used for the desktop breakpoint. |
| `src/hooks/useOnboarding.ts` | Create | Goal-driven step machine: auto-start gate, forward-only advancement, skip, replay-aware, `shouldPinWeather`. |
| `src/components/OnboardingOverlay.tsx` | Create | Presentational spotlight + copy bubbles + Skip chip. Anchors via `data-onboarding`. Respects reduced motion. |
| `src/components/HUD.tsx` | Modify | `canAdvanceProductively` prop → Next-Day label/aria; `data-onboarding` attrs on shop button, next-day button, balance chip. |
| `src/components/GameBoard.tsx` | Modify | Mount `useOnboarding` + overlay; compute `isShopVisible`; pin weather on advance; empty-day soft-confirm; remove redundant Day-1 banner; pass anchors/dimming to children. |
| `src/components/Shop.tsx` | Modify | Accept + forward `dimNonRadish` to seed cards. |
| `src/components/SeedCard.tsx` | Modify | `data-onboarding="shop-radish"` on the radish card; optional `dimmed` styling. |
| `src/components/FarmGrid.tsx` | Modify | `data-onboarding="farm-grid"` on the grid container. |
| `src/components/BankruptcyScreen.tsx` | Modify | `onReplayTutorial` prop + "Replay tutorial" button beside Restart. |
| `src/App.tsx` | Modify | Wire `onReplayTutorial` (requestReplay + restart). |
| `backlog.md` | Modify | Mark onboarding feature shipped; confirm A1 analytics note. |

Test files created/modified: `tests/engine/onboarding.test.ts` (new), `tests/engine/gameEngine.canAdvance.test.ts` (new), `tests/hooks/useMediaQuery.test.ts` (new), `tests/hooks/useOnboarding.test.tsx` (new), `tests/components/OnboardingOverlay.test.tsx` (new), `tests/components/HUD.test.tsx` (new or modify), `tests/components/BankruptcyScreen.test.tsx` (new or modify), and possibly `tests/components/GameBoard.test.tsx` (modify — Day-1 banner removal).

> **Test-infra note:** This repo already uses Vitest + `@testing-library/react`. For `localStorage` and `matchMedia`, mirror the setup the existing `useReducedMotion` / `records` tests use (jsdom provides `localStorage`; `matchMedia` is mocked in those tests). Reuse the established helpers rather than inventing new ones.

---

## Task 1: Onboarding persistence module

**Files:**
- Create: `src/engine/onboarding.ts`
- Test: `tests/engine/onboarding.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/onboarding.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  ONBOARDING_KEY,
  loadOnboarding,
  saveOnboarding,
  markOnboardingComplete,
  requestOnboardingReplay,
  type OnboardingRecord,
} from '../../src/engine/onboarding';

beforeEach(() => localStorage.clear());

describe('loadOnboarding', () => {
  it('defaults to not-completed at the welcome step when absent', () => {
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: false, step: 'welcome' });
  });

  it('returns defaults (never throws) on malformed JSON', () => {
    localStorage.setItem(ONBOARDING_KEY, '{not json');
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: false, step: 'welcome' });
  });

  it('round-trips a saved record', () => {
    const rec: OnboardingRecord = { schemaVersion: 1, completed: false, step: 'plant' };
    saveOnboarding(rec);
    expect(loadOnboarding()).toEqual(rec);
  });

  it('coerces a bad step back to welcome', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ schemaVersion: 1, completed: false, step: 'bogus' }));
    expect(loadOnboarding().step).toBe('welcome');
  });
});

describe('markOnboardingComplete', () => {
  it('sets completed and step=done', () => {
    markOnboardingComplete();
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: true, step: 'done' });
  });
});

describe('requestOnboardingReplay', () => {
  it('resets to a fresh, not-completed welcome record', () => {
    markOnboardingComplete();
    requestOnboardingReplay();
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: false, step: 'welcome' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- engine/onboarding`
Expected: FAIL — `Cannot find module '../../src/engine/onboarding'`.

- [ ] **Step 3: Implement `onboarding.ts`**

Create `src/engine/onboarding.ts`:

```ts
export const ONBOARDING_KEY = 'pixel-parsnips-onboarding';

/** Ordered steps of the first-run guided flow. */
export type OnboardingStep =
  | 'welcome'
  | 'open-shop'
  | 'buy-radishes'
  | 'plant'
  | 'advance'
  | 'payoff'
  | 'done';

const STEPS: readonly OnboardingStep[] = [
  'welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff', 'done',
];

export interface OnboardingRecord {
  schemaVersion: 1;
  /** True once the player finishes or skips the tutorial; survives Restart. */
  completed: boolean;
  /** Furthest step reached, for resume-on-refresh. */
  step: OnboardingStep;
}

const DEFAULT_RECORD: OnboardingRecord = { schemaVersion: 1, completed: false, step: 'welcome' };

function isStep(v: unknown): v is OnboardingStep {
  return typeof v === 'string' && (STEPS as readonly string[]).includes(v);
}

/** Returns defaults when missing or malformed; never throws. */
export function loadOnboarding(): OnboardingRecord {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { ...DEFAULT_RECORD };
    const parsed = JSON.parse(raw) as Partial<OnboardingRecord>;
    return {
      schemaVersion: 1,
      completed: parsed.completed === true,
      step: isStep(parsed.step) ? parsed.step : 'welcome',
    };
  } catch {
    return { ...DEFAULT_RECORD };
  }
}

export function saveOnboarding(rec: OnboardingRecord): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(rec));
  } catch {
    // Storage full or disabled — non-fatal; onboarding simply won't persist.
  }
}

/** Mark the tutorial finished (or skipped). Idempotent. */
export function markOnboardingComplete(): void {
  saveOnboarding({ schemaVersion: 1, completed: true, step: 'done' });
}

/** Reset so the guided flow runs again on the next fresh game. */
export function requestOnboardingReplay(): void {
  saveOnboarding({ ...DEFAULT_RECORD });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- engine/onboarding`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/onboarding.ts tests/engine/onboarding.test.ts
git commit -m "feat(014): onboarding persistence module + step type"
```

---

## Task 2: `canAdvanceProductively` safeguard selector

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.canAdvance.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/gameEngine.canAdvance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialGameState, canAdvanceProductively } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

/** Fresh state: 4 empty plots, no seeds in inventory. */
function freshEmpty(): GameState {
  const s = initialGameState();
  return { ...s, seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 } };
}

describe('canAdvanceProductively', () => {
  it('is false on a fresh empty farm with no seeds', () => {
    expect(canAdvanceProductively(freshEmpty())).toBe(false);
  });

  it('is true when a seed is held in inventory', () => {
    const s = freshEmpty();
    expect(canAdvanceProductively({ ...s, seedInventory: { ...s.seedInventory, radish: 1 } })).toBe(true);
  });

  it('is true when a crop is growing on a plot', () => {
    const s = freshEmpty();
    const plots = s.plots.map((p, i) =>
      i === 0 ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
    );
    expect(canAdvanceProductively({ ...s, plots })).toBe(true);
  });
});
```

> Confirm the `seedInventory` keys against `types.ts` `SeedInventory` (radish/parsnip/pumpkin). If a key differs, match the real shape.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- gameEngine.canAdvance`
Expected: FAIL — `canAdvanceProductively` is not exported.

- [ ] **Step 3: Implement the selector**

In `src/engine/gameEngine.ts`, add near the other exported helpers (e.g. after `getNextPlotPrice`):

```ts
/**
 * True when advancing a day can produce value: a seed is held in inventory OR
 * a crop is growing on a plot. False means advancing only burns lease + tax
 * (the empty-day bankruptcy trap) and the UI should warn first.
 */
export function canAdvanceProductively(state: GameState): boolean {
  const hasSeed = (Object.values(state.seedInventory) as number[]).some(n => n > 0);
  const hasGrowingCrop = state.plots.some(p => p.cropId !== null);
  return hasSeed || hasGrowingCrop;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- gameEngine.canAdvance`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.canAdvance.test.ts
git commit -m "feat(014): canAdvanceProductively safeguard selector"
```

---

## Task 3: `nextDay` weather-override parameter

**Files:**
- Modify: `src/engine/useGameEngine.ts`
- Test: covered indirectly; add a focused hook test only if the file already tests `nextDay`. Otherwise this is a typed signature change verified by the suite + typecheck.

- [ ] **Step 1: Widen `nextDay` to accept an optional weather override**

In `useGameEngine.ts`, the current callback (around line 280) is:

```ts
  const nextDay = useCallback(() => {
    setState(prev => {
      return processTurn(prev).state;
    });
  }, []);
```

Replace with:

```ts
  const nextDay = useCallback((weatherOverride?: WeatherId) => {
    setState(prev => {
      return processTurn(prev, weatherOverride).state;
    });
  }, []);
```

Ensure `WeatherId` is imported in this file (it imports from `./types` already — add `WeatherId` to that import list if absent).

- [ ] **Step 2: Update the hook's public type**

In the `GameEngineHook` interface (line ~213), change:

```ts
  nextDay: () => void;
```
to
```ts
  nextDay: (weatherOverride?: WeatherId) => void;
```

- [ ] **Step 3: Verify the suite + typecheck**

Run: `npm test -- engine/useGameEngine`
Expected: PASS (existing tests unaffected — the parameter is optional and defaults to undefined, preserving today's random-weather behavior).
Run: `npm run lint`
Expected: clean.

> `App.tsx` passes `onNextDay={engine.nextDay}` — still type-compatible since the new param is optional. No change needed there.

- [ ] **Step 4: Commit**

```bash
git add src/engine/useGameEngine.ts
git commit -m "feat(014): nextDay accepts optional weather override (for onboarding turn-1 pin)"
```

---

## Task 4: `useMediaQuery` hook (desktop breakpoint)

**Files:**
- Create: `src/hooks/useMediaQuery.ts`
- Test: `tests/hooks/useMediaQuery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/useMediaQuery.test.ts` (mirror the matchMedia mock used by the existing `useReducedMotion` test — copy that test's `matchMedia` setup if present):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery } from '../../src/hooks/useMediaQuery';

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

beforeEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('returns true when the query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when the query does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- hooks/useMediaQuery`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useMediaQuery.ts`**

Create `src/hooks/useMediaQuery.ts` (same shape as `useReducedMotion.ts`):

```ts
import { useEffect, useState } from 'react';

/**
 * Returns true when `query` currently matches. Reads on mount and updates on change.
 * SSR/no-matchMedia safe (returns false).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- hooks/useMediaQuery`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useMediaQuery.ts tests/hooks/useMediaQuery.test.ts
git commit -m "feat(014): useMediaQuery hook"
```

---

## Task 5: `useOnboarding` step-machine hook

**Files:**
- Create: `src/hooks/useOnboarding.ts`
- Test: `tests/hooks/useOnboarding.test.tsx`

The hook owns the step machine. It is **goal-driven**: auto steps advance when live `GameState` (+ shop visibility) satisfies their goal; manual steps (`welcome`, `payoff`) advance via callbacks. It never moves backward. Auto-start is gated so existing players are never pulled into a tutorial.

- [ ] **Step 1: Write the failing tests**

Create `tests/hooks/useOnboarding.test.tsx`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnboarding } from '../../src/hooks/useOnboarding';
import { initialGameState } from '../../src/engine/gameEngine';
import { loadOnboarding, markOnboardingComplete } from '../../src/engine/onboarding';
import type { GameState } from '../../src/engine/types';

beforeEach(() => localStorage.clear());

/** Fresh day-1 state with no seeds and 4 empty plots. */
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

describe('useOnboarding — auto-start gating', () => {
  it('is active at welcome for a fresh first run', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(result.current.active).toBe(true);
    expect(result.current.step).toBe('welcome');
  });

  it('is inactive when already completed', () => {
    markOnboardingComplete();
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    expect(result.current.active).toBe(false);
  });

  it('does not start (and marks complete) for an in-progress run past day 1', () => {
    const { result } = renderHook(() =>
      useOnboarding({ ...day1(), currentDay: 7 }, { isShopVisible: false }),
    );
    expect(result.current.active).toBe(false);
    expect(loadOnboarding().completed).toBe(true);
  });
});

describe('useOnboarding — advancement', () => {
  it('welcome -> open-shop on the start CTA', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onStart());
    expect(result.current.step).toBe('open-shop');
  });

  it('open-shop -> buy-radishes once the shop is visible', () => {
    const state = day1();
    const { result, rerender } = renderHook(
      ({ vis }) => useOnboarding(state, { isShopVisible: vis }),
      { initialProps: { vis: false } },
    );
    act(() => result.current.onStart());
    expect(result.current.step).toBe('open-shop');
    rerender({ vis: true });
    expect(result.current.step).toBe('buy-radishes');
  });

  it('cascades buy -> plant -> advance -> payoff as goals are met', () => {
    let state = day1();
    const { result, rerender } = renderHook(
      ({ s }) => useOnboarding(s, { isShopVisible: true }),
      { initialProps: { s: state } },
    );
    act(() => result.current.onStart()); // welcome -> open-shop -> (visible) buy-radishes
    expect(result.current.step).toBe('buy-radishes');

    // Buy 4 radishes (one per empty plot)
    state = { ...state, seedInventory: { ...state.seedInventory, radish: 4 } };
    rerender({ s: state });
    expect(result.current.step).toBe('plant');

    // Plant all plots
    state = plantAll({ ...state, seedInventory: { ...state.seedInventory, radish: 0 } });
    rerender({ s: state });
    expect(result.current.step).toBe('advance');

    // Process a turn (lastDailyLog becomes non-null)
    state = { ...state, currentDay: 2, lastDailyLog: { totalHarvestIncome: 48 } as GameState['lastDailyLog'] };
    rerender({ s: state });
    expect(result.current.step).toBe('payoff');

    // Dismiss payoff
    act(() => result.current.onDismissPayoff());
    expect(result.current.step).toBe('done');
    expect(result.current.active).toBe(false);
    expect(loadOnboarding().completed).toBe(true);
  });

  it('shouldPinWeather is true only on the advance step', () => {
    let state = plantAll(day1());
    localStorage.setItem(
      'pixel-parsnips-onboarding',
      JSON.stringify({ schemaVersion: 1, completed: false, step: 'advance' }),
    );
    const { result } = renderHook(() => useOnboarding(state, { isShopVisible: true }));
    expect(result.current.step).toBe('advance');
    expect(result.current.shouldPinWeather).toBe(true);
  });
});

describe('useOnboarding — skip', () => {
  it('skip marks complete and deactivates', () => {
    const { result } = renderHook(() => useOnboarding(day1(), { isShopVisible: false }));
    act(() => result.current.onSkip());
    expect(result.current.active).toBe(false);
    expect(loadOnboarding().completed).toBe(true);
  });
});
```

> The `lastDailyLog` cast in the test is a minimal stand-in; only `totalHarvestIncome` is read by the UI. Match the real `DailyLogEntry` field name for harvest income in `types.ts` — adjust if it is not `totalHarvestIncome`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- hooks/useOnboarding`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useOnboarding.ts`**

Create `src/hooks/useOnboarding.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types';
import {
  loadOnboarding,
  saveOnboarding,
  markOnboardingComplete,
  type OnboardingStep,
} from '../engine/onboarding';

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
function emptyPlotCount(state: GameState): number {
  return state.plots
    .slice(0, state.unlockedPlots)
    .filter(p => p.cropId === null && !p.pestDamaged && p.exhaustedSinceDay === null).length;
}

/**
 * Forward-only goal evaluation: given the current step and live state, return the
 * furthest AUTO step now justified. Manual gates (welcome, payoff) are returned as-is.
 */
function deriveStep(step: OnboardingStep, state: GameState, isShopVisible: boolean): OnboardingStep {
  let s = step;
  // Cascade: each satisfied goal moves to the next step; manual steps stop the cascade.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (s === 'open-shop' && isShopVisible) { s = 'buy-radishes'; continue; }
    if (s === 'buy-radishes') {
      const needed = Math.max(1, emptyPlotCount(state));
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
    setActive(!rec.completed && state.currentDay <= 1);
    setStep(rec.completed ? 'done' : rec.step);
  }

  // Goal-driven forward advancement for auto steps.
  useEffect(() => {
    if (!active) return;
    const next = deriveStep(step, state, isShopVisible);
    if (next !== step) {
      setStep(next);
      saveOnboarding({ schemaVersion: 1, completed: false, step: next });
    }
  }, [active, step, state, isShopVisible]);

  const onStart = useCallback(() => {
    setStep('open-shop');
    saveOnboarding({ schemaVersion: 1, completed: false, step: 'open-shop' });
  }, []);

  const finish = useCallback(() => {
    markOnboardingComplete();
    setStep('done');
    setActive(false);
  }, []);

  const onSkip = useCallback(finish, [finish]);
  const onDismissPayoff = useCallback(finish, [finish]);

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

> Verify `PlotState` field names (`pestDamaged`, `exhaustedSinceDay`, `cropId`) and `SeedInventory.radish` against `types.ts`; they come from this codebase's existing fields used in `GameBoard.tsx:136`. Adjust if a name differs.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- hooks/useOnboarding`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOnboarding.ts tests/hooks/useOnboarding.test.tsx
git commit -m "feat(014): useOnboarding goal-driven step machine"
```

---

## Task 6: `OnboardingOverlay` component

**Files:**
- Create: `src/components/OnboardingOverlay.tsx`
- Test: `tests/components/OnboardingOverlay.test.tsx`

Presentational only. Two centered-card steps (`welcome`, `payoff`); four anchored-bubble steps (`open-shop`, `buy-radishes`, `plant`, `advance`) that locate a `data-onboarding` element and draw a highlight + copy bubble. Always shows a Skip chip. Respects reduced motion (no pulse).

- [ ] **Step 1: Write the failing tests**

Create `tests/components/OnboardingOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingOverlay } from '../../src/components/OnboardingOverlay';

const noop = () => {};

describe('OnboardingOverlay', () => {
  it('shows the welcome copy and a start CTA', () => {
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByText(/fill your farm with radishes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plant/i })).toBeInTheDocument();
  });

  it('fires onStart from the welcome CTA', () => {
    const onStart = vi.fn();
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0}
        onStart={onStart} onSkip={noop} onDismissPayoff={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /plant/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('always shows a Skip control', () => {
    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('shows the harvest income and a dismiss CTA on payoff', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingOverlay step="payoff" harvestIncome={48}
        onStart={noop} onSkip={noop} onDismissPayoff={onDismiss} />,
    );
    expect(screen.getByText(/\+48/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it|continue|hit your/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders the step copy for an anchored step even when the anchor is absent', () => {
    render(
      <OnboardingOverlay step="plant" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByText(/fill every plot/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- OnboardingOverlay`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `OnboardingOverlay.tsx`**

Create `src/components/OnboardingOverlay.tsx`:

```tsx
import { useLayoutEffect, useState } from 'react';
import type { OnboardingStep } from '../engine/onboarding';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  step: OnboardingStep;
  harvestIncome: number;
  onStart: () => void;
  onSkip: () => void;
  onDismissPayoff: () => void;
}

/** Anchor selector + short copy for each anchored step. */
const ANCHORS: Partial<Record<OnboardingStep, { selector: string; copy: string }>> = {
  'open-shop':    { selector: '[data-onboarding="shop-button"]', copy: 'Pop open the shop.' },
  'buy-radishes': { selector: '[data-onboarding="shop-radish"]', copy: 'Radishes sprout overnight — grab one per plot.' },
  'plant':        { selector: '[data-onboarding="farm-grid"]',   copy: 'Fill every plot — more crops, more coins.' },
  'advance':      { selector: '[data-onboarding="next-day"]',    copy: 'Sleep on it — advance a day.' },
};

function useAnchorRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);
  return rect;
}

function SkipChip({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label="Skip tutorial"
      className="fixed top-3 right-3 z-[60] font-pixel text-[10px] px-3 py-1.5 rounded
                 bg-farm-ink/90 text-farm-parchment border border-farm-stone/40
                 hover:bg-farm-ink"
    >
      Skip ✕
    </button>
  );
}

export function OnboardingOverlay({ step, harvestIncome, onStart, onSkip, onDismissPayoff }: Props) {
  const reduced = useReducedMotion();
  const anchor = ANCHORS[step] ?? null;
  const rect = useAnchorRect(anchor ? anchor.selector : null);

  if (step === 'done') return null;

  const ringPulse = reduced ? '' : 'animate-pulse';

  return (
    <div role="dialog" aria-label="Tutorial" className="fixed inset-0 z-50 pointer-events-none">
      {/* gentle dim — does not block clicks (soft focus) */}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <SkipChip onSkip={onSkip} />

      {/* Centered card: welcome */}
      {step === 'welcome' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-xs w-full bg-farm-soil border border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4 text-center">
            <p className="font-pixel text-xs text-farm-parchment leading-relaxed">
              Grow crops. Sell 'em. Don't go broke. Let's fill your farm with radishes!
            </p>
            <button
              type="button"
              onClick={onStart}
              className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
            >
              🌱 Plant my farm
            </button>
          </div>
        </div>
      )}

      {/* Centered card: payoff */}
      {step === 'payoff' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-xs w-full bg-farm-soil border border-farm-gold/50 rounded-xl p-5 flex flex-col gap-4 text-center">
            <p className="font-pixel text-sm text-farm-gold">Sold for +{harvestIncome} coins! 🎉</p>
            <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">
              That's the loop. Now hit your season target.
            </p>
            <button
              type="button"
              onClick={onDismissPayoff}
              className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
            >
              Got it →
            </button>
          </div>
        </div>
      )}

      {/* Anchored bubble: open-shop / buy-radishes / plant / advance */}
      {anchor && (
        <>
          {rect && (
            <div
              aria-hidden="true"
              className={`absolute rounded-lg ring-2 ring-farm-gold ${ringPulse}`}
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
              }}
            />
          )}
          <div
            className="pointer-events-auto absolute max-w-[220px] bg-farm-soil border border-farm-gold/50 rounded-lg px-3 py-2"
            style={
              rect
                ? { left: Math.max(8, rect.left), top: rect.bottom + 10 }
                : { left: '50%', bottom: 24, transform: 'translateX(-50%)' }
            }
          >
            <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">{anchor.copy}</p>
          </div>
        </>
      )}
    </div>
  );
}
```

> Color tokens (`farm-soil`, `farm-gold`, `farm-grass`, `farm-parchment`, `farm-stone`, `farm-ink`) are existing Tailwind theme colors used across the components read for this plan. If a token name differs, match the project's `tailwind.config.ts`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- OnboardingOverlay`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingOverlay.tsx tests/components/OnboardingOverlay.test.tsx
git commit -m "feat(014): OnboardingOverlay spotlight component"
```

---

## Task 7: HUD safeguard label + onboarding anchors

**Files:**
- Modify: `src/components/HUD.tsx`
- Test: `tests/components/HUD.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `tests/components/HUD.test.tsx` (create if absent; build props mirroring `HUDProps` in `HUD.tsx`):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HUD } from '../../src/components/HUD';

function renderHUD(over: Partial<React.ComponentProps<typeof HUD>> = {}) {
  render(
    <HUD
      currentDay={1}
      coinBalance={130}
      onToggleShop={vi.fn()}
      onNextDay={vi.fn()}
      onLastTurn={vi.fn()}
      isProcessing={false}
      hasLastTurn={false}
      endlessMode={false}
      harvestStreak={0}
      canAdvanceProductively={true}
      {...over}
    />,
  );
}

describe('HUD — empty-day safeguard label', () => {
  it('shows the normal Next Day label when advancing is productive', () => {
    renderHUD({ canAdvanceProductively: true });
    expect(screen.getByRole('button', { name: /advance to next day/i })).toHaveTextContent(/next day/i);
  });

  it('warns to plant first when advancing is unproductive', () => {
    renderHUD({ canAdvanceProductively: false });
    expect(screen.getByText(/plant seeds first/i)).toBeInTheDocument();
  });

  it('marks the shop, next-day, and balance anchors', () => {
    const { container } = render(
      <HUD currentDay={1} coinBalance={130} onToggleShop={vi.fn()} onNextDay={vi.fn()}
        onLastTurn={vi.fn()} isProcessing={false} hasLastTurn={false} endlessMode={false}
        harvestStreak={0} canAdvanceProductively={true} />,
    );
    expect(container.querySelector('[data-onboarding="shop-button"]')).toBeTruthy();
    expect(container.querySelector('[data-onboarding="next-day"]')).toBeTruthy();
    expect(container.querySelector('[data-onboarding="balance-chip"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- components/HUD`
Expected: FAIL — `canAdvanceProductively` prop unknown / label + anchors absent.

- [ ] **Step 3: Add the prop, label logic, and anchors**

In `HUD.tsx`:

Add to `HUDProps` (after `harvestStreak: number;`):

```ts
  /** False when advancing only burns lease+tax (no seeds, nothing growing). Drives the warning label. */
  canAdvanceProductively: boolean;
```

Add `canAdvanceProductively` to the destructured params.

On the balance chip wrapper (`<div className={`flex items-center gap-1.5 bg-[#261808] ...`}>`, line ~100) add `data-onboarding="balance-chip"`.

Replace the Next Day button (lines ~168-181) with the label-aware version:

```tsx
        <button
          type="button"
          data-onboarding="next-day"
          aria-label={canAdvanceProductively ? 'Advance to next day' : 'Advance to next day — nothing planted'}
          onClick={onNextDay}
          disabled={isProcessing}
          className="
            font-pixel text-[10px] px-4 py-1.5 rounded uppercase tracking-widest
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:enabled:scale-95 disabled:opacity-50 transition-all
          "
        >
          {canAdvanceProductively ? 'Next Day →' : 'Plant seeds first →'}
        </button>
```

On the mobile Shop toggle button (line ~185) add `data-onboarding="shop-button"`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- components/HUD`
Expected: PASS. (If pre-existing HUD tests instantiate `<HUD>` without the new required prop, add `canAdvanceProductively={true}` to those render calls.)

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(014): HUD safeguard label + onboarding anchors"
```

---

## Task 8: GameBoard wiring (overlay, weather pin, safeguard confirm, anchors, dimming)

**Files:**
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/components/Shop.tsx`
- Modify: `src/components/SeedCard.tsx`
- Modify: `src/components/FarmGrid.tsx`
- Test: `tests/components/GameBoard.test.tsx` (modify — banner removal; integration is light)

This task has no new pure logic to TDD; it is integration wiring. Verify via the existing suite + `npm run lint` + a build. Keep edits minimal and behavior-preserving except where specified.

- [ ] **Step 1: Add child anchors + dimming props**

In `SeedCard.tsx`: add an optional `dimmed?: boolean` prop; add `data-onboarding={cropId === 'radish' ? 'shop-radish' : undefined}` to the card root; when `dimmed`, add `opacity-40` to the root className (presentational only — do **not** disable the buy button).

In `Shop.tsx`: add `dimNonRadish?: boolean` to `ShopProps`; in the seed-card map, pass `dimmed={dimNonRadish === true && cropId !== 'radish'}` to each `SeedCard`.

In `FarmGrid.tsx`: add `data-onboarding="farm-grid"` to the grid container element (the element with `grid-cols-4 md:grid-cols-6`, ~line 79).

- [ ] **Step 2: Wire onboarding into GameBoard**

In `GameBoard.tsx`:

Add imports:

```ts
import type { WeatherId } from '../engine/types';
import { canAdvanceProductively } from '../engine/gameEngine';
import { useOnboarding } from '../hooks/useOnboarding';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { OnboardingOverlay } from './OnboardingOverlay';
```

Change the `onNextDay` prop type in `GameBoardProps`:

```ts
  onNextDay: (weatherOverride?: WeatherId) => void;
```

Inside the component, after the existing `useState` hooks add:

```ts
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isShopVisible = isDesktop || isShopOpen;
  const onboarding = useOnboarding(state, { isShopVisible });
  const canAdvance = canAdvanceProductively(state);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);
```

Replace `handleNextDay` with safeguard + weather-pin logic:

```ts
  function doAdvance() {
    if (isProcessing) return;
    setIsProcessing(true);
    awaitingModalRef.current = true;
    onNextDay(onboarding.shouldPinWeather ? 'sunny' : undefined);
  }

  function handleNextDay() {
    if (isProcessing) return;
    if (!canAdvance) { setShowEmptyConfirm(true); return; }
    doAdvance();
  }
```

- [ ] **Step 3: Remove the redundant Day-1 banner**

Delete the existing Day-1 hint block in `GameBoard.tsx` (lines ~136-140, the `🛒 Visit the Shop...` paragraph). The guided overlay teaches first-run players, and the HUD "Plant seeds first →" label is the persistent replacement.

- [ ] **Step 4: Pass the new props + render the overlay + confirm**

Pass `canAdvanceProductively={canAdvance}` to `<HUD>`.

Pass `dimNonRadish={onboarding.active && onboarding.step === 'buy-radishes'}` to `<Shop>`.

Before the closing `</div>` of the root container, add the overlay and the soft-confirm:

```tsx
      {onboarding.active && (
        <OnboardingOverlay
          step={onboarding.step}
          harvestIncome={state.lastDailyLog?.totalHarvestIncome ?? 0}
          onStart={onboarding.onStart}
          onSkip={onboarding.onSkip}
          onDismissPayoff={onboarding.onDismissPayoff}
        />
      )}

      {showEmptyConfirm && (
        <div role="dialog" aria-label="Advance empty day" className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-6">
          <div className="max-w-xs w-full bg-farm-soil border border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4 text-center">
            <p className="font-pixel text-xs text-farm-parchment leading-relaxed">
              Nothing's planted — advance anyway?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                autoFocus
                onClick={() => setShowEmptyConfirm(false)}
                className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowEmptyConfirm(false); doAdvance(); }}
                className="font-pixel text-xs px-4 py-2 rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-farm-soil"
              >
                Advance
              </button>
            </div>
          </div>
        </div>
      )}
```

> Confirm the harvest-income field name (`totalHarvestIncome`) against `DailyLogEntry` in `types.ts`; adjust if it differs.

- [ ] **Step 5: Update GameBoard tests**

If `tests/components/GameBoard.test.tsx` asserts the `🛒 Visit the Shop...` banner, remove/replace that assertion (the banner is gone). If it instantiates `<GameBoard>` with `onNextDay`, the optional-param signature is compatible. For tests that don't want the overlay, render with a completed onboarding record: `localStorage.setItem('pixel-parsnips-onboarding', JSON.stringify({ schemaVersion: 1, completed: true, step: 'done' }))` in a `beforeEach`.

- [ ] **Step 6: Verify**

Run: `npm test -- components/GameBoard components/SeedCard components/Shop components/FarmGrid`
Expected: PASS (adjust any banner assertion per Step 5).
Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/GameBoard.tsx src/components/Shop.tsx src/components/SeedCard.tsx src/components/FarmGrid.tsx tests/components/GameBoard.test.tsx
git commit -m "feat(014): wire onboarding overlay, weather pin, empty-day safeguard"
```

---

## Task 9: Replay button, App wiring, docs, full verification

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `backlog.md`
- Test: `tests/components/BankruptcyScreen.test.tsx`

- [ ] **Step 1: Write the failing BankruptcyScreen test**

Add to `tests/components/BankruptcyScreen.test.tsx` (create if absent; reuse the props shape from `BankruptcyScreenProps`):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';

function renderScreen(over: Partial<React.ComponentProps<typeof BankruptcyScreen>> = {}) {
  render(
    <BankruptcyScreen
      daysPlayed={3} peakBalance={100} peakHarvestStreak={0} disastersSurvived={0}
      seasonReached={1} medal="none"
      records={{ schemaVersion: 2, bestDaysSurvived: 0, bestPeakBalance: 0, bestSeasonReached: 0, mostDisastersSurvived: 0, bestHarvestStreak: 0, totalRunsCompleted: 1 }}
      newBests={new Set()} lastDailyLog={null}
      onRestart={vi.fn()} onReplayTutorial={vi.fn()}
      {...over}
    />,
  );
}

describe('BankruptcyScreen — replay tutorial', () => {
  it('renders a Replay tutorial button', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: /replay tutorial/i })).toBeInTheDocument();
  });

  it('fires onReplayTutorial when clicked', () => {
    const onReplayTutorial = vi.fn();
    renderScreen({ onReplayTutorial });
    fireEvent.click(screen.getByRole('button', { name: /replay tutorial/i }));
    expect(onReplayTutorial).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- components/BankruptcyScreen`
Expected: FAIL — `onReplayTutorial` prop / button absent.

- [ ] **Step 3: Add the prop + button**

In `BankruptcyScreen.tsx`, add to `BankruptcyScreenProps`:

```ts
  onReplayTutorial: () => void;
```

Add `onReplayTutorial` to the destructured params. Replace the single Restart button with a button row:

```tsx
      <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
        <button
          type="button"
          aria-label="Restart game"
          onClick={onRestart}
          className="
            px-8 py-3 rounded-lg font-pixel text-sm
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            transition-colors
          "
        >
          Restart
        </button>
        <button
          type="button"
          aria-label="Replay tutorial"
          onClick={onReplayTutorial}
          className="
            px-8 py-2 rounded-lg font-pixel text-[10px]
            bg-farm-ink text-farm-parchment border border-farm-stone/40
            hover:bg-farm-soil transition-colors
          "
        >
          Replay tutorial
        </button>
      </div>
```

- [ ] **Step 4: Wire App**

In `App.tsx`, add the import:

```ts
import { requestOnboardingReplay } from './engine/onboarding';
```

In the bankrupt branch, pass to `<BankruptcyScreen>`:

```tsx
          onReplayTutorial={() => { requestOnboardingReplay(); restart(); }}
```

- [ ] **Step 5: Run the BankruptcyScreen test**

Run: `npm test -- components/BankruptcyScreen`
Expected: PASS.

- [ ] **Step 6: Update the backlog**

In `backlog.md`, under "Backlog — Game Feel & Polish" (or a fitting section), add a delivered row noting the onboarding feature shipped as `specs/014-player-onboarding`, and confirm the existing **A1** analytics note (Analytics & Instrumentation section) still reads that onboarding events are deferred to that batch. Example row:

```
| F5 | ✅ **Player onboarding ("Your First Harvest")** — first-run guided overlay (fill plots with radishes → advance → payoff) + always-on empty-day safeguard + run-end "Replay tutorial". | High | M | UI.md #5 → shipped as [014-player-onboarding](specs/014-player-onboarding/spec.md) | **DONE.** Own localStorage key (survives Restart); turn-1 weather pinned safe; analytics deferred to A1. |
```

- [ ] **Step 7: Full verification**

Run: `npm test`
Expected: PASS (entire suite).
Run: `npm run lint`
Expected: clean.
Run: `npm run build`
Expected: type-check + build succeed.

- [ ] **Step 8: Commit**

```bash
git add src/components/BankruptcyScreen.tsx src/App.tsx backlog.md tests/components/BankruptcyScreen.test.tsx
git commit -m "feat(014): run-end Replay tutorial + mark onboarding shipped"
```

---

## Self-Review

**Spec coverage:**
- Guided flow steps (welcome→open-shop→buy-radishes→plant→advance→payoff→done) → Task 5 (`useOnboarding`) + Task 6 (overlay copy/CTAs). ✓
- Buy in shop, radish-gated buy, fill all plots → Task 5 `deriveStep` (`buy-radishes` needs `radish >= emptyPlotCount`; `plant` needs `emptyPlotCount === 0`) + Task 8 dimming. ✓
- Soft focus / free clicks → Task 6 overlay uses `pointer-events-none` root with only cards/bubbles interactive; nothing disabled. ✓
- Economics (one radish loses; fill plots profits) → enforced by the fill-all-plots goal (Task 5); payoff shows gross harvest income (Task 6/8). ✓
- Turn-1 safe weather, no engine change → Task 3 (`nextDay` param) + Task 8 (`shouldPinWeather ? 'sunny'`). ✓
- Empty-day safeguard (label + one-time soft confirm, not a hard block) → Task 2 selector + Task 7 label + Task 8 confirm. ✓
- Persistence in a separate key, not GameState; survives Restart → Task 1 (`onboarding.ts`). ✓
- Auto-start gate + existing-player protection (currentDay>1 → silently complete) → Task 5 init. ✓
- Skip at every step, no confirm, no repair → Task 6 SkipChip + Task 5 `onSkip`/`finish`. ✓
- Replay from run-end screen → Task 9 (`BankruptcyScreen` button + App `requestOnboardingReplay` + restart). ✓
- Reduced-motion → Task 6 uses `useReducedMotion` to drop the ring pulse. ✓
- Mobile vs desktop shop visibility → Task 4 (`useMediaQuery`) + Task 8 `isShopVisible = isDesktop || isShopOpen`. ✓
- Analytics deferred to backlog A1 → Task 9 Step 6 (no tracking wired). ✓
- Removes redundant Day-1 banner → Task 8 Step 3. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code. Component-test scaffolding instructs reuse of existing render/matchMedia helpers (names vary by file) while providing complete fallback code — acceptable, matching the repo's established plan style.

**Type consistency:**
- `OnboardingStep` defined once in `onboarding.ts` (Task 1); imported by `useOnboarding` (Task 5) and `OnboardingOverlay` (Task 6).
- `OnboardingRecord` (`{ schemaVersion: 1; completed; step }`) consistent across Task 1 impl, Task 5 `saveOnboarding` calls, and all test fixtures.
- `loadOnboarding` / `saveOnboarding` / `markOnboardingComplete` / `requestOnboardingReplay` names match between Task 1, Task 5, Task 9, and tests.
- `canAdvanceProductively(state)` signature matches between Task 2 (def), Task 8 (call), and the HUD prop name `canAdvanceProductively` (Task 7).
- `useOnboarding(state, { isShopVisible })` → `{ active, step, shouldPinWeather, onStart, onSkip, onDismissPayoff }` consistent between Task 5 return, Task 8 consumption, and Task 6 prop names (`onStart`/`onSkip`/`onDismissPayoff`/`step`/`harvestIncome`).
- `nextDay(weatherOverride?: WeatherId)` consistent between Task 3 (hook), App (`engine.nextDay`), and Task 8 (`onNextDay` prop type).
- `data-onboarding` anchor values (`shop-button`, `shop-radish`, `farm-grid`, `next-day`, `balance-chip`) match between the `ANCHORS` map (Task 6) and the elements tagged in Tasks 7–8.

**Open verification flags handed to the engineer** (call-outs in tasks, not gaps): exact field names `seedInventory.radish`, `PlotState.pestDamaged`/`exhaustedSinceDay`/`cropId`, `DailyLogEntry.totalHarvestIncome`, and Tailwind token names — each task says "confirm against `types.ts`/`tailwind.config.ts` and adjust." These are real fields used by code read while writing this plan; the notes guard against drift.

---

## Execution Handoff

Plan complete and saved to `specs/014-player-onboarding/plan.md` (per the CLAUDE.md spec-location convention, alongside `spec.md`). Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
</content>
