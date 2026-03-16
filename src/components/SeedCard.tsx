import type { CropId } from '../engine/types';
import { CROP_DEFINITIONS } from '../engine/constants';

const CROP_EMOJI: Record<CropId, string> = {
  radish: '🌱',
  parsnip: '🥕',
  pumpkin: '🎃',
};

interface SeedCardProps {
  cropId: CropId;
  price: number;
  seedCount: number;
  onBuy: (cropId: CropId) => void;
  canAfford: boolean;
}

export function SeedCard({
  cropId,
  price,
  seedCount,
  onBuy,
  canAfford,
}: SeedCardProps) {
  const crop = CROP_DEFINITIONS[cropId];
  const disabled = !canAfford;

  return (
    <div className="flex flex-col gap-1 p-3 bg-farm-parchment rounded-lg border border-farm-stone">
      <div className="flex items-center justify-between">
        <span className="text-lg">{CROP_EMOJI[cropId]}</span>
        {seedCount > 0 && (
          <span className="text-xs font-pixel bg-farm-grass text-farm-parchment px-1.5 py-0.5 rounded">
            ×{seedCount}
          </span>
        )}
      </div>

      <p className="font-pixel text-xs text-farm-ink">{crop.name}</p>

      <div className="text-xs text-farm-stone">
        <span>{crop.growthDays}d grow</span>
        <span className="mx-1">·</span>
        <span>{crop.baseYield}🪙 yield</span>
      </div>

      <button
        type="button"
        aria-label={`Buy ${crop.name} seed for ${price} coins`}
        disabled={disabled}
        onClick={() => onBuy(cropId)}
        className="
          mt-1 w-full py-1 rounded font-pixel text-xs
          bg-farm-gold text-farm-ink
          hover:bg-farm-grass hover:text-farm-parchment
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-colors
        "
      >
        {canAfford ? `${price}🪙` : `Need ${price}🪙`}
      </button>
    </div>
  );
}
