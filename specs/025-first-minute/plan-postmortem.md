# 025 — Bankruptcy Post-Mortem (Phase C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the bankruptcy screen the evidence to say *why* the run ended, and a punchline title that says *how* the player died.

**Architecture:** `GameState` gains `runHistory` — one six-number record per completed day — written at both of `nextDay()`'s log-write sites and cleared on restart. A new pure module `src/engine/runPostMortem.ts` turns that history into two strings: an evidence line that replaces the Insight box's generic advice, and one of five cause-of-death titles. Schema goes 10 → 11; the default lands in `hardenCurrentSchema`, so every existing migration branch inherits it without edit.

**Tech Stack:** TypeScript ~5.6, React 18.3, Vitest + Testing Library (jsdom).

**Spec:** [spec.md](spec.md) §"Phase C" · **Companion plan:** [plan.md](plan.md) covers Phases D, B and A (copy, tax indicator, palette) and is independent — run it first, on its own branch.

---

## Why this is separate from the other plan

Phases D, B and A are presentational: their worst failure mode is that something looks wrong. This
phase adds a schema version and a migration branch, so its worst failure mode is a **corrupted
save**. Different blast radius, different review, separate branch.

---

## Orientation

**Test commands.** `npm test`, `npx vitest run <file>`, `npx vitest run <file> -t "name"`.
Lint: `npm run lint`. Typecheck runs inside `npm run build`.

**The engine is pure.** `gameEngine.ts` functions take state and return new state; nothing reads the
clock, `Math.random` (an injected `rng` is threaded through), or localStorage. Keep it that way —
the balance simulator (`npm run sim`) drives the same functions headlessly and breaks the moment
something impure creeps in.

**Migration lives in `useGameEngine.ts`, not `gameEngine.ts`.** `migrateState` (line 220) handles
current and v9; `migrateLegacy` (line 249) handles v3–v8. Every branch funnels through
`hardenCurrentSchema` (line 196), which is where field defaults belong — add one there and all nine
branches inherit it.

**`nextDay()` writes the daily log twice.** Once on the bankruptcy early return
(`gameEngine.ts:591`) and once on the normal path (`gameEngine.ts:698`). This is the single most
likely bug in this plan: append to only the normal path and the *fatal* day never reaches history —
exactly the day two of the five titles are judged on.

**Commit style.** Conventional Commits (`feat(engine): …`, `feat(ui): …`).

---

## Facts confirmed on the merged tree (2026-08-22)

- `SCHEMA_VERSION` is **10** (`src/engine/constants.ts:12`).
- `GameState` retains only `lastDailyLog` — one entry, no history (`src/engine/types.ts:229`).
- `DISASTER_WEATHER_IDS` is exported from `seasons.ts:85` as
  `['blight', 'pest_infestation', 'flash_drought']`.
- `deriveInsight` is a private function inside `BankruptcyScreen.tsx:24`, untested in isolation.
- PostHog already receives `tax_deducted` per day via `day_completed`; the data exists in the
  warehouse and nowhere the running game can read it back.

**Spec correction already applied:** the spec's original three-field `RunDayRecord` cannot support
two of the five titles — `fed_the_taxman` needs gross harvest income and `overextended` needs to know
*when* a plot or building was bought, and neither purchase is timestamped anywhere in `GameState`.
The record is six fields; see [spec.md](spec.md) §C1 for the reasoning.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/engine/types.ts` | modify | `RunDayRecord` interface + `GameState.runHistory`. |
| `src/engine/constants.ts` | modify | `SCHEMA_VERSION` 10 → 11. |
| `src/engine/gameEngine.ts` | modify | Seed `runHistory` in `initialGameState`; append at both log-write sites. |
| `src/engine/useGameEngine.ts` | modify | Normalise `runHistory` in `hardenCurrentSchema`; add the v10 → v11 branch. |
| `src/engine/runPostMortem.ts` | **create** | Pure: history → evidence line, history + final state → death cause. Also the new home of `deriveInsight`. |
| `src/components/BankruptcyScreen.tsx` | modify | Renders the title and the evidence line; drops its private `deriveInsight`. |
| `src/App.tsx` | modify | Passes `runHistory` and the plot counts through. |
| `tests/engine/runPostMortem.test.ts` | **create** | Every branch of both derivations. |
| `tests/engine/runHistory.test.ts` | **create** | Append-at-both-sites, clear-on-restart. |
| `tests/engine/migration.v11.test.ts` | **create** | v10 → v11 and legacy inheritance. |
| `tests/components/BankruptcyScreen.test.tsx` | modify | Title + evidence rendering, and the fallback. |

---

## Task 1: The `runHistory` field

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/gameEngine.ts` (`initialGameState`, ~line 65)
- Create: `tests/engine/runHistory.test.ts`

**Context:** Six numbers per day. `closingBalance` is what the tax was charged against;
`harvestIncome` is the denominator for `fed_the_taxman`; `unlockedPlots` and `buildingCount` are
running totals whose *increase* marks a purchase, which is how `overextended` becomes derivable with
no new bookkeeping in the buy paths.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/runHistory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/constants';

describe('runHistory — initial state', () => {
  it('starts empty on a fresh run', () => {
    const s = initialGameState(DEFAULT_ECONOMY);
    expect(s.runHistory).toEqual([]);
  });

  it('declares schema 11', () => {
    expect(initialGameState(DEFAULT_ECONOMY).schemaVersion).toBe(11);
  });
});
```

Check how sibling engine tests import the economy — if they use a local `ECONOMY` constant or a
different export name, match them rather than the guess above.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/runHistory.test.ts`
Expected: FAIL — `expected undefined to deeply equal []`

- [ ] **Step 3: Add the type**

In `src/engine/types.ts`, above `export interface GameState`:

```ts
/**
 * 025 — one record per completed day, kept for the end-of-run post-mortem.
 *
 * Six numbers rather than three: `harvestIncome` is the denominator the
 * "Fed the Taxman" title compares cumulative tax against, and the two running
 * counts let "Overextended" spot a recent purchase — neither a plot buy nor a
 * building buy is timestamped anywhere else in GameState.
 */
export interface RunDayRecord {
  day: number;
  /** Balance carried overnight — what the tax was charged against. */
  closingBalance: number;
  taxDeducted: number;
  /** Gross crop sales this day, before lease and tax. */
  harvestIncome: number;
  /** Plots unlocked at end of day; an increase marks a plot purchase. */
  unlockedPlots: number;
  /** Buildings owned at end of day; an increase marks a building purchase. */
  buildingCount: number;
}
```

Add to `GameState`, after `farmEvents`:

```ts
  /** 025 — per-day record of this run, for the bankruptcy post-mortem. Cleared on restart. */
  runHistory: RunDayRecord[];
```

- [ ] **Step 4: Bump the schema and seed the field**

`src/engine/constants.ts`:

```ts
export const SCHEMA_VERSION = 11;
```

`src/engine/gameEngine.ts`, in the object returned by `initialGameState`, after the `farmEvents`
line:

```ts
    runHistory: [],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/runHistory.test.ts`
Expected: PASS

- [ ] **Step 6: Check what the bump broke**

Run: `npm test`
Expected: **failures are likely** in migration tests that assert `schemaVersion === 10`, and possibly
in save-round-trip tests. Read each failure: an assertion on the literal `10` should become
`SCHEMA_VERSION`; a test asserting a v10 save loads should still pass once Task 3 lands. Do not fix
migration behaviour here — note the failures and move on; Task 3 owns them.

If a test fails only because `runHistory` is missing from a hand-built `GameState` fixture, add
`runHistory: []` to that fixture now.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): add RunDayRecord and GameState.runHistory (schema 11)"
```

---

## Task 2: Append at both log-write sites

**Files:**
- Modify: `src/engine/gameEngine.ts` (bankruptcy early return ~line 585, normal path ~line 692)
- Modify: `tests/engine/runHistory.test.ts`

**Context:** The bug this task exists to prevent: appending only on the normal path means the day the
player went broke is missing from history. `weathered_out` reads the final day's weather and
`idle_hands` reads the final board, so a missing fatal day silently degrades two of five titles.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine/runHistory.test.ts`:

```ts
import { nextDay } from '../../src/engine/gameEngine';

describe('runHistory — accumulation', () => {
  it('appends one record per completed day', () => {
    let s = initialGameState(DEFAULT_ECONOMY);
    s = nextDay(s, DEFAULT_ECONOMY, () => 0.5).state;
    expect(s.runHistory).toHaveLength(1);
    expect(s.runHistory[0].day).toBe(1);

    s = nextDay(s, DEFAULT_ECONOMY, () => 0.5).state;
    expect(s.runHistory).toHaveLength(2);
    expect(s.runHistory[1].day).toBe(2);
  });

  it('records the fields the post-mortem needs', () => {
    let s = initialGameState(DEFAULT_ECONOMY);
    s = nextDay(s, DEFAULT_ECONOMY, () => 0.5).state;
    const rec = s.runHistory[0];
    expect(rec.closingBalance).toBe(s.coinBalance);
    expect(rec.taxDeducted).toBe(s.lastDailyLog!.taxDeducted);
    expect(rec.harvestIncome).toBe(s.lastDailyLog!.totalHarvestIncome);
    expect(rec.unlockedPlots).toBe(s.unlockedPlots);
    expect(rec.buildingCount).toBe(0);
  });

  it('records the fatal day too', () => {
    // Drive the balance under the lease so nextDay takes the bankruptcy early return.
    let s = { ...initialGameState(DEFAULT_ECONOMY), coinBalance: 0 };
    const before = s.runHistory.length;
    const result = nextDay(s, DEFAULT_ECONOMY, () => 0.5);

    expect(result.isBankrupt).toBe(true);
    expect(result.state.runHistory).toHaveLength(before + 1);
    // Without this the fatal day is invisible to the post-mortem, and the two
    // titles judged on the final board silently degrade to the default.
    expect(result.state.runHistory.at(-1)!.day).toBe(s.currentDay);
  });
});
```

Match `nextDay`'s real signature — check `src/engine/gameEngine.ts` for the parameter order and
whether the rng is optional; adjust the three call sites above to match rather than assuming.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/runHistory.test.ts -t "accumulation"`
Expected: FAIL — `expected [] to have a length of 1`

- [ ] **Step 3: Add a shared record builder**

In `src/engine/gameEngine.ts`, above the `nextDay` function:

```ts
/** 025 — the per-day post-mortem record. Built from the same values that go into
 *  the DailyLogEntry, so the two can never disagree. */
function toRunDayRecord(
  log: DailyLogEntry,
  unlockedPlots: number,
  buildings: GameState['buildings'],
): RunDayRecord {
  return {
    day: log.day,
    closingBalance: log.closingBalance,
    taxDeducted: log.taxDeducted,
    harvestIncome: log.totalHarvestIncome,
    unlockedPlots,
    buildingCount: Object.values(buildings).filter(Boolean).length,
  };
}
```

Add `RunDayRecord` to the type import from `./types`.

- [ ] **Step 4: Append at the bankruptcy early return**

In the `bankruptState` object literal (~line 585), after `farmEvents: feAfterTurn,`:

```ts
      runHistory: [...s.runHistory, toRunDayRecord(log, s.unlockedPlots, s.buildings)],
```

- [ ] **Step 5: Append on the normal path**

In the `nextState` object literal (~line 692), after `disastersSurvived,`:

```ts
    runHistory: [...s.runHistory, toRunDayRecord(log, s.unlockedPlots, s.buildings)],
```

Both use `s.unlockedPlots` and `s.buildings` — the values in force **for the day being closed**. A
plot bought during day 7 is already reflected in `s.unlockedPlots` when day 7 closes, which is what
`overextended` wants.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/engine/runHistory.test.ts`
Expected: PASS — all five tests

- [ ] **Step 7: Confirm restart clears it**

`restart()` calls `initialGameState`, which seeds `[]`, so this needs no code. Prove it:

```ts
describe('runHistory — restart', () => {
  it('is empty again after a fresh initial state', () => {
    let s = initialGameState(DEFAULT_ECONOMY);
    s = nextDay(s, DEFAULT_ECONOMY, () => 0.5).state;
    expect(s.runHistory.length).toBeGreaterThan(0);
    expect(initialGameState(DEFAULT_ECONOMY).runHistory).toEqual([]);
  });
});
```

Run: `npx vitest run tests/engine/runHistory.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(engine): record a per-day run history at both nextDay exits"
```

---

## Task 3: Migration to schema 11

**Files:**
- Modify: `src/engine/useGameEngine.ts` (`hardenCurrentSchema` ~line 196, `migrateState` ~line 231)
- Create: `tests/engine/migration.v11.test.ts`

**Context:** Every migration branch — current, v9, and v3–v8 in `migrateLegacy` — funnels through
`hardenCurrentSchema`. Putting the `runHistory` default there means **no legacy branch needs
editing**: they all inherit it. The only new branch is v10 → v11, which carries no data change at
all; a v10 save simply had nothing to record.

An in-flight v10 run therefore reaches bankruptcy with an empty history and falls back to
`deriveInsight`. That is correct behaviour, not a gap — we cannot invent evidence for days that were
never recorded.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/migration.v11.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY, SCHEMA_VERSION } from '../../src/engine/constants';

const STORAGE_KEY = 'pixel-parsnips-state';

beforeEach(() => localStorage.clear());

/** Writes a save envelope at an arbitrary schema version. */
function seedSave(version: number, over: Record<string, unknown> = {}) {
  const state = { ...initialGameState(DEFAULT_ECONOMY), currentDay: 6, coinBalance: 88, ...over };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: version, state }));
}

describe('schema 11 migration', () => {
  it('carries a v10 save forward and seeds an empty history', () => {
    const state = { ...initialGameState(DEFAULT_ECONOMY), currentDay: 6, coinBalance: 88 };
    delete (state as Record<string, unknown>).runHistory;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state }));

    const { result } = renderHook(() => useGameEngine());

    expect(result.current.state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.current.state.currentDay).toBe(6);
    expect(result.current.state.coinBalance).toBe(88);
    expect(result.current.state.runHistory).toEqual([]);
  });

  it('gives every legacy version a history via hardening', () => {
    for (const v of [3, 4, 5, 6, 7, 8, 9]) {
      localStorage.clear();
      seedSave(v);
      const { result } = renderHook(() => useGameEngine());
      expect(result.current.state.runHistory, `v${v}`).toEqual([]);
      expect(result.current.state.schemaVersion, `v${v}`).toBe(SCHEMA_VERSION);
    }
  });

  it('preserves a history that is already present at v11', () => {
    seedSave(SCHEMA_VERSION, {
      runHistory: [{ day: 1, closingBalance: 90, taxDeducted: 5, harvestIncome: 20, unlockedPlots: 4, buildingCount: 0 }],
    });
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.runHistory).toHaveLength(1);
    expect(result.current.state.runHistory[0].closingBalance).toBe(90);
  });

  it('discards a tampered non-array history rather than crashing', () => {
    seedSave(SCHEMA_VERSION, { runHistory: 'not an array' });
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.runHistory).toEqual([]);
  });

  it('drops malformed entries but keeps well-formed ones', () => {
    seedSave(SCHEMA_VERSION, {
      runHistory: [
        { day: 1, closingBalance: 90, taxDeducted: 5, harvestIncome: 20, unlockedPlots: 4, buildingCount: 0 },
        { day: 'two' },
        null,
      ],
    });
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.runHistory).toHaveLength(1);
  });
});
```

If sibling migration tests use a different harness than `renderHook` (for example calling an exported
`migrateState` directly), copy that pattern instead — it will be less brittle.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/migration.v11.test.ts`
Expected: FAIL — the v10 save is discarded as unsupported, so `currentDay` is 1, not 6

- [ ] **Step 3: Normalise the field in `hardenCurrentSchema`**

Add above `hardenCurrentSchema` in `src/engine/useGameEngine.ts`:

```ts
/** 025 — structurally validate the post-mortem history. A tampered or absent value
 *  becomes an empty history, which the bankruptcy screen already handles by falling
 *  back to generic advice. Individual malformed entries are dropped, not fatal. */
function normalizeRunHistory(raw: unknown): RunDayRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is RunDayRecord =>
    !!e &&
    typeof e === 'object' &&
    typeof (e as RunDayRecord).day === 'number' &&
    typeof (e as RunDayRecord).closingBalance === 'number' &&
    typeof (e as RunDayRecord).taxDeducted === 'number' &&
    typeof (e as RunDayRecord).harvestIncome === 'number' &&
    typeof (e as RunDayRecord).unlockedPlots === 'number' &&
    typeof (e as RunDayRecord).buildingCount === 'number',
  );
}
```

Import `RunDayRecord` from `./types`.

Add to the object `hardenCurrentSchema` returns, beside `farmEvents`:

```ts
    runHistory: normalizeRunHistory(st.runHistory),
```

- [ ] **Step 4: Add the v10 → v11 branch**

In `migrateState`, after the current-schema branch and before the v9 branch:

```ts
  // Schema 10 → 11 — add the post-mortem run history (025). No data to carry
  // forward: a v10 save recorded nothing, so the run finishes on generic advice.
  if (parsed.schemaVersion === 10) {
    console.info('[PixelParsnips] Migrating save from v10 to v11 (run post-mortem history).');
    return hardenCurrentSchema({
      ...(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
    });
  }
```

Update the v9 branch's log string from `v9 to v10` to `v9 to v11`, and the same in `migrateLegacy`
for v3–v8 (`to v10` → `to v11`) — those messages are user-visible in the console and are now wrong.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/engine/migration.v11.test.ts`
Expected: PASS — all five

- [ ] **Step 6: Fix the fallout flagged in Task 1 Step 6**

Run: `npm test`
Expected: the migration tests noted earlier now pass. Any remaining failure asserting a literal `10`
should assert `SCHEMA_VERSION` instead.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): migrate saves to schema 11 with a hardened run history"
```

---

## Task 4: The evidence line

**Files:**
- Create: `src/engine/runPostMortem.ts`
- Create: `tests/engine/runPostMortem.test.ts`

**Context:** `70-DEEPDIVE.md` §4: *"Turns a loss into a lesson."* Generic advice ("keep a buffer
above your lease") is advice the player already ignored; *"you held 240 overnight on days 6–9"* is
evidence. The window is the longest consecutive stretch in the run's top quartile of overnight
balances, and the figure quoted is the **minimum** across that stretch — the strongest claim the data
actually supports.

`deriveInsight` moves here from `BankruptcyScreen.tsx` unchanged in behaviour, so the whole
"what does this screen say" decision is one pure, tested module.

- [ ] **Step 1: Write the failing test**

Create `tests/engine/runPostMortem.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveEvidenceLine, MIN_HISTORY_FOR_EVIDENCE } from '../../src/engine/runPostMortem';
import type { RunDayRecord } from '../../src/engine/types';

function rec(day: number, closingBalance: number, taxDeducted: number, over: Partial<RunDayRecord> = {}): RunDayRecord {
  return { day, closingBalance, taxDeducted, harvestIncome: 0, unlockedPlots: 4, buildingCount: 0, ...over };
}

describe('deriveEvidenceLine', () => {
  it('names the hoarding window and the tax it cost', () => {
    const history = [
      rec(1, 50, 3), rec(2, 60, 3), rec(3, 70, 4), rec(4, 80, 4), rec(5, 90, 5),
      rec(6, 240, 14), rec(7, 250, 15), rec(8, 260, 16), rec(9, 245, 15),
      rec(10, 40, 2),
    ];
    const line = deriveEvidenceLine(history);
    expect(line).toMatch(/240/);
    expect(line).toMatch(/days 6.9/);
    // 14 + 15 + 16 + 15
    expect(line).toMatch(/60/);
  });

  it('uses the singular form for a one-day window', () => {
    const history = [rec(1, 10, 0), rec(2, 10, 0), rec(3, 10, 0), rec(4, 10, 0), rec(5, 500, 30)];
    const line = deriveEvidenceLine(history);
    expect(line).toMatch(/on day 5\b/);
    expect(line).not.toMatch(/days/);
  });

  it('returns null for a run too short to have a pattern', () => {
    expect(deriveEvidenceLine([rec(1, 30, 1), rec(2, 20, 1)])).toBeNull();
    expect(deriveEvidenceLine([])).toBeNull();
  });

  it('needs at least MIN_HISTORY_FOR_EVIDENCE days', () => {
    const short = Array.from({ length: MIN_HISTORY_FOR_EVIDENCE - 1 }, (_, i) => rec(i + 1, 100, 6));
    expect(deriveEvidenceLine(short)).toBeNull();
    expect(deriveEvidenceLine([...short, rec(99, 100, 6)])).not.toBeNull();
  });

  it('returns null when the window cost no tax at all', () => {
    // A run that never paid tax has no story about hoarding.
    const history = [rec(1, 5, 0), rec(2, 6, 0), rec(3, 7, 0), rec(4, 8, 0), rec(5, 9, 0)];
    expect(deriveEvidenceLine(history)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/runPostMortem.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/engine/runPostMortem"`

- [ ] **Step 3: Write the module**

Create `src/engine/runPostMortem.ts`:

```ts
import type { DailyLogEntry, RunDayRecord } from './types';

/** Below this many recorded days a run has no pattern worth naming, and the
 *  post-mortem falls back to generic advice. A player who died on day 2 was not
 *  hoarding; they were unlucky or new. */
export const MIN_HISTORY_FOR_EVIDENCE = 5;

/** Balance percentile that counts as "holding". */
const HOARD_PERCENTILE = 0.75;

function hoardThreshold(history: readonly RunDayRecord[]): number {
  const sorted = history.map(r => r.closingBalance).sort((a, b) => a - b);
  const idx = Math.min(Math.floor(sorted.length * HOARD_PERCENTILE), sorted.length - 1);
  return sorted[idx];
}

interface Window { start: number; end: number; min: number; tax: number }

/** Longest consecutive stretch of days at or above the threshold. */
function longestHoardWindow(history: readonly RunDayRecord[], threshold: number): Window | null {
  let best: Window | null = null;
  let run: RunDayRecord[] = [];

  const flush = () => {
    if (run.length === 0) return;
    const candidate: Window = {
      start: run[0].day,
      end: run[run.length - 1].day,
      min: Math.min(...run.map(r => r.closingBalance)),
      tax: run.reduce((sum, r) => sum + r.taxDeducted, 0),
    };
    const bestLen = best ? best.end - best.start : -1;
    if (candidate.end - candidate.start > bestLen) best = candidate;
    run = [];
  };

  for (const r of history) {
    if (r.closingBalance >= threshold) run.push(r);
    else flush();
  }
  flush();
  return best;
}

/**
 * 025 — the evidence line that replaces generic advice on the bankruptcy screen.
 *
 * Quotes the MINIMUM balance across the window, not the peak or the mean: it is the
 * strongest claim the data actually supports, and an invented average would be
 * precision the log does not have. Returns null when the run is too short, or when
 * the window cost nothing — both cases fall back to `deriveInsight`.
 */
export function deriveEvidenceLine(history: readonly RunDayRecord[]): string | null {
  if (history.length < MIN_HISTORY_FOR_EVIDENCE) return null;

  const window = longestHoardWindow(history, hoardThreshold(history));
  if (!window || window.tax <= 0) return null;

  const where =
    window.start === window.end
      ? `on day ${window.start}`
      : `on days ${window.start}–${window.end}`;
  const held = window.start === window.end ? `${window.min}` : `${window.min}+`;

  return `You held ${held} coins overnight ${where}. The taxman took ${window.tax}.`;
}

/**
 * Generic fallback advice, moved verbatim from BankruptcyScreen so the whole
 * "what does this screen say" decision lives in one tested module. Used when the
 * run is too short for evidence, or when the save predates schema 11.
 */
export function deriveInsight(
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/runPostMortem.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/engine/runPostMortem.ts tests/engine/runPostMortem.test.ts
git commit -m "feat(engine): derive a bankruptcy evidence line from run history"
```

---

## Task 5: Cause-of-death titles

**Files:**
- Modify: `src/engine/runPostMortem.ts`
- Modify: `tests/engine/runPostMortem.test.ts`

**Context:** `10-ICP.md` identifies the shareable unit as *"a specific, funny, legible failure"* —
not a high score. Medals say how far you got; these say how you died. **Priority order is the
design**, and it is most-interesting-cause-first: a run that both hoarded and ended on a disaster is
a taxman story, because the taxman is the game's thesis and the weather is noise.

The thresholds are first-pass and tunable; the ordering is not.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine/runPostMortem.test.ts`:

```ts
import { deriveDeathCause, DEATH_TITLES } from '../../src/engine/runPostMortem';

const base = {
  history: [] as RunDayRecord[],
  finalWeatherId: 'sunny' as const,
  emptyPlots: 0,
  unlockedPlots: 4,
};

describe('deriveDeathCause', () => {
  it('names the taxman when tax ate a quarter of gross income', () => {
    const history = [
      rec(1, 200, 12, { harvestIncome: 40 }),
      rec(2, 210, 13, { harvestIncome: 40 }),
      rec(3, 220, 13, { harvestIncome: 40 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('fed_the_taxman');
  });

  it('names the weather when the run ended on a disaster', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100 })];
    expect(deriveDeathCause({ ...base, history, finalWeatherId: 'blight' })).toBe('weathered_out');
  });

  it('prefers the taxman over the weather', () => {
    // The taxman is the game's thesis; the weather is noise. Ordering is the design.
    const history = [rec(1, 200, 30, { harvestIncome: 40 })];
    expect(deriveDeathCause({ ...base, history, finalWeatherId: 'blight' })).toBe('fed_the_taxman');
  });

  it('names overextension when a plot was bought in the last three days', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(2, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(3, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(4, 10, 1, { harvestIncome: 100, unlockedPlots: 5 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('overextended');
  });

  it('ignores a purchase older than the window', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, unlockedPlots: 4 }),
      rec(2, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(3, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(4, 50, 1, { harvestIncome: 100, unlockedPlots: 5 }),
      rec(5, 10, 1, { harvestIncome: 100, unlockedPlots: 5 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('out_of_seed_money');
  });

  it('also counts a building purchase as overextension', () => {
    const history = [
      rec(1, 50, 1, { harvestIncome: 100, buildingCount: 0 }),
      rec(2, 50, 1, { harvestIncome: 100, buildingCount: 1 }),
    ];
    expect(deriveDeathCause({ ...base, history })).toBe('overextended');
  });

  it('names idle hands when most plots sat empty', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100 })];
    expect(deriveDeathCause({ ...base, history, emptyPlots: 3, unlockedPlots: 4 })).toBe('idle_hands');
  });

  it('falls back to out of seed money', () => {
    const history = [rec(1, 50, 1, { harvestIncome: 100 })];
    expect(deriveDeathCause({ ...base, history })).toBe('out_of_seed_money');
  });

  it('handles an empty history without throwing', () => {
    expect(deriveDeathCause({ ...base, history: [] })).toBe('out_of_seed_money');
  });

  it('gives every cause a title', () => {
    const causes = [
      'fed_the_taxman', 'weathered_out', 'overextended', 'idle_hands', 'out_of_seed_money',
    ] as const;
    for (const c of causes) expect(DEATH_TITLES[c]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/runPostMortem.test.ts -t "deriveDeathCause"`
Expected: FAIL — `deriveDeathCause is not a function`

- [ ] **Step 3: Add the derivation**

Append to `src/engine/runPostMortem.ts`:

```ts
import { DISASTER_WEATHER_IDS } from './seasons';
import type { WeatherId } from './types';

export type DeathCauseId =
  | 'fed_the_taxman'
  | 'weathered_out'
  | 'overextended'
  | 'idle_hands'
  | 'out_of_seed_money';

/** Punchlines, not scores. The medal says how far the run got; this says how it died. */
export const DEATH_TITLES: Record<DeathCauseId, string> = {
  fed_the_taxman: 'Fed the Taxman',
  weathered_out: 'Weathered Out',
  overextended: 'Overextended',
  idle_hands: 'Idle Hands',
  out_of_seed_money: 'Out of Seed Money',
};

/** Share of gross harvest income lost to tax that counts as "the taxman got you". */
const TAXMAN_SHARE = 0.25;
/** How recent a purchase has to be to have plausibly caused the collapse. */
const OVEREXTENSION_WINDOW_DAYS = 3;

export interface DeathCauseInput {
  history: readonly RunDayRecord[];
  /** Weather on the fatal day, from `lastDailyLog`; null when unknown. */
  finalWeatherId: WeatherId | null;
  /** Unlocked plots with nothing growing on the final day. */
  emptyPlots: number;
  unlockedPlots: number;
}

function boughtRecently(history: readonly RunDayRecord[]): boolean {
  const window = history.slice(-(OVEREXTENSION_WINDOW_DAYS + 1));
  for (let i = 1; i < window.length; i++) {
    if (
      window[i].unlockedPlots > window[i - 1].unlockedPlots ||
      window[i].buildingCount > window[i - 1].buildingCount
    ) {
      return true;
    }
  }
  // A purchase on the very first recorded day has no predecessor to compare against;
  // treat a non-zero building count in a one-day history as a recent buy.
  return window.length === 1 && window[0].buildingCount > 0;
}

/**
 * 025 — how this run died, evaluated most-interesting-cause-first.
 *
 * The ORDER is the design, not the thresholds. A run that both hoarded and ended on
 * a disaster is a taxman story: the tax is the game's thesis and the weather is
 * noise. Thresholds are first-pass and expected to move once real runs exist.
 */
export function deriveDeathCause({
  history,
  finalWeatherId,
  emptyPlots,
  unlockedPlots,
}: DeathCauseInput): DeathCauseId {
  const totalTax = history.reduce((s, r) => s + r.taxDeducted, 0);
  const totalIncome = history.reduce((s, r) => s + r.harvestIncome, 0);

  if (totalIncome > 0 && totalTax >= totalIncome * TAXMAN_SHARE) return 'fed_the_taxman';
  if (finalWeatherId !== null && DISASTER_WEATHER_IDS.includes(finalWeatherId)) return 'weathered_out';
  if (boughtRecently(history)) return 'overextended';
  if (unlockedPlots > 0 && emptyPlots > unlockedPlots / 2) return 'idle_hands';
  return 'out_of_seed_money';
}
```

Merge the two `import type { … } from './types'` lines into one rather than leaving duplicates —
lint will flag it otherwise.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/engine/runPostMortem.test.ts`
Expected: PASS — all 15

- [ ] **Step 5: Commit**

```bash
git add src/engine/runPostMortem.ts tests/engine/runPostMortem.test.ts
git commit -m "feat(engine): derive a cause-of-death title from run history"
```

---

## Task 6: Render the post-mortem

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `tests/components/BankruptcyScreen.test.tsx`

**Context:** The title sits above the medal badge (which stays — they answer different questions).
The evidence line replaces the **content** of the Insight box; the box itself stays.
`deriveInsight` is now imported rather than declared locally.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/BankruptcyScreen.test.tsx`, using the `renderScreen()` helper (added in
[plan.md](plan.md) Task 2 — if that plan has not merged yet, add the helper here instead):

```tsx
import type { RunDayRecord } from '../../src/engine/types';

function hist(over: Partial<RunDayRecord>[] = []): RunDayRecord[] {
  return over.map((o, i) => ({
    day: i + 1, closingBalance: 100, taxDeducted: 6, harvestIncome: 30,
    unlockedPlots: 4, buildingCount: 0, ...o,
  }));
}

describe('BankruptcyScreen — 025 post-mortem', () => {
  it('shows a cause-of-death title alongside the medal', () => {
    renderScreen({
      runHistory: hist([{ taxDeducted: 30 }, { taxDeducted: 30 }, { taxDeducted: 30 }]),
      emptyPlotCount: 0,
      unlockedPlots: 4,
    });
    expect(screen.getByText(/fed the taxman/i)).toBeInTheDocument();
    // The medal answers "how far"; the title answers "how you died". Both stay.
    expect(screen.getByLabelText(/medal/i)).toBeInTheDocument();
  });

  it('replaces generic advice with the evidence line when history allows', () => {
    renderScreen({
      runHistory: hist([
        { closingBalance: 40, taxDeducted: 2 },
        { closingBalance: 40, taxDeducted: 2 },
        { closingBalance: 300, taxDeducted: 18 },
        { closingBalance: 310, taxDeducted: 18 },
        { closingBalance: 320, taxDeducted: 19 },
      ]),
      emptyPlotCount: 0,
      unlockedPlots: 4,
    });
    expect(screen.getByText(/the taxman took \d+/i)).toBeInTheDocument();
    expect(screen.queryByText(/keep a reserve above your daily lease cost/i)).toBeNull();
  });

  it('falls back to generic advice on an empty history (migrated v10 save)', () => {
    renderScreen({ runHistory: [], emptyPlotCount: 0, unlockedPlots: 4 });
    expect(screen.getByText(/plant early and harvest often|keep a reserve|went bankrupt early/i)).toBeInTheDocument();
    expect(screen.queryByText(/the taxman took/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx -t "025 post-mortem"`
Expected: FAIL — TypeScript rejects the unknown `runHistory` prop; no title renders

- [ ] **Step 3: Update `BankruptcyScreen.tsx`**

Delete the local `deriveInsight` function (lines 24–39) and import instead:

```tsx
import { DEATH_TITLES, deriveDeathCause, deriveEvidenceLine, deriveInsight } from '../engine/runPostMortem';
import type { RunDayRecord } from '../engine/types';
```

Add to `BankruptcyScreenProps`:

```tsx
  /** 025 — per-day record of the finished run; empty for pre-schema-11 saves. */
  runHistory: readonly RunDayRecord[];
  /** 025 — unlocked plots with nothing growing on the fatal day. */
  emptyPlotCount: number;
  /** 025 — plots unlocked on the fatal day. */
  unlockedPlots: number;
```

Add the three to the destructured parameter list, then replace the `insight` derivation:

```tsx
  const evidence = deriveEvidenceLine(runHistory);
  const insight = evidence ?? deriveInsight(lastDailyLog, daysPlayed, peakBalance);
  const deathCause = deriveDeathCause({
    history: runHistory,
    finalWeatherId: lastDailyLog?.weatherId ?? null,
    emptyPlots: emptyPlotCount,
    unlockedPlots,
  });
```

Insert the title immediately after the `<h1>Bankrupt!</h1>` and before `<MedalBadge …>`:

```tsx
      {/* 025 — how this run died. The medal below says how far it got; these answer
          different questions, so both stay. */}
      <p className="font-pixel text-body text-farm-gold uppercase tracking-widest">
        {DEATH_TITLES[deathCause]}
      </p>
```

The Insight box needs no markup change — `insight` now holds the evidence line when one exists.

- [ ] **Step 4: Pass the data from `App.tsx`**

In the bankruptcy branch's `<BankruptcyScreen …>`, add:

```tsx
            runHistory={state.runHistory}
            emptyPlotCount={state.plots.slice(0, state.unlockedPlots).filter(p => p.cropId === null).length}
            unlockedPlots={state.unlockedPlots}
```

`slice(0, unlockedPlots)` matters: plots beyond the unlocked count are locked, not idle, and counting
them would trigger `idle_hands` on any run that never bought a plot.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: PASS — including every pre-existing test in the file

- [ ] **Step 6: Run the full suite, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): show a cause-of-death title and evidence line on bankruptcy"
```

---

## Task 7: Simulator sanity check

**Files:** none — this task only runs things

**Context:** `npm run sim` drives the real engine headlessly across hundreds of runs
([SIMULATION.md](../../SIMULATION.md)). It is the cheapest available proof that `runHistory` neither
breaks the engine nor grows without bound, and the fastest way to see whether the death-title
thresholds produce a sane distribution before any human plays a run.

- [ ] **Step 1: Confirm the engine still runs clean**

```bash
npm run sim -- --strategies smartMixed --trials 200
```

Expected: completes with no error, and the win/bankruptcy rates match what
[SIMULATION.md](../../SIMULATION.md) records for this economy. A **changed** balance outcome means
something in Task 2 mutated state it should not have — `runHistory` is write-only from the engine's
point of view and must not affect a single decision.

- [ ] **Step 2: Sanity-check the title distribution**

Add a temporary script or a `console.log` in the sim harness that calls `deriveDeathCause` on each
bankrupt run's final state, and tally the five causes across 200 runs.

Expected: **no cause above ~70% and none at 0%.** If one dominates, the ordering is starving the
others and the thresholds want adjusting — `TAXMAN_SHARE` first, since it is evaluated before
everything else. Record the observed distribution in [spec.md](spec.md) §C3 next to the threshold
table, then remove the temporary instrumentation.

This is the only calibration signal available before real players exist, and it costs one command.

- [ ] **Step 3: Commit any threshold change**

```bash
git add -A
git commit -m "chore(engine): tune death-cause thresholds against simulator output"
```

Skip this commit if the distribution was already healthy.

---

## Final verification

- [ ] **Run everything**

```bash
npm test && npm run lint && npm run build && npm run sim -- --strategies smartMixed --trials 200
```

- [ ] **Verify the migration by hand — the highest-risk part of this plan**

1. Check out `master`, run the dev server, play three or four days, and confirm a save exists in
   localStorage under `pixel-parsnips-state`.
2. Check out this branch and reload **without clearing storage**.
3. The run must continue at the same day and balance, with the console reporting
   `Migrating save from v10 to v11`.
4. Play to bankruptcy. The screen must show a death title and **generic** advice — the history
   started empty, so there is no evidence line. That is the correct outcome, not a bug.
5. Restart and play a fresh run to bankruptcy: this time the evidence line should appear.

- [ ] **Verify the fatal day is in history**

In the browser console just before restarting from the bankruptcy screen:

```js
JSON.parse(localStorage.getItem('pixel-parsnips-state')).state.runHistory.at(-1)
```

Expected: the record's `day` equals the day shown as "Days Survived". If it is one lower, the
bankruptcy early return in Task 2 Step 4 was missed.

- [ ] **Confirm the presentation plan did not leak in**

```bash
git diff --stat master -- src/theme src/index.css tailwind.config.ts
```

Expected: **no output.** Palette work belongs to [plan.md](plan.md) on its own branch.
