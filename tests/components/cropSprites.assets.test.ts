import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPRITE_HEIGHT, SPRITE_WIDTH } from '../../src/components/cropSprites';

const CROPS_DIR = join(__dirname, '../../src/assets/crops');

/** Intrinsic dimensions straight out of a PNG's IHDR chunk. */
function readPngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * CropSprite derives an img's width from SPRITE_WIDTH/SPRITE_HEIGHT instead of
 * measuring each file, so an off-size sprite would render squashed. Fail here
 * rather than in someone's eyes.
 */
describe('crop sprite assets', () => {
  const files = readdirSync(CROPS_DIR).filter((f) => f.endsWith('.png'));

  it('finds sprites to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is authored at the declared sprite size', (file) => {
    expect(readPngSize(join(CROPS_DIR, file))).toEqual({
      width: SPRITE_WIDTH,
      height: SPRITE_HEIGHT,
    });
  });
});
