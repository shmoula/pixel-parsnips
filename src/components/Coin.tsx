interface CoinProps {
  /** Extra classes, e.g. a size override for larger icon contexts. */
  className?: string;
}

/**
 * Inline coin/token icon (🪙). Decorative — the number beside it carries the
 * meaning, so it's aria-hidden, and it gets a small left margin so it never
 * glues to the preceding number.
 *
 * Centring: Press Start 2P's digits sit high above the baseline and stop short
 * of it, while the emoji hangs low and renders a touch larger — so a plain
 * baseline/middle-aligned coin looks low and oversized (it overlaps the text).
 * Measuring both glyphs' painted pixels on a canvas: the emoji's visual centre
 * is ~0.185em below the digit centre at equal size, and the emoji is ~0.99em
 * tall vs the digits' ~0.88em cap. So shrink to ~0.9em (≈ cap height) and lift
 * ~0.25em to land the coin's painted centre on the digits' centre. Both values
 * are em-based, so this holds at caption/body/title sizes alike.
 */
export function Coin({ className = '' }: CoinProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block leading-none ml-1 ${className}`}
      style={{ fontSize: '0.9em', transform: 'translateY(-0.25em)' }}
    >
      🪙
    </span>
  );
}
