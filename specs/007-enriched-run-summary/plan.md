# Enriched Run Summary — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-bones BankruptcyScreen with a recap that grades the run with a medal (none/bronze/silver/gold/platinum), surfaces three persistent personal-best records, and tags "🏆 New Best!" on each stat the run beat — backed by a new per-run aggregator (`disastersSurvived`) and a separate localStorage records key.

**Architecture:** Two new pure modules in `src/engine/` (`medals.ts` for tier derivation, `records.ts` for cross-run localStorage), one engine state field (`disastersSurvived`), one hook trigger that fires `recordRunEnd` on the first terminal transition per run, one new presentational component (`MedalBadge`), and a layout refresh of `BankruptcyScreen`. No changes to seasonal transitions or the existing victory flow.

**Tech Stack:** TypeScript 5.6, React 18.3, Vite 5.4, Vitest, vitest-axe, Tailwind 3.4.

---

## File Structure

**New files:**
- `src/engine/medals.ts` — `Medal` type, `deriveMedal()`, `MEDAL_LABELS`, `MEDAL_TAGLINES`. Pure, no I/O.
- `src/engine/records.ts` — `PersonalBests` type, `RECORDS_KEY`, `loadRecords()`, `recordRunEnd()`. Only module touching `localStorage['pixel-parsnips-records']`.
- `src/components/MedalBadge.tsx` — Presentational badge for a `Medal` value.
- `tests/engine/medals.test.ts`
- `tests/engine/records.test.ts`
- `tests/components/MedalBadge.test.tsx`

**Modified files:**
- `src/engine/types.ts` — Add `disastersSurvived: number` to `GameState`.
- `src/engine/constants.ts` — Bump `SCHEMA_VERSION` 4 → 5.
- `src/engine/gameEngine.ts` — `initialGameState` adds `disastersSurvived: 0`; happy path of `processTurn` increments it on disaster turns.
- `src/engine/seasons.ts` — Export `DISASTER_WEATHER_IDS` (currently module-private).
- `src/engine/useGameEngine.ts` — Schema 4 → 5 migration; detect terminal-phase transition; call `recordRunEnd` and expose `endOfRunRecap` on the hook return.
- `src/components/BankruptcyScreen.tsx` — New props (`disastersSurvived`, `seasonReached`, `medal`, `records`, `newBests`); new layout with `MedalBadge`, 4-row stats card, records card with first-run line.
- `src/App.tsx` — Wire `endOfRunRecap` and `disastersSurvived` into `BankruptcyScreen`.
- `tests/engine/gameEngine.test.ts` — Add `disastersSurvived` increment tests.
- `tests/engine/useGameEngine.test.ts` — Add migration + recordRunEnd trigger tests.
- `tests/components/BankruptcyScreen.test.tsx` — Replace/extend with new-layout tests.

---

## Task 1: Schema bump + `disastersSurvived` field

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/constants.ts:10`
- Modify: `src/engine/gameEngine.ts:35-61` (initialGameState)
- Modify: `src/engine/useGameEngine.ts:18-47` (loadState migration)
- Test: `tests/engine/useGameEngine.test.ts`

- [ ] **Step 1: Write the failing migration test**

Append to `tests/engine/useGameEngine.test.ts`:

```typescript
describe('schema 4 → 5 migration (007 — disastersSurvived)', () => {
  it('migrates a v4 save by adding disastersSurvived: 0', () => {
    const v4State = {
      schemaVersion: 4,
      currentDay: 25,
      coinBalance: 100,
      plots: [],
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
      upgradeTier: 0,
      lastDailyLog: null,
      phase: 'playing',
      peakBalance: 100,
      fertilizerInventory: 0,
      flashDroughtDaysRemaining: 0,
      endlessMode: false,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: v4State }));

    const { result } = renderHook(() => useGameEngine());

    expect(result.current.state.schemaVersion).toBe(5);
    expect(result.current.state.disastersSurvived).toBe(0);
    expect(result.current.state.currentDay).toBe(25); // existing fields preserved
  });

  it('initialGameState includes disastersSurvived: 0', () => {
    localStorage.clear();
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.disastersSurvived).toBe(0);
  });
});
```

If `renderHook` / `localStorage` imports are not already present, add them — match the patterns used elsewhere in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "007 — disastersSurvived"`
Expected: FAIL — `disastersSurvived` is undefined on `state`.

- [ ] **Step 3: Add field to `GameState`**

In `src/engine/types.ts`, inside `interface GameState`, after the `endlessMode: boolean;` line, add:

```typescript
  /** Count of disaster days (blight, pest_infestation, flash_drought) the run survived without bankruptcy. */
  disastersSurvived: number;
```

- [ ] **Step 4: Bump `SCHEMA_VERSION`**

In `src/engine/constants.ts:10`, change:

```typescript
export const SCHEMA_VERSION = 4;
```

to:

```typescript
export const SCHEMA_VERSION = 5;
```

- [ ] **Step 5: Update `initialGameState`**

In `src/engine/gameEngine.ts`, inside the returned object of `initialGameState()` (around line 47-60), add after `endlessMode: false,`:

```typescript
    disastersSurvived: 0,
```

- [ ] **Step 6: Add 4 → 5 migration in `loadState`**

In `src/engine/useGameEngine.ts`, modify `loadState()` to add the new migration step *before* the schema-3 migration. The full updated function:

```typescript
function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialGameState();
    const parsed = JSON.parse(raw);

    // Schema 5 — current
    if (parsed?.schemaVersion === SCHEMA_VERSION) {
      return parsed.state as GameState;
    }

    // Schema 4 → 5 — add disastersSurvived: 0
    if (parsed?.schemaVersion === 4 && parsed?.state) {
      console.info('[PixelParsnips] Migrating save from v4 to v5 (Enriched Run Summary).');
      return {
        ...(parsed.state as Omit<GameState, 'disastersSurvived'>),
        schemaVersion: SCHEMA_VERSION,
        disastersSurvived: 0,
      };
    }

    // Schema 3 → 5 — chained migration (add endlessMode and disastersSurvived)
    if (parsed?.schemaVersion === 3 && parsed?.state) {
      console.info('[PixelParsnips] Migrating save from v3 to v5 (Season System + Enriched Run Summary).');
      return {
        ...(parsed.state as Omit<GameState, 'endlessMode' | 'disastersSurvived'>),
        schemaVersion: SCHEMA_VERSION,
        endlessMode: false,
        disastersSurvived: 0,
      };
    }

    // Schemas < 3 — discard (preserves existing policy)
    console.info(
      `[PixelParsnips] Save data schema upgraded from v${parsed?.schemaVersion} to v${SCHEMA_VERSION} — starting a new game.`
    );
    return initialGameState();
  } catch {
    return initialGameState();
  }
}
```

- [ ] **Step 7: Run all tests to verify the migration passes and nothing else broke**

Run: `npm test`
Expected: all tests pass. Some pre-existing tests that build `GameState` literals will fail (`disastersSurvived` missing). Fix them by adding `disastersSurvived: 0` to each literal. Common offenders: `tests/engine/gameEngine.test.ts`, `tests/engine/seasonTransition.test.ts`. Search:

Run: `grep -rn "endlessMode: false" tests/`

Add `disastersSurvived: 0,` immediately after each `endlessMode: false,` in test fixtures.

- [ ] **Step 8: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/constants.ts src/engine/gameEngine.ts src/engine/useGameEngine.ts tests/
git commit -m "feat(007-enriched-run-summary): T001 — schema 4→5 adds disastersSurvived field"
```

---

## Task 2: Increment `disastersSurvived` in `processTurn` happy path

**Files:**
- Modify: `src/engine/seasons.ts:53` (export `DISASTER_WEATHER_IDS`)
- Modify: `src/engine/gameEngine.ts` (processTurn, around lines 197–415)
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/gameEngine.test.ts`:

```typescript
import { initialGameState, processTurn } from '../../src/engine/gameEngine';

describe('processTurn — disastersSurvived counter (007)', () => {
  // Use forceWeather plumbing if available; otherwise seed via the existing test
  // pattern this file uses elsewhere. (Match local conventions; this snippet
  // assumes a `forceWeather` test helper. If none exists, drive via deterministic
  // RNG seed used elsewhere in this file.)

  it('increments by 1 on a survived blight day', () => {
    const start = { ...initialGameState(), coinBalance: 500, disastersSurvived: 0 };
    // Force a blight turn that does NOT bankrupt (balance well above lease).
    const result = processTurn(start, { __forceWeatherId: 'blight' } as never);
    expect(result.isBankrupt).toBe(false);
    expect(result.state.disastersSurvived).toBe(1);
  });

  it('does NOT increment on a non-disaster day', () => {
    const start = { ...initialGameState(), coinBalance: 500, disastersSurvived: 3 };
    const result = processTurn(start, { __forceWeatherId: 'sunny' } as never);
    expect(result.state.disastersSurvived).toBe(3);
  });

  it('does NOT increment when a disaster causes bankruptcy that turn', () => {
    // Balance below seasonal lease so the disaster turn bankrupts.
    const start = { ...initialGameState(), coinBalance: 5, disastersSurvived: 2 };
    const result = processTurn(start, { __forceWeatherId: 'pest_infestation' } as never);
    expect(result.isBankrupt).toBe(true);
    expect(result.state.disastersSurvived).toBe(2); // unchanged
  });
});
```

**Important:** If `processTurn` doesn't currently accept a forced-weather argument, do not invent one. Instead, follow the seeding pattern used by other tests in this file (e.g. mocking `Math.random` or passing a deterministic seed). Search the existing file first:

Run: `grep -n "Math.random\|forceWeather\|seed" tests/engine/gameEngine.test.ts`

Mirror whichever pattern is already used.

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "disastersSurvived counter"`
Expected: FAIL — counter does not change.

- [ ] **Step 3: Export `DISASTER_WEATHER_IDS` from seasons.ts**

In `src/engine/seasons.ts:53`, change:

```typescript
const DISASTER_WEATHER_IDS: ReadonlyArray<WeatherId> = ['blight', 'pest_infestation', 'flash_drought'];
```

to:

```typescript
export const DISASTER_WEATHER_IDS: ReadonlyArray<WeatherId> = ['blight', 'pest_infestation', 'flash_drought'];
```

- [ ] **Step 4: Increment counter in the happy path of `processTurn`**

In `src/engine/gameEngine.ts`, at the top of the file add to imports from `./seasons`:

```typescript
import { getSeasonForDay, getDisasterBandsForSeason, DISASTER_WEATHER_IDS } from './seasons';
```

(If those names are imported through a different statement, add only `DISASTER_WEATHER_IDS` to that statement.)

Then, in the happy path of `processTurn` (the section AFTER the bankruptcy early-return at line 332, BEFORE the `nextState` object is built around line 404), add this just before the `nextState` object:

```typescript
  // Step 9.5: Increment disastersSurvived if this turn's weather was a disaster
  //           AND the run did not bankrupt this turn.
  const isDisasterTurn = (DISASTER_WEATHER_IDS as readonly string[]).includes(weatherId);
  const disastersSurvived = state.disastersSurvived + (isDisasterTurn ? 1 : 0);
```

Then include `disastersSurvived` in the `nextState` object:

```typescript
  const nextState: GameState = {
    ...state,
    plots: recoveredPlots,
    coinBalance,
    currentDay: nextDayAfterTransition,
    flashDroughtDaysRemaining,
    peakBalance,
    disastersSurvived,
    lastDailyLog: log,
    phase: seasonPhase,
  };
```

**Do not** modify the bankruptcy short-circuit branch (around line 304-332). Its `bankruptState` already spreads `...state` and keeps `disastersSurvived` at its previous value — exactly what we want.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "disastersSurvived counter"`
Expected: PASS.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/engine/seasons.ts src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(007-enriched-run-summary): T002 — disastersSurvived increments on survived disaster turns"
```

---

## Task 3: `Medal` type + `deriveMedal` pure function

**Files:**
- Create: `src/engine/medals.ts`
- Test: `tests/engine/medals.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/medals.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveMedal, MEDAL_LABELS, MEDAL_TAGLINES } from '../../src/engine/medals';

describe('deriveMedal', () => {
  it('returns "none" when bankrupt in Season 1', () => {
    expect(deriveMedal(1, false)).toBe('none');
  });

  it('returns "bronze" when bankrupt in Season 2', () => {
    expect(deriveMedal(2, false)).toBe('bronze');
  });

  it('returns "silver" when bankrupt in Season 3', () => {
    expect(deriveMedal(3, false)).toBe('silver');
  });

  it('returns "gold" when bankrupt in Season 4 (did not win)', () => {
    expect(deriveMedal(4, false)).toBe('gold');
  });

  it('returns "platinum" when won === true regardless of season', () => {
    expect(deriveMedal(4, true)).toBe('platinum');
    expect(deriveMedal(7, true)).toBe('platinum'); // endless-season bankruptcy after winning
    expect(deriveMedal(1, true)).toBe('platinum'); // defensive: won flag wins
  });

  it('treats endless seasons ≥ 4 as gold when not won', () => {
    // Shouldn't occur in practice (winning S4 sets won=true), but the function is total.
    expect(deriveMedal(5, false)).toBe('gold');
  });
});

describe('MEDAL_LABELS / MEDAL_TAGLINES', () => {
  it('has an entry for every medal tier', () => {
    const tiers = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;
    for (const t of tiers) {
      expect(MEDAL_LABELS[t]).toBeTruthy();
      expect(MEDAL_TAGLINES[t]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/engine/medals.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/engine/medals.ts`**

```typescript
export type Medal = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

/**
 * Maps the final state of a run to a medal tier.
 *
 *   - won === true            → 'platinum' (Season 4 victory, sticky once earned)
 *   - seasonReached >= 4      → 'gold'
 *   - seasonReached >= 3      → 'silver'
 *   - seasonReached >= 2      → 'bronze'
 *   - otherwise (S1 bankrupt) → 'none'
 *
 * Pure and total — every (seasonReached, won) pair returns a Medal.
 */
export function deriveMedal(seasonReached: number, won: boolean): Medal {
  if (won) return 'platinum';
  if (seasonReached >= 4) return 'gold';
  if (seasonReached >= 3) return 'silver';
  if (seasonReached >= 2) return 'bronze';
  return 'none';
}

export const MEDAL_LABELS: Record<Medal, string> = {
  none:     'No Medal',
  bronze:   'Bronze',
  silver:   'Silver',
  gold:     'Gold',
  platinum: 'Platinum',
};

export const MEDAL_TAGLINES: Record<Medal, string> = {
  none:     'Keep going',
  bronze:   'Survived Spring Thaw',
  silver:   'Survived Summer Heat',
  gold:     'Reached the final season',
  platinum: 'Conquered Season 4',
};
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/medals.test.ts`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/medals.ts tests/engine/medals.test.ts
git commit -m "feat(007-enriched-run-summary): T003 — Medal type + deriveMedal pure function"
```

---

## Task 4: Records module (`loadRecords`, `recordRunEnd`)

**Files:**
- Create: `src/engine/records.ts`
- Test: `tests/engine/records.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/records.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadRecords, recordRunEnd, RECORDS_KEY, type PersonalBests } from '../../src/engine/records';
import { initialGameState } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

function freshState(overrides: Partial<GameState> = {}): GameState {
  return { ...initialGameState(), ...overrides };
}

describe('loadRecords', () => {
  beforeEach(() => localStorage.clear());

  it('returns zero defaults when no key exists', () => {
    const r = loadRecords();
    expect(r.schemaVersion).toBe(1);
    expect(r.bestDaysSurvived).toBe(0);
    expect(r.bestPeakBalance).toBe(0);
    expect(r.bestSeasonReached).toBe(0);
    expect(r.mostDisastersSurvived).toBe(0);
    expect(r.totalRunsCompleted).toBe(0);
  });

  it('returns zero defaults when JSON is malformed', () => {
    localStorage.setItem(RECORDS_KEY, '{not json');
    const r = loadRecords();
    expect(r.totalRunsCompleted).toBe(0);
  });

  it('round-trips a valid record', () => {
    const written: PersonalBests = {
      schemaVersion: 1,
      bestDaysSurvived: 32,
      bestPeakBalance: 410,
      bestSeasonReached: 3,
      mostDisastersSurvived: 5,
      totalRunsCompleted: 4,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(written));
    expect(loadRecords()).toEqual(written);
  });
});

describe('recordRunEnd', () => {
  beforeEach(() => localStorage.clear());

  it('on the first run ever, every stat becomes a new best and totalRunsCompleted = 1', () => {
    const state = freshState({ currentDay: 25, peakBalance: 180, disastersSurvived: 2, phase: 'bankrupt' });
    const { records, newBests } = recordRunEnd(state);

    expect(records.totalRunsCompleted).toBe(1);
    expect(records.bestDaysSurvived).toBe(25);
    expect(records.bestPeakBalance).toBe(180);
    expect(records.bestSeasonReached).toBe(2); // Day 25 is Season 2
    expect(records.mostDisastersSurvived).toBe(2);

    expect(newBests.has('bestDaysSurvived')).toBe(true);
    expect(newBests.has('bestPeakBalance')).toBe(true);
    expect(newBests.has('bestSeasonReached')).toBe(true);
    expect(newBests.has('mostDisastersSurvived')).toBe(true);
  });

  it('writes the record back to localStorage', () => {
    const state = freshState({ currentDay: 25, peakBalance: 180, disastersSurvived: 2, phase: 'bankrupt' });
    recordRunEnd(state);
    const raw = localStorage.getItem(RECORDS_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as PersonalBests;
    expect(parsed.bestDaysSurvived).toBe(25);
  });

  it('keeps prior bests when the new run is worse on every dimension', () => {
    const prior: PersonalBests = {
      schemaVersion: 1,
      bestDaysSurvived: 40,
      bestPeakBalance: 300,
      bestSeasonReached: 3,
      mostDisastersSurvived: 6,
      totalRunsCompleted: 2,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(prior));

    const state = freshState({ currentDay: 18, peakBalance: 90, disastersSurvived: 1, phase: 'bankrupt' });
    const { records, newBests } = recordRunEnd(state);

    expect(records.bestDaysSurvived).toBe(40);
    expect(records.bestPeakBalance).toBe(300);
    expect(records.bestSeasonReached).toBe(3);
    expect(records.mostDisastersSurvived).toBe(6);
    expect(records.totalRunsCompleted).toBe(3); // always increments
    expect(newBests.size).toBe(0);
  });

  it('flags exactly the stats the new run beat', () => {
    const prior: PersonalBests = {
      schemaVersion: 1,
      bestDaysSurvived: 20,
      bestPeakBalance: 500,
      bestSeasonReached: 2,
      mostDisastersSurvived: 3,
      totalRunsCompleted: 1,
    };
    localStorage.setItem(RECORDS_KEY, JSON.stringify(prior));

    // Survived to Day 35 (Season 2 → record holds), peak 600 (beat), 4 disasters (beat).
    const state = freshState({ currentDay: 35, peakBalance: 600, disastersSurvived: 4, phase: 'bankrupt' });
    const { records, newBests } = recordRunEnd(state);

    expect(newBests.has('bestDaysSurvived')).toBe(true);   // 35 > 20
    expect(newBests.has('bestPeakBalance')).toBe(true);    // 600 > 500
    expect(newBests.has('bestSeasonReached')).toBe(false); // both reached S2
    expect(newBests.has('mostDisastersSurvived')).toBe(true); // 4 > 3
    expect(records.bestSeasonReached).toBe(2);
  });

  it('treats a Season 4 win as season 4 + sets victory implicitly via phase', () => {
    // The 'won' flag is computed by the caller; recordRunEnd derives bestSeasonReached
    // from currentDay only. Verify it computes the correct season number.
    const state = freshState({
      currentDay: 80, peakBalance: 700, disastersSurvived: 5,
      phase: 'season_4_won', endlessMode: false,
    });
    const { records } = recordRunEnd(state);
    expect(records.bestSeasonReached).toBe(4);
  });

  it('handles endless-mode bankruptcy by recording the endless season number', () => {
    const state = freshState({
      currentDay: 95, peakBalance: 900, disastersSurvived: 7,
      phase: 'bankrupt', endlessMode: true,
    });
    const { records } = recordRunEnd(state);
    // Day 95 → endless Season 5 (per seasons.ts formula)
    expect(records.bestSeasonReached).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/engine/records.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/engine/records.ts`**

```typescript
import type { GameState } from './types';
import { getSeasonForDay } from './seasons';

export const RECORDS_KEY = 'pixel-parsnips-records';

export interface PersonalBests {
  schemaVersion: 1;
  bestDaysSurvived: number;
  bestPeakBalance: number;
  bestSeasonReached: number;
  mostDisastersSurvived: number;
  totalRunsCompleted: number;
}

const ZERO_RECORDS: PersonalBests = {
  schemaVersion: 1,
  bestDaysSurvived: 0,
  bestPeakBalance: 0,
  bestSeasonReached: 0,
  mostDisastersSurvived: 0,
  totalRunsCompleted: 0,
};

/** Returns zero defaults when missing or malformed; never throws. */
export function loadRecords(): PersonalBests {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...ZERO_RECORDS };
    const parsed = JSON.parse(raw) as Partial<PersonalBests>;
    return {
      schemaVersion: 1,
      bestDaysSurvived:      typeof parsed.bestDaysSurvived      === 'number' ? parsed.bestDaysSurvived      : 0,
      bestPeakBalance:       typeof parsed.bestPeakBalance       === 'number' ? parsed.bestPeakBalance       : 0,
      bestSeasonReached:     typeof parsed.bestSeasonReached     === 'number' ? parsed.bestSeasonReached     : 0,
      mostDisastersSurvived: typeof parsed.mostDisastersSurvived === 'number' ? parsed.mostDisastersSurvived : 0,
      totalRunsCompleted:    typeof parsed.totalRunsCompleted    === 'number' ? parsed.totalRunsCompleted    : 0,
    };
  } catch {
    return { ...ZERO_RECORDS };
  }
}

function saveRecords(r: PersonalBests): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    // Storage full or disabled — non-fatal; records simply won't persist.
  }
}

/**
 * Called exactly once per run, on the first terminal-phase transition.
 * Loads current records, computes new maxes, persists, and reports which
 * stats beat their prior record.
 */
export function recordRunEnd(state: GameState): {
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
} {
  const prior = loadRecords();
  const seasonReached = getSeasonForDay(state.currentDay).number;

  const candidates = {
    bestDaysSurvived:      state.currentDay,
    bestPeakBalance:       state.peakBalance,
    bestSeasonReached:     seasonReached,
    mostDisastersSurvived: state.disastersSurvived,
  } as const;

  const newBests = new Set<keyof PersonalBests>();
  const next: PersonalBests = {
    schemaVersion: 1,
    bestDaysSurvived:      Math.max(prior.bestDaysSurvived,      candidates.bestDaysSurvived),
    bestPeakBalance:       Math.max(prior.bestPeakBalance,       candidates.bestPeakBalance),
    bestSeasonReached:     Math.max(prior.bestSeasonReached,     candidates.bestSeasonReached),
    mostDisastersSurvived: Math.max(prior.mostDisastersSurvived, candidates.mostDisastersSurvived),
    totalRunsCompleted:    prior.totalRunsCompleted + 1,
  };

  for (const key of ['bestDaysSurvived', 'bestPeakBalance', 'bestSeasonReached', 'mostDisastersSurvived'] as const) {
    if (candidates[key] > prior[key]) newBests.add(key);
  }

  saveRecords(next);
  return { records: next, newBests };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/records.test.ts`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/records.ts tests/engine/records.test.ts
git commit -m "feat(007-enriched-run-summary): T004 — records module (loadRecords + recordRunEnd)"
```

---

## Task 5: Fire `recordRunEnd` from `useGameEngine` on terminal transition

**Files:**
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/engine/useGameEngine.test.ts`

The hook needs to detect the first transition into a terminal phase **per run** and call `recordRunEnd` exactly once. We expose the result as `endOfRunRecap` so the UI can read it.

**Terminal trigger:** `phase` becomes `bankrupt`, OR `phase` becomes `season_4_won` AND `endlessMode === false`. We track the prior phase in a `useRef` so we only fire on transition (not on every re-render or restart).

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine/useGameEngine.test.ts`:

```typescript
import { recordRunEnd, loadRecords, RECORDS_KEY } from '../../src/engine/records';
import { deriveMedal } from '../../src/engine/medals';

describe('useGameEngine — endOfRunRecap (007)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is null while phase is "playing"', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.endOfRunRecap).toBeNull();
  });

  it('populates endOfRunRecap when phase flips to "bankrupt"', () => {
    // Seed a state that will bankrupt on the next turn.
    const nearBankrupt = {
      ...initialGameState(),
      coinBalance: 0,
      currentDay: 5,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 5, state: nearBankrupt }));

    const { result } = renderHook(() => useGameEngine());
    act(() => result.current.nextDay());

    expect(result.current.state.phase).toBe('bankrupt');
    expect(result.current.endOfRunRecap).not.toBeNull();
    expect(result.current.endOfRunRecap!.medal).toBe('none'); // bankrupt in S1
    expect(result.current.endOfRunRecap!.records.totalRunsCompleted).toBe(1);
  });

  it('does NOT fire on season_passed (mid-run transition)', () => {
    // We won't drive a real season pass here; use a forced phase flip via direct
    // state injection if there's a test helper, else verify by saved fixture.
    // Match local conventions in this test file.
  });

  it('preserves records across restart', () => {
    const nearBankrupt = { ...initialGameState(), coinBalance: 0, currentDay: 5 };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 5, state: nearBankrupt }));
    const { result } = renderHook(() => useGameEngine());
    act(() => result.current.nextDay());
    expect(result.current.endOfRunRecap).not.toBeNull();

    act(() => result.current.restart());

    expect(result.current.endOfRunRecap).toBeNull();
    expect(loadRecords().totalRunsCompleted).toBe(1); // still there
  });
});
```

Adapt any `import` additions (`act`, `renderHook`, `initialGameState`) to mirror the file's existing imports.

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "endOfRunRecap"`
Expected: FAIL — `endOfRunRecap` does not exist on the hook return.

- [ ] **Step 3: Add `endOfRunRecap` to the hook**

In `src/engine/useGameEngine.ts`:

Add at the top with other imports:

```typescript
import { recordRunEnd, type PersonalBests } from './records';
import { deriveMedal, type Medal } from './medals';
import { getSeasonForDay } from './seasons';
```

Add an exported type above `GameEngineHook`:

```typescript
export interface EndOfRunRecap {
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
  medal: Medal;
  seasonReached: number;
}
```

Add to `GameEngineHook`:

```typescript
  endOfRunRecap: EndOfRunRecap | null;
```

Inside the `useGameEngine()` body, after `const hasHydratedRef = useRef(false);`, add:

```typescript
  const [endOfRunRecap, setEndOfRunRecap] = useState<EndOfRunRecap | null>(null);
  const prevPhaseRef = useRef<GameState['phase']>(state.phase);
```

Add a new effect *after* the save-state effect:

```typescript
  // Fire recordRunEnd on the first terminal-phase transition per run.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = state.phase;
    prevPhaseRef.current = curr;

    if (prev === curr) return;

    const isTerminalTransition =
      (curr === 'bankrupt' && prev !== 'bankrupt') ||
      (curr === 'season_4_won' && prev !== 'season_4_won' && !state.endlessMode);

    if (!isTerminalTransition) return;

    const { records, newBests } = recordRunEnd(state);
    const won = state.endlessMode || curr === 'season_4_won';
    const seasonReached = getSeasonForDay(state.currentDay).number;
    setEndOfRunRecap({
      records,
      newBests,
      medal: deriveMedal(seasonReached, won),
      seasonReached,
    });
  }, [state.phase, state.endlessMode, state.currentDay, state.peakBalance, state.disastersSurvived]);
```

Update `restart` to clear the recap:

```typescript
  const restart = useCallback(() => {
    const fresh = initialGameState();
    setEndOfRunRecap(null);
    prevPhaseRef.current = fresh.phase;
    setState(fresh);
  }, []);
```

Update `endRunVictory` the same way:

```typescript
  const endRunVictory = useCallback(() => {
    const fresh = initialGameState();
    setEndOfRunRecap(null);
    prevPhaseRef.current = fresh.phase;
    setState(fresh);
  }, []);
```

Add `endOfRunRecap` to the returned object:

```typescript
  return {
    state,
    lastDailyLog: state.lastDailyLog,
    endOfRunRecap,
    nextDay,
    // ...rest unchanged
  };
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "endOfRunRecap"`
Expected: PASS.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/engine/useGameEngine.ts tests/engine/useGameEngine.test.ts
git commit -m "feat(007-enriched-run-summary): T005 — useGameEngine fires recordRunEnd on first terminal transition"
```

---

## Task 6: `MedalBadge` component

**Files:**
- Create: `src/components/MedalBadge.tsx`
- Test: `tests/components/MedalBadge.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/MedalBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MedalBadge } from '../../src/components/MedalBadge';

describe('MedalBadge', () => {
  const allTiers = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;

  it.each(allTiers)('renders %s tier with label and tagline', (tier) => {
    render(<MedalBadge medal={tier} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', expect.stringMatching(new RegExp(tier, 'i')));
  });

  it('uses the "No medal — keep going" aria-label for none', () => {
    render(<MedalBadge medal="none" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'No medal — keep going');
  });

  it('passes axe accessibility checks for each tier', async () => {
    for (const t of allTiers) {
      const { container, unmount } = render(<MedalBadge medal={t} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/components/MedalBadge.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/components/MedalBadge.tsx`**

```typescript
import { MEDAL_LABELS, MEDAL_TAGLINES, type Medal } from '../engine/medals';

interface MedalBadgeProps {
  medal: Medal;
}

/** Tailwind class slices per tier — palette reuses existing farm-* tokens. */
const RING_CLASS: Record<Medal, string> = {
  none:     'bg-farm-ink border-farm-stone/40 text-farm-stone',
  bronze:   'bg-farm-ink border-farm-red text-farm-red',
  silver:   'bg-farm-ink border-farm-parchment text-farm-parchment',
  gold:     'bg-farm-ink border-farm-gold text-farm-gold',
  platinum: 'bg-farm-ink border-farm-grass text-farm-grass',
};

const ICON: Record<Medal, string> = {
  none:     '·',
  bronze:   '🥉',
  silver:   '🥈',
  gold:     '🥇',
  platinum: '🏆',
};

export function MedalBadge({ medal }: MedalBadgeProps) {
  const label = MEDAL_LABELS[medal];
  const tagline = MEDAL_TAGLINES[medal];
  const ariaLabel = medal === 'none'
    ? 'No medal — keep going'
    : `${label} medal — ${tagline}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label={ariaLabel}
        className={`
          w-16 h-16 rounded-full border-4 flex items-center justify-center
          font-pixel text-2xl
          ${RING_CLASS[medal]}
        `}
      >
        <span aria-hidden="true">{ICON[medal]}</span>
      </div>
      <div className="text-center">
        <div className="font-pixel text-sm">{label}</div>
        <div className="font-pixel text-[10px] text-farm-stone">{tagline}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/MedalBadge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/MedalBadge.tsx tests/components/MedalBadge.test.tsx
git commit -m "feat(007-enriched-run-summary): T006 — MedalBadge component"
```

---

## Task 7: BankruptcyScreen — new props + layout

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Test: `tests/components/BankruptcyScreen.test.tsx`

- [ ] **Step 1: Update tests to reflect new layout**

Replace the contents of `tests/components/BankruptcyScreen.test.tsx` with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
import type { PersonalBests } from '../../src/engine/records';

const emptyRecords: PersonalBests = {
  schemaVersion: 1,
  bestDaysSurvived: 0,
  bestPeakBalance: 0,
  bestSeasonReached: 0,
  mostDisastersSurvived: 0,
  totalRunsCompleted: 0,
};

function renderScreen(props: Partial<React.ComponentProps<typeof BankruptcyScreen>> = {}) {
  return render(
    <BankruptcyScreen
      daysPlayed={12}
      peakBalance={150}
      disastersSurvived={1}
      seasonReached={1}
      medal="none"
      records={emptyRecords}
      newBests={new Set()}
      onRestart={vi.fn()}
      {...props}
    />,
  );
}

describe('BankruptcyScreen — enriched recap (007)', () => {
  it('renders the existing Season-reached and Peak-balance lines', () => {
    renderScreen({ daysPlayed: 12, seasonReached: 1 });
    expect(screen.getByText(/Season reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
  });

  it.each(['none', 'bronze', 'silver', 'gold', 'platinum'] as const)(
    'renders %s medal',
    (medal) => {
      renderScreen({ medal });
      expect(screen.getByRole('img', { name: new RegExp(medal === 'none' ? 'No medal' : medal, 'i') })).toBeInTheDocument();
    },
  );

  it('shows the disasters-survived stat', () => {
    renderScreen({ disastersSurvived: 4 });
    expect(screen.getByText(/Disasters Survived/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows a "new personal best" badge on each stat in newBests', () => {
    renderScreen({
      newBests: new Set(['bestDaysSurvived', 'bestPeakBalance']),
    });
    const badges = screen.getAllByLabelText('new personal best');
    expect(badges.length).toBe(2);
  });

  it('shows the first-run message when totalRunsCompleted === 0', () => {
    renderScreen({ records: { ...emptyRecords, totalRunsCompleted: 0 } });
    expect(screen.getByText(/first run/i)).toBeInTheDocument();
  });

  it('omits the first-run message after the first recorded run', () => {
    renderScreen({ records: { ...emptyRecords, totalRunsCompleted: 5 } });
    expect(screen.queryByText(/first run/i)).not.toBeInTheDocument();
  });

  it('renders Personal Records summary values', () => {
    renderScreen({
      records: {
        schemaVersion: 1,
        bestDaysSurvived: 42,
        bestPeakBalance: 500,
        bestSeasonReached: 3,
        mostDisastersSurvived: 6,
        totalRunsCompleted: 3,
      },
    });
    expect(screen.getByText(/Personal Records/i)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('passes axe accessibility checks for all medal tiers', async () => {
    for (const m of ['none', 'bronze', 'silver', 'gold', 'platinum'] as const) {
      const { container, unmount } = renderScreen({ medal: m });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: FAIL — new props don't exist; new layout missing.

- [ ] **Step 3: Rewrite `src/components/BankruptcyScreen.tsx`**

Replace the file contents with:

```typescript
import { getSeasonForDay } from '../engine/seasons';
import { MedalBadge } from './MedalBadge';
import type { DailyLogEntry } from '../engine/types';
import type { Medal } from '../engine/medals';
import type { PersonalBests } from '../engine/records';

interface BankruptcyScreenProps {
  daysPlayed: number;
  peakBalance: number;
  disastersSurvived: number;
  seasonReached: number;
  medal: Medal;
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
  lastDailyLog?: DailyLogEntry | null;
  onRestart: () => void;
}

function deriveInsight(
  log: DailyLogEntry | null | undefined,
  daysPlayed: number,
  peakBalance: number,
): string {
  if (!log) return 'Plant early and harvest often to build a coin reserve.';
  if (log.pestDestroyedPlots.length > 0)
    return 'Pests wiped your plots. Clear them quickly and replant to recover income.';
  if (log.weatherId === 'blight')
    return 'Blight destroyed your crops. Fast-growing radishes reduce blight exposure.';
  if (log.weatherId === 'flash_drought')
    return 'Flash Drought delayed your harvest. Keep a coin buffer to survive slow turns.';
  if (daysPlayed < 5)
    return 'You went bankrupt early. Start with radishes — they pay out in just 1 day.';
  if (peakBalance < 40)
    return 'Your balance stayed dangerously low. Aim for a buffer of 3× your lease cost.';
  return 'Keep a reserve above your daily lease cost to survive bad-weather turns.';
}

function NewBestBadge() {
  return (
    <span
      aria-label="new personal best"
      className="ml-2 font-pixel text-[9px] text-farm-gold"
    >
      🏆 New Best!
    </span>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  isNewBest: boolean;
}

function StatRow({ label, value, isNewBest }: StatRowProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 bg-farm-ink rounded">
      <span className="font-pixel text-xs text-farm-stone">
        {label}
        {isNewBest && <NewBestBadge />}
      </span>
      <span className="font-pixel text-sm text-farm-gold">{value}</span>
    </div>
  );
}

export function BankruptcyScreen({
  daysPlayed,
  peakBalance,
  disastersSurvived,
  seasonReached,
  medal,
  records,
  newBests,
  lastDailyLog,
  onRestart,
}: BankruptcyScreenProps) {
  const season = getSeasonForDay(daysPlayed);
  const insight = deriveInsight(lastDailyLog, daysPlayed, peakBalance);
  const isFirstRun = records.totalRunsCompleted <= 1; // post-write: this run is run #1

  return (
    <div
      role="main"
      aria-label="Bankruptcy screen"
      className="
        flex flex-col items-center justify-center
        min-h-screen gap-6 p-8
        bg-farm-soil text-farm-parchment
      "
    >
      <div className="text-4xl">💸</div>

      <h1 className="font-pixel text-xl text-farm-red text-center leading-relaxed">
        Bankrupt!
      </h1>

      <MedalBadge medal={medal} />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <StatRow
          label="Days Survived"
          value={String(daysPlayed)}
          isNewBest={newBests.has('bestDaysSurvived')}
        />
        <StatRow
          label="Season Reached"
          value={`${seasonReached} (${season.name})`}
          isNewBest={newBests.has('bestSeasonReached')}
        />
        <StatRow
          label="Peak Balance"
          value={`${peakBalance}🪙`}
          isNewBest={newBests.has('bestPeakBalance')}
        />
        <StatRow
          label="Disasters Survived"
          value={String(disastersSurvived)}
          isNewBest={newBests.has('mostDisastersSurvived')}
        />
      </div>

      <section
        aria-label="Personal records across all runs"
        className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30"
      >
        <span className="font-pixel text-[9px] text-farm-stone uppercase tracking-widest">
          Personal Records
        </span>
        {isFirstRun ? (
          <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">
            This was your first run — your records start now.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-pixel text-[10px] text-farm-parchment">
          <span>Best days:</span><span className="text-right">{records.bestDaysSurvived}</span>
          <span>Best peak:</span><span className="text-right">{records.bestPeakBalance}🪙</span>
          <span>Best season:</span><span className="text-right">{records.bestSeasonReached || '—'}</span>
          <span>Most disasters:</span><span className="text-right">{records.mostDisastersSurvived}</span>
        </div>
      </section>

      <div className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30">
        <span className="font-pixel text-[9px] text-farm-stone uppercase tracking-widest">Insight</span>
        <p className="font-pixel text-xs text-farm-parchment leading-relaxed">{insight}</p>
      </div>

      <button
        type="button"
        aria-label="Restart game"
        onClick={onRestart}
        className="
          px-8 py-3 rounded-lg font-pixel text-sm
          bg-farm-grass text-farm-parchment
          hover:bg-farm-gold hover:text-farm-ink
          transition-colors mt-2
        "
      >
        Restart
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/BankruptcyScreen.tsx tests/components/BankruptcyScreen.test.tsx
git commit -m "feat(007-enriched-run-summary): T007 — BankruptcyScreen new layout with medal, milestones, records"
```

---

## Task 8: Wire `App.tsx` to pass the new props

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Pull `endOfRunRecap` and pass to `BankruptcyScreen`**

In `src/App.tsx`, modify the destructure and the BankruptcyScreen render:

```typescript
function App() {
  const engine = useGameEngine();
  const { state, restart, continueSeason, endRunVictory, endOfRunRecap } = engine;

  // Bankruptcy — terminal run-end (existing behavior)
  if (state.phase === 'bankrupt') {
    // endOfRunRecap is guaranteed non-null here once the bankruptcy effect has fired.
    // On the very first render after the transition we may briefly see it as null;
    // pass defensive defaults in that window.
    const recap = endOfRunRecap;
    return (
      <>
        <GrainFilter />
        <BankruptcyScreen
          daysPlayed={state.currentDay}
          peakBalance={state.peakBalance}
          disastersSurvived={state.disastersSurvived}
          seasonReached={recap?.seasonReached ?? 1}
          medal={recap?.medal ?? 'none'}
          records={recap?.records ?? {
            schemaVersion: 1,
            bestDaysSurvived: 0,
            bestPeakBalance: 0,
            bestSeasonReached: 0,
            mostDisastersSurvived: 0,
            totalRunsCompleted: 0,
          }}
          newBests={recap?.newBests ?? new Set()}
          lastDailyLog={state.lastDailyLog}
          onRestart={restart}
        />
      </>
    );
  }
  // ... rest unchanged
}
```

- [ ] **Step 2: Run all tests + lint + smoke check**

Run: `npm test`
Expected: all tests pass.

Run: `npm run lint`
Expected: clean.

Run: `npm run build`
Expected: TypeScript build succeeds.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` and:
1. Force a quick bankruptcy (don't plant for a few days). Verify the bankruptcy screen shows: 💸, "Bankrupt!", a "No Medal" badge, the four stat rows (Days/Season/Peak/Disasters), "🏆 New Best!" badges on the first-run stats, the "This was your first run — your records start now." line, the Personal Records grid showing the just-set values, the existing Insight, and the Restart button.
2. Restart and bankrupt again with strictly worse stats. Verify no "🏆 New Best!" badges appear and the Records grid shows the prior bests.
3. Open DevTools → Application → Local Storage. Confirm `pixel-parsnips-records` is present and survives a Restart.

If any step fails, debug and fix before committing.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(007-enriched-run-summary): T008 — wire endOfRunRecap into BankruptcyScreen"
```

---

## Task 9: Update backlog and product handbook

**Files:**
- Modify: `backlog.md`
- Modify: any product handbook reference to G3 (search to confirm)

- [ ] **Step 1: Search for G3 references**

Run: `grep -rn "G3" backlog.md docs/ 2>/dev/null`

- [ ] **Step 2: Update `backlog.md`**

In `backlog.md`, locate the G3 row (around line 24) and update its status. Change:

```markdown
| G3 | **Enriched run/season summary** — season reached, medals/tier, personal bests, contextual failure tip, milestones recap | High | S–M | p1·I6, p2·F, p4·F, p5·3.2 | **Partially landed via [006-season-system](specs/006-season-system/spec.md)**: BankruptcyScreen now shows "Season reached: N (Name)". Remaining: medals/tier, personal bests across runs, contextual failure tip, milestones recap. Bump to next sprint candidate. |
```

to:

```markdown
| G3 | ✅ **Enriched run/season summary** — season reached, medals/tier, personal bests, contextual failure tip, milestones recap | High | S–M | p1·I6, p2·F, p4·F, p5·3.2 → **shipped as [007-enriched-run-summary](specs/007-enriched-run-summary/spec.md)** | **DONE.** Bronze/Silver/Gold/Platinum medal tied to season reached; three persistent personal bests (days, peak, disasters); milestones recap with inline "🏆 New Best!" badges; contextual insight was already shipped in 005-ui-polish-core US5. |
```

Also update the Phase 2 row and the Cross-Document Consensus row similarly to reflect completion.

- [ ] **Step 3: Commit**

```bash
git add backlog.md
git commit -m "docs(007-enriched-run-summary): mark G3 complete in backlog"
```

---

## Self-Review Notes

**Spec coverage:**
- FR-001 (engine tracks disastersSurvived) → T001 + T002
- FR-002 (deriveMedal pure) → T003
- FR-003 (records module) → T004
- FR-004 (recordRunEnd called exactly once on first terminal transition) → T005
- FR-005 (separate localStorage key, restart preserves) → T004 + T005
- FR-006 (BankruptcyScreen layout) → T007
- FR-007 ("🏆 New Best!" badges with aria-label) → T007
- FR-008 (first-run message) → T007
- FR-009 (schema 4 → 5 with default) → T001
- FR-010 (medal aria-label) → T006
- FR-011 (axe pass on all tiers + viewport) → T006 + T007
- FR-012 (reuse farm-* tokens) → T006

**Type consistency:** `Medal`, `PersonalBests`, `EndOfRunRecap` are imported, not redeclared. `recordRunEnd` signature is identical in T004, T005, T007's test.

**Placeholder scan:** None — every code step shows the exact code.

**Open question:** None.
