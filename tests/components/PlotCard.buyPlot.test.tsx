import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlotCard } from '../../src/components/PlotCard';
import type { PlotState } from '../../src/engine/types';

const lockedPlot: PlotState = {
  id: 4, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null,
  pestDamaged: false, droughtPenalised: false,
};

describe('PlotCard — buy-plot tile', () => {
  it('renders the next purchasable plot as a single full-tile button', () => {
    render(
      <PlotCard plot={lockedPlot} locked isNextPurchasable plotPrice={30}
        canAffordPlot onBuyPlot={vi.fn()} />,
    );
    const tile = screen.getByRole('button', { name: /buy plot · 30/i });
    expect(tile.className).toContain('aspect-square');
    expect(tile.className).toContain('overflow-hidden');
  });

  it('calls onBuyPlot with the plot id when tapped', () => {
    const onBuyPlot = vi.fn();
    render(
      <PlotCard plot={lockedPlot} locked isNextPurchasable plotPrice={30}
        canAffordPlot onBuyPlot={onBuyPlot} />,
    );
    screen.getByRole('button', { name: /buy plot · 30/i }).click();
    expect(onBuyPlot).toHaveBeenCalledWith(4);
  });
});
