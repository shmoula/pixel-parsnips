# Feature Specification: Season System

**Feature Branch**: `006-season-system`
**Created**: 2026-06-02
**Status**: Draft
**Input**: Backlog item G1 (consolidated from p1·I1, p2·A, p3·1, p4·A, p5·3.1/3.6). First pass scope: seasons + escalating costs (G2 bundled). Enriched run summary (G3) deferred to a follow-up feature.

## Summary

Divide each run into named Seasons of 20 days. Each season has a coin target the player must hold at end of Day 20, plus a per-season lease rate and disaster probability that escalate from one season to the next. Missing the target ends the run. Surviving Season 4 wins the run and offers an optional Endless mode. The change converts an open-ended survival loop into a structured arc with felt beginnings, climaxes, and resolutions.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A run has a felt shape with a visible target (Priority: P1)

A player starting a new run sees from Day 1 what they are working toward: a named season, a day-into-season counter, and a coin target to reach by Day 20.

**Why this priority**: Solves the core "no WHY" problem identified across all five gameplay analysis docs. Without it, none of the other season-related work matters.

**Independent Test**: Start a fresh game. The HUD displays the current season name, the day within the season, and the season target.

**Acceptance Scenarios**:

1. **Given** a fresh run on Day 1, **When** viewing the HUD, **Then** the season indicator shows "Season 1 · Spring Thaw" and "Day 1 / 20".
2. **Given** a run on Day 7, **When** viewing the HUD, **Then** the coin display shows current balance alongside the season target (e.g. "Coins: 87 / 150 target").
3. **Given** a run where `coinBalance ≥ target` before Day 20, **When** viewing the HUD, **Then** the target line does not visually celebrate (no mid-season check mark) — confirmation only happens at end of Day 20.

---

### User Story 2 — Surviving a season produces a clear transition moment (Priority: P1)

A player who ends Day 20 with the target balance sees a dedicated Season Transition modal previewing the next season's rules, then continues into the new season.

**Why this priority**: The transition moment is the felt reward — without it, advancing to Season 2 is invisible and undercuts the entire arc.

**Independent Test**: Force end-of-Day-20 with `coinBalance ≥ target`. After the existing Day Summary modal is dismissed, the Season Transition modal appears showing the next season's lease, disaster level, and target.

**Acceptance Scenarios**:

1. **Given** Day 20 of Season 1 with `closingBalance ≥ 150`, **When** the turn resolves, **Then** the state transitions to `phase: 'season_passed'` and the Season Transition modal renders the "Season 1 complete" variant.
2. **Given** the Season Transition modal is showing the passed-variant, **When** the player taps "Begin Season 2", **Then** `phase` returns to `'playing'`, `currentDay` becomes 21, and the HUD reflects Season 2's name, lease, and target.
3. **Given** a passing season transition, **When** the new season begins, **Then** the lease deducted on Day 21 is 20 coins (Season 2's lease), not 15.

---

### User Story 3 — Missing the season target ends the run (Priority: P1)

A player who ends Day 20 with less than the target balance sees a Season Failed screen with their gap and final stats. The run is over.

**Why this priority**: The hard-end failure mode is what makes the survival victory mean something. Without this, season targets are advisory and the arc collapses.

**Independent Test**: Force end-of-Day-20 with `coinBalance < target`. The state enters `phase: 'season_failed'`; the Season Transition modal renders the failure variant; the only action is "Start New Run".

**Acceptance Scenarios**:

1. **Given** Day 20 with `closingBalance < target`, **When** the turn resolves, **Then** `phase` is set to `'season_failed'` and `currentDay` does not advance past 20.
2. **Given** Day 20 with `closingBalance` between 50% and 100% of target (e.g. 138 / 150), **When** the failure modal renders, **Then** it shows the message "You were 12 coins short."
3. **Given** Day 20 with `closingBalance < 50%` of target (e.g. 30 / 150), **When** the failure modal renders, **Then** the "X coins short" message is suppressed (showing the gap would feel mocking).
4. **Given** a mid-season day (e.g. Day 12) where `coinBalance < lease`, **When** the bankruptcy check triggers, **Then** `phase` becomes `'bankrupt'`, never `'season_failed'`.

---

### User Story 4 — Escalating lease and disaster rates create growing tension (Priority: P1)

As the player advances through seasons, the daily lease and the probability of disaster weather both increase, restoring late-game tension.

**Why this priority**: Flat costs in the current game mean late game is easier than early game — the inversion identified in p1's economy audit. Without escalation, even with seasons the game flattens.

**Independent Test**: Start a deterministic run; observe that lease deducted on Day 25 is 20 (Season 2), Day 45 is 25 (Season 3), Day 65 is 30 (Season 4). Observe that a fixed weather roll of 0.18 yields a non-disaster in Season 1 but a Flash Drought in Season 2.

**Acceptance Scenarios**:

1. **Given** Days 1–20 (Season 1), **When** lease is deducted, **Then** the amount is 15 per day.
2. **Given** Days 21–40 (Season 2), **When** lease is deducted, **Then** the amount is 20 per day.
3. **Given** Season 2's disaster bands, **When** a weather roll of 0.18 is processed, **Then** the resulting weather is Flash Drought (Season 1's bands would return a non-disaster at the same roll).
4. **Given** a season transition from N to N+1, **When** the first day of the new season resolves, **Then** the new lease applies immediately (no mid-day mixing).

---

### User Story 5 — Surviving Season 4 wins the run and offers an optional Endless mode (Priority: P2)

A player who meets Season 4's target on Day 80 sees a Victory screen with a clear "I beat the game" message. They can end the run there or opt into Endless mode for indefinite escalation.

**Why this priority**: The finite arc gives the game an emotional finish line — a felt completion the current game has never had. Endless mode services hardcore players without forcing closure on others.

**Independent Test**: Reach Day 80 with `coinBalance ≥ 600` via deterministic test setup. State enters `phase: 'season_4_won'`; the modal shows the Victory variant; "Continue" flips `endlessMode = true` and advances to Day 81 in `phase: 'playing'`.

**Acceptance Scenarios**:

1. **Given** Day 80 with `closingBalance ≥ 600`, **When** the turn resolves, **Then** `phase` is set to `'season_4_won'`.
2. **Given** the Victory modal is showing, **When** the player taps "End Run Here", **Then** the run ends (no further days, run-end summary shown).
3. **Given** the Victory modal is showing, **When** the player taps "Continue", **Then** `endlessMode` is set to `true`, `currentDay` becomes 81, and `phase` returns to `'playing'`.
4. **Given** `endlessMode === true` and Day 100 with `closingBalance ≥ 800` (the Endless Season 5 target), **When** the turn resolves, **Then** `phase` stays `'playing'` and `currentDay` becomes 101 — the Victory modal does not re-fire.

---

### User Story 6 — The HUD telegraphs upcoming changes (Priority: P2)

A player approaching the end of a season sees an explicit warning of how many days remain and what changes next.

**Why this priority**: Surprises feel cheap; earned difficulty feels satisfying. This story makes the escalation legible.

**Independent Test**: At Day 18 of any season, the HUD shows a "Season ends in 3 days" reminder. At Day 20, the lease line shows a one-line preview of the next season's lease.

**Acceptance Scenarios**:

1. **Given** Day 18 with `coinBalance < target`, **When** viewing the HUD, **Then** the target line shows "Coins: X / Y target — 3 days left" in warning styling.
2. **Given** Day 18 with `coinBalance ≥ target`, **When** viewing the HUD, **Then** the warning styling is suppressed (target is already met; no urgency).
3. **Given** Day 20 of a season that will be followed by another season (Seasons 1–3, or Season 4 with `endlessMode === true`), **When** viewing the HUD, **Then** the lease line reads "Lease: 15/day (rises to 20 next season)".
4. **Given** Day 80 of Season 4 with `endlessMode === false`, **When** viewing the HUD, **Then** the lease preview is suppressed — the Victory modal is the upcoming moment, not a lease change.

---

### User Story 7 — Existing in-progress saves migrate cleanly (Priority: P1)

A player with a saved game from before this feature loads it and continues without state loss or visible disruption.

**Why this priority**: The game uses localStorage as its only persistence layer; breaking active saves would be a real player-trust issue.

**Independent Test**: Seed localStorage with a valid schema-3 save (`pixel-parsnips-state` key, `schemaVersion: 3`, currentDay 15, balance 180, phase `'playing'`). Load the app. The save resumes at Day 15 with balance 180.

**Acceptance Scenarios**:

1. **Given** a schema-3 save with `currentDay: 15` and `phase: 'playing'`, **When** the app loads, **Then** the save is migrated to schema 4 with `endlessMode: false` and resumes at Day 15.
2. **Given** a schema-3 save with `currentDay: 15` and `phase: 'bankrupt'`, **When** the app loads, **Then** `phase` remains `'bankrupt'` after migration.
3. **Given** a schema-2 or earlier save, **When** the app loads, **Then** the save is discarded and a fresh `initialGameState` is used.
4. **Given** a migrated save resuming on Day 15, **When** the next turn resolves and lease is deducted, **Then** the amount is 15 (Season 1) — no observable change from the player's perspective until Day 21.

---

## Design

### Season table

| Season | Name | Days | Lease/day | Disaster % | End-of-season target |
|---|---|---|---|---|---|
| 1 | Spring Thaw | 1–20 | 15 | 15% (baseline) | ≥ 150 coins |
| 2 | Summer Heat | 21–40 | 20 | 20% | ≥ 250 coins |
| 3 | Autumn Pressure | 41–60 | 25 | 28% | ≥ 400 coins |
| 4 | Winter Crunch | 61–80 | 30 | 35% | ≥ 600 coins |
| Endless N (N ≥ 5) | Deep Winter | days 81 + 20·(N−5) … +19 | 30 + 2·(N−4) | min(0.35 + 0.02·(N−4), 0.50) | previous target + 200 |

**Disaster band scaling**: the existing baseline bands (Blight 0–0.05, Pest Infestation 0.05–0.10, Flash Drought 0.10–0.15 — total 15%) are scaled proportionally so all three disasters preserve their 1:1:1 ratio. For Season 2 (20% total), each band stretches by 20/15. Season 3 (28%) stretches by 28/15. The non-disaster weather bands shift accordingly so the total probability stays at 1.0.

**Telegraphing**: HUD warning starts at Day 18 of each season (3 days notice). Day 20's HUD shows the next season's lease preview inline. The Day Summary modal on Day 20 carries the existing Day Summary content; the Season Transition modal appears on top after the player taps "Continue" on Day Summary.

### Architecture

**New file `src/engine/seasons.ts`** exposes:

```ts
export const SEASON_LENGTH = 20;
export const SEASON_TABLE: SeasonConfig[]; // Seasons 1–4 hard-coded
export interface SeasonConfig {
  number: number;
  name: string;
  startDay: number;
  endDay: number;
  leasePerDay: number;
  disasterTotalPct: number;
  target: number;
}

/** Pure. For day > 80, computes Season N (≥5) from the endless formula. */
export function getSeasonForDay(day: number): SeasonConfig;

/** Pure. Returns the disaster probability bands for a season,
 *  scaled proportionally from the existing baseline bands. */
export function getDisasterBandsForSeason(season: SeasonConfig):
  Array<{ threshold: number; id: WeatherId }>;
```

**Modified `src/engine/gameEngine.ts`**:

- `advanceTurn` reads `getSeasonForDay(state.currentDay)` once per turn.
- Lease deducted = `season.leasePerDay` (replaces the constant 15).
- Weather roll uses `getDisasterBandsForSeason(season)` instead of importing `WEATHER_PROBABILITY_BANDS` directly.
- After tax deduction on the season-ending day (`currentDay === season.endDay`), check `closingBalance` against `season.target`:
  - If met and `season.number < 4`: set `phase: 'season_passed'`, advance `currentDay`, return.
  - If met and `season.number === 4` and `endlessMode === false`: set `phase: 'season_4_won'`, do not advance.
  - If met and `endlessMode === true`: advance normally, no transition phase.
  - If not met: set `phase: 'season_failed'`, do not advance.
- Mid-season bankruptcy check (existing) runs first and dominates: a player who bankrupts on Day 20 enters `'bankrupt'`, not `'season_failed'`.

**Modified `src/engine/constants.ts`**:

- `SCHEMA_VERSION` bumps from 3 to 4.
- `LAND_LEASE_FEE` (currently 15) is removed; lease now sourced per-season.
- `WEATHER_PROBABILITY_BANDS` remains as the baseline for `getDisasterBandsForSeason`.

### Data model

`GameState` gains one persisted field and an expanded phase union:

```diff
 export interface GameState {
-  schemaVersion: number;       // was 3
+  schemaVersion: number;       // now 4
   currentDay: number;
   coinBalance: number;
   plots: PlotState[];
   seedInventory: SeedInventory;
   upgradeTier: UpgradeTier;
   lastDailyLog: DailyLogEntry | null;
-  phase: 'playing' | 'bankrupt';
+  phase: 'playing' | 'bankrupt'
+       | 'season_passed' | 'season_4_won' | 'season_failed';
   peakBalance: number;
   fertilizerInventory: number;
   flashDroughtDaysRemaining: number;
+  /** True after the player accepts "Continue" on the Season 4 victory screen.
+   *  Disables further target checks; lease/disaster keep escalating per formula. */
+  endlessMode: boolean;
 }
```

All other season facts (number, name, lease, target, days-into-season) are derived from `currentDay` via `getSeasonForDay`.

**Phase semantics**:

- `'playing'` — normal turn execution.
- `'bankrupt'` — terminal; existing behaviour.
- `'season_passed'` — transient; flips back to `'playing'` when the player taps "Begin Season N+1". Days 1–80 only.
- `'season_4_won'` — transient. Two outcomes:
  - Player taps **Continue**: `endlessMode` is set to `true`, `currentDay` advances to 81, `phase` returns to `'playing'`.
  - Player taps **End Run Here**: state is reset to `initialGameState()` — same as the "Start New Run" action elsewhere. The Victory modal itself was the celebration; no separate run-end summary screen.
- `'season_failed'` — terminal for the run; the only action is "Start New Run".

### Migration (schema 3 → 4)

In `useGameEngine.ts` load path:

```ts
function migrate(raw: unknown): GameState {
  const parsed = raw as GameState & { schemaVersion: number };
  if (parsed.schemaVersion === 4) return parsed;
  if (parsed.schemaVersion === 3) {
    return {
      ...parsed,
      schemaVersion: 4,
      endlessMode: false,
    };
  }
  return initialGameState(); // discard schemas < 3, existing policy
}
```

### UI changes

**`HUD.tsx`** (modified):

- Adds a season indicator line ("Season 2 · Summer Heat", "Day 7 / 20").
- Coin display gains a target suffix ("Coins: 187 / 250 target").
- From Day 18 of a non-final season, when `coinBalance < target`, the target line uses warning styling and appends "— X days left".
- On Day 20 of a non-final season, the lease line appends "(rises to N next season)".
- All values derived from `getSeasonForDay(state.currentDay)`; no new state.

**`SeasonTransitionModal.tsx`** (new file):

- Single component, three variants keyed off a `variant` prop: `'passed' | 'failed' | 'victory'`.
- Passed variant: shows season just completed, final balance vs target, next season's lease/disaster/target preview, "Begin Season N+1" button.
- Failed variant: shows season failed, final balance, "X coins short" message (suppressed if gap > 50% of target), days survived, peak balance, "Start New Run" button.
- Victory variant: shows "🌾 VICTORY 🌾", total days, peak balance, "End Run Here" and "Continue →" buttons.
- Renders on top of (after) the existing Day Summary modal — same z-layer pattern as Day Summary itself.
- Focus trap and ESC handling follow the existing Day Summary modal's pattern.

**`BankruptcyScreen.tsx`** (modified):

- Adds one line: `Season reached: 2 (Summer Heat)`, derived from `getSeasonForDay(state.currentDay)`. Inserted between "Days survived" and "Peak balance".
- Same line appears on the Season Failed and Endless-bankruptcy run-end paths (which reuse this component or its variants).

### Testing

**`tests/engine/seasons.test.ts`** (new):

- `getSeasonForDay` correctness at boundary days (1, 20, 21, 40, 41, 60, 61, 80, 81, 100, 200).
- Endless formula correctness for days 81, 101, 121, 200.
- Disaster % caps at 50% for high seasons.
- `getDisasterBandsForSeason` preserves 1:1:1 ratio across seasons.
- Total band width matches `disasterTotalPct`.

**`tests/engine/seasonTransition.test.ts`** (new):

- Day 20 with target met → `phase: 'season_passed'`, `currentDay: 21`.
- Day 20 with target missed → `phase: 'season_failed'`, `currentDay: 20`.
- Day 80 with target met, `endlessMode: false` → `phase: 'season_4_won'`.
- Day 80 with target met, `endlessMode: true` → `phase: 'playing'`, `currentDay: 81`.
- Day 80 with target missed → `phase: 'season_failed'`.
- Non-season-end day never sets a transition phase.
- Mid-season bankruptcy fires `'bankrupt'`, never a season phase.
- Day 20 bankruptcy fires `'bankrupt'`, not `'season_failed'`.

**`tests/engine/gameEngine.test.ts`** (extended):

- Day 25 lease deduction = 20 (Season 2).
- Day 45 lease deduction = 25 (Season 3).
- Day 65 lease deduction = 30 (Season 4).
- Weather roll 0.18 → non-disaster in Season 1, Flash Drought in Season 2.
- 80-day deterministic run lands in `'season_4_won'` with expected balance (balance canary).

**`tests/engine/useGameEngine.test.ts`** (extended):

- Schema 3 save mid-run migrates to schema 4 with `endlessMode: false`, other fields preserved.
- Schema 3 bankrupt save preserves `'bankrupt'` phase through migration.
- Schema 2 or earlier discarded → fresh state.

**Component tests**:

- `HUD.test.tsx`: season indicator, target progress, warning styling at Day 18+, lease preview at Day 20.
- `SeasonTransitionModal.test.tsx` (new): all three variants render; buttons trigger correct callbacks; the "X coins short" line is suppressed when gap > 50%.
- `BankruptcyScreen.test.tsx`: new "Season reached" line, derived correctly.
- Accessibility (`vitest-axe`) pass on the new modal in all three variants.

## Out of scope (deferred to follow-up features)

- **Enriched run summary** (G3) — medals, personal bests across runs, contextual failure tips, achievement recap. The single new "Season reached" line on the run-end screen is the minimum to make seasons visible; everything else lives in G3.
- **Per-season disaster biasing** (e.g. Summer = drought-heavy). All seasons scale the existing 1:1:1 disaster mix proportionally for this pass.
- **Disaster % indicator in the HUD** — too abstract; the player feels disasters through Day Summary events, not a number.
- **Career stats / cross-run persistence** (e.g. "highest season ever reached") — belongs to G3's localStorage namespace.
- **Mid-season "target met ✓" celebrations** — silent until Day 20 confirms; surprise check marks would undercut the transition moment.
- **Visual regression or screenshot testing** — not in the project's test stack.

## Open items for playtest

- Numbers (especially Season 4 target = 600) are best-guesses from the doc analysis. After ship, measure Season 1 / 2 / 3 / 4 completion rates and tune.
- Telegraphing window (3 days at Day 18) may be too short or too long; widen to 5 days if players report surprise.
- Endless formula tuning — does +2 lease per endless season feel slow enough to keep runs alive, or so slow that endless feels grindy?

---

*Spec generated 2026-06-02 via brainstorming → spec flow.*
*Based on backlog item G1 (consolidating p1·I1, p2·A, p3·1, p4·A, p5·3.1/3.6).*
