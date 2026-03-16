# Implementation Plan: Pixel Parsnips — Farming Tycoon Game

**Branch**: `001-farming-tycoon-game` | **Date**: 2026-03-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-farming-tycoon-game/spec.md`

## Summary

Build a web-based, single-screen, turn-based farming tycoon game as a React/TypeScript
SPA. The player manages a 12-plot farm, buying seeds and upgrades from a shop, advancing
days with a "Next Day" button, and surviving an escalating faucet-and-sink economy
(crop income vs. land lease + tax drain). Game logic lives in pure functions and a
custom React hook; the UI is a single-page layout styled with Tailwind CSS. State is
persisted to localStorage between sessions.

## Technical Context

**Language/Version**: TypeScript 5.4 + React 18
**Primary Dependencies**: React 18, Tailwind CSS 3, Vite 5
**Storage**: localStorage (browser — session persistence, no server)
**Testing**: Vitest 1.x + React Testing Library 14
**Target Platform**: Modern evergreen browsers (Chromium, Firefox, Safari)
**Project Type**: Single-page application (SPA)
**Performance Goals**: Time to Interactive < 2 s on 4G; turn processing < 50 ms
**Constraints**: All state updates immutable; game logic isolated in custom hook /
pure functions; offline-capable (no network dependency after load)
**Scale/Scope**: Single-player browser game; ~15 components; ~1 500 LOC

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Code Quality ✅

| Rule | Status | Notes |
|------|--------|-------|
| Automated linting gate | ✅ Pass | ESLint + `typescript-eslint` + Prettier in CI |
| Single Responsibility | ✅ Pass | `gameEngine.ts` = state logic only; components = display only |
| Cyclomatic complexity ≤ 10 | ✅ Pass | `processTurn` broken into sub-functions; no branch exceeds 10 |
| Named constants, no magic numbers | ✅ Pass | All game params in `src/engine/constants.ts` |
| PR size reviewable in < 30 min | ✅ Pass | SPA scope; each user-story PR is a small slice |
| No dead code | ✅ Pass | TypeScript `noUnusedLocals: true` enforced in `tsconfig.json` |

### II. Testing Standards ✅

| Rule | Status | Notes |
|------|--------|-------|
| TDD for business logic | ✅ Pass | All engine pure functions have tests written before implementation |
| Integration tests on contracts | ✅ Pass | Hook tests via React Testing Library cover the full turn sequence |
| Coverage ≥ 80% (engine ≥ 95%) | ✅ Pass | `processTurn`, `buySeed`, `buyUpgrade`, `plantSeed` = critical path → 95% target |
| Deterministic tests | ✅ Pass | `processTurn` accepts optional `weatherRoll` param for seeded tests |
| Tests run in < 5 min | ✅ Pass | Vitest with no external I/O; expected < 60 s total |

### III. UX Consistency ✅

| Rule | Status | Notes |
|------|--------|-------|
| Design system compliance | ✅ Pass | Tailwind `tailwind.config.ts` defines `farm` palette; no ad-hoc colors |
| Consistent interaction patterns | ✅ Pass | Single-screen SPA; all controls visible simultaneously; no navigation |
| Plain-language error messages | ✅ Pass | Defined in spec (FR-014): message + recovery action for all blocked purchases |
| WCAG 2.1 AA | ✅ Pass | Retro palette designed with minimum 4.5:1 contrast; `axe-core` in CI |
| UX review checkpoint in plan | ✅ Pass | Single-screen layout confirmed in Project Structure below |

### IV. Performance Requirements ✅

| Rule | Status | Notes |
|------|--------|-------|
| TTI < 2 s on 4G | ✅ Pass | Vite bundle < 200 KB; no server calls; served as static assets |
| API p95 < 200 ms | N/A | No server API; all computation is in-browser |
| SLAs in spec for background jobs | N/A | No background jobs; turn processing is synchronous user-triggered action |
| Perf regression blocks merge | ✅ Pass | Lighthouse CI configured; > 10% regression blocks PR |
| Memory budget defined | ✅ Pass | localStorage key < 50 KB; daily log = last entry only (no unbounded growth) |

**No constitution violations.** Complexity Tracking table omitted (no violations to justify).

## Project Structure

### Documentation (this feature)

```text
specs/001-farming-tycoon-game/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── game-engine-api.md
│   └── localstorage-schema.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── GameBoard.tsx        # Root layout; composes all panels
│   ├── HUD.tsx              # Day counter, coin balance, lease/tax display
│   ├── FarmGrid.tsx         # 12-plot grid
│   ├── PlotCard.tsx         # Single farm plot (empty or occupied)
│   ├── DailyLog.tsx         # Completed-day summary panel
│   ├── Shop.tsx             # Shop panel (seeds + upgrades)
│   ├── SeedCard.tsx         # Seed item within shop
│   ├── UpgradeCard.tsx      # Tool upgrade item within shop
│   └── BankruptcyScreen.tsx # Game-over overlay
├── engine/
│   ├── types.ts             # TypeScript interfaces & enums
│   ├── constants.ts         # Crop definitions, weather table, game params
│   ├── gameEngine.ts        # Pure state-transition functions (no React)
│   └── useGameEngine.ts     # React hook: wraps engine + localStorage sync
├── App.tsx                  # Root: renders GameBoard or BankruptcyScreen
└── main.tsx                 # Vite entry point

tests/
├── engine/
│   ├── gameEngine.test.ts       # Unit tests — pure engine functions
│   └── useGameEngine.test.ts    # Hook integration tests (RTL)
└── components/
    └── GameBoard.test.tsx        # Smoke tests — rendered UI
```

**Structure Decision**: Single SPA project at repository root. All source under
`src/`; all tests under `tests/`. No backend; no monorepo tooling required.
The `engine/` subdirectory is the strict boundary between game logic and view.
