# 022 — Farm Events (G11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship authored Farm Events — 1–2 binary-choice story moments per season (including G4-fold-in delivery contracts), gated to unlock on a device's second run, sim-gated for balance.

**Architecture:** A pure `src/engine/farmEvents.ts` module plus a data-only catalog, mirroring the 012 `market.ts` pattern. Choices resolve to a closed set of serializable effect primitives stored on a new `GameState.farmEvents` slice (schema 9→10). `processTurn` auto-resolves unanswered choices as the safe option (B), applies buffs/pins/contracts, and fires scheduled events. UI adds one blocking modal, a HUD contract chip, Day Summary lines, and a run-end unlock tease.

**Tech Stack:** TypeScript ~5.6, React 18.3, Vite 5.4, Tailwind 3.4, Vitest + @testing-library/react. No new dependencies.

**Spec:** [spec.md](spec.md) — read it first; it is the authority on behavior.

---

## File structure

| File | Role |
|---|---|
| `src/engine/types.ts` (modify) | `FarmEventId`, effect spec/live types, `FarmEventsState`, `ContractState`, catalog types, `GameState.farmEvents`, `DailyLogEntry` additions |
| `src/engine/constants.ts` (modify) | `FARM_EVENT_*` scalar knobs; `SCHEMA_VERSION` 9→10 (Task 7 only) |
| `src/engine/farmEventCatalog.ts` (create) | The 6 authored `FarmEventDefinition`s — data only, no logic |
| `src/engine/economy.ts` (modify) | `FarmEventsConfig` on `EconomyConfig`; `DEFAULT_ECONOMY.farmEvents` |
| `src/engine/farmEvents.ts` (create) | Pure logic: schedule, fire, effect helpers, tick, contract progress, merchant estimate |
| `src/engine/gameEngine.ts` (modify) | `initialGameState` opts, `resolveFarmEventChoice`, `computeSeedCost` discount, `processTurn` integration |
| `src/engine/useGameEngine.ts` (modify) | v9→v10 migration + hardening, records-derived gating, `resolveFarmEvent` action, `getPendingFarmEvent`, `play_started.events_enabled` |
| `src/components/FarmEventModal.tsx` (create) | The blocking choice modal |
| `src/components/GameBoard.tsx` (modify) | Modal orchestration, Next-Day guard, contract chip data |
| `src/components/HUD.tsx` (modify) | 📜 contract chip |
| `src/components/DailyLog.tsx` (modify) | Buff / contract-progress / completed / expired lines |
| `src/components/BankruptcyScreen.tsx`, `src/components/SeasonTransitionModal.tsx`, `src/App.tsx` (modify) | Run-end unlock tease |
| `src/analytics/events.ts`, `src/analytics/useAnalyticsEvents.ts` (modify) | 4 new events + `play_started` v2 |
| `scripts/sim/strategies.ts`, `runner.ts`, `run.ts`, `economyPresets.ts` (modify) | Event policies, `--eventPolicy` flag, `events022` preset |
| Tests | `tests/engine/farmEvents.test.ts`, `tests/engine/farmEvents.turn.test.ts`, `tests/engine/farmEvents.migration.test.tsx`, `tests/components/FarmEventModal.test.tsx`, `tests/sim/eventPolicies.test.ts`, plus edits to existing suites |

Run commands from the repo root. Full gate after every task: `npm test && npm run lint`.

---

### Task 1: Types, constants, config, catalog

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/constants.ts`
- Modify: `src/engine/economy.ts`
- Create: `src/engine/farmEventCatalog.ts`
- Test: `tests/engine/farmEventCatalog.test.ts`

- [ ] **Step 1: Create a feature branch**

```bash
git checkout -b 022-narrative-events
```

- [ ] **Step 2: Write the failing catalog test**

Create `tests/engine/farmEventCatalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FARM_EVENT_DEFINITIONS } from '../../src/engine/farmEventCatalog';

describe('farm event catalog', () => {
  it('ships exactly the six v1 events with unique ids', () => {
    const ids = FARM_EVENT_DEFINITIONS.map(e => e.id);
    expect(ids).toEqual([
      'traveling_merchant', 'bountiful_spring', 'drought_warning',
      'millers_order', 'fair_committee', 'wandering_beekeeper',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('choice B is always the safe side: no negative coins, no contract, no buff downside', () => {
    for (const def of FARM_EVENT_DEFINITIONS) {
      for (const e of def.choiceB.effects) {
        expect(e.kind).toBe('coins_delta');
        if (e.kind === 'coins_delta') expect(e.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('every event has copy for title, body, and both choice labels/summaries', () => {
    for (const def of FARM_EVENT_DEFINITIONS) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.body.length).toBeGreaterThan(0);
      for (const c of [def.choiceA, def.choiceB]) {
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.summary.length).toBeGreaterThan(0);
      }
    }
  });

  it('only drought_warning carries fire-time effects, and they are weather pins', () => {
    for (const def of FARM_EVENT_DEFINITIONS) {
      if (def.id === 'drought_warning') {
        expect(def.onFire).toHaveLength(1);
        expect(def.onFire![0].kind).toBe('weather_pin');
      } else {
        expect(def.onFire).toBeUndefined();
      }
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

```bash
npx vitest run tests/engine/farmEventCatalog.test.ts
```
Expected: FAIL — cannot resolve `../../src/engine/farmEventCatalog`.

- [ ] **Step 4: Add the types**

In `src/engine/types.ts`, after the `MarketState` block (below line 41), add:

```ts
// ── Farm Events (022) ─────────────────────────────────────────────────────────

export type FarmEventId =
  | 'traveling_merchant'
  | 'bountiful_spring'
  | 'drought_warning'
  | 'millers_order'
  | 'fair_committee'
  | 'wandering_beekeeper';

export type FarmEventChoiceId = 'A' | 'B';

/** Authored effect payloads (catalog data). `weather_pin` is fire-time-only. */
export type FarmEventEffectSpec =
  | { kind: 'coins_delta'; amount: number }
  | { kind: 'sell_standing_crops'; priceFactor: number }
  | { kind: 'yield_buff'; multiplier: number; harvests: number; exhaustionFactor: number }
  | { kind: 'seed_discount'; cropId: CropId; factor: number }
  | { kind: 'weather_pin'; weatherId: WeatherId; chance: number; minOffsetDays: number; maxOffsetDays: number }
  | { kind: 'contract'; cropId: CropId; quantity: number; deadlineDays: number; reward: number };

/** Live, serialized effects with counters — resolved from specs at choice/fire time. */
export type FarmEventEffect =
  | { kind: 'yield_buff'; eventId: FarmEventId; multiplier: number; harvestsRemaining: number; exhaustionFactor: number }
  | { kind: 'seed_discount'; cropId: CropId; factor: number; expiresAfterDay: number }
  | { kind: 'weather_pin'; weatherId: WeatherId; day: number };

export interface ContractState {
  eventId: FarmEventId;
  cropId: CropId;
  /** Total harvests required (frozen at accept time). */
  quantity: number;
  /** Harvests still owed. */
  remaining: number;
  /** Last calendar day on which the contract can complete. */
  deadlineDay: number;
  reward: number;
}

export interface FarmEventChoice {
  label: string;
  /** One-line mechanical summary rendered under the label. */
  summary: string;
  effects: FarmEventEffectSpec[];
}

export interface FarmEventDefinition {
  id: FarmEventId;
  emoji: string;
  title: string;
  body: string;
  /** Fire-time effects applied before any choice (weather_pin only — Drought Warning). */
  onFire?: FarmEventEffectSpec[];
  choiceA: FarmEventChoice;
  /** By catalog convention, B is always the decline/safe side (the auto-resolve target). */
  choiceB: FarmEventChoice;
}

export interface FarmEventsState {
  /** False on a device's first run (new-player gating); frozen at run creation. */
  enabled: boolean;
  /** Season number the schedule below was drawn for; 0 = never drawn. */
  scheduleSeason: number;
  scheduledDays: number[];
  pending: { eventId: FarmEventId; firedDay: number } | null;
  activeEffects: FarmEventEffect[];
  contract: ContractState | null;
  /** No-repeat pool for this run; resets when every catalog id has been seen. */
  seenIds: FarmEventId[];
  /** Most recent resolution, for the analytics render-diff hook. */
  lastResolved: { eventId: FarmEventId; choice: FarmEventChoiceId; day: number; auto: boolean } | null;
}
```

In the same file add to `GameState` (after the `buildings` field):

```ts
  /** In-run narrative events state (022). */
  farmEvents: FarmEventsState;
```

And to `DailyLogEntry` (after `recoveryDays?`), all optional so pre-v10 logs in old saves stay type-valid:

```ts
  /** Yield buffs that boosted THIS turn's harvests (022); absent/empty on unbuffed turns. */
  eventBuffsApplied?: Array<{ eventId: FarmEventId; multiplier: number; harvestsAffected: number }>;
  /** Live contract snapshot after this turn's accounting, or null. */
  contractProgress?: { cropId: CropId; done: number; total: number; deadlineDay: number } | null;
  /** Contract delivered this turn (reward already in closingBalance), or null. */
  contractCompleted?: { eventId: FarmEventId; reward: number } | null;
  /** Contract that ran out of time this turn (no penalty), or null. */
  contractExpired?: FarmEventId | null;
```

- [ ] **Step 5: Add the constants**

In `src/engine/constants.ts`, after `BUILDING_YIELD_MULTIPLIER` (line 35), add:

```ts
export const FARM_EVENT_WINDOW_START_OFFSET = 4;  // first eligible day = season startDay + 4 (season day 5)
export const FARM_EVENT_WINDOW_END_OFFSET = 15;   // last eligible day = season startDay + 15 (season day 16)
export const FARM_EVENT_SECOND_CHANCE = 0.5;      // chance of a 2nd event per season
```

Do **not** touch `SCHEMA_VERSION` yet — that happens with the migration in Task 7.

- [ ] **Step 6: Create the catalog**

Create `src/engine/farmEventCatalog.ts`. Coin numbers are the sim-gated starting proposal (Task 16 may adjust them):

```ts
import type { FarmEventDefinition } from './types';

/**
 * The authored Farm Event catalog (022). Data only — all behavior lives in
 * farmEvents.ts / gameEngine.ts. Choice B is always the decline/safe side
 * (the processTurn auto-resolve target). Numbers here are tuned in
 * specs/022-narrative-events/tuning-results.md before shipping.
 */
export const FARM_EVENT_DEFINITIONS: FarmEventDefinition[] = [
  {
    id: 'traveling_merchant',
    emoji: '🧳',
    title: 'The Traveling Merchant',
    body: 'A buyer pulls up with an empty cart and a full purse. She offers to take everything growing in your fields, right now — no waiting, no weather risk.',
    choiceA: {
      label: 'Sell everything now',
      summary: 'All growing crops sold instantly at 1.4× base value.',
      effects: [{ kind: 'sell_standing_crops', priceFactor: 1.4 }],
    },
    choiceB: { label: 'Decline', summary: 'Harvest on schedule.', effects: [] },
  },
  {
    id: 'bountiful_spring',
    emoji: '🌸',
    title: 'Bountiful Spring',
    body: 'The soil is unusually rich this week — worms everywhere, and the smell of rain. Push it hard, and the ground will pay you back… then need a rest.',
    choiceA: {
      label: 'Embrace it',
      summary: 'Next 3 harvests +50% coins, but soil exhausts twice as fast.',
      effects: [{ kind: 'yield_buff', multiplier: 1.5, harvests: 3, exhaustionFactor: 2 }],
    },
    choiceB: { label: 'Conserve', summary: 'Plant normally.', effects: [] },
  },
  {
    id: 'drought_warning',
    emoji: '🌵',
    title: 'Drought Warning',
    body: 'The almanac says a flash drought is likely within days. It has been wrong before — but not often.',
    onFire: [{ kind: 'weather_pin', weatherId: 'flash_drought', chance: 0.7, minOffsetDays: 2, maxOffsetDays: 3 }],
    choiceA: {
      label: 'Rush-plant',
      summary: 'Radish seeds half price — today only.',
      effects: [{ kind: 'seed_discount', cropId: 'radish', factor: 0.5 }],
    },
    choiceB: { label: 'Hold and wait', summary: 'Maybe it passes.', effects: [] },
  },
  {
    id: 'millers_order',
    emoji: '📜',
    title: "The Miller's Order",
    body: 'The miller needs parsnips for the harvest fair and pays over the odds for reliable growers. Miss the date and she simply buys elsewhere.',
    choiceA: {
      label: 'Take the contract',
      summary: 'Harvest 3 parsnips within 6 days → +55🪙 on delivery.',
      effects: [{ kind: 'contract', cropId: 'parsnip', quantity: 3, deadlineDays: 6, reward: 55 }],
    },
    choiceB: {
      label: 'Sell your spare sacks',
      summary: '+12🪙 now.',
      effects: [{ kind: 'coins_delta', amount: 12 }],
    },
  },
  {
    id: 'fair_committee',
    emoji: '🎪',
    title: 'The Fair Committee',
    body: 'The county fair opens soon and the committee wants crates of fresh radishes — fast, and they pay on delivery.',
    choiceA: {
      label: 'Take the contract',
      summary: 'Harvest 4 radishes within 5 days → +40🪙 on delivery.',
      effects: [{ kind: 'contract', cropId: 'radish', quantity: 4, deadlineDays: 5, reward: 40 }],
    },
    choiceB: {
      label: 'Sell what you have',
      summary: '+10🪙 now.',
      effects: [{ kind: 'coins_delta', amount: 10 }],
    },
  },
  {
    id: 'wandering_beekeeper',
    emoji: '🐝',
    title: 'The Wandering Beekeeper',
    body: 'A beekeeper offers to park her hives beside your fields for a few days. Pollinated crops sell plumper — for a small fee.',
    choiceA: {
      label: 'Pay 15🪙',
      summary: 'Next 4 harvests +20% coins.',
      effects: [
        { kind: 'coins_delta', amount: -15 },
        { kind: 'yield_buff', multiplier: 1.2, harvests: 4, exhaustionFactor: 1 },
      ],
    },
    choiceB: { label: 'Decline', summary: 'Save your coins.', effects: [] },
  },
];
```

- [ ] **Step 7: Add `FarmEventsConfig` to the economy**

In `src/engine/economy.ts`:

Add to the imports from `./types`: `FarmEventDefinition`. Add to the imports from `./constants`: `FARM_EVENT_WINDOW_START_OFFSET, FARM_EVENT_WINDOW_END_OFFSET, FARM_EVENT_SECOND_CHANCE`. Add a new import line:

```ts
import { FARM_EVENT_DEFINITIONS } from './farmEventCatalog';
```

After the `BuildingsConfig` interface add:

```ts
export interface FarmEventsConfig {
  /** First eligible season day = startDay + this. */
  windowStartOffset: number;
  /** Last eligible season day = startDay + this (clamped to season endDay). */
  windowEndOffset: number;
  /** 0..1 chance of a 2nd event per season (the 1st is guaranteed). */
  secondEventChance: number;
  /** The authored catalog; per-event numbers live inside the definitions. */
  events: FarmEventDefinition[];
}
```

Add `farmEvents: FarmEventsConfig;` to `EconomyConfig` (after `buildings`), and to `DEFAULT_ECONOMY`:

```ts
  farmEvents: {
    windowStartOffset: FARM_EVENT_WINDOW_START_OFFSET,
    windowEndOffset: FARM_EVENT_WINDOW_END_OFFSET,
    secondEventChance: FARM_EVENT_SECOND_CHANCE,
    events: FARM_EVENT_DEFINITIONS,
  },
```

- [ ] **Step 8: Fix the sim presets' required field**

`scripts/sim/economyPresets.ts` — the `baseline` object literal now misses `farmEvents`. Keep frozen presets event-free by adding to `baseline` (after the `buildings` line):

```ts
  // 022: frozen pre-events presets — an empty catalog means nothing can ever fire.
  farmEvents: { windowStartOffset: 4, windowEndOffset: 15, secondEventChance: 0, events: [] },
```

`proposed` and `buildings019` spread `baseline`/`proposed`, so they inherit it.

- [ ] **Step 9: Run test + typecheck; fix fixture fallout**

```bash
npx vitest run tests/engine/farmEventCatalog.test.ts && npm test && npm run lint
```
Expected: the catalog test PASSES. The full suite will FAIL to compile wherever a `GameState` object literal is hand-rolled without `farmEvents` (search: `grep -rln "peakHarvestStreak:" tests/ src/`). `initialGameState` doesn't set the field yet — that's Task 2's first change, so do it now as part of making the suite green: in `src/engine/gameEngine.ts` `initialGameState`, after `buildings: { ...NO_BUILDINGS },` add:

```ts
    farmEvents: { ...EMPTY_FARM_EVENTS },
```

with the import `import { EMPTY_FARM_EVENTS } from './farmEvents';` — which requires creating a minimal `src/engine/farmEvents.ts` now:

```ts
import type { FarmEventsState } from './types';

/** Canonical empty slice. `enabled` defaults true (sim/tests); the UI overrides at run creation. */
export const EMPTY_FARM_EVENTS: FarmEventsState = {
  enabled: true,
  scheduleSeason: 0,
  scheduledDays: [],
  pending: null,
  activeEffects: [],
  contract: null,
  seenIds: [],
  lastResolved: null,
};
```

For any remaining hand-rolled `GameState` literals in tests, add `farmEvents: { ...EMPTY_FARM_EVENTS },` (import from `../../src/engine/farmEvents`). Re-run until green.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat(engine): 022 farm-event types, catalog, and economy config"
```

---

### Task 2: Scheduling — `ensureSchedule`

**Files:**
- Modify: `src/engine/farmEvents.ts`
- Test: `tests/engine/farmEvents.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/farmEvents.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EMPTY_FARM_EVENTS, ensureSchedule } from '../../src/engine/farmEvents';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';

/** Deterministic RNG yielding the given sequence, then repeating the last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('ensureSchedule', () => {
  it('draws 1 event when the second-event roll misses', () => {
    // rolls: secondEventChance miss (0.9), day pick 0.0 → earliest window day
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduleSeason).toBe(1);
    expect(fe.scheduledDays).toEqual([5]); // startDay 1 + windowStartOffset 4
  });

  it('draws 2 distinct days when the second-event roll hits', () => {
    // rolls: hit (0.1), then two identical day picks — linear probe makes them distinct
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.1, 0.5, 0.5]));
    expect(fe.scheduledDays).toHaveLength(2);
    expect(new Set(fe.scheduledDays).size).toBe(2);
    for (const d of fe.scheduledDays) {
      expect(d).toBeGreaterThanOrEqual(5);
      expect(d).toBeLessThanOrEqual(16); // startDay 1 + windowEndOffset 15
    }
  });

  it('is a no-op when the season schedule is already drawn', () => {
    const drawn = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    const again = ensureSchedule(drawn, 7, DEFAULT_ECONOMY, seq([0.1, 0.9]));
    expect(again).toBe(drawn);
  });

  it('redraws when the day crosses into a new season', () => {
    const s1 = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    const s2 = ensureSchedule(s1, 21, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(s2.scheduleSeason).toBe(2);
    expect(s2.scheduledDays).toEqual([25]); // startDay 21 + 4
  });

  it('clamps a mid-season draw to future days only', () => {
    // Migrated save on day 10: window lo = max(5, 10+1) = 11
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 10, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduledDays).toEqual([11]);
  });

  it('produces an empty schedule when the remaining window is empty', () => {
    // Day 17 of season 1: lo = 18 > hi = 16 → no events this season
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 17, DEFAULT_ECONOMY, seq([0.1, 0.5]));
    expect(fe.scheduleSeason).toBe(1);
    expect(fe.scheduledDays).toEqual([]);
  });

  it('does nothing while disabled', () => {
    const disabled = { ...EMPTY_FARM_EVENTS, enabled: false };
    expect(ensureSchedule(disabled, 1, DEFAULT_ECONOMY, seq([0.1]))).toBe(disabled);
  });

  it('schedules for endless seasons too', () => {
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 81, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduleSeason).toBe(5);
    expect(fe.scheduledDays).toEqual([85]); // endless season 5 startDay 81 + 4
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/farmEvents.test.ts
```
Expected: FAIL — `ensureSchedule` is not exported.

- [ ] **Step 3: Implement**

In `src/engine/farmEvents.ts` add:

```ts
import { getSeasonForDay } from './seasons';
import type { EconomyConfig } from './economy';

/**
 * Lazily draw a season's event schedule. No-op when disabled or already drawn
 * for the current season. Consumes rng draws: second-event roll, then one per
 * scheduled day. The window is clamped to future days (currentDay + 1) so
 * migrated mid-season saves are never retroactively scheduled. Pure.
 */
export function ensureSchedule(
  fe: FarmEventsState,
  currentDay: number,
  config: EconomyConfig,
  rng: () => number,
): FarmEventsState {
  if (!fe.enabled) return fe;
  const season = getSeasonForDay(currentDay, config);
  if (fe.scheduleSeason === season.number) return fe;

  const cfg = config.farmEvents;
  const lo = Math.max(season.startDay + cfg.windowStartOffset, currentDay + 1);
  const hi = Math.min(season.startDay + cfg.windowEndOffset, season.endDay);

  const scheduledDays: number[] = [];
  if (hi >= lo) {
    const count = 1 + (rng() < cfg.secondEventChance ? 1 : 0);
    const span = hi - lo + 1;
    for (let i = 0; i < Math.min(count, span); i++) {
      let d = lo + Math.min(span - 1, Math.floor(rng() * span));
      // Linear probe on collision keeps the draw deterministic per rng sequence.
      while (scheduledDays.includes(d)) d = lo + ((d - lo + 1) % span);
      scheduledDays.push(d);
    }
  }
  return { ...fe, scheduleSeason: season.number, scheduledDays };
}
```

(Adjust the existing `FarmEventsState` type import to a plain `import type { FarmEventsState } from './types';` if not already present.)

- [ ] **Step 4: Run to verify pass**

```bash
npx vitest run tests/engine/farmEvents.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(engine): 022 lazy per-season event scheduling"
```

---

### Task 3: Firing — `maybeFireEvent`

**Files:**
- Modify: `src/engine/farmEvents.ts`
- Test: `tests/engine/farmEvents.test.ts` (append)

- [ ] **Step 1: Write the failing tests** (append to `tests/engine/farmEvents.test.ts`)

```ts
import { maybeFireEvent, isContractEvent } from '../../src/engine/farmEvents';
import type { FarmEventsState, ContractState } from '../../src/engine/types';

const scheduledFe = (days: number[], extra: Partial<FarmEventsState> = {}): FarmEventsState => ({
  ...EMPTY_FARM_EVENTS, scheduleSeason: 1, scheduledDays: days, ...extra,
});

describe('maybeFireEvent', () => {
  it('sets pending on a scheduled day and marks the id seen', () => {
    const fe = maybeFireEvent(scheduledFe([8]), 8, DEFAULT_ECONOMY, seq([0.0]));
    expect(fe.pending).toEqual({ eventId: 'traveling_merchant', firedDay: 8 });
    expect(fe.seenIds).toContain('traveling_merchant');
  });

  it('does nothing off-schedule, while pending, or while disabled', () => {
    const base = scheduledFe([8]);
    expect(maybeFireEvent(base, 9, DEFAULT_ECONOMY, seq([0.0]))).toBe(base);
    const pending = scheduledFe([8], { pending: { eventId: 'bountiful_spring', firedDay: 6 } });
    expect(maybeFireEvent(pending, 8, DEFAULT_ECONOMY, seq([0.0]))).toBe(pending);
    const disabled = scheduledFe([8], { enabled: false });
    expect(maybeFireEvent(disabled, 8, DEFAULT_ECONOMY, seq([0.0]))).toBe(disabled);
  });

  it('never repeats a seen event until the pool is exhausted, then resets the pool', () => {
    const allSeen = scheduledFe([8], {
      seenIds: ['traveling_merchant', 'bountiful_spring', 'drought_warning',
                'millers_order', 'fair_committee', 'wandering_beekeeper'],
    });
    const fe = maybeFireEvent(allSeen, 8, DEFAULT_ECONOMY, seq([0.0]));
    expect(fe.pending?.eventId).toBe('traveling_merchant'); // pool reset, full catalog again
    expect(fe.seenIds).toEqual(['traveling_merchant']);
  });

  it('excludes contract events while a contract is live', () => {
    const contract: ContractState = {
      eventId: 'millers_order', cropId: 'parsnip', quantity: 3, remaining: 2, deadlineDay: 12, reward: 55,
    };
    // rng 0.99 would pick the last candidate; without exclusion that is wandering_beekeeper,
    // with contract events excluded the candidate list must contain no contract event at all.
    const fe = maybeFireEvent(scheduledFe([8], { contract }), 8, DEFAULT_ECONOMY, seq([0.99]));
    expect(fe.pending).not.toBeNull();
    const def = DEFAULT_ECONOMY.farmEvents.events.find(e => e.id === fe.pending!.eventId)!;
    expect(isContractEvent(def)).toBe(false);
  });

  it('applies the drought pin at fire time when the pre-roll hits', () => {
    // Force drought_warning: seenIds excludes everything else.
    const others = scheduledFe([8], {
      seenIds: ['traveling_merchant', 'bountiful_spring', 'millers_order', 'fair_committee', 'wandering_beekeeper'],
    });
    // rng: candidate pick (only 1 candidate → any), pin chance hit (0.1 < 0.7), offset pick 0.99 → max offset 3
    const fe = maybeFireEvent(others, 8, DEFAULT_ECONOMY, seq([0.0, 0.1, 0.99]));
    expect(fe.pending?.eventId).toBe('drought_warning');
    expect(fe.activeEffects).toEqual([{ kind: 'weather_pin', weatherId: 'flash_drought', day: 11 }]);
  });

  it('skips the pin when the pre-roll misses', () => {
    const others = scheduledFe([8], {
      seenIds: ['traveling_merchant', 'bountiful_spring', 'millers_order', 'fair_committee', 'wandering_beekeeper'],
    });
    const fe = maybeFireEvent(others, 8, DEFAULT_ECONOMY, seq([0.0, 0.9]));
    expect(fe.pending?.eventId).toBe('drought_warning');
    expect(fe.activeEffects).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/farmEvents.test.ts
```
Expected: FAIL — `maybeFireEvent` / `isContractEvent` not exported.

- [ ] **Step 3: Implement** (append to `src/engine/farmEvents.ts`)

```ts
import type { FarmEventDefinition, FarmEventEffect } from './types';

/** True when either choice of `def` creates a contract. */
export function isContractEvent(def: FarmEventDefinition): boolean {
  return def.choiceA.effects.some(e => e.kind === 'contract')
    || def.choiceB.effects.some(e => e.kind === 'contract');
}

/**
 * Fire a scheduled event for `newDay` (the day the player is about to start).
 * Draws an unseen event (pool resets when exhausted); contract events are
 * excluded while a contract is live. Fire-time effects (the Drought Warning's
 * pre-rolled weather pin) are applied here, before any choice. Pure.
 */
export function maybeFireEvent(
  fe: FarmEventsState,
  newDay: number,
  config: EconomyConfig,
  rng: () => number,
): FarmEventsState {
  if (!fe.enabled || fe.pending !== null || !fe.scheduledDays.includes(newDay)) return fe;
  const all = config.farmEvents.events;
  if (all.length === 0) return fe;

  let unseen = all.filter(e => !fe.seenIds.includes(e.id));
  let seenIds = fe.seenIds;
  if (unseen.length === 0) {
    unseen = all;      // pool reset: long Endless runs recycle content
    seenIds = [];
  }
  const candidates = fe.contract !== null ? unseen.filter(e => !isContractEvent(e)) : unseen;
  if (candidates.length === 0) return fe; // only contract events left while one is live

  const def = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];

  const activeEffects: FarmEventEffect[] = [...fe.activeEffects];
  for (const spec of def.onFire ?? []) {
    if (spec.kind === 'weather_pin' && rng() < spec.chance) {
      const offset = spec.minOffsetDays
        + Math.min(spec.maxOffsetDays - spec.minOffsetDays,
                   Math.floor(rng() * (spec.maxOffsetDays - spec.minOffsetDays + 1)));
      activeEffects.push({ kind: 'weather_pin', weatherId: spec.weatherId, day: newDay + offset });
    }
  }

  return {
    ...fe,
    pending: { eventId: def.id, firedDay: newDay },
    seenIds: [...seenIds, def.id],
    activeEffects,
  };
}
```

(Merge the type imports into the existing `import type` line.)

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/engine/farmEvents.test.ts
git add -A && git commit -m "feat(engine): 022 event firing with no-repeat pool and fire-time pins"
```

---

### Task 4: Effect helpers + contract progress + merchant estimate

**Files:**
- Modify: `src/engine/farmEvents.ts`
- Test: `tests/engine/farmEvents.test.ts` (append)

- [ ] **Step 1: Write the failing tests** (append)

```ts
import {
  buffMultiplierFor, buffExhaustionFactorFor, seedDiscountFor, pinnedWeatherFor,
  tickEffects, applyContractProgress, merchantOfferValue,
} from '../../src/engine/farmEvents';
import type { FarmEventEffect, HarvestEvent } from '../../src/engine/types';
import { initialGameState } from '../../src/engine/gameEngine';

const buff = (multiplier: number, harvestsRemaining: number, exhaustionFactor = 1): FarmEventEffect =>
  ({ kind: 'yield_buff', eventId: 'bountiful_spring', multiplier, harvestsRemaining, exhaustionFactor });

describe('effect helpers', () => {
  it('buff multipliers stack multiplicatively; spent buffs are ignored', () => {
    expect(buffMultiplierFor([buff(1.5, 3), buff(1.2, 4)])).toBeCloseTo(1.8);
    expect(buffMultiplierFor([buff(1.5, 0)])).toBe(1);
    expect(buffMultiplierFor([])).toBe(1);
  });

  it('exhaustion factor is the max across live buffs, min 1', () => {
    expect(buffExhaustionFactorFor([buff(1.5, 3, 2), buff(1.2, 4, 1)])).toBe(2);
    expect(buffExhaustionFactorFor([])).toBe(1);
  });

  it('seed discount applies per crop and defaults to 1', () => {
    const d: FarmEventEffect = { kind: 'seed_discount', cropId: 'radish', factor: 0.5, expiresAfterDay: 8 };
    expect(seedDiscountFor([d], 'radish')).toBe(0.5);
    expect(seedDiscountFor([d], 'pumpkin')).toBe(1);
  });

  it('pinned weather matches only its exact day', () => {
    const p: FarmEventEffect = { kind: 'weather_pin', weatherId: 'flash_drought', day: 11 };
    expect(pinnedWeatherFor([p], 11)).toBe('flash_drought');
    expect(pinnedWeatherFor([p], 10)).toBeNull();
  });

  it('tickEffects decrements buffs per harvest and expires spent/stale effects', () => {
    const effects: FarmEventEffect[] = [
      buff(1.5, 3), buff(1.2, 2),
      { kind: 'seed_discount', cropId: 'radish', factor: 0.5, expiresAfterDay: 8 },
      { kind: 'weather_pin', weatherId: 'flash_drought', day: 8 },
      { kind: 'weather_pin', weatherId: 'flash_drought', day: 9 },
    ];
    const out = tickEffects(effects, 2, 8);
    expect(out).toEqual([
      buff(1.5, 1),
      { kind: 'weather_pin', weatherId: 'flash_drought', day: 9 },
    ]);
  });
});

describe('applyContractProgress', () => {
  const harvest = (cropId: 'radish' | 'parsnip' | 'pumpkin'): HarvestEvent =>
    ({ plotId: 0, cropId, baseYield: 10, weatherMultiplier: 1, adjustedYield: 10 });
  const contract = { eventId: 'millers_order' as const, cropId: 'parsnip' as const, quantity: 3, remaining: 2, deadlineDay: 12, reward: 55 };

  it('counts only qualifying harvests', () => {
    const out = applyContractProgress(contract, [harvest('parsnip'), harvest('radish')], 10);
    expect(out.contract).toEqual({ ...contract, remaining: 1 });
    expect(out.completed).toBeNull();
    expect(out.expired).toBeNull();
  });

  it('completes when remaining reaches 0 — even on the deadline day', () => {
    const out = applyContractProgress({ ...contract, remaining: 1 }, [harvest('parsnip')], 12);
    expect(out.contract).toBeNull();
    expect(out.completed).toEqual({ eventId: 'millers_order', reward: 55 });
  });

  it('expires without penalty when the deadline day ends unfinished', () => {
    const out = applyContractProgress(contract, [], 12);
    expect(out.contract).toBeNull();
    expect(out.expired).toBe('millers_order');
  });

  it('is a no-op without a contract', () => {
    expect(applyContractProgress(null, [harvest('parsnip')], 10))
      .toEqual({ contract: null, completed: null, expired: null });
  });
});

describe('merchantOfferValue', () => {
  it('sums coins(baseYield × priceFactor) over growing plots', () => {
    let s = initialGameState();
    s = {
      ...s,
      plots: s.plots.map((p, i) =>
        i === 0 ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 2, dayPlanted: 1 }
        : i === 1 ? { ...p, cropId: 'radish' as const, daysRemaining: 1, dayPlanted: 1 }
        : p),
    };
    // pumpkin 65 × 1.4 = 91, radish 12 × 1.4 = 16.8 → 16; total 107
    expect(merchantOfferValue(s, DEFAULT_ECONOMY)).toBe(107);
  });

  it('is 0 with nothing growing', () => {
    expect(merchantOfferValue(initialGameState(), DEFAULT_ECONOMY)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/farmEvents.test.ts
```
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement** (append to `src/engine/farmEvents.ts`)

```ts
import { coins } from './constants';
import type { ContractState, CropId, FarmEventId, GameState, HarvestEvent, WeatherId } from './types';

/** Aggregate yield multiplier from live buffs (multiplicative). */
export function buffMultiplierFor(effects: FarmEventEffect[]): number {
  return effects.reduce(
    (f, e) => (e.kind === 'yield_buff' && e.harvestsRemaining > 0 ? f * e.multiplier : f), 1);
}

/** Exhaustion increment per harvest while buffed: max factor across live buffs, min 1. */
export function buffExhaustionFactorFor(effects: FarmEventEffect[]): number {
  return effects.reduce(
    (f, e) => (e.kind === 'yield_buff' && e.harvestsRemaining > 0 ? Math.max(f, e.exhaustionFactor) : f), 1);
}

/** Active seed-discount factor for `cropId`, or 1. */
export function seedDiscountFor(effects: FarmEventEffect[], cropId: CropId): number {
  const d = effects.find(e => e.kind === 'seed_discount' && e.cropId === cropId);
  return d !== undefined && d.kind === 'seed_discount' ? d.factor : 1;
}

/** The weather pinned for `day`, or null. */
export function pinnedWeatherFor(effects: FarmEventEffect[], day: number): WeatherId | null {
  const p = effects.find(e => e.kind === 'weather_pin' && e.day === day);
  return p !== undefined && p.kind === 'weather_pin' ? p.weatherId : null;
}

/**
 * End-of-turn effect bookkeeping: buffs decrement once per harvest event this
 * turn and expire at 0; seed discounts expire with the day they were granted;
 * pins for today or earlier are consumed. Pure.
 */
export function tickEffects(
  effects: FarmEventEffect[],
  harvestCount: number,
  dayCompleted: number,
): FarmEventEffect[] {
  return effects
    .map(e => (e.kind === 'yield_buff' ? { ...e, harvestsRemaining: e.harvestsRemaining - harvestCount } : e))
    .filter(e =>
      e.kind === 'yield_buff' ? e.harvestsRemaining > 0
      : e.kind === 'seed_discount' ? e.expiresAfterDay > dayCompleted
      : e.day > dayCompleted);
}

export interface ContractOutcome {
  contract: ContractState | null;
  completed: { eventId: FarmEventId; reward: number } | null;
  expired: FarmEventId | null;
}

/**
 * One turn of contract accounting: qualifying harvests reduce `remaining`;
 * at 0 the contract completes (caller credits the reward BEFORE the bankruptcy
 * check); an unfinished contract expires — no penalty — once the deadline day
 * has been played. Pure.
 */
export function applyContractProgress(
  contract: ContractState | null,
  harvests: HarvestEvent[],
  dayCompleted: number,
): ContractOutcome {
  if (contract === null) return { contract: null, completed: null, expired: null };
  const qualifying = harvests.filter(h => h.cropId === contract.cropId).length;
  const remaining = contract.remaining - qualifying;
  if (remaining <= 0) {
    return { contract: null, completed: { eventId: contract.eventId, reward: contract.reward }, expired: null };
  }
  if (dayCompleted >= contract.deadlineDay) {
    return { contract: null, completed: null, expired: contract.eventId };
  }
  return { contract: { ...contract, remaining }, completed: null, expired: null };
}

/** Live coin value of the Traveling Merchant's sell-now offer for the current board. */
export function merchantOfferValue(state: GameState, config: EconomyConfig): number {
  const def = config.farmEvents.events.find(e => e.id === 'traveling_merchant');
  const spec = def?.choiceA.effects.find(e => e.kind === 'sell_standing_crops');
  if (spec === undefined || spec.kind !== 'sell_standing_crops') return 0;
  return state.plots.reduce(
    (sum, p) => (p.cropId === null ? sum : sum + coins(config.crops[p.cropId].baseYield * spec.priceFactor)), 0);
}
```

(Consolidate all type imports at the top of the file.)

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/engine/farmEvents.test.ts
git add -A && git commit -m "feat(engine): 022 effect helpers, contract accounting, merchant estimate"
```

---

### Task 5: `resolveFarmEventChoice` + seed discount in `computeSeedCost`

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Test: `tests/engine/farmEvents.resolve.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/farmEvents.resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialGameState, resolveFarmEventChoice, computeSeedCost } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventId, GameState } from '../../src/engine/types';

function withPending(eventId: FarmEventId, mutate: (s: GameState) => GameState = s => s): GameState {
  const s = initialGameState();
  return mutate({
    ...s,
    currentDay: 8,
    farmEvents: { ...s.farmEvents, pending: { eventId, firedDay: 8 } },
  });
}

describe('resolveFarmEventChoice', () => {
  it('is a no-op without a pending event', () => {
    const s = initialGameState();
    expect(resolveFarmEventChoice(s, 'A')).toBe(s);
  });

  it('coins_delta: contract decline pays the consolation now', () => {
    const s = withPending('millers_order');
    const out = resolveFarmEventChoice(s, 'B');
    expect(out.coinBalance).toBe(s.coinBalance + 12);
    expect(out.farmEvents.pending).toBeNull();
    expect(out.farmEvents.lastResolved).toEqual({ eventId: 'millers_order', choice: 'B', day: 8, auto: false });
  });

  it('contract accept creates the contract with the fired-day deadline', () => {
    const out = resolveFarmEventChoice(withPending('millers_order'), 'A');
    expect(out.farmEvents.contract).toEqual({
      eventId: 'millers_order', cropId: 'parsnip', quantity: 3, remaining: 3, deadlineDay: 14, reward: 55,
    });
  });

  it('sell_standing_crops clears growing plots and credits coins(baseYield × 1.4) each', () => {
    const s = withPending('traveling_merchant', st => ({
      ...st,
      plots: st.plots.map((p, i) =>
        i === 0 ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 2, dayPlanted: 7, consecutiveHarvests: 1 } : p),
    }));
    const out = resolveFarmEventChoice(s, 'A');
    expect(out.coinBalance).toBe(s.coinBalance + 91); // coins(65 × 1.4)
    expect(out.plots[0].cropId).toBeNull();
    expect(out.plots[0].consecutiveHarvests).toBe(1); // a private sale, not a harvest
  });

  it('yield_buff and seed_discount become live effects', () => {
    const buffed = resolveFarmEventChoice(withPending('bountiful_spring'), 'A');
    expect(buffed.farmEvents.activeEffects).toEqual([
      { kind: 'yield_buff', eventId: 'bountiful_spring', multiplier: 1.5, harvestsRemaining: 3, exhaustionFactor: 2 },
    ]);
    const discounted = resolveFarmEventChoice(withPending('drought_warning'), 'A');
    expect(discounted.farmEvents.activeEffects).toEqual([
      { kind: 'seed_discount', cropId: 'radish', factor: 0.5, expiresAfterDay: 8 },
    ]);
  });

  it('beekeeper buy-in deducts the fee and refuses when unaffordable', () => {
    const rich = resolveFarmEventChoice(withPending('wandering_beekeeper'), 'A');
    expect(rich.coinBalance).toBe(initialGameState().coinBalance - 15);
    const poor = withPending('wandering_beekeeper', st => ({ ...st, coinBalance: 10 }));
    expect(resolveFarmEventChoice(poor, 'A')).toBe(poor); // unchanged, still pending
  });

  it('flags auto-resolution', () => {
    const out = resolveFarmEventChoice(withPending('bountiful_spring'), 'B', DEFAULT_ECONOMY, true);
    expect(out.farmEvents.lastResolved?.auto).toBe(true);
  });
});

describe('computeSeedCost with an event discount', () => {
  it('applies the seed discount multiplicatively with the toolshed inside one floor', () => {
    const effects = [{ kind: 'seed_discount' as const, cropId: 'radish' as const, factor: 0.5, expiresAfterDay: 8 }];
    const none = initialGameState().buildings;
    expect(computeSeedCost('radish', none, DEFAULT_ECONOMY, effects)).toBe(2);      // floor(5 × 0.5)
    expect(computeSeedCost('parsnip', none, DEFAULT_ECONOMY, effects)).toBe(10);    // unaffected crop
    const shed = { ...none, toolshed: true };
    expect(computeSeedCost('radish', shed, DEFAULT_ECONOMY, effects)).toBe(1);      // floor(5 × 0.6 × 0.5)
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/farmEvents.resolve.test.ts
```
Expected: FAIL — `resolveFarmEventChoice` not exported.

- [ ] **Step 3: Implement**

In `src/engine/gameEngine.ts`:

1. Extend imports:

```ts
import {
  EMPTY_FARM_EVENTS, ensureSchedule, maybeFireEvent, buffMultiplierFor,
  buffExhaustionFactorFor, seedDiscountFor, pinnedWeatherFor, tickEffects,
  applyContractProgress,
} from './farmEvents';
```
and add `FarmEventChoiceId`, `FarmEventEffect`, `FarmEventsState`, `ContractState` to the `./types` type import.

2. Replace `computeSeedCost` with:

```ts
/** Returns the current purchase price for one seed, applying the Toolshed and
 *  any active farm-event seed discount (022) inside a single coins() floor. */
export function computeSeedCost(
  cropId: CropId,
  buildings: GameState['buildings'],
  config: EconomyConfig = DEFAULT_ECONOMY,
  activeEffects: FarmEventEffect[] = [],
): number {
  const crop = config.crops[cropId];
  const shedFactor = buildings.toolshed ? 1 - config.buildings.seedDiscount : 1;
  const eventFactor = seedDiscountFor(activeEffects, cropId);
  return coins(crop.baseSeedCost * shedFactor * eventFactor);
}
```

3. In `buySeed`, change the unit-cost line to thread the live effects:

```ts
  const unitCost = computeSeedCost(cropId, state.buildings, config, state.farmEvents.activeEffects);
```

4. Add `resolveFarmEventChoice` (place it after `buyBuilding`):

```ts
// ── resolveFarmEventChoice (022) ──────────────────────────────────────────────

/**
 * Applies one side of the pending farm event's choice. Pure — no mutations.
 * No-ops when nothing is pending, when the id is unknown to the catalog
 * (pending is dropped), or when a buy-in is unaffordable (pending is KEPT so
 * the UI can re-present; auto-resolve always takes the free B side).
 */
export function resolveFarmEventChoice(
  state: GameState,
  choice: FarmEventChoiceId,
  config: EconomyConfig = DEFAULT_ECONOMY,
  auto = false,
): GameState {
  const pending = state.farmEvents.pending;
  if (pending === null) return state;
  const def = config.farmEvents.events.find(e => e.id === pending.eventId);
  if (def === undefined) {
    return { ...state, farmEvents: { ...state.farmEvents, pending: null } };
  }
  const effects = choice === 'A' ? def.choiceA.effects : def.choiceB.effects;

  const buyIn = effects.reduce(
    (sum, e) => (e.kind === 'coins_delta' && e.amount < 0 ? sum - e.amount : sum), 0);
  if (state.coinBalance < buyIn) return state;

  let coinBalance = state.coinBalance;
  let plots = state.plots;
  const activeEffects = [...state.farmEvents.activeEffects];
  let contract = state.farmEvents.contract;

  for (const spec of effects) {
    switch (spec.kind) {
      case 'coins_delta':
        coinBalance += spec.amount;
        break;
      case 'sell_standing_crops': {
        for (const p of plots) {
          if (p.cropId !== null) coinBalance += coins(config.crops[p.cropId].baseYield * spec.priceFactor);
        }
        // A private sale, not a harvest: no streak, no exhaustion increment.
        plots = plots.map(p => (p.cropId === null ? p : {
          ...p, cropId: null, dayPlanted: null, daysRemaining: null, droughtPenalised: false,
        }));
        break;
      }
      case 'yield_buff':
        activeEffects.push({
          kind: 'yield_buff', eventId: def.id, multiplier: spec.multiplier,
          harvestsRemaining: spec.harvests, exhaustionFactor: spec.exhaustionFactor,
        });
        break;
      case 'seed_discount':
        activeEffects.push({
          kind: 'seed_discount', cropId: spec.cropId, factor: spec.factor, expiresAfterDay: state.currentDay,
        });
        break;
      case 'weather_pin':
        break; // fire-time-only; inert if ever authored on a choice
      case 'contract':
        contract = {
          eventId: def.id, cropId: spec.cropId, quantity: spec.quantity,
          remaining: spec.quantity, deadlineDay: pending.firedDay + spec.deadlineDays, reward: spec.reward,
        };
        break;
    }
  }

  return {
    ...state,
    coinBalance,
    plots,
    peakBalance: Math.max(state.peakBalance, coinBalance),
    farmEvents: {
      ...state.farmEvents,
      pending: null,
      activeEffects,
      contract,
      lastResolved: { eventId: def.id, choice, day: state.currentDay, auto },
    },
  };
}
```

- [ ] **Step 4: Run to verify pass, then full gate + commit**

```bash
npx vitest run tests/engine/farmEvents.resolve.test.ts && npm test && npm run lint
git add -A && git commit -m "feat(engine): 022 choice resolution + event seed discount"
```

---

### Task 6: `processTurn` integration

**Files:**
- Modify: `src/engine/gameEngine.ts` (the `processTurn` body)
- Test: `tests/engine/farmEvents.turn.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/farmEvents.turn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initialGameState, processTurn, resolveFarmEventChoice } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventEffect, GameState } from '../../src/engine/types';

const rng = (v = 0.5) => () => v;

function planted(state: GameState, plotId: number, cropId: 'radish' | 'parsnip' | 'pumpkin', daysRemaining: number): GameState {
  return {
    ...state,
    plots: state.plots.map(p => (p.id === plotId
      ? { ...p, cropId, daysRemaining, dayPlanted: state.currentDay }
      : p)),
  };
}

describe('processTurn × farm events', () => {
  it('auto-resolves a still-pending event as choice B with auto=true', () => {
    let s = initialGameState();
    s = { ...s, currentDay: 8, farmEvents: { ...s.farmEvents, pending: { eventId: 'millers_order', firedDay: 8 } } };
    const { state: out } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng());
    expect(out.farmEvents.pending).toBeNull();
    expect(out.farmEvents.lastResolved).toMatchObject({ eventId: 'millers_order', choice: 'B', auto: true });
    // B's +12 consolation flowed into the turn's opening balance
    expect(out.coinBalance).toBeGreaterThan(0);
  });

  it('draws the season schedule on the first turn', () => {
    const { state: out } = processTurn(initialGameState(), 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(out.farmEvents.scheduleSeason).toBe(1);
    expect(out.farmEvents.scheduledDays.length).toBeGreaterThanOrEqual(1);
  });

  it('fires a scheduled event for the day the player is about to start', () => {
    let s = initialGameState();
    // Day 7 turn completing → new day 8 is scheduled
    s = { ...s, currentDay: 7, farmEvents: { ...s.farmEvents, scheduleSeason: 1, scheduledDays: [8] } };
    const { state: out } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.0));
    expect(out.currentDay).toBe(8);
    expect(out.farmEvents.pending?.firedDay).toBe(8);
  });

  it('a pinned flash drought overrides the weather roll and is consumed', () => {
    let s = initialGameState();
    const pin: FarmEventEffect = { kind: 'weather_pin', weatherId: 'flash_drought', day: 6 };
    s = { ...s, currentDay: 6, coinBalance: 200, farmEvents: { ...s.farmEvents, scheduleSeason: 1, activeEffects: [pin] } };
    // No weatherRoll override: the pin must beat the band roll (rng 0.99 → perfect_sun otherwise)
    const { state: out, log } = processTurn(s, undefined, undefined, undefined, DEFAULT_ECONOMY, rng(0.99));
    expect(log.weatherId).toBe('flash_drought');
    expect(out.farmEvents.activeEffects).toEqual([]);
  });

  it('yield buff multiplies harvests and double-exhausts while active', () => {
    let s = initialGameState();
    const buffEffect: FarmEventEffect = { kind: 'yield_buff', eventId: 'bountiful_spring', multiplier: 1.5, harvestsRemaining: 3, exhaustionFactor: 2 };
    s = planted({ ...s, coinBalance: 200, farmEvents: { ...s.farmEvents, scheduleSeason: 1, activeEffects: [buffEffect] } }, 0, 'radish', 1);
    const { state: out, log } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(log.harvests[0].adjustedYield).toBe(18); // coins(12 × 1.0 × 1.5)
    expect(out.plots[0].consecutiveHarvests).toBe(2); // exhaustionFactor 2
    expect(log.eventBuffsApplied).toEqual([{ eventId: 'bountiful_spring', multiplier: 1.5, harvestsAffected: 1 }]);
    expect(out.farmEvents.activeEffects).toEqual([{ ...buffEffect, harvestsRemaining: 2 }]);
  });

  it('contract progress, completion reward before the bankruptcy check, and log fields', () => {
    let s = initialGameState();
    const contract = { eventId: 'fair_committee' as const, cropId: 'radish' as const, quantity: 4, remaining: 1, deadlineDay: 12, reward: 40 };
    // Balance 10 < lease 15: only the +40 completion reward (plus the 12-coin harvest) avoids bankruptcy.
    s = planted({ ...s, currentDay: 8, coinBalance: 10, farmEvents: { ...s.farmEvents, scheduleSeason: 1, contract } }, 0, 'radish', 1);
    const { state: out, log, isBankrupt } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(isBankrupt).toBe(false);
    expect(log.contractCompleted).toEqual({ eventId: 'fair_committee', reward: 40 });
    expect(out.farmEvents.contract).toBeNull();
  });

  it('contract expiry clears without penalty and logs it', () => {
    let s = initialGameState();
    const contract = { eventId: 'fair_committee' as const, cropId: 'radish' as const, quantity: 4, remaining: 2, deadlineDay: 8, reward: 40 };
    s = { ...s, currentDay: 8, coinBalance: 200, farmEvents: { ...s.farmEvents, scheduleSeason: 1, contract } };
    const { state: out, log } = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.9));
    expect(log.contractExpired).toBe('fair_committee');
    expect(out.farmEvents.contract).toBeNull();
  });

  it('a disabled slice stays empty across a full run of turns', () => {
    let s = initialGameState(DEFAULT_ECONOMY, { farmEventsEnabled: false });
    s = { ...s, coinBalance: 10_000 }; // survive regardless of farming
    for (let i = 0; i < 25 && s.phase === 'playing'; i++) {
      s = processTurn(s, 'sunny', undefined, undefined, DEFAULT_ECONOMY, rng(0.4)).state;
      if (s.phase === 'season_passed') s = { ...s, phase: 'playing' };
    }
    expect(s.farmEvents.scheduledDays).toEqual([]);
    expect(s.farmEvents.pending).toBeNull();
    expect(s.farmEvents.seenIds).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/farmEvents.turn.test.ts
```
Expected: FAIL — `initialGameState` has no options parameter; `processTurn` ignores farm events.

- [ ] **Step 3: Add the `initialGameState` options parameter**

Replace the signature and the `farmEvents` line added in Task 1:

```ts
/** Returns the canonical starting state for a new game run.
 *  `farmEventsEnabled` implements the 022 run-2 gate; the UI passes the
 *  records-derived value, while the simulator and tests default to true. */
export function initialGameState(
  config: EconomyConfig = DEFAULT_ECONOMY,
  opts: { farmEventsEnabled?: boolean } = {},
): GameState {
```
and in the returned object:
```ts
    farmEvents: { ...EMPTY_FARM_EVENTS, enabled: opts.farmEventsEnabled ?? true },
```

- [ ] **Step 4: Rewrite `processTurn`**

Replace the whole `processTurn` function body with the version below. It is the current implementation with the `022 FE-*` blocks inserted and `state` reads swapped to the prepared `s` snapshot — every non-`FE` step is behavior-identical to today.

```ts
export function processTurn(
  state: GameState,
  weatherRoll?: WeatherId,
  pestDestructionOverride?: number[],
  weatherRollOverride?: number,
  config: EconomyConfig = DEFAULT_ECONOMY,
  rng: () => number = Math.random,
): TurnResult {
  // 022 FE-A: a still-pending farm event resolves as the safe choice (B, auto)
  // so the engine is never blocked on an unanswered modal; then lazily draw
  // this season's event schedule (no-op once drawn / while disabled).
  const preState = state.farmEvents.pending !== null
    ? resolveFarmEventChoice(state, 'B', config, true)
    : state;
  const s: GameState = {
    ...preState,
    farmEvents: ensureSchedule(preState.farmEvents, preState.currentDay, config, rng),
  };

  // Compute season once — reused for both lease and weather band selection
  const season = getSeasonForDay(s.currentDay, config);

  // Market Step A: activate any pending event so its modifier applies to THIS harvest.
  const marketAfterActivate = activatePending(s.market, config.market);
  const activeMarket = marketAfterActivate.active;

  // Step 1: Decrement daysRemaining on all occupied plots
  const plots = s.plots.map(plot => {
    if (plot.cropId === null || plot.daysRemaining === null) return plot;
    return { ...plot, daysRemaining: plot.daysRemaining - 1 };
  });

  // Step 2: Resolve weather — test override > 022 pinned weather > seasonal-band roll
  const weatherId: WeatherId = (() => {
    if (weatherRoll) return weatherRoll;
    const pinned = pinnedWeatherFor(s.farmEvents.activeEffects, s.currentDay);
    if (pinned !== null) return pinned;
    const bands = getDisasterBandsForSeason(season);
    const roll = weatherRollOverride ?? rng();
    for (const band of bands) {
      if (roll < band.threshold) return band.id;
    }
    return 'perfect_sun';
  })();
  const weather = WEATHER_DEFINITIONS[weatherId];

  // Step 2a: Pest Infestation — destroy occupied plots before harvest (FR-004)
  const pestDestroyedPlots: number[] = [];
  const plotsAfterPest = (() => {
    if (weatherId !== 'pest_infestation') return plots;
    return plots.map(plot => {
      if (plot.cropId === null) return plot; // empty/exhausted plots immune
      const isDestroyed = pestDestructionOverride !== undefined
        ? pestDestructionOverride.includes(plot.id)
        : rng() < pestDestructionChanceFor(s, config);
      if (isDestroyed) {
        pestDestroyedPlots.push(plot.id);
        return {
          ...plot,
          cropId: null,
          daysRemaining: null,
          dayPlanted: null,
          droughtPenalised: false,
          consecutiveHarvests: 0,
          exhaustedSinceDay: null,
          pestDamaged: true,
        };
      }
      return plot;
    });
  })();

  // Step 2b: Flash Drought — extend counter when event fires (stacks); window is
  // shortened with an irrigation well (019)
  const flashDroughtDaysAfterEvent = weatherId === 'flash_drought'
    ? s.flashDroughtDaysRemaining + droughtWindowDaysFor(s, config)
    : s.flashDroughtDaysRemaining;

  // 019: disaster mitigations in effect this turn (for the Day Summary banner)
  const buildingsApplied = computeBuildingsApplied(weatherId, s.buildings);

  // 019: effective exhaustion-recovery period this turn (Compost Bin shortens it).
  const effectiveRecoveryDays = s.buildings.compost_bin
    ? config.buildings.exhaustionRecoveryDays
    : config.exhaustionRecoveryDays;

  // 019 review fix: occupied plots the pest could have hit (pre-destruction).
  const pestPlotsAtRisk = pestPlotsAtRiskFor(weatherId, plots);

  // Step 3: Harvest all plots where daysRemaining === 0
  // 022: an active yield buff multiplies each harvest and raises the exhaustion increment.
  const buffFactor = buffMultiplierFor(s.farmEvents.activeEffects);
  const exhaustionStep = buffExhaustionFactorFor(s.farmEvents.activeEffects);
  const harvests: HarvestEvent[] = [];
  const exhaustedPlots: number[] = [];
  const stallMod = s.buildings.farm_stand ? config.buildings.yieldMultiplier : 1;
  const harvestedPlots = plotsAfterPest.map(plot => {
    if (plot.cropId === null || plot.daysRemaining !== 0) return plot;
    const crop = config.crops[plot.cropId];
    const marketMod = marketMultiplierFor(activeMarket, plot.cropId);
    const adjustedYield = coins(crop.baseYield * weather.multiplier * marketMod * stallMod * buffFactor);
    harvests.push({
      plotId: plot.id,
      cropId: plot.cropId,
      baseYield: crop.baseYield,
      weatherMultiplier: weather.multiplier,
      adjustedYield,
    });
    const newConsecutiveHarvests = plot.consecutiveHarvests + exhaustionStep;
    if (newConsecutiveHarvests >= config.exhaustionThreshold) {
      exhaustedPlots.push(plot.id);
      return {
        ...plot,
        cropId: null,
        dayPlanted: null,
        daysRemaining: null,
        droughtPenalised: false,
        consecutiveHarvests: 0,
        exhaustedSinceDay: s.currentDay + 1, // post-increment day
      };
    }
    return {
      ...plot,
      cropId: null,
      dayPlanted: null,
      daysRemaining: null,
      droughtPenalised: false,
      consecutiveHarvests: newConsecutiveHarvests,
    };
  });

  // Step 4: Add harvest income to balance
  const totalHarvestIncome = harvests.reduce((sum, h) => sum + h.adjustedYield, 0);
  const openingBalance = s.coinBalance;
  let coinBalance = openingBalance + totalHarvestIncome;

  // Step 4.5: Harvest streak update — bonus counts toward bankruptcy avoidance
  const streakBefore = s.harvestStreak;
  const { streakAfter, streakBonus, peakHarvestStreak } = computeStreakUpdate(
    streakBefore,
    s.peakHarvestStreak,
    harvests.length > 0,
    config.streakBonusCap,
    config.streakBonusPerLevel,
  );
  coinBalance += streakBonus;

  // 022 FE-B: contract accounting — a completion reward counts toward survival,
  // exactly like the streak bonus (credited before the bankruptcy check).
  const contractOutcome = applyContractProgress(s.farmEvents.contract, harvests, s.currentDay);
  if (contractOutcome.completed !== null) coinBalance += contractOutcome.completed.reward;

  // 022 FE-C: buff bookkeeping for the log + end-of-turn effect expiry.
  const eventBuffsApplied = harvests.length === 0 ? [] : s.farmEvents.activeEffects
    .filter((e): e is Extract<FarmEventEffect, { kind: 'yield_buff' }> =>
      e.kind === 'yield_buff' && e.harvestsRemaining > 0)
    .map(e => ({
      eventId: e.eventId,
      multiplier: e.multiplier,
      harvestsAffected: Math.min(e.harvestsRemaining, harvests.length),
    }));
  const feAfterTurn: FarmEventsState = {
    ...s.farmEvents,
    activeEffects: tickEffects(s.farmEvents.activeEffects, harvests.length, s.currentDay),
    contract: contractOutcome.contract,
  };
  const contractProgressLog = contractOutcome.contract === null ? null : {
    cropId: contractOutcome.contract.cropId,
    done: contractOutcome.contract.quantity - contractOutcome.contract.remaining,
    total: contractOutcome.contract.quantity,
    deadlineDay: contractOutcome.contract.deadlineDay,
  };

  // Step 5: Bankruptcy check — if balance < lease fee, game over
  const leaseForDay = season.leasePerDay;
  if (coinBalance < leaseForDay) {
    const log: DailyLogEntry = {
      day: s.currentDay,
      weatherId,
      weatherMultiplier: weather.multiplier,
      harvests,
      totalHarvestIncome,
      openingBalance,
      landLeaseDeducted: 0,
      taxRate: config.taxRate,
      taxDeducted: 0,
      netChange: coinBalance - openingBalance,
      closingBalance: coinBalance,
      exhaustedPlots,
      pestDestroyedPlots,
      pestPlotsAtRisk,
      flashDroughtDaysAfter: flashDroughtDaysAfterEvent,
      streakBefore,
      streakAfter,
      streakBonus,
      marketActive: activeMarket,
      marketAnnounced: null,
      buildingsApplied,
      recoveryDays: effectiveRecoveryDays,
      eventBuffsApplied,
      contractProgress: contractProgressLog,
      contractCompleted: contractOutcome.completed,
      contractExpired: contractOutcome.expired,
    };
    const bankruptState: GameState = {
      ...s,
      plots: harvestedPlots,
      coinBalance,
      phase: 'bankrupt',
      flashDroughtDaysRemaining: flashDroughtDaysAfterEvent,
      lastDailyLog: log,
      harvestStreak: streakAfter,
      peakHarvestStreak,
      market: marketAfterActivate,
      farmEvents: feAfterTurn,
    };
    return { state: bankruptState, log, isBankrupt: true };
  }

  // Step 6: Deduct land lease fee
  coinBalance -= leaseForDay;
  const landLeaseDeducted = leaseForDay;

  // Step 7: Compute and deduct tax
  const taxDeducted = coins(coinBalance * config.taxRate);
  coinBalance -= taxDeducted;

  // Step 8: Increment currentDay
  const currentDay = s.currentDay + 1;

  // Step 8.4: Season-end check
  const { phase: seasonPhase, nextDay: nextDayAfterTransition } = resolveSeasonEnd(
    s.currentDay,
    currentDay,
    season,
    coinBalance,
    s.endlessMode,
  );

  // Step 8.4b: Reset harvest streak when a season is cleared
  const harvestStreakAfterSeason = applySeasonStreakReset(streakAfter, seasonPhase);

  // Step 8.6: Decrement flash drought counter each calendar day EXCEPT the turn it fires
  const flashDroughtDaysRemaining = (weatherId !== 'flash_drought' && flashDroughtDaysAfterEvent > 0)
    ? flashDroughtDaysAfterEvent - 1
    : flashDroughtDaysAfterEvent;

  // Step 8.5: Natural recovery — clear exhaustion after effectiveRecoveryDays turns
  const recoveredPlots = harvestedPlots.map(plot => {
    if (plot.exhaustedSinceDay === null) return plot;
    if (currentDay - plot.exhaustedSinceDay >= effectiveRecoveryDays) {
      return { ...plot, exhaustedSinceDay: null, consecutiveHarvests: 0 };
    }
    return plot;
  });

  // Step 9: Update peakBalance
  const peakBalance = Math.max(s.peakBalance, coinBalance);

  // Market Step B: expire the active event, then maybe schedule a new one at a boundary.
  const activeAfterExpire = expireActive(activeMarket);
  const scheduled = rollSchedule(
    { active: activeAfterExpire, pending: null },
    s.currentDay,
    config.market,
    rng,
  );
  const nextMarket = { active: activeAfterExpire, pending: scheduled };

  // 022 FE-D: fire a scheduled event for the day the player is about to start.
  // Terminal season phases don't fire (the run/season screen owns the moment).
  const canFire = seasonPhase === 'playing' || seasonPhase === 'season_passed';
  const feFinal = canFire
    ? maybeFireEvent(feAfterTurn, nextDayAfterTransition, config, rng)
    : feAfterTurn;

  // Step 10: Build DailyLogEntry
  const log: DailyLogEntry = {
    day: s.currentDay,
    weatherId,
    weatherMultiplier: weather.multiplier,
    harvests,
    totalHarvestIncome,
    openingBalance,
    landLeaseDeducted,
    taxRate: config.taxRate,
    taxDeducted,
    netChange: coinBalance - openingBalance,
    closingBalance: coinBalance,
    exhaustedPlots,
    pestDestroyedPlots,
    pestPlotsAtRisk,
    flashDroughtDaysAfter: flashDroughtDaysRemaining,
    streakBefore,
    streakAfter: harvestStreakAfterSeason,
    streakBonus,
    marketActive: activeMarket,
    marketAnnounced: scheduled,
    buildingsApplied,
    recoveryDays: effectiveRecoveryDays,
    eventBuffsApplied,
    contractProgress: contractProgressLog,
    contractCompleted: contractOutcome.completed,
    contractExpired: contractOutcome.expired,
  };

  // Step 9.5: Increment disastersSurvived on non-bankrupt disaster turns
  const isDisasterTurn = (DISASTER_WEATHER_IDS as readonly string[]).includes(weatherId);
  const disastersSurvived = s.disastersSurvived + (isDisasterTurn ? 1 : 0);

  const nextState: GameState = {
    ...s,
    plots: recoveredPlots,
    coinBalance,
    currentDay: nextDayAfterTransition,
    flashDroughtDaysRemaining,
    peakBalance,
    lastDailyLog: log,
    phase: seasonPhase,
    disastersSurvived,
    harvestStreak: harvestStreakAfterSeason,
    peakHarvestStreak,
    market: nextMarket,
    farmEvents: feFinal,
  };

  return { state: nextState, log, isBankrupt: false };
}
```

- [ ] **Step 5: Run new tests, then the whole suite**

```bash
npx vitest run tests/engine/farmEvents.turn.test.ts && npm test && npm run lint
```
Expected: PASS. If existing `processTurn` tests fail, the cause is almost always an rng-draw shift: `ensureSchedule` consumes 2–3 draws on the first turn of each season before the weather roll. Tests that pass an explicit `weatherRoll` are unaffected; tests that seed `rng` for weather must account for the extra draws (prepend padding values to their sequence).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(engine): 022 farm events wired into processTurn"
```

---### Task 7: Persistence — schema 10 migration + hardening

**Files:**
- Modify: `src/engine/constants.ts` (`SCHEMA_VERSION`)
- Modify: `src/engine/useGameEngine.ts`
- Test: `tests/engine/farmEvents.migration.test.tsx` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/farmEvents.migration.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { EMPTY_FARM_EVENTS } from '../../src/engine/farmEvents';

const STORAGE_KEY = 'pixel-parsnips-state';
const RECORDS_KEY = 'pixel-parsnips-records';

function v9Save(): string {
  // A real v10 state minus the farmEvents slice, stamped v9 — the shape v9 saves have.
  const { farmEvents: _dropped, ...v9State } = initialGameState();
  return JSON.stringify({ schemaVersion: 9, state: { ...v9State, schemaVersion: 9 } });
}

function seedRecords(totalRunsCompleted: number): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({
    schemaVersion: 2, bestDaysSurvived: 5, bestPeakBalance: 100, bestSeasonReached: 1,
    mostDisastersSurvived: 0, bestHarvestStreak: 2, totalRunsCompleted,
  }));
}

describe('v9 → v10 migration', () => {
  beforeEach(() => localStorage.clear());

  it('adds the empty slice, enabled=false on a device with no completed runs', () => {
    localStorage.setItem(STORAGE_KEY, v9Save());
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents).toEqual({ ...EMPTY_FARM_EVENTS, enabled: false });
    expect(result.current.state.schemaVersion).toBe(10);
  });

  it('enables events for devices with completed runs', () => {
    seedRecords(3);
    localStorage.setItem(STORAGE_KEY, v9Save());
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.enabled).toBe(true);
  });

  it('a malformed farmEvents field on a v10 save loads as the records-derived empty slice', () => {
    seedRecords(1);
    const tampered = { ...initialGameState(), farmEvents: 'garbage' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: tampered }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents).toEqual({ ...EMPTY_FARM_EVENTS, enabled: true });
  });

  it('a persisted pending event survives the reload round-trip', () => {
    const withPending = {
      ...initialGameState(),
      farmEvents: {
        ...EMPTY_FARM_EVENTS, scheduleSeason: 1, scheduledDays: [8],
        pending: { eventId: 'traveling_merchant', firedDay: 8 }, seenIds: ['traveling_merchant'],
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state: withPending }));
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.pending).toEqual({ eventId: 'traveling_merchant', firedDay: 8 });
  });

  it('a brand-new device (no save) starts its first run with events disabled', () => {
    const { result } = renderHook(() => useGameEngine());
    expect(result.current.state.farmEvents.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/farmEvents.migration.test.tsx
```
Expected: FAIL — schemaVersion is 9 and no migration branch exists.

- [ ] **Step 3: Implement**

1. `src/engine/constants.ts` line 12: `export const SCHEMA_VERSION = 10;`

2. In `src/engine/useGameEngine.ts`:

Add imports:

```ts
import { EMPTY_FARM_EVENTS, merchantOfferValue } from './farmEvents';
import { loadRecords } from './records';   // extend the existing records import
import type { FarmEventsState, FarmEventId, FarmEventChoiceId, FarmEventDefinition, ContractState, FarmEventEffect } from './types';
```
(`merchantOfferValue` and the choice types are used in Task 8 — importing now is fine.)

After `normalizeBuildings` add:

```ts
/** 022 gate: events unlock from a device's second run onward. */
function defaultFarmEventsEnabled(): boolean {
  return loadRecords().totalRunsCompleted >= 1;
}

const FARM_EVENT_IDS: readonly FarmEventId[] = [
  'traveling_merchant', 'bountiful_spring', 'drought_warning',
  'millers_order', 'fair_committee', 'wandering_beekeeper',
];
const isFarmEventId = (v: unknown): v is FarmEventId =>
  (FARM_EVENT_IDS as readonly unknown[]).includes(v);

/** Normalize a raw `farmEvents` value from a save: missing/malformed → empty slice
 *  with the records-derived enabled flag. Structurally valid fields pass through;
 *  anything suspect degrades to its empty value (never crashes, never blocks). */
function normalizeFarmEvents(raw: unknown, fallbackEnabled: boolean): FarmEventsState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_FARM_EVENTS, enabled: fallbackEnabled };
  }
  const r = raw as Record<string, unknown>;
  const pendingRaw = r.pending as Record<string, unknown> | null | undefined;
  const pending = pendingRaw && typeof pendingRaw === 'object'
    && isFarmEventId(pendingRaw.eventId) && typeof pendingRaw.firedDay === 'number'
    ? { eventId: pendingRaw.eventId, firedDay: pendingRaw.firedDay }
    : null;
  const contractRaw = r.contract as Record<string, unknown> | null | undefined;
  const contract: ContractState | null = contractRaw && typeof contractRaw === 'object'
    && isFarmEventId(contractRaw.eventId) && isCropId(contractRaw.cropId)
    && typeof contractRaw.quantity === 'number' && typeof contractRaw.remaining === 'number'
    && typeof contractRaw.deadlineDay === 'number' && typeof contractRaw.reward === 'number'
    ? {
        eventId: contractRaw.eventId, cropId: contractRaw.cropId,
        quantity: contractRaw.quantity, remaining: contractRaw.remaining,
        deadlineDay: contractRaw.deadlineDay, reward: contractRaw.reward,
      }
    : null;
  const isLiveEffect = (e: unknown): e is FarmEventEffect => {
    if (!e || typeof e !== 'object') return false;
    const k = (e as Record<string, unknown>).kind;
    return k === 'yield_buff' || k === 'seed_discount' || k === 'weather_pin';
  };
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : fallbackEnabled,
    scheduleSeason: typeof r.scheduleSeason === 'number' ? r.scheduleSeason : 0,
    scheduledDays: Array.isArray(r.scheduledDays) ? r.scheduledDays.filter((d): d is number => typeof d === 'number') : [],
    pending,
    activeEffects: Array.isArray(r.activeEffects) ? r.activeEffects.filter(isLiveEffect) : [],
    contract,
    seenIds: Array.isArray(r.seenIds) ? r.seenIds.filter(isFarmEventId) : [],
    lastResolved: null, // analytics-only; safe to drop on load
  };
}
```

In `hardenCurrentSchema`, add before the return:

```ts
  const farmEvents = normalizeFarmEvents(st.farmEvents, defaultFarmEventsEnabled());
```
and add `farmEvents,` to the returned object (next to `buildings`).

In `migrateState`, insert the v9 branch between the current-schema branch and the v8 branch:

```ts
  // Schema 9 → 10 — add farm events (022); enabled derives from completed-run records.
  if (parsed.schemaVersion === 9) {
    console.info('[PixelParsnips] Migrating save from v9 to v10 (Farm Events).');
    return hardenCurrentSchema({
      ...(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
    });
  }
```
(All older branches already funnel through `hardenCurrentSchema`, which now fills `farmEvents` — update each branch's `console.info` text to mention Farm Events only if you touch it anyway; not required.)

3. Wire gating into run creation — replace the three `initialGameState(ECONOMY)` calls:

- in `loadState`: `return initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });` (both the no-raw and catch paths, and the `?? initialGameState(...)` fallback)
- in `restart` and `endRunVictory`: `const fresh = initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });`

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/engine/farmEvents.migration.test.tsx && npm test && npm run lint
git add -A && git commit -m "feat(persistence): 022 schema 10 migration, hardening, and run-2 gating"
```

---

### Task 8: `useGameEngine` action + pending view + `play_started.events_enabled`

**Files:**
- Modify: `src/engine/useGameEngine.ts`
- Modify: `src/analytics/events.ts` (play_started only; the rest comes in Task 14)
- Test: `tests/engine/useGameEngine.farmEvents.test.tsx` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/engine/useGameEngine.farmEvents.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameEngine } from '../../src/engine/useGameEngine';
import { initialGameState } from '../../src/engine/gameEngine';
import { EMPTY_FARM_EVENTS } from '../../src/engine/farmEvents';

const STORAGE_KEY = 'pixel-parsnips-state';

function seedPendingSave(): void {
  const state = {
    ...initialGameState(),
    currentDay: 8,
    farmEvents: {
      ...EMPTY_FARM_EVENTS, scheduleSeason: 1, scheduledDays: [8],
      pending: { eventId: 'millers_order', firedDay: 8 }, seenIds: ['millers_order'],
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 10, state }));
}

describe('useGameEngine × farm events', () => {
  beforeEach(() => localStorage.clear());

  it('exposes the pending event view with the catalog definition', () => {
    seedPendingSave();
    const { result } = renderHook(() => useGameEngine());
    const view = result.current.getPendingFarmEvent();
    expect(view?.def.id).toBe('millers_order');
    expect(view?.balance).toBe(result.current.state.coinBalance);
  });

  it('resolveFarmEvent applies the choice and clears pending', () => {
    seedPendingSave();
    const { result } = renderHook(() => useGameEngine());
    const before = result.current.state.coinBalance;
    let ok = false;
    act(() => { ok = result.current.resolveFarmEvent('B'); });
    expect(ok).toBe(true);
    expect(result.current.state.farmEvents.pending).toBeNull();
    expect(result.current.state.coinBalance).toBe(before + 12);
  });

  it('resolveFarmEvent returns false when nothing is pending', () => {
    const { result } = renderHook(() => useGameEngine());
    let ok = true;
    act(() => { ok = result.current.resolveFarmEvent('A'); });
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/engine/useGameEngine.farmEvents.test.tsx
```
Expected: FAIL — `getPendingFarmEvent` / `resolveFarmEvent` don't exist.

- [ ] **Step 3: Implement**

1. In `src/analytics/events.ts`, extend `play_started` and bump its version:

```ts
  play_started: { start_action: string; day: number; onboarding_active: boolean; events_enabled: boolean };
```
and in `EVENT_VERSIONS`: `play_started: 2,`.

2. In `src/engine/useGameEngine.ts`:

Add `resolveFarmEventChoice as engineResolveFarmEventChoice,` and `merchantOfferValue` usage. Define the view type near `BuildingCardData`:

```ts
export interface PendingFarmEventView {
  def: FarmEventDefinition;
  /** Live sell-now estimate (Traveling Merchant); 0 for other events. */
  offerValue: number;
  balance: number;
}
```

Extend `GameEngineHook`:

```ts
  resolveFarmEvent: (choice: FarmEventChoiceId) => boolean;
  getPendingFarmEvent: () => PendingFarmEventView | null;
```

In `signalPlayStarted`, add the new property to the `trackPlayStartedOnce` call:

```ts
      events_enabled: s.farmEvents.enabled,
```

Add the callbacks (after `buyBuilding`):

```ts
  const resolveFarmEvent = useCallback((choice: FarmEventChoiceId): boolean => {
    const prev = stateRef.current;
    if (prev.farmEvents.pending === null) return false;
    const next = engineResolveFarmEventChoice(prev, choice, ECONOMY);
    if (next === prev) return false; // unaffordable buy-in — modal stays up
    signalPlayStarted('farm_event_choice');
    commitState(next);
    return true;
  }, [commitState, signalPlayStarted]);

  const getPendingFarmEvent = useCallback((): PendingFarmEventView | null => {
    const pending = state.farmEvents.pending;
    if (pending === null) return null;
    const def = ECONOMY.farmEvents.events.find(e => e.id === pending.eventId);
    if (def === undefined) return null;
    return { def, offerValue: merchantOfferValue(state, ECONOMY), balance: state.coinBalance };
  }, [state]);
```

Add both to the returned object.

3. Fix `play_started` call-site tests: any test asserting `play_started` props now needs `events_enabled` — search `grep -rln "play_started" tests/` and extend the expected objects with `events_enabled: expect.any(Boolean)` (or the concrete value).

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/engine/useGameEngine.farmEvents.test.tsx && npm test && npm run lint
git add -A && git commit -m "feat(engine): 022 resolve action, pending view, events_enabled on play_started"
```

---

### Task 9: `FarmEventModal` component

**Files:**
- Create: `src/components/FarmEventModal.tsx`
- Test: `tests/components/FarmEventModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/components/FarmEventModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FarmEventModal, choiceCost } from '../../src/components/FarmEventModal';
import { FARM_EVENT_DEFINITIONS } from '../../src/engine/farmEventCatalog';

const def = (id: string) => FARM_EVENT_DEFINITIONS.find(e => e.id === id)!;

describe('choiceCost', () => {
  it('sums negative coins_delta amounts as a positive cost', () => {
    expect(choiceCost(def('wandering_beekeeper').choiceA.effects)).toBe(15);
    expect(choiceCost(def('millers_order').choiceB.effects)).toBe(0);
  });
});

describe('FarmEventModal', () => {
  it('renders title, body, and both choices; clicking reports the choice', () => {
    const onChoose = vi.fn();
    render(<FarmEventModal view={{ def: def('millers_order'), offerValue: 0, balance: 100 }} isNew={false} onChoose={onChoose} />);
    expect(screen.getByRole('dialog', { name: "The Miller's Order" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /take the contract/i }));
    expect(onChoose).toHaveBeenCalledWith('A');
    fireEvent.click(screen.getByRole('button', { name: /sell your spare sacks/i }));
    expect(onChoose).toHaveBeenCalledWith('B');
  });

  it('shows the live merchant estimate', () => {
    render(<FarmEventModal view={{ def: def('traveling_merchant'), offerValue: 107, balance: 100 }} isNew={false} onChoose={() => {}} />);
    expect(screen.getByText(/est\. \+107🪙/)).toBeInTheDocument();
  });

  it('disables an unaffordable buy-in with a hint', () => {
    const onChoose = vi.fn();
    render(<FarmEventModal view={{ def: def('wandering_beekeeper'), offerValue: 0, balance: 10 }} isNew={false} onChoose={onChoose} />);
    const btn = screen.getByRole('button', { name: /pay 15🪙/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/not enough coins/i)).toBeInTheDocument();
  });

  it('shows the New! ribbon only on the second run', () => {
    const { rerender } = render(<FarmEventModal view={{ def: def('bountiful_spring'), offerValue: 0, balance: 100 }} isNew={true} onChoose={() => {}} />);
    expect(screen.getByText('New!')).toBeInTheDocument();
    rerender(<FarmEventModal view={{ def: def('bountiful_spring'), offerValue: 0, balance: 100 }} isNew={false} onChoose={() => {}} />);
    expect(screen.queryByText('New!')).toBeNull();
  });

  it('does not close on Escape — a choice is required', () => {
    const onChoose = vi.fn();
    render(<FarmEventModal view={{ def: def('bountiful_spring'), offerValue: 0, balance: 100 }} isNew={false} onChoose={onChoose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/components/FarmEventModal.test.tsx
```
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/components/FarmEventModal.tsx`:

```tsx
import type { FarmEventChoiceId, FarmEventEffectSpec } from '../engine/types';
import type { PendingFarmEventView } from '../engine/useGameEngine';
import { EmojiIcon } from './EmojiIcon';

/** Total up-front cost of a choice: the sum of its negative coins_delta amounts, as a positive number. */
export function choiceCost(effects: FarmEventEffectSpec[]): number {
  return effects.reduce((sum, e) => (e.kind === 'coins_delta' && e.amount < 0 ? sum - e.amount : sum), 0);
}

interface FarmEventModalProps {
  view: PendingFarmEventView;
  /** True during the player's second run — the feature just unlocked. */
  isNew: boolean;
  onChoose: (choice: FarmEventChoiceId) => void;
}

/**
 * 022 — the Farm Event choice modal. Deliberately unclosable (no Escape, no
 * backdrop dismiss): the run pauses until the player picks a side. Reloading
 * re-presents it (pending persists in the save).
 */
export function FarmEventModal({ view, isNew, onChoose }: FarmEventModalProps) {
  const { def, offerValue, balance } = view;
  const costA = choiceCost(def.choiceA.effects);
  const affordableA = balance >= costA;
  const summaryA = def.id === 'traveling_merchant'
    ? `All growing crops sold instantly — est. +${offerValue}🪙.`
    : def.choiceA.summary;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={def.title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
    >
      <div className="max-w-sm w-full bg-farm-soil border-2 border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4">
        <h2 className="font-pixel text-title text-farm-gold flex items-center gap-2">
          <EmojiIcon>{def.emoji}</EmojiIcon>
          <span>{def.title}</span>
          {isNew && (
            <span className="ml-auto font-pixel text-caption text-farm-ink bg-farm-gold px-2 py-0.5 rounded uppercase tracking-widest">
              New!
            </span>
          )}
        </h2>
        <p className="text-body text-farm-parchment leading-relaxed">{def.body}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            disabled={!affordableA}
            onClick={() => onChoose('A')}
            className="font-pixel text-body text-left px-4 py-3 min-h-[44px] rounded bg-farm-grass text-farm-parchment hover:enabled:bg-farm-gold hover:enabled:text-farm-ink disabled:opacity-40 transition-colors"
          >
            <span className="block">{def.choiceA.label}</span>
            <span className="block text-caption text-farm-parchment/80 mt-1">
              {affordableA ? summaryA : `Not enough coins (needs ${costA}🪙).`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('B')}
            className="font-pixel text-body text-left px-4 py-3 min-h-[44px] rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-[#3A2510] transition-colors"
          >
            <span className="block">{def.choiceB.label}</span>
            <span className="block text-caption text-farm-parchment/80 mt-1">{def.choiceB.summary}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/components/FarmEventModal.test.tsx
git add -A && git commit -m "feat(ui): 022 FarmEventModal"
```

---

### Task 10: GameBoard + App wiring

**Files:**
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/App.tsx`
- Test: `tests/components/GameBoard.farmEvents.test.tsx` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/components/GameBoard.farmEvents.test.tsx`. Copy the render-props helper pattern from `tests/components/GameBoard.safeguard.test.tsx` (it builds a full `GameBoardProps` fixture) and add the two new props (`pendingFarmEvent`, `onResolveFarmEvent`); the assertions that matter:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// ...reuse the GameBoard fixture helper from GameBoard.safeguard.test.tsx, extended with:
//   pendingFarmEvent: null, onResolveFarmEvent: vi.fn()

describe('GameBoard × farm events', () => {
  it('renders the FarmEventModal when a pending view is supplied', () => {
    // render GameBoard with pendingFarmEvent set to
    // { def: FARM_EVENT_DEFINITIONS[0], offerValue: 0, balance: 100 }
    // expect screen.getByRole('dialog', { name: 'The Traveling Merchant' }) to exist
  });

  it('does not advance the day while an event is pending', () => {
    // render with pendingFarmEvent set and spy onNextDay;
    // fireEvent.click on the (desktop) Next Day button in the HUD;
    // expect onNextDay NOT to have been called
  });

  it('routes the modal choice to onResolveFarmEvent', () => {
    // click choice B in the modal; expect onResolveFarmEvent called with 'B'
  });
});
```

Write these as real tests against the fixture helper — the comments above describe the required behavior, the helper provides the boilerplate.

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/components/GameBoard.farmEvents.test.tsx
```
Expected: FAIL — `GameBoardProps` has no `pendingFarmEvent`.

- [ ] **Step 3: Implement**

In `src/components/GameBoard.tsx`:

1. Imports:

```ts
import { FarmEventModal } from './FarmEventModal';
import { loadRecords } from '../engine/records';
import type { PendingFarmEventView } from '../engine/useGameEngine';
import type { FarmEventChoiceId } from '../engine/types';
```

2. Add to `GameBoardProps`:

```ts
  /** 022 — the pending farm event to present, or null. Next Day is blocked while set. */
  pendingFarmEvent: PendingFarmEventView | null;
  /** 022 — apply a farm-event choice; returns false when it could not be applied. */
  onResolveFarmEvent: (choice: FarmEventChoiceId) => boolean;
```
and destructure both in the component signature.

3. Inside the component, after `const isUnwinnable = ...`:

```ts
  // 022 — "New!" ribbon shows throughout the player's second run (the feature just unlocked).
  const [isSecondRun] = useState(() => loadRecords().totalRunsCompleted === 1);
  // The event modal waits for the fresh Day Summary and any coin-flight celebration to finish.
  const showFarmEvent = pendingFarmEvent !== null && !isSummaryOpen && celebration.kind === 'idle';
```

4. In `handleNextDay`, add a guard as the first line:

```ts
    if (pendingFarmEvent !== null) return; // 022 — a farm event demands an answer first
```

5. Render the modal after the `<CelebrationOverlay ... />` block:

```tsx
      {/* 022 — Farm Event choice modal: blocks the day until answered */}
      {showFarmEvent && (
        <FarmEventModal view={pendingFarmEvent} isNew={isSecondRun} onChoose={onResolveFarmEvent} />
      )}
```

In `src/App.tsx`, pass the new props to `<GameBoard>`:

```tsx
        pendingFarmEvent={engine.getPendingFarmEvent()}
        onResolveFarmEvent={engine.resolveFarmEvent}
```

- [ ] **Step 4: Run to verify pass, then full gate + commit**

```bash
npx vitest run tests/components/GameBoard.farmEvents.test.tsx && npm test && npm run lint
git add -A && git commit -m "feat(ui): 022 event modal orchestration + next-day guard"
```

---

### Task 11: HUD contract chip

**Files:**
- Modify: `src/components/HUD.tsx`
- Modify: `src/components/GameBoard.tsx` (compute + pass the chip data)
- Test: `tests/components/HUD.test.tsx` (append)

- [ ] **Step 1: Write the failing tests** (append to the existing HUD test file, reusing its base-props helper; add `contract: null` to the base props)

```tsx
describe('contract chip (022)', () => {
  it('renders progress and days left while a contract is live', () => {
    renderHUD({ contract: { done: 2, total: 3, cropId: 'parsnip', daysLeft: 4 } });
    expect(screen.getByLabelText(/contract: 2 of 3 parsnip/i)).toBeInTheDocument();
    expect(screen.getByText('2/3 · 4d')).toBeInTheDocument();
  });

  it('is hidden without a contract', () => {
    renderHUD({ contract: null });
    expect(screen.queryByLabelText(/contract:/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/components/HUD.test.tsx
```
Expected: FAIL — unknown prop / missing element.

- [ ] **Step 3: Implement**

In `src/components/HUD.tsx` add to `HUDProps`:

```ts
  /** 022 — live delivery-contract progress, or null (chip hidden). */
  contract: { done: number; total: number; cropId: string; daysLeft: number } | null;
```

Destructure `contract`, and render the chip directly after the harvest-streak chip block (after line 181's closing `)}`):

```tsx
        {contract && (
          <div
            aria-label={`Contract: ${contract.done} of ${contract.total} ${contract.cropId} delivered, ${contract.daysLeft} days left`}
            title={`Deliver ${contract.total} ${contract.cropId} harvests before the deadline for the reward.`}
            className="flex items-center gap-1 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60 cursor-help"
          >
            <EmojiIcon className="text-base leading-none">📜</EmojiIcon>
            <span className="font-pixel text-caption text-farm-gold">
              {contract.done}/{contract.total} · {contract.daysLeft}d
            </span>
          </div>
        )}
```

In `src/components/GameBoard.tsx`, compute the chip data (near `nextPlotPrice`) and pass it to `<HUD>`:

```ts
  const liveContract = state.farmEvents.contract;
  const contractChip = liveContract === null ? null : {
    done: liveContract.quantity - liveContract.remaining,
    total: liveContract.quantity,
    cropId: liveContract.cropId,
    // Days left INCLUDING today — the contract can still complete on its deadline day.
    daysLeft: Math.max(0, liveContract.deadlineDay - state.currentDay + 1),
  };
```
```tsx
      <HUD
        // ...existing props...
        contract={contractChip}
      />
```
Existing HUD test fixtures need `contract: null` added to compile.

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/components/HUD.test.tsx tests/components/GameBoard.test.tsx && npm test && npm run lint
git add -A && git commit -m "feat(ui): 022 HUD contract chip"
```

---

### Task 12: Day Summary lines

**Files:**
- Modify: `src/components/DailyLog.tsx`
- Test: `tests/components/DailyLog.test.tsx` (append)

- [ ] **Step 1: Write the failing tests** (append; reuse the file's existing base-log fixture helper)

```tsx
describe('farm event lines (022)', () => {
  it('renders a buff line per applied buff', () => {
    renderLog({ eventBuffsApplied: [{ eventId: 'bountiful_spring', multiplier: 1.5, harvestsAffected: 2 }] });
    expect(screen.getByLabelText('Event bonus')).toHaveTextContent('×1.5 on 2 harvests');
  });

  it('renders contract completion with the reward', () => {
    renderLog({ contractCompleted: { eventId: 'millers_order', reward: 55 } });
    expect(screen.getByLabelText('Contract completed')).toHaveTextContent('+55');
  });

  it('renders neutral expiry copy', () => {
    renderLog({ contractExpired: 'fair_committee' });
    expect(screen.getByLabelText('Contract expired')).toHaveTextContent(/no harm done/i);
  });

  it('renders live progress', () => {
    renderLog({ contractProgress: { cropId: 'parsnip', done: 1, total: 3, deadlineDay: 14 } });
    expect(screen.getByLabelText('Contract progress')).toHaveTextContent('1/3 parsnip');
  });

  it('renders none of the lines on a log without event fields (old saves)', () => {
    renderLog({});
    expect(screen.queryByLabelText(/event bonus|contract/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/components/DailyLog.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement**

In `src/components/DailyLog.tsx` add after the `MarketLines` component:

```tsx
/** 022 — buff / contract lines. All fields are optional (absent on pre-v10 logs). */
function FarmEventLines({ log }: { log: DailyLogEntry }) {
  return (
    <>
      {(log.eventBuffsApplied ?? []).map(b => (
        <div
          key={b.eventId}
          aria-label="Event bonus"
          className="flex items-center gap-1 px-2 py-1 rounded bg-farm-grass/20 border border-farm-grass/40 text-farm-parchment"
        >
          <EmojiIcon>✨</EmojiIcon>
          <span>Event bonus: ×{b.multiplier} on {b.harvestsAffected} harvest{b.harvestsAffected === 1 ? '' : 's'}</span>
        </div>
      ))}
      {log.contractCompleted && (
        <div
          aria-label="Contract completed"
          className="flex justify-between px-2 py-1 rounded bg-farm-gold/10 border border-farm-gold/50 text-farm-gold"
        >
          <span><EmojiIcon>📜</EmojiIcon> Contract delivered!</span>
          <span className="text-farm-grass">+{log.contractCompleted.reward}<Coin /></span>
        </div>
      )}
      {log.contractExpired && (
        <div
          aria-label="Contract expired"
          className="flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/10 text-farm-stone"
        >
          <EmojiIcon>📜</EmojiIcon>
          <span>The buyer found another supplier — no harm done.</span>
        </div>
      )}
      {log.contractProgress && (
        <div
          aria-label="Contract progress"
          className="flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/10 text-farm-stone"
        >
          <EmojiIcon>📜</EmojiIcon>
          <span>Contract: {log.contractProgress.done}/{log.contractProgress.total} {log.contractProgress.cropId} delivered</span>
        </div>
      )}
    </>
  );
}
```

Render it right after `<MarketLines log={log} />` in the `DailyLog` body:

```tsx
      <FarmEventLines log={log} />
```

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/components/DailyLog.test.tsx
git add -A && git commit -m "feat(ui): 022 day-summary event and contract lines"
```

---

### Task 13: Run-end unlock tease

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Modify: `src/components/SeasonTransitionModal.tsx`
- Modify: `src/App.tsx`
- Tests: `tests/components/BankruptcyScreen.test.tsx`, `tests/components/SeasonTransitionModal.test.tsx` (append)

- [ ] **Step 1: Write the failing tests** (append to each file, reusing their base-props helpers; add `showEventsUnlockTease: false` to base props)

```tsx
// BankruptcyScreen.test.tsx
it('teases the farm-events unlock after an eventless run (022)', () => {
  renderScreen({ showEventsUnlockTease: true });
  expect(screen.getByText(/word of your farm is spreading/i)).toBeInTheDocument();
});
it('does not tease when events were already enabled', () => {
  renderScreen({ showEventsUnlockTease: false });
  expect(screen.queryByText(/word of your farm is spreading/i)).toBeNull();
});

// SeasonTransitionModal.test.tsx — same pair, for variant="failed" and variant="victory";
// and assert the tease NEVER renders for variant="passed" even when the flag is true.
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/components/BankruptcyScreen.test.tsx tests/components/SeasonTransitionModal.test.tsx
```
Expected: FAIL — unknown prop.

- [ ] **Step 3: Implement**

Shared copy — add to both components, rendered adjacent to their restart/play-again controls:

```tsx
      {showEventsUnlockTease && (
        <p className="font-pixel text-caption text-farm-gold leading-relaxed">
          <EmojiIcon>🧳</EmojiIcon> Word of your farm is spreading — from your next run, visitors will arrive with offers.
        </p>
      )}
```

- `BankruptcyScreen.tsx`: add `showEventsUnlockTease?: boolean;` to its props interface, destructure with default `false`, render the block directly above the restart button group.
- `SeasonTransitionModal.tsx`: same prop; render only when `variant === 'failed' || variant === 'victory'` (a passed season continues the same run — nothing unlocks): wrap the block in `{(variant === 'failed' || variant === 'victory') && showEventsUnlockTease && (...)}`.
- `App.tsx`: pass `showEventsUnlockTease={!state.farmEvents.enabled}` to both `<BankruptcyScreen>` and `<SeasonTransitionModal>`.

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/components/BankruptcyScreen.test.tsx tests/components/SeasonTransitionModal.test.tsx && npm test && npm run lint
git add -A && git commit -m "feat(ui): 022 run-end farm-events unlock tease"
```

---

### Task 14: Analytics events + detector

**Files:**
- Modify: `src/analytics/events.ts`
- Modify: `src/analytics/useAnalyticsEvents.ts`
- Test: `tests/analytics/farmEvents.test.tsx` (create; follow the mocking pattern used by the existing tests in `tests/analytics/`)

- [ ] **Step 1: Write the failing tests**

Create `tests/analytics/farmEvents.test.tsx`. Follow the existing `useAnalyticsEvents` test setup in `tests/analytics/` (mock `../../src/analytics/track`, render the hook with successive states). Required assertions:

```tsx
// farm_event_fired — fires once when pending transitions null → set, with
//   { event_id: 'millers_order', season: 1, day: 8 }
// farm_event_choice — fires when lastResolved changes, with
//   { event_id: 'millers_order', choice: 'B', auto: false, day: 8 }
// contract_completed — fires when a new lastDailyLog carries contractCompleted
// contract_expired — fires when a new lastDailyLog carries contractExpired
// none of the above fire on unrelated state changes (advance a quiet day: no calls)
```

Write these as real tests with the mock-`track` pattern from the neighboring files.

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/analytics/farmEvents.test.tsx
```
Expected: FAIL — events unknown.

- [ ] **Step 3: Implement**

1. `src/analytics/events.ts` — add to `EventPropsMap` (import `FarmEventId`, `FarmEventChoiceId` from `../engine/types`):

```ts
  farm_event_fired: { event_id: FarmEventId; season: number; day: number };
  farm_event_choice: { event_id: FarmEventId; choice: FarmEventChoiceId; auto: boolean; day: number };
  contract_completed: { event_id: FarmEventId; reward: number };
  contract_expired: { event_id: FarmEventId };
```
and to `EVENT_VERSIONS`:

```ts
  farm_event_fired: 1,
  farm_event_choice: 1,
  contract_completed: 1,
  contract_expired: 1,
```

2. `src/analytics/useAnalyticsEvents.ts` — add a detector and register it in the effect:

```ts
/** 022 — farm-event lifecycle, all derived from state diffs (engine stays pure). */
function detectFarmEvents(prev: GameState, state: GameState): void {
  const curr = state.farmEvents;
  const before = prev.farmEvents;

  if (curr.pending !== null && curr.pending !== before.pending) {
    track('farm_event_fired', {
      event_id: curr.pending.eventId,
      season: getSeasonForDay(curr.pending.firedDay).number,
      day: curr.pending.firedDay,
    });
  }
  if (curr.lastResolved !== null && curr.lastResolved !== before.lastResolved) {
    track('farm_event_choice', {
      event_id: curr.lastResolved.eventId,
      choice: curr.lastResolved.choice,
      auto: curr.lastResolved.auto,
      day: curr.lastResolved.day,
    });
  }
  const log = state.lastDailyLog;
  if (log && log !== prev.lastDailyLog) {
    if (log.contractCompleted) {
      track('contract_completed', { event_id: log.contractCompleted.eventId, reward: log.contractCompleted.reward });
    }
    if (log.contractExpired) {
      track('contract_expired', { event_id: log.contractExpired });
    }
  }
}
```
and inside the `useEffect` list of detectors add `detectFarmEvents(prev, state);`.

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/analytics/farmEvents.test.tsx && npm test && npm run lint
git add -A && git commit -m "feat(analytics): 022 farm-event + contract events"
```

---

### Task 15: Simulator — event policies, runner hook, CLI flag, preset

**Files:**
- Modify: `scripts/sim/strategies.ts`
- Modify: `scripts/sim/runner.ts`
- Modify: `scripts/sim/run.ts`
- Modify: `scripts/sim/economyPresets.ts`
- Test: `tests/sim/eventPolicies.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/eventPolicies.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EVENT_POLICIES } from '../../scripts/sim/strategies';
import { initialGameState } from '../../src/engine/gameEngine';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventId, GameState } from '../../src/engine/types';

function pendingState(eventId: FarmEventId, mutate: (s: GameState) => GameState = s => s): GameState {
  const s = initialGameState();
  return mutate({ ...s, currentDay: 8, farmEvents: { ...s.farmEvents, pending: { eventId, firedDay: 8 } } });
}

describe('event policies', () => {
  it('acceptAll / declineAll are constant', () => {
    expect(EVENT_POLICIES.acceptAll(pendingState('millers_order'), DEFAULT_ECONOMY)).toBe('A');
    expect(EVENT_POLICIES.declineAll(pendingState('millers_order'), DEFAULT_ECONOMY)).toBe('B');
  });

  it('heuristic accepts the merchant only when ≥ half the occupied plots ripen within 2 days', () => {
    const ripe = pendingState('traveling_merchant', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < 2 ? { ...p, cropId: 'radish' as const, daysRemaining: 1, dayPlanted: 7 } : p)),
    }));
    expect(EVENT_POLICIES.heuristic(ripe, DEFAULT_ECONOMY)).toBe('A');
    const green = pendingState('traveling_merchant', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < 2 ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 3, dayPlanted: 8 } : p)),
    }));
    expect(EVENT_POLICIES.heuristic(green, DEFAULT_ECONOMY)).toBe('B');
    expect(EVENT_POLICIES.heuristic(pendingState('traveling_merchant'), DEFAULT_ECONOMY)).toBe('B'); // empty board
  });

  it('heuristic accepts a contract only when free plots and growth time allow delivery', () => {
    // Fresh board: 4 unlocked empty plots, parsnip growth 2 ≤ deadline 6 → accept
    expect(EVENT_POLICIES.heuristic(pendingState('millers_order'), DEFAULT_ECONOMY)).toBe('A');
    // Board fully occupied → decline
    const busy = pendingState('millers_order', s => ({
      ...s,
      plots: s.plots.map((p, i) => (i < s.unlockedPlots ? { ...p, cropId: 'pumpkin' as const, daysRemaining: 3, dayPlanted: 8 } : p)),
    }));
    expect(EVENT_POLICIES.heuristic(busy, DEFAULT_ECONOMY)).toBe('B');
  });

  it('heuristic takes the beekeeper only with a 3-lease cushion', () => {
    expect(EVENT_POLICIES.heuristic(pendingState('wandering_beekeeper'), DEFAULT_ECONOMY)).toBe('A'); // 130 > 45
    const poor = pendingState('wandering_beekeeper', s => ({ ...s, coinBalance: 40 }));
    expect(EVENT_POLICIES.heuristic(poor, DEFAULT_ECONOMY)).toBe('B');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/sim/eventPolicies.test.ts
```
Expected: FAIL — `EVENT_POLICIES` not exported.

- [ ] **Step 3: Implement**

1. `scripts/sim/strategies.ts` — add imports (`getSeasonForDay` is already imported; extend the types import with `FarmEventChoiceId`) and append:

```ts
export type EventPolicy = (state: GameState, config: EconomyConfig) => FarmEventChoiceId;

/** The per-event "defensible reasoning" each event is designed around (spec §Simulator). */
function heuristicChoice(state: GameState, config: EconomyConfig): FarmEventChoiceId {
  const pending = state.farmEvents.pending;
  if (pending === null) return 'B';
  const lease = getSeasonForDay(state.currentDay, config).leasePerDay;
  const active = state.plots.slice(0, state.unlockedPlots);
  switch (pending.eventId) {
    case 'traveling_merchant': {
      const occupied = active.filter(p => p.cropId !== null);
      const ripeSoon = occupied.filter(p => p.daysRemaining !== null && p.daysRemaining <= 2);
      return occupied.length > 0 && ripeSoon.length * 2 >= occupied.length ? 'A' : 'B';
    }
    case 'bountiful_spring': {
      const nearExhausted = active.filter(p => p.consecutiveHarvests >= config.exhaustionThreshold - 1);
      return nearExhausted.length <= 1 ? 'A' : 'B';
    }
    case 'drought_warning': {
      const seedCost = computeSeedCost('radish', state.buildings, config, state.farmEvents.activeEffects);
      return state.coinBalance >= seedCost * 4 + lease * 2 ? 'A' : 'B';
    }
    case 'millers_order':
    case 'fair_committee': {
      const def = config.farmEvents.events.find(e => e.id === pending.eventId);
      const spec = def?.choiceA.effects.find(e => e.kind === 'contract');
      if (spec === undefined || spec.kind !== 'contract') return 'B';
      const free = active.filter(p => p.cropId === null && p.exhaustedSinceDay === null && !p.pestDamaged);
      return spec.quantity <= free.length && config.crops[spec.cropId].growthDays + 1 <= spec.deadlineDays
        ? 'A' : 'B';
    }
    case 'wandering_beekeeper':
      return state.coinBalance > lease * 3 ? 'A' : 'B';
    default:
      return 'B';
  }
}

export const EVENT_POLICIES: Record<string, EventPolicy> = {
  heuristic: heuristicChoice,
  acceptAll: () => 'A',
  declineAll: () => 'B',
};
```

2. `scripts/sim/runner.ts` — import `resolveFarmEventChoice` from the engine and `EVENT_POLICIES, type EventPolicy` from `./strategies`. Extend `tickDay` and thread the policy (defaulting keeps existing call sites/tests working):

```ts
function tickDay(
  state: ReturnType<typeof initialGameState>,
  strategy: Strategy,
  config: EconomyConfig,
  rng: Rng,
  eventPolicy: EventPolicy,
): ReturnType<typeof initialGameState> {
  const cleared = clearPests(state, config);
  // 022: answer a pending farm event via the run's policy before the bot acts.
  const answered = cleared.farmEvents.pending !== null
    ? resolveFarmEventChoice(cleared, eventPolicy(cleared, config), config)
    : cleared;
  const decided = strategy(answered, config);
  return processTurn(decided, undefined, undefined, undefined, config, rng).state;
}

export function playRun(
  config: EconomyConfig, strategy: Strategy, seed: number,
  eventPolicy: EventPolicy = EVENT_POLICIES.heuristic,
): Outcome {
  // ...unchanged except: state = tickDay(state, strategy, config, rng, eventPolicy);
}

export function monteCarlo(
  config: EconomyConfig, strategy: Strategy, trials: number, masterSeed: number,
  eventPolicy: EventPolicy = EVENT_POLICIES.heuristic,
): Outcome[] {
  const out: Outcome[] = [];
  for (let i = 0; i < trials; i++) out.push(playRun(config, strategy, masterSeed + i, eventPolicy));
  return out;
}
```

3. `scripts/sim/run.ts` — add the flag and thread it:

```ts
import { STRATEGIES, EVENT_POLICIES } from './strategies';
// ...
const policyName = arg('--eventPolicy', 'heuristic');
const eventPolicy = EVENT_POLICIES[policyName];
if (!eventPolicy) fail(`Unknown event policy: ${policyName} (expected ${Object.keys(EVENT_POLICIES).join('|')})`);
// ...
    const outcomes = monteCarlo(config, strat, trials, seed, eventPolicy);
```
Also include the policy in the header line: `` console.log(`\nMonte Carlo — ${trials} trials/seed=${seed}/eventPolicy=${policyName}\n`); ``

4. `scripts/sim/economyPresets.ts` — add the candidate preset and register it:

```ts
/** 022 candidate — the live economy with the farm-event catalog enabled. */
export const events022: EconomyConfig = {
  ...buildings019,
  farmEvents: DEFAULT_ECONOMY.farmEvents,
};

export const PRESETS: Record<string, EconomyConfig> = { baseline, proposed, buildings019, events022 };
```

5. Update `SIMULATION.md`: document `--eventPolicy heuristic|acceptAll|declineAll` and the `events022` preset (two short paragraphs in the flags/presets sections).

- [ ] **Step 4: Run to verify pass, then commit**

```bash
npx vitest run tests/sim/eventPolicies.test.ts tests/sim/runner.test.ts && npm test && npm run lint
git add -A && git commit -m "feat(sim): 022 event policies, --eventPolicy flag, events022 preset"
```

---

### Task 16: Balance gating (sim runs + tuning doc)

**Files:**
- Create: `specs/022-narrative-events/tuning-results.md`
- Possibly modify: `src/engine/farmEventCatalog.ts` (numbers only)

- [ ] **Step 1: Run the three gating passes**

```bash
npm run sim -- --configs events022 --strategies smartMixed --trials 500 --eventPolicy heuristic
npm run sim -- --configs events022 --strategies smartMixed --trials 500 --eventPolicy acceptAll
npm run sim -- --configs events022 --strategies smartMixed --trials 500 --eventPolicy declineAll
```
Also run the regression reference:
```bash
npm run sim -- --configs buildings019 --strategies smartMixed --trials 500
```

- [ ] **Step 2: Evaluate against the band**

All three `events022` variants must land **15–35% win** and **≈1.0–1.3× overshoot**. `declineAll` should sit closest to the `buildings019` reference — if `declineAll` itself is out of band, something besides this feature moved; investigate before tuning.

- [ ] **Step 3: Tune if needed**

Lever order (spec §Balance gating): contract rewards (55/40) and the merchant `priceFactor` (1.4) first, then buff multipliers (1.5/1.2), then `FARM_EVENT_SECOND_CHANCE`. Edit only `src/engine/farmEventCatalog.ts` / `src/engine/constants.ts` numbers, re-run all three passes after each change.

- [ ] **Step 4: Record the results**

Write `specs/022-narrative-events/tuning-results.md` following the format of `specs/012-market-events/tuning-results.md`: the commands run, the table of win/bankrupt/miss/overshoot per policy, the promoted numbers, and one paragraph of interpretation. Single-crop bots may also be reported (they use the default heuristic policy via the CLI; their failure is expected and fine).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore(balance): 022 sim-gated event numbers + tuning results"
```

---

### Task 17: Final verification, docs, dashboard

**Files:**
- Modify: `BACKLOG.md` (a.k.a. `backlog.md` in git — note the lowercase tracked name)
- Modify: `CLAUDE.md` (Recent Changes line, if the repo convention is being followed manually)

- [ ] **Step 1: Full gate + manual smoke test**

```bash
npm test && npm run lint
```
Then a browser pass (dev server): complete a first run (no events must appear; tease shows on the end screen), start run 2, force an event day if needed by playing to season day 5–16, answer both a contract accept and the merchant, reload mid-pending (modal must re-present), check the HUD chip and Day Summary lines.

- [ ] **Step 2: Update the backlog**

In `backlog.md`, mark G11 row ✅ DONE with a one-line summary and the spec link, following the format of shipped rows (see G8's row as the template).

- [ ] **Step 3: PostHog dashboard (main session only — requires the PostHog MCP)**

This step cannot run inside a coding subagent; do it from the main session, following the 020 precedent (EU project 216788). Create dashboard **"Pixel Parsnips — Narrative Events"** with six tiles:

1. `farm_event_fired` count broken down by `event_id` (bar) — all six seen?
2. `farm_event_choice` split A vs B per `event_id` (stacked bar) — a lopsided split flags a dominant choice
3. `farm_event_choice` filtered `auto = true` over time — should be ~0; nonzero flags a UI gap
4. Funnel: `farm_event_fired` (contract events) → `farm_event_choice` A → `contract_completed`, with `contract_expired` as a companion trend
5. `farm_event_fired` by `season` and by `day` (table) — window behaving as designed?
6. `farm_event_choice` → `run_ended` outcome breakdown — do choices correlate with outcomes?

Note in the dashboard description that tiles validate once a first seed pass lands events (same caveat as 020).

- [ ] **Step 4: Commit and hand off**

```bash
git add -A && git commit -m "docs: 022 shipped — backlog + tuning docs"
```
Then use the superpowers:finishing-a-development-branch skill to integrate the `022-narrative-events` branch (merge/PR per user preference).

---

## Plan self-review notes

- **Spec coverage:** gating (T7/T8/T13), scheduling (T2), firing + pins + pool (T3), effects + contracts (T4/T5/T6), auto-decline (T6), seed discount incl. Toolshed stacking (T5), UI modal/chip/lines/tease (T9–T13), analytics + play_started v2 (T8/T14), sim policies + bounds + preset (T15), balance gate + tuning doc (T16), migration + hardening + reload-re-present (T7), dashboard (T17). Endless scheduling covered by T2's season-5 test.
- **Known deviation from a literal spec reading:** a yield buff applies to *all* harvests in its final turn even if `harvestsRemaining` is smaller (then expires); the log's `harvestsAffected` reports the honest min. Simpler than per-harvest ordering inside one turn; sim prices it in T16.
- **RNG draw order is load-bearing:** `ensureSchedule` (≤3 draws, season-start turns) → pest rolls → weather roll → market rolls → `maybeFireEvent` (≤3 draws). Existing rng-sequence tests may need padding (T6 Step 5 explains).
