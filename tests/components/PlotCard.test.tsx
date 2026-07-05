import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlotCard } from '../../src/components/PlotCard';
import type { PlotState } from '../../src/engine/types';

const emptyPlot = (id: number): PlotState => ({
  id, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
});

const makePlot = (overrides: Partial<PlotState> = {}): PlotState => ({
  id: 0, cropId: null, dayPlanted: null, daysRemaining: null,
  consecutiveHarvests: 0, exhaustedSinceDay: null, pestDamaged: false, droughtPenalised: false,
  ...overrides,
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

describe('PlotCard — exhausted guidance (017 FR-012/FR-013)', () => {
  const exhausted = (daysAgo: number) =>
    makePlot({ exhaustedSinceDay: 10 - daysAgo, cropId: null });

  it('says "Ready tomorrow" and does not solicit fertilizer at 1 day left', () => {
    render(<PlotCard plot={exhausted(2)} currentDay={10} fertilizerInventory={0} />);
    expect(screen.getByText(/ready tomorrow/i)).toBeInTheDocument();
    expect(screen.queryByText(/fertilizer/i)).toBeNull();
  });

  it('presents fertilizer as a costed trade-off at 3 days left (none owned)', () => {
    render(<PlotCard plot={exhausted(0)} currentDay={10} fertilizerInventory={0} />);
    expect(screen.getByText(/resting · 3d/i)).toBeInTheDocument();
    expect(screen.getByText(/30🪙 skips the wait/i)).toBeInTheDocument();
  });

  it('offers "skip the wait" as the action when fertilizer is owned and rest is long', () => {
    render(<PlotCard plot={exhausted(0)} currentDay={10} fertilizerInventory={1} />);
    expect(screen.getByRole('button', { name: /use fertilizer/i })).toHaveTextContent(/skip 3d/i);
  });

  it('keeps an owned-fertilizer action available but subdued at 1 day left', () => {
    render(<PlotCard plot={exhausted(2)} currentDay={10} fertilizerInventory={1} />);
    expect(screen.getByRole('button', { name: /use fertilizer/i })).toHaveTextContent(/use anyway/i);
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
