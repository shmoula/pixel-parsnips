import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HUD } from '../../src/components/HUD';

const baseProps = {
  onToggleShop: vi.fn(),
  onNextDay: vi.fn(),
  onLastTurn: vi.fn(),
  isProcessing: false,
  hasLastTurn: false,
  endlessMode: false,
};

describe('HUD — Season indicator (US1)', () => {
  it('renders season name and day-into-season on Day 1', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 1 \/ 20/i)).toBeInTheDocument();
  });

  it('renders Season 2 (Summer Heat) on Day 25', () => {
    render(<HUD {...baseProps} currentDay={25} coinBalance={200} />);
    expect(screen.getByText(/Summer Heat/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 5 \/ 20/i)).toBeInTheDocument();
  });

  it('renders the season target alongside the coin balance', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={87} />);
    expect(screen.getByText(/87 \/ 150 target/i)).toBeInTheDocument();
  });
});

describe('HUD — Day 18+ warning and Day 20 preview (US6)', () => {
  it('shows "3 days left" warning at Day 18 when target not met', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={50} />);
    expect(screen.getByText(/3 days left/i)).toBeInTheDocument();
  });

  it('suppresses warning at Day 18 when target already met', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={200} />);
    expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
  });

  it('shows lease preview on Day 20 of Season 1', () => {
    render(<HUD {...baseProps} currentDay={20} coinBalance={150} />);
    expect(screen.getByText(/rises to 20 next season/i)).toBeInTheDocument();
  });

  it('does NOT show lease preview on Day 80 (Season 4) when endlessMode is false', () => {
    render(<HUD {...baseProps} currentDay={80} coinBalance={600} endlessMode={false} />);
    expect(screen.queryByText(/rises to .* next season/i)).not.toBeInTheDocument();
  });

  it('shows lease preview on Day 80 when endlessMode is true', () => {
    render(<HUD {...baseProps} currentDay={80} coinBalance={600} endlessMode={true} />);
    expect(screen.getByText(/rises to 32 next season/i)).toBeInTheDocument();
  });

  it('shows correct Endless lease preview on Day 100 (Endless Season 5 endDay → Endless Season 6 lease)', () => {
    render(<HUD {...baseProps} currentDay={100} coinBalance={800} endlessMode={true} />);
    expect(screen.getByText(/rises to 34 next season/i)).toBeInTheDocument();
  });
});

describe('HUD — harvest streak chip', () => {
  it('hides the streak chip when harvestStreak === 0', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={0} />);
    expect(screen.queryByLabelText(/harvest streak/i)).toBeNull();
  });

  it('shows the streak chip with ×N when harvestStreak > 0', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={7} />);
    const chip = screen.getByLabelText(/harvest streak/i);
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('×7');
  });
});
