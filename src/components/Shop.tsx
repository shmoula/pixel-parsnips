import type { CropId, UpgradeTier, GameState, ActiveMarketEvent } from '../engine/types';
import { Coin } from './Coin';
import { UPGRADE_TIER_DEFINITIONS, FERTILIZER_COST } from '../engine/constants';
import { SeedCard } from './SeedCard';
import { UpgradeCard } from './UpgradeCard';

const CROP_IDS: CropId[] = ['radish', 'parsnip', 'pumpkin'];

/**
 * 016 — market-stall dressing. All three are purely decorative: `aria-hidden` +
 * `pointer-events-none` so they never intercept a tap meant for a BUY button
 * (the web analogue of raycastTarget=false — sharp_edges.md → touch-target-too-small).
 */

/**
 * Striped cloth awning with a scalloped hem that caps each shelf. The scallop tile
 * (13px) is deliberately out of phase with the stripe period (22px) so the notches
 * read as a continuous wavy hem rather than slicing the cloth into separate pennants.
 */
function Awning() {
  const scallop =
    'radial-gradient(circle 4px at 6.5px 100%, transparent 4px, #000 4.5px)';
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none h-5 mb-2 rounded-t-sm"
      style={{
        background:
          'repeating-linear-gradient(90deg, #3F7D30 0 11px, #E8D9A8 11px 22px)',
        WebkitMaskImage: scallop,
        WebkitMaskSize: '13px 100%',
        WebkitMaskRepeat: 'repeat-x',
        maskImage: scallop,
        maskSize: '13px 100%',
        maskRepeat: 'repeat-x',
      }}
    />
  );
}

/** Thin wooden ledge closing off the bottom of a shelf. */
function ShelfLedge() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none h-1.5 mt-2 rounded-sm"
      style={{
        background: 'linear-gradient(#7A4E24, #3D2410)',
        boxShadow: '0 2px 3px rgba(0,0,0,0.45)',
      }}
    />
  );
}

/** Carved wooden shop sign with corner nails. */
function SignHeader() {
  return (
    <div
      className="relative rounded-md border-2 py-2.5 text-center"
      style={{
        backgroundColor: '#5A3A1E',
        borderColor: '#3D2410',
        boxShadow:
          'inset 0 2px 0 rgba(255,255,255,0.08), inset 0 -4px 6px rgba(0,0,0,0.4)',
      }}
    >
      <h2
        className="font-pixel text-xs text-farm-gold"
        style={{ textShadow: '0 2px 2px rgba(0,0,0,0.6)' }}
      >
        Shop
      </h2>
      {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map(
        pos => (
          <span
            key={pos}
            aria-hidden="true"
            className={`absolute ${pos} w-1.5 h-1.5 rounded-full`}
            style={{
              background: '#2A1808',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)',
            }}
          />
        ),
      )}
    </div>
  );
}

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
  marketActive: ActiveMarketEvent | null;
  dimNonRadish?: boolean;
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
  marketActive,
  dimNonRadish,
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
      <SignHeader />

      {/* Seeds section */}
      <section aria-label="Seeds">
        <Awning />
        <p className="font-pixel text-[9px] text-farm-gold/60 tracking-widest uppercase mb-2">Seeds</p>
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
                marketEvent={
                  marketActive && marketActive.cropId === cropId
                    ? { kind: marketActive.kind, multiplier: marketActive.multiplier }
                    : undefined
                }
                dimmed={dimNonRadish === true && cropId !== 'radish'}
                interactionDisabled={dimNonRadish === true && cropId !== 'radish'}
              />
            );
          })}
        </div>
        <ShelfLedge />
      </section>

      {/* Fertilizer section */}
      <section aria-label="Fertilizer">
        <Awning />
        <p className="font-pixel text-[9px] text-farm-gold/60 tracking-widest uppercase mb-2">Supplies</p>
        <div className="flex flex-col gap-2">
          <div className="bg-[#261808] rounded-lg p-3 flex flex-col gap-1 border border-[#5C3D1E]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🌿</span>
                <div>
                  <p className="font-pixel text-body text-farm-parchment/90">Fertilizer</p>
                  <p className="text-body text-farm-stone">Restores an exhausted plot instantly</p>
                </div>
              </div>
              {fertilizerInventory > 0 && (
                <span className="bg-farm-grass text-farm-ink font-pixel text-body px-1.5 py-0.5 rounded">
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
                w-full font-pixel text-body py-1.5 min-h-[44px] md:min-h-0 rounded
                bg-farm-gold text-farm-ink
                hover:enabled:bg-farm-grass hover:enabled:text-farm-parchment
                active:enabled:scale-95 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {FERTILIZER_COST}<Coin />
            </button>
          </div>
        </div>
        <ShelfLedge />
      </section>

      {/* T020b — Active Buffs tray: only shown when at least one tool is owned */}
      {ownedTiers.length > 0 && (
        <section aria-label="Active Buffs">
          <p className="font-pixel text-caption text-farm-gold/60 tracking-widest uppercase mb-2">Active Buffs</p>
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
          <Awning />
          <p className="font-pixel text-[9px] text-farm-gold/60 tracking-widest uppercase mb-2">Tools</p>
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
          <ShelfLedge />
        </section>
      )}
    </aside>
  );
}
