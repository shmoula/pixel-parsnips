import type { PlotState, CropId } from '../engine/types';
import { PlotCard } from './PlotCard';

interface FarmGridProps {
  plots: PlotState[];
  currentDay?: number;
  fertilizerInventory?: number;
  onPlant?: (plotId: number) => void;
  onApplyFertilizer?: (plotId: number) => void;
  selectedCrop?: CropId | null;
}

export function FarmGrid({ plots, currentDay = 1, fertilizerInventory = 0, onPlant, onApplyFertilizer }: FarmGridProps) {
  return (
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
          />
        ))}
      </div>
    </section>
  );
}
