# Harvest Moment Juice (021 / F1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the player closes a harvest day's Day Summary, coins fly from the harvested plots to the HUD balance chip, the counter rapid-ticks to the new balance, and per-crop chiptune sounds play — per [spec.md](spec.md).

**Architecture:** Pure presentation layer, zero engine/schema changes. A new Web Audio synth module (`src/audio/sfx.ts`) plays four synthesized sounds. GameBoard gains a three-state celebration flow (`idle → holding → celebrating`): while the auto-opened summary modal is up the HUD *holds* the pre-turn balance, and on close a portal overlay (`HarvestCelebration`) animates coin sprites plot→chip with the Web Animations API, then the HUD ticks to the live balance via a new `useAnimatedNumber` hook.

**Tech Stack:** React 18, TypeScript, Tailwind, Web Animations API + Web Audio API (both native — no new dependencies), Vitest + Testing Library.

**Branch:** `021-harvest-juice` (already created; spec committed).

**Conventions used below:**
- All paths relative to repo root.
- Run tests with `npx vitest run <file>` for a single file, `npm test` for the suite.
- jsdom (the test DOM) has **no** `AudioContext` and **no** `Element.animate` — production code must no-op/fast-resolve without them; tests stub them when the full path is exercised.
- Every commit message ends with the trailer shown in Task 1 Step 5 (repeated in each commit block).

---

### Task 1: Audio module `src/audio/sfx.ts`

Four synthesized chiptune sounds behind a `SfxId`-keyed API, plus persistent mute. Recipes are the auditioned picks recorded in spec §4 — do not tweak frequencies/durations.

**Files:**
- Create: `src/audio/sfx.ts`
- Test: `tests/audio/sfx.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/audio/sfx.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AUDIO_KEY,
  RECIPES,
  isMuted,
  setMuted,
  playSfx,
  _resetAudioContextForTests,
  type SfxId,
} from '../../src/audio/sfx';

const ALL_IDS: SfxId[] = ['harvest_radish', 'harvest_parsnip', 'harvest_pumpkin', 'coin_land'];

class FakeOsc {
  type = 'sine';
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn((node: unknown) => node);
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn((node: unknown) => node);
}

function installFakeAudioContext() {
  const oscillators: FakeOsc[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running',
    resume: vi.fn(),
    destination: {},
    createOscillator: vi.fn(() => {
      const o = new FakeOsc();
      oscillators.push(o);
      return o;
    }),
    createGain: vi.fn(() => new FakeGain()),
  };
  vi.stubGlobal('AudioContext', vi.fn(() => ctx));
  return { ctx, oscillators };
}

beforeEach(() => {
  localStorage.clear();
  _resetAudioContextForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sfx — mute persistence', () => {
  it('defaults to unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('persists mute across a fresh read', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY)!)).toEqual({ schemaVersion: 1, muted: true });
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('never throws on malformed stored JSON and falls back to unmuted', () => {
    localStorage.setItem(AUDIO_KEY, '{not json!!');
    expect(isMuted()).toBe(false);
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ muted: 'yes-please' }));
    expect(isMuted()).toBe(false);
  });
});

describe('sfx — recipes', () => {
  it('has a non-empty recipe for every SfxId', () => {
    for (const id of ALL_IDS) {
      expect(RECIPES[id].length).toBeGreaterThan(0);
    }
  });
});

describe('sfx — playSfx', () => {
  it('no-ops (no throw) when AudioContext is unavailable (jsdom default)', () => {
    expect(window.AudioContext).toBeUndefined();
    expect(() => playSfx('harvest_radish')).not.toThrow();
  });

  it('creates one oscillator per recipe note', () => {
    const { oscillators } = installFakeAudioContext();
    playSfx('harvest_parsnip'); // two-note recipe
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].start).toHaveBeenCalled();
  });

  it('plays nothing while muted', () => {
    const { oscillators } = installFakeAudioContext();
    setMuted(true);
    playSfx('coin_land');
    expect(oscillators).toHaveLength(0);
  });

  it('reuses one AudioContext across plays and resumes a suspended one', () => {
    const { ctx } = installFakeAudioContext();
    playSfx('coin_land');
    playSfx('coin_land');
    expect(vi.mocked(window.AudioContext)).toHaveBeenCalledTimes(1);
    (ctx as { state: string }).state = 'suspended';
    playSfx('coin_land');
    expect(ctx.resume).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/audio/sfx.test.ts`
Expected: FAIL — `Cannot find module '../../src/audio/sfx'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `src/audio/sfx.ts`:

```ts
/**
 * 021 — chiptune SFX for the harvest celebration (F1). All sounds are
 * synthesized with the Web Audio API — no binary assets, no licensing.
 *
 * Backend swap contract: call sites only ever use `playSfx(id)`. Replacing
 * these synth recipes with CC0 audio files later means rewriting this module's
 * internals (e.g. per-id <audio> playback) without touching any caller.
 *
 * Recipes were auditioned against a synth demo on 2026-07-19 (spec §4) — the
 * numbers are the picked variants, not placeholders to tune.
 */

export type SfxId = 'harvest_radish' | 'harvest_parsnip' | 'harvest_pumpkin' | 'coin_land';

export const AUDIO_KEY = 'pixel-parsnips-audio';

interface AudioPrefs {
  schemaVersion: 1;
  muted: boolean;
}

const DEFAULT_PREFS: AudioPrefs = { schemaVersion: 1, muted: false };

/** Returns defaults when missing or malformed; never throws (records.ts pattern). */
function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return { schemaVersion: 1, muted: parsed.muted === true };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function isMuted(): boolean {
  return loadAudioPrefs().muted;
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ schemaVersion: 1, muted }));
  } catch {
    // Storage full or disabled — non-fatal; the choice simply won't persist.
  }
}

interface SynthNote {
  /** Start offset within the sound, seconds. */
  t0: number;
  type: OscillatorType;
  /** Start frequency (Hz); slides to f1 when set. */
  f0: number;
  f1?: number;
  /** Note length, seconds. */
  dur: number;
  /** Peak gain, 0..1. */
  vol: number;
}

/** Exported for tests and for the future file-backend swap. */
export const RECIPES: Record<SfxId, SynthNote[]> = {
  harvest_radish: [{ t0: 0, type: 'square', f0: 880, f1: 1175, dur: 0.09, vol: 0.14 }],
  harvest_parsnip: [
    { t0: 0, type: 'square', f0: 587, dur: 0.08, vol: 0.14 },
    { t0: 0.09, type: 'square', f0: 880, dur: 0.12, vol: 0.14 },
  ],
  harvest_pumpkin: [
    { t0: 0, type: 'square', f0: 196, f1: 98, dur: 0.22, vol: 0.2 },
    { t0: 0, type: 'triangle', f0: 98, f1: 65, dur: 0.26, vol: 0.3 },
  ],
  coin_land: [
    { t0: 0, type: 'square', f0: 1319, dur: 0.04, vol: 0.09 },
    { t0: 0.045, type: 'square', f0: 1760, dur: 0.07, vol: 0.09 },
  ],
};

const ATTACK_S = 0.005;

let ctx: AudioContext | null = null;

export function _resetAudioContextForTests(): void {
  ctx = null;
}

/**
 * Lazily creates the shared AudioContext. Only ever called from inside a
 * user-gesture call stack (the click/keypress that closed the modal), so
 * browser autoplay policy is satisfied; resume() covers the suspended case.
 */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  if (!ctx) ctx = new window.AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Plays a sound by id. No-ops when muted or when Web Audio is unavailable. */
export function playSfx(id: SfxId): void {
  if (isMuted()) return;
  const c = getContext();
  if (!c) return;
  for (const n of RECIPES[id]) {
    const t = c.currentTime + n.t0;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type;
    osc.frequency.setValueAtTime(n.f0, t);
    if (n.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(n.f1, t + n.dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(n.vol, t + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + n.dur + 0.02);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/audio/sfx.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/audio/sfx.ts tests/audio/sfx.test.ts
git commit -m "feat(audio): Web Audio chiptune SFX module with persistent mute (021 T1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: MuteToggle component in the HUD

**Files:**
- Create: `src/components/MuteToggle.tsx`
- Modify: `src/components/HUD.tsx` (right-side button cluster, ~line 192)
- Test: `tests/components/MuteToggle.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/MuteToggle.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MuteToggle } from '../../src/components/MuteToggle';
import { AUDIO_KEY, isMuted } from '../../src/audio/sfx';

beforeEach(() => {
  localStorage.clear();
});

describe('MuteToggle', () => {
  it('renders unmuted by default with aria-pressed=false', () => {
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: /mute sound effects/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveTextContent('🔊');
  });

  it('toggles to muted on click and persists', () => {
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: /mute sound effects/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveTextContent('🔇');
    expect(isMuted()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY)!)).toEqual({ schemaVersion: 1, muted: true });
  });

  it('initializes from the persisted value on a fresh mount', () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ schemaVersion: 1, muted: true }));
    render(<MuteToggle />);
    expect(screen.getByRole('button', { name: /mute sound effects/i }))
      .toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/MuteToggle.test.tsx`
Expected: FAIL — `Cannot find module '../../src/components/MuteToggle'`.

- [ ] **Step 3: Implement the component**

Create `src/components/MuteToggle.tsx`:

```tsx
import { useState } from 'react';
import { isMuted, setMuted } from '../audio/sfx';

/** 021 — persistent SFX mute toggle, lives in the HUD's right button cluster. */
export function MuteToggle() {
  const [muted, setMutedState] = useState(() => isMuted());

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label="Mute sound effects"
      title={muted ? 'Sound effects are off' : 'Sound effects are on'}
      onClick={toggle}
      className="
        font-pixel text-caption px-2 py-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded
        bg-[#261808] text-farm-stone/60 border border-[#5C3D1E]/50
        hover:bg-[#3A2510] hover:text-farm-parchment/80 hover:border-[#5C3D1E]
        active:scale-95 transition-all
      "
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
```

- [ ] **Step 4: Mount it in the HUD**

In `src/components/HUD.tsx`, add the import at the top:

```tsx
import { MuteToggle } from './MuteToggle';
```

Then in the right-side button cluster (`<div className="flex items-center gap-2">`, ~line 192), insert `<MuteToggle />` as the **first** child, before the "Last Turn" button:

```tsx
        <div className="flex items-center gap-2">
          <MuteToggle />
          <button
            type="button"
            aria-label="View last turn summary"
```

- [ ] **Step 5: Run tests to verify they pass (including existing HUD tests)**

Run: `npx vitest run tests/components/MuteToggle.test.tsx tests/components/HUD.test.tsx`
Expected: PASS. (HUD tests query by label/role, so an added button must not break them — if any fail, read the failure; do not delete assertions.)

- [ ] **Step 6: Commit**

```bash
git add src/components/MuteToggle.tsx src/components/HUD.tsx tests/components/MuteToggle.test.tsx
git commit -m "feat(hud): SFX mute toggle in HUD button cluster (021 T2)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `useAnimatedNumber` hook

**Files:**
- Create: `src/hooks/useAnimatedNumber.ts`
- Test: `tests/hooks/useAnimatedNumber.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/hooks/useAnimatedNumber.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimatedNumber } from '../../src/hooks/useAnimatedNumber';

function stubReducedMotion(matches: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  stubReducedMotion(false);
  // rAF + performance must both be faked so frame timestamps advance together.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAnimatedNumber', () => {
  it('renders the target immediately when animate is false', () => {
    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedNumber(target, false, 800),
      { initialProps: { target: 100 } },
    );
    expect(result.current).toBe(100);
    rerender({ target: 250 });
    expect(result.current).toBe(250);
  });

  it('ticks toward the target over the duration when animate is true', () => {
    const { result, rerender } = renderHook(
      ({ target, animate }) => useAnimatedNumber(target, animate, 800),
      { initialProps: { target: 100, animate: false } },
    );
    rerender({ target: 200, animate: true });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(200);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(200);
  });

  it('retargets mid-flight from the currently displayed value', () => {
    const { result, rerender } = renderHook(
      ({ target, animate }) => useAnimatedNumber(target, animate, 800),
      { initialProps: { target: 0, animate: false } },
    );
    rerender({ target: 100, animate: true });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const midway = result.current;
    expect(midway).toBeGreaterThan(0);
    rerender({ target: 500, animate: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(500);
  });

  it('snaps to the target under prefers-reduced-motion even when animate is true', () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(
      ({ target, animate }) => useAnimatedNumber(target, animate, 800),
      { initialProps: { target: 100, animate: true } },
    );
    rerender({ target: 900, animate: true });
    expect(result.current).toBe(900);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/hooks/useAnimatedNumber.test.tsx`
Expected: FAIL — `Cannot find module '../../src/hooks/useAnimatedNumber'`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useAnimatedNumber.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * 021 — displayed integer that ticks toward `target` over `durationMs` when
 * `animate` is true (and the user allows motion); renders `target` immediately
 * otherwise. Retargeting mid-flight animates from the currently displayed
 * value, so a mid-tick balance change (e.g. a purchase) folds in smoothly.
 */
export function useAnimatedNumber(target: number, animate: boolean, durationMs = 800): number {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  displayedRef.current = displayed;

  useEffect(() => {
    if (!shouldAnimate || displayedRef.current === target) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }
    const from = displayedRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplayed(Math.round(from + (target - from) * t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, shouldAnimate, durationMs]);

  return displayed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/hooks/useAnimatedNumber.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAnimatedNumber.ts tests/hooks/useAnimatedNumber.test.tsx
git commit -m "feat(hooks): useAnimatedNumber rAF counter tick (021 T3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: DOM anchors — `data-plot-id` and `data-coin-target`

The celebration overlay locates flight origins/target by querying these attributes; they are inert for everything else.

**Files:**
- Modify: `src/components/FarmGrid.tsx` (plot map, ~line 98)
- Modify: `src/components/HUD.tsx` (balance chip, ~line 130)
- Test: extend `tests/components/FarmGrid.test.tsx` and `tests/components/HUD.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/FarmGrid.test.tsx` (reuse the file's existing plot-fixture helpers for `plots`; any minimal `PlotState[]` works):

```tsx
describe('FarmGrid — 021 celebration anchors', () => {
  it('wraps every plot in an element carrying data-plot-id', () => {
    const plots: PlotState[] = [
      { id: 0, cropId: null, dayPlanted: null, daysRemaining: null, exhaustedSinceDay: null, consecutiveHarvests: 0, pestDamaged: false, droughtPenalised: false },
      { id: 1, cropId: null, dayPlanted: null, daysRemaining: null, exhaustedSinceDay: null, consecutiveHarvests: 0, pestDamaged: false, droughtPenalised: false },
    ];
    const { container } = render(<FarmGrid plots={plots} />);
    expect(container.querySelector('[data-plot-id="0"]')).not.toBeNull();
    expect(container.querySelector('[data-plot-id="1"]')).not.toBeNull();
  });
});
```

> If `PlotState` has drifted from the shape above, copy the fixture shape used
> elsewhere in this test file — the assertion is only about `data-plot-id`.

Append to `tests/components/HUD.test.tsx` (inside the file, using its existing `baseProps`):

```tsx
describe('HUD — 021 celebration anchors', () => {
  it('marks the balance chip with data-coin-target', () => {
    const { container } = render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(container.querySelector('[data-coin-target]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/FarmGrid.test.tsx tests/components/HUD.test.tsx`
Expected: the two new tests FAIL (`expected null not to be null`); all pre-existing tests PASS.

- [ ] **Step 3: Add the anchors**

In `src/components/FarmGrid.tsx`, wrap the `PlotCard` in the plots map (~line 98) with a keyed div carrying the attribute (the `key` moves to the wrapper):

```tsx
          {plots.map(plot => {
            const locked = plot.id >= (unlockedPlots ?? plots.length);
            const isNextPurchasable = plot.id === (unlockedPlots ?? plots.length);
            return (
              <div key={plot.id} data-plot-id={plot.id}>
                <PlotCard
                  plot={plot}
                  currentDay={currentDay}
                  fertilizerInventory={fertilizerInventory}
                  recoveryDays={recoveryDays}
                  isPlantAnchor={plot.id === plantAnchorId}
                  locked={locked}
                  isNextPurchasable={locked && isNextPurchasable}
                  plotPrice={nextPlotPrice ?? undefined}
                  canAffordPlot={canAffordPlot}
                  onPlant={onPlant}
                  onApplyFertilizer={onApplyFertilizer}
                  onClearPestDamage={onClearPestDamage}
                  onBuyPlot={onBuyPlot}
                />
              </div>
            );
          })}
```

In `src/components/HUD.tsx`, add `data-coin-target` to the balance chip div (~line 130):

```tsx
        <div data-onboarding="balance-chip" data-coin-target className={`flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border ${balanceBorderClass}`}>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/FarmGrid.test.tsx tests/components/HUD.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FarmGrid.tsx src/components/HUD.tsx tests/components/FarmGrid.test.tsx tests/components/HUD.test.tsx
git commit -m "feat(ui): DOM anchors for coin-flight origins and target (021 T4)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `HarvestCelebration` overlay component

The heart of the feature: portal overlay, coin sprites, WAAPI flights, per-crop launch sounds, landing pings, skip, and the three fallback paths (reduced motion / no WAAPI / missing anchors).

**Files:**
- Create: `src/components/HarvestCelebration.tsx`
- Test: `tests/components/HarvestCelebration.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/HarvestCelebration.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { HarvestCelebration, coinCounts } from '../../src/components/HarvestCelebration';
import type { DailyLogEntry, HarvestEvent } from '../../src/engine/types';

vi.mock('../../src/audio/sfx', () => ({
  playSfx: vi.fn(),
}));
import { playSfx } from '../../src/audio/sfx';

function makeHarvest(plotId: number, cropId: HarvestEvent['cropId'], adjustedYield: number): HarvestEvent {
  return { plotId, cropId, baseYield: adjustedYield, weatherMultiplier: 1, adjustedYield };
}

function makeLog(harvests: HarvestEvent[]): DailyLogEntry {
  return {
    day: 3,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests,
    totalHarvestIncome: harvests.reduce((a, h) => a + h.adjustedYield, 0),
    openingBalance: 100,
    landLeaseDeducted: 15,
    taxRate: 0.06,
    taxDeducted: 4,
    netChange: -7,
    closingBalance: 93,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    pestPlotsAtRisk: 0,
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 1,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    buildingsApplied: [],
  };
}

/** Controllable WAAPI stub: collect animations, fire onfinish manually. */
class FakeAnimation {
  onfinish: (() => void) | null = null;
  cancel = vi.fn();
}

function installFakeWaapi() {
  const animations: FakeAnimation[] = [];
  HTMLElement.prototype.animate = vi.fn(() => {
    const a = new FakeAnimation();
    animations.push(a);
    return a as unknown as Animation;
  }) as unknown as typeof HTMLElement.prototype.animate;
  return animations;
}

function stubReducedMotion(matches: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubReducedMotion(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // jsdom has no Element.animate; remove any stub we installed.
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe('coinCounts', () => {
  it('scales coins with yield: radish 12 → 1, parsnip 28 → 2, pumpkin 65 → 4 (clamped)', () => {
    expect(coinCounts([12])).toEqual([1]);
    expect(coinCounts([28])).toEqual([2]);
    expect(coinCounts([65])).toEqual([4]);
  });

  it('caps the total at 20 coins, never trimming a plot below 1', () => {
    const counts = coinCounts(Array.from({ length: 12 }, () => 65));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
  });
});

describe('HarvestCelebration — no WAAPI (jsdom default)', () => {
  it('resolves instantly: onDone and onCoinsArriving fire, nothing renders persistently', () => {
    const onDone = vi.fn();
    const onCoinsArriving = vi.fn();
    render(
      <HarvestCelebration
        log={makeLog([makeHarvest(0, 'radish', 12)])}
        onCoinsArriving={onCoinsArriving}
        onDone={onDone}
      />,
    );
    expect(onCoinsArriving).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('HarvestCelebration — full flight (WAAPI stubbed)', () => {
  it('renders one coin per coinCounts entry, capped at 20, inside an aria-hidden overlay', () => {
    installFakeWaapi();
    const log = makeLog(Array.from({ length: 12 }, (_, i) => makeHarvest(i, 'pumpkin', 65)));
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={vi.fn()} />);
    const overlay = screen.getByTestId('harvest-celebration');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay.querySelectorAll('span')).toHaveLength(20);
  });

  it('plays one launch sound per harvested plot, mapped per crop', () => {
    installFakeWaapi();
    const log = makeLog([
      makeHarvest(0, 'radish', 12),
      makeHarvest(1, 'parsnip', 28),
      makeHarvest(2, 'pumpkin', 65),
    ]);
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(2000); // fire all staggered launch timers
    });
    expect(playSfx).toHaveBeenCalledWith('harvest_radish');
    expect(playSfx).toHaveBeenCalledWith('harvest_parsnip');
    expect(playSfx).toHaveBeenCalledWith('harvest_pumpkin');
  });

  it('fires onCoinsArriving at the first landing and onDone only after all landings', () => {
    const animations = installFakeWaapi();
    const onDone = vi.fn();
    const onCoinsArriving = vi.fn();
    const log = makeLog([makeHarvest(0, 'parsnip', 28)]); // 2 coins
    render(<HarvestCelebration log={log} onCoinsArriving={onCoinsArriving} onDone={onDone} />);
    expect(animations).toHaveLength(2);

    act(() => animations[0].onfinish?.());
    expect(onCoinsArriving).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    act(() => animations[1].onfinish?.());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips to done on window pointerdown, cancelling animations', () => {
    const animations = installFakeWaapi();
    const onDone = vi.fn();
    const log = makeLog([makeHarvest(0, 'pumpkin', 65)]);
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={onDone} />);
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(animations.some(a => a.cancel.mock.calls.length > 0)).toBe(true);
  });

  it('skips to done on window keydown', () => {
    installFakeWaapi();
    const onDone = vi.fn();
    render(
      <HarvestCelebration log={makeLog([makeHarvest(0, 'radish', 12)])} onCoinsArriving={vi.fn()} onDone={onDone} />,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('HarvestCelebration — reduced motion (sound-only)', () => {
  it('renders no coins, plays staggered crop sounds, then resolves', () => {
    stubReducedMotion(true);
    installFakeWaapi(); // must be ignored on this path
    const onDone = vi.fn();
    const log = makeLog([makeHarvest(0, 'radish', 12), makeHarvest(1, 'pumpkin', 65)]);
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={onDone} />);
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(playSfx).toHaveBeenCalledWith('harvest_radish');
    expect(playSfx).toHaveBeenCalledWith('harvest_pumpkin');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/HarvestCelebration.test.tsx`
Expected: FAIL — `Cannot find module '../../src/components/HarvestCelebration'`.

- [ ] **Step 3: Implement the component**

Create `src/components/HarvestCelebration.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { CropId, DailyLogEntry } from '../engine/types';
import { playSfx, type SfxId } from '../audio/sfx';
import { useReducedMotion } from '../hooks/useReducedMotion';

const GROUP_STAGGER_MS = 140;
/** Compress the stagger so the last group launches by here (spec §3). */
const MAX_LAST_LAUNCH_MS = 900;
const COIN_STAGGER_MS = 60;
const FLIGHT_MS = 600;
const MAX_COINS = 20;
const MAX_COINS_PER_PLOT = 4;
const YIELD_PER_COIN = 16;
const COIN_PING_THROTTLE_MS = 60;

const CROP_SFX: Record<CropId, SfxId> = {
  radish: 'harvest_radish',
  parsnip: 'harvest_parsnip',
  pumpkin: 'harvest_pumpkin',
};

/**
 * Coins per harvested plot: 1–4 scaled by yield, hard-capped at MAX_COINS
 * total by trimming the largest groups first (never below 1 per plot).
 * Exported for direct unit testing.
 */
export function coinCounts(yields: number[]): number[] {
  const counts = yields.map(y =>
    Math.max(1, Math.min(MAX_COINS_PER_PLOT, Math.ceil(y / YIELD_PER_COIN))),
  );
  let total = counts.reduce((a, b) => a + b, 0);
  while (total > MAX_COINS) {
    const max = Math.max(...counts);
    if (max <= 1) break;
    counts[counts.indexOf(max)] -= 1;
    total -= 1;
  }
  return counts;
}

interface Point {
  x: number;
  y: number;
}

function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function plotOrigin(plotId: number): Point {
  const el = document.querySelector(`[data-plot-id="${plotId}"]`);
  // Fallback (spec §3): plot node missing → lower screen center.
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight * 0.75 };
  return centerOf(el);
}

function chipTarget(): Point {
  const el = document.querySelector('[data-coin-target]');
  if (!el) return { x: window.innerWidth / 2, y: 24 };
  return centerOf(el);
}

interface HarvestCelebrationProps {
  log: DailyLogEntry;
  /** First coin reached the chip — the HUD counter tick should start. */
  onCoinsArriving: () => void;
  /** Sequence fully resolved (or skipped) — parent should unmount us. */
  onDone: () => void;
}

/**
 * 021 — the harvest celebration overlay. Mounted by GameBoard when a
 * fresh-open harvest-day summary closes; unmounts itself via onDone. Purely
 * decorative (aria-hidden, pointer-events-none): gameplay state is already
 * committed before this ever renders.
 */
export function HarvestCelebration({ log, onCoinsArriving, onDone }: HarvestCelebrationProps) {
  const reducedMotion = useReducedMotion();
  const counts = useMemo(
    () => coinCounts(log.harvests.map(h => h.adjustedYield)),
    [log],
  );
  const totalCoins = counts.reduce((a, b) => a + b, 0);

  const coinRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timersRef = useRef<number[]>([]);
  const animationsRef = useRef<Animation[]>([]);
  const doneRef = useRef(false);
  const arrivedRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  // Parent callbacks in refs so the one-shot sequence effect never re-runs.
  const onCoinsArrivingRef = useRef(onCoinsArriving);
  onCoinsArrivingRef.current = onCoinsArriving;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // The whole sequence is one-shot per mount: GameBoard mounts a fresh
  // instance per celebration and the log cannot change mid-flight.
  useEffect(() => {
    const groups = log.harvests;
    const stagger =
      groups.length > 1 ? Math.min(GROUP_STAGGER_MS, MAX_LAST_LAUNCH_MS / (groups.length - 1)) : 0;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      timersRef.current.forEach(id => window.clearTimeout(id));
      animationsRef.current.forEach(a => a.cancel());
      if (!arrivedRef.current) {
        arrivedRef.current = true;
        onCoinsArrivingRef.current();
      }
      onDoneRef.current();
    };
    finishRef.current = finish;

    // Sound-only path (spec §3): reduced motion keeps the audio, drops the visuals.
    if (reducedMotion) {
      groups.forEach((h, i) => {
        timersRef.current.push(window.setTimeout(() => playSfx(CROP_SFX[h.cropId]), i * stagger));
      });
      timersRef.current.push(
        window.setTimeout(finish, Math.max(0, groups.length - 1) * stagger + 300),
      );
      return () => {
        timersRef.current.forEach(id => window.clearTimeout(id));
      };
    }

    // No Web Animations API (jsdom, ancient browsers): resolve instantly (spec §3).
    if (typeof HTMLElement.prototype.animate !== 'function') {
      finish();
      return;
    }

    const target = chipTarget();
    const chipEl = document.querySelector('[data-coin-target]') as HTMLElement | null;
    let landed = 0;
    let launched = 0;
    let lastPing = 0;
    let coinIndex = 0;

    groups.forEach((h, gi) => {
      const origin = plotOrigin(h.plotId);
      const launchDelay = gi * stagger;
      timersRef.current.push(
        window.setTimeout(() => playSfx(CROP_SFX[h.cropId]), launchDelay),
      );

      for (let j = 0; j < counts[gi]; j++) {
        const el = coinRefs.current[coinIndex];
        coinIndex += 1;
        if (!el) continue;
        const jitterX = (Math.random() - 0.5) * 40;
        const jitterY = (Math.random() - 0.5) * 40;
        el.style.left = `${origin.x + jitterX}px`;
        el.style.top = `${origin.y + jitterY}px`;
        const dx = target.x - origin.x - jitterX;
        const dy = target.y - origin.y - jitterY;
        const anim = el.animate(
          [
            { transform: 'translate(-50%, -50%)', opacity: 0.9 },
            // Arc: overshoot upward at the midpoint before easing into the chip.
            {
              transform: `translate(calc(${dx * 0.5}px - 50%), calc(${dy * 0.5 - 60}px - 50%))`,
              opacity: 1,
              offset: 0.5,
            },
            { transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%))`, opacity: 1 },
          ],
          { duration: FLIGHT_MS, delay: launchDelay + j * COIN_STAGGER_MS, easing: 'ease-in', fill: 'both' },
        );
        launched += 1;
        anim.onfinish = () => {
          if (doneRef.current) return;
          el.style.visibility = 'hidden';
          landed += 1;
          if (!arrivedRef.current) {
            arrivedRef.current = true;
            onCoinsArrivingRef.current();
          }
          const now = performance.now();
          if (now - lastPing >= COIN_PING_THROTTLE_MS) {
            lastPing = now;
            playSfx('coin_land');
          }
          if (chipEl && typeof chipEl.animate === 'function') {
            chipEl.animate(
              [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
              { duration: 150 },
            );
          }
          if (landed >= launched) finish();
        };
        animationsRef.current.push(anim);
      }
    });

    if (launched === 0) {
      finish();
      return;
    }

    return () => {
      timersRef.current.forEach(id => window.clearTimeout(id));
      animationsRef.current.forEach(a => a.cancel());
    };
    // One-shot per mount by design — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip on any input. Registered in an effect, which runs only after the
  // event that closed the modal has fully dispatched — so that click/Escape
  // can never skip the celebration it just started (spec §3).
  useEffect(() => {
    const skip = () => finishRef.current();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  if (reducedMotion) return null;

  return ReactDOM.createPortal(
    <div
      aria-hidden="true"
      data-testid="harvest-celebration"
      className="fixed inset-0 z-[60] pointer-events-none"
    >
      {Array.from({ length: totalCoins }, (_, i) => (
        <span
          key={i}
          ref={el => {
            coinRefs.current[i] = el;
          }}
          className="fixed text-xl"
          style={{ left: -100, top: -100, transform: 'translate(-50%, -50%)' }}
        >
          🪙
        </span>
      ))}
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/HarvestCelebration.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/HarvestCelebration.tsx tests/components/HarvestCelebration.test.tsx
git commit -m "feat(ui): HarvestCelebration coin-flight overlay (021 T5)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: HUD hold & tick props

The HUD learns to display a held (pre-turn) balance and to rapid-tick to the live balance — while danger styling and the accessible label keep reporting the committed value.

**Files:**
- Modify: `src/components/HUD.tsx`
- Test: extend `tests/components/HUD.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/HUD.test.tsx`:

```tsx
describe('HUD — 021 held/ticking balance', () => {
  it('displays heldBalance instead of the committed balance', () => {
    render(<HUD {...baseProps} currentDay={3} coinBalance={93} heldBalance={100} />);
    const coins = screen.getByLabelText(/coins: 93/i);
    expect(coins).toHaveTextContent('100');
    expect(coins).not.toHaveTextContent('93');
  });

  it('keeps aria-label and danger styling on the committed balance while holding', () => {
    // committed 10 vs Season-1 lease 15 → critical; held value is comfortable.
    render(<HUD {...baseProps} currentDay={3} coinBalance={10} heldBalance={500} />);
    const coins = screen.getByLabelText(/coins: 10/i);
    expect(coins).toHaveTextContent('500');
    expect(coins.className).toContain('text-[#EB6A5C]'); // critical text color
  });

  it('shows the committed balance when heldBalance is null', () => {
    render(<HUD {...baseProps} currentDay={3} coinBalance={93} heldBalance={null} />);
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: the three new tests FAIL (TypeScript may also flag the unknown `heldBalance` prop — that counts as the expected failure); existing tests PASS.

- [ ] **Step 3: Implement the HUD changes**

In `src/components/HUD.tsx`:

1. Add the import:

```tsx
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
```

2. Add to `HUDProps`:

```tsx
  /** 021 — value shown instead of the committed balance while the Day Summary
      holds the harvest reveal; null/undefined = show the committed balance. */
  heldBalance?: number | null;
  /** 021 — when true, the displayed balance rapid-ticks from the held value to
      the committed balance (celebration coins are landing). */
  tickBalance?: boolean;
```

3. Destructure them in the component signature (`heldBalance = null, tickBalance = false`).

4. Compute the displayed value next to the existing `dangerLevel` lines (~line 93). Danger styling and `aria-label` intentionally keep using `coinBalance`:

```tsx
  const holding = heldBalance !== null && heldBalance !== undefined && !tickBalance;
  const displayTarget = holding ? heldBalance : coinBalance;
  const displayedBalance = useAnimatedNumber(displayTarget, tickBalance);
```

5. In the balance chip, replace the rendered number (`{coinBalance}` inside the span with the `aria-label`, ~line 137) with:

```tsx
              {displayedBalance}
```

Leave the `aria-label={`Coins: ${coinBalance}. …`}` exactly as it is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(hud): held balance + rapid-tick display for harvest reveal (021 T6)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: GameBoard wiring — the celebration state machine

Connects everything: hold on modal auto-open, celebrate on close, tick on first landing, cancel on Next Day. Trigger rules per spec §2.

**Files:**
- Modify: `src/components/GameBoard.tsx`
- Test: create `tests/components/GameBoard.celebration.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/GameBoard.celebration.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { GameBoard } from '../../src/components/GameBoard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete } from '../../src/engine/onboarding';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

vi.mock('../../src/audio/sfx', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/audio/sfx')>()),
  playSfx: vi.fn(),
}));

const harvestLog: DailyLogEntry = {
  day: 3,
  weatherId: 'sunny',
  weatherMultiplier: 1,
  harvests: [{ plotId: 0, cropId: 'radish', baseYield: 12, weatherMultiplier: 1, adjustedYield: 12 }],
  totalHarvestIncome: 12,
  openingBalance: 100,
  landLeaseDeducted: 15,
  taxRate: 0.06,
  taxDeducted: 4,
  netChange: -7,
  closingBalance: 93,
  exhaustedPlots: [0],
  pestDestroyedPlots: [],
  pestPlotsAtRisk: 0,
  flashDroughtDaysAfter: 0,
  streakBefore: 0,
  streakAfter: 1,
  streakBonus: 0,
  marketActive: null,
  marketAnnounced: null,
  buildingsApplied: [],
};

const quietLog: DailyLogEntry = { ...harvestLog, harvests: [], totalHarvestIncome: 0 };

function makeProps(state?: Partial<GameState>) {
  const base = initialGameState();
  // A growing crop keeps canAdvanceProductively() true, so the Next Day click
  // advances directly (label "Advance to next day") instead of opening the
  // empty-day confirm dialog with a "Skip day" label.
  const plots = base.plots.map(p =>
    p.id === 0 ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
  );
  return {
    state: { ...base, plots, coinBalance: 93, ...state },
    lastDailyLog: null as DailyLogEntry | null,
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

/** Click Next Day, then deliver the log — mirrors the engine round-trip. */
function advanceWithLog(
  rerender: (ui: ReactElement) => void,
  props: ReturnType<typeof makeProps>,
  log: DailyLogEntry,
) {
  fireEvent.click(screen.getAllByRole('button', { name: /next day/i })[0]);
  rerender(<GameBoard {...props} lastDailyLog={log} />);
}

class FakeAnimation {
  onfinish: (() => void) | null = null;
  cancel = vi.fn();
}

function installFakeWaapi() {
  const animations: FakeAnimation[] = [];
  HTMLElement.prototype.animate = vi.fn(() => {
    const a = new FakeAnimation();
    animations.push(a);
    return a as unknown as Animation;
  }) as unknown as typeof HTMLElement.prototype.animate;
  return animations;
}

beforeEach(() => {
  localStorage.clear();
  markOnboardingComplete();
});

afterEach(() => {
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe('GameBoard — 021 harvest celebration wiring', () => {
  it('holds the pre-turn balance in the HUD while a fresh harvest summary is open', () => {
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    // Modal is open; HUD text shows the held opening balance, label the committed one.
    expect(screen.getByLabelText('Close day summary')).toBeInTheDocument();
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('100');
  });

  it('mounts the celebration on close and shows the committed balance when done', () => {
    const animations = installFakeWaapi();
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.getByTestId('harvest-celebration')).toBeInTheDocument();
    // Land every coin → celebration resolves.
    act(() => animations.forEach(a => a.onfinish?.()));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
  });

  it('does not hold or celebrate on a quiet day', () => {
    installFakeWaapi();
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, quietLog);
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });

  it('does not celebrate on a Last Turn reopen', () => {
    installFakeWaapi();
    const props = makeProps();
    render(<GameBoard {...props} lastDailyLog={harvestLog} />);
    fireEvent.click(screen.getByRole('button', { name: /view last turn summary/i }));
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });

  it('does not hold or celebrate on a season-boundary turn', () => {
    installFakeWaapi();
    const props = makeProps({ phase: 'season_passed' });
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });

  it('cancels a running celebration when Next Day is pressed', () => {
    installFakeWaapi(); // animations never finish on their own
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.getByTestId('harvest-celebration')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /next day/i })[0]);
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });
});
```

> Note: `fireEvent.click` does not dispatch `pointerdown`, so clicking the close
> button in these tests does not trip the celebration's skip listener — which is
> also the real-browser behavior thanks to the effect-registration guard.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/GameBoard.celebration.test.tsx`
Expected: FAIL — held-balance assertions see `93` instead of `100`, and `harvest-celebration` is never found (GameBoard doesn't know the props/component yet).

- [ ] **Step 3: Implement the GameBoard wiring**

In `src/components/GameBoard.tsx`:

1. Add imports:

```tsx
import { HarvestCelebration } from './HarvestCelebration';
import { useReducedMotion } from '../hooks/useReducedMotion';
```

2. Add the state type near the top of the file (below the existing helper functions):

```tsx
/** 021 — harvest-celebration flow. `holding`: fresh summary modal is open and
    the HUD is holding the pre-turn balance. `celebrating`: modal closed, the
    coin-flight overlay is mounted; `ticking` flips when the first coin lands. */
type CelebrationState =
  | { kind: 'idle' }
  | { kind: 'holding'; log: DailyLogEntry }
  | { kind: 'celebrating'; log: DailyLogEntry; ticking: boolean };
```

3. Inside `GameBoard`, add state + reduced-motion (next to the other modal state, ~line 235):

```tsx
  const [celebration, setCelebration] = useState<CelebrationState>({ kind: 'idle' });
  const reducedMotion = useReducedMotion();
```

4. Extend the modal auto-open effect (~line 252) to enter `holding` per spec §2 (harvests present + run still going). Note the added `state.phase` dependency:

```tsx
  useEffect(() => {
    if (awaitingModalRef.current && lastDailyLog !== null) {
      awaitingModalRef.current = false;
      setDaySummary(lastDailyLog);
      setSummaryAnimate(true);
      setIsSummaryOpen(true);
      setIsProcessing(false);
      if (lastDailyLog.harvests.length > 0 && state.phase === 'playing') {
        setCelebration({ kind: 'holding', log: lastDailyLog });
      }
    }
  }, [lastDailyLog, state.phase]);
```

5. In `doAdvance` (~line 286), cancel any running celebration before processing the new turn:

```tsx
  function doAdvance() {
    if (isProcessing) return;
    setCelebration({ kind: 'idle' });
    setIsProcessing(true);
    awaitingModalRef.current = true;
    onNextDay(onboarding.shouldPinWeather ? 'sunny' : undefined);
  }
```

6. Change the `DaySummaryModal` `onClose` (~line 413) to promote `holding → celebrating`:

```tsx
          onClose={() => {
            setIsSummaryOpen(false);
            setCelebration(c =>
              c.kind === 'holding' ? { kind: 'celebrating', log: c.log, ticking: false } : c,
            );
          }}
```

7. Pass the hold/tick props to `<HUD …>` (~line 321). Reduced motion never holds (spec §3):

```tsx
        heldBalance={
          !reducedMotion &&
          (celebration.kind === 'holding' ||
            (celebration.kind === 'celebrating' && !celebration.ticking))
            ? celebration.log.openingBalance
            : null
        }
        tickBalance={celebration.kind === 'celebrating' && celebration.ticking && !reducedMotion}
```

8. Render the overlay next to the `DaySummaryModal` block (~line 415):

```tsx
      {celebration.kind === 'celebrating' && (
        <HarvestCelebration
          log={celebration.log}
          onCoinsArriving={() =>
            setCelebration(c => (c.kind === 'celebrating' ? { ...c, ticking: true } : c))
          }
          onDone={() => setCelebration({ kind: 'idle' })}
        />
      )}
```

9. Add `DailyLogEntry` to the existing type import from `'../engine/types'` if not already present (it is — verify).

- [ ] **Step 4: Run the new tests and the full suite**

Run: `npx vitest run tests/components/GameBoard.celebration.test.tsx`
Expected: PASS (6 tests).

Run: `npm test`
Expected: PASS. If any pre-existing GameBoard/HUD test fails, it is asserting the old always-committed balance rendering — update that test's expectation to match spec §2 (held only during fresh harvest summaries), never by weakening the new tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameBoard.tsx tests/components/GameBoard.celebration.test.tsx
git commit -m "feat(game): wire harvest celebration state machine into GameBoard (021 T7)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Full verification, manual check, backlog update

**Files:**
- Modify: `backlog.md` (F1 row)

- [ ] **Step 1: Full suite + lint**

Run: `npm test && npm run lint`
Expected: both PASS with zero warnings-as-errors. Fix anything that fails before proceeding.

- [ ] **Step 2: Manual browser verification**

Start the dev server (`npm run dev` or the project's preview tooling) and verify against spec §8:

1. New game → buy radishes → plant → Next Day → close summary: coins fly from plots to the chip, counter ticks 100→(new balance), radish plink + coin pings audible.
2. Click during the flight → everything resolves instantly.
3. "Last Turn" reopen → close: no celebration.
4. Advance an empty day → no celebration.
5. Toggle 🔇 → advance a harvest day → silent; reload the page → still muted.
6. OS reduced-motion enabled → harvest day: no coin flight, balance updates instantly, sounds still play.

- [ ] **Step 3: Update the backlog**

In `backlog.md`, replace the F1 row:

```markdown
| F1 | ✅ **Juice pass — harvest moment** — coins fly to HUD with animation; counter ticks rapidly; per-crop harvest sounds | Medium | M | p2·E → **shipped as [021-harvest-juice](specs/021-harvest-juice/spec.md)** | **DONE (2026-07-19).** Coin-flight celebration on fresh harvest-summary close (HUD holds the pre-turn balance, then rapid-ticks as coins land); per-crop Web-Audio chiptune SFX (zero assets, swappable to CC0 files behind `playSfx(id)`) + persistent HUD mute toggle (`pixel-parsnips-audio` key). Skippable on any input; reduced-motion = sounds only; no engine/schema change, no new deps. |
```

- [ ] **Step 4: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): mark F1 harvest juice shipped as 021 (021 T8)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Spec coverage map (self-check)

| Spec section | Task(s) |
|---|---|
| §2 trigger conditions + HUD hold | 6, 7 |
| §3 sequence, stagger, cap, skip, fallbacks | 5 |
| §3 counter tick | 3, 6, 7 |
| §4 synth recipes, mute, persistence, lazy AudioContext | 1, 2 |
| §5 components & anchors | 4, 5, 6, 7 |
| §6 accessibility | 5 (aria-hidden overlay), 6 (committed aria-label), 2 (aria-pressed) |
| §7 testing | every task; integration in 7 |
| §8 acceptance criteria | 8 |
