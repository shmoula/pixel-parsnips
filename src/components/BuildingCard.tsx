import type { BuildingDefinition, BuildingId } from '../engine/types';
import { Coin } from './Coin';

interface BuildingCardProps {
  def: BuildingDefinition;
  owned: boolean;
  canAfford: boolean;
  onBuy: (id: BuildingId) => void;
}

export function BuildingCard({ def, owned, canAfford, onBuy }: BuildingCardProps) {
  // Owned buildings (Active Buffs section): same card as the shop shelf,
  // minus the buy button, tinted grass to signal the buff is active.
  if (owned) {
    return (
      <div className="bg-farm-grass/20 rounded-lg p-3 flex flex-col gap-1 border border-farm-grass/40">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">{def.emoji}</span>
          <div>
            <p className="font-pixel text-body text-farm-parchment">{def.name}</p>
            <p className="text-body text-farm-stone">{def.description}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#261808] rounded-lg p-3 flex flex-col gap-1 border border-[#5C3D1E]/60">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">{def.emoji}</span>
        <div>
          <p className="font-pixel text-body text-farm-parchment/90">{def.name}</p>
          <p className="text-body text-farm-stone">{def.description}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Buy ${def.name} for ${def.cost} coins`}
        disabled={!canAfford}
        onClick={() => onBuy(def.id)}
        className="
          w-full font-pixel text-body py-1.5 min-h-[44px] md:min-h-0 rounded
          bg-farm-gold text-farm-ink
          hover:enabled:bg-farm-grass hover:enabled:text-farm-parchment
          active:enabled:scale-95 transition-all
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        {def.cost}<Coin />
      </button>
    </div>
  );
}
