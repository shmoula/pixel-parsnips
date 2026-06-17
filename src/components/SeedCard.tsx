import type { CropId } from '../engine/types';
import { CROP_DEFINITIONS } from '../engine/constants';

const CROP_EMOJI: Record<CropId, string> = {
  radish: '🌱',
  parsnip: '🥕',
  pumpkin: '🎃',
};

const CROP_ACCENT: Record<CropId, string> = {
  radish:  '#3D7A2B',
  parsnip: '#C87820',
  pumpkin: '#C05010',
};

interface SeedCardProps {
  cropId: CropId;
  price: number;
  seedCount: number;
  onBuy: (cropId: CropId) => void;
  onSelect: (cropId: CropId) => void;
  canAfford: boolean;
  isSelected: boolean;
  /** Active market event for THIS crop, if any (drives the price-direction badge). */
  marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number };
}

/** Build the price-direction badge label, or null when there is no event. */
function formatMarketBadge(
  marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number },
): string | null {
  if (!marketEvent) return null;
  const pct = Math.round((marketEvent.multiplier - 1) * 100);
  const arrow = marketEvent.kind === 'shortage' ? '▲' : '▼';
  return `${arrow} ${pct >= 0 ? '+' : ''}${pct}%`;
}

export function SeedCard({
  cropId,
  price,
  seedCount,
  onBuy,
  onSelect,
  canAfford,
  isSelected,
  marketEvent,
}: SeedCardProps) {
  const crop = CROP_DEFINITIONS[cropId];
  const disabled = !canAfford;

  // T018a — net profit per seed after buy cost
  const netProfit = crop.baseYield - price;

  // G7 — price-direction badge for an active market event on this crop
  const marketLabel = formatMarketBadge(marketEvent);

  return (
    // T018c — active border: gold ring instead of grass
    <div
      className={[
        'flex flex-col gap-1 p-3 rounded-lg border transition-all',
        'bg-[#261808]',
        isSelected
          ? 'border-farm-gold ring-2 ring-farm-gold'
          : 'border-[#5C3D1E]/60',
      ].join(' ')}
      style={{ borderLeftColor: CROP_ACCENT[cropId], borderLeftWidth: '3px' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-lg">{CROP_EMOJI[cropId]}</span>
        {seedCount > 0 && (
          <span className="text-xs font-pixel bg-farm-grass text-farm-parchment px-1.5 py-0.5 rounded">
            ×{seedCount}
          </span>
        )}
        {marketLabel && (
          <span
            aria-label={`Market ${marketEvent!.kind}`}
            className={[
              'text-xs font-pixel px-1.5 py-0.5 rounded',
              marketEvent!.kind === 'shortage'
                ? 'bg-farm-grass/30 text-farm-grass'
                : 'bg-farm-red/30 text-farm-red',
            ].join(' ')}
          >
            {marketLabel}
          </span>
        )}
      </div>

      <p className="font-pixel text-xs text-farm-parchment/90">{crop.name}</p>

      <div className="text-xs text-farm-stone/80">
        <span>{crop.growthDays}d grow</span>
        <span className="mx-1">·</span>
        <span>{crop.baseYield}🪙 yield</span>
      </div>

      {/* T018b — estimated net profit display */}
      <p className="text-xs text-farm-grass font-pixel">
        Est. profit: +{netProfit}🪙
      </p>

      {/* T018d,e — BUY prefix + active:scale-95 press feedback */}
      <button
        type="button"
        aria-label={`Buy ${crop.name} seed for ${price} coins`}
        disabled={disabled}
        onClick={() => onBuy(cropId)}
        className="
          mt-1 w-full py-1 rounded font-pixel text-xs
          bg-farm-gold text-farm-ink
          hover:bg-farm-grass hover:text-farm-parchment
          active:scale-95 active:brightness-90
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all
        "
      >
        {canAfford ? `BUY ${price}🪙` : `Need ${price}🪙`}
      </button>

      {seedCount > 0 && (
        <button
          type="button"
          aria-label={`Select ${crop.name} seed to plant`}
          aria-pressed={isSelected}
          onClick={() => onSelect(cropId)}
          className={`
            w-full py-1 rounded font-pixel text-xs transition-colors
            ${isSelected
              ? 'bg-farm-grass text-farm-parchment'
              : 'bg-farm-sky text-farm-ink hover:bg-farm-grass hover:text-farm-parchment'}
          `}
        >
          {isSelected ? 'Planting ✓' : 'Plant'}
        </button>
      )}
    </div>
  );
}
