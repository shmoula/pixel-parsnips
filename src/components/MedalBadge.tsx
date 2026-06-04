import { MEDAL_LABELS, MEDAL_TAGLINES, type Medal } from '../engine/medals';

interface MedalBadgeProps {
  medal: Medal;
}

/** Tailwind class slices per tier — palette reuses existing farm-* tokens. */
const RING_CLASS: Record<Medal, string> = {
  none:     'bg-farm-ink border-farm-stone/40 text-farm-stone',
  bronze:   'bg-farm-ink border-farm-red text-farm-red',
  silver:   'bg-farm-ink border-farm-parchment text-farm-parchment',
  gold:     'bg-farm-ink border-farm-gold text-farm-gold',
  platinum: 'bg-farm-ink border-farm-grass text-farm-grass',
};

const ICON: Record<Medal, string> = {
  none:     '·',
  bronze:   '🥉',
  silver:   '🥈',
  gold:     '🥇',
  platinum: '🏆',
};

export function MedalBadge({ medal }: MedalBadgeProps) {
  const label = MEDAL_LABELS[medal];
  const tagline = MEDAL_TAGLINES[medal];
  const ariaLabel = medal === 'none'
    ? 'No medal — keep going'
    : `${label} medal — ${tagline}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label={ariaLabel}
        className={`
          w-16 h-16 rounded-full border-4 flex items-center justify-center
          font-pixel text-2xl
          ${RING_CLASS[medal]}
        `}
      >
        <span aria-hidden="true">{ICON[medal]}</span>
      </div>
      <div className="text-center">
        <div className="font-pixel text-sm">{label}</div>
        <div className="font-pixel text-[10px] text-farm-stone">{tagline}</div>
      </div>
    </div>
  );
}
