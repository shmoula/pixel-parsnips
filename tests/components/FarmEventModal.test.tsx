import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FarmEventModal, choiceCost } from '../../src/components/FarmEventModal';
import { FARM_EVENT_DEFINITIONS } from '../../src/engine/farmEventCatalog';

const def = (id: string) => FARM_EVENT_DEFINITIONS.find(e => e.id === id)!;

describe('choiceCost', () => {
  it('sums negative coins_delta amounts as a positive cost', () => {
    expect(choiceCost(def('wandering_beekeeper').choiceA.effects)).toBe(15);
    expect(choiceCost(def('millers_order').choiceB.effects)).toBe(0);
  });
});

describe('FarmEventModal', () => {
  it('renders title, body, and both choices; clicking reports the choice', () => {
    const onChoose = vi.fn();
    render(<FarmEventModal view={{ def: def('millers_order'), offerValue: 0, balance: 100 }} isNew={false} onChoose={onChoose} />);
    expect(screen.getByRole('dialog', { name: "The Miller's Order" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /take the contract/i }));
    expect(onChoose).toHaveBeenCalledWith('A');
    fireEvent.click(screen.getByRole('button', { name: /sell your spare sacks/i }));
    expect(onChoose).toHaveBeenCalledWith('B');
  });

  it('shows the live merchant estimate', () => {
    render(<FarmEventModal view={{ def: def('traveling_merchant'), offerValue: 107, balance: 100 }} isNew={false} onChoose={() => {}} />);
    expect(screen.getByText(/est\. \+107🪙/)).toBeInTheDocument();
  });

  it('disables an unaffordable buy-in with a hint', () => {
    const onChoose = vi.fn();
    render(<FarmEventModal view={{ def: def('wandering_beekeeper'), offerValue: 0, balance: 10 }} isNew={false} onChoose={onChoose} />);
    const btn = screen.getByRole('button', { name: /pay 15🪙/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/not enough coins/i)).toBeInTheDocument();
  });

  it('shows the New! ribbon only on the second run', () => {
    const { rerender } = render(<FarmEventModal view={{ def: def('bountiful_spring'), offerValue: 0, balance: 100 }} isNew={true} onChoose={() => {}} />);
    expect(screen.getByText('New!')).toBeInTheDocument();
    rerender(<FarmEventModal view={{ def: def('bountiful_spring'), offerValue: 0, balance: 100 }} isNew={false} onChoose={() => {}} />);
    expect(screen.queryByText('New!')).toBeNull();
  });

  it('does not close on Escape — a choice is required', () => {
    const onChoose = vi.fn();
    render(<FarmEventModal view={{ def: def('bountiful_spring'), offerValue: 0, balance: 100 }} isNew={false} onChoose={onChoose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
