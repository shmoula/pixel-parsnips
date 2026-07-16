import type { ReactNode } from 'react';

/**
 * Optical-centre correction for an emoji sitting inline with pixel text.
 *
 * Press Start 2P paints entirely *above* the alphabetic baseline (at 12px its ink
 * runs from -12px to -1.5px), while the emoji fallback font straddles it (-13px to
 * +4px). Laid out on the shared baseline, the emoji's optical centre lands 0.1875em
 * below the text's, so it reads as "not vertically centred".
 *
 * 0.1875em is measured from painted pixels (canvas actualBoundingBox ink metrics)
 * and holds across the 10-20px range every banner uses.
 */
const OPTICAL_LIFT = '-translate-y-[0.1875em]';

/** Decorative emoji lifted onto the optical centre of adjacent pixel text. */
export function EmojiIcon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block ${OPTICAL_LIFT} ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}
