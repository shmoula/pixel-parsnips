import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FarmGrid } from '../../src/components/FarmGrid';
import type { PlotState } from '../../src/engine/types';

const mkPlots = (n: number): PlotState[] =>
  Array.from({ length: n }, (_, id) => ({
    id, cropId: null, dayPlanted: null, daysRemaining: null,
    consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
  }));

describe('FarmGrid lock rendering', () => {
  it('renders locked plots beyond unlockedPlots and a single Buy button', () => {
    render(<FarmGrid plots={mkPlots(12)} unlockedPlots={4} nextPlotPrice={40} canAffordPlot onBuyPlot={() => {}} />);
    // 7 plain locked tiles + 1 purchasable tile (now a full-tile button with "Buy plot" label)
    expect(screen.getAllByLabelText(/locked plot/i)).toHaveLength(7);
    expect(screen.getAllByRole('button', { name: /buy plot/i })).toHaveLength(1);
  });

  it('renders no locked plots when all are unlocked (default)', () => {
    render(<FarmGrid plots={mkPlots(12)} unlockedPlots={12} />);
    expect(screen.queryAllByLabelText(/locked plot/i)).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: /buy plot/i })).toHaveLength(0);
  });
});
