# Backdrop decor

Transparent-background pixel art for the full-page backdrop
(`src/components/PageBackdrop.tsx`). Auto-discovered at build time by
`src/components/decorAssets.ts` (via `import.meta.glob`, matching `.png` and
`.webp`) — no import list to update. Every file is optional: a missing prop
simply doesn't render, and a missing `soil_tile` falls back to the flat page
colour.

## Files

| File | Role | Size |
|---|---|---|
| `soil_tile.webp` | Seamlessly tileable page background (the only opaque file) | 256×256 |
| `grass_1.png`, `grass_2.png` | Grass tufts | 48×48 |
| `flower_1.png` | Flowering tuft | 48×48 |
| `stones.png` | Pebble cluster | 32×32 |

## Guidelines

- Props need an alpha channel; keep them tight to the sprite (no baked-in
  shadows or borders).
- Props render at 2× with `image-rendering: pixelated`, so art stays crisp at
  even multiples.
- New props: drop the file here, then add a `PropSpec` entry to `PROPS` in
  `PageBackdrop.tsx` with a position.
- Prefer PNG for small flat-palette props (it beats WebP on those) and WebP for
  large detailed textures like `soil_tile`, which is lossy q90 — its noise makes
  lossless WebP *larger* than the PNG. Sprites with hard pixel edges stay
  lossless.
- The shop's `wood_planks.webp` lives in `src/assets/ui/` (UI texture, not a
  backdrop prop).
