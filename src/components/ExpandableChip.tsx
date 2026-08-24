import type { ReactNode } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

/** Tailwind's `sm` breakpoint. Kept in step with the `sm:` variants in HUD.tsx. */
export const SM_QUERY = '(min-width: 640px)';

interface ExpandableChipProps {
  /** Current expanded state; only meaningful below `sm`. */
  expanded: boolean;
  onToggle: () => void;
  className: string;
  children: ReactNode;
  /** Native tooltip, applied in both modes. */
  title?: string;
  /** Accessible name for the interactive (narrow) mode. Omit where the visible
   *  compact text is already the name — an added prose label that does not contain
   *  the visible abbreviation trips axe's label-content-name-mismatch (WCAG 2.5.3). */
  ariaLabel?: string;
}

/**
 * 024 — a HUD chip whose expand-on-tap behaviour exists only below `sm`.
 *
 * At `sm` and up the chip's full labels always render, so the toggle changes
 * nothing — yet Tailwind Preflight gives every <button> `cursor: pointer`, so the
 * chip advertised a click that did nothing. Rendering a plain <div> there removes
 * the affordance and the handler together, while the narrow viewport (where the
 * toggle is how "D1/20" becomes "Season 1 · Spring Thaw") is untouched.
 */
export function ExpandableChip({
  expanded,
  onToggle,
  className,
  children,
  title,
  ariaLabel,
}: ExpandableChipProps) {
  const isDesktop = useMediaQuery(SM_QUERY);

  if (isDesktop) {
    return (
      <div className={className} title={title}>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={ariaLabel}
      title={title}
      onClick={onToggle}
      className={className}
    >
      {children}
    </button>
  );
}
