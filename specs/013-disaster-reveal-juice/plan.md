# Disaster Reveal Juice (F2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staged "dread-then-hit" disaster reveal to the Day Summary modal, with a single unified high-weight disaster banner shared by blight, pest infestation, and flash drought.

**Architecture:** Pure presentation change. A new `DisasterBanner` component renders the unified heavy banner. `DaySummaryModal` owns a staging state machine (`revealed`) that, on a fresh disaster-day open, holds back the red background + "Disaster!" badge + banner for ~700ms, then drops them in. `DailyLog` loses its inline disaster line-items (they move into the banner) and renders its weather badge neutrally while the reveal is pending. A `useReducedMotion` hook disables staging + animation when the user prefers reduced motion. No engine, type, or schema changes.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + Testing Library + vitest-axe.

---

## File Structure

- **Create** `src/components/DisasterBanner.tsx` — the unified heavy banner (icon + text per disaster type).
- **Create** `src/hooks/useReducedMotion.ts` — `matchMedia`-backed hook returning whether reduced motion is preferred.
- **Modify** `src/components/DailyLog.tsx` — remove inline flash-drought + pest-destroyed blocks; render weather badge neutrally when a `suppressDisasterStyling` prop is set; keep exhaustion block.
- **Modify** `src/components/DaySummaryModal.tsx` — add `animateReveal` prop + `revealed` staging; gate red bg / "Disaster!" badge / `DisasterBanner` on `revealed`.
- **Modify** `src/components/GameBoard.tsx` — pass `animateReveal={true}` on auto-open, `animateReveal={false}` on "Last Turn" reopen.
- **Modify** `src/App.css` — add disaster keyframes under the existing `prefers-reduced-motion: no-preference` media block.
- **Modify** `tests/setup.ts` — add a default `window.matchMedia` stub for jsdom.
- **Create** `tests/components/DisasterBanner.test.tsx` — banner rendering per disaster type.
- **Create** `tests/components/DaySummaryModal.test.tsx` — staging behavior.
- **Modify** `tests/components/DailyLog.test.tsx` — assert old inline disaster lines are gone; weather-badge styling.

Note on the data: `DailyLogEntry` already carries everything the banner needs — `weatherId`, `weatherMultiplier`, `pestDestroyedPlots`, `flashDroughtDaysAfter`. The disaster set is `DISASTER_WEATHER_IDS = { blight, pest_infestation, flash_drought }`, already exported from `src/components/DailyLog.tsx`. The blight banner text uses the weather description from `WEATHER_DEFINITIONS` and does **not** restate the multiplier (the weather badge already shows `×0.1`).

---

## Task 1: jsdom matchMedia stub

The `useReducedMotion` hook (Task 2) calls `window.matchMedia`, which jsdom does not implement. Add a default stub so every test can render components that use the hook. Default reports "no preference" (motion allowed).

**Files:**
- Modify: `tests/setup.ts`

- [ ] **Step 1: Add the matchMedia stub**

Append to `tests/setup.ts`:

```typescript
// jsdom has no matchMedia; default to "no preference" (motion allowed).
// Individual tests can override window.matchMedia to simulate reduced motion.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npm test`
Expected: PASS (no behavior change yet; stub is only used when matchMedia is called).

- [ ] **Step 3: Commit**

```bash
git add tests/setup.ts
git commit -m "test(013): add jsdom matchMedia stub for reduced-motion hook"
```

---

## Task 2: useReducedMotion hook

A small hook returning `true` when the user prefers reduced motion. Reads once on mount and subscribes to changes.

**Files:**
- Create: `src/hooks/useReducedMotion.ts`
- Test: covered indirectly via modal tests (Task 5); no standalone test needed — it is a thin `matchMedia` wrapper.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useReducedMotion.ts`:

```typescript
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns true when the user has requested reduced motion.
 * Reads the media query on mount and updates if the preference changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
```

- [ ] **Step 2: Verify it type-checks / lints**

Run: `npm run lint`
Expected: PASS (no unused symbols; file compiles).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useReducedMotion.ts
git commit -m "feat(013): add useReducedMotion hook"
```

---

## Task 3: DisasterBanner component

The unified heavy banner. Renders for disaster weather only; returns `null` otherwise. Icon + text vary by disaster type; styling is identical for all three.

**Files:**
- Create: `src/components/DisasterBanner.tsx`
- Test: `tests/components/DisasterBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/DisasterBanner.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { DisasterBanner } from '../../src/components/DisasterBanner';
import type { DailyLogEntry } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 14,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests: [],
    totalHarvestIncome: 0,
    openingBalance: 100,
    landLeaseDeducted: 15,
    taxRate: 0.05,
    taxDeducted: 4,
    netChange: -19,
    closingBalance: 81,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 0,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    ...over,
  };
}

describe('DisasterBanner', () => {
  it('returns nothing for non-disaster weather', () => {
    const { container } = render(<DisasterBanner log={makeLog({ weatherId: 'sunny' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the blight banner', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'blight', weatherMultiplier: 0.1 })} />);
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent(/blight/i);
  });

  it('renders one line per destroyed plot for pests', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [2, 4] })}
      />,
    );
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent('Plot #3 destroyed by pests.');
    expect(banner).toHaveTextContent('Plot #5 destroyed by pests.');
  });

  it('renders the flash drought banner', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'flash_drought' })} />);
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent(/flash drought/i);
    expect(banner).toHaveTextContent(/half speed/i);
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <DisasterBanner log={makeLog({ weatherId: 'blight' })} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/components/DisasterBanner.test.tsx`
Expected: FAIL with a module-not-found / `DisasterBanner is not exported` error.

- [ ] **Step 3: Write the component**

Create `src/components/DisasterBanner.tsx`:

```tsx
import type { DailyLogEntry } from '../engine/types';
import { WEATHER_DEFINITIONS } from '../engine/constants';
import { DISASTER_WEATHER_IDS } from './DailyLog';

interface DisasterBannerProps {
  log: DailyLogEntry;
  /** When true, play the drop-in/pulse animations (gated by the modal + reduced-motion). */
  animate?: boolean;
}

const DISASTER_ICON: Record<string, string> = {
  blight: '🍄',
  pest_infestation: '🐛',
  flash_drought: '☀️🔥',
};

/** Heading text per disaster type (the body lines come from `renderBody`). */
const DISASTER_TITLE: Record<string, string> = {
  blight: 'BLIGHT',
  pest_infestation: 'PEST INFESTATION',
  flash_drought: 'FLASH DROUGHT',
};

function bodyLines(log: DailyLogEntry): string[] {
  switch (log.weatherId) {
    case 'blight':
      return [WEATHER_DEFINITIONS.blight.description];
    case 'pest_infestation':
      return log.pestDestroyedPlots.map(id => `Plot #${id + 1} destroyed by pests.`);
    case 'flash_drought':
      return ['Crops planted in the next 2 days grow at half speed.'];
    default:
      return [];
  }
}

export function DisasterBanner({ log, animate = false }: DisasterBannerProps) {
  if (!DISASTER_WEATHER_IDS.has(log.weatherId)) return null;

  const icon = DISASTER_ICON[log.weatherId];
  const title = DISASTER_TITLE[log.weatherId];
  const lines = bodyLines(log);

  return (
    <div
      aria-label="Disaster"
      className={[
        'flex items-center gap-3 mt-2 px-3 py-3 rounded-lg',
        'bg-farm-red/40 border-2 border-farm-red',
        'shadow-[0_0_12px_rgba(200,40,40,0.4)]',
        animate ? 'disaster-banner-anim' : '',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={['text-2xl leading-none', animate ? 'disaster-icon-anim' : ''].join(' ')}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 text-xs text-farm-parchment">
        <span className="font-pixel tracking-widest text-farm-red">{title}</span>
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/components/DisasterBanner.test.tsx`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/DisasterBanner.tsx tests/components/DisasterBanner.test.tsx
git commit -m "feat(013): add unified DisasterBanner component"
```

---

## Task 4: Strip inline disaster lines from DailyLog + neutral weather badge

Remove the flash-drought announcement block and the pest-destroyed block from `DailyLog` (they now live in `DisasterBanner`). Add a `suppressDisasterStyling` prop so the weather badge renders neutrally while the modal's reveal is still pending. Keep the exhaustion block untouched.

**Files:**
- Modify: `src/components/DailyLog.tsx`
- Modify: `tests/components/DailyLog.test.tsx`

- [ ] **Step 1: Update the tests first (red)**

Add this describe block to `tests/components/DailyLog.test.tsx`:

```typescript
describe('DailyLog — disaster lines moved to DisasterBanner', () => {
  it('no longer renders the inline flash-drought line', () => {
    render(<DailyLog log={makeLog({ weatherId: 'flash_drought', flashDroughtDaysAfter: 2 })} />);
    expect(screen.queryByText(/grow at half speed/i)).toBeNull();
  });

  it('no longer renders the inline pest-destroyed lines', () => {
    render(<DailyLog log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [0, 1] })} />);
    expect(screen.queryByText(/destroyed by pests/i)).toBeNull();
  });

  it('still renders the exhaustion line', () => {
    render(<DailyLog log={makeLog({ exhaustedPlots: [3] })} />);
    expect(screen.getByText(/Plot #4 became exhausted/i)).toBeInTheDocument();
  });

  it('renders the weather badge neutrally when suppressDisasterStyling is set', () => {
    render(<DailyLog log={makeLog({ weatherId: 'blight' })} suppressDisasterStyling />);
    const badge = screen.getByText('Blight').closest('div')!;
    expect(badge.className).not.toMatch(/farm-red/);
  });

  it('renders the weather badge with alarm styling by default for disasters', () => {
    render(<DailyLog log={makeLog({ weatherId: 'blight' })} />);
    const badge = screen.getByText('Blight').closest('div')!;
    expect(badge.className).toMatch(/farm-red/);
  });
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/components/DailyLog.test.tsx`
Expected: FAIL — the inline-line tests fail (lines still rendered) and the `suppressDisasterStyling` prop is not yet accepted.

- [ ] **Step 3: Update DailyLog**

In `src/components/DailyLog.tsx`:

(a) Update the props interface and signature:

```tsx
interface DailyLogProps {
  log: DailyLogEntry;
  /** When true, the weather badge renders without disaster (red) styling — used while
      the Day Summary reveal is still pending so the disaster is not spoiled early. */
  suppressDisasterStyling?: boolean;
}
```

```tsx
export function DailyLog({ log, suppressDisasterStyling = false }: DailyLogProps) {
```

(b) Make the weather badge styling conditional. Replace the existing weather-badge `className` expression:

```tsx
        className={
          DISASTER_WEATHER_IDS.has(log.weatherId) && !suppressDisasterStyling
            ? 'flex items-center gap-1 px-2 py-1 rounded bg-farm-red/20 border border-farm-red/40'
            : 'flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/20'
        }
```

(c) Delete the "Flash Drought announcement" block (the `{log.weatherId === 'flash_drought' && (...)}` JSX) entirely.

(d) Delete the "Pest destroyed plots" block (the `{log.pestDestroyedPlots.length > 0 && (...)}` JSX) entirely.

(e) Leave the exhaustion block, streak rows, market lines, and accounting rows unchanged.

- [ ] **Step 4: Run the DailyLog tests**

Run: `npx vitest run tests/components/DailyLog.test.tsx`
Expected: PASS (existing tests + the 5 new ones; axe test still green).

- [ ] **Step 5: Commit**

```bash
git add src/components/DailyLog.tsx tests/components/DailyLog.test.tsx
git commit -m "feat(013): move inline disaster lines out of DailyLog; neutral badge option"
```

---

## Task 5: Staging in DaySummaryModal

`DaySummaryModal` gains an `animateReveal` prop and a `revealed` state. On a fresh disaster-day open with motion allowed, it starts hidden, renders the body with `suppressDisasterStyling`, then after ~700ms reveals the red background, the "Disaster!" badge, and the `DisasterBanner`. On reopen (`animateReveal=false`) or reduced motion, it starts revealed with no animation.

**Files:**
- Modify: `src/components/DaySummaryModal.tsx`
- Test: `tests/components/DaySummaryModal.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/DaySummaryModal.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DaySummaryModal } from '../../src/components/DaySummaryModal';
import type { DailyLogEntry } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 14,
    weatherId: 'blight',
    weatherMultiplier: 0.1,
    harvests: [],
    totalHarvestIncome: 0,
    openingBalance: 100,
    landLeaseDeducted: 15,
    taxRate: 0.05,
    taxDeducted: 4,
    netChange: -19,
    closingBalance: 81,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 0,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    ...over,
  };
}

describe('DaySummaryModal — staged disaster reveal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the disaster banner + badge until the beat fires (animateReveal=true)', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal />);

    // Before the timer: no disaster banner, no "Disaster!" badge.
    expect(screen.queryByLabelText(/^disaster$/i)).toBeNull();
    expect(screen.queryByText(/^Disaster!$/i)).toBeNull();

    // After the beat: both appear.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByLabelText(/^disaster$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Disaster!$/i)).toBeInTheDocument();
  });

  it('shows the disaster banner immediately on reopen (animateReveal=false)', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal={false} />);
    expect(screen.getByLabelText(/^disaster$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Disaster!$/i)).toBeInTheDocument();
  });

  it('does not stage on a non-disaster day', () => {
    render(
      <DaySummaryModal
        log={makeLog({ weatherId: 'sunny', weatherMultiplier: 1 })}
        onClose={() => {}}
        animateReveal
      />,
    );
    // No banner ever, before or after any timer.
    expect(screen.queryByLabelText(/^disaster$/i)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByLabelText(/^disaster$/i)).toBeNull();
  });
});

describe('DaySummaryModal — reduced motion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = (query: string) =>
      ({
        matches: true, // prefers reduced motion
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  });
  afterEach(() => {
    vi.useRealTimers();
    // restore the default no-preference stub
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  });

  it('reveals immediately when reduced motion is preferred', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal />);
    expect(screen.getByLabelText(/^disaster$/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/DaySummaryModal.test.tsx`
Expected: FAIL — `animateReveal` prop is not accepted and there is no `DisasterBanner` in the modal.

- [ ] **Step 3: Rewrite DaySummaryModal**

Replace the full contents of `src/components/DaySummaryModal.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { DailyLogEntry } from '../engine/types';
import { DailyLog, DISASTER_WEATHER_IDS } from './DailyLog';
import { DisasterBanner } from './DisasterBanner';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface DaySummaryModalProps {
  log: DailyLogEntry;
  onClose: () => void;
  /** True on the auto-open after advancing a day (plays the staged reveal);
      false when reopened via "Last Turn" (show the resolved state at once). */
  animateReveal?: boolean;
}

const REVEAL_DELAY_MS = 700;

export function DaySummaryModal({ log, onClose, animateReveal = true }: DaySummaryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  const isDisaster = DISASTER_WEATHER_IDS.has(log.weatherId);
  const isQuietDay = log.harvests.length === 0 && log.totalHarvestIncome === 0;

  // Stage the reveal only on a fresh disaster open with motion allowed.
  const shouldStage = isDisaster && animateReveal && !reducedMotion;
  const [revealed, setRevealed] = useState(!shouldStage);

  useEffect(() => {
    if (!shouldStage) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [shouldStage]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Disaster chrome (red bg + badge + banner) is shown once revealed.
  const showDisasterChrome = isDisaster && revealed;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={[
          'rounded-2xl p-4 max-w-sm w-full mx-4 shadow-xl max-h-[80vh] flex flex-col',
          'transition-colors duration-500',
          showDisasterChrome ? 'bg-[#2A0A0A]' : 'bg-farm-soil',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain flex-1">
          {showDisasterChrome && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-farm-red/20 border border-farm-red/50 mb-2">
              <span className="text-xl" aria-hidden="true">⚠️</span>
              <span className="font-pixel text-xs text-farm-red uppercase tracking-widest">Disaster!</span>
            </div>
          )}
          {isQuietDay && (
            <p className="font-pixel text-xs text-farm-stone text-center py-2 mb-1">
              Quiet day — no harvests.
            </p>
          )}

          <DailyLog log={log} suppressDisasterStyling={isDisaster && !revealed} />

          {showDisasterChrome && (
            <DisasterBanner log={log} animate={animateReveal && !reducedMotion} />
          )}
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close day summary"
          onClick={onClose}
          className="
            mt-4 w-full py-3 rounded-xl
            font-pixel text-sm
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:scale-95 transition-all
          "
        >
          Continue →
        </button>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 4: Run the modal tests**

Run: `npx vitest run tests/components/DaySummaryModal.test.tsx`
Expected: PASS (all 4 tests across both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/components/DaySummaryModal.tsx tests/components/DaySummaryModal.test.tsx
git commit -m "feat(013): staged dread-then-hit reveal in DaySummaryModal"
```

---

## Task 6: Wire animateReveal in GameBoard

`GameBoard` must pass `animateReveal={true}` on the auto-open after advancing a day, and `animateReveal={false}` when reopening via "Last Turn". Track this with a small piece of state set alongside `setIsSummaryOpen`.

**Files:**
- Modify: `src/components/GameBoard.tsx`
- Test: `tests/components/GameBoard.test.tsx` (extend only if it already exercises the modal; otherwise the modal-level tests in Task 5 cover the prop behavior — see Step 1).

- [ ] **Step 1: Check whether GameBoard tests open the modal**

Run: `grep -n "DaySummaryModal\|Last Turn\|day summary\|animateReveal" tests/components/GameBoard.test.tsx`
Expected: note whether existing tests assert on the modal. If they do, keep them green; if they don't, no new GameBoard test is required (modal staging is fully covered in Task 5). Do not invent a brittle timing test here.

- [ ] **Step 2: Add reveal-mode state**

In `src/components/GameBoard.tsx`, next to the existing `isSummaryOpen` state (around line 53), add:

```tsx
  const [summaryAnimate, setSummaryAnimate] = useState(false);
```

- [ ] **Step 3: Set animate=true on auto-open**

In the effect that opens the modal after `onNextDay` (around lines 60–67), set the flag true right before opening:

```tsx
  useEffect(() => {
    if (awaitingModalRef.current && lastDailyLog !== null) {
      awaitingModalRef.current = false;
      setDaySummary(lastDailyLog);
      setSummaryAnimate(true);
      setIsSummaryOpen(true);
      setIsProcessing(false);
    }
  }, [lastDailyLog]);
```

- [ ] **Step 4: Set animate=false on "Last Turn" reopen**

Update the `onLastTurn` handler (around line 110):

```tsx
        onLastTurn={() => {
          setSummaryAnimate(false);
          setIsSummaryOpen(true);
        }}
```

- [ ] **Step 5: Pass the prop to the modal**

Update the `DaySummaryModal` render (around lines 200–205):

```tsx
      {isSummaryOpen && daySummary !== null && (
        <DaySummaryModal
          log={daySummary}
          animateReveal={summaryAnimate}
          onClose={() => setIsSummaryOpen(false)}
        />
      )}
```

- [ ] **Step 6: Run the GameBoard tests + full suite**

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 7: Commit**

```bash
git add src/components/GameBoard.tsx
git commit -m "feat(013): wire animateReveal (fresh vs Last Turn reopen) in GameBoard"
```

---

## Task 7: Disaster keyframes in App.css

Add the drop-in, pulse, and icon-wobble keyframes used by `DisasterBanner`. Wrap the `animation` declarations in the existing `@media (prefers-reduced-motion: no-preference)` block so motion only plays when allowed — belt-and-suspenders with the JS hook.

**Files:**
- Modify: `src/App.css`

- [ ] **Step 1: Add the keyframes and reduced-motion-gated rules**

Append to `src/App.css`:

```css
/* 013 — Disaster reveal juice (F2). Unified disaster banner motion. */
@keyframes disaster-dropin {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes disaster-pulse {
  0%,
  100% {
    box-shadow: 0 0 8px rgba(200, 40, 40, 0.3);
  }
  50% {
    box-shadow: 0 0 18px rgba(200, 40, 40, 0.65);
  }
}

@keyframes disaster-icon-creep {
  0%,
  100% {
    transform: rotate(-6deg);
  }
  50% {
    transform: rotate(6deg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .disaster-banner-anim {
    animation:
      disaster-dropin 0.5s ease-out,
      disaster-pulse 1.8s ease-in-out infinite;
  }
  .disaster-icon-anim {
    animation: disaster-icon-creep 2.2s ease-in-out infinite;
  }
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.css
git commit -m "feat(013): disaster banner keyframes (reduced-motion gated)"
```

---

## Task 8: Manual verification + full gate

Confirm the whole suite is green and visually sanity-check the reveal in the running app.

**Files:** none (verification only).

- [ ] **Step 1: Full test + lint gate**

Run: `npm test && npm run lint`
Expected: PASS, no failures, no lint errors.

- [ ] **Step 2: Manual smoke check (browser preview)**

Start the dev server (`npm run dev` or the preview tooling) and:
- Advance days until a disaster (blight / pest / flash drought) occurs.
- Confirm the modal opens neutral, then after ~0.7s tints red and the unified banner drops in.
- Click "Last Turn" to reopen — confirm the resolved state shows immediately with no animation.
- Confirm a normal (non-disaster) day shows no banner and no red transition.
- (Optional) Toggle OS "reduce motion" and confirm the banner appears immediately without animation.

- [ ] **Step 3: Final commit (only if any tweak was needed)**

```bash
git add -A
git commit -m "chore(013): disaster reveal juice polish"
```

---

## Self-Review Notes

- **Spec coverage:** Staged reveal (Tasks 5–6), unified banner (Task 3), exhaustion untouched (Task 4 step 1 test), reduced-motion (Tasks 1, 2, 5, 7), reopen path (Task 6), no engine/schema change (no engine files touched). All covered.
- **Type consistency:** `DisasterBanner` prop is `{ log, animate }`; `DailyLog` gains `suppressDisasterStyling`; `DaySummaryModal` gains `animateReveal`; `GameBoard` state `summaryAnimate` drives it. Names consistent across tasks.
- **No placeholders:** every code step shows full code; commands have expected output.
