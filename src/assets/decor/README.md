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
