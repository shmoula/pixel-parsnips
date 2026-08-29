import type { PlotState } from '../engine/types';
import { getDecorUrl } from './decorAssets';
import { PlotCard } from './PlotCard';

interface FarmGridProps {
  plots: PlotState[];
  currentDay?: number;
  fertilizerInventory?: number;
  /** Effective natural-recovery period for exhausted plots (2 with Compost Bin, 3 without). */
  recoveryDays?: number;
  unlockedPlots?: number;
  nextPlotPrice?: number | null;
  canAffordPlot?: boolean;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
  onClearPestDamage?: (plotId: number) => void;
  onBuyPlot?: (plotId: number) => void;
}

/**
 * Id of the first plot the player can plant into right now, or null if there is
 * none. The onboarding 'plant' step rings this one tile instead of the whole
 * grid, which on mobile is taller than the viewport.
 */
function firstPlantablePlotId(plots: PlotState[], unlockedPlots: number): number | null {
  const plot = plots.find(
    p => p.id < unlockedPlots && p.cropId === null && p.exhaustedSinceDay === null && !p.pestDamaged,
  );
  return plot ? plot.id : null;
}

/**
 * 028 — grid-edge decor, drawn from the same 018 asset registry as the page
 * backdrop. Replaces four hand-rolled inline <svg> blocks whose ellipses and
 * line-strokes read as a different art style from the pixel-art PNGs a few
 * pixels away. Every asset is optional: a missing file renders nothing, exactly
 * as PageBackdrop behaves.
 */
function GridDecor({ name, className, height }: { name: string; className: string; height: number }) {
  const url = getDecorUrl(name);
  if (url === null) return null;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ height, imageRendering: 'pixelated' }}
      className={`absolute pointer-events-none select-none ${className}`}
    />
  );
}

export function FarmGrid({ plots, currentDay = 1, fertilizerInventory = 0, recoveryDays, unlockedPlots, nextPlotPrice, canAffordPlot, onPlant, onApplyFertilizer, onClearPestDamage, onBuyPlot }: FarmGridProps) {
  const plantAnchorId = firstPlantablePlotId(plots, unlockedPlots ?? plots.length);
  return (
    // 028 — the grain sits on its own absolutely-positioned layer, not on the
    // wrapper. On the wrapper it filtered the whole subtree, and an SVG
    // turbulence filter over pixel art fights the `image-rendering: pixelated`
    // that keeps the LPC crop sprites crisp.
    <div className="relative isolate rounded-xl overflow-hidden p-3 bg-farm-field shadow-inner">
      <div aria-hidden="true" className="absolute inset-0 -z-10 [filter:url(#pp-grain)] bg-farm-field pointer-events-none" />

      {/* 028 — the bed's edge. A border plus an inset shadow so the grid reads
          as a recessed plot of earth; the pre-028 code called this a "fence
          border" and drew a flat rounded rectangle. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-xl border-4 border-farm-plotBorder pointer-events-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.45)]"
      />

      <GridDecor name="stones"  className="top-1 left-2"      height={20} />
      <GridDecor name="stones"  className="bottom-1 right-2"  height={20} />
      <GridDecor name="grass_1" className="top-1/3 left-0.5"  height={22} />
      <GridDecor name="grass_2" className="top-0.5 right-1/4" height={12} />

      {/* Farm plots grid */}
      <section aria-label="Farm plots">
        <div data-onboarding="farm-grid" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {plots.map(plot => {
            const locked = plot.id >= (unlockedPlots ?? plots.length);
            const isNextPurchasable = plot.id === (unlockedPlots ?? plots.length);
            return (
              <div key={plot.id} data-plot-id={plot.id}>
                <PlotCard
                  plot={plot}
                  currentDay={currentDay}
                  fertilizerInventory={fertilizerInventory}
                  recoveryDays={recoveryDays}
                  isPlantAnchor={plot.id === plantAnchorId}
                  locked={locked}
                  isNextPurchasable={locked && isNextPurchasable}
                  plotPrice={nextPlotPrice ?? undefined}
                  canAffordPlot={canAffordPlot}
                  onPlant={onPlant}
                  onApplyFertilizer={onApplyFertilizer}
                  onClearPestDamage={onClearPestDamage}
                  onBuyPlot={onBuyPlot}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
