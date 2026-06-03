# Implementation Plan: Season System (006-season-system)

**Branch**: `006-season-system` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md) | **Tasks**: [tasks.md](./tasks.md)
**Input**: Feature specification from `specs/006-season-system/spec.md`

## Summary

Add a structured Season System to convert open-ended survival into a 4-season finite arc with optional Endless mode. Seasons of 20 days each have a coin target the player must hold at end-of-day-20; missing the target ends the run, hitting it advances to the next season with escalating lease and disaster rates. All season facts (number, name, lease, target) are derived from `currentDay` via a new pure helper `getSeasonForDay`. Only one persisted field is added (`endlessMode: boolean`); schema bumps 3 → 4 with a one-line migration.

## Technical Context

**Language/Version**: TypeScript ~5.6 + React 18.3
**Primary Dependencies**: Tailwind CSS 3.4, Vite 5.4 (no new deps)
**Storage**: localStorage — key `pixel-parsnips-state`, schema version 4 (was 3)
**Testing**: Vitest 4 + React Testing Library + vitest-axe
**Target Platform**: Browser (mobile-first, responsive to 1440px)
**Project Type**: Web application (single-page game)
**Performance Goals**: 60 fps interactions; pure functional engine; one new modal component
**Constraints**: No new npm packages; the `LAND_LEASE_FEE` constant is removed (lease now per-season); the `phase` union expands from 2 to 5 variants
**Scale/Scope**: 1 new engine module, 1 new component, 4 existing files modified, 2 new test files, 2 extended test files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Spec-First | ✅ PASS | spec.md complete and committed before plan |
| II — Incremental Delivery | ✅ PASS | 17 tasks across 8 phases; each phase produces working, testable software |
| III — Quality Gates | ✅ PASS | TDD throughout; vitest-axe on new modal; balance canary test for engine regression |
| IV — No Hidden State | ✅ PASS | All season facts derived from `currentDay`; only `endlessMode` is genuinely new state |
| V — Save Compatibility | ✅ PASS | Schema 3 → 4 migration preserves all in-progress saves |

## File Map

### New files

| Path | Responsibility |
|---|---|
| `src/engine/seasons.ts` | Pure module: `SeasonConfig` type, `SEASON_TABLE` for Seasons 1–4, `getSeasonForDay` (with endless formula for N≥5), `getDisasterBandsForSeason` (proportional scaling) |
| `src/components/SeasonTransitionModal.tsx` | Single component with three variants (`passed` / `failed` / `victory`) keyed off a `variant` prop |
| `tests/engine/seasons.test.ts` | Unit tests for `getSeasonForDay` boundaries (Seasons 1–4 + endless), disaster band scaling, ratio preservation |
| `tests/engine/seasonTransition.test.ts` | Engine tests for season-end phase transitions: `season_passed`, `season_failed`, `season_4_won`, endless mode, bankruptcy precedence |
| `tests/components/SeasonTransitionModal.test.tsx` | Component tests: variant rendering, button callbacks, "X coins short" suppression rule, vitest-axe |

### Modified files

| Path | Change |
|---|---|
| `src/engine/types.ts` | Expand `phase` union (+3 variants); add `endlessMode: boolean` to `GameState` |
| `src/engine/constants.ts` | Bump `SCHEMA_VERSION` 3 → 4; remove `LAND_LEASE_FEE` (now per-season) |
| `src/engine/gameEngine.ts` | `processTurn` reads seasonal lease + disaster bands; season-end target check; `initialGameState` adds `endlessMode: false` |
| `src/engine/useGameEngine.ts` | `loadState` performs schema 3 → 4 migration before discarding; existing console.info path preserved for schema < 3 |
| `src/components/HUD.tsx` | Replace `LAND_LEASE_FEE` import with per-day derived season config; add season indicator, target line, Day 18+ warning, Day 20 lease preview |
| `src/components/BankruptcyScreen.tsx` | Add one "Season reached: N (Name)" line between Days Survived and Peak Balance |
| `src/App.tsx` | Route the 3 new transient phases to `SeasonTransitionModal`; route `season_failed` to a failure variant of the existing run-end flow |
| `tests/engine/gameEngine.test.ts` | Update lease-dependent tests to use seasonal lease (Season 1 = 15, same as today on Days 1–20) |
| `tests/engine/useGameEngine.test.ts` | Add schema 3 → 4 migration tests |

### Architectural choices locked in spec

- **Approach A — Derived seasons**: lease, disaster %, target, and season number are all functions of `currentDay`. Only `endlessMode` is persisted.
- **Pure engine, single modal**: the new transient phases (`season_passed`, `season_4_won`, `season_failed`) drive a single `SeasonTransitionModal` component with a `variant` prop. App.tsx becomes the single phase router.
- **Lease is the breaking change**: removing the `LAND_LEASE_FEE` constant cascades through `gameEngine.ts`, `HUD.tsx`, and existing tests. Phase B (T004–T006) lands the types and schema; Phase C (T007–T008) lands the seasonal lease and bands in one focused diff.

## Phase order

| Phase | Tasks | Outcome |
|---|---|---|
| A — Foundations | T001–T003 | `seasons.ts` exists with pure helpers; no engine integration yet |
| B — Types & schema | T004–T005 | `GameState` includes `endlessMode`; schema bumped; existing saves migrate |
| C — Engine: escalating costs | T006–T007 | Lease and disaster bands sourced from active season config (US4) |
| D — Engine: season transitions | T008–T010 | `processTurn` emits the three new phases; bankruptcy precedence preserved (US2, US3, US5) |
| E — UI: HUD | T011–T012 | Season indicator, target line, warning, lease preview (US1, US6) |
| F — UI: Season Transition Modal | T013–T015 | New modal with all three variants + accessibility wired to App.tsx (US2, US3, US5) |
| G — UI: BankruptcyScreen | T016 | Single new "Season reached" line |
| H — Regression canary | T017 | Deterministic 80-day run produces expected balance / phase |

Each phase is independently testable. **Phase B is the most risky** (schema bump touches load path); land it on its own commit before moving to engine changes. **Phase F is the most user-visible**; expect copy/styling iteration after a first playtest.

## Open items deferred from spec

These are explicitly out of scope for this plan; the spec listed them in "Out of scope":

- Enriched run summary (G3): medals, personal bests, contextual failure tips
- Per-season disaster biasing (e.g. Summer = drought-heavy)
- HUD disaster % indicator
- Career stats / cross-run persistence
- Mid-season "target met ✓" celebrations
- Visual regression / screenshot testing

## Execution

This plan delegates task-by-task execution to one of:

- **superpowers:subagent-driven-development** (recommended) — fresh subagent per task with two-stage review between tasks
- **superpowers:executing-plans** — inline execution with checkpoints

See [tasks.md](./tasks.md) for the full 17-task TDD-driven checklist.

---

*Plan generated 2026-06-02 via brainstorming → writing-plans flow.*
