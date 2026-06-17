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
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
