import { useLayoutEffect, useRef, useState } from 'react';
import type { PlotState } from '../engine/types';
import { EXHAUSTION_RECOVERY_DAYS, CROP_DEFINITIONS } from '../engine/constants';
import { ProgressRing } from './ProgressRing';
import { Coin } from './Coin';
import { CropSprite } from './CropSprite';
import { EmojiIcon } from './EmojiIcon';
import type { SpriteStage } from './cropSprites';

// T013 — crop-specific emojis for full/ready stages
const CROP_EMOJI: Record<string, string> = {
  radish:  '🌱',
  parsnip: '🥕',
  pumpkin: '🎃',
};

const CROP_LABEL: Record<string, string> = {
  radish:  'Radish',
  parsnip: 'Parsnip',
  pumpkin: 'Pumpkin',
};

// T013 — growth stage helper (equal-thirds of effectiveGrowthDays)
// Accounts for Flash Drought which doubles daysRemaining (droughtPenalised flag).
type GrowthStage = 'sprout' | 'small' | 'full' | 'ready';

function getGrowthStage(plot: PlotState, growthDays: number): GrowthStage {
  // Flash Drought doubles the effective grow time
  const effectiveGrowthDays = plot.droughtPenalised ? growthDays * 2 : growthDays;
  const daysRemaining = plot.daysRemaining ?? effectiveGrowthDays;
  const daysElapsed = effectiveGrowthDays - daysRemaining;

  if (daysRemaining === 0) return 'ready';
  if (effectiveGrowthDays <= 1) return 'full';
  if (effectiveGrowthDays === 2) return daysElapsed === 0 ? 'sprout' : 'full';

  // effectiveGrowthDays >= 3: equal thirds
  const third = effectiveGrowthDays / 3;
  if (daysElapsed < third) return 'sprout';
  if (daysElapsed < 2 * third) return 'small';
  return 'full';
}

// T014 — stage emoji map; sprout/small use generic growth emojis
const GROWTH_STAGE_EMOJI: Record<GrowthStage, string | null> = {
  sprout: '🌱',
  small:  '🌿',
  full:   null, // falls through to crop-specific emoji
  ready:  null,
};

// 018 — engine growth stage → sprite frame (see src/assets/crops/README.md)
const STAGE_TO_SPRITE: Record<GrowthStage, SpriteStage> = {
  sprout: 'seedling',
  small:  'sprout',
  full:   'mature',
  ready:  'ready',
};

interface PlotCardProps {
  plot: PlotState;
  currentDay?: number;
  fertilizerInventory?: number;
  locked?: boolean;
  /** Marks this tile as the onboarding 'plant' step's highlight target. */
  isPlantAnchor?: boolean;
  isNextPurchasable?: boolean;
  plotPrice?: number;
  canAffordPlot?: boolean;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
  onClearPestDamage?: (plotId: number) => void;
  onBuyPlot?: (plotId: number) => void;
}

function LockedPlot({ plot, isNextPurchasable, plotPrice, canAffordPlot, onBuyPlot }: {
  plot: PlotState; isNextPurchasable?: boolean; plotPrice?: number;
  canAffordPlot?: boolean; onBuyPlot?: (plotId: number) => void;
}) {
  if (isNextPurchasable && plotPrice !== undefined) {
    return (
      <button
        type="button"
        aria-label={`Buy plot · ${plotPrice}🪙, plot ${plot.id + 1}`}
        disabled={!canAffordPlot}
        onClick={() => onBuyPlot?.(plot.id)}
        className="flex flex-col items-center justify-center gap-1 w-full aspect-square overflow-hidden rounded-lg border-2 border-farm-gold/60 bg-[#160F07] p-1 select-none hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-2xl opacity-70">🔒</span>
        <span className="font-pixel text-caption leading-none text-farm-gold text-center">Buy plot <span className="whitespace-nowrap">· {plotPrice}<Coin /></span></span>
      </button>
    );
  }
  return (
    <div
      aria-label={`Locked plot ${plot.id + 1}`}
      className="flex flex-col items-center justify-center gap-1 w-full aspect-square overflow-hidden rounded-lg border-2 border-[#3D2510]/80 bg-[#160F07] opacity-80 select-none p-1"
    >
      <span className="text-2xl opacity-60">🔒</span>
      <span className="font-pixel text-caption text-farm-stone">Locked</span>
    </div>
  );
}

function PestDamagedPlot({ plot, onClearPestDamage }: {
  plot: PlotState;
  onClearPestDamage?: (plotId: number) => void;
}) {
  return (
    <div
      aria-label={`Plot ${plot.id + 1}: Pest Damage — click to clear`}
      className="
        flex flex-col items-center justify-center
        w-full aspect-square overflow-hidden rounded-lg border-2
        border-farm-red bg-[#2A1010]
        select-none p-1 shadow-inner
      "
    >
      <span className="text-2xl">🐛</span>
      <span className="text-body font-pixel text-farm-red/90 mt-1">Pest Damage</span>
      <button
        type="button"
        aria-label="Clear Plot — remove pest damage"
        onClick={() => onClearPestDamage?.(plot.id)}
        className="
          mt-1 font-pixel text-body px-1.5 py-0.5 rounded
          bg-farm-red text-farm-parchment
          hover:bg-[#d94040] active:scale-95 transition-all cursor-pointer
        "
      >
        Clear Plot
      </button>
    </div>
  );
}

// T016 — ExhaustedPlot: cracked earth gradient, grayscale, red border
function ExhaustedPlot({ plot, daysUntilRecovery, hasFertilizer, onApplyFertilizer }: {
  plot: PlotState;
  daysUntilRecovery: number;
  hasFertilizer: boolean;
  onApplyFertilizer?: (plotId: number) => void;
}) {
  return (
    <div
      aria-label={`Plot ${plot.id + 1}: Exhausted — ${daysUntilRecovery} day${daysUntilRecovery === 1 ? '' : 's'} until recovery`}
      className="
        flex flex-col items-center justify-center
        w-full aspect-square overflow-hidden rounded-lg border-2
        border-farm-red/60
        select-none p-2 text-center opacity-75
      "
      style={{
        background: [
          'repeating-linear-gradient(20deg, #3a2010 0px, #3a2010 8px, #2a1208 9px, #2a1208 10px)',
          'repeating-linear-gradient(-30deg, transparent 0px, transparent 12px, #1a0a02 13px, #1a0a02 14px)',
        ].join(', '),
        filter: 'grayscale(0.4)',
      }}
    >
      <span className="text-2xl">🪨</span>
      <span className="text-caption font-pixel text-farm-stone/80 mt-1 leading-snug">
        {daysUntilRecovery}d remaining
      </span>
      {hasFertilizer ? (
        <button
          type="button"
          aria-label="Use Fertilizer on this plot"
          onClick={() => onApplyFertilizer?.(plot.id)}
          className="
            mt-1 font-pixel text-caption px-1.5 py-0.5 rounded
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:scale-95 transition-all cursor-pointer
          "
        >
          Fertilize
        </button>
      ) : (
        <span className="text-caption text-farm-stone/70 mt-1 leading-snug">
          Fertilizer
          <br />
          in shop
        </span>
      )}
    </div>
  );
}

const RING_MAX = 52;
const RING_MIN = 20;

/**
 * Ring diameter that keeps the crop label and day badge clear of the tile
 * border. The tile is a fixed square, so the ring gets whatever vertical space
 * the label and badge leave behind. Their heights are measured rather than
 * assumed — the badge wraps to two lines on the narrowest tiles.
 */
function useRingSize(ref: React.RefObject<HTMLElement>): number {
  const [size, setSize] = useState(RING_MAX);

  useLayoutEffect(() => {
    const tile = ref.current;
    if (!tile) return;

    const measure = () => {
      const style = getComputedStyle(tile);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      // Every child except the ring itself (the first) is fixed-height chrome.
      const chrome = Array.from(tile.children)
        .slice(1)
        .reduce((total, child) => (
          total + (child as HTMLElement).offsetHeight + parseFloat(getComputedStyle(child).marginTop)
        ), 0);

      const budget = tile.clientHeight - padding - chrome;
      setSize(Math.max(RING_MIN, Math.min(RING_MAX, Math.floor(budget))));
    };
    measure();

    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(tile);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

// T014 — GrowingCropCard: ProgressRing + growth stages
function GrowingCropCard({ plot }: {
  plot: PlotState;
}) {
  const cropDef = CROP_DEFINITIONS[plot.cropId!];
  const growthDays = cropDef.growthDays;
  const daysRemaining = plot.daysRemaining ?? 0;
  const isReady = daysRemaining === 0;
  const stage = getGrowthStage(plot, growthDays);
  const effectiveGrowthDays = plot.droughtPenalised ? growthDays * 2 : growthDays;
  const progress = isReady ? 1 : 1 - (daysRemaining / effectiveGrowthDays);

  const stageEmoji = GROWTH_STAGE_EMOJI[stage] ?? CROP_EMOJI[plot.cropId!];
  const label = CROP_LABEL[plot.cropId!];

  const tileRef = useRef<HTMLDivElement>(null);
  const ringSize = useRingSize(tileRef);

  return (
    <div
      ref={tileRef}
      role="img"
      aria-label={`Plot ${plot.id + 1}: ${label}, planted day ${plot.dayPlanted}, ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining${plot.droughtPenalised ? ', growth slowed by Flash Drought' : ''}`}
      className={[
        'flex flex-col items-center justify-center',
        'w-full aspect-square overflow-hidden rounded-lg border-2 p-1',
        isReady
          ? 'border-farm-grass ring-2 ring-farm-grass/50 bg-[#162810]'
          : 'border-farm-gold/60 bg-[#1A2C10]',
        'select-none shadow-inner',
      ].join(' ')}
    >
      <ProgressRing progress={progress} size={ringSize}>
        {/* Crop art sits in the lower half of its 32×64 frame with transparent
            headroom above (so crops share a ground line as they grow). Lift the
            sprite ~¼ of its height so the visible crop centers in the ring instead
            of hugging the bottom; the transparent top absorbs the overflow. */}
        <span className="inline-flex" style={{ transform: `translateY(${-ringSize * (12 / 52)}px)` }}>
          <CropSprite
            cropId={plot.cropId!}
            stage={STAGE_TO_SPRITE[stage]}
            fallback={stageEmoji}
            size={ringSize}
            fallbackClass="text-3xl"
          />
        </span>
      </ProgressRing>
      <span className="text-body font-pixel text-farm-parchment/80 mt-1">{label}</span>
      {isReady ? (
        <span className="mt-1 font-pixel text-caption px-2 py-0.5 rounded bg-farm-grass text-farm-parchment">
          HARVEST
        </span>
      ) : (
        <span className="mt-1 font-pixel text-caption px-2 py-0.5 rounded bg-farm-gold/20 border border-farm-gold/50 text-farm-gold whitespace-nowrap">
          {daysRemaining}d left
          {plot.droughtPenalised && (
            <span
              aria-label="Growth slowed by Flash Drought"
              title="Growth slowed by Flash Drought"
            >
              {' '}☀️🔥
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export function PlotCard({ plot, currentDay = 1, fertilizerInventory = 0, locked, isPlantAnchor, isNextPurchasable, plotPrice, canAffordPlot, onPlant, onApplyFertilizer, onClearPestDamage, onBuyPlot }: PlotCardProps) {
  if (locked) {
    return (
      <LockedPlot
        plot={plot}
        isNextPurchasable={isNextPurchasable}
        plotPrice={plotPrice}
        canAffordPlot={canAffordPlot}
        onBuyPlot={onBuyPlot}
      />
    );
  }

  // Highest priority: pest damage blocks everything until acknowledged
  if (plot.pestDamaged) {
    return <PestDamagedPlot plot={plot} onClearPestDamage={onClearPestDamage} />;
  }

  if (plot.exhaustedSinceDay !== null) {
    return (
      <ExhaustedPlot
        plot={plot}
        daysUntilRecovery={EXHAUSTION_RECOVERY_DAYS - (currentDay - plot.exhaustedSinceDay)}
        hasFertilizer={fertilizerInventory > 0}
        onApplyFertilizer={onApplyFertilizer}
      />
    );
  }

  if (plot.cropId !== null) {
    return <GrowingCropCard plot={plot} />;
  }

  // T015 — EmptyPlot: dark tilled soil with hover CTA
  return (
    <button
      type="button"
      aria-label={`Empty plot ${plot.id + 1} — click to plant`}
      data-onboarding={isPlantAnchor ? 'empty-plot' : undefined}
      onClick={() => onPlant?.(plot.id)}
      className="
        group
        flex flex-col items-center justify-center
        w-full aspect-square overflow-hidden rounded-lg
        border border-[#3D2510]/80
        hover:border-farm-gold/50 hover:brightness-125
        cursor-pointer select-none
        transition-all duration-150
      "
      style={{
        background: 'repeating-linear-gradient(180deg, #2A1A0E 0px, #2A1A0E 5px, #221408 5px, #221408 7px)',
      }}
    >
      <span className="text-body font-pixel text-farm-gold">
        <EmojiIcon>🌱</EmojiIcon> Plant
      </span>
    </button>
  );
}
