/** WCAG 2.1 relative luminance and contrast ratio, with alpha compositing. */

type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ] as const;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Flattens a translucent foreground onto an opaque background. Tailwind's `/50`
 *  suffixes are alpha, and an un-composited ratio is meaninglessly optimistic. */
export function composite(fg: string, alpha: number, bg: string): Rgb {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return [0, 1, 2].map(i => Math.round(f[i] * alpha + b[i] * (1 - alpha))) as unknown as Rgb;
}

/** Contrast ratio of an (optionally translucent) foreground over a background. */
export function contrastRatio(fg: string, bg: string, alpha = 1): number {
  const a = luminance(composite(fg, alpha, bg));
  const b = luminance(hexToRgb(bg));
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
