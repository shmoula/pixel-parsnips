import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlotCard } from '../../src/components/PlotCard';
import type { PlotState } from '../../src/engine/types';

const emptyPlot = (id: number): PlotState => ({
  id, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
});

describe('LockedPlot', () => {
  it('shows a Buy button on the next purchasable plot and calls onBuyPlot', async () => {
    const onBuyPlot = vi.fn();
    render(
      <PlotCard plot={emptyPlot(4)} locked isNextPurchasable plotPrice={40} canAffordPlot
        onBuyPlot={onBuyPlot} />,
    );
    const btn = screen.getByRole('button', { name: /buy plot/i });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(onBuyPlot).toHaveBeenCalledWith(4);
  });

  it('disables the Buy button when unaffordable', () => {
    render(
      <PlotCard plot={emptyPlot(4)} locked isNextPurchasable plotPrice={40} canAffordPlot={false}
        onBuyPlot={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /buy plot/i })).toBeDisabled();
  });

  it('renders a plain lock (no button) for a non-next locked plot', () => {
    render(<PlotCard plot={emptyPlot(7)} locked isNextPurchasable={false} />);
    expect(screen.queryByRole('button', { name: /buy plot/i })).toBeNull();
    expect(screen.getByLabelText(/locked plot 8/i)).toBeTruthy();
  });
});
