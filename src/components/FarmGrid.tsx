import type { PlotState, CropId } from '../engine/types';
import { PlotCard } from './PlotCard';

interface FarmGridProps {
  plots: PlotState[];
  onPlant?: (plotId: number) => void;
  selectedCrop?: CropId | null;
}

export function FarmGrid({ plots, onPlant, selectedCrop: _selectedCrop }: FarmGridProps) {
  return (
    <section aria-label="Farm plots">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {plots.map(plot => (
          <PlotCard key={plot.id} plot={plot} onPlant={onPlant} />
        ))}
      </div>
    </section>
  );
}
