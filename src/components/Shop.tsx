import type { CropId, UpgradeTier } from '../engine/types';
import { UPGRADE_TIER_DEFINITIONS, FERTILIZER_COST } from '../engine/constants';
import { SeedCard } from './SeedCard';
import { UpgradeCard } from './UpgradeCard';

const CROP_IDS: CropId[] = ['radish', 'parsnip', 'pumpkin'];

interface ShopProps {
  coinBalance: number;
  upgradeTier: UpgradeTier;
  seedInventory: Record<CropId, number>;
  fertilizerInventory: number;
  getSeedPrice: (cropId: CropId) => number;
  onBuySeed: (cropId: CropId) => void;
  onBuyUpgrade: () => void;
  onBuyFertilizer: () => void;
  getNextUpgradeCost: () => number | null;
}

export function Shop({
  coinBalance,
  upgradeTier,
  seedInventory,
  fertilizerInventory,
  getSeedPrice,
  onBuySeed,
  onBuyUpgrade,
  onBuyFertilizer,
  getNextUpgradeCost,
}: ShopProps) {
  const nextUpgradeCost = getNextUpgradeCost();

  return (
    <aside
      aria-label="Shop"
      className="flex flex-col gap-4 p-4 bg-farm-soil rounded-lg"
    >
      <h2 className="font-pixel text-xs text-farm-gold">Shop</h2>

      {/* Seeds section */}
      <section aria-label="Seeds">
        <p className="font-pixel text-xs text-farm-stone mb-2">Seeds</p>
        <div className="flex flex-col gap-2">
          {CROP_IDS.map(cropId => {
            const price = getSeedPrice(cropId);
            return (
              <SeedCard
                key={cropId}
                cropId={cropId}
                price={price}
                seedCount={seedInventory[cropId]}
                onBuy={onBuySeed}
                canAfford={coinBalance >= price}
              />
            );
          })}
        </div>
      </section>

      {/* Fertilizer section */}
      <section aria-label="Fertilizer">
        <p className="font-pixel text-xs text-farm-stone mb-2">Supplies</p>
        <div className="flex flex-col gap-2">
          <div className="bg-farm-parchment rounded-lg p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <div>
                  <p className="font-pixel text-xs text-farm-ink">Fertilizer</p>
                  <p className="text-xs text-farm-stone">Restores an exhausted plot instantly</p>
                </div>
              </div>
              {fertilizerInventory > 0 && (
                <span className="bg-farm-grass text-farm-ink font-pixel text-xs px-1.5 py-0.5 rounded">
                  ×{fertilizerInventory}
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label={`Buy 1 Fertilizer for ${FERTILIZER_COST} coins`}
              aria-disabled={coinBalance < FERTILIZER_COST}
              disabled={coinBalance < FERTILIZER_COST}
              onClick={onBuyFertilizer}
              className="
                w-full font-pixel text-xs py-1.5 rounded
                bg-farm-gold text-farm-ink
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:enabled:brightness-110 transition-all
              "
            >
              {FERTILIZER_COST}🪙
            </button>
          </div>
        </div>
      </section>

      {/* Upgrades section */}
      <section aria-label="Tool upgrades">
        <p className="font-pixel text-xs text-farm-stone mb-2">Tools</p>
        <div className="flex flex-col gap-2">
          {UPGRADE_TIER_DEFINITIONS.map(def => {
            const isOwned = upgradeTier >= def.tier;
            const isNext = upgradeTier === def.tier - 1;
            return (
              <UpgradeCard
                key={def.tier}
                def={def}
                isOwned={isOwned}
                isNext={isNext}
                canAfford={nextUpgradeCost !== null && coinBalance >= nextUpgradeCost}
                onBuy={onBuyUpgrade}
              />
            );
          })}
        </div>
      </section>
    </aside>
  );
}
