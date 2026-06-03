# Season System Implementation Tasks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Season System feature on branch `006-season-system` as specified in [spec.md](./spec.md) and architected in [plan.md](./plan.md).

**Architecture:** Pure module `src/engine/seasons.ts` exposes derived season config from `currentDay`. Engine `processTurn` reads seasonal lease and disaster bands, then checks the season-end target. One new persisted field (`endlessMode`), schema bump 3 → 4. UI: HUD additions + one new `SeasonTransitionModal` + one new line on the BankruptcyScreen.

**Tech Stack:** TypeScript 5.6, React 18.3, Vite 5.4, Tailwind 3.4, Vitest 4, React Testing Library, vitest-axe.

**Test command (global):** `npm test` (vitest in watch-off mode via project config) or `npx vitest run <path>` for a single file.

---

## Phase A — Foundations

The new `seasons.ts` module first. No engine or UI changes yet — only pure functions and the season table.

### Task 1: Create `seasons.ts` with `getSeasonForDay` for Seasons 1–4

**Files:**
- Create: `src/engine/seasons.ts`
- Test: `tests/engine/seasons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/engine/seasons.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getSeasonForDay, SEASON_LENGTH } from '../../src/engine/seasons';

describe('getSeasonForDay — Seasons 1–4 (table-based)', () => {
  it('returns Season 1 (Spring Thaw) for Day 1', () => {
    const s = getSeasonForDay(1);
    expect(s.number).toBe(1);
    expect(s.name).toBe('Spring Thaw');
    expect(s.startDay).toBe(1);
    expect(s.endDay).toBe(20);
    expect(s.leasePerDay).toBe(15);
    expect(s.disasterTotalPct).toBeCloseTo(0.15);
    expect(s.target).toBe(150);
  });

  it('returns Season 1 for Day 20 (the last day of Season 1)', () => {
    expect(getSeasonForDay(20).number).toBe(1);
  });

  it('returns Season 2 (Summer Heat) for Day 21', () => {
    const s = getSeasonForDay(21);
    expect(s.number).toBe(2);
    expect(s.name).toBe('Summer Heat');
    expect(s.startDay).toBe(21);
    expect(s.endDay).toBe(40);
    expect(s.leasePerDay).toBe(20);
    expect(s.disasterTotalPct).toBeCloseTo(0.20);
    expect(s.target).toBe(250);
  });

  it('returns Season 3 (Autumn Pressure) for Day 41', () => {
    const s = getSeasonForDay(41);
    expect(s.number).toBe(3);
    expect(s.name).toBe('Autumn Pressure');
    expect(s.leasePerDay).toBe(25);
    expect(s.disasterTotalPct).toBeCloseTo(0.28);
    expect(s.target).toBe(400);
  });

  it('returns Season 4 (Winter Crunch) for Day 80 (last day of finite arc)', () => {
    const s = getSeasonForDay(80);
    expect(s.number).toBe(4);
    expect(s.name).toBe('Winter Crunch');
    expect(s.endDay).toBe(80);
    expect(s.leasePerDay).toBe(30);
    expect(s.disasterTotalPct).toBeCloseTo(0.35);
    expect(s.target).toBe(600);
  });

  it('exports SEASON_LENGTH = 20', () => {
    expect(SEASON_LENGTH).toBe(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: FAIL — `Cannot find module '../../src/engine/seasons'`.

- [ ] **Step 3: Create the seasons module**

Create `src/engine/seasons.ts`:

```typescript
import type { WeatherId } from './types';

export const SEASON_LENGTH = 20;

export interface SeasonConfig {
  number: number;
  name: string;
  startDay: number;
  endDay: number;
  leasePerDay: number;
  disasterTotalPct: number;
  target: number;
}

/** Hard-coded configs for Seasons 1–4 (the finite arc). */
export const SEASON_TABLE: SeasonConfig[] = [
  { number: 1, name: 'Spring Thaw',      startDay:  1, endDay: 20, leasePerDay: 15, disasterTotalPct: 0.15, target: 150 },
  { number: 2, name: 'Summer Heat',      startDay: 21, endDay: 40, leasePerDay: 20, disasterTotalPct: 0.20, target: 250 },
  { number: 3, name: 'Autumn Pressure',  startDay: 41, endDay: 60, leasePerDay: 25, disasterTotalPct: 0.28, target: 400 },
  { number: 4, name: 'Winter Crunch',    startDay: 61, endDay: 80, leasePerDay: 30, disasterTotalPct: 0.35, target: 600 },
];

/**
 * Returns the active SeasonConfig for the given calendar day.
 * For day > 80 (Endless), see Task 2 — this initial version covers Seasons 1–4 only.
 */
export function getSeasonForDay(day: number): SeasonConfig {
  for (const s of SEASON_TABLE) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Temporary fallback for days > 80 — implemented in Task 2.
  return SEASON_TABLE[SEASON_TABLE.length - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/seasons.ts tests/engine/seasons.test.ts
git commit -m "feat(006-season-system): T001 — seasons.ts with Seasons 1–4 table"
```

---

### Task 2: Extend `getSeasonForDay` with the Endless formula (N ≥ 5)

**Files:**
- Modify: `src/engine/seasons.ts`
- Test: `tests/engine/seasons.test.ts`

- [ ] **Step 1: Add failing tests for Endless seasons**

Append to `tests/engine/seasons.test.ts`:

```typescript
describe('getSeasonForDay — Endless formula (N ≥ 5)', () => {
  it('returns Endless Season 5 for Day 81', () => {
    const s = getSeasonForDay(81);
    expect(s.number).toBe(5);
    expect(s.name).toBe('Deep Winter');
    expect(s.startDay).toBe(81);
    expect(s.endDay).toBe(100);
    expect(s.leasePerDay).toBe(32); // 30 + 2*(5-4)
    expect(s.disasterTotalPct).toBeCloseTo(0.37); // 0.35 + 0.02*(5-4)
    expect(s.target).toBe(800); // 600 + 200
  });

  it('returns Endless Season 6 for Day 101', () => {
    const s = getSeasonForDay(101);
    expect(s.number).toBe(6);
    expect(s.startDay).toBe(101);
    expect(s.endDay).toBe(120);
    expect(s.leasePerDay).toBe(34);
    expect(s.disasterTotalPct).toBeCloseTo(0.39);
    expect(s.target).toBe(1000);
  });

  it('returns Endless Season 5 for Day 100 (last day of Endless 5)', () => {
    expect(getSeasonForDay(100).number).toBe(5);
  });

  it('caps disasterTotalPct at 0.50 for very high Endless seasons', () => {
    // Season N where 0.35 + 0.02*(N-4) > 0.50 → N - 4 > 7.5 → N >= 12
    // Season 12 → Days 221..240 → pick Day 221
    const s = getSeasonForDay(221);
    expect(s.number).toBe(12);
    expect(s.disasterTotalPct).toBeCloseTo(0.50);
  });

  it('continues to escalate lease and target past the disaster cap', () => {
    const s = getSeasonForDay(221); // Endless Season 12
    expect(s.leasePerDay).toBe(30 + 2 * (12 - 4)); // 46
    expect(s.target).toBe(600 + 200 * (12 - 4)); // 2200
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: FAIL — Day 81 returns Season 4 (the fallback in T001).

- [ ] **Step 3: Replace `getSeasonForDay` with the full version**

Replace `getSeasonForDay` in `src/engine/seasons.ts`:

```typescript
/**
 * Returns the active SeasonConfig for any calendar day ≥ 1.
 * Days 1–80 use SEASON_TABLE; days ≥ 81 use the Endless formula:
 *   - Season N = 5 + floor((day - 81) / 20)
 *   - startDay = 81 + 20 * (N - 5)
 *   - endDay   = startDay + 19
 *   - leasePerDay      = 30 + 2 * (N - 4)
 *   - disasterTotalPct = min(0.35 + 0.02 * (N - 4), 0.50)
 *   - target           = 600 + 200 * (N - 4)
 */
export function getSeasonForDay(day: number): SeasonConfig {
  for (const s of SEASON_TABLE) {
    if (day >= s.startDay && day <= s.endDay) return s;
  }
  // Endless Season N (N ≥ 5)
  const n = 5 + Math.floor((day - 81) / 20);
  const startDay = 81 + 20 * (n - 5);
  return {
    number: n,
    name: 'Deep Winter',
    startDay,
    endDay: startDay + 19,
    leasePerDay: 30 + 2 * (n - 4),
    disasterTotalPct: Math.min(0.35 + 0.02 * (n - 4), 0.50),
    target: 600 + 200 * (n - 4),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: PASS — all tests from T001 and T002 pass (11 total).

- [ ] **Step 5: Commit**

```bash
git add src/engine/seasons.ts tests/engine/seasons.test.ts
git commit -m "feat(006-season-system): T002 — Endless season formula for N ≥ 5"
```

---

### Task 3: Add `getDisasterBandsForSeason` with proportional scaling

**Files:**
- Modify: `src/engine/seasons.ts`
- Test: `tests/engine/seasons.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/engine/seasons.test.ts`:

```typescript
import { getDisasterBandsForSeason } from '../../src/engine/seasons';

describe('getDisasterBandsForSeason', () => {
  it('Season 1 returns the baseline bands (matches existing constants)', () => {
    const bands = getDisasterBandsForSeason(getSeasonForDay(1));
    // Baseline: blight 0–0.05, pest 0.05–0.10, flash_drought 0.10–0.15
    expect(bands[0]).toEqual({ threshold: 0.05, id: 'blight' });
    expect(bands[1]).toEqual({ threshold: 0.10, id: 'pest_infestation' });
    expect(bands[2]).toEqual({ threshold: 0.15, id: 'flash_drought' });
  });

  it('Season 2 scales disaster bands proportionally to 20% total', () => {
    const bands = getDisasterBandsForSeason(getSeasonForDay(21));
    // Each disaster band scales by 20/15 = 1.333..., so each disaster slice = 0.0667
    expect(bands[0].threshold).toBeCloseTo(20 / 300, 5); // blight slice 0.0667
    expect(bands[1].threshold).toBeCloseTo(40 / 300, 5); // through pest 0.1333
    expect(bands[2].threshold).toBeCloseTo(60 / 300, 5); // through flash_drought 0.20
  });

  it('preserves the 1:1:1 disaster ratio across seasons', () => {
    const s4 = getSeasonForDay(80);
    const bands = getDisasterBandsForSeason(s4);
    const blightWidth = bands[0].threshold;
    const pestWidth = bands[1].threshold - bands[0].threshold;
    const droughtWidth = bands[2].threshold - bands[1].threshold;
    expect(blightWidth).toBeCloseTo(pestWidth, 5);
    expect(pestWidth).toBeCloseTo(droughtWidth, 5);
  });

  it('total disaster band width equals season.disasterTotalPct', () => {
    const s = getSeasonForDay(41); // Season 3, 0.28
    const bands = getDisasterBandsForSeason(s);
    expect(bands[2].threshold).toBeCloseTo(0.28, 5);
  });

  it('non-disaster bands fill the remaining probability up to 1.0', () => {
    const s = getSeasonForDay(21); // Season 2, 0.20 disaster
    const bands = getDisasterBandsForSeason(s);
    // Last band threshold must be exactly 1.0 (perfect_sun)
    expect(bands[bands.length - 1].threshold).toBeCloseTo(1.0, 5);
    // Last band id is perfect_sun (same as baseline)
    expect(bands[bands.length - 1].id).toBe('perfect_sun');
  });

  it('non-disaster bands keep their original equal-width spacing', () => {
    const s = getSeasonForDay(21);
    const bands = getDisasterBandsForSeason(s);
    // After the 3 disasters there are 5 weather bands (drought, overcast, sunny, warm_breeze, perfect_sun)
    // each must occupy (1.0 - 0.20) / 5 = 0.16 of probability space
    const nonDisasterTotal = 1.0 - 0.20;
    const expectedWidth = nonDisasterTotal / 5;
    expect(bands[4].threshold - bands[3].threshold).toBeCloseTo(expectedWidth, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: FAIL — `getDisasterBandsForSeason` does not exist.

- [ ] **Step 3: Implement `getDisasterBandsForSeason`**

Append to `src/engine/seasons.ts`:

```typescript
import { WEATHER_PROBABILITY_BANDS } from './constants';

const BASELINE_DISASTER_TOTAL = 0.15; // blight + pest + flash_drought baseline

/**
 * Returns weather probability bands for the given season.
 * Disaster bands (blight, pest, flash_drought) scale proportionally so their
 * total width equals `season.disasterTotalPct`, preserving the 1:1:1 ratio.
 * Non-disaster bands keep equal-width spacing in the remaining probability space.
 */
export function getDisasterBandsForSeason(
  season: SeasonConfig
): Array<{ threshold: number; id: WeatherId }> {
  const disasterIds = WEATHER_PROBABILITY_BANDS.slice(0, 3).map(b => b.id);
  const nonDisasterIds = WEATHER_PROBABILITY_BANDS.slice(3).map(b => b.id);

  const disasterTotal = season.disasterTotalPct;
  const perDisasterWidth = disasterTotal / disasterIds.length;

  const nonDisasterTotal = 1.0 - disasterTotal;
  const perNonDisasterWidth = nonDisasterTotal / nonDisasterIds.length;

  const bands: Array<{ threshold: number; id: WeatherId }> = [];
  let cursor = 0;
  for (const id of disasterIds) {
    cursor += perDisasterWidth;
    bands.push({ threshold: cursor, id });
  }
  for (const id of nonDisasterIds) {
    cursor += perNonDisasterWidth;
    bands.push({ threshold: cursor, id });
  }
  // Floating-point safety: clamp the final band to exactly 1.0
  bands[bands.length - 1] = { threshold: 1.0, id: bands[bands.length - 1].id };
  return bands;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/engine/seasons.test.ts`
Expected: PASS — all seasons tests pass (17 total).

- [ ] **Step 5: Commit**

```bash
git add src/engine/seasons.ts tests/engine/seasons.test.ts
git commit -m "feat(006-season-system): T003 — getDisasterBandsForSeason proportional scaling"
```

---

## Phase B — Types & schema

Expand `GameState` and bump the schema. No behavior change yet — these are type and persistence-layer changes.

### Task 4: Expand `phase` union, add `endlessMode`, bump SCHEMA_VERSION

**Files:**
- Modify: `src/engine/types.ts:89-102` (GameState interface)
- Modify: `src/engine/constants.ts:10` (SCHEMA_VERSION)

- [ ] **Step 1: Write a failing type-level test**

The existing test suite already imports `GameState` — a missing `endlessMode` field would cause a TypeScript compile error on every test file that constructs a state.

We'll add a behavior test in `tests/engine/gameEngine.test.ts` after the existing `initialGameState` tests. Find the existing block testing `initialGameState` (search for `describe('initialGameState')` — if it doesn't exist, append to the file):

```typescript
import { initialGameState } from '../../src/engine/gameEngine';

describe('initialGameState — schema 4 fields', () => {
  it('starts with endlessMode: false', () => {
    const s = initialGameState();
    expect(s.endlessMode).toBe(false);
  });

  it('has schemaVersion 4', () => {
    expect(initialGameState().schemaVersion).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "schema 4 fields"`
Expected: FAIL — TypeScript error: `Property 'endlessMode' does not exist on type 'GameState'`.

- [ ] **Step 3: Update the type and constants**

In `src/engine/types.ts`, replace the `GameState` interface and the `phase` union:

```typescript
export interface GameState {
  schemaVersion: number;
  currentDay: number;
  coinBalance: number;
  plots: PlotState[];
  seedInventory: SeedInventory;
  upgradeTier: UpgradeTier;
  lastDailyLog: DailyLogEntry | null;
  phase: 'playing' | 'bankrupt'
       | 'season_passed' | 'season_4_won' | 'season_failed';
  peakBalance: number;
  fertilizerInventory: number;
  /** Calendar days remaining in the active Flash Drought window (0 = inactive). */
  flashDroughtDaysRemaining: number;
  /** True after the player accepts "Continue" on the Season 4 victory screen.
   *  Disables further target checks; lease/disaster keep escalating per formula. */
  endlessMode: boolean;
}
```

In `src/engine/constants.ts`, bump the schema version:

```typescript
export const SCHEMA_VERSION = 4;
```

Do **not** remove `LAND_LEASE_FEE` yet — that's Task 7 (to keep this diff focused on schema).

- [ ] **Step 4: Update `initialGameState` to include `endlessMode`**

In `src/engine/gameEngine.ts`, find `initialGameState()` (around line 36) and add the new field:

```typescript
  return {
    schemaVersion: SCHEMA_VERSION,
    currentDay: 1,
    coinBalance: STARTING_BALANCE,
    plots,
    seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
    upgradeTier: 0,
    lastDailyLog: null,
    phase: 'playing',
    peakBalance: STARTING_BALANCE,
    fertilizerInventory: 0,
    flashDroughtDaysRemaining: 0,
    endlessMode: false,
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test` (full suite — the schema bump will surface any other tests that construct GameState literals).
Expected: PASS — all existing tests still pass; the two new `schema 4 fields` tests pass. If any other test constructs a literal `GameState` without `endlessMode`, add `endlessMode: false` there.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/constants.ts src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(006-season-system): T004 — expand phase union, add endlessMode, bump schema to 4"
```

---

### Task 5: Implement schema 3 → 4 migration in `loadState`

**Files:**
- Modify: `src/engine/useGameEngine.ts:18-33` (loadState function)
- Test: `tests/engine/useGameEngine.test.ts`

- [ ] **Step 1: Add failing migration tests**

Append to `tests/engine/useGameEngine.test.ts`:

```typescript
describe('useGameEngine — schema 3 → 4 migration (US7)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('migrates a v3 mid-run save to v4 with endlessMode: false', () => {
    const v3State = {
      schemaVersion: 3,
      currentDay: 15,
      coinBalance: 180,
      plots: Array.from({ length: 12 }, (_, i) => ({
        id: i, cropId: null, dayPlanted: null, daysRemaining: null,
        consecutiveHarvests: 0, exhaustedSinceDay: null,
        pestDamaged: false, droughtPenalised: false,
      })),
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
      upgradeTier: 0,
      lastDailyLog: null,
      phase: 'playing',
      peakBalance: 200,
      fertilizerInventory: 0,
      flashDroughtDaysRemaining: 0,
    };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 3, state: v3State })
    );

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(15);
    expect(result.current.state.coinBalance).toBe(180);
    expect(result.current.state.endlessMode).toBe(false);
    expect(result.current.state.schemaVersion).toBe(4);
  });

  it('preserves bankrupt phase through migration', () => {
    const v3State = {
      ...initialGameState(),
      schemaVersion: 3,
      currentDay: 10,
      coinBalance: 5,
      phase: 'bankrupt' as const,
    };
    // strip endlessMode to simulate a true v3 save
    const { endlessMode: _drop, ...v3Stripped } = v3State as typeof v3State & { endlessMode: boolean };
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 3, state: v3Stripped })
    );

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.phase).toBe('bankrupt');
    expect(result.current.state.endlessMode).toBe(false);
  });

  it('discards schema 2 saves and starts fresh', () => {
    localStorage.setItem(
      'pixel-parsnips-state',
      JSON.stringify({ schemaVersion: 2, state: { currentDay: 99 } })
    );
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.currentDay).toBe(1);
    expect(result.current.state.schemaVersion).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "schema 3 → 4 migration"`
Expected: FAIL — v3 saves are currently discarded by the schema-mismatch branch.

- [ ] **Step 3: Update `loadState` with a migration step**

Replace `loadState` in `src/engine/useGameEngine.ts`:

```typescript
function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialGameState();
    const parsed = JSON.parse(raw);

    // Schema 4 — current
    if (parsed?.schemaVersion === SCHEMA_VERSION) {
      return parsed.state as GameState;
    }

    // Schema 3 → 4 — add endlessMode: false
    if (parsed?.schemaVersion === 3 && parsed?.state) {
      console.info('[PixelParsnips] Migrating save from v3 to v4 (Season System).');
      return {
        ...(parsed.state as Omit<GameState, 'endlessMode'>),
        schemaVersion: SCHEMA_VERSION,
        endlessMode: false,
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new migration tests pass; existing `useGameEngine` tests still pass (the "schema upgraded" console.info test now only fires for schemas < 3, which the existing test covers via `SCHEMA_VERSION + 99` — still mismatches and hits the discard branch).

- [ ] **Step 5: Commit**

```bash
git add src/engine/useGameEngine.ts tests/engine/useGameEngine.test.ts
git commit -m "feat(006-season-system): T005 — schema 3 → 4 migration with endlessMode default"
```

---

## Phase C — Engine: escalating costs (US4)

Switch `processTurn` from the constant `LAND_LEASE_FEE` to per-season lease, and from `WEATHER_PROBABILITY_BANDS` to `getDisasterBandsForSeason`.

### Task 6: `processTurn` uses seasonal lease

**Files:**
- Modify: `src/engine/gameEngine.ts` (processTurn, lease deduction near line 329)
- Modify: `src/engine/constants.ts` (remove LAND_LEASE_FEE export)
- Modify: `src/components/HUD.tsx:1` (remove LAND_LEASE_FEE import — temporary, T013 will restore via derived value)
- Modify: `tests/engine/gameEngine.test.ts:13` (remove LAND_LEASE_FEE import; helpers update)

- [ ] **Step 1: Add failing tests for seasonal lease**

Append to `tests/engine/gameEngine.test.ts`:

```typescript
describe('processTurn — seasonal lease (US4)', () => {
  it('deducts 15 coins lease on Day 1 (Season 1)', () => {
    // Use a deterministic state with enough balance to survive
    const state: GameState = { ...initialGameState(), coinBalance: 100 };
    const result = processTurn(state, 'sunny');
    // Closing balance: 100 - 15 lease - 5% tax = 100 - 15 - 4 = 81
    expect(result.log.landLeaseDeducted).toBe(15);
  });

  it('deducts 20 coins lease on Day 25 (Season 2)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 25 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(20);
  });

  it('deducts 25 coins lease on Day 45 (Season 3)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 45 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(25);
  });

  it('deducts 30 coins lease on Day 65 (Season 4)', () => {
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 65 };
    const result = processTurn(state, 'sunny');
    expect(result.log.landLeaseDeducted).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "seasonal lease"`
Expected: FAIL — Day 25 deducts 15 (current constant), not 20.

- [ ] **Step 3: Update `processTurn` to use seasonal lease**

In `src/engine/gameEngine.ts`:

1. Add the import at the top:

```typescript
import { getSeasonForDay } from './seasons';
```

2. Replace the `LAND_LEASE_FEE` import with nothing (delete it from the import block).

3. In `processTurn`, just before the bankruptcy check (currently around line 299), compute the active season once:

```typescript
  // Active season config — drives lease and disaster bands for this turn.
  const season = getSeasonForDay(state.currentDay);
  const leaseForDay = season.leasePerDay;
```

4. Replace every reference to `LAND_LEASE_FEE` in `processTurn` with `leaseForDay`. There are three: the bankruptcy threshold check, the deduction line, and the `landLeaseDeducted` field in the bankrupt-path log. Find each by searching for `LAND_LEASE_FEE` within `processTurn`.

5. In `src/engine/constants.ts`, remove the `LAND_LEASE_FEE` export line.

6. In `src/components/HUD.tsx`, remove `LAND_LEASE_FEE` from the import on line 1. The display will be fixed in T013; for now, replace `Lease {LAND_LEASE_FEE}🪙/day` with `Lease 🪙/day` to keep the file compiling. (T013 will make this dynamic.)

7. In `tests/engine/gameEngine.test.ts:13`, remove `LAND_LEASE_FEE` from the import. Any existing test that asserted lease behavior via the constant should be updated to expect `15` literally (Season 1 baseline) or to call `getSeasonForDay(state.currentDay).leasePerDay`.

- [ ] **Step 4: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS — new seasonal lease tests pass; existing tests pass (their states use Day 1, where seasonal lease = 15 = old constant).

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts src/engine/constants.ts src/components/HUD.tsx tests/engine/gameEngine.test.ts
git commit -m "feat(006-season-system): T006 — processTurn uses seasonal lease (US4)"
```

---

### Task 7: `processTurn` weather roll uses `getDisasterBandsForSeason`

**Files:**
- Modify: `src/engine/gameEngine.ts:209-216` (weather selection block in processTurn)
- Test: `tests/engine/gameEngine.test.ts`

- [ ] **Step 1: Add failing tests for scaled disaster bands**

Append to `tests/engine/gameEngine.test.ts`:

```typescript
describe('processTurn — seasonal disaster bands (US4)', () => {
  it('weather roll 0.18 returns a non-disaster in Season 1', () => {
    // Season 1 disaster bands: blight 0–0.05, pest 0.05–0.10, flash 0.10–0.15
    // Roll 0.18 falls into the first non-disaster band (drought, 0.15–0.32)
    const state: GameState = { ...initialGameState(), coinBalance: 100 };
    const result = processTurn(state, undefined, undefined, 0.18);
    expect(result.log.weatherId).toBe('drought');
  });

  it('weather roll 0.18 returns Flash Drought in Season 2', () => {
    // Season 2 disaster total = 0.20 → flash_drought band ends at 0.20
    const state: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 25 };
    const result = processTurn(state, undefined, undefined, 0.18);
    expect(result.log.weatherId).toBe('flash_drought');
  });

  it('weather roll 0.04 returns Blight in any season (disaster proportions preserved)', () => {
    const state1: GameState = { ...initialGameState(), coinBalance: 100 };
    const state3: GameState = { ...initialGameState(), coinBalance: 100, currentDay: 45 };
    expect(processTurn(state1, undefined, undefined, 0.04).log.weatherId).toBe('blight');
    expect(processTurn(state3, undefined, undefined, 0.04).log.weatherId).toBe('blight');
  });
});
```

The test calls `processTurn(state, weatherOverride?, pestOverride?, weatherRoll?)`. The current signature only has the first two override args — we'll add a `weatherRoll` parameter for deterministic testing.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/gameEngine.test.ts -t "seasonal disaster bands"`
Expected: FAIL — TypeScript error if the signature doesn't accept a 4th arg; or wrong results if it does but ignores seasons.

- [ ] **Step 3: Update the `processTurn` signature and weather selection**

In `src/engine/gameEngine.ts`, find the `processTurn` signature (around line 195) and add a `weatherRollOverride` parameter:

```typescript
export function processTurn(
  state: GameState,
  weatherRoll?: WeatherId,
  pestDestructionOverride?: number[],
  weatherRollOverride?: number
): TurnResult {
```

Replace the weather selection block (currently around line 209–216):

```typescript
  // Step 2: Resolve weather — inject via weatherRoll for tests, else seasonal-band random
  const weatherId: WeatherId = (() => {
    if (weatherRoll) return weatherRoll;
    const seasonForWeather = getSeasonForDay(state.currentDay);
    const bands = getDisasterBandsForSeason(seasonForWeather);
    const roll = weatherRollOverride ?? Math.random();
    for (const band of bands) {
      if (roll < band.threshold) return band.id;
    }
    return 'perfect_sun';
  })();
```

Add the `getDisasterBandsForSeason` import to the existing import line:

```typescript
import { getSeasonForDay, getDisasterBandsForSeason } from './seasons';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new seasonal disaster band tests pass; existing tests still pass (existing tests inject `weatherRoll` directly and bypass the band logic).

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/gameEngine.test.ts
git commit -m "feat(006-season-system): T007 — processTurn weather uses seasonal disaster bands (US4)"
```

---

## Phase D — Engine: season transitions (US2, US3, US5)

Add the season-end target check and the three new phase outcomes.

### Task 8: Implement season-end target check (`season_passed` / `season_failed`)

**Files:**
- Modify: `src/engine/gameEngine.ts` (processTurn, after step 8 currentDay increment)
- Create: `tests/engine/seasonTransition.test.ts`

- [ ] **Step 1: Create the new test file with failing tests**

Create `tests/engine/seasonTransition.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn } from '../../src/engine/gameEngine';
import type { GameState } from '../../src/engine/types';

/** Construct a state landing on the season-end day with a given closing-balance trajectory.
 *  Note: processTurn deducts lease + tax from balance THEN increments day. So to test
 *  Day 20's end-of-turn behavior, set currentDay to 20 and a coinBalance such that
 *  after harvest (none — no plots planted) and lease/tax, the result meets/misses target.
 */
function stateAt(day: number, balance: number): GameState {
  return { ...initialGameState(), currentDay: day, coinBalance: balance };
}

describe('processTurn — Season 1 end-of-day-20 transition', () => {
  it('sets phase to season_passed when target met', () => {
    // Day 20: opening balance 168 → lease 15 → 153 → tax 5% = 7 → 146 (miss by 4)
    // For target 150: opening must satisfy (b - 15) * 0.95 >= 150 → b >= 173.95 → 174
    const state = stateAt(20, 175);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_passed');
    expect(result.state.currentDay).toBe(21);
  });

  it('sets phase to season_failed when target missed', () => {
    const state = stateAt(20, 170);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_failed');
    expect(result.state.currentDay).toBe(20); // does not advance
  });

  it('does not set a transition phase on non-season-end days', () => {
    const state = stateAt(19, 500);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('playing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasonTransition.test.ts`
Expected: FAIL — phase remains `'playing'` on Day 20.

- [ ] **Step 3: Implement the season-end check in `processTurn`**

In `src/engine/gameEngine.ts`, after the existing "Step 8: Increment currentDay" line, but before "Step 8.5: Natural recovery", insert:

```typescript
  // Step 8.4: Season-end check — fires only when the just-completed day was the
  // last day of a season AND the player has been in `'playing'` phase up to now.
  // Mid-season bankruptcy was already handled in Step 5; that path returned early.
  let seasonPhase: GameState['phase'] = 'playing';
  let nextDayAfterTransition = currentDay;
  if (state.currentDay === season.endDay) {
    if (coinBalance >= season.target) {
      // Target met
      if (season.number === 4 && !state.endlessMode) {
        seasonPhase = 'season_4_won';
        nextDayAfterTransition = state.currentDay; // do not advance until player chooses
      } else {
        seasonPhase = 'season_passed';
        // currentDay was already incremented in Step 8 — keep that.
      }
    } else {
      seasonPhase = 'season_failed';
      nextDayAfterTransition = state.currentDay; // do not advance past failure
    }
  }
```

Then update the `nextState` construction at the bottom of `processTurn` to use these:

```typescript
  const nextState: GameState = {
    ...state,
    plots: recoveredPlots,
    coinBalance,
    currentDay: nextDayAfterTransition,
    flashDroughtDaysRemaining,
    peakBalance,
    lastDailyLog: log,
    phase: seasonPhase,
  };
```

Important: the existing `nextState` does **not** set `phase` — by default it carries over `state.phase`. The new explicit `phase: seasonPhase` overrides that. On normal days, `seasonPhase === 'playing'` which matches expected behavior. On bankruptcy days, `processTurn` returns early in Step 5 with the existing bankrupt state — that code path is unaffected.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — the 3 Season-1 transition tests pass; all existing engine tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/seasonTransition.test.ts
git commit -m "feat(006-season-system): T008 — season_passed/season_failed at end-of-season (US2, US3)"
```

---

### Task 9: Season 4 victory and endless-mode no-re-fire

**Files:**
- Test: `tests/engine/seasonTransition.test.ts`

- [ ] **Step 1: Add failing tests for Season 4 / endless paths**

Append to `tests/engine/seasonTransition.test.ts`:

```typescript
function stateAtDay80(balance: number): GameState {
  return { ...initialGameState(), currentDay: 80, coinBalance: balance };
}

describe('processTurn — Season 4 endgame (US5)', () => {
  it('sets phase to season_4_won when Day 80 target met and endlessMode is false', () => {
    // Day 80 lease = 30, tax 5% — opening must satisfy (b - 30) * 0.95 >= 600 → b >= 661.58 → 662
    const state = stateAtDay80(700);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_4_won');
    expect(result.state.currentDay).toBe(80); // does not advance
  });

  it('stays in playing phase on Day 80 when endlessMode is true and target met', () => {
    const state = { ...stateAtDay80(700), endlessMode: true };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('playing');
    expect(result.state.currentDay).toBe(81); // advances normally
  });

  it('sets phase to season_failed on Day 80 when target missed (endlessMode false)', () => {
    const state = stateAtDay80(500);
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_failed');
  });

  it('sets phase to season_failed on Day 100 when Endless Season 5 target missed', () => {
    // Endless S5 target = 800, lease 32. Need balance < target after costs.
    const state: GameState = {
      ...initialGameState(),
      currentDay: 100,
      coinBalance: 500,
      endlessMode: true,
    };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('season_failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasonTransition.test.ts -t "Season 4 endgame"`
Expected: FAIL — the endless-mode Day 80 advance case may fail (existing logic doesn't yet consider endlessMode).

- [ ] **Step 3: Verify implementation already covers these cases**

The logic from T008 already handles all four cases:

- Day 80 + target met + `!endlessMode` → `season_4_won` ✓
- Day 80 + target met + `endlessMode` → `season_passed`... wait. The T008 logic sets `season_passed` here. But we want `'playing'`, because in endless mode there is no transition modal.

The fix: when `endlessMode === true`, the season-end **target-met** branch should set `seasonPhase = 'playing'` (no transition modal, day advances). The **target-missed** branch should still set `'season_failed'` regardless of endless mode (endless players can still fail).

Update the Step 8.4 block in `src/engine/gameEngine.ts`:

```typescript
  // Step 8.4: Season-end check
  let seasonPhase: GameState['phase'] = 'playing';
  let nextDayAfterTransition = currentDay;
  if (state.currentDay === season.endDay) {
    if (coinBalance >= season.target) {
      // Target met
      if (state.endlessMode) {
        // Endless mode: silent advance, no transition modal
        seasonPhase = 'playing';
      } else if (season.number === 4) {
        seasonPhase = 'season_4_won';
        nextDayAfterTransition = state.currentDay; // wait for player choice
      } else {
        seasonPhase = 'season_passed';
        // currentDay was already incremented in Step 8
      }
    } else {
      // Target missed — applies regardless of endlessMode
      seasonPhase = 'season_failed';
      nextDayAfterTransition = state.currentDay;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all Season 4 endgame tests pass; all earlier tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/gameEngine.ts tests/engine/seasonTransition.test.ts
git commit -m "feat(006-season-system): T009 — Season 4 victory + endless-mode silent advance (US5)"
```

---

### Task 10: Bankruptcy precedence over season_failed

**Files:**
- Test: `tests/engine/seasonTransition.test.ts`

- [ ] **Step 1: Add failing tests for bankruptcy precedence**

Append to `tests/engine/seasonTransition.test.ts`:

```typescript
describe('processTurn — bankruptcy dominates season_failed', () => {
  it('mid-season bankruptcy (Day 12) sets phase to bankrupt, not any season phase', () => {
    const state: GameState = { ...initialGameState(), currentDay: 12, coinBalance: 5 };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('bankrupt');
  });

  it('Day 20 bankruptcy (insufficient for lease) sets phase to bankrupt, not season_failed', () => {
    // Coin balance below lease (15) on Day 20 — must trigger bankrupt path, not target check
    const state: GameState = { ...initialGameState(), currentDay: 20, coinBalance: 5 };
    const result = processTurn(state, 'sunny');
    expect(result.state.phase).toBe('bankrupt');
    expect(result.state.phase).not.toBe('season_failed');
  });

  it('Day 20 marginal pass (balance just barely below target) sets season_failed', () => {
    const state: GameState = { ...initialGameState(), currentDay: 20, coinBalance: 165 };
    const result = processTurn(state, 'sunny');
    // 165 - 15 lease = 150 → tax 7 (floor) → closing 143 < 150 → season_failed
    expect(result.state.phase).toBe('season_failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/seasonTransition.test.ts -t "dominates season_failed"`
Expected: PASS — these tests should already pass because the bankruptcy check (Step 5 in `processTurn`) returns early before the Step 8.4 season-end check ever runs. **If they pass on first run, the implementation is correct and we just commit; do not skip the test creation step — these guard against future regressions.**

- [ ] **Step 3: Verify no implementation change needed**

Read the existing Step 5 in `processTurn`: it returns a `TurnResult` with `phase: 'bankrupt'` whenever `coinBalance < leaseForDay` after harvest. That return happens BEFORE Step 8.4. So bankruptcy precedence is structurally guaranteed.

If any test from Step 1 fails, debug — it likely means the Step 5 early-return path was accidentally broken in T006/T008. Verify by reading lines ~299–326 of `gameEngine.ts`.

- [ ] **Step 4: Run tests to confirm**

Run: `npm test`
Expected: PASS — all 3 precedence tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/engine/seasonTransition.test.ts
git commit -m "test(006-season-system): T010 — regression tests for bankruptcy precedence over season_failed"
```

---

## Phase E — UI: HUD (US1, US6)

The HUD currently shows Day, Coins, Lease, Tax. We add: season indicator, target line, warning/preview when near season end.

### Task 11: HUD shows season name, day-into-season, and target

**Files:**
- Modify: `src/components/HUD.tsx`
- Modify: `src/components/GameBoard.tsx` (passes HUD props — verify nothing else needed)
- Test: Create `tests/components/HUD.test.tsx`

- [ ] **Step 1: Create failing tests**

Create `tests/components/HUD.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HUD } from '../../src/components/HUD';

const baseProps = {
  onToggleShop: vi.fn(),
  onNextDay: vi.fn(),
  onLastTurn: vi.fn(),
  isProcessing: false,
  hasLastTurn: false,
  endlessMode: false,
};

describe('HUD — Season indicator (US1)', () => {
  it('renders season name and day-into-season on Day 1', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 1 \/ 20/i)).toBeInTheDocument();
  });

  it('renders Season 2 (Summer Heat) on Day 25', () => {
    render(<HUD {...baseProps} currentDay={25} coinBalance={200} />);
    expect(screen.getByText(/Summer Heat/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 5 \/ 20/i)).toBeInTheDocument();
  });

  it('renders the season target alongside the coin balance', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={87} />);
    expect(screen.getByText(/87 \/ 150 target/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: FAIL — "Spring Thaw" text not found.

- [ ] **Step 3: Update `HUD.tsx`**

Replace the contents of `src/components/HUD.tsx`:

```tsx
import { TAX_RATE } from '../engine/constants';
import { getSeasonForDay } from '../engine/seasons';

interface HUDProps {
  currentDay: number;
  coinBalance: number;
  /** Mobile only: opens/closes the shop bottom sheet. */
  onToggleShop: () => void;
  /** Advance the game by one day. */
  onNextDay: () => void;
  /** Reopen the Day Summary modal from the previous turn. */
  onLastTurn: () => void;
  /** Disable Next Day while a turn is processing. */
  isProcessing: boolean;
  /** Whether there is a previous-turn log to reopen. */
  hasLastTurn: boolean;
  /** Used by T012 to decide whether Day 80 shows a lease preview. */
  endlessMode: boolean;
}

export function HUD({
  currentDay,
  coinBalance,
  onToggleShop,
  onNextDay,
  onLastTurn,
  isProcessing,
  hasLastTurn,
  endlessMode: _endlessMode, // wired through; consumed in T012
}: HUDProps) {
  const season = getSeasonForDay(currentDay);
  const dayIntoSeason = currentDay - season.startDay + 1;
  const targetMet = coinBalance >= season.target;

  return (
    <header
      aria-label="Game status"
      className="
        flex flex-wrap items-center gap-2 px-4 py-2
        bg-[#0E0A04]/95 backdrop-blur-sm
        border-b border-[#5C3D1E]/50
      "
    >
      {/* Left: Season chip + Day chip + Balance/target chip */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col leading-tight px-2.5 py-1 bg-[#261808] border border-[#5C3D1E]/60 rounded">
          <span className="font-pixel text-[8px] text-farm-stone/60 uppercase tracking-widest">
            Season {season.number} · {season.name}
          </span>
          <span className="font-pixel text-[10px] text-farm-gold">
            Day {dayIntoSeason} / {season.endDay - season.startDay + 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#261808] border border-[#5C3D1E]/60 px-2.5 py-1 rounded">
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <span className="font-pixel text-sm text-farm-gold">{coinBalance}</span>
          <span
            className={`font-pixel text-[9px] ml-1 ${targetMet ? 'text-farm-grass' : 'text-farm-stone/60'}`}
            aria-label={`Season target ${season.target}`}
          >
            / {season.target} target
          </span>
        </div>
      </div>

      {/* Centre-right: Lease + Tax — hidden on small screens */}
      <div className="hidden sm:flex items-center gap-3 ml-auto">
        <span className="font-pixel text-[9px] text-farm-stone/50 uppercase tracking-widest">
          Lease {season.leasePerDay}🪙/day
        </span>
        <span className="font-pixel text-[9px] text-farm-stone/50 uppercase tracking-widest">
          Tax {TAX_RATE * 100}%
        </span>
      </div>

      {/* Action buttons: Last Turn + Next Day */}
      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        <button
          type="button"
          aria-label="View last turn summary"
          onClick={onLastTurn}
          disabled={!hasLastTurn}
          className="
            font-pixel text-[9px] px-2 py-1.5 rounded uppercase tracking-widest
            bg-[#261808] text-farm-stone/60 border border-[#5C3D1E]/50
            hover:enabled:bg-[#3A2510] hover:enabled:text-farm-parchment/80 hover:enabled:border-[#5C3D1E]
            active:enabled:scale-95 transition-all
            disabled:opacity-30
          "
        >
          Last Turn
        </button>
        <button
          type="button"
          aria-label="Advance to next day"
          onClick={onNextDay}
          disabled={isProcessing}
          className="
            font-pixel text-[10px] px-4 py-1.5 rounded uppercase tracking-widest
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:enabled:scale-95 disabled:opacity-50 transition-all
          "
        >
          Next Day →
        </button>
      </div>

      {/* Shop toggle — mobile only */}
      <button
        type="button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          md:hidden
          font-pixel text-[9px] px-3 py-1.5 rounded uppercase tracking-widest
          bg-farm-gold text-farm-ink
          hover:brightness-110 transition-all
        "
      >
        🌾 Shop
      </button>
    </header>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new HUD tests pass; existing HUD-related tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(006-season-system): T011 — HUD shows season, day-in-season, and target (US1)"
```

---

### Task 12: HUD Day 18+ warning and Day 20 lease preview

**Files:**
- Modify: `src/components/HUD.tsx`
- Test: `tests/components/HUD.test.tsx`

- [ ] **Step 1: Add failing tests for telegraphing**

Append to `tests/components/HUD.test.tsx`:

```typescript
describe('HUD — Day 18+ warning and Day 20 preview (US6)', () => {
  it('shows "3 days left" warning at Day 18 when target not met', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={50} />);
    expect(screen.getByText(/3 days left/i)).toBeInTheDocument();
  });

  it('suppresses warning at Day 18 when target already met', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={200} />);
    expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
  });

  it('shows lease preview on Day 20 of Season 1', () => {
    render(<HUD {...baseProps} currentDay={20} coinBalance={150} />);
    expect(screen.getByText(/rises to 20 next season/i)).toBeInTheDocument();
  });

  it('does NOT show lease preview on Day 80 (Season 4) when endlessMode is false', () => {
    // HUD has no endlessMode prop yet — add it via the next subtask.
    render(<HUD {...baseProps} currentDay={80} coinBalance={600} endlessMode={false} />);
    expect(screen.queryByText(/rises to .* next season/i)).not.toBeInTheDocument();
  });

  it('shows lease preview on Day 80 when endlessMode is true', () => {
    render(<HUD {...baseProps} currentDay={80} coinBalance={600} endlessMode={true} />);
    expect(screen.getByText(/rises to 32 next season/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "Day 18\\+ warning"`
Expected: FAIL — warning text not present; `endlessMode` not a valid prop.

- [ ] **Step 3: Update `HUD.tsx` to render warning + preview using existing `endlessMode` prop**

The `endlessMode` prop and its destructuring already exist from T011 (currently unused, marked `_endlessMode`). Remove the underscore prefix so the parameter name is `endlessMode`, then:

Inside the function body, after the existing `targetMet` line, add:

```typescript
  const daysRemainingInSeason = season.endDay - currentDay + 1;
  const showWarning = currentDay >= season.startDay + 17 && !targetMet && currentDay <= season.endDay;
  // Day 20 lease preview: a "next season" exists if not final Season 4, OR endless mode is on
  const hasNextSeason = season.number !== 4 || endlessMode;
  const showLeasePreview = currentDay === season.endDay && hasNextSeason;
  const nextSeasonLease = showLeasePreview
    ? (season.number === 4 && endlessMode
        ? 32                              // Endless Season 5 lease
        : season.leasePerDay + 5)         // Seasons 1→2→3→4 step is +5
    : null;
```

4. Update the target-line span (`/ {season.target} target`) to append the warning when relevant:

```tsx
          <span
            className={`font-pixel text-[9px] ml-1 ${
              showWarning ? 'text-farm-red' : targetMet ? 'text-farm-grass' : 'text-farm-stone/60'
            }`}
            aria-label={`Season target ${season.target}`}
          >
            / {season.target} target
            {showWarning && (
              <span className="ml-1 text-farm-red">— {daysRemainingInSeason} days left</span>
            )}
          </span>
```

5. Update the lease span to include the preview when relevant:

```tsx
        <span className="font-pixel text-[9px] text-farm-stone/50 uppercase tracking-widest">
          Lease {season.leasePerDay}🪙/day
          {showLeasePreview && (
            <span className="ml-1 text-farm-gold/70">
              (rises to {nextSeasonLease} next season)
            </span>
          )}
        </span>
```

- [ ] **Step 4: Wire `endlessMode` through `GameBoard.tsx` to `HUD`**

In `src/components/GameBoard.tsx`, find where `<HUD ...>` is rendered and add `endlessMode={state.endlessMode}` to its props.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all HUD tests including new warning/preview tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/HUD.tsx src/components/GameBoard.tsx tests/components/HUD.test.tsx
git commit -m "feat(006-season-system): T012 — HUD warning at Day 18+ and lease preview at Day 20 (US6)"
```

---

## Phase F — UI: Season Transition Modal (US2, US3, US5)

### Task 13: Create `SeasonTransitionModal` with all three variants

**Files:**
- Create: `src/components/SeasonTransitionModal.tsx`
- Create: `tests/components/SeasonTransitionModal.test.tsx`

- [ ] **Step 1: Create failing component tests**

Create `tests/components/SeasonTransitionModal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeasonTransitionModal } from '../../src/components/SeasonTransitionModal';

describe('SeasonTransitionModal — passed variant', () => {
  it('shows "Season 1 — Complete" with next-season preview', () => {
    render(
      <SeasonTransitionModal
        variant="passed"
        currentDay={20}
        coinBalance={200}
        peakBalance={250}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(/Season 1 — Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Summer Heat/i)).toBeInTheDocument();
    expect(screen.getByText(/rises to 20\/day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Begin Season 2/i })).toBeInTheDocument();
  });

  it('"Begin Season N+1" button calls onContinue', () => {
    const onContinue = vi.fn();
    render(
      <SeasonTransitionModal
        variant="passed"
        currentDay={20}
        coinBalance={200}
        peakBalance={250}
        onContinue={onContinue}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Begin Season 2/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

describe('SeasonTransitionModal — failed variant', () => {
  it('shows "X coins short" when gap is between 1% and 50%', () => {
    // Target 150, balance 138 → 12 coins short, gap 8% < 50%
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={138}
        peakBalance={150}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(/12 coins short/i)).toBeInTheDocument();
  });

  it('suppresses "X coins short" when gap exceeds 50%', () => {
    // Target 150, balance 30 → 120 short, gap 80% — suppress
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={30}
        peakBalance={50}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.queryByText(/coins short/i)).not.toBeInTheDocument();
  });

  it('"Start New Run" calls onRestart', () => {
    const onRestart = vi.fn();
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={138}
        peakBalance={150}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={onRestart}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Start New Run/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});

describe('SeasonTransitionModal — victory variant', () => {
  it('shows VICTORY headline with End Run and Continue buttons', () => {
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(/VICTORY/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /End Run Here/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
  });

  it('"End Run Here" calls onEndRun', () => {
    const onEndRun = vi.fn();
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={onEndRun}
        onRestart={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /End Run Here/i }));
    expect(onEndRun).toHaveBeenCalledOnce();
  });

  it('"Continue" calls onContinue (which the parent uses to flip endlessMode)', () => {
    const onContinue = vi.fn();
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={onContinue}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/SeasonTransitionModal.test.tsx`
Expected: FAIL — `Cannot find module 'SeasonTransitionModal'`.

- [ ] **Step 3: Create the component**

Create `src/components/SeasonTransitionModal.tsx`:

```tsx
import { getSeasonForDay } from '../engine/seasons';

export type SeasonTransitionVariant = 'passed' | 'failed' | 'victory';

interface SeasonTransitionModalProps {
  variant: SeasonTransitionVariant;
  /** The day the player just finished — last day of the just-completed season. */
  currentDay: number;
  coinBalance: number;
  peakBalance: number;
  /** Passed: advance to next season. Victory: flip endlessMode and advance. */
  onContinue: () => void;
  /** Victory only: end the run (reset to fresh state). */
  onEndRun: () => void;
  /** Failed only: reset to fresh state. */
  onRestart: () => void;
}

export function SeasonTransitionModal({
  variant,
  currentDay,
  coinBalance,
  peakBalance,
  onContinue,
  onEndRun,
  onRestart,
}: SeasonTransitionModalProps) {
  const justCompleted = getSeasonForDay(currentDay);
  const nextSeason = getSeasonForDay(currentDay + 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Season ${justCompleted.number} ${variant}`}
      className="
        fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/70 backdrop-blur-sm
      "
    >
      <div className="
        max-w-md w-full bg-farm-soil border-2 border-farm-stone/50 rounded-lg
        p-6 flex flex-col gap-4 text-farm-parchment
      ">
        {variant === 'passed' && (
          <PassedVariant
            justCompleted={justCompleted}
            nextSeason={nextSeason}
            coinBalance={coinBalance}
            onContinue={onContinue}
          />
        )}
        {variant === 'failed' && (
          <FailedVariant
            justCompleted={justCompleted}
            coinBalance={coinBalance}
            peakBalance={peakBalance}
            currentDay={currentDay}
            onRestart={onRestart}
          />
        )}
        {variant === 'victory' && (
          <VictoryVariant
            coinBalance={coinBalance}
            peakBalance={peakBalance}
            currentDay={currentDay}
            onEndRun={onEndRun}
            onContinue={onContinue}
          />
        )}
      </div>
    </div>
  );
}

function PassedVariant({
  justCompleted,
  nextSeason,
  coinBalance,
  onContinue,
}: {
  justCompleted: ReturnType<typeof getSeasonForDay>;
  nextSeason: ReturnType<typeof getSeasonForDay>;
  coinBalance: number;
  onContinue: () => void;
}) {
  return (
    <>
      <h2 className="font-pixel text-lg text-farm-gold text-center">
        Season {justCompleted.number} — Complete
      </h2>
      <p className="font-pixel text-xs text-center leading-relaxed">
        {justCompleted.name} survived.
      </p>
      <div className="bg-farm-ink rounded p-3 font-pixel text-xs">
        Final balance: {coinBalance} / {justCompleted.target} target ✓
      </div>
      <div className="bg-farm-ink/50 rounded p-3 font-pixel text-[11px] flex flex-col gap-1">
        <div className="text-farm-stone/80">
          Next: {nextSeason.name} (Days {nextSeason.startDay}–{nextSeason.endDay})
        </div>
        <div>• Lease rises to {nextSeason.leasePerDay}/day</div>
        <div>• Disasters become more common ({Math.round(nextSeason.disasterTotalPct * 100)}%)</div>
        <div>• Target: {nextSeason.target} coins by Day {nextSeason.endDay}</div>
      </div>
      <button
        type="button"
        onClick={onContinue}
        className="
          mt-2 px-6 py-3 rounded font-pixel text-sm
          bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink
          transition-colors
        "
      >
        Begin Season {nextSeason.number}
      </button>
    </>
  );
}

function FailedVariant({
  justCompleted,
  coinBalance,
  peakBalance,
  currentDay,
  onRestart,
}: {
  justCompleted: ReturnType<typeof getSeasonForDay>;
  coinBalance: number;
  peakBalance: number;
  currentDay: number;
  onRestart: () => void;
}) {
  const gap = justCompleted.target - coinBalance;
  const gapPct = gap / justCompleted.target;
  const showCoinsShortHint = gapPct > 0 && gapPct <= 0.5;

  return (
    <>
      <h2 className="font-pixel text-lg text-farm-red text-center">Season Failed</h2>
      <p className="font-pixel text-xs text-center leading-relaxed">
        {justCompleted.name} target not met.
      </p>
      <div className="bg-farm-ink rounded p-3 font-pixel text-xs flex flex-col gap-2">
        <div>Final balance: {coinBalance} / {justCompleted.target} target</div>
        {showCoinsShortHint && <div className="text-farm-stone/80">You were {gap} coins short.</div>}
      </div>
      <div className="bg-farm-ink/50 rounded p-3 font-pixel text-[11px] flex flex-col gap-1">
        <div>• Days survived: {currentDay}</div>
        <div>• Seasons completed: {justCompleted.number - 1}</div>
        <div>• Peak balance: {peakBalance}</div>
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="
          mt-2 px-6 py-3 rounded font-pixel text-sm
          bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink
          transition-colors
        "
      >
        Start New Run
      </button>
    </>
  );
}

function VictoryVariant({
  coinBalance,
  peakBalance,
  currentDay,
  onEndRun,
  onContinue,
}: {
  coinBalance: number;
  peakBalance: number;
  currentDay: number;
  onEndRun: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <h2 className="font-pixel text-xl text-farm-gold text-center">🌾 VICTORY 🌾</h2>
      <p className="font-pixel text-xs text-center leading-relaxed">
        You survived a full year.
      </p>
      <div className="bg-farm-ink rounded p-3 font-pixel text-xs flex flex-col gap-1">
        <div>Final balance: {coinBalance} / 600 target ✓</div>
        <div>Total days: {currentDay}</div>
        <div>Peak balance: {peakBalance}</div>
      </div>
      <div className="bg-farm-ink/50 rounded p-3 font-pixel text-[11px] leading-relaxed">
        Want to keep going? Deep Winter never ends. Each new season raises lease and target.
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onEndRun}
          className="
            flex-1 px-4 py-3 rounded font-pixel text-sm
            bg-[#261808] text-farm-parchment hover:bg-[#3A2510] border border-farm-stone/40
            transition-colors
          "
        >
          End Run Here
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="
            flex-1 px-4 py-3 rounded font-pixel text-sm
            bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink
            transition-colors
          "
        >
          Continue →
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all SeasonTransitionModal tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SeasonTransitionModal.tsx tests/components/SeasonTransitionModal.test.tsx
git commit -m "feat(006-season-system): T013 — SeasonTransitionModal with three variants"
```

---

### Task 14: Wire `SeasonTransitionModal` into `App.tsx`; add `continueSeason` / `endRun` hook methods

**Files:**
- Modify: `src/engine/useGameEngine.ts` (add continueSeason, endRunVictory)
- Modify: `src/App.tsx`

- [ ] **Step 1: Add a failing integration test (engine-side)**

Append to `tests/engine/useGameEngine.test.ts`:

```typescript
describe('useGameEngine — continueSeason and endRun (US2, US5)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('continueSeason from season_passed advances day and returns to playing', () => {
    const passedState: GameState = {
      ...initialGameState(),
      currentDay: 21, // already advanced by processTurn — phase carries the season_passed signal
      phase: 'season_passed',
      coinBalance: 200,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: passedState }));

    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.phase).toBe('season_passed');
    act(() => { result.current.continueSeason(); });
    expect(result.current.state.phase).toBe('playing');
    expect(result.current.state.currentDay).toBe(21);
  });

  it('continueSeason from season_4_won flips endlessMode and advances to Day 81', () => {
    const victoryState: GameState = {
      ...initialGameState(),
      currentDay: 80, // not yet advanced (season_4_won pauses on Day 80)
      phase: 'season_4_won',
      coinBalance: 700,
      endlessMode: false,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: victoryState }));

    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.continueSeason(); });
    expect(result.current.state.endlessMode).toBe(true);
    expect(result.current.state.currentDay).toBe(81);
    expect(result.current.state.phase).toBe('playing');
  });

  it('endRunVictory resets to fresh state', () => {
    const victoryState: GameState = {
      ...initialGameState(),
      currentDay: 80,
      phase: 'season_4_won',
      coinBalance: 700,
    };
    localStorage.setItem('pixel-parsnips-state', JSON.stringify({ schemaVersion: 4, state: victoryState }));

    const { result } = renderHook(() => useGameEngine());
    act(() => { result.current.endRunVictory(); });
    expect(result.current.state.currentDay).toBe(1);
    expect(result.current.state.coinBalance).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/useGameEngine.test.ts -t "continueSeason and endRun"`
Expected: FAIL — `result.current.continueSeason is not a function`.

- [ ] **Step 3: Add `continueSeason` and `endRunVictory` to `useGameEngine`**

In `src/engine/useGameEngine.ts`:

1. Add to `GameEngineHook`:

```typescript
  continueSeason: () => void;
  endRunVictory: () => void;
```

2. Inside `useGameEngine`, after the existing `restart` callback, add:

```typescript
  const continueSeason = useCallback(() => {
    setState(prev => {
      if (prev.phase === 'season_passed') {
        return { ...prev, phase: 'playing' };
      }
      if (prev.phase === 'season_4_won') {
        return { ...prev, phase: 'playing', endlessMode: true, currentDay: prev.currentDay + 1 };
      }
      return prev;
    });
  }, []);

  const endRunVictory = useCallback(() => {
    setState(initialGameState());
  }, []);
```

3. Add them to the returned hook object alongside `restart`.

- [ ] **Step 4: Wire into `App.tsx`**

Replace `src/App.tsx`:

```tsx
import { useGameEngine } from './engine/useGameEngine';
import { GameBoard } from './components/GameBoard';
import { BankruptcyScreen } from './components/BankruptcyScreen';
import { SeasonTransitionModal } from './components/SeasonTransitionModal';

function GrainFilter() {
  return (
    <svg className="hidden" aria-hidden="true" focusable="false">
      <defs>
        <filter id="pp-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise" />
          <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply" result="blended" />
          <feComponentTransfer in="blended">
            <feFuncA type="linear" slope="1" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}

function App() {
  const engine = useGameEngine();
  const { state, restart, continueSeason, endRunVictory } = engine;

  // Bankruptcy — terminal run-end (existing behavior)
  if (state.phase === 'bankrupt') {
    return (
      <>
        <GrainFilter />
        <BankruptcyScreen
          daysPlayed={state.currentDay}
          peakBalance={state.peakBalance}
          onRestart={restart}
        />
      </>
    );
  }

  // Season transition modals overlay the game board
  // We still render the board underneath so the player sees the final state.
  const transitionVariant =
    state.phase === 'season_passed' ? 'passed' :
    state.phase === 'season_failed' ? 'failed' :
    state.phase === 'season_4_won'  ? 'victory' :
    null;

  return (
    <>
      <GrainFilter />
      <GameBoard
        state={state}
        lastDailyLog={engine.lastDailyLog}
        onNextDay={engine.nextDay}
        onPlantSeed={engine.plantSeed}
        onBuySeed={cropId => engine.buySeed(cropId, 1)}
        onBuyUpgrade={engine.buyUpgrade}
        onBuyFertilizer={() => engine.buyFertilizer(1)}
        onApplyFertilizer={engine.applyFertilizer}
        onClearPestDamage={engine.clearPestDamage}
        getFertilizerCount={engine.getFertilizerCount}
        getSeedPrice={engine.getSeedPrice}
        getNextUpgradeCost={engine.getNextUpgradeCost}
      />
      {transitionVariant && (
        <SeasonTransitionModal
          variant={transitionVariant}
          currentDay={state.currentDay}
          coinBalance={state.coinBalance}
          peakBalance={state.peakBalance}
          onContinue={continueSeason}
          onEndRun={endRunVictory}
          onRestart={restart}
        />
      )}
    </>
  );
}

export default App;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all engine and component tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/engine/useGameEngine.ts src/App.tsx tests/engine/useGameEngine.test.ts
git commit -m "feat(006-season-system): T014 — wire SeasonTransitionModal into App (US2, US3, US5)"
```

---

### Task 15: Accessibility test pass with `vitest-axe`

**Files:**
- Modify: `tests/components/SeasonTransitionModal.test.tsx`

- [ ] **Step 1: Add a failing axe test**

Append to `tests/components/SeasonTransitionModal.test.tsx`:

```typescript
import { axe } from 'vitest-axe';

describe('SeasonTransitionModal — accessibility', () => {
  it('passed variant has no axe violations', async () => {
    const { container } = render(
      <SeasonTransitionModal
        variant="passed"
        currentDay={20}
        coinBalance={200}
        peakBalance={250}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('failed variant has no axe violations', async () => {
    const { container } = render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={138}
        peakBalance={150}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('victory variant has no axe violations', async () => {
    const { container } = render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run test to verify pass or identify violations**

Run: `npx vitest run tests/components/SeasonTransitionModal.test.tsx -t "accessibility"`
Expected: PASS if the component is already semantically structured (role="dialog", aria-modal, aria-label on buttons via text content). If a violation reports e.g. "color-contrast", note it and add explicit contrast utility classes; if "button-name", confirm each button has visible text.

- [ ] **Step 3: Fix any reported violations inline**

If any axe violation fires, the most likely cause is missing focus management or color contrast on the warning text. Add `tabIndex={-1}` to the outer dialog wrapper if needed for initial focus, or adjust contrast classes. Re-run the test until pass.

- [ ] **Step 4: Commit**

```bash
git add tests/components/SeasonTransitionModal.test.tsx src/components/SeasonTransitionModal.tsx
git commit -m "test(006-season-system): T015 — vitest-axe pass on SeasonTransitionModal"
```

---

## Phase G — UI: BankruptcyScreen minimal change

### Task 16: Add "Season reached" line to BankruptcyScreen

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Create or extend: `tests/components/BankruptcyScreen.test.tsx`

- [ ] **Step 1: Create a failing test**

Create `tests/components/BankruptcyScreen.test.tsx` (if it does not already exist):

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';

describe('BankruptcyScreen — Season reached line', () => {
  it('shows Season 1 (Spring Thaw) when run ended in Season 1', () => {
    render(<BankruptcyScreen daysPlayed={12} peakBalance={150} onRestart={vi.fn()} />);
    expect(screen.getByText(/Season reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
  });

  it('shows Season 3 (Autumn Pressure) when run ended at Day 50', () => {
    render(<BankruptcyScreen daysPlayed={50} peakBalance={400} onRestart={vi.fn()} />);
    expect(screen.getByText(/Autumn Pressure/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: FAIL — "Season reached" text not present.

- [ ] **Step 3: Modify `BankruptcyScreen.tsx`**

In `src/components/BankruptcyScreen.tsx`, add the import and a single new row between Days Survived and Peak Balance:

```tsx
import { getSeasonForDay } from '../engine/seasons';

interface BankruptcyScreenProps {
  daysPlayed: number;
  peakBalance: number;
  onRestart: () => void;
}

export function BankruptcyScreen({
  daysPlayed,
  peakBalance,
  onRestart,
}: BankruptcyScreenProps) {
  const season = getSeasonForDay(daysPlayed);

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

      <p className="text-farm-stone font-pixel text-xs text-center leading-relaxed">
        You couldn&apos;t cover the land lease.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <div className="flex justify-between px-4 py-2 bg-farm-ink rounded">
          <span className="font-pixel text-xs text-farm-stone">Days Survived</span>
          <span className="font-pixel text-sm text-farm-gold">{daysPlayed}</span>
        </div>
        <div className="flex justify-between px-4 py-2 bg-farm-ink rounded">
          <span className="font-pixel text-xs text-farm-stone">Season reached</span>
          <span className="font-pixel text-sm text-farm-gold">{season.number} ({season.name})</span>
        </div>
        <div className="flex justify-between px-4 py-2 bg-farm-ink rounded">
          <span className="font-pixel text-xs text-farm-stone">Peak Balance</span>
          <span className="font-pixel text-sm text-farm-gold">{peakBalance}🪙</span>
        </div>
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — new BankruptcyScreen tests pass; existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/BankruptcyScreen.tsx tests/components/BankruptcyScreen.test.tsx
git commit -m "feat(006-season-system): T016 — BankruptcyScreen shows season reached"
```

---

## Phase H — Regression canary

### Task 17: 80-day deterministic run canary test

**Files:**
- Test: `tests/engine/seasonTransition.test.ts`

- [ ] **Step 1: Add a long deterministic-run test**

Append to `tests/engine/seasonTransition.test.ts`:

```typescript
// Add to the import block at the top of the file:
//   import { initialGameState, processTurn, plantSeed } from '../../src/engine/gameEngine';

describe('processTurn — 80-day deterministic run canary (regression)', () => {
  it('a player who plants Pumpkins every turn at Tier 3 reaches season_4_won by Day 80', () => {
    // Set up a player who has skipped to a strong economic position:
    // - Tier 3 tools (60% seed discount)
    // - Plenty of pumpkin seeds
    // - Sunny weather every day for deterministic balance projection
    let state: GameState = {
      ...initialGameState(),
      upgradeTier: 3,
      coinBalance: 500,
      seedInventory: { radish: 0, parsnip: 0, pumpkin: 200 },
    };

    // Helper: plant pumpkins on every empty/non-exhausted/non-pest-damaged plot
    const fillEmptyPlots = (s: GameState): GameState => {
      let next = s;
      for (let plotId = 0; plotId < 12; plotId++) {
        const p = next.plots[plotId];
        if (p.cropId === null && p.exhaustedSinceDay === null && !p.pestDamaged) {
          const r = plantSeed(next, plotId, 'pumpkin');
          if (r.ok) next = r.state;
        }
      }
      return next;
    };

    state = fillEmptyPlots(state);

    // Advance 80 days with sunny weather, replanting after each turn
    for (let d = 0; d < 80; d++) {
      const result = processTurn(state, 'sunny');
      state = result.state;
      if (state.phase === 'bankrupt' || state.phase === 'season_failed' || state.phase === 'season_4_won') break;
      // Auto-acknowledge season transitions like a player tapping "Begin Season N+1"
      if (state.phase === 'season_passed') {
        state = { ...state, phase: 'playing' };
      }
      state = fillEmptyPlots(state);
    }

    // Expected end state: season_4_won at Day 80 with balance ≥ Season 4 target
    expect(state.phase).toBe('season_4_won');
    expect(state.currentDay).toBe(80);
    expect(state.coinBalance).toBeGreaterThanOrEqual(600);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx vitest run tests/engine/seasonTransition.test.ts -t "deterministic run canary"`
Expected: PASS — assuming the balance numbers from the spec are correct. If FAIL, the assertion message identifies whether the player went bankrupt early or finished with too-low balance — note the actual closing balance and either:
  - Update the spec's Season 4 target if it's clearly too aggressive
  - Treat the failure as a real signal that the numbers need tuning before ship

- [ ] **Step 3: Snapshot the closing balance for future regressions**

If the test passes, replace the `>=` with an explicit recorded value and a `toBeCloseTo` for stability:

```typescript
    expect(state.coinBalance).toBeCloseTo(EXPECTED_VALUE, 0); // record the actual value here
```

Where `EXPECTED_VALUE` is the closing balance observed. This becomes the regression canary: any future change that shifts this number is a deliberate signal to revisit.

- [ ] **Step 4: Commit**

```bash
git add tests/engine/seasonTransition.test.ts
git commit -m "test(006-season-system): T017 — 80-day deterministic run canary"
```

---

## Final Verification

After completing all 17 tasks, run the full quality gate:

```bash
npm test && npm run lint
```

Expected: All tests pass, lint is clean.

Then squash any cleanup commits, push the branch, and open a PR titled `Season System (006)`.

---

*Tasks generated 2026-06-02 via writing-plans skill. 17 tasks across 8 phases. Estimated effort: 2–3 days of focused work.*
