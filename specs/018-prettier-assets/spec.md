# 018 — Prettier Assets: crop art, wooden shop, illustrated backdrop

**Status:** Approved design, pre-implementation
**Date:** 2026-07-06
**Builds on:** unstaged 016 work (crop sprite registry + shop dressing) already in the working tree

## Goal

Bring the game's visuals closer to the reference screenshots: polished pixel-art
crop icons, a wooden-textured market-stall shop, and an illustrated dark-soil
page backdrop with scattered farm props (rake, pitchfork, grass, stones).

Purely presentational — no engine, state, or localStorage schema changes.

## Decisions (from brainstorm)

- **Art source:** the user provides all pixel-art PNGs (AI-generated to match
  the reference screenshots). Code integrates them; nothing is hand-drawn in
  CSS/SVG except the refined awning.
- **Crop art:** full replacement of all growth-stage sprites for all 3 crops
  (shop icon = the `ready` frame, as today).
- **Backdrop:** full-page illustrated backdrop (option C) built from layered
  props (approach 1) — tileable soil texture + individually positioned prop
  PNGs, not pre-composed strips.
- **Shop:** PNG wood-plank texture for the panel; awning/ledge stay CSS but the
  awning gains a 4-color stripe sequence.
- **Scope:** shop + crop sprites + page backdrop only. HUD, bottom action bar,
  and modals are untouched (possible follow-up).

## Asset manifest (user-provided)

All transparent-background pixel-art PNGs. **Every asset is optional** — any
missing file degrades to the current look, so art can land in batches with no
code changes.

### Crops — `src/assets/crops/` (existing folder, existing filenames)

Replace: `radish_mature`, `radish_ready`, `parsnip_seedling`, `parsnip_mature`,
`parsnip_ready`, `pumpkin_seedling`, `pumpkin_sprout`, `pumpkin_mature`,
`pumpkin_ready` (+ optional drought-only `radish_seedling`, `parsnip_sprout`).
64×64, sprite centered, no baked-in text — per the folder README.

### Shop — `src/assets/ui/`

| File | Spec |
|---|---|
| `wood_planks.png` | Seamlessly tileable wood-plank texture, 128×128 or 256×256, dark brown |

### Backdrop — `src/assets/decor/` (new folder, gets its own README)

| File | Spec |
|---|---|
| `soil_tile.png` | Seamlessly tileable dark tilled soil, ~256×256, low-contrast (sits behind everything) |
| `rake.png` | Hero prop, ~96–160px tall |
| `pitchfork.png` | Hero prop, ~96–160px tall |
| `grass_1.png`, `grass_2.png` | Small grass-tuft variants, ~32–48px |
| `flower_1.png` | Small flowering tuft, ~48px |
| `stones.png` | Small pebble cluster, ~32px |

## Components

### `PageBackdrop` (new)

- Rendered once in `GameBoard`, `fixed inset-0`, behind all content;
  `pointer-events-none` + `aria-hidden="true"`.
- Soil tile repeats across the full page; missing tile falls back to the
  current `#140E06` page color.
- Props are absolutely positioned by code along the viewport edges/margins,
  asymmetric composition (rake upper region, pitchfork lower, grass and stones
  scattered at edges). Rendered at 2× with `image-rendering: pixelated`.
- Narrow viewports (below `md`): hero props hidden, only soil + small tufts
  remain (content fills the width on mobile).
- Asset discovery mirrors `cropSprites.ts` (`import.meta.glob` over
  `src/assets/decor/*.png`); a missing prop simply doesn't render.

### Shop panel (`Shop.tsx`)

- Panel background: tiling `wood_planks.png` with the existing dark gradient
  retained on top as a shading overlay (keeps card contrast).
- `SignHeader`: keeps carved shape + corner nails, gains the wood texture fill.
- `Awning`: stays CSS; stripe sequence goes from 2 colors to 4
  (green / cream / rust / brown), keeping the scalloped hem mask and the
  out-of-phase scallop/stripe periods.
- `ShelfLedge`: unchanged.

### Seed cards (`SeedCard.tsx`)

- Keep the unstaged tinted-card work: per-crop themes (radish red, parsnip
  green, pumpkin orange), gold border + ring when selected, text shadow for
  legibility.
- One refinement: the crop sprite sits in an inset frame — a slightly darker
  rounded inner panel — so the icon reads as an item on display.
- Name, stats, est. profit, and seed-count badge unchanged; color is never the
  sole signal.

## Degradation & accessibility

- All decoration is `aria-hidden` + `pointer-events-none`; nothing enters the
  accessibility tree or intercepts taps.
- Missing assets degrade piecewise to today's rendering (crop sprites already
  fall back to emoji via `CropSprite`).

## Testing & verification

- `npm test && npm run lint` stays green; no behavioral changes expected.
- Visual verification in the dev-server preview at mobile (375px) and desktop
  widths, including the mobile shop bottom-sheet and dark-soil contrast.
- Implementation lands first against current/placeholder art; the asset
  manifest above is the handoff list — art drops in with zero further code
  changes.

## Out of scope

- HUD, bottom action bar, modals, onboarding overlay styling.
- Animations or juice (existing disaster/harvest effects untouched).
- Any engine, balance, or persistence change.
