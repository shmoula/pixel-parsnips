# G12 Harvest Streak Counter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-day hook that rewards consecutive harvest days with a capped escalating bonus (+5/+10/+15/+20 coins), visible in the HUD and Day Summary, resets on miss-days and at season boundaries, and tracks the longest streak as a persistent personal best on the bankruptcy screen.

**Architecture:** Streak lives as an uncapped counter on `GameState` (`harvestStreak`) and the per-run high-water mark on `GameState.peakHarvestStreak`. The bonus is computed in `processTurn` between harvest income and bankruptcy check (so it counts toward survival). Per-turn data flows through three new `DailyLogEntry` fields (`streakBefore`, `streakAfter`, `streakBonus`). Persistent best lives on `records.ts` under a single-bump of its own schema version.

**Tech Stack:** TypeScript 5.6, React 18.3, Vite 5.4, Vitest + Testing Library, Tailwind CSS 3.4.

**Note on schema versions:** The spec says GameState v3 → v4. The codebase is actually at SCHEMA_VERSION = 5, so this plan bumps to **6**. Records schemaVersion is currently `1`; this plan bumps it to **2**.

---

## File Structure

**Modify:**
- `src/engine/types.ts` — add fields to `GameState` and `DailyLogEntry`
- `src/engine/constants.ts` — bump `SCHEMA_VERSION` 5 → 6; add `STREAK_BONUS_CAP = 4` and `STREAK_BONUS_PER_LEVEL = 5`
- `src/engine/gameEngine.ts` — extend `initialGameState`; insert streak update in `processTurn`; reset on season pass
- `src/engine/useGameEngine.ts` — add v5 → v6 migration step
- `src/engine/records.ts` — bump `schemaVersion` to 2; add `bestHarvestStreak`; include in `recordRunEnd`
- `src/components/HUD.tsx` — add streak chip; accept `harvestStreak` prop
- `src/components/GameBoard.tsx` — pass `state.harvestStreak` to `<HUD>`
- `src/components/DailyLog.tsx` — add bonus line and reset note
- `src/components/BankruptcyScreen.tsx` — add `Longest streak` StatRow + Personal Records row; accept `peakHarvestStreak` prop
- `src/App.tsx` — pass `state.peakHarvestStreak` and stub `bestHarvestStreak: 0` in the records fallback

**Test:**
- `tests/engine/gameEngine.test.ts` — engine streak behaviour
- `tests/engine/records.test.ts` — `bestHarvestStreak` tracking + schema migration
- `tests/engine/useGameEngine.test.ts` — v5 → v6 migration
- `tests/components/HUD.test.tsx` — chip visibility
- `tests/components/BankruptcyScreen.test.tsx` — Longest streak row and new-best badge

---

## Task 1: Add streak fields to types

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1: Extend `GameState` and `DailyLogEntry`**

Find the `GameState` interface and add the two streak fields after `disastersSurvived`:

```ts
  /** Count of disaster days (blight, pest_infestation, flash_drought) the run survived without bankruptcy. */
  disastersSurvived: number;
  /** Uncapped consecutive-harvest-day counter. Bonus is min(streak, 4) * 5. */
  harvestStreak: number;
  /** Highest harvestStreak value reached this run; used for the persistent-best record. */
  peakHarvestStreak: number;
```

Find the `DailyLogEntry` interface and add the three streak log fields at the end (after `flashDroughtDaysAfter`):

```ts
  /** Value of harvestStreak at start of turn (before increment/reset). */
  streakBefore: number;
  /** Value of harvestStreak at end of turn (after increment/reset and any season-end reset). */
  streakAfter: number;
  /** Coins awarded this turn from streak bonus; 0 when no harvest occurred. */
  streakBonus: number;
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: errors only on files that read/write these new fields (we add the writes in Tasks 2 & 3).

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(types): add harvest streak fields to GameState and DailyLogEntry"
```

---

## Task 2: Streak constants and updated initial state

**Files:**
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/gameEngine.ts`

- [ ] **Step 1: Bump schema and add streak constants in `constants.ts`**

Change `SCHEMA_VERSION` from `5` to `6`. Add two new constants near the other scalars:

```ts
export const SCHEMA_VERSION = 6;
// ...existing constants...
export const STREAK_BONUS_PER_LEVEL = 5;
export const STREAK_BONUS_CAP = 4;
```

- [ ] **Step 2: Extend `initialGameState` in `gameEngine.ts`**

Find the return object inside `initialGameState()` and add the two new fields after `disastersSurvived`:

```ts
    disastersSurvived: 0,
    harvestStreak: 0,
    peakHarvestStreak: 0,
  };
}
```

- [ ] **Step 3: Add a regression test for `initialGameState`**

Open `tests/engine/gameEngine.test.ts` and add this test at the top of the file (after imports):

```ts
import { initialGameState } from '../../src/engine/gameEngine';

describe('initialGameState — harvest streak', () => {
  it('starts harvestStreak and peakHarvestStreak at 0', () => {
    const s = initialGameState();
    expect(s.harvestStreak).toBe(0);
    expect(s.peakHarvestStreak).toBe(0);
  });
});
```

(If the file already imports `initialGameState`, omit the import line.)

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "harvest streak"`
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add src/engine/constants.ts src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(engine): bump schema to 6 and initialize harvest streak fields"
```

---

## Task 3: Streak increment, bonus, and miss-day reset in `processTurn`

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write failing test — bonus on first harvest**

Add at the bottom of `tests/engine/gameEngine.test.ts`:

```ts
import { processTurn, plantSeed, buySeed } from '../../src/engine/gameEngine';
import { STREAK_BONUS_PER_LEVEL } from '../../src/engine/constants';

function seedAndPlant(state: ReturnType<typeof initialGameState>) {
  const bought = buySeed(state, 'radish', 1);
  if (!bought.ok) throw new Error('buy failed');
  const planted = plantSeed(bought.state, 0, 'radish');
  if (!planted.ok) throw new Error('plant failed');
  return planted.state;
}

describe('processTurn — harvest streak', () => {
  it('awards +5 bonus on first harvest day and increments streak to 1', () => {
    const state = seedAndPlant(initialGameState());
    const { state: after, log } = processTurn(state, 'sunny');
    expect(log.streakBefore).toBe(0);
    expect(log.streakAfter).toBe(1);
    expect(log.streakBonus).toBe(STREAK_BONUS_PER_LEVEL);
    expect(after.harvestStreak).toBe(1);
    expect(after.peakHarvestStreak).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "awards \\+5"`
Expected: FAIL — `streakBefore is undefined` or balance mismatch.

- [ ] **Step 3: Implement Step 4.5 in `processTurn`**

Open `src/engine/gameEngine.ts`. After the `coinBalance = openingBalance + totalHarvestIncome;` line (Step 4) and **before** the bankruptcy `if (coinBalance < leaseForDay)` block (Step 5), insert:

```ts
  // Step 4.5: Harvest streak update — bonus counts toward bankruptcy avoidance
  const streakBefore = state.harvestStreak;
  let streakAfter: number;
  let streakBonus: number;
  let peakHarvestStreak: number;
  if (harvests.length > 0) {
    streakAfter = streakBefore + 1;
    streakBonus = Math.min(streakAfter, STREAK_BONUS_CAP) * STREAK_BONUS_PER_LEVEL;
    coinBalance += streakBonus;
    peakHarvestStreak = Math.max(state.peakHarvestStreak, streakAfter);
  } else {
    streakAfter = 0;
    streakBonus = 0;
    peakHarvestStreak = state.peakHarvestStreak;
  }
```

Add the import at the top of the file:

```ts
import {
  SCHEMA_VERSION,
  STARTING_BALANCE,
  PLOT_COUNT,
  MAX_UPGRADE_TIER,
  CROP_DEFINITIONS,
  WEATHER_DEFINITIONS,
  UPGRADE_TIER_DEFINITIONS,
  TAX_RATE,
  EXHAUSTION_THRESHOLD,
  EXHAUSTION_RECOVERY_DAYS,
  FERTILIZER_COST,
  STREAK_BONUS_PER_LEVEL,
  STREAK_BONUS_CAP,
  coins,
} from './constants';
```

- [ ] **Step 4: Write streak fields into both log entries and both state returns**

There are **two** `log` constructions in `processTurn` — the bankruptcy log (Step 5) and the normal end-of-turn log (Step 10). Both need the new fields.

In the bankruptcy log object, add at the bottom:

```ts
      flashDroughtDaysAfter: flashDroughtDaysAfterEvent,
      streakBefore,
      streakAfter,
      streakBonus,
    };
```

…and add streak fields to the `bankruptState`:

```ts
    const bankruptState: GameState = {
      ...state,
      plots: harvestedPlots,
      coinBalance,
      phase: 'bankrupt',
      flashDroughtDaysRemaining: flashDroughtDaysAfterEvent,
      lastDailyLog: log,
      harvestStreak: streakAfter,
      peakHarvestStreak,
    };
```

In the normal log (Step 10), append:

```ts
    flashDroughtDaysAfter: flashDroughtDaysRemaining,
    streakBefore,
    streakAfter,
    streakBonus,
  };
```

In the normal `nextState` (Step 10 end), insert:

```ts
  const nextState: GameState = {
    ...state,
    plots: recoveredPlots,
    coinBalance,
    currentDay: nextDayAfterTransition,
    flashDroughtDaysRemaining,
    peakBalance,
    lastDailyLog: log,
    phase: seasonPhase,
    disastersSurvived,
    harvestStreak: streakAfter,
    peakHarvestStreak,
  };
```

- [ ] **Step 5: Run the first test, expect pass**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "awards \\+5"`
Expected: PASS.

- [ ] **Step 6: Add miss-day reset test**

Append to the same describe block:

```ts
  it('resets streak to 0 on a turn with no harvest', () => {
    // Start with streak = 3 (no plot ready)
    const base = { ...initialGameState(), harvestStreak: 3, peakHarvestStreak: 3 };
    const { state: after, log } = processTurn(base, 'sunny');
    expect(log.streakBefore).toBe(3);
    expect(log.streakAfter).toBe(0);
    expect(log.streakBonus).toBe(0);
    expect(after.harvestStreak).toBe(0);
    // Peak retained
    expect(after.peakHarvestStreak).toBe(3);
  });
```

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "resets streak"`
Expected: PASS.

- [ ] **Step 7: Add cap test**

```ts
  it('caps bonus at 20 (streak * 5, capped at 4) but lets streak count keep growing', () => {
    const seeded = seedAndPlant({
      ...initialGameState(),
      harvestStreak: 6,
      peakHarvestStreak: 6,
    });
    const { state: after, log } = processTurn(seeded, 'sunny');
    expect(log.streakBonus).toBe(20);
    expect(after.harvestStreak).toBe(7);
    expect(after.peakHarvestStreak).toBe(7);
  });
```

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "caps bonus"`
Expected: PASS.

- [ ] **Step 8: Add bankruptcy-with-bonus test**

```ts
  it('records streak bonus even on the bankrupting turn', () => {
    // Lease is 15 for season 1 (day 1–20). Set balance to lease-2 so harvest+bonus barely matters.
    const seeded = seedAndPlant({
      ...initialGameState(),
      coinBalance: 1,                // far below lease
      harvestStreak: 0,
    });
    // Use 'blight' so harvest income is tiny — still gets streak +5.
    const { state: after, log } = processTurn(seeded, 'blight');
    expect(after.phase).toBe('bankrupt');
    expect(log.streakBonus).toBe(5);
    expect(log.streakAfter).toBe(1);
  });
```

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "bankrupting"`
Expected: PASS.

- [ ] **Step 9: Run full engine test suite to confirm no regressions**

Run: `npx vitest run tests/engine/gameEngine.test.ts`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(engine): add harvest streak bonus and miss-day reset to processTurn"
```

---

## Task 4: Season-end streak reset

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Write failing test**

Append:

```ts
describe('processTurn — harvest streak season reset', () => {
  it('resets harvestStreak on season_passed turn but keeps peakHarvestStreak', () => {
    // Day 20 is the end of season 1. Set balance high enough to meet target.
    const seeded = seedAndPlant({
      ...initialGameState(),
      currentDay: 20,
      coinBalance: 500,
      harvestStreak: 3,
      peakHarvestStreak: 5,
    });
    const { state: after } = processTurn(seeded, 'sunny');
    expect(after.phase).toBe('season_passed');
    expect(after.harvestStreak).toBe(0);
    expect(after.peakHarvestStreak).toBe(5);
  });

  it('does NOT reset streak on season_failed (run is ending)', () => {
    const base = {
      ...initialGameState(),
      currentDay: 20,
      coinBalance: 16,    // above lease (15), below season target
      harvestStreak: 2,
      peakHarvestStreak: 2,
    };
    const { state: after, log } = processTurn(base, 'sunny');
    expect(after.phase).toBe('season_failed');
    expect(log.streakAfter).toBe(0); // no harvest → miss-day reset (independent rule)
    expect(after.harvestStreak).toBe(0);
  });
});
```

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "season reset"`
Expected: FAIL on first test (`expected 0, received 4`).

- [ ] **Step 2: Apply the season-end override**

In `processTurn`, find the Step 8.4 season block. After `seasonPhase` is decided, compute the streak override and apply it to `nextState`. Add this block immediately after the existing season-end logic (just before Step 8.6):

```ts
  // Step 8.4b: Reset harvest streak when a season is cleared (not on season_failed,
  // since the run is ending and the final log should reflect the as-played streak).
  const harvestStreakAfterSeason =
    seasonPhase === 'season_passed' || seasonPhase === 'season_4_won'
      ? 0
      : streakAfter;
```

Update the `nextState` `harvestStreak` to use `harvestStreakAfterSeason`:

```ts
    harvestStreak: harvestStreakAfterSeason,
```

Update the **normal-path** log `streakAfter` value to reflect the post-season reset (so the Day Summary shows the reset note when a season ends on a harvest day):

```ts
    streakAfter: harvestStreakAfterSeason,
```

(Leave the bankruptcy-log path's `streakAfter` as `streakAfter` — it's not a season-end path.)

- [ ] **Step 3: Re-run season tests**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "season reset"`
Expected: both PASS.

- [ ] **Step 4: Run full engine suite**

Run: `npx vitest run tests/engine/`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(engine): reset harvest streak on season pass / victory"
```

---

## Task 5: Schema migration v5 → v6

**Files:**
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/engine/useGameEngine.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/engine/useGameEngine.test.ts`. If the file already has a `migrateState`/`loadState` test pattern, follow it; otherwise add this stand-alone block:

```ts
// At top of file if not present:
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { SCHEMA_VERSION } from '../../src/engine/constants';

describe('useGameEngine — v5 → v6 migration', () => {
  beforeEach(() => localStorage.clear());

  it('hydrates a v5 save with harvestStreak/peakHarvestStreak defaulted to 0', () => {
    const v5State = {
      schemaVersion: 5,
      currentDay: 4,
      coinBalance: 80,
      plots: Array.from({ length: 12 }, (_, i) => ({
        id: i, cropId: null, dayPlanted: null, daysRemaining: null,
        consecutiveHarvests: 0, exhaustedSinceDay: null,
        pestDamaged: false, droughtPenalised: false,
      })),
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
      upgradeTier: 0,
      lastDailyLog: null,
      phase: 'playing',
      peakBalance: 100,
      fertilizerInventory: 0,
      flashDroughtDaysRemaining: 0,
      endlessMode: false,
      disastersSurvived: 0,
    };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 5, state: v5State }),
    );
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.harvestStreak).toBe(0);
    expect(result.current.state.peakHarvestStreak).toBe(0);
  });
});
```

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "v5 → v6"`
Expected: FAIL (state stays at v5 or fields missing).

- [ ] **Step 2: Extend `migrateState`**

Open `src/engine/useGameEngine.ts`. Update the existing migration cases — change the current-schema check to `=== 6`, add a `5 → 6` step, and chain the `4 → 6` and `3 → 6` paths:

```ts
function migrateState(parsed: { schemaVersion: number; state: unknown }): GameState | null {
  // Schema 6 — current
  if (parsed.schemaVersion === SCHEMA_VERSION && parsed.state) {
    return parsed.state as GameState;
  }

  // Schema 5 → 6 — add harvestStreak and peakHarvestStreak
  if (parsed.schemaVersion === 5 && parsed.state) {
    console.info('[PixelParsnips] Migrating save from v5 to v6 (Harvest Streak).');
    return {
      ...(parsed.state as Omit<GameState, 'harvestStreak' | 'peakHarvestStreak'>),
      schemaVersion: SCHEMA_VERSION,
      harvestStreak: 0,
      peakHarvestStreak: 0,
    };
  }

  // Schema 4 → 6 — chained: add disastersSurvived + streak fields
  if (parsed.schemaVersion === 4 && parsed.state) {
    console.info('[PixelParsnips] Migrating save from v4 to v6.');
    return {
      ...(parsed.state as Omit<GameState, 'disastersSurvived' | 'harvestStreak' | 'peakHarvestStreak'>),
      schemaVersion: SCHEMA_VERSION,
      disastersSurvived: 0,
      harvestStreak: 0,
      peakHarvestStreak: 0,
    };
  }

  // Schema 3 → 6 — chained: add endlessMode + disastersSurvived + streak fields
  if (parsed.schemaVersion === 3 && parsed.state) {
    console.info('[PixelParsnips] Migrating save from v3 to v6.');
    return {
      ...(parsed.state as Omit<GameState, 'endlessMode' | 'disastersSurvived' | 'harvestStreak' | 'peakHarvestStreak'>),
      schemaVersion: SCHEMA_VERSION,
      endlessMode: false,
      disastersSurvived: 0,
      harvestStreak: 0,
      peakHarvestStreak: 0,
    };
  }

  // Unrecognised / malformed save — discard
  console.info(
    `[PixelParsnips] Discarding malformed or unsupported save (v${parsed.schemaVersion}) — starting a new game.`
  );
  return null;
}
```

- [ ] **Step 3: Re-run the migration test**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "v5 → v6"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/engine/useGameEngine.ts tests/engine/useGameEngine.test.ts
git commit -m "feat(engine): migrate v5 saves to v6 with zeroed streak fields"
```

---

## Task 6: Persistent best — `bestHarvestStreak` in records

**Files:**
- Modify: `src/engine/records.ts`
- Test: `tests/engine/records.test.ts`

- [ ] **Step 1: Write failing test for new-best behaviour**

Append to `tests/engine/records.test.ts`:

```ts
import { initialGameState } from '../../src/engine/gameEngine';
import { recordRunEnd, loadRecords } from '../../src/engine/records';

describe('records — bestHarvestStreak', () => {
  beforeEach(() => localStorage.clear());

  it('stores peakHarvestStreak as bestHarvestStreak on first run', () => {
    const state = { ...initialGameState(), currentDay: 12, peakHarvestStreak: 7 };
    const { records, newBests } = recordRunEnd(state);
    expect(records.bestHarvestStreak).toBe(7);
    expect(newBests.has('bestHarvestStreak')).toBe(true);
  });

  it('does NOT add bestHarvestStreak to newBests when run does not beat prior', () => {
    // Seed records
    const prior = { ...initialGameState(), peakHarvestStreak: 10, currentDay: 2 };
    recordRunEnd(prior);
    // Worse run
    const worse = { ...initialGameState(), peakHarvestStreak: 5, currentDay: 2 };
    const { records, newBests } = recordRunEnd(worse);
    expect(records.bestHarvestStreak).toBe(10);
    expect(newBests.has('bestHarvestStreak')).toBe(false);
  });

  it('returns 0 for bestHarvestStreak on a legacy schemaVersion 1 record', () => {
    localStorage.setItem(
      'pixel-parsnips-records',
      JSON.stringify({
        schemaVersion: 1,
        bestDaysSurvived: 30,
        bestPeakBalance: 200,
        bestSeasonReached: 2,
        mostDisastersSurvived: 3,
        totalRunsCompleted: 4,
      }),
    );
    const r = loadRecords();
    expect(r.bestHarvestStreak).toBe(0);
    expect(r.schemaVersion).toBe(2);
  });
});
```

Run: `npx vitest run tests/engine/records.test.ts -t "bestHarvestStreak"`
Expected: FAIL — field undefined.

- [ ] **Step 2: Update `records.ts`**

Replace the file's contents structurally — bump schemaVersion to 2, add the new field everywhere it appears:

```ts
import type { GameState } from './types';
import { getSeasonForDay } from './seasons';

export const RECORDS_KEY = 'pixel-parsnips-records';

export interface PersonalBests {
  schemaVersion: 2;
  bestDaysSurvived: number;
  bestPeakBalance: number;
  bestSeasonReached: number;
  mostDisastersSurvived: number;
  bestHarvestStreak: number;
  totalRunsCompleted: number;
}

const ZERO_RECORDS: PersonalBests = {
  schemaVersion: 2,
  bestDaysSurvived: 0,
  bestPeakBalance: 0,
  bestSeasonReached: 0,
  mostDisastersSurvived: 0,
  bestHarvestStreak: 0,
  totalRunsCompleted: 0,
};

export function loadRecords(): PersonalBests {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return { ...ZERO_RECORDS };
    const parsed = JSON.parse(raw) as Partial<PersonalBests>;
    return {
      schemaVersion: 2,
      bestDaysSurvived: typeof parsed.bestDaysSurvived === 'number' ? parsed.bestDaysSurvived : 0,
      bestPeakBalance: typeof parsed.bestPeakBalance === 'number' ? parsed.bestPeakBalance : 0,
      bestSeasonReached: typeof parsed.bestSeasonReached === 'number' ? parsed.bestSeasonReached : 0,
      mostDisastersSurvived:
        typeof parsed.mostDisastersSurvived === 'number' ? parsed.mostDisastersSurvived : 0,
      bestHarvestStreak:
        typeof parsed.bestHarvestStreak === 'number' ? parsed.bestHarvestStreak : 0,
      totalRunsCompleted: typeof parsed.totalRunsCompleted === 'number' ? parsed.totalRunsCompleted : 0,
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

export function recordRunEnd(state: GameState): {
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
} {
  const prior = loadRecords();
  const seasonReached = getSeasonForDay(state.currentDay).number;

  const candidates = {
    bestDaysSurvived: state.currentDay,
    bestPeakBalance: state.peakBalance,
    bestSeasonReached: seasonReached,
    mostDisastersSurvived: state.disastersSurvived,
    bestHarvestStreak: state.peakHarvestStreak,
  } as const;

  const newBests = new Set<keyof PersonalBests>();
  const next: PersonalBests = {
    schemaVersion: 2,
    bestDaysSurvived: Math.max(prior.bestDaysSurvived, candidates.bestDaysSurvived),
    bestPeakBalance: Math.max(prior.bestPeakBalance, candidates.bestPeakBalance),
    bestSeasonReached: Math.max(prior.bestSeasonReached, candidates.bestSeasonReached),
    mostDisastersSurvived: Math.max(prior.mostDisastersSurvived, candidates.mostDisastersSurvived),
    bestHarvestStreak: Math.max(prior.bestHarvestStreak, candidates.bestHarvestStreak),
    totalRunsCompleted: prior.totalRunsCompleted + 1,
  };

  for (const key of [
    'bestDaysSurvived',
    'bestPeakBalance',
    'bestSeasonReached',
    'mostDisastersSurvived',
    'bestHarvestStreak',
  ] as const) {
    if (candidates[key] > prior[key]) newBests.add(key);
  }

  saveRecords(next);
  return { records: next, newBests };
}
```

- [ ] **Step 3: Re-run tests**

Run: `npx vitest run tests/engine/records.test.ts`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/engine/records.ts tests/engine/records.test.ts
git commit -m "feat(records): track bestHarvestStreak (records schema v2)"
```

---

## Task 7: HUD streak chip

**Files:**
- Modify: `src/components/HUD.tsx`
- Modify: `src/components/GameBoard.tsx`
- Test: `tests/components/HUD.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `tests/components/HUD.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { HUD } from '../../src/components/HUD';

describe('HUD — harvest streak chip', () => {
  const baseProps = {
    currentDay: 5,
    coinBalance: 100,
    onToggleShop: () => {},
    onNextDay: () => {},
    onLastTurn: () => {},
    isProcessing: false,
    hasLastTurn: false,
    endlessMode: false,
  };

  it('hides the streak chip when harvestStreak === 0', () => {
    render(<HUD {...baseProps} harvestStreak={0} />);
    expect(screen.queryByLabelText(/harvest streak/i)).toBeNull();
  });

  it('shows the streak chip with ×N when harvestStreak > 0', () => {
    render(<HUD {...baseProps} harvestStreak={7} />);
    const chip = screen.getByLabelText(/harvest streak/i);
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('×7');
  });
});
```

Run: `npx vitest run tests/components/HUD.test.tsx -t "harvest streak chip"`
Expected: FAIL (TypeScript will complain about unknown prop too).

- [ ] **Step 2: Add `harvestStreak` to HUDProps + render chip**

In `src/components/HUD.tsx`, add to the props interface:

```ts
  /** Current uncapped consecutive-harvest-day count; chip is hidden at 0. */
  harvestStreak: number;
```

Add `harvestStreak` to the destructured props in the function signature.

Render the chip in the left chip group, immediately after the Day chip's closing `</div>` and before the Balance chip:

```tsx
        {harvestStreak > 0 && (
          <div
            aria-label={`Harvest streak: ${harvestStreak} days`}
            className="flex items-center gap-1 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60"
          >
            <span className="text-base leading-none" aria-hidden="true">🔥</span>
            <span className="font-pixel text-[10px] text-farm-gold">×{harvestStreak}</span>
          </div>
        )}
```

- [ ] **Step 3: Pass prop from GameBoard**

In `src/components/GameBoard.tsx`, the `<HUD>` invocation: add `harvestStreak={state.harvestStreak}` alongside the existing props:

```tsx
      <HUD
        currentDay={state.currentDay}
        coinBalance={state.coinBalance}
        onToggleShop={toggleShop}
        onNextDay={handleNextDay}
        onLastTurn={() => setIsSummaryOpen(true)}
        isProcessing={isProcessing}
        hasLastTurn={lastDailyLog !== null}
        endlessMode={state.endlessMode}
        harvestStreak={state.harvestStreak}
      />
```

- [ ] **Step 4: Re-run HUD test**

Run: `npx vitest run tests/components/HUD.test.tsx -t "harvest streak chip"`
Expected: PASS.

- [ ] **Step 5: Run full component suite for regressions**

Run: `npx vitest run tests/components/HUD.test.tsx tests/components/GameBoard.test.tsx`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/components/HUD.tsx src/components/GameBoard.tsx tests/components/HUD.test.tsx
git commit -m "feat(hud): show harvest streak chip when streak > 0"
```

---

## Task 8: DailyLog — bonus line and reset note

**Files:**
- Modify: `src/components/DailyLog.tsx`
- Test: existing or new test in `tests/components/`

- [ ] **Step 1: Create test file `tests/components/DailyLog.test.tsx`** (if not present)

```ts
import { render, screen } from '@testing-library/react';
import { DailyLog } from '../../src/components/DailyLog';
import type { DailyLogEntry } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 5,
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
    ...over,
  };
}

describe('DailyLog — harvest streak rows', () => {
  it('renders the streak bonus line when streakBonus > 0', () => {
    render(<DailyLog log={makeLog({ streakBefore: 0, streakAfter: 3, streakBonus: 15 })} />);
    const row = screen.getByLabelText(/streak bonus/i);
    expect(row).toHaveTextContent('×3');
    expect(row).toHaveTextContent('+15');
  });

  it('renders the streak reset note when streakBefore > 0 and streakAfter === 0', () => {
    render(<DailyLog log={makeLog({ streakBefore: 4, streakAfter: 0, streakBonus: 0 })} />);
    expect(screen.getByLabelText(/streak reset/i)).toBeInTheDocument();
  });

  it('renders neither row on a quiet pre-streak day', () => {
    render(<DailyLog log={makeLog({ streakBefore: 0, streakAfter: 0, streakBonus: 0 })} />);
    expect(screen.queryByLabelText(/streak bonus/i)).toBeNull();
    expect(screen.queryByLabelText(/streak reset/i)).toBeNull();
  });
});
```

Run: `npx vitest run tests/components/DailyLog.test.tsx`
Expected: FAIL — rows don't exist yet.

- [ ] **Step 2: Add bonus + reset rows in `DailyLog.tsx`**

Open `src/components/DailyLog.tsx`. After the existing exhausted-plots block and before the `<hr>` separator, add:

```tsx
      {/* Harvest streak — bonus or reset note */}
      {log.streakBonus > 0 && (
        <div
          aria-label="Streak bonus"
          className="flex justify-between text-farm-gold"
        >
          <span>🔥 Streak bonus ×{Math.min(log.streakAfter, 4)}</span>
          <span className="text-farm-grass">+{log.streakBonus}🪙</span>
        </div>
      )}
      {log.streakBefore > 0 && log.streakAfter === 0 && (
        <div
          aria-label="Streak reset"
          className="flex items-center gap-1 text-farm-stone/70"
        >
          <span aria-hidden="true">🔥</span>
          <span>Streak reset</span>
        </div>
      )}
```

- [ ] **Step 3: Re-run test**

Run: `npx vitest run tests/components/DailyLog.test.tsx`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/components/DailyLog.tsx tests/components/DailyLog.test.tsx
git commit -m "feat(daily-log): show streak bonus and reset note"
```

---

## Task 9: BankruptcyScreen — Longest streak row

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Modify: `src/App.tsx`
- Test: `tests/components/BankruptcyScreen.test.tsx`

- [ ] **Step 1: Write failing test**

Append to `tests/components/BankruptcyScreen.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
import type { PersonalBests } from '../../src/engine/records';

function makeRecords(over: Partial<PersonalBests> = {}): PersonalBests {
  return {
    schemaVersion: 2,
    bestDaysSurvived: 0,
    bestPeakBalance: 0,
    bestSeasonReached: 0,
    mostDisastersSurvived: 0,
    bestHarvestStreak: 0,
    totalRunsCompleted: 0,
    ...over,
  };
}

describe('BankruptcyScreen — harvest streak', () => {
  it('shows Longest streak stat row with peakHarvestStreak', () => {
    render(
      <BankruptcyScreen
        daysPlayed={10}
        peakBalance={120}
        peakHarvestStreak={6}
        disastersSurvived={1}
        seasonReached={1}
        medal="bronze"
        records={makeRecords({ totalRunsCompleted: 2, bestHarvestStreak: 6 })}
        newBests={new Set(['bestHarvestStreak'])}
        lastDailyLog={null}
        onRestart={() => {}}
      />,
    );
    expect(screen.getByText('Longest streak')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    // Personal Records section should include the new "Best streak" line
    expect(screen.getByText(/Best streak/i)).toBeInTheDocument();
  });
});
```

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx -t "harvest streak"`
Expected: FAIL — prop missing and row missing.

- [ ] **Step 2: Add `peakHarvestStreak` prop and Longest streak row**

In `src/components/BankruptcyScreen.tsx`, extend the props:

```ts
interface BankruptcyScreenProps {
  daysPlayed: number;
  peakBalance: number;
  disastersSurvived: number;
  peakHarvestStreak: number;
  seasonReached: number;
  medal: Medal;
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
  lastDailyLog?: DailyLogEntry | null;
  onRestart: () => void;
}
```

Add `peakHarvestStreak` to the destructured function signature.

Add a StatRow under the existing four (in the per-run block):

```tsx
        <StatRow
          label="Longest streak"
          value={String(peakHarvestStreak)}
          isNewBest={newBests.has('bestHarvestStreak')}
        />
```

In the Personal Records grid, add another label/value pair after the existing four:

```tsx
          <span>Best streak:</span><span className="text-right">{records.bestHarvestStreak}</span>
```

- [ ] **Step 3: Wire prop in `App.tsx`**

In `src/App.tsx`, add `peakHarvestStreak={state.peakHarvestStreak}` to the `<BankruptcyScreen>` invocation. Update the records fallback to include `bestHarvestStreak: 0`:

```tsx
    const records: PersonalBests = endOfRunRecap ? endOfRunRecap.records : {
      schemaVersion: 2,
      bestDaysSurvived: 0,
      bestPeakBalance: 0,
      bestSeasonReached: 0,
      mostDisastersSurvived: 0,
      bestHarvestStreak: 0,
      totalRunsCompleted: 0,
    };
```

And in the JSX:

```tsx
        <BankruptcyScreen
          daysPlayed={state.currentDay}
          peakBalance={state.peakBalance}
          disastersSurvived={state.disastersSurvived}
          peakHarvestStreak={state.peakHarvestStreak}
          seasonReached={seasonReached}
          medal={medal}
          records={records}
          newBests={newBests}
          lastDailyLog={state.lastDailyLog}
          onRestart={restart}
        />
```

- [ ] **Step 4: Re-run BankruptcyScreen tests**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: all green (including the new test). Update any older tests that constructed `PersonalBests` literals to add `bestHarvestStreak: 0` and bump `schemaVersion` to 2.

- [ ] **Step 5: Commit**

```bash
git add src/components/BankruptcyScreen.tsx src/App.tsx tests/components/BankruptcyScreen.test.tsx
git commit -m "feat(bankruptcy): show longest streak with new-best badge"
```

---

## Task 10: Full sweep — type-check, lint, full test suite

**Files:** —

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any straggling errors inline before continuing.

- [ ] **Step 2: Full test run**

Run: `npm test`
Expected: all green. Common failures to expect & fix:
- Older tests that construct `PersonalBests` literals — add `bestHarvestStreak: 0`, bump `schemaVersion: 2`.
- Older tests that construct `GameState` literals — add `harvestStreak: 0, peakHarvestStreak: 0`.
- Older tests that construct `DailyLogEntry` literals — add `streakBefore: 0, streakAfter: 0, streakBonus: 0`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `npm run dev` and:
1. Plant a radish, click Next Day — Day Summary should show `🔥 Streak bonus ×1 +5🪙`.
2. After harvest day, click Next Day again with no crop ready — Day Summary should show `🔥 Streak reset`.
3. Harvest 4+ days in a row — bonus caps at +20 but HUD chip continues counting (`×5`, `×6`, ...).
4. Cross day-20 with a successful season — HUD chip disappears; new day starts fresh.
5. Bankrupt the run — BankruptcyScreen shows `Longest streak: N` with `🏆 New Best!` on first run.

- [ ] **Step 5: Commit any lint/test cleanup**

```bash
git status
git add -p   # review and stage
git commit -m "chore(g12): update test fixtures for new GameState/DailyLog/records fields"
```

(Skip if Step 2/3 produced no changes.)

---

## Task 11: Update backlog and spec status

**Files:**
- Modify: `backlog.md`

- [ ] **Step 1: Mark G12 as shipped**

In `backlog.md`, find the G12 row and update it in the same shape used by G1/G2/G3:

```markdown
| G12 | ✅ **Harvest streak counter** — consecutive harvest-days with small escalating coin bonuses (5/10/15/20) | High | S | p5·3.5 → **shipped as [008-harvest-streak](specs/008-harvest-streak/spec.md)** | **DONE (YYYY-MM-DD).** Capped at +20 bonus, streak count uncapped for HUD display and the Longest-streak personal best. Resets on miss-days and at season boundaries (not on season_failed). |
```

Also update the Phase 2 line — replace "G12 is now the primary per-day hook" with "~~G12 Harvest Streak~~ ✅".

Also update the Cross-Document Consensus Summary table if it includes a "per-day hook" or similar entry referencing G12.

- [ ] **Step 2: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): mark G12 harvest streak as shipped"
```

---

## Notes for the engineer

- **Test ordering matters in `gameEngine.ts` Step 4.5.** The bonus must be added to `coinBalance` *before* the bankruptcy check so the player can survive the lease with the bonus. Task 3 Step 8 tests this explicitly.
- **The "uncapped streak, capped bonus" model uses one field, not two.** `harvestStreak` is the uncapped count. `bonus = min(harvestStreak, 4) * 5`. `peakHarvestStreak` is the per-run high-water mark of the same uncapped count.
- **Season-end reset only applies on pass / victory**, not on `season_failed`. On `season_failed` the run is ending and the final log should reflect the actual streak.
- **Records schemaVersion bumps from 1 → 2** alongside the GameState bump from 5 → 6. They're independent versions and can be incremented independently in the future.
- **The DailyLog reset note relies on `streakBefore > 0 && streakAfter === 0`** — this works both for miss-day resets and for season-end resets (Task 4 step 2 wires `streakAfter` to `harvestStreakAfterSeason` in the normal-path log).
- **Frequent commits, TDD throughout.** Each task ends with a commit. Don't batch — commit after each green test.
