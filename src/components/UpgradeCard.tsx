import type { UpgradeTierDefinition } from '../engine/types';

interface UpgradeCardProps {
  def: UpgradeTierDefinition;
  isOwned: boolean;
  isNext: boolean;
  canAfford: boolean;
  onBuy: () => void;
}

export function UpgradeCard({
  def,
  isOwned,
  isNext,
  canAfford,
  onBuy,
}: UpgradeCardProps) {
  const discountPct = Math.round(def.cumulativeDiscount * 100);

  if (isOwned) {
    return (
      <div className="flex items-center justify-between p-2 rounded bg-farm-grass/20 border border-farm-grass">
        <div>
          <p className="font-pixel text-xs text-farm-ink">{def.label}</p>
          <p className="text-xs text-farm-stone">−{discountPct}% seeds</p>
        </div>
        <span className="font-pixel text-xs text-farm-grass">Owned ✓</span>
      </div>
    );
  }

  if (isNext) {
    return (
      <div className="flex items-center justify-between p-2 rounded bg-farm-parchment border border-farm-stone">
        <div>
          <p className="font-pixel text-xs text-farm-ink">{def.label}</p>
          <p className="text-xs text-farm-stone">−{discountPct}% seeds</p>
        </div>
        <button
          type="button"
          aria-label={`Buy ${def.label} upgrade for ${def.cost} coins`}
          disabled={!canAfford}
          onClick={onBuy}
          className="
            px-2 py-1 rounded font-pixel text-xs
            bg-farm-gold text-farm-ink
            hover:bg-farm-grass hover:text-farm-parchment
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {def.cost}🪙
        </button>
      </div>
    );
  }

  // Future tier — dimmed
  return (
    <div className="flex items-center justify-between p-2 rounded bg-farm-parchment border border-farm-stone opacity-40">
      <div>
        <p className="font-pixel text-xs text-farm-ink">{def.label}</p>
        <p className="text-xs text-farm-stone">−{discountPct}% seeds</p>
      </div>
      <span className="font-pixel text-xs text-farm-stone">{def.cost}🪙</span>
    </div>
  );
}
