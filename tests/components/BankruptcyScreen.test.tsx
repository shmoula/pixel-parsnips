import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';

describe('BankruptcyScreen — Season reached line', () => {
  it('shows Season 1 (Spring Thaw) when run ended in Season 1', () => {
    render(<BankruptcyScreen daysPlayed={12} peakBalance={150} onRestart={vi.fn()} />);
    expect(screen.getByText(/Season reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
  });

  it('shows Season 3 (Autumn Pressure) when run ended at Day 50', () => {
    render(<BankruptcyScreen daysPlayed={50} peakBalance={400} onRestart={vi.fn()} />);
    expect(screen.getByText(/Autumn Pressure/i)).toBeInTheDocument();
  });
});
