# G7 — Market Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add periodic, announced, single-crop yield modifiers (Shortage / Glut) that break the static-crop-value problem, surfaced in the Shop and Day Summary, with all numbers sim-gated.

**Architecture:** A new pure module `src/engine/market.ts` owns every market state transition (schedule / activate / expire / multiplier / flavor), mirroring the `reputation.ts` / `seasons.ts` pattern. `GameState` gains a `market: MarketState` field; `processTurn` calls into the module at fixed points. All tunables live in a new `MarketConfig` block on `EconomyConfig`. UI is read-only derived state in `DailyLog.tsx`, `SeedCard.tsx`, `Shop.tsx`.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind 3.4, Vite 5.4, Vitest. Commands: `npm test`, `npm run lint`, `npm run sim`.

**Spec:** [specs/012-market-events/spec.md](spec.md)

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/engine/types.ts` | Modify | Add `MarketEventKind`, `MarketEvent`, `ActiveMarketEvent`, `MarketState`; add `market` to `GameState`; add `marketActive`/`marketAnnounced` to `DailyLogEntry`. |
| `src/engine/constants.ts` | Modify | Add `MARKET_*` scalar constants; bump `SCHEMA_VERSION` 7→8. |
| `src/engine/economy.ts` | Modify | Add `MarketConfig` interface, `market` field on `EconomyConfig`, `DEFAULT_ECONOMY.market`. |
| `src/engine/market.ts` | Create | Pure market transition + flavor functions. |
| `src/engine/gameEngine.ts` | Modify | `initialGameState.market`; integrate schedule/activate/expire/yield into `processTurn`; populate new log fields. |
| `src/engine/useGameEngine.ts` | Modify | `migrateState` v7→v8 branch + current-schema hardening for `market`. |
| `src/components/DailyLog.tsx` | Modify | Active-event line + tomorrow announcement line. |
| `src/components/SeedCard.tsx` | Modify | Arrow/percent/tint badge for the affected crop. |
| `src/components/Shop.tsx` | Modify | Thread the active event to the right `SeedCard`. |
| `src/components/GameBoard.tsx` | Modify | Pass `state.market.active` to `Shop`. |
| `scripts/sim/economyPresets.ts` | Modify | Add `market` block to `baseline` (off) and `proposed` (on). |
| `scripts/sim/strategies.ts` | Modify | Teach `smartMixed` to react to market; export decision helper for testing. |
| `specs/012-market-events/tuning-results.md` | Create | Record the sim-gating outcome. |
| `backlog.md` | Modify | Mark G7 delivered. |

Test files created/modified: `tests/engine/market.test.ts` (new), `tests/engine/marketConfig.test.ts` (new), `tests/engine/gameEngine.market.test.ts` (new), `tests/engine/useGameEngine.test.ts` (modify — v7→v8 migration), `tests/components/DailyLog.test.tsx` (new or modify), `tests/components/SeedCard.test.tsx` (new or modify), `tests/sim/strategies.test.ts` (modify).

---

## Task 1: MarketConfig, constants, and market types (foundation)

Additive only — no schema bump here (that lands with the state change in Task 3 to keep migration tests green).

**Files:**
- Modify: `src/engine/constants.ts` (after `STREAK_BONUS_CAP`, line ~22)
- Modify: `src/engine/types.ts` (after `WeatherId`, and inside `GameState`)
- Modify: `src/engine/economy.ts` (`EconomyConfig` interface + `DEFAULT_ECONOMY`)
- Test: `tests/engine/marketConfig.test.ts`

- [ ] **Step 1: Add market event types to `types.ts`**

After the `UpgradeTier` type (line ~15), add:

```ts
export type MarketEventKind = 'shortage' | 'glut';

/** A scheduled or active market event affecting one crop's yield. */
export interface MarketEvent {
  cropId: CropId;
  kind: MarketEventKind;
  /** Resolved yield multiplier captured at schedule time (>1 shortage, <1 glut). */
  multiplier: number;
}

/** A market event currently affecting harvests, with its remaining lifetime. */
export interface ActiveMarketEvent extends MarketEvent {
  daysRemaining: number;
}

/** The run's market: at most one of active/pending is set (one-at-a-time invariant). */
export interface MarketState {
  active: ActiveMarketEvent | null;
  pending: MarketEvent | null;
}
```

- [ ] **Step 2: Add `market` to `GameState`**

In `types.ts`, inside `interface GameState`, after `unlockedPlots: number;` add:

```ts
  /** Dynamic crop-pricing state (G7). At most one of active/pending is set. */
  market: MarketState;
```

- [ ] **Step 3: Add `MARKET_*` constants to `constants.ts`**

After `export const STREAK_BONUS_CAP = 4;` add:

```ts
export const MARKET_CADENCE_DAYS = 5;
export const MARKET_FIRE_CHANCE = 0.5;
export const MARKET_SHORTAGE_MULTIPLIER = 1.4;
export const MARKET_GLUT_MULTIPLIER = 0.7;
export const MARKET_DURATION_DAYS = 3;
export const MARKET_ANNOUNCE_LEAD_DAYS = 1;
```

- [ ] **Step 4: Add `MarketConfig` to `economy.ts`**

Update the constants import block at the top of `economy.ts` to also import the new constants:

```ts
import {
  STARTING_BALANCE, PLOT_COUNT, STARTING_PLOTS, PLOT_PRICES, TAX_RATE, FERTILIZER_COST,
  EXHAUSTION_THRESHOLD, EXHAUSTION_RECOVERY_DAYS,
  STREAK_BONUS_PER_LEVEL, STREAK_BONUS_CAP,
  MARKET_CADENCE_DAYS, MARKET_FIRE_CHANCE, MARKET_SHORTAGE_MULTIPLIER,
  MARKET_GLUT_MULTIPLIER, MARKET_DURATION_DAYS, MARKET_ANNOUNCE_LEAD_DAYS,
  CROP_DEFINITIONS, UPGRADE_TIER_DEFINITIONS,
} from './constants';
```

After the `EndlessFormula` interface, add:

```ts
export interface MarketConfig {
  /** Cycle length in days; scheduling rolls when currentDay % cadenceDays === 0. */
  cadenceDays: number;
  /** Probability (0..1) of scheduling an event at a cycle boundary. */
  fireChance: number;
  /** Yield multiplier for a Shortage (>1). */
  shortageMultiplier: number;
  /** Yield multiplier for a Glut (<1). */
  glutMultiplier: number;
  /** Active lifetime in days once an event activates. */
  durationDays: number;
  /** Days between announcement and activation; fixed 1 for this ship. */
  announceLeadDays: number;
}
```

Add `market: MarketConfig;` to the `EconomyConfig` interface (after `streakBonusCap: number;`).

In `DEFAULT_ECONOMY`, after `streakBonusCap: STREAK_BONUS_CAP,` add:

```ts
  market: {
    cadenceDays: MARKET_CADENCE_DAYS,
    fireChance: MARKET_FIRE_CHANCE,
    shortageMultiplier: MARKET_SHORTAGE_MULTIPLIER,
    glutMultiplier: MARKET_GLUT_MULTIPLIER,
    durationDays: MARKET_DURATION_DAYS,
    announceLeadDays: MARKET_ANNOUNCE_LEAD_DAYS,
  },
```

- [ ] **Step 5: Write the failing config test**

Create `tests/engine/marketConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

describe('DEFAULT_ECONOMY.market', () => {
  it('ships the proposed starting numbers', () => {
    expect(DEFAULT_ECONOMY.market).toEqual({
      cadenceDays: 5,
      fireChance: 0.5,
      shortageMultiplier: 1.4,
      glutMultiplier: 0.7,
      durationDays: 3,
      announceLeadDays: 1,
    });
  });

  it('keeps shortage above and glut below 1.0', () => {
    expect(DEFAULT_ECONOMY.market.shortageMultiplier).toBeGreaterThan(1);
    expect(DEFAULT_ECONOMY.market.glutMultiplier).toBeLessThan(1);
  });
});
```

- [ ] **Step 6: Run the test**

Run: `npm test -- marketConfig`
Expected: PASS (3 assertions). If TS errors about `market` missing on `GameState`, that is expected to be resolved once Task 3 sets it in `initialGameState`; this task does not touch `initialGameState`, so the type error surfaces in `gameEngine.ts`. To keep the build green between tasks, proceed to Step 7 which defers that — **do not** add `market` to `GameState` until you can also initialize it. See note.

> **Build-ordering note:** Adding `market` as a required field to `GameState` (Step 2) makes `initialGameState` (Task 3) and every `{ ...state }` spread that constructs a *new shape* fail type-check until initialized. Spreads like `{ ...state, coinBalance }` keep `market` automatically, so only `initialGameState` needs an explicit value. Therefore **combine Step 2's `GameState` field with Task 3 Step 1** if you run a strict typecheck between tasks. Tests in this task (`marketConfig`) do not depend on `GameState`, so they pass regardless.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/constants.ts src/engine/economy.ts tests/engine/marketConfig.test.ts
git commit -m "feat(012): market config + event types"
```

---

## Task 2: Pure market module

**Files:**
- Create: `src/engine/market.ts`
- Test: `tests/engine/market.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/market.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  marketMultiplierFor, activatePending, expireActive, rollSchedule,
  announceText, activeText, EMPTY_MARKET,
} from '../../src/engine/market';
import type { MarketConfig } from '../../src/engine/economy';
import type { ActiveMarketEvent, MarketState } from '../../src/engine/types';

const cfg: MarketConfig = {
  cadenceDays: 5, fireChance: 0.5,
  shortageMultiplier: 1.4, glutMultiplier: 0.7,
  durationDays: 3, announceLeadDays: 1,
};

/** Deterministic RNG that yields the given sequence, then repeats the last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('marketMultiplierFor', () => {
  const active: ActiveMarketEvent = { cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 2 };
  it('returns the multiplier for the affected crop', () => {
    expect(marketMultiplierFor(active, 'pumpkin')).toBe(0.7);
  });
  it('returns 1 for an unaffected crop', () => {
    expect(marketMultiplierFor(active, 'radish')).toBe(1);
  });
  it('returns 1 when no active event', () => {
    expect(marketMultiplierFor(null, 'pumpkin')).toBe(1);
  });
});

describe('activatePending', () => {
  it('promotes pending to active with full duration', () => {
    const m: MarketState = { active: null, pending: { cropId: 'radish', kind: 'shortage', multiplier: 1.4 } };
    const out = activatePending(m, cfg);
    expect(out.active).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 3 });
    expect(out.pending).toBeNull();
  });
  it('is a no-op when nothing is pending', () => {
    const m: MarketState = { active: { cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }, pending: null };
    expect(activatePending(m, cfg)).toBe(m);
  });
});

describe('expireActive', () => {
  it('decrements daysRemaining', () => {
    expect(expireActive({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 3 }))
      .toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 });
  });
  it('clears at 0', () => {
    expect(expireActive({ cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 1 })).toBeNull();
  });
  it('returns null for null', () => {
    expect(expireActive(null)).toBeNull();
  });
});

describe('rollSchedule', () => {
  it('schedules a shortage on a boundary day when the fire roll passes', () => {
    // draws: fire (0.1 < 0.5 ✓), crop (0.0 -> radish), kind (0.4 < 0.5 -> shortage)
    const ev = rollSchedule(EMPTY_MARKET, 5, cfg, seq([0.1, 0.0, 0.4]));
    expect(ev).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4 });
  });
  it('schedules a glut when the kind roll is >= 0.5', () => {
    // fire ✓, crop 0.9 -> pumpkin (index 2), kind 0.9 -> glut
    const ev = rollSchedule(EMPTY_MARKET, 10, cfg, seq([0.1, 0.9, 0.9]));
    expect(ev).toEqual({ cropId: 'pumpkin', kind: 'glut', multiplier: 0.7 });
  });
  it('does not schedule off a boundary day', () => {
    expect(rollSchedule(EMPTY_MARKET, 6, cfg, seq([0.1, 0.0, 0.4]))).toBeNull();
  });
  it('does not schedule when the fire roll fails', () => {
    expect(rollSchedule(EMPTY_MARKET, 5, cfg, seq([0.9]))).toBeNull();
  });
  it('does not schedule when an event is already active', () => {
    const m: MarketState = { active: { cropId: 'radish', kind: 'shortage', multiplier: 1.4, daysRemaining: 1 }, pending: null };
    expect(rollSchedule(m, 5, cfg, seq([0.1, 0.0, 0.4]))).toBeNull();
  });
  it('does not schedule when an event is already pending', () => {
    const m: MarketState = { active: null, pending: { cropId: 'radish', kind: 'shortage', multiplier: 1.4 } };
    expect(rollSchedule(m, 5, cfg, seq([0.1, 0.0, 0.4]))).toBeNull();
  });
});

describe('flavor text', () => {
  it('announces a shortage and a glut', () => {
    expect(announceText({ cropId: 'parsnip', kind: 'shortage', multiplier: 1.4 }))
      .toBe('Parsnips are scarce — prices up!');
    expect(announceText({ cropId: 'radish', kind: 'glut', multiplier: 0.7 }))
      .toBe('The market is flooded with Radishes — prices down.');
  });
  it('describes an active event with percent and days left', () => {
    expect(activeText({ cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }))
      .toBe('Pumpkins shortage: yield +40% (2 days left)');
    expect(activeText({ cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 1 }))
      .toBe('Pumpkins glut: yield -30% (1 day left)');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- engine/market.test`
Expected: FAIL — `Cannot find module '../../src/engine/market'`.

- [ ] **Step 3: Implement `market.ts`**

Create `src/engine/market.ts`:

```ts
import type { CropId, MarketEvent, ActiveMarketEvent, MarketState } from './types';
import type { MarketConfig } from './economy';

const CROP_IDS: readonly CropId[] = ['radish', 'parsnip', 'pumpkin'];

const CROP_PLURAL: Record<CropId, string> = {
  radish: 'Radishes',
  parsnip: 'Parsnips',
  pumpkin: 'Pumpkins',
};

/** The starting/empty market: no active or pending event. */
export const EMPTY_MARKET: MarketState = { active: null, pending: null };

/** Yield multiplier for `cropId` under the current active event (1 if unaffected). Pure. */
export function marketMultiplierFor(active: ActiveMarketEvent | null, cropId: CropId): number {
  return active !== null && active.cropId === cropId ? active.multiplier : 1;
}

/** Promote a pending event to active with a full lifetime. No-op if nothing pending. Pure. */
export function activatePending(market: MarketState, config: MarketConfig): MarketState {
  if (market.pending === null) return market;
  return {
    active: { ...market.pending, daysRemaining: config.durationDays },
    pending: null,
  };
}

/** Decrement an active event; return the survivor or null when it expires. Pure. */
export function expireActive(active: ActiveMarketEvent | null): ActiveMarketEvent | null {
  if (active === null) return null;
  const daysRemaining = active.daysRemaining - 1;
  return daysRemaining > 0 ? { ...active, daysRemaining } : null;
}

/**
 * At a cycle boundary with no active/pending event, maybe schedule one.
 * Consumes up to three rng draws (fire, crop, kind). Returns the event or null. Pure.
 */
export function rollSchedule(
  market: MarketState,
  currentDay: number,
  config: MarketConfig,
  rng: () => number,
): MarketEvent | null {
  if (market.active !== null || market.pending !== null) return null;
  if (currentDay % config.cadenceDays !== 0) return null;
  if (rng() >= config.fireChance) return null;

  const cropId = CROP_IDS[Math.min(CROP_IDS.length - 1, Math.floor(rng() * CROP_IDS.length))];
  const isShortage = rng() < 0.5;
  return {
    cropId,
    kind: isShortage ? 'shortage' : 'glut',
    multiplier: isShortage ? config.shortageMultiplier : config.glutMultiplier,
  };
}

/** One-line announcement for a scheduled (tomorrow's) event. */
export function announceText(ev: MarketEvent): string {
  return ev.kind === 'shortage'
    ? `${CROP_PLURAL[ev.cropId]} are scarce — prices up!`
    : `The market is flooded with ${CROP_PLURAL[ev.cropId]} — prices down.`;
}

/** One-line description for the currently active event. */
export function activeText(ev: ActiveMarketEvent): string {
  const pct = Math.round((ev.multiplier - 1) * 100);
  const sign = pct >= 0 ? '+' : '';
  const days = ev.daysRemaining === 1 ? 'day' : 'days';
  return `${CROP_PLURAL[ev.cropId]} ${ev.kind}: yield ${sign}${pct}% (${ev.daysRemaining} ${days} left)`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- engine/market.test`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/engine/market.ts tests/engine/market.test.ts
git commit -m "feat(012): pure market module (schedule/activate/expire/flavor)"
```

---

## Task 3: Game state — init, schema bump, migration

**Files:**
- Modify: `src/engine/gameEngine.ts` (`initialGameState`)
- Modify: `src/engine/constants.ts` (`SCHEMA_VERSION` 7→8)
- Modify: `src/engine/useGameEngine.ts` (`migrateState`)
- Test: `tests/engine/useGameEngine.test.ts` (add v7→v8 cases), `tests/engine/gameEngine.test.ts` (initialGameState)

- [ ] **Step 1: Initialize `market` in `initialGameState`**

In `gameEngine.ts`, add an import:

```ts
import { EMPTY_MARKET } from './market';
```

In the returned object of `initialGameState`, after `unlockedPlots: config.startingPlots,` add:

```ts
    market: EMPTY_MARKET,
```

- [ ] **Step 2: Write the failing init test**

Add to `tests/engine/gameEngine.test.ts` (inside the existing `initialGameState` describe, or a new one):

```ts
import { initialGameState } from '../../src/engine/gameEngine';
// ...
it('starts with an empty market', () => {
  expect(initialGameState().market).toEqual({ active: null, pending: null });
});
```

Run: `npm test -- engine/gameEngine.test -t "empty market"`
Expected: PASS once Step 1 is in (FAIL — `market` undefined — if you run before Step 1).

- [ ] **Step 3: Bump `SCHEMA_VERSION`**

In `constants.ts`, change:

```ts
export const SCHEMA_VERSION = 7;
```
to
```ts
export const SCHEMA_VERSION = 8;
```

- [ ] **Step 4: Add v7→v8 migration + harden current schema**

In `useGameEngine.ts` `migrateState`, the current-schema branch is `if (parsed.schemaVersion === SCHEMA_VERSION)` — it now matches 8. Inside that branch, before the `return`, harden `market`:

```ts
    const market =
      st.market && typeof st.market === 'object'
        ? (st.market as GameState['market'])
        : { active: null, pending: null };
```
and add `market,` to the returned object (alongside `plots`, `unlockedPlots`, `schemaVersion`).

Then add a new branch **before** the `// Schema 6 → 7` branch:

```ts
  // Schema 7 → 8 — add market (existing runs continue with no event)
  if (parsed.schemaVersion === 7) {
    console.info('[PixelParsnips] Migrating save from v7 to v8 (Market Events).');
    const st = parsed.state as Record<string, unknown>;
    return {
      ...(st as unknown as Omit<GameState, 'market'>),
      schemaVersion: SCHEMA_VERSION,
      market: { active: null, pending: null },
    };
  }
```

Update each older chained branch (v6→, v5→, v4→, v3→) to also add `market: { active: null, pending: null },` and widen their `Omit<...>` to include `'market'`. For example the v6 branch becomes:

```ts
  // Schema 6 → 8 — add unlockedPlots + market (existing runs keep all plots unlocked)
  if (parsed.schemaVersion === 6) {
    console.info('[PixelParsnips] Migrating save from v6 to v8.');
    const st = parsed.state as Record<string, unknown>;
    return {
      ...(st as unknown as Omit<GameState, 'unlockedPlots' | 'market'>),
      schemaVersion: SCHEMA_VERSION,
      unlockedPlots: Array.isArray(st.plots) ? st.plots.length : DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    };
  }
```

Apply the same pattern (add `| 'market'` to the `Omit`, add the `market` field, update the log/comment to say "to v8") to the v5, v4, and v3 branches.

- [ ] **Step 5: Write the failing migration tests**

Add to `tests/engine/useGameEngine.test.ts`. Match the existing migration-test pattern in that file (it builds a `localStorage` payload and calls the load path). If the file tests `migrateState` indirectly via render, follow that; otherwise add direct cases mirroring existing ones, e.g.:

```ts
it('migrates a v7 save to v8 with an empty market', () => {
  const v7 = { schemaVersion: 7, state: makeValidStateShape({ schemaVersion: 7 }) };
  localStorage.setItem('pixel-parsnips-state', JSON.stringify(v7));
  const { result } = renderHook(() => useGameEngine());
  expect(result.current.state.schemaVersion).toBe(8);
  expect(result.current.state.market).toEqual({ active: null, pending: null });
});

it('hardens a v8 save missing the market field', () => {
  const v8 = { schemaVersion: 8, state: makeValidStateShape({ schemaVersion: 8, market: undefined }) };
  localStorage.setItem('pixel-parsnips-state', JSON.stringify(v8));
  const { result } = renderHook(() => useGameEngine());
  expect(result.current.state.market).toEqual({ active: null, pending: null });
});
```

> Use whatever state-builder/helper the existing migration tests in this file already use (e.g. an existing `makeValidStateShape` or inline object). If none exists, copy the shape from an existing v6→v7 test in the same file and add/remove `market`. Do not invent a helper that isn't there — reuse the file's established pattern.

- [ ] **Step 6: Run the suite**

Run: `npm test -- engine/useGameEngine.test engine/gameEngine.test`
Expected: PASS, including the new v7→v8 and hardening cases. Existing v3–v6 migration tests must still pass (they now also carry `market`); if any asserts a full-object `toEqual`, add `market: { active: null, pending: null }` to its expected value.

- [ ] **Step 7: Commit**

```bash
git add src/engine/gameEngine.ts src/engine/constants.ts src/engine/useGameEngine.ts tests/engine/useGameEngine.test.ts tests/engine/gameEngine.test.ts
git commit -m "feat(012): GameState.market + schema 7->8 migration"
```

---

## Task 4: processTurn integration

**Files:**
- Modify: `src/engine/types.ts` (`DailyLogEntry` fields)
- Modify: `src/engine/gameEngine.ts` (`processTurn`)
- Test: `tests/engine/gameEngine.market.test.ts` (new)

- [ ] **Step 1: Add log fields to `DailyLogEntry`**

In `types.ts`, inside `interface DailyLogEntry`, after `streakBonus: number;` add:

```ts
  /** Active market event affecting THIS turn's harvest (post-activation), or null. */
  marketActive: ActiveMarketEvent | null;
  /** Event scheduled THIS turn to take effect next turn, or null. */
  marketAnnounced: MarketEvent | null;
```

(These reference `ActiveMarketEvent`/`MarketEvent` already defined in `types.ts` from Task 1.)

- [ ] **Step 2: Write the failing integration tests**

Create `tests/engine/gameEngine.market.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn, plantSeed } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY, type EconomyConfig } from '../../src/engine/economy';
import { coins } from '../../src/engine/constants';
import type { GameState } from '../../src/engine/types';

/** rng that never fires market scheduling (>= fireChance) and never destroys pests. */
const NO_FIRE = () => 1;

/** Helper: a state with one pumpkin planted on plot 0, ready to harvest this turn. */
function pumpkinReady(overrides: Partial<GameState> = {}): GameState {
  const base = initialGameState();
  const plots = base.plots.map(p =>
    p.id === 0
      ? { ...p, cropId: 'pumpkin' as const, dayPlanted: 1, daysRemaining: 0 }
      : p,
  );
  return { ...base, plots, ...overrides };
}

describe('processTurn — market scheduling', () => {
  it('schedules a pending event on a boundary day and announces it', () => {
    // fire passes (0.1), crop 0.0 -> radish, kind 0.4 -> shortage
    const rng = (() => { const v = [0.1, 0.0, 0.4]; let i = 0; return () => v[Math.min(i++, v.length - 1)]; })();
    const state = { ...initialGameState(), currentDay: 5 };
    const { state: next, log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng);
    expect(next.market.pending).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4 });
    expect(next.market.active).toBeNull();
    expect(log.marketAnnounced).toEqual({ cropId: 'radish', kind: 'shortage', multiplier: 1.4 });
    expect(log.marketActive).toBeNull();
  });

  it('does not schedule off a boundary day', () => {
    const state = { ...initialGameState(), currentDay: 6 };
    const { state: next } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.1);
    expect(next.market.pending).toBeNull();
  });
});

describe('processTurn — market activation, yield, expiry', () => {
  it('activates a pending event and applies the multiplier to the matching crop', () => {
    const state = pumpkinReady({
      currentDay: 6,
      market: { active: null, pending: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4 } },
    });
    const { state: next, log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    const expected = coins(DEFAULT_ECONOMY.crops.pumpkin.baseYield * 1.0 * 1.4);
    expect(log.harvests[0].adjustedYield).toBe(expected);
    expect(log.marketActive).toEqual({ cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 3 });
    // expiry decremented at end of turn
    expect(next.market.active?.daysRemaining).toBe(2);
  });

  it('does not affect a non-matching crop', () => {
    const state = pumpkinReady({
      currentDay: 6,
      market: { active: null, pending: { cropId: 'radish', kind: 'glut', multiplier: 0.7 } },
    });
    const { log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    const expected = coins(DEFAULT_ECONOMY.crops.pumpkin.baseYield * 1.0 * 1.0);
    expect(log.harvests[0].adjustedYield).toBe(expected);
  });

  it('stacks multiplicatively with weather', () => {
    const state = pumpkinReady({
      currentDay: 6,
      market: { active: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 }, pending: null },
    });
    const { log } = processTurn(state, 'warm_breeze', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    const expected = coins(DEFAULT_ECONOMY.crops.pumpkin.baseYield * 1.2 * 1.4);
    expect(log.harvests[0].adjustedYield).toBe(expected);
  });

  it('expires an active event after its last day', () => {
    const state = pumpkinReady({
      currentDay: 7,
      market: { active: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 1 }, pending: null },
    });
    const { state: next, log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    expect(log.marketActive?.daysRemaining).toBe(1); // affected this harvest
    expect(next.market.active).toBeNull();            // cleared afterward
  });

  it('preserves a carried-over active event in the log when nothing is pending', () => {
    const state = pumpkinReady({
      currentDay: 7,
      market: { active: { cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 3 }, pending: null },
    });
    const { log } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, NO_FIRE);
    expect(log.marketActive?.cropId).toBe('pumpkin');
  });
});

describe('processTurn — market on bankruptcy', () => {
  it('records the active event and does not schedule when the run ends', () => {
    // No income, low balance -> bankrupt. Active glut present.
    const state: GameState = {
      ...initialGameState(),
      currentDay: 5,
      coinBalance: 0,
      market: { active: { cropId: 'pumpkin', kind: 'glut', multiplier: 0.7, daysRemaining: 2 }, pending: null },
    };
    const { state: next, log, isBankrupt } = processTurn(state, 'sunny', undefined, undefined, DEFAULT_ECONOMY, () => 0.1);
    expect(isBankrupt).toBe(true);
    expect(log.marketActive?.cropId).toBe('pumpkin');
    expect(log.marketAnnounced).toBeNull();
    expect(next.market.pending).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- engine/gameEngine.market.test`
Expected: FAIL — `processTurn` does not yet set/read market; TS errors on missing log fields.

- [ ] **Step 4: Integrate market into `processTurn`**

In `gameEngine.ts`, extend the market import:

```ts
import { EMPTY_MARKET, activatePending, expireActive, marketMultiplierFor, rollSchedule } from './market';
```

**(4a) Activate before harvest.** After the `season` line at the top of `processTurn` (before Step 1), add:

```ts
  // Market Step A: activate any pending event so its modifier applies to THIS harvest.
  const marketAfterActivate = activatePending(state.market, config.market);
  const activeMarket = marketAfterActivate.active;
```

**(4b) Apply the modifier in harvest.** In the Step 3 harvest `.map`, replace:

```ts
    const adjustedYield = coins(crop.baseYield * weather.multiplier);
```
with:
```ts
    const marketMod = marketMultiplierFor(activeMarket, plot.cropId);
    const adjustedYield = coins(crop.baseYield * weather.multiplier * marketMod);
```

**(4c) Bankruptcy branch.** In the early-return bankrupt `log` object, add after `streakBonus,`:

```ts
      marketActive: activeMarket,
      marketAnnounced: null,
```
and in the `bankruptState` object, add after `peakHarvestStreak,`:

```ts
      market: marketAfterActivate,
```

**(4d) Expire + schedule for the surviving path.** After the `peakBalance` line (Step 9) and before building the final `log`, add:

```ts
  // Market Step B: expire the active event, then maybe schedule a new one at a boundary.
  const activeAfterExpire = expireActive(activeMarket);
  const scheduled = rollSchedule(
    { active: activeAfterExpire, pending: null },
    state.currentDay,
    config.market,
    rng,
  );
  const nextMarket = { active: activeAfterExpire, pending: scheduled };
```

**(4e) Final log fields.** In the final `log` object, add after `streakBonus,`:

```ts
    marketActive: activeMarket,
    marketAnnounced: scheduled,
```

**(4f) nextState.** In `nextState`, add after `peakHarvestStreak,`:

```ts
    market: nextMarket,
```

> Ordering: `activeMarket` (post-activation) is what drives both yield and `log.marketActive`, so a freshly-activated *and* a carried-over event are both recorded. `rollSchedule` runs on the post-expiry market, guaranteeing it never reschedules onto a still-active event.

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- engine/gameEngine.market.test`
Expected: PASS (all cases).

- [ ] **Step 6: Run the full engine suite and fix determinism fallout**

Run: `npm test -- engine`
Expected: Most pass. **Likely failures:** multi-turn tests in `tests/engine/gameEngine.test.ts` (and possibly `seasonTransition.test.ts`) that loop `processTurn` across a day-5/10/… boundary with the default `rng = Math.random` — random scheduling now perturbs later yields, or strict `toEqual` on a full `log`/`state` object now misses `marketActive`/`marketAnnounced`/`market`.

Fix pattern, applied only to the failing assertions:
- For multi-turn loops asserting exact balances: pass a no-fire rng as the 6th arg so no event is ever scheduled:
  ```ts
  processTurn(s, weatherId, undefined, undefined, DEFAULT_ECONOMY, () => 1)
  ```
  (`() => 1` ≥ `fireChance` so nothing schedules, and `1 < 0.5` is false so pests never trigger either.)
- For full-object `toEqual` on a log: add `marketActive: null, marketAnnounced: null` to the expected object (when that turn is not a boundary / has no event).
- For full-object `toEqual` on a state: add `market: { active: null, pending: null }`.

Do not broaden these edits beyond what fails. Re-run `npm test -- engine` until green.

- [ ] **Step 7: Commit**

```bash
git add src/engine/types.ts src/engine/gameEngine.ts tests/engine/gameEngine.market.test.ts tests/engine/gameEngine.test.ts tests/engine/seasonTransition.test.ts
git commit -m "feat(012): apply market modifier in processTurn + log fields"
```

---

## Task 5: Day Summary UI

**Files:**
- Modify: `src/components/DailyLog.tsx`
- Test: `tests/components/DailyLog.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Add to `tests/components/DailyLog.test.tsx` (create the file if absent, mirroring an existing component test's imports — `render`, `screen` from `@testing-library/react`). Build a minimal valid `DailyLogEntry`; copy the shape an existing DailyLog test uses if present, otherwise:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyLog } from '../../src/components/DailyLog';
import type { DailyLogEntry } from '../../src/engine/types';

function baseLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 5, weatherId: 'sunny', weatherMultiplier: 1, harvests: [],
    totalHarvestIncome: 0, openingBalance: 100, landLeaseDeducted: 15,
    taxRate: 0.06, taxDeducted: 5, netChange: -20, closingBalance: 80,
    exhaustedPlots: [], pestDestroyedPlots: [], flashDroughtDaysAfter: 0,
    streakBefore: 0, streakAfter: 0, streakBonus: 0,
    marketActive: null, marketAnnounced: null, ...over,
  };
}

describe('DailyLog — market', () => {
  it('shows the active event line', () => {
    render(<DailyLog log={baseLog({
      marketActive: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 },
    })} />);
    expect(screen.getByText(/Pumpkins shortage: yield \+40% \(2 days left\)/)).toBeInTheDocument();
  });

  it('shows the tomorrow announcement line', () => {
    render(<DailyLog log={baseLog({
      marketAnnounced: { cropId: 'radish', kind: 'glut', multiplier: 0.7 },
    })} />);
    expect(screen.getByText(/Tomorrow:/)).toBeInTheDocument();
    expect(screen.getByText(/flooded with Radishes/)).toBeInTheDocument();
  });

  it('shows neither line when there is no market activity', () => {
    render(<DailyLog log={baseLog()} />);
    expect(screen.queryByText(/Tomorrow:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/yield/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- DailyLog`
Expected: FAIL — market lines not rendered.

- [ ] **Step 3: Render the market lines**

In `DailyLog.tsx`, add the import:

```ts
import { announceText, activeText } from '../engine/market';
```

Insert this block after the weather badge `</div>` (after the block ending around line 75, before the harvest line-items):

```tsx
      {/* Active market event */}
      {log.marketActive && (
        <div
          aria-label="Market event"
          className={
            log.marketActive.kind === 'shortage'
              ? 'flex items-center gap-1 px-2 py-1 rounded bg-farm-grass/20 border border-farm-grass/40 text-farm-parchment'
              : 'flex items-center gap-1 px-2 py-1 rounded bg-farm-red/20 border border-farm-red/40 text-farm-parchment'
          }
        >
          <span aria-hidden="true">📊</span>
          <span>{activeText(log.marketActive)}</span>
        </div>
      )}

      {/* Tomorrow's announced market event */}
      {log.marketAnnounced && (
        <div
          aria-label="Market forecast"
          className="flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/10 text-farm-stone"
        >
          <span aria-hidden="true">📈</span>
          <span>Tomorrow: {announceText(log.marketAnnounced)}</span>
        </div>
      )}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- DailyLog`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/components/DailyLog.tsx tests/components/DailyLog.test.tsx
git commit -m "feat(012): market lines in Day Summary"
```

---

## Task 6: Shop seed-card indicator

**Files:**
- Modify: `src/components/SeedCard.tsx`
- Modify: `src/components/Shop.tsx`
- Modify: `src/components/GameBoard.tsx`
- Test: `tests/components/SeedCard.test.tsx`

- [ ] **Step 1: Write the failing SeedCard test**

Add to `tests/components/SeedCard.test.tsx` (create if absent; reuse an existing component test's render setup). The card gains an optional `marketEvent` prop:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeedCard } from '../../src/components/SeedCard';

const noop = () => {};

function renderCard(marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number }) {
  render(
    <SeedCard
      cropId="pumpkin" price={20} seedCount={0}
      onBuy={noop} onSelect={noop} canAfford
      isSelected={false} marketEvent={marketEvent}
    />,
  );
}

describe('SeedCard — market indicator', () => {
  it('shows an up arrow and percent for a shortage', () => {
    renderCard({ kind: 'shortage', multiplier: 1.4 });
    expect(screen.getByText(/▲ \+40%/)).toBeInTheDocument();
  });
  it('shows a down arrow and percent for a glut', () => {
    renderCard({ kind: 'glut', multiplier: 0.7 });
    expect(screen.getByText(/▼ -30%/)).toBeInTheDocument();
  });
  it('shows no indicator when there is no market event', () => {
    renderCard(undefined);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- SeedCard`
Expected: FAIL — `marketEvent` prop / badge not present.

- [ ] **Step 3: Add the indicator to `SeedCard`**

In `SeedCard.tsx`, add to `SeedCardProps`:

```ts
  /** Active market event for THIS crop, if any (drives the price-direction badge). */
  marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number };
```

Add `marketEvent` to the destructured props. Compute the badge near `netProfit`:

```ts
  const marketPct = marketEvent ? Math.round((marketEvent.multiplier - 1) * 100) : 0;
  const marketLabel = marketEvent
    ? `${marketEvent.kind === 'shortage' ? '▲' : '▼'} ${marketPct >= 0 ? '+' : ''}${marketPct}%`
    : null;
```

Render the badge inside the top row, after the `seedCount` badge (inside the `flex items-center justify-between` div):

```tsx
        {marketLabel && (
          <span
            aria-label={`Market ${marketEvent!.kind}`}
            className={[
              'text-xs font-pixel px-1.5 py-0.5 rounded',
              marketEvent!.kind === 'shortage'
                ? 'bg-farm-grass/30 text-farm-grass'
                : 'bg-farm-red/30 text-farm-red',
            ].join(' ')}
          >
            {marketLabel}
          </span>
        )}
```

Optionally tint the card border to match (keep minimal — the badge is the primary signal).

- [ ] **Step 4: Thread the event through `Shop`**

In `Shop.tsx`, add to `ShopProps`:

```ts
  marketActive: import('../engine/types').ActiveMarketEvent | null;
```

> Prefer a top-of-file `import type { ActiveMarketEvent } from '../engine/types';` and use `marketActive: ActiveMarketEvent | null;` in the interface — match the file's existing import style.

Destructure `marketActive`, and in the `CROP_IDS.map` pass the per-crop event to `SeedCard`:

```tsx
              <SeedCard
                key={cropId}
                cropId={cropId}
                price={price}
                seedCount={seedInventory[cropId]}
                onBuy={onBuySeed}
                onSelect={onSelectCrop}
                canAfford={coinBalance >= price}
                isSelected={selectedCrop === cropId}
                marketEvent={
                  marketActive && marketActive.cropId === cropId
                    ? { kind: marketActive.kind, multiplier: marketActive.multiplier }
                    : undefined
                }
              />
```

- [ ] **Step 5: Pass `marketActive` from `GameBoard`**

In `GameBoard.tsx`, in the `<Shop ... />` element, add:

```tsx
            marketActive={state.market.active}
```

- [ ] **Step 6: Run to verify pass + typecheck**

Run: `npm test -- SeedCard Shop`
Expected: PASS. Then `npm run lint` and a build/typecheck (`npx tsc --noEmit` if available, else `npm run build`) to confirm `GameBoard`/`Shop` props line up.

- [ ] **Step 7: Commit**

```bash
git add src/components/SeedCard.tsx src/components/Shop.tsx src/components/GameBoard.tsx tests/components/SeedCard.test.tsx
git commit -m "feat(012): shop seed-card market indicator"
```

---

## Task 7: Simulator integration

**Files:**
- Modify: `scripts/sim/economyPresets.ts`
- Modify: `scripts/sim/strategies.ts`
- Test: `tests/sim/strategies.test.ts`

- [ ] **Step 1: Add `market` to the sim presets**

In `economyPresets.ts`, add a `market` block to both presets. `baseline` keeps events **off** (frozen comparison), `proposed` turns them **on**:

```ts
// in `baseline` object:
  market: { cadenceDays: 5, fireChance: 0, shortageMultiplier: 1.4, glutMultiplier: 0.7, durationDays: 3, announceLeadDays: 1 },
```
```ts
// in `proposed` object:
  market: { cadenceDays: 5, fireChance: 0.5, shortageMultiplier: 1.4, glutMultiplier: 0.7, durationDays: 3, announceLeadDays: 1 },
```

> `baseline` spreads `DEFAULT_ECONOMY` which now includes `market`; overriding it with `fireChance: 0` keeps the baseline preset event-free so the pre-012 difficulty comparison stays valid.

- [ ] **Step 2: Write the failing strategy-helper test**

Add to `tests/sim/strategies.test.ts`:

```ts
import { pickCropWithMarket } from '../../scripts/sim/strategies';

describe('pickCropWithMarket', () => {
  const base = 'pumpkin' as const;
  it('prefers the crop under an active shortage', () => {
    const active = { cropId: 'radish' as const, kind: 'shortage' as const, multiplier: 1.4, daysRemaining: 2 };
    expect(pickCropWithMarket(base, active, null)).toBe('radish');
  });
  it('prefers the crop under a pending shortage when none active', () => {
    const pending = { cropId: 'parsnip' as const, kind: 'shortage' as const, multiplier: 1.4 };
    expect(pickCropWithMarket(base, null, pending)).toBe('parsnip');
  });
  it('avoids planting the crop under a glut (falls back to base or radish)', () => {
    const active = { cropId: 'pumpkin' as const, kind: 'glut' as const, multiplier: 0.7, daysRemaining: 2 };
    expect(pickCropWithMarket('pumpkin', active, null)).not.toBe('pumpkin');
  });
  it('returns the base pick when the market is quiet', () => {
    expect(pickCropWithMarket(base, null, null)).toBe('pumpkin');
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- sim/strategies`
Expected: FAIL — `pickCropWithMarket` not exported.

- [ ] **Step 4: Implement market-aware picking in `strategies.ts`**

Add imports:

```ts
import type { ActiveMarketEvent, MarketEvent, CropId } from '../../src/engine/types';
```
(extend the existing `CropId` import rather than duplicating.)

Add the exported helper:

```ts
/**
 * Adjust a base crop choice for the current market: chase a shortage, dodge a glut.
 * `active` takes precedence over `pending` (it affects harvests now).
 */
export function pickCropWithMarket(
  basePick: CropId,
  active: ActiveMarketEvent | null,
  pending: MarketEvent | null,
): CropId {
  const shortage =
    (active && active.kind === 'shortage' ? active : null) ??
    (pending && pending.kind === 'shortage' ? pending : null);
  if (shortage) return shortage.cropId;

  const glut = active && active.kind === 'glut' ? active : null;
  if (glut && glut.cropId === basePick) {
    return basePick === 'radish' ? 'parsnip' : 'radish';
  }
  return basePick;
}
```

Wire it into `smartMixed`'s `pick`:

```ts
const smartMixed: Strategy = (state, config) => {
  let s = maybeUpgrade(state, config);
  const pick = (cur: GameState): CropId => {
    const base: CropId = cur.coinBalance > 250 ? 'pumpkin' : cur.coinBalance > 60 ? 'parsnip' : 'radish';
    return pickCropWithMarket(base, cur.market.active, cur.market.pending);
  };
  for (let round = 0; round < 3; round++) {
    s = fillBoard(s, config, pick);
    const expanded = maybeBuyPlots(s, config);
    if (expanded.unlockedPlots === s.unlockedPlots) { s = expanded; break; }
    s = expanded;
  }
  return s;
};
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- sim/strategies`
Expected: PASS (4 new cases + existing).

- [ ] **Step 6: Commit**

```bash
git add scripts/sim/economyPresets.ts scripts/sim/strategies.ts tests/sim/strategies.test.ts
git commit -m "feat(012): sim presets + market-aware smartMixed"
```

---

## Task 8: Balance gating, promotion, and backlog

**Files:**
- Create: `specs/012-market-events/tuning-results.md`
- Modify: `src/engine/constants.ts` (only if the sim says the starting numbers must change)
- Modify: `backlog.md`

- [ ] **Step 1: Run the simulator on the proposed economy**

Run: `npm run sim -- --strategies smartMixed --trials 500`
Capture: win %, bankrupt %, target-miss %, wealth overshoot, per-season clear rates.

- [ ] **Step 2: Compare against the gate**

The gate (from 009/010): `smartMixed` must land in **15–35% win / ≈1.0–1.3× overshoot**.

- If inside the band → numbers are good; no constant changes needed.
- If win % too high / overshoot inflated → lower `MARKET_FIRE_CHANCE` first (e.g. 0.5 → 0.35), re-run. Then, if needed, compress magnitudes (`shortageMultiplier` toward 1.3, `glutMultiplier` toward 0.75). Re-run after each change. Edit the values in `src/engine/constants.ts` (which flow into `DEFAULT_ECONOMY`) and the `proposed` preset's `market` block in lockstep.
- If win % too low → raise `fireChance` or shortage magnitude similarly.

Iterate `npm run sim` until `smartMixed` is in band. Confirm single-crop bots (`radishOnly`/`parsnipOnly`/`pumpkinOnly`) still fail.

- [ ] **Step 3: Write `tuning-results.md`**

Create `specs/012-market-events/tuning-results.md` with: the pre/post sim numbers, the final promoted `MarketConfig` values, and a one-paragraph reading of whether market events moved difficulty (expected: small, since one crop at a time dilutes EV). Mirror the structure of `specs/010-plot-progression-rebalance/tuning-results.md`.

- [ ] **Step 4: Update the backlog**

In `backlog.md`, mark G7 done. Edit the G7 row (line ~28) to prefix `✅` and append a delivery note, and update the "Market events" row in the Cross-Document Consensus Summary (line ~73) and the Phase 3 line (line ~96). Example G7 note:

```
**DONE (2026-06-16).** Shipped as [012-market-events](specs/012-market-events/spec.md) — fixed 5-day cycle, one event at a time (shortage +X% / glut −Y%), announced 1 day ahead, surfaced in Shop seed-card + Day Summary (no HUD chip). Pure src/engine/market.ts; schema 7→8. Sim-gated: smartMixed stayed in the 15–35% band (see tuning-results.md).
```
(Use the actual promoted percentages from Step 2.)

- [ ] **Step 5: Full verification**

Run: `npm test`
Expected: PASS (entire suite).
Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add specs/012-market-events/tuning-results.md backlog.md src/engine/constants.ts scripts/sim/economyPresets.ts
git commit -m "feat(012): sim-tune + promote market numbers; mark G7 done"
```

---

## Self-Review

**Spec coverage:**
- Cycle/scheduling/announce-ahead → Task 2 (`rollSchedule`), Task 4 (4a/4d). ✓
- Yield integration (3rd multiplier, before tax) → Task 4 (4b). ✓
- Concurrency one-at-a-time → `rollSchedule` guards (Task 2) + tests. ✓
- Starting numbers as `MarketConfig` → Task 1; sim-gated promotion → Task 8. ✓
- `GameState.market` + schema 7→8 + migration + hardening → Task 3. ✓
- `DailyLogEntry` fields → Task 4. ✓
- Multiplier frozen at schedule time → captured in `MarketEvent` at `rollSchedule` (Task 2), test in Task 2/4. ✓
- Shop indicator → Task 6; Day Summary lines → Task 5; no HUD chip → nothing touches HUD. ✓
- Simulator preset + smartMixed reaction → Task 7. ✓
- Balance gate + tuning-results.md → Task 8. ✓
- Endless: cadence reads from config, no special-casing → inherent (Task 4 uses `config.market`). ✓

**Placeholder scan:** No TBD/TODO; every code step has concrete code. Component-test scaffolding tells the engineer to reuse the file's existing render helpers rather than inventing them — acceptable since exact helper names vary and the provided fallback code is complete.

**Type consistency:** `MarketState`/`MarketEvent`/`ActiveMarketEvent`/`MarketEventKind` defined once in `types.ts` (Task 1), imported everywhere. `MarketConfig` defined once in `economy.ts`. `marketMultiplierFor`/`activatePending`/`expireActive`/`rollSchedule`/`announceText`/`activeText`/`EMPTY_MARKET` names match between `market.ts` (Task 2), its tests, and `gameEngine.ts` (Task 4). `pickCropWithMarket` matches between Task 7 impl and test. `marketActive`/`marketAnnounced` log fields consistent across Tasks 4–6. `marketEvent` SeedCard prop and `marketActive` Shop prop consistent across Task 6.
