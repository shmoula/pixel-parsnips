import type { CropId, UpgradeTier, GameState } from '../engine/types';
import { UPGRADE_TIER_DEFINITIONS, FERTILIZER_COST } from '../engine/constants';
import { SeedCard } from './SeedCard';
import { UpgradeCard } from './UpgradeCard';

const CROP_IDS: CropId[] = ['radish', 'parsnip', 'pumpkin'];

interface ShopProps {
  coinBalance: number;
  upgradeTier: UpgradeTier;
  seedInventory: GameState['seedInventory'];
  fertilizerInventory: number;
  selectedCrop: CropId | null;
  getSeedPrice: (cropId: CropId) => number;
  onBuySeed: (cropId: CropId) => void;
  onSelectCrop: (cropId: CropId) => void;
  onBuyUpgrade: () => void;
  onBuyFertilizer: () => void;
  getNextUpgradeCost: () => number | null;
}

export function Shop({
  coinBalance,
  upgradeTier,
  seedInventory,
  fertilizerInventory,
  selectedCrop,
  getSeedPrice,
  onBuySeed,
  onSelectCrop,
  onBuyUpgrade,
  onBuyFertilizer,
  getNextUpgradeCost,
}: ShopProps) {
  const nextUpgradeCost = getNextUpgradeCost();

  // T020 — split upgrade tiers into owned / next purchasable / future locked
  const ownedTiers = UPGRADE_TIER_DEFINITIONS.filter(d => upgradeTier >= d.tier);
  const nextTier = UPGRADE_TIER_DEFINITIONS.find(d => upgradeTier === d.tier - 1);
  const futureTiers = UPGRADE_TIER_DEFINITIONS.filter(d => upgradeTier < d.tier - 1);

  return (
    // T021 — wood-grain texture on sidebar wrapper
    <aside
      aria-label="Shop"
      className="flex flex-col gap-4 p-4 rounded-lg"
      style={{
        background: [
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 8px)',
          '#4A2F1A',
        ].join(', '),
      }}
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
                onSelect={onSelectCrop}
                canAfford={coinBalance >= price}
                isSelected={selectedCrop === cropId}
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

      {/* T020b — Active Buffs tray: only shown when at least one tool is owned */}
      {ownedTiers.length > 0 && (
        <section aria-label="Active Buffs">
          <p className="font-pixel text-xs text-farm-stone mb-2">Active Buffs</p>
          <div className="flex flex-col gap-1">
            {ownedTiers.map(def => (
              <UpgradeCard
                key={def.tier}
                def={def}
                isOwned={true}
                isNext={false}
                canAfford={false}
                onBuy={() => {}}
              />
            ))}
          </div>
        </section>
      )}

      {/* T020c — Tools section: next purchasable + future locked only (no owned tiers) */}
      {(nextTier !== undefined || futureTiers.length > 0) && (
        <section aria-label="Tool upgrades">
          <p className="font-pixel text-xs text-farm-stone mb-2">Tools</p>
          <div className="flex flex-col gap-2">
            {nextTier && (
              <UpgradeCard
                key={nextTier.tier}
                def={nextTier}
                isOwned={false}
                isNext={true}
                canAfford={nextUpgradeCost !== null && coinBalance >= nextUpgradeCost}
                onBuy={onBuyUpgrade}
              />
            )}
            {futureTiers.map(def => (
              <UpgradeCard
                key={def.tier}
                def={def}
                isOwned={false}
                isNext={false}
                canAfford={false}
                onBuy={() => {}}
              />
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
