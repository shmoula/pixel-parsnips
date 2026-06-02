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
