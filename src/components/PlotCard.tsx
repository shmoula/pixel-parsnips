import type { PlotState } from '../engine/types';
import { EXHAUSTION_RECOVERY_DAYS } from '../engine/constants';

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
  currentDay?: number;
  fertilizerInventory?: number;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
}

function ExhaustedPlot({ plot, daysUntilRecovery, hasFertilizer, onApplyFertilizer }: {
  plot: PlotState;
  daysUntilRecovery: number;
  hasFertilizer: boolean;
  onApplyFertilizer?: (plotId: number) => void;
}) {
  return (
    <div
      aria-label={`Plot ${plot.id + 1}: Exhausted — ${daysUntilRecovery} day${daysUntilRecovery === 1 ? '' : 's'} until recovery`}
      className="
        flex flex-col items-center justify-center
        w-full aspect-square rounded-lg border-2
        border-farm-stone bg-farm-parchment
        select-none p-1
      "
    >
      <span className="text-2xl">🪨</span>
      <span className="text-xs font-pixel text-farm-stone mt-1">Exhausted</span>
      <span className="text-xs font-pixel text-farm-stone mt-0.5">
        {daysUntilRecovery}d remaining
      </span>
      {hasFertilizer ? (
        <button
          type="button"
          aria-label="Use Fertilizer on this plot"
          onClick={() => onApplyFertilizer?.(plot.id)}
          className="
            mt-1 font-pixel text-xs px-1.5 py-0.5 rounded
            bg-farm-grass text-farm-ink
            hover:brightness-110 transition-all cursor-pointer
          "
        >
          Use Fertilizer
        </button>
      ) : (
        <span className="text-xs text-farm-stone mt-0.5 text-center px-1">
          Buy Fertilizer in the shop
        </span>
      )}
    </div>
  );
}

export function PlotCard({ plot, currentDay = 1, fertilizerInventory = 0, onPlant, onApplyFertilizer }: PlotCardProps) {
  if (plot.exhaustedSinceDay !== null) {
    return (
      <ExhaustedPlot
        plot={plot}
        daysUntilRecovery={EXHAUSTION_RECOVERY_DAYS - (currentDay - plot.exhaustedSinceDay)}
        hasFertilizer={fertilizerInventory > 0}
        onApplyFertilizer={onApplyFertilizer}
      />
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
