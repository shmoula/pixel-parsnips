# Quickstart: Pixel Parsnips — Farming Tycoon Game

**Feature**: 001-farming-tycoon-game
**Date**: 2026-03-16

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18.x LTS |
| npm | 9.x (bundled with Node 18) |
| Git | 2.x |

## 1. Bootstrap the Project

```bash
# From repo root
npm create vite@latest . -- --template react-ts
npm install

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Testing
npm install -D vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom
```

## 2. Configure Tailwind

Add the `farm` color palette to `tailwind.config.ts`:

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          soil:      '#4A2F1A',
          grass:     '#3D7A2B',
          sky:       '#6BBFFF',
          gold:      '#F5C842',
          red:       '#C0392B',
          stone:     '#8C7B6B',
          parchment: '#F5ECD7',
          ink:       '#1A1A1A',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

## 3. Configure Vitest

Add to `vite.config.ts`:

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        // engine/ directory enforced at 95% via per-file config
      },
    },
  },
});
```

Create `tests/setup.ts`:

```typescript
import '@testing-library/jest-dom';
```

## 4. Start the Development Server

```bash
npm run dev
# → http://localhost:5173
```

## 5. Run Tests

```bash
# All tests
npm run test

# Watch mode
npm run test -- --watch

# Coverage report
npm run test -- --coverage
# Open coverage/index.html to inspect per-file coverage
```

## 6. Lint & Type-check

```bash
# TypeScript type check (no emit)
npx tsc --noEmit

# ESLint
npx eslint src tests --ext .ts,.tsx

# Both (recommended before committing)
npx tsc --noEmit && npx eslint src tests --ext .ts,.tsx
```

## 7. Production Build

```bash
npm run build
# Output in dist/

# Preview production build locally
npm run preview
# → http://localhost:4173
```

## 8. Validation Checklist

Run through these steps to confirm the environment is healthy:

- [ ] `npm run dev` starts without errors; game loads at localhost:5173
- [ ] `npm run test` passes with ≥ 80% line coverage overall
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] `npx eslint src tests` exits with code 0
- [ ] In the game: plant a Radish, click "Next Day", verify coin balance increases
- [ ] In the game: spend down to < 15 coins, click "Next Day", verify Bankruptcy screen appears
- [ ] Reload the page; verify game state is restored from previous session
- [ ] Open browser devtools → Accessibility panel; zero violations reported

## 9. Project Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve production build locally |
| `npm run test` | Run Vitest test suite |
| `npm run test -- --coverage` | Run tests with V8 coverage |
| `npm run lint` | Run ESLint on `src/` and `tests/` |
| `npx tsc --noEmit` | Type-check without emitting |
