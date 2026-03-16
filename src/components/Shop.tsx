import type { CropId, UpgradeTier } from '../engine/types';
import { UPGRADE_TIER_DEFINITIONS } from '../engine/constants';
import { SeedCard } from './SeedCard';
import { UpgradeCard } from './UpgradeCard';

const CROP_IDS: CropId[] = ['radish', 'parsnip', 'pumpkin'];

interface ShopProps {
  coinBalance: number;
  upgradeTier: UpgradeTier;
  seedInventory: Record<CropId, number>;
  getSeedPrice: (cropId: CropId) => number;
  onBuySeed: (cropId: CropId) => void;
  onBuyUpgrade: () => void;
  getNextUpgradeCost: () => number | null;
}

export function Shop({
  coinBalance,
  upgradeTier,
  seedInventory,
  getSeedPrice,
  onBuySeed,
  onBuyUpgrade,
  getNextUpgradeCost,
}: ShopProps) {
  const nextUpgradeCost = getNextUpgradeCost();

  return (
    <aside
      aria-label="Shop"
      className="
        flex flex-col gap-4 p-4 w-56 shrink-0
        bg-farm-soil rounded-lg
      "
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
