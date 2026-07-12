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
