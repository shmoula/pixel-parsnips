# 018 — Prettier Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the user-provided pixel art into the game: crop sprites on plots, a full-page illustrated soil backdrop with farm props, a wood-textured shop panel, and an inset icon frame on seed cards.

**Architecture:** A new `decorAssets.ts` registry mirrors the existing `cropSprites.ts` auto-discovery pattern (`import.meta.glob`, everything optional, graceful fallback). A new `PageBackdrop` component renders a fixed decorative layer behind all content. `PlotCard`, `Shop`, and `SeedCard` get presentational-only edits. No engine/state/schema changes.

**Tech Stack:** React 18 + TypeScript, Tailwind 3.4, Vite 5 (`import.meta.glob` asset discovery), Vitest + Testing Library (jsdom).

**Spec:** `specs/018-prettier-assets/spec.md` (approved). All PNG assets are already in place under `src/assets/{crops,decor,ui}/`.

**Pre-existing state:** The working tree has unstaged 016 work (crop sprite registry, shop dressing, tinted seed cards). This plan builds on it; commits will include those files where touched. Baseline check before starting: `npm test && npm run lint` must pass.

---

### Task 1: Decor asset registry

**Files:**
- Create: `src/components/decorAssets.ts`
- Test: `tests/components/decorAssets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/decorAssets.test.ts
import { describe, it, expect } from 'vitest';
import { getDecorUrl, woodPlanksUrl } from '../../src/components/decorAssets';

describe('decorAssets registry (018)', () => {
  it('resolves an existing decor prop to its asset URL', () => {
    const url = getDecorUrl('rake');
    expect(url).not.toBeNull();
    expect(url).toContain('rake');
  });

  it('resolves the soil tile', () => {
    expect(getDecorUrl('soil_tile')).toContain('soil_tile');
  });

  it('returns null for a prop that has no asset', () => {
    expect(getDecorUrl('windmill')).toBeNull();
  });

  it('exposes the wood plank texture URL', () => {
    expect(woodPlanksUrl).not.toBeNull();
    expect(woodPlanksUrl).toContain('wood_planks');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/decorAssets.test.ts`
Expected: FAIL — `Cannot find module '../../src/components/decorAssets'`

- [ ] **Step 3: Write the implementation**

```ts
// src/components/decorAssets.ts
/**
 * 018 — decorative asset registry: page-backdrop props (src/assets/decor/) and
 * UI textures (src/assets/ui/). Same auto-discovery pattern as cropSprites.ts:
 * drop a PNG in the folder and it's picked up at build time; a missing file
 * resolves to null and the caller simply skips rendering it.
 */

const decorUrls = import.meta.glob('../assets/decor/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const uiUrls = import.meta.glob('../assets/ui/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function toNameMap(urls: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, url] of Object.entries(urls)) {
    const name = path.split('/').pop()?.replace(/\.png$/, '');
    if (name) map[name] = url;
  }
  return map;
}

const decorMap = toNameMap(decorUrls);
const uiMap = toNameMap(uiUrls);

/** URL for a decor asset by bare name (e.g. 'rake', 'grass_1', 'soil_tile'), or null when absent. */
export function getDecorUrl(name: string): string | null {
  return decorMap[name] ?? null;
}

/** Tileable wood-plank texture for the shop panel, or null when absent. */
export const woodPlanksUrl: string | null = uiMap['wood_planks'] ?? null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/decorAssets.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/decorAssets.ts tests/components/decorAssets.test.ts
git commit -m "feat(018): decor asset registry with auto-discovery"
```

---

### Task 2: PageBackdrop component

**Files:**
- Create: `src/components/PageBackdrop.tsx`
- Test: `tests/components/PageBackdrop.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/components/PageBackdrop.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PageBackdrop } from '../../src/components/PageBackdrop';

describe('PageBackdrop (018)', () => {
  it('is decorative: aria-hidden and pointer-events-none', () => {
    const { container } = render(<PageBackdrop />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
  });

  it('tiles the soil texture as the background', () => {
    const { container } = render(<PageBackdrop />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.backgroundImage).toContain('soil_tile');
  });

  it('renders prop images with empty alt (not in the a11y tree)', () => {
    const { container } = render(<PageBackdrop />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img.getAttribute('alt')).toBe('');
    const srcs = imgs.map(i => i.getAttribute('src') ?? '');
    expect(srcs.some(s => s.includes('rake'))).toBe(true);
    expect(srcs.some(s => s.includes('pitchfork'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/PageBackdrop.test.tsx`
Expected: FAIL — `Cannot find module '../../src/components/PageBackdrop'`

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/PageBackdrop.tsx
import type { CSSProperties } from 'react';
import { getDecorUrl } from './decorAssets';

/**
 * 018 — full-page illustrated backdrop. A fixed layer behind all content
 * (-z-10 keeps it under every non-positioned sibling), purely decorative:
 * aria-hidden + pointer-events-none so it never intercepts a tap or enters
 * the accessibility tree. Every asset is optional — a missing soil tile
 * leaves the flat page colour, a missing prop simply doesn't render.
 */

interface PropSpec {
  name: string;
  /** Rendered height in px (2× the source art keeps pixels crisp). */
  height: number;
  style: CSSProperties;
  /** Hide below md, where content fills the viewport width. */
  desktopOnly?: boolean;
}

/**
 * Asymmetric composition: hero tools anchored to the page edges (visible in
 * the side margins opened up by the board's max-width), small vegetation
 * scattered along edges and the area below the fold. Tuned visually — adjust
 * freely in the browser preview.
 */
const PROPS: PropSpec[] = [
  { name: 'rake',      height: 320, style: { top: '10%', left: 8 },        desktopOnly: true },
  { name: 'pitchfork', height: 320, style: { bottom: '6%', right: 12 },    desktopOnly: true },
  { name: 'grass_2',   height: 96,  style: { top: '40%', right: 28 },      desktopOnly: true },
  { name: 'flower_1',  height: 96,  style: { bottom: '12%', left: 48 },    desktopOnly: true },
  { name: 'stones',    height: 64,  style: { top: '32%', left: 52 },       desktopOnly: true },
  { name: 'grass_1',   height: 96,  style: { top: '70%', left: 8 } },
  { name: 'grass_1',   height: 64,  style: { bottom: 8, right: '30%' } },
  { name: 'stones',    height: 48,  style: { bottom: 28, left: '42%' } },
];

export function PageBackdrop() {
  const soilUrl = getDecorUrl('soil_tile');

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#140E06]"
      style={
        soilUrl
          ? {
              backgroundImage: `url(${soilUrl})`,
              backgroundRepeat: 'repeat',
              backgroundSize: '256px 256px',
              imageRendering: 'pixelated',
            }
          : undefined
      }
    >
      {PROPS.map((prop, i) => {
        const url = getDecorUrl(prop.name);
        if (!url) return null;
        return (
          <img
            key={`${prop.name}-${i}`}
            src={url}
            alt=""
            draggable={false}
            className={
              prop.desktopOnly ? 'hidden md:block absolute' : 'absolute'
            }
            style={{
              ...prop.style,
              height: prop.height,
              width: 'auto',
              imageRendering: 'pixelated',
            }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/PageBackdrop.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/PageBackdrop.tsx tests/components/PageBackdrop.test.tsx
git commit -m "feat(018): PageBackdrop — illustrated soil layer with farm props"
```

---

### Task 3: Mount the backdrop in GameBoard

**Files:**
- Modify: `src/components/GameBoard.tsx` (root div ~line 188, content row ~line 205)
- Test: existing `tests/components/GameBoard.test.tsx` must keep passing

- [ ] **Step 1: Add the import**

In `src/components/GameBoard.tsx`, after the `Shop` import (line 9):

```tsx
import { PageBackdrop } from './PageBackdrop';
```

- [ ] **Step 2: Move the page background onto the backdrop**

Replace (line ~188):

```tsx
    // T006 — relative container needed for fixed backdrop to scope correctly
    <div className="flex flex-col min-h-screen bg-[#140E06]">
```

with:

```tsx
    // T006 — relative container needed for fixed backdrop to scope correctly
    // 018 — page colour lives on PageBackdrop now (it needs to paint above -z-10)
    <div className="flex flex-col min-h-screen">
      <PageBackdrop />
```

(`PageBackdrop` becomes the first child, before `<HUD ... />`.)

- [ ] **Step 3: Constrain content width so the backdrop's side margins show**

Replace (line ~205):

```tsx
      <div className="flex flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4">
```

with:

```tsx
      {/* 018 — max-width opens side margins on wide screens, revealing the backdrop */}
      <div className="flex flex-col md:flex-row gap-4 p-4 pb-24 md:pb-4 w-full max-w-5xl mx-auto">
```

- [ ] **Step 4: Run the component test suites**

Run: `npx vitest run tests/components/GameBoard.test.tsx tests/components/PageBackdrop.test.tsx`
Expected: PASS. If a GameBoard test asserts on the removed `bg-[#140E06]` class, update that assertion to target `PageBackdrop` instead.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameBoard.tsx
git commit -m "feat(018): mount PageBackdrop behind the game board"
```

---

### Task 4: Crop sprites on plots (PlotCard)

**Files:**
- Modify: `src/components/PlotCard.tsx` (imports, `GROWTH_STAGE_EMOJI` area ~line 40, `GrowingCropCard` ~lines 175–225)
- Test: `tests/components/PlotCard.test.tsx` (append a describe block)

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/PlotCard.test.tsx`:

```tsx
describe('PlotCard — growth-stage sprites (018)', () => {
  // Engine stage → sprite frame: sprout→seedling, small→sprout, full→mature, ready→ready.

  it('renders the seedling sprite for a just-planted pumpkin (sprout stage)', () => {
    const { container } = render(
      <PlotCard
        plot={makePlot({ cropId: 'pumpkin', dayPlanted: 1, daysRemaining: 3 })}
        currentDay={1}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toContain('pumpkin_seedling');
  });

  it('renders the mature sprite for a full-stage pumpkin', () => {
    const { container } = render(
      <PlotCard
        plot={makePlot({ cropId: 'pumpkin', dayPlanted: 1, daysRemaining: 1 })}
        currentDay={3}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toContain('pumpkin_mature');
  });

  it('renders the ready sprite for a harvest-ready radish', () => {
    const { container } = render(
      <PlotCard
        plot={makePlot({ cropId: 'radish', dayPlanted: 1, daysRemaining: 0 })}
        currentDay={2}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toContain('radish_ready');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/PlotCard.test.tsx`
Expected: the three new tests FAIL (no `<img>` rendered — plots currently show emoji); all pre-existing tests PASS.

- [ ] **Step 3: Wire CropSprite into GrowingCropCard**

In `src/components/PlotCard.tsx`, add imports after line 4:

```tsx
import { CropSprite } from './CropSprite';
import type { SpriteStage } from './cropSprites';
```

After the `GROWTH_STAGE_EMOJI` map (~line 46), add:

```tsx
// 018 — engine growth stage → sprite frame (see src/assets/crops/README.md)
const STAGE_TO_SPRITE: Record<GrowthStage, SpriteStage> = {
  sprout: 'seedling',
  small:  'sprout',
  full:   'mature',
  ready:  'ready',
};
```

In `GrowingCropCard`, replace:

```tsx
      <ProgressRing progress={progress} size={52}>
        <span className="text-2xl">{stageEmoji}</span>
      </ProgressRing>
```

with:

```tsx
      <ProgressRing progress={progress} size={52}>
        <CropSprite
          cropId={plot.cropId!}
          stage={STAGE_TO_SPRITE[stage]}
          fallback={stageEmoji}
          size={40}
          fallbackClass="text-2xl"
        />
      </ProgressRing>
```

(`stageEmoji` stays defined — it's now the fallback for missing frames.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/PlotCard.test.tsx`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/PlotCard.tsx tests/components/PlotCard.test.tsx
git commit -m "feat(018): growth-stage crop sprites on plots"
```

---

### Task 5: Wood-textured shop panel

**Files:**
- Modify: `src/components/Shop.tsx` (`Awning` ~line 15, `SignHeader` ~line 52, panel `<aside>` ~line 130)

No new unit tests — these are style-only changes with no assertable behavior; existing suites (GameBoard renders Shop) guard against breakage, and Task 7 verifies visually.

- [ ] **Step 1: Import the texture**

In `src/components/Shop.tsx`, after the `UpgradeCard` import:

```tsx
import { woodPlanksUrl } from './decorAssets';
```

- [ ] **Step 2: Texture the panel background**

Replace the `<aside>` opening (~lines 130–139):

```tsx
    <aside
      aria-label="Shop"
      className="flex flex-col gap-4 p-4 rounded-lg"
      style={{
        background: [
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 8px)',
          '#4A2F1A',
        ].join(', '),
      }}
    >
```

with:

```tsx
    // 018 — real wood-plank texture with a dark wash so cards keep contrast;
    // falls back to the previous CSS grain when the texture PNG is absent.
    <aside
      aria-label="Shop"
      className="flex flex-col gap-4 p-4 rounded-lg"
      style={
        woodPlanksUrl
          ? {
              backgroundImage: [
                'linear-gradient(rgba(20,10,4,0.35), rgba(20,10,4,0.35))',
                `url(${woodPlanksUrl})`,
              ].join(', '),
              backgroundSize: 'auto, 128px 128px',
              backgroundRepeat: 'repeat',
              imageRendering: 'pixelated',
            }
          : {
              background: [
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 8px)',
                '#4A2F1A',
              ].join(', '),
            }
      }
    >
```

- [ ] **Step 3: Texture the sign**

In `SignHeader`, replace the outer div's `style` (~lines 55–60):

```tsx
      style={{
        backgroundColor: '#5A3A1E',
        borderColor: '#3D2410',
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -4px 6px rgba(0,0,0,0.4)',
      }}
```

with:

```tsx
      style={{
        backgroundColor: '#5A3A1E',
        // 018 — wood texture under a darker wash than the panel, so the sign
        // still reads as a separate carved board.
        ...(woodPlanksUrl
          ? {
              backgroundImage: [
                'linear-gradient(rgba(30,16,6,0.45), rgba(30,16,6,0.45))',
                `url(${woodPlanksUrl})`,
              ].join(', '),
              backgroundSize: 'auto, 128px 128px',
              backgroundRepeat: 'repeat',
              imageRendering: 'pixelated' as const,
            }
          : {}),
        borderColor: '#3D2410',
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -4px 6px rgba(0,0,0,0.4)',
      }}
```

- [ ] **Step 4: Four-color awning stripes**

In `Awning`, replace:

```tsx
        background:
          'repeating-linear-gradient(90deg, #3F7D30 0 11px, #E8D9A8 11px 22px)',
```

with:

```tsx
        // 018 — market-stall cloth: green / cream / rust / brown (44px period,
        // still out of phase with the 13px scallop tile).
        background:
          'repeating-linear-gradient(90deg, #3F7D30 0 11px, #E8D9A8 11px 22px, #A8452A 22px 33px, #6B4A2A 33px 44px)',
```

- [ ] **Step 5: Run the full test suite and lint**

Run: `npm test && npm run lint`
Expected: PASS (no behavioral change).

- [ ] **Step 6: Commit**

```bash
git add src/components/Shop.tsx
git commit -m "feat(018): wood-plank shop panel + 4-color awning"
```

---

### Task 6: Seed card inset icon frame + decor README

**Files:**
- Modify: `src/components/SeedCard.tsx` (~lines 149–158)
- Create: `src/assets/decor/README.md`
- Test: existing `tests/components/SeedCard.test.tsx` must keep passing

- [ ] **Step 1: Inset frame around the sprite**

In `src/components/SeedCard.tsx`, replace:

```tsx
        <span className="drop-shadow">
          <CropSprite
            cropId={cropId}
            stage="ready"
            fallback={CROP_EMOJI[cropId]}
            size={64}
            fallbackClass="text-2xl leading-none"
          />
        </span>
```

with:

```tsx
        {/* 018 — inset frame: the sprite reads as an item on display, not floating */}
        <span
          className="inline-flex items-center justify-center rounded-md px-2 py-1"
          style={{
            backgroundColor: 'rgba(0,0,0,0.28)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          <CropSprite
            cropId={cropId}
            stage="ready"
            fallback={CROP_EMOJI[cropId]}
            size={64}
            fallbackClass="text-2xl leading-none"
          />
        </span>
```

- [ ] **Step 2: Write the decor README**

```markdown
<!-- src/assets/decor/README.md -->
# Backdrop decor

Transparent-background pixel-art PNGs for the full-page backdrop
(`src/components/PageBackdrop.tsx`). Auto-discovered at build time by
`src/components/decorAssets.ts` (via `import.meta.glob`) — no import list to
update. Every file is optional: a missing prop simply doesn't render, and a
missing `soil_tile.png` falls back to the flat page colour.

## Files

| File | Role | Size |
|---|---|---|
| `soil_tile.png` | Seamlessly tileable page background (the only opaque file) | 256×256 |
| `rake.png`, `pitchfork.png` | Hero tools at the page edges, desktop only | ~55–85 × 160 |
| `grass_1.png`, `grass_2.png` | Grass tufts | 48×48 |
| `flower_1.png` | Flowering tuft | 48×48 |
| `stones.png` | Pebble cluster | 32×32 |

## Guidelines

- Props need an alpha channel; keep them tight to the sprite (no baked-in
  shadows or borders).
- Props render at 2× with `image-rendering: pixelated`, so art stays crisp at
  even multiples.
- New props: drop the PNG here, then add a `PropSpec` entry to `PROPS` in
  `PageBackdrop.tsx` with a position.
- The shop's `wood_planks.png` lives in `src/assets/ui/` (UI texture, not a
  backdrop prop).
```

- [ ] **Step 3: Run the full suite**

Run: `npm test && npm run lint`
Expected: PASS — SeedCard tests query by role/label, which the wrapper span doesn't change.

- [ ] **Step 4: Commit**

```bash
git add src/components/SeedCard.tsx src/assets/decor/README.md
git commit -m "feat(018): seed card inset icon frame + decor README"
```

---

### Task 7: Stage the art, verify visually, tune

**Files:**
- Stage: `src/assets/crops/*` (updated README + any resized art), `src/assets/decor/*`, `src/assets/ui/*`
- Possibly tune: `PROPS` in `src/components/PageBackdrop.tsx`, `backgroundSize` values

- [ ] **Step 1: Stage all asset files**

```bash
git add src/assets
git status   # confirm crops/, decor/, ui/ all staged, nothing unexpected
git commit -m "assets(018): crop sprites, decor props, soil + wood textures"
```

- [ ] **Step 2: Start the dev server preview**

Use the Browser pane (`preview_start` with a `.claude/launch.json` entry running `npm run dev` on port 5173 — create the launch config if missing). Never run the dev server via Bash.

- [ ] **Step 3: Desktop verification (1280×800)**

Check, fixing in source and re-checking as needed:
- Soil tile fills the page with no visible seams; rake (left edge) and pitchfork (right edge) visible in the margins beside the board/shop.
- Props sit *behind* the board and shop panels; nothing intercepts clicks (plant a seed to confirm).
- Shop panel and sign show wood-plank texture; awnings show 4 stripe colors with scalloped hem.
- Seed cards show sprites in their inset frames.
- Plant a radish and a pumpkin, advance days: plot sprites progress seedling → … → ready; HARVEST state shows the ready frame.
- Console: no errors (`read_console_messages`).

- [ ] **Step 4: Mobile verification (375×812)**

- Hero props hidden; soil + small tufts still visible where content leaves gaps.
- Shop bottom-sheet opens over the backdrop correctly; cards and BUY buttons unobstructed.

- [ ] **Step 5: Tune composition if needed**

Adjust `PROPS` positions/heights or `backgroundSize` (e.g. soil at `512px 512px` for chunkier pixels) based on what the preview shows. Re-check after each change (HMR applies edits live).

- [ ] **Step 6: Final full run and commit any tuning**

```bash
npm test && npm run lint
git add -A src/components
git commit -m "polish(018): backdrop composition tuning after visual pass"   # only if tuning happened
```

- [ ] **Step 7: Screenshot proof**

Take desktop + mobile screenshots of the final look (`computer {action: "screenshot"}`) and share them with the user.

---

## Self-review notes

- **Spec coverage:** crop art on plots (Task 4; shop already wired by 016 work), wood shop + sign + awning (Task 5), inset card frame (Task 6), PageBackdrop + registry + mobile behavior (Tasks 1–3), degradation (null-guards in Tasks 1–2, fallback branches in Task 5), README (Task 6), verification (Task 7). Out-of-scope items untouched.
- **Type consistency:** `getDecorUrl(name: string): string | null` and `woodPlanksUrl: string | null` used identically in Tasks 2 and 5; `SpriteStage`/`GrowthStage` mapping in Task 4 matches `cropSprites.ts` and `PlotCard.tsx` definitions.
- **Known judgment call:** `max-w-5xl` content constraint (Task 3) implements the spec's "props positioned along the viewport edges/margins" — without it, wide screens have no margins for the heroes. Flagged for the visual pass.
