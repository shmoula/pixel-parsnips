import type { PlotState } from '../engine/types';

const CROP_EMOJI: Record<string, string> = {
  radish:  '🌱',
  parsnip: '🥕',
  pumpkin: '🎃',
};

const CROP_LABEL: Record<string, string> = {
  radish:  'Radish',
  parsnip: 'Parsnip',
  pumpkin: 'Pumpkin',
};

interface PlotCardProps {
  plot: PlotState;
  onPlant?: (plotId: number) => void;
}

export function PlotCard({ plot, onPlant }: PlotCardProps) {
  if (plot.exhaustedSinceDay !== null) {
    return (
      <div
        role="img"
        aria-label={`Plot ${plot.id + 1}: Exhausted — cannot plant`}
        className="
          flex flex-col items-center justify-center
          w-full aspect-square rounded-lg border-2
          border-farm-stone bg-farm-parchment
          select-none
        "
      >
        <span className="text-2xl">🪨</span>
        <span className="text-xs font-pixel text-farm-stone mt-1">Exhausted</span>
        <span className="text-xs text-farm-stone mt-0.5 text-center px-1">
          Wait or buy Fertilizer in the shop
        </span>
      </div>
    );
  }

  const isEmpty = plot.cropId === null;

  if (isEmpty) {
    return (
      <button
        type="button"
        aria-label={`Empty plot ${plot.id + 1} — click to plant`}
        onClick={() => onPlant?.(plot.id)}
        className="
          flex flex-col items-center justify-center
          w-full aspect-square rounded-lg border-2 border-dashed
          border-farm-stone bg-farm-parchment text-farm-stone
          hover:border-farm-grass hover:text-farm-grass
          transition-colors cursor-pointer select-none
        "
      >
        <span className="text-2xl">🟫</span>
        <span className="text-xs mt-1 font-pixel">Empty</span>
      </button>
    );
  }

  const emoji = CROP_EMOJI[plot.cropId!];
  const label = CROP_LABEL[plot.cropId!];
  const daysLeft = plot.daysRemaining ?? 0;
  const isReady = daysLeft === 0;

  return (
    <div
      role="img"
      aria-label={`Plot ${plot.id + 1}: ${label}, planted day ${plot.dayPlanted}, ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
      className="
        flex flex-col items-center justify-center
        w-full aspect-square rounded-lg border-2
        border-farm-grass bg-farm-parchment
        select-none
      "
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs font-pixel text-farm-ink mt-1">{label}</span>
      <span className="text-xs text-farm-stone mt-0.5">
        Day {plot.dayPlanted}
      </span>
      <span
        className={`
          text-xs font-pixel mt-1 px-1.5 py-0.5 rounded
          ${isReady
            ? 'bg-farm-gold text-farm-ink'
            : 'bg-farm-sky text-farm-ink'}
        `}
      >
        {isReady ? 'Ready!' : `${daysLeft}d left`}
      </span>
    </div>
  );
}
