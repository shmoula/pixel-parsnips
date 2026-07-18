import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BuildingCard } from '../../src/components/BuildingCard';
import { BUILDING_DEFINITIONS } from '../../src/engine/constants';

const scarecrow = BUILDING_DEFINITIONS.find(d => d.id === 'scarecrow')!;

describe('BuildingCard', () => {
  it('renders name, description, and a buy button with the price', () => {
    const onBuy = vi.fn();
    render(<BuildingCard def={scarecrow} owned={false} canAfford={true} onBuy={onBuy} />);
    expect(screen.getByText('Scarecrow')).toBeInTheDocument();
    expect(screen.getByText('Pests destroy half as many plots')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Buy Scarecrow for 220 coins/ }));
    expect(onBuy).toHaveBeenCalledWith('scarecrow');
  });

  it('disables the buy button when unaffordable', () => {
    render(<BuildingCard def={scarecrow} owned={false} canAfford={false} onBuy={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Buy Scarecrow/ })).toBeDisabled();
  });

  it('renders the compact owned variant without a button', () => {
    render(<BuildingCard def={scarecrow} owned={true} canAfford={false} onBuy={vi.fn()} />);
    expect(screen.getByText('Scarecrow')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
