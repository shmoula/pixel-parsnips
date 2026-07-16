import { describe, it, expect } from 'vitest';
import { getDecorUrl, woodPlanksUrl } from '../../src/components/decorAssets';

describe('decorAssets registry (018)', () => {
  it('resolves an existing decor prop to its asset URL', () => {
    const url = getDecorUrl('grass_1');
    expect(url).not.toBeNull();
    expect(url).toContain('grass_1');
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
