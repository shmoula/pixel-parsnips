import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 029 — 028 swept hardcoded hex *literals* into PALETTE, but Tailwind's default
 * colour classes are names, not hex, so `border-yellow-600/70` and
 * `text-yellow-300` survived it — and `palette.contrast.test.ts` could not see
 * them either. They were why the low-balance border read as a style
 * inconsistency rather than a warning. This test closes that hole for good.
 */
const TAILWIND_DEFAULT_HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose',
];
const OFF_PALETTE = new RegExp(
  `(?:^|[\\s"'\`:!\\]])(?:border(?:-[tblrxy])?|text|bg|ring(?:-offset)?|from|via|to|fill|stroke|shadow|outline|decoration|divide(?:-[xy])?|accent|caret|placeholder)-(?:${TAILWIND_DEFAULT_HUES.join('|')})-\\d{2,3}`,
);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('no off-palette colours', () => {
  const files = walk(join(__dirname, '../../src')).filter((f) => /\.(tsx?|css)$/.test(f));

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s uses only farm-* colour classes', (file) => {
    const offenders = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => OFF_PALETTE.test(line));
    expect(offenders.map((o) => `${file}:${o.n} ${o.line.trim()}`)).toEqual([]);
  });
});
