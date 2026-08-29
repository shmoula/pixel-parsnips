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

/**
 * The onboarding 'plant' step rings this anchor. It marks the first plot the
 * player can actually plant into, so the ring points at one tile near the top of
 * the grid rather than framing the whole (viewport-taller) grid.
 */
describe('FarmGrid — plant onboarding anchor', () => {
  const anchors = (c: HTMLElement) => c.querySelectorAll('[data-onboarding="empty-plot"]');

  it('marks exactly the first plantable plot', () => {
    const { container } = render(<FarmGrid plots={mkPlots(12)} unlockedPlots={4} />);
    expect(anchors(container)).toHaveLength(1);
    expect(anchors(container)[0].getAttribute('aria-label')).toMatch(/empty plot 1/i);
  });

  it('skips planted, exhausted and pest-damaged plots when choosing the anchor', () => {
    const plots = mkPlots(4);
    plots[0] = { ...plots[0], cropId: 'radish', daysRemaining: 1 };
    plots[1] = { ...plots[1], exhaustedSinceDay: 1 };
    plots[2] = { ...plots[2], pestDamaged: true };

    const { container } = render(<FarmGrid plots={plots} unlockedPlots={4} />);
    expect(anchors(container)).toHaveLength(1);
    expect(anchors(container)[0].getAttribute('aria-label')).toMatch(/empty plot 4/i);
  });

  it('marks no anchor when a locked plot is the only empty one', () => {
    const plots = mkPlots(12).map(p => (p.id < 4 ? { ...p, cropId: 'radish', daysRemaining: 1 } : p));
    const { container } = render(<FarmGrid plots={plots} unlockedPlots={4} />);
    expect(anchors(container)).toHaveLength(0);
  });
});

describe('FarmGrid — mobile columns (017 FR-021)', () => {
  // 6-across waits until lg: at md the plot area is only ~480px wide, which
  // squeezed tiles to 72px and pushed the day badge through the tile border.
  it('uses 3 columns below sm and 4/6 above', () => {
    const { container } = render(<FarmGrid plots={mkPlots(12)} />);
    const grid = container.querySelector('[data-onboarding="farm-grid"]');
    expect(grid?.className).toContain('grid-cols-3');
    expect(grid?.className).toContain('sm:grid-cols-4');
    expect(grid?.className).toContain('lg:grid-cols-6');
  });
});

describe('FarmGrid — 021 celebration anchors', () => {
  it('wraps every plot in an element carrying data-plot-id', () => {
    const plots: PlotState[] = mkPlots(2);
    const { container } = render(<FarmGrid plots={plots} />);
    expect(container.querySelector('[data-plot-id="0"]')).not.toBeNull();
    expect(container.querySelector('[data-plot-id="1"]')).not.toBeNull();
  });
});

// 028 replaced four hand-rolled inline <svg> decorations on the grid bed with
// PNG stones/grass sprites; those field sprites were then removed entirely by
// request. The grid bed now carries no decorative sprites of its own — only the
// plot tiles — and the grain filter sits on its own layer, off the plot subtree.
describe('FarmGrid — grid bed has no decorative sprites', () => {
  it('renders no inline SVG decorations', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('renders no decorative decor images on the grid bed', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    // Empty plots draw no crop sprites, so any <img> here would be bed decor.
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('does not apply the grain filter to the plot subtree', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    const section = container.querySelector('section[aria-label="Farm plots"]');
    let node: HTMLElement | null = section as HTMLElement;
    while (node && node !== container) {
      expect(node.className).not.toMatch(/pp-grain/);
      node = node.parentElement;
    }
  });
});
