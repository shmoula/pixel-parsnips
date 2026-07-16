import type { CropId } from '../engine/types';

/**
 * 016 — crop sprite registry.
 *
 * Drop transparent PNGs into `src/assets/crops/` named `<crop>_<stage>.png`
 * (e.g. `radish_ready.png`). They are auto-discovered at build time via
 * import.meta.glob — no manual import list to keep in sync. Any sprite that
 * isn't present simply resolves to null, and callers fall back to the existing
 * emoji, so the game renders correctly with zero, some, or all sprites in place.
 */
/**
 * Four ordered stages, matching the engine's internal growth model
 * (sprout → small → full → ready in getGrowthStage). Fast crops skip stages;
 * Flash Drought can push a crop through extra ones. Because a crop only supplies
 * the frames it actually reaches, resolution walks *backwards* to the nearest
 * available earlier frame (never forward — that would spoil the harvest look).
 */
export type SpriteStage = 'seedling' | 'sprout' | 'mature' | 'ready';

const STAGE_ORDER: SpriteStage[] = ['seedling', 'sprout', 'mature', 'ready'];

/**
 * Every crop frame is authored at these intrinsic dimensions — the tall frame
 * gives crops transparent headroom above a shared ground line. Callers size
 * sprites by height alone, so the width they must reserve is derived from this
 * ratio; `tests/components/cropSprites.assets.test.ts` fails the build if any
 * sprite is authored off-size.
 */
export const SPRITE_WIDTH = 32;
export const SPRITE_HEIGHT = 64;

const spriteUrls = import.meta.glob('../assets/crops/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const spriteMap: Record<string, string> = {};
for (const [path, url] of Object.entries(spriteUrls)) {
  const name = path.split('/').pop()?.replace(/\.png$/, '');
  if (name) spriteMap[name] = url;
}

/**
 * Resolve the sprite URL for a crop + stage. If that exact frame is missing,
 * fall back to the nearest earlier stage the crop does provide; returns null
 * only when the crop has no sprites at all (caller then uses an emoji).
 */
export function getCropSpriteUrl(cropId: CropId, stage: SpriteStage): string | null {
  const startIdx = STAGE_ORDER.indexOf(stage);
  for (let i = startIdx; i >= 0; i--) {
    const url = spriteMap[`${cropId}_${STAGE_ORDER[i]}`];
    if (url) return url;
  }
  return null;
}
