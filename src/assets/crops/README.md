# Crop sprites

Drop transparent-background pixel-art PNGs here. They're auto-discovered at
build time by `src/components/cropSprites.ts` (via `import.meta.glob`) — no
import list to update. A crop only needs the frames it actually reaches; any
missing frame degrades to the nearest earlier one (and to an emoji only if the
crop has no sprites at all), so partial sets are fine.

## Stages

Four ordered stages, smallest → harvest, matching the engine's growth model:

`seedling` → `sprout` → `mature` → `ready`

- `seedling` — just emerged, smallest
- `sprout` — a bit bigger, more leaves
- `mature` — full foliage, pre-harvest
- `ready` — the harvest frame (also the shop icon)

## Filenames — `<crop>_<stage>.png`

What each crop actually shows in normal play (extra stages only appear under the
Flash Drought disaster and fall back gracefully, so they're optional):

```
radish_mature.png    radish_ready.png                    (radish grows in 1 day)
parsnip_seedling.png parsnip_mature.png  parsnip_ready.png   (2 days)
pumpkin_seedling.png pumpkin_sprout.png  pumpkin_mature.png  pumpkin_ready.png  (3 days — all 4)
```

Optional drought-only frames (nice-to-have, else they reuse an earlier frame):
`radish_seedling.png`, `parsnip_sprout.png`.

## Guidelines

- Transparent background (alpha), no baked-in text labels.
- Portrait canvas, sprite centered horizontally, rooted at the bottom
  (32×64 — the current set's format; renders at exact 2× when shown 64px tall).
- For pumpkin's `ready`, prefer a compact single-pumpkin frame — a sprawling
  vine is unreadable at 36px in the shop.
