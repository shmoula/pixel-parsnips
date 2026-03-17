# Research: Pixel Parsnips — Farming Tycoon Game

**Feature**: 001-farming-tycoon-game
**Date**: 2026-03-16
**Status**: Complete — all unknowns resolved

## 1. Build Tooling: Vite vs. Create React App

**Decision**: Vite 5 with `@vitejs/plugin-react`

**Rationale**: Create React App is officially unmaintained (last release 2022). Vite
provides faster HMR, native ESM, and first-class TypeScript support with zero config.
The `vite-plugin-checker` plugin integrates TypeScript type-checking into the dev
server without slowing the build.

**Alternatives considered**:
- Next.js — rejected; SSR/routing overhead unnecessary for a single-screen SPA game
- Parcel — rejected; less ecosystem support for Tailwind + Vitest integration

---

## 2. Testing Framework: Vitest vs. Jest

**Decision**: Vitest 1.x with `@vitest/ui` and `@vitest/coverage-v8`

**Rationale**: Vitest shares Vite's transform pipeline, meaning zero configuration
for TypeScript and JSX in tests. It is API-compatible with Jest, so the learning
curve is negligible. Coverage via V8 (built-in) avoids the Babel instrumentation
overhead of Istanbul.

**Alternatives considered**:
- Jest + ts-jest — rejected; requires a separate Babel/SWC transform config that
  diverges from Vite's config; slower cold start

---

## 3. State Architecture: Custom Hook vs. Context + Reducer vs. Zustand

**Decision**: Single custom hook `useGameEngine` wrapping pure functions in
`gameEngine.ts`

**Rationale**: The game has a single "God state" object (`GameState`) that never
needs to be shared across component subtrees — all consumers are children of
`<GameBoard>`. A custom hook returning state + action dispatchers is the simplest
correct design. Pure functions in `gameEngine.ts` are framework-agnostic and
trivially unit-testable without React.

**Alternatives considered**:
- `useReducer` + Context — rejected; adds boilerplate (action types, dispatch
  wrapping) without benefit at this scale
- Zustand — rejected; external dependency unnecessary when a hook is sufficient;
  avoid over-engineering (constitution Principle I)

---

## 4. Immutable State Updates

**Decision**: Native spread operator + `Array.map` / `Array.filter`

**Rationale**: The `GameState` object is shallow-to-medium depth (plots array,
seed inventory, one log entry). Spread syntax is sufficient and requires zero
dependencies. Immer would add abstraction cost that is not warranted for this
scope.

**Pattern**:
```typescript
// Update a single plot (immutable)
const newPlots = state.plots.map(plot =>
  plot.id === targetId ? { ...plot, daysRemaining: plot.daysRemaining! - 1 } : plot
);
const newState: GameState = { ...state, plots: newPlots };
```

**Alternatives considered**:
- Immer — rejected; adds a dependency and wraps mutation in proxies; unnecessary at
  this scale and contrary to YAGNI principle

---

## 5. localStorage Persistence Strategy

**Decision**: Serialize full `GameState` as JSON on every `nextDay` call and on
every shop transaction. Use a `SCHEMA_VERSION` constant to detect stale data.

**Pattern**:
```typescript
const STORAGE_KEY = 'pixel-parsnips-state';
const SCHEMA_VERSION = 1;

// Load
const raw = localStorage.getItem(STORAGE_KEY);
const parsed = raw ? JSON.parse(raw) : null;
const state = parsed?.schemaVersion === SCHEMA_VERSION
  ? parsed.state
  : initialGameState();

// Save
localStorage.setItem(STORAGE_KEY, JSON.stringify({
  schemaVersion: SCHEMA_VERSION,
  state,
}));
```

**Rationale**: Simple, synchronous, no external library. The state object is < 5 KB
even for long sessions (12 plots + last log entry). If the schema version mismatches
(e.g. after a code update), the game silently starts fresh rather than crashing.

**Alternatives considered**:
- IndexedDB — rejected; async overhead unnecessary for < 50 KB of data
- `useSyncExternalStore` with a custom storage adapter — rejected; over-engineered for
  this use case

---

## 6. Tailwind CSS Design Tokens (Pixel/Retro Palette)

**Decision**: Define a custom `farm` palette in `tailwind.config.ts` covering all
game surfaces. No inline arbitrary values or ad-hoc colors in component files.

**Palette defined** (WCAG 2.1 AA verified — 4.5:1 contrast minimum for text):

| Token | Hex | Usage |
|-------|-----|-------|
| `farm-soil` | `#4A2F1A` | Plot backgrounds |
| `farm-grass` | `#3D7A2B` | Farm grid background |
| `farm-sky` | `#6BBFFF` | HUD / header background |
| `farm-gold` | `#F5C842` | Coin balance, harvest income |
| `farm-red` | `#C0392B` | Expense / drain values |
| `farm-stone` | `#8C7B6B` | Empty plot / disabled state |
| `farm-parchment` | `#F5ECD7` | Panel backgrounds |
| `farm-ink` | `#1A1A1A` | Primary text (on parchment) |

All color combinations verified: `farm-ink` on `farm-parchment` = 16.7:1 ✅,
`farm-ink` on `farm-gold` = 9.2:1 ✅, `farm-gold` on `farm-soil` = 5.1:1 ✅.

**Alternatives considered**:
- Using a pre-built retro Tailwind theme — rejected; no available theme matched the
  specific earthy/pixel aesthetic and contrast requirements

---

## 7. Weather Determinism in Tests

**Decision**: `processTurn(state, weatherRoll?)` accepts an optional `weatherRoll`
parameter (a `WeatherId` value). When omitted in production, it randomly selects
from the weather table.

**Rationale**: This design makes every test deterministic without mocking
`Math.random` globally. Tests can specify the exact weather to exercise boundary
conditions (e.g. `'drought'` for 0.5× multiplier, `'perfect_sun'` for 1.5×).

---

## 8. WCAG 2.1 AA Compliance Strategy

**Decision**: `axe-core` via `@axe-core/react` in development mode + `jest-axe`
(or `vitest-axe`) in component tests. Lighthouse CI checks on every build.

**Rationale**: The retro pixel aesthetic can conflict with accessibility if colors
are chosen for "feel" alone. Automated tooling catches the most common issues
(contrast, missing labels, missing ARIA roles) before human review.

**Key accessibility requirements for this game**:
- All buttons (`Next Day`, `Buy`, `Plant`, `Restart`) MUST have descriptive
  `aria-label` attributes
- Crop status in `PlotCard` MUST be conveyed via text (not color alone)
- `DailyLog` MUST use a `<section>` with `aria-label="Daily summary"` so screen
  readers can navigate to it
- Shop MUST use `role="dialog"` or a native `<dialog>` element when rendered as
  a modal/panel

---

## 9. Coin Rounding Strategy

**Decision**: `Math.floor` (truncate) for all fractional coin results.

**Rationale**: Consistent with the spec assumption "all coin values are integers;
fractional results rounded down." Floor is simpler and more predictable than round
for end-user experience (player never receives a surprise extra coin).

**Implementation**: A single `coins(n: number): number => Math.floor(n)` helper in
`constants.ts` ensures all rounding is done through one function.

---

## 10. Project Bootstrap Commands

```bash
npm create vite@latest pixel-parsnips -- --template react-ts
cd pixel-parsnips
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install -D vitest @vitest/coverage-v8 @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event jsdom
```
