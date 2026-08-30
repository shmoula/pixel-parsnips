import type { CropId, CropDefinition } from '../engine/types';
import { CROP_DEFINITIONS, coins } from '../engine/constants';
import { Coin } from './Coin';
import { CropSprite } from './CropSprite';
import { PALETTE } from '../theme/palette';

const CROP_EMOJI: Record<CropId, string> = {
  radish: '🌱',
  parsnip: '🥕',
  pumpkin: '🎃',
};

/**
 * Per-crop painted-card theme (016 shop reskin). `cardBg` tints the whole card so the
 * shelf reads at a glance — radish red, parsnip green, pumpkin orange — while `border`
 * gives it a crisp painted edge. Colour is never the sole signal: the name label and
 * BUY price stay as text (sharp_edges.md → colorblind-failure).
 */
const CROP_THEME: Record<CropId, { cardBg: string; border: string }> = {
  radish:  { cardBg: PALETTE.cropRadishBg,  border: PALETTE.cropRadishBorder },
  parsnip: { cardBg: PALETTE.cropParsnipBg, border: PALETTE.cropParsnipBorder },
  pumpkin: { cardBg: PALETTE.cropPumpkinBg, border: PALETTE.cropPumpkinBorder },
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
  /**
   * Owned-building yield factor applied to every crop (Farm Stand = 1.1, else 1).
   * Folded into the displayed yield/profit so the shop matches what the harvest
   * engine actually pays out (gameEngine `stallMod`). Defaults to 1.
   */
  yieldMultiplier?: number;
  dimmed?: boolean;
  /** When true, BUY/Plant are disabled (e.g. non-radish cards during the tutorial buy step). */
  interactionDisabled?: boolean;
}

/** Build the card root className given selection + dim state. */
function seedCardClass(isSelected: boolean, dimmed: boolean | undefined): string {
  return [
    'flex flex-col gap-1 p-3 rounded-lg border-2 transition-all',
    isSelected ? 'ring-2 ring-farm-gold' : '',
    dimmed ? 'opacity-40' : '',
  ].join(' ');
}

/** data-onboarding anchor value for a seed card, if any. */
function seedCardAnchor(cropId: CropId): string | undefined {
  return cropId === 'radish' ? 'shop-radish' : undefined;
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

/** Signed prefix for a coin amount: "+" for zero/positive, "" for negative (the
 * minus sign is already part of the number). */
function sign(n: number): string {
  return n >= 0 ? '+' : '';
}

interface AdjustedStats {
  netProfit: number;
  /** Adjusted yield/profit, or null when no buff/event moves the numbers. */
  adjustedYield: number | null;
  adjustedProfit: number | null;
  /** Direction tint for the adjusted values (down = red, up = grass). */
  tint: string;
}

/**
 * Combine the market event and the Farm Stand buff into a single yield factor and
 * derive the adjusted yield/profit. Applied in one coins() floor so the shop matches
 * the harvest engine exactly (gameEngine multiplies base × weather × market × stall
 * under one floor). `adjusted*` stay null when the net factor is 1 (nothing to show).
 */
function computeAdjustedStats(
  crop: CropDefinition,
  price: number,
  yieldMultiplier: number,
  marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number },
): AdjustedStats {
  const effectiveMultiplier = (marketEvent?.multiplier ?? 1) * yieldMultiplier;
  const adjustedYield =
    effectiveMultiplier !== 1 ? coins(crop.baseYield * effectiveMultiplier) : null;
  const adjustedProfit = adjustedYield !== null ? adjustedYield - price : null;
  const tint = adjustedYield !== null && adjustedYield < crop.baseYield
    ? 'text-farm-red'
    : 'text-farm-grass';
  return { netProfit: crop.baseYield - price, adjustedYield, adjustedProfit, tint };
}

/**
 * Grow / yield / est.-profit stats. When a market event or the Farm Stand buff moves
 * the numbers, the base yield and profit are struck through and the adjusted values
 * shown alongside, tinted by direction (up = grass, down = red).
 */
function CropStats({
  crop,
  price,
  marketEvent,
  yieldMultiplier = 1,
}: {
  crop: CropDefinition;
  price: number;
  marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number };
  yieldMultiplier?: number;
}) {
  const { netProfit, adjustedYield, adjustedProfit, tint } =
    computeAdjustedStats(crop, price, yieldMultiplier, marketEvent);

  return (
    <>
      <div className="text-xs text-farm-parchment/75">
        <span>{crop.growthDays}d grow</span>
        <span className="mx-1">·</span>
        {adjustedYield !== null ? (
          <span>
            <span className="line-through opacity-60">{crop.baseYield}<Coin /></span>{' '}
            <span className={tint}>{adjustedYield}<Coin /></span> yield
          </span>
        ) : (
          <span>{crop.baseYield}<Coin /> yield</span>
        )}
      </div>

      {/* T018b — estimated net profit display (light mint reads on the tinted card) */}
      <p className="text-xs text-farm-profitMint font-pixel">
        {adjustedProfit !== null ? (
          <span>
            Est. profit:{' '}
            <span className="line-through opacity-60">{sign(netProfit)}{netProfit}<Coin /></span>{' '}
            <span className={tint}>
              {sign(adjustedProfit)}{adjustedProfit}<Coin />
            </span>
          </span>
        ) : (
          <span>Est. profit: {sign(netProfit)}{netProfit}<Coin /></span>
        )}
      </p>
    </>
  );
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
  yieldMultiplier,
  dimmed,
  interactionDisabled,
}: SeedCardProps) {
  const crop = CROP_DEFINITIONS[cropId];
  const disabled = !canAfford || interactionDisabled === true;
  const theme = CROP_THEME[cropId];

  // G7 — price-direction badge for an active market event on this crop
  const marketLabel = formatMarketBadge(marketEvent);

  return (
    // 016 — painted colored card; gold border+ring when selected. textShadow on the
    // root cascades to every label so text stays legible on the tinted fill
    // (sharp_edges.md → no-text-outline-or-shadow).
    <div
      data-onboarding={seedCardAnchor(cropId)}
      className={seedCardClass(isSelected, dimmed)}
      style={{
        backgroundColor: theme.cardBg,
        borderColor: isSelected ? PALETTE.gold : theme.border,
        textShadow: '0 1px 1px rgba(0,0,0,0.55)',
      }}
    >
      <div className="flex items-center justify-between">
        {/* 018 — inset frame: the sprite reads as an item on display, not floating.
            Crop sprites are 32×64 with the art in the bottom ~half and transparent
            headroom above (so crops share a ground line as they grow on the board).
            Here we bottom-align inside a shorter clip window (overflow-hidden) so that
            wasted headroom is trimmed and the crop sits centered with even margin. */}
        <span
          className="inline-flex items-end justify-center overflow-hidden rounded-md px-2 pb-1"
          style={{
            height: 40,
            backgroundColor: 'rgba(0,0,0,0.28)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          <CropSprite
            cropId={cropId}
            stage="ready"
            fallback={CROP_EMOJI[cropId]}
            size={64}
            fallbackClass="text-2xl leading-none"
          />
        </span>
        {seedCount > 0 && (
          <span className="text-body font-pixel bg-farm-grass text-farm-parchment px-1.5 py-0.5 rounded">
            ×{seedCount}
          </span>
        )}
        {marketLabel && (
          <span
            aria-label={`Market ${marketEvent!.kind}`}
            className={[
              'text-body font-pixel px-1.5 py-0.5 rounded',
              marketEvent!.kind === 'shortage'
                ? 'bg-farm-grass/30 text-farm-grass'
                : 'bg-farm-red/30 text-farm-red',
            ].join(' ')}
          >
            {marketLabel}
          </span>
        )}
      </div>

      <p className="font-pixel text-body text-farm-parchment/90">{crop.name}</p>

      <CropStats crop={crop} price={price} marketEvent={marketEvent} yieldMultiplier={yieldMultiplier} />

      {/* T018d,e — BUY prefix + active:scale-95 press feedback */}
      <button
        type="button"
        aria-label={`Buy ${crop.name} seed for ${price} coins`}
        disabled={disabled}
        onClick={() => onBuy(cropId)}
        className="
          mt-1 w-full py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-body
          bg-farm-gold text-farm-ink
          hover:bg-farm-grass hover:text-farm-parchment
          active:scale-95 active:brightness-90
          disabled:opacity-40 disabled:cursor-not-allowed
          transition-all
        "
      >
        {canAfford ? <>BUY {price}<Coin /></> : <>Need {price}<Coin /></>}
      </button>

      {seedCount > 0 && (
        <button
          type="button"
          aria-label={`Select ${crop.name} seed to plant`}
          aria-pressed={isSelected}
          disabled={interactionDisabled === true}
          onClick={() => onSelect(cropId)}
          className={`
            w-full py-1 min-h-[44px] md:min-h-0 rounded font-pixel text-body transition-colors
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
