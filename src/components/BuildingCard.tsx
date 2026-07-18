import type { BuildingDefinition, BuildingId } from '../engine/types';
import { Coin } from './Coin';

interface BuildingCardProps {
  def: BuildingDefinition;
  owned: boolean;
  canAfford: boolean;
  onBuy: (id: BuildingId) => void;
}

export function BuildingCard({ def, owned, canAfford, onBuy }: BuildingCardProps) {
  // Compact tray-item style for owned buildings (Active Buffs section)
  if (owned) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded bg-farm-grass/20 border border-farm-grass/40">
        <span aria-hidden="true" className="text-farm-grass text-body">✓</span>
        <span aria-hidden="true" className="text-body">{def.emoji}</span>
        <p className="font-pixel text-body text-farm-parchment">{def.name}</p>
        <p className="text-body text-farm-stone ml-auto">{def.description}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded bg-farm-parchment border border-farm-stone">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="text-lg leading-none mt-0.5">{def.emoji}</span>
        <div>
          <p className="font-pixel text-body text-farm-ink">{def.name}</p>
          <p className="text-body text-farm-stone">{def.description}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Buy ${def.name} for ${def.cost} coins`}
        disabled={!canAfford}
        onClick={() => onBuy(def.id)}
        className="
          px-2 py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-body
          bg-farm-gold text-farm-ink
          hover:bg-farm-grass hover:text-farm-parchment
          active:scale-95 active:brightness-90
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all shrink-0
        "
      >
        {def.cost}<Coin />
      </button>
    </div>
  );
}
