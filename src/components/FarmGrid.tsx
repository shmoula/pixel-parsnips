import type { PlotState } from '../engine/types';
import { PlotCard } from './PlotCard';

interface FarmGridProps {
  plots: PlotState[];
  currentDay?: number;
  fertilizerInventory?: number;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
  onClearPestDamage?: (plotId: number) => void;
  /** True when a seed has been purchased and the player must tap an empty plot to plant it. */
  isPlantingMode?: boolean;
}

export function FarmGrid({ plots, currentDay = 1, fertilizerInventory = 0, onPlant, onApplyFertilizer, onClearPestDamage, isPlantingMode = false }: FarmGridProps) {
  return (
    // T017 — textured farm canvas: dark tilled soil + grain filter + fence border + decor
    // US5 — ring/glow added to container when player is in planting mode
    <div className={[
      'relative rounded-xl overflow-hidden p-3 bg-[#2A1A0E] [filter:url(#pp-grain)] shadow-inner',
      isPlantingMode ? 'ring-2 ring-farm-gold/70 shadow-[0_0_12px_2px_rgba(245,200,66,0.25)]' : '',
    ].join(' ')}>

      {/* Decorative fence border frame */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-xl border-4 border-[#5C3D1E] pointer-events-none"
      />

      {/* Pebbles — top-left cluster */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="absolute top-1 left-2 pointer-events-none"
        width="28"
        height="20"
      >
        <ellipse cx="7"  cy="13" rx="6" ry="5"  fill="#5C3D1E" opacity="0.75" />
        <ellipse cx="19" cy="8"  rx="5" ry="4"  fill="#5C3D1E" opacity="0.55" />
        <ellipse cx="24" cy="16" rx="3" ry="2.5" fill="#5C3D1E" opacity="0.5" />
      </svg>

      {/* Pebbles — bottom-right cluster */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="absolute bottom-1 right-2 pointer-events-none"
        width="28"
        height="20"
      >
        <ellipse cx="6"  cy="8"  rx="5" ry="4"   fill="#5C3D1E" opacity="0.55" />
        <ellipse cx="18" cy="13" rx="6" ry="5"   fill="#5C3D1E" opacity="0.75" />
        <ellipse cx="24" cy="6"  rx="3" ry="2.5" fill="#5C3D1E" opacity="0.5" />
      </svg>

      {/* Grass tufts — mid-left edge */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="absolute top-1/3 left-0.5 pointer-events-none"
        width="10"
        height="22"
      >
        <line x1="3"  y1="22" x2="2"  y2="10" stroke="#4A7230" strokeWidth="2" strokeLinecap="round" />
        <line x1="6"  y1="22" x2="5"  y2="6"  stroke="#4A7230" strokeWidth="2" strokeLinecap="round" />
        <line x1="9"  y1="22" x2="8"  y2="12" stroke="#4A7230" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Grass tuft — top-right edge */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="absolute top-0.5 right-1/4 pointer-events-none"
        width="14"
        height="12"
      >
        <line x1="3"  y1="12" x2="2"  y2="4"  stroke="#4A7230" strokeWidth="2" strokeLinecap="round" />
        <line x1="7"  y1="12" x2="6"  y2="2"  stroke="#4A7230" strokeWidth="2" strokeLinecap="round" />
        <line x1="11" y1="12" x2="10" y2="5"  stroke="#4A7230" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Farm plots grid */}
      <section aria-label="Farm plots">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {plots.map(plot => (
            <PlotCard
              key={plot.id}
              plot={plot}
              currentDay={currentDay}
              fertilizerInventory={fertilizerInventory}
              onPlant={onPlant}
              onApplyFertilizer={onApplyFertilizer}
              onClearPestDamage={onClearPestDamage}
              isPlantingMode={isPlantingMode}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
