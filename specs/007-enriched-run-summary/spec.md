# Feature Specification: Enriched Run Summary (Medals · Bests · Milestones)

**Feature Branch**: `007-enriched-run-summary`
**Created**: 2026-06-03
**Status**: Draft
**Input**: Backlog item G3 (consolidated from p1·I6, p2·F, p4·F, p5·3.2). Partial G3 already shipped:
- Season-reached line on BankruptcyScreen (006-season-system T016).
- Contextual failure tip (005-ui-polish-core US5, `deriveInsight()` in `BankruptcyScreen.tsx`).

This feature covers the **remaining** G3 surface: medal/tier, personal bests across runs, and a per-run milestones recap.

## Summary

Turn the end-of-run BankruptcyScreen from a three-stat dead-end into a recap players want to read. Award one of five medals based on the highest season reached, surface three personal-best records that persist across runs, and call out which of this run's stats beat their record with inline "🏆 New Best!" badges. Add one new per-run aggregator (`disastersSurvived`) to support the resilience milestone. Records live in a separate localStorage key so they survive game-state schema migrations and a player choosing "Restart".

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A run earns a medal that names what was achieved (Priority: P1)

A player who reaches the bankruptcy screen sees a clear medal that grades their run, tied directly to how far through the season arc they got.

**Why this priority**: Without a tier, every bankruptcy looks identical regardless of whether the player survived 8 days or 78. The medal is the headline that gives the screen a reason to exist.

**Independent Test**: Force runs that end at different days. The medal shown on BankruptcyScreen matches the table below.

**Acceptance Scenarios**:

1. **Given** a run that bankrupts on Day 12 (Season 1), **When** the BankruptcyScreen renders, **Then** the medal section reads "No Medal — keep going" and shows a muted/grey badge.
2. **Given** a run that bankrupts on Day 27 (Season 2), **When** the BankruptcyScreen renders, **Then** the medal is **Bronze** with tagline "Survived Spring Thaw".
3. **Given** a run that bankrupts on Day 47 (Season 3), **When** the BankruptcyScreen renders, **Then** the medal is **Silver** with tagline "Survived Summer Heat".
4. **Given** a run that bankrupts on Day 67 (Season 4, did not complete it), **When** the BankruptcyScreen renders, **Then** the medal is **Gold** with tagline "Reached the final season".
5. **Given** a player who passed Season 4 and chose Endless, then later bankrupts on Day 95, **When** the BankruptcyScreen renders, **Then** the medal is **Platinum** with tagline "Conquered Season 4".

**Medal table**:

| Season reached at run-end | Won Season 4? | Medal |
|---|---|---|
| 1 (bankrupt in S1) | — | none |
| 2 (entered S2) | no | bronze |
| 3 (entered S3) | no | silver |
| 4 (entered S4, didn't finish) | no | gold |
| any | yes (passed S4) | platinum |

---

### User Story 2 — Personal bests carry forward across runs (Priority: P1)

A player who finishes a run sees how their results compare to their personal records, and any record they just broke is highlighted on the stat that broke it.

**Why this priority**: The "one more try" loop depends on visible progress between attempts. Without persistent bests, every run is forgotten the moment it ends.

**Independent Test**: Play a run, end it, and on the bankruptcy screen note the records. Play a second run that does worse on every dimension — records are unchanged, no "🏆 New Best!" badges appear. Play a third run that beats one stat — that one stat shows a "🏆 New Best!" badge and the record updates.

**Acceptance Scenarios**:

1. **Given** a player on their very first run that ends, **When** the BankruptcyScreen renders, **Then** every stat in the run shows a "🏆 New Best!" badge AND the Records card shows "This was your first run — your records start now."
2. **Given** a player whose previous best `peakBalance` was 280 and whose current run reached 320, **When** the BankruptcyScreen renders, **Then** the Peak Balance stat shows a "🏆 New Best!" badge and the Records card shows the new best of 320.
3. **Given** a player whose previous bests are higher than the current run on every dimension, **When** the BankruptcyScreen renders, **Then** no "🏆 New Best!" badges appear and the Records card shows the prior bests unchanged.
4. **Given** records exist in localStorage, **When** the player taps "Restart", **Then** game state is wiped but the records key `pixel-parsnips-records` is preserved.
5. **Given** a player whose existing browser has no records key yet (returning player from before this feature), **When** the bankruptcy screen first renders for them, **Then** records load as zero defaults and the first ended run becomes the inaugural record without crashes or migration warnings.

**Stats tracked across runs**:
- `bestDaysSurvived`
- `bestPeakBalance`
- `bestSeasonReached`
- `mostDisastersSurvived`
- `totalRunsCompleted` (used to detect first-run UX)

---

### User Story 3 — A milestones recap surfaces what made this run distinct (Priority: P1)

A player sees not just how long they survived and how rich they got, but also one resilience stat — how many disaster days they weathered without dying.

**Why this priority**: Days and coins alone don't tell the story of a run. "I survived 4 disasters" is a memory-anchor moment that the existing summary doesn't capture.

**Independent Test**: Play a run that includes at least 3 disaster days (blight, pest infestation, or flash drought). Verify the `disastersSurvived` count on the bankruptcy screen matches the disaster days the player saw.

**Acceptance Scenarios**:

1. **Given** a run that experienced 2 blight days and 1 pest day, all survived, **When** the BankruptcyScreen renders, **Then** the Disasters Survived stat shows **3**.
2. **Given** a run that experienced 2 disaster days, the second of which caused bankruptcy that same turn, **When** the BankruptcyScreen renders, **Then** the Disasters Survived stat shows **1** (the fatal disaster does not count as "survived").
3. **Given** a run with zero disaster days, **When** the BankruptcyScreen renders, **Then** the Disasters Survived stat shows **0** and is displayed normally (not hidden).
4. **Given** an existing in-progress run from before this feature ships, **When** the schema migrates and the player continues, **Then** `disastersSurvived` starts from 0 for the remainder of the run (the migration does not retroactively reconstruct the count) and this is acceptable.

---

### User Story 4 — The BankruptcyScreen layout stays mobile-first and readable (Priority: P2)

A player on any device sees the enriched recap as a single coherent column, with the medal as the visual headline and personal bests as a subordinate, compact reference.

**Why this priority**: The existing screen is mobile-first and the project has already shipped a 005 polish pass. Adding three new sections must not regress layout, contrast, or readability.

**Independent Test**: Render the BankruptcyScreen at 360px, 768px, and 1280px viewports. The medal badge, run stats, records card, and insight all stack vertically without horizontal overflow; tap targets remain ≥ 44px.

**Acceptance Scenarios**:

1. **Given** any viewport ≥ 360px wide, **When** the BankruptcyScreen renders, **Then** no horizontal scroll appears and the medal badge is the visually dominant element above the stats.
2. **Given** the BankruptcyScreen renders, **When** vitest-axe runs against it for each medal tier, **Then** zero accessibility violations are reported.
3. **Given** a player using a screen reader, **When** they navigate the BankruptcyScreen, **Then** the medal badge announces tier and tagline, each "🏆 New Best!" badge announces "new personal best", and the Records card announces its purpose as "Personal records across all runs".

---

### Edge Cases

- **Endless mode bankruptcy**: A player who won Season 4 and continued into endless still shows **Platinum**, regardless of which endless-season day they eventually bankrupt on. (Once won, always Platinum.)
- **Season 4 victory before endless**: If we ever surface a non-bankruptcy run end (e.g. a "retire" action), the design still works because medal/records logic keys off `won` and `seasonReached`, not "bankrupt". Out of scope for this feature, but the API supports it.
- **Records file corruption**: If `localStorage.getItem('pixel-parsnips-records')` returns malformed JSON, treat as missing → zero defaults. Do not crash. Do not block the bankruptcy screen on a records read failure.
- **First-run UX**: When `totalRunsCompleted === 0` at run-end (i.e. the current run is the first to end), every stat trivially becomes a new best. We still show the "🏆 New Best!" badges (it's encouraging, not noisy) AND add a single one-time line "This was your first run — your records start now." The records card then displays the just-set values.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST track `disastersSurvived: number` on `GameState`, incremented at end-of-turn iff the turn's `weatherId` is in the disaster set AND the run did not bankrupt that turn.
- **FR-002**: A pure function `deriveMedal(seasonReached: number, won: boolean): Medal` MUST return `'platinum'` if `won === true`, else `'gold' | 'silver' | 'bronze' | 'none'` per the table in US1.
- **FR-003**: A new module `engine/records.ts` MUST expose `loadRecords()` (zero defaults if absent or malformed) and `recordRunEnd(state)` (writes maxes, returns `{ records, newBests }`).
- **FR-004**: `recordRunEnd` MUST be called exactly once per run, on whichever of these two transitions happens *first*: (a) the phase becomes `bankrupt`, or (b) the phase becomes `season_4_won` AND `endlessMode === false`. A run that wins S4 and then chooses Endless does NOT fire on the win — it fires later on the eventual `bankrupt`. The `won` flag passed to medal derivation MUST be `endlessMode || phase === 'season_4_won'` evaluated at the moment of the trigger. `recordRunEnd` MUST NOT be called on the mid-run `season_passed` transition.
- **FR-005**: The records localStorage key MUST be `pixel-parsnips-records` and MUST be separate from the game-state key. `restartGame` MUST NOT touch this key.
- **FR-006**: The BankruptcyScreen MUST display, top-to-bottom: title, medal badge, this-run stats card (Days Survived, Season Reached, Peak Balance, Disasters Survived), Personal Bests card, contextual insight, restart button.
- **FR-007**: Each stat in the this-run stats card MUST show a "🏆 New Best!" badge iff that stat is present in the `newBests` set returned by `recordRunEnd`. The badge MUST have `aria-label="new personal best"`.
- **FR-008**: When `totalRunsCompleted === 0` *before* writing the new records, the Personal Bests card MUST also include the one-time line "This was your first run — your records start now."
- **FR-009**: The state schema MUST bump from version 4 → 5 to include `disastersSurvived`, defaulting to 0 for migrated state. Records have their own schema starting at version 1.
- **FR-010**: The medal badge MUST have `role="img"` and `aria-label="<tier> medal — <tagline>"`, or for `'none'`, `aria-label="No medal — keep going"`.
- **FR-011**: All five medal tiers MUST render without overflow on viewports ≥ 360px wide. vitest-axe MUST report zero violations on the BankruptcyScreen for each tier.
- **FR-012**: Medal palette MUST reuse existing `farm-*` Tailwind tokens (no new colour additions). Tier-to-token mapping is an implementation detail of the plan, not the spec.

### Key Entities

- **Medal** — Discriminated string union: `'none' | 'bronze' | 'silver' | 'gold' | 'platinum'`. Derived, never persisted.
- **PersonalBests** — Object stored under `localStorage['pixel-parsnips-records']`:
  - `schemaVersion: 1`
  - `bestDaysSurvived: number`
  - `bestPeakBalance: number`
  - `bestSeasonReached: number`
  - `mostDisastersSurvived: number`
  - `totalRunsCompleted: number`
- **GameState** (existing) gains one field: `disastersSurvived: number`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every run that ends shows a medal tier matching the season-reached table in US1 — verifiable by deterministic-seed canary tests covering all five tiers.
- **SC-002**: A run that beats any prior best shows a "🏆 New Best!" badge on that exact stat and persists the new value across page reload.
- **SC-003**: Two consecutive runs where the second is strictly worse on every dimension result in zero "🏆 New Best!" badges and unchanged records — verifiable by an integration test.
- **SC-004**: BankruptcyScreen passes vitest-axe with zero violations for each of the five medal tiers and for both first-run and Nth-run record states.
- **SC-005**: A returning player whose existing browser has no records key (returning from before this feature) reaches the BankruptcyScreen without errors; the records key is created on first run-end.
- **SC-006**: `npm test` and `npm run lint` both pass.

## Out of Scope

- New disaster mitigation infrastructure or upgrades (G8).
- Persistent achievements / unlocks (G14) — bests are not achievements; this feature does not gate any content.
- Run legacy / meta-progression bonuses (G15) — records are display-only, never feed back into starting conditions.
- Showing medals/bests on the SeasonTransitionModal (any variant).
- Cross-device or account-based sync. Records are local to the browser/origin.
- Total harvest income, total harvests count, biggest single-day haul — deferred. The three tracked stats (days, peak, disasters) cover the screenshot moments cheaply.
- Streak tracking (G12 — separate backlog item).

## Open Questions

None at design time. All scope questions resolved during brainstorming (2026-06-03).
