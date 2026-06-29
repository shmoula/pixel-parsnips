import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeedCard } from '../../src/components/SeedCard';

const noop = () => {};

function renderCard(marketEvent?: { kind: 'shortage' | 'glut'; multiplier: number }) {
  render(
    <SeedCard
      cropId="pumpkin"
      price={20}
      seedCount={0}
      onBuy={noop}
      onSelect={noop}
      canAfford
      isSelected={false}
      marketEvent={marketEvent}
    />,
  );
}

describe('SeedCard — market indicator', () => {
  it('shows an up arrow and percent for a shortage', () => {
    renderCard({ kind: 'shortage', multiplier: 1.4 });
    expect(screen.getByText(/▲ \+40%/)).toBeInTheDocument();
  });
  it('shows a down arrow and percent for a glut', () => {
    renderCard({ kind: 'glut', multiplier: 0.7 });
    expect(screen.getByText(/▼ -30%/)).toBeInTheDocument();
  });
  it('shows no indicator when there is no market event', () => {
    renderCard(undefined);
    expect(screen.queryByLabelText(/^Market /i)).not.toBeInTheDocument();
  });
});

describe('SeedCard — market-adjusted yield/profit', () => {
  // pumpkin baseYield 65, price 20 → base profit 45
  it('strikes through base yield/profit and shows boosted values under a shortage', () => {
    renderCard({ kind: 'shortage', multiplier: 1.4 });
    // adjusted yield floor(65 * 1.4) = 91, adjusted profit 91 - 20 = 71
    expect(screen.getByText('65🪙').className).toContain('line-through');
    expect(screen.getByText('91🪙')).toBeInTheDocument();
    expect(screen.getByText('+45🪙').className).toContain('line-through');
    expect(screen.getByText('+71🪙')).toBeInTheDocument();
  });

  it('strikes through base yield/profit and shows reduced values under a glut', () => {
    renderCard({ kind: 'glut', multiplier: 0.7 });
    // adjusted yield floor(65 * 0.7) = 45, adjusted profit 45 - 20 = 25
    expect(screen.getByText('65🪙').className).toContain('line-through');
    expect(screen.getByText('45🪙')).toBeInTheDocument();
    expect(screen.getByText('+45🪙').className).toContain('line-through');
    expect(screen.getByText('+25🪙')).toBeInTheDocument();
  });

  it('shows plain yield/profit with no strikethrough when the market is quiet', () => {
    renderCard(undefined);
    expect(screen.getByText('65🪙 yield').className).not.toContain('line-through');
    expect(screen.getByText('Est. profit: +45🪙')).toBeInTheDocument();
  });

  it('renders a negative net profit without a stray plus sign', () => {
    // price (80) above pumpkin baseYield (65) → netProfit -15
    render(
      <SeedCard
        cropId="pumpkin"
        price={80}
        seedCount={0}
        onBuy={noop}
        onSelect={noop}
        canAfford
        isSelected={false}
      />,
    );
    expect(screen.getByText('Est. profit: -15🪙')).toBeInTheDocument();
    expect(screen.queryByText(/\+-/)).not.toBeInTheDocument();
  });
});

describe('SeedCard — mobile touch targets', () => {
  it('gives the BUY button a 44px minimum height on mobile', () => {
    render(
      <SeedCard cropId="radish" price={5} seedCount={0}
        onBuy={vi.fn()} onSelect={vi.fn()} canAfford={true} isSelected={false} />,
    );
    const buy = screen.getByRole('button', { name: /buy radish seed/i });
    expect(buy.className).toContain('min-h-[44px]');
    expect(buy.className).toContain('md:min-h-0');
  });

  it('gives the Plant button a 44px minimum height on mobile', () => {
    render(
      <SeedCard cropId="radish" price={5} seedCount={2}
        onBuy={vi.fn()} onSelect={vi.fn()} canAfford={true} isSelected={false} />,
    );
    const plant = screen.getByRole('button', { name: /select radish seed to plant/i });
    expect(plant.className).toContain('min-h-[44px]');
    expect(plant.className).toContain('md:min-h-0');
  });
});
