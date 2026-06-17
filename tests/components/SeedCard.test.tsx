import { describe, it, expect } from 'vitest';
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
});
