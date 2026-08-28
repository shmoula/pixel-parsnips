import type { CropId, GameState, ActiveMarketEvent, BuildingId } from '../engine/types';
import { Coin } from './Coin';
import { FERTILIZER_COST } from '../engine/constants';
import { SeedCard } from './SeedCard';
import { BuildingCard } from './BuildingCard';
import { woodPlanksUrl } from './decorAssets';
import type { BuildingCardData } from '../engine/useGameEngine';
import { PALETTE } from '../theme/palette';

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
        // 018 — market-stall cloth: green / cream / rust / brown (44px period,
        // still out of phase with the 13px scallop tile).
        background:
          `repeating-linear-gradient(90deg, ${PALETTE.awningGreen} 0 11px, ${PALETTE.awningCream} 11px 22px, ${PALETTE.awningRust} 22px 33px, ${PALETTE.awningBrown} 33px 44px)`,
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
        background: `linear-gradient(${PALETTE.shopLedge}, ${PALETTE.shopSignBorder})`,
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
        backgroundColor: PALETTE.shopSign,
        // 018 — wood texture under a darker wash than the panel, so the sign
        // still reads as a separate carved board.
        ...(woodPlanksUrl
          ? {
              backgroundImage: [
                'linear-gradient(rgba(30,16,6,0.45), rgba(30,16,6,0.45))',
                `url(${woodPlanksUrl})`,
              ].join(', '),
              backgroundSize: 'auto, 128px 128px',
              backgroundRepeat: 'repeat',
              imageRendering: 'pixelated' as const,
            }
          : {}),
        borderColor: PALETTE.shopSignBorder,
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
              background: PALETTE.shopStud,
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
  seedInventory: GameState['seedInventory'];
  fertilizerInventory: number;
  selectedCrop: CropId | null;
  getSeedPrice: (cropId: CropId) => number;
  /** Owned-building yield factor (Farm Stand = 1.1, else 1) folded into each card's stats. */
  seedYieldMultiplier: number;
  onBuySeed: (cropId: CropId) => void;
  onSelectCrop: (cropId: CropId) => void;
  onBuyFertilizer: () => void;
  marketActive: ActiveMarketEvent | null;
  dimNonRadish?: boolean;
  buildingCards: BuildingCardData[];
  onBuyBuilding: (id: BuildingId) => void;
}

export function Shop({
  coinBalance,
  seedInventory,
  fertilizerInventory,
  selectedCrop,
  getSeedPrice,
  seedYieldMultiplier,
  onBuySeed,
  onSelectCrop,
  onBuyFertilizer,
  marketActive,
  dimNonRadish,
  buildingCards,
  onBuyBuilding,
}: ShopProps) {
  // Owned + purchasable buildings share one shelf, in definition order, so a
  // building keeps its slot after purchase (it just swaps to the owned layout).
  const shelfBuildings = buildingCards.filter(c => c.owned || c.unlocked);
  const lockedBuildings = buildingCards.filter(c => !c.owned && !c.unlocked);
  const hasLockedBuildings = lockedBuildings.length > 0;
  // The earliest season any still-locked building becomes available.
  const nextBuildingSeason = hasLockedBuildings
    ? Math.min(...lockedBuildings.map(c => c.def.unlockSeason))
    : 0;

  return (
    // T021 — wood-grain texture on sidebar wrapper
    // 018 — real wood-plank texture with a dark wash so cards keep contrast;
    // falls back to the previous CSS grain when the texture PNG is absent.
    <aside
      aria-label="Shop"
      className="flex flex-col gap-4 p-4 rounded-lg"
      style={
        woodPlanksUrl
          ? {
              backgroundImage: [
                'linear-gradient(rgba(20,10,4,0.35), rgba(20,10,4,0.35))',
                `url(${woodPlanksUrl})`,
              ].join(', '),
              backgroundSize: 'auto, 128px 128px',
              backgroundRepeat: 'repeat',
              imageRendering: 'pixelated',
            }
          : {
              background: [
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 8px)',
                // Decorative fallback stripe — intentionally its own token, not PALETTE.soil.
                // Keeping PALETTE.awningFallback as a separate token (rather than aliasing it
                // to soil) decouples this awning from the soil token, so it doesn't recolour
                // when `soil` changes; after the 025 palette lift (soil is now #5E3D22) this
                // value deliberately no longer matches soil.
                PALETTE.awningFallback,
              ].join(', '),
            }
      }
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
                yieldMultiplier={seedYieldMultiplier}
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
          <div className="bg-farm-chip rounded-lg p-3 flex flex-col gap-1 border border-farm-chipBorder/60">
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

      {/* Buildings shelf (019) — owned + purchasable buildings, in place */}
      {(shelfBuildings.length > 0 || hasLockedBuildings) && (
        <section aria-label="Buildings">
          <Awning />
          <p className="font-pixel text-[9px] text-farm-gold/60 tracking-widest uppercase mb-2">Buildings</p>
          <div className="flex flex-col gap-2">
            {shelfBuildings.map(c => (
              <BuildingCard
                key={c.def.id}
                def={c.def}
                owned={c.owned}
                canAfford={coinBalance >= c.def.cost}
                onBuy={onBuyBuilding}
              />
            ))}
            {hasLockedBuildings && (
              <div className="bg-farm-chip/60 rounded-lg p-3 flex items-center gap-2 border border-dashed border-farm-chipBorder">
                <span aria-hidden="true" className="text-lg">🔒</span>
                <p className="text-body text-farm-stone">
                  New buildings unlock in Season {nextBuildingSeason}
                </p>
              </div>
            )}
          </div>
          <ShelfLedge />
        </section>
      )}
    </aside>
  );
}
