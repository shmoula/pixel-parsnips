import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlotCard } from '../../src/components/PlotCard';
import type { PlotState } from '../../src/engine/types';

const makePlot = (overrides: Partial<PlotState> = {}): PlotState => ({
  id: 0, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
  ...overrides,
});

const emptyPlot = (id: number): PlotState => makePlot({ id });

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

describe('PlotCard — drought marker inline (017 FR-021)', () => {
  it('renders the flash-drought marker inside the time badge row, not as an extra row', () => {
    render(
      <PlotCard
        plot={makePlot({ cropId: 'pumpkin', daysRemaining: 4, dayPlanted: 1, droughtPenalised: true })}
        currentDay={2}
      />,
    );
    const badge = screen.getByText(/4d left/i);
    expect(badge).toHaveTextContent('☀️🔥');
  });
});
